import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ContestService } from '../src/application/contest/contest-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { loadConfig } from '../src/config/environment.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';

const config = loadConfig(); if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Contest database tests.');
const database = createDatabase(config.databaseUrl);
const playerIds = new Set<string>();
const characterIds = new Set<string>();
const fixtureDates = ['2098-09-01', '2098-09-02', '2098-09-03', '2098-09-04', '2098-09-05', '2098-09-06', '2098-09-07', '2098-09-08', '2098-09-09', '2098-09-10', '2098-09-11', '2098-09-12', '2098-09-13'] as const;
let now = new Date('2098-09-01T10:00:00.000Z');
let rolls: number[] = [];
const clock = { now: () => now };
const random = { nextInt: (maximum: number) => (rolls.shift() ?? 0) % maximum };
const identity = { subject: 'contest-fixture' } as const;

beforeAll(cleanup);
beforeEach(cleanup);
afterAll(async () => { try { await cleanup(); } finally { await database.$disconnect(); } });

async function fixture(name: string) {
  const character = await database.character.findFirstOrThrow({ where: { isActive: true, rarity: 5 }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] });
  const id = randomUUID(); playerIds.add(id);
  await database.player.create({ data: {
    id, displayName: `Contest Fixture ${name} ${id.slice(0, 6)}`, elementKey: 'hydro',
    resourceBalances: { create: resourceKeys.map((resourceKey) => ({ resourceKey, amount: 0n })) }, economyStats: { create: {} },
    characters: { create: { characterId: character.id, constellation: 6, copies: 7, firstObtainedAt: now } },
    c6Progress: { create: { characterId: character.id, strength: 20, intelligence: 12, beauty: 8, charisma: 4, popularity: 1, unlockedAt: now } },
  } });
  const current = new GetCurrentPlayer({ findByIdentity: async () => ({ id, displayName: `Contest Fixture ${name} ${id.slice(0, 6)}`, elementKey: 'hydro', status: 'ACTIVE' as const }), provision: async () => { throw new Error('not used'); } });
  return { id, character, service: new ContestService(current, database, clock, random) };
}

async function eligibilityFixture(name: string, options: { rarity: number; constellation: number; isActive: boolean; possession: boolean }) {
  const characterId = randomUUID(); characterIds.add(characterId);
  const externalKey = `contest-fixture-${characterId}`;
  const character = await database.character.create({ data: { id: characterId, externalKey, name: `Legend ${name}`, rarity: options.rarity, elementKey: 'hydro', isActive: options.isActive } });
  const id = randomUUID(); playerIds.add(id);
  await database.player.create({ data: {
    id, displayName: `Contest Eligibility ${name} ${id.slice(0, 6)}`, elementKey: 'hydro',
    resourceBalances: { create: resourceKeys.map((resourceKey) => ({ resourceKey, amount: 0n })) }, economyStats: { create: {} },
    ...(options.possession ? { characters: { create: { characterId, constellation: options.constellation, copies: options.constellation + 1, firstObtainedAt: now } } } : {}),
    c6Progress: { create: { characterId, strength: 1, intelligence: 1, beauty: 1, charisma: 1, popularity: 1, unlockedAt: now } },
  } });
  const current = new GetCurrentPlayer({ findByIdentity: async () => ({ id, displayName: `Contest Eligibility ${name}`, elementKey: 'hydro', status: 'ACTIVE' as const }), provision: async () => { throw new Error('not used'); } });
  return { id, character, service: new ContestService(current, database, clock, random) };
}

async function cleanup() {
  const dates = fixtureDates.map((date) => new Date(`${date}T00:00:00.000Z`));
  const contests = await database.contest.findMany({ where: { businessDate: { in: dates } }, select: { id: true } });
  const contestIds = contests.map(({ id }) => id);
  if (contestIds.length) {
    await database.contestReward.deleteMany({ where: { contestId: { in: contestIds } } });
    await database.contestDailyParticipation.deleteMany({ where: { contestId: { in: contestIds } } });
    await database.contest.deleteMany({ where: { id: { in: contestIds } } });
  }
  const ids = [...playerIds];
  if (ids.length) {
    await database.resourceMovement.deleteMany({ where: { playerId: { in: ids } } });
    await database.businessOperation.deleteMany({ where: { playerId: { in: ids } } });
    await database.player.deleteMany({ where: { id: { in: ids } } });
  }
  const dedicatedCharacters = [...characterIds];
  if (dedicatedCharacters.length) await database.character.deleteMany({ where: { id: { in: dedicatedCharacters } } });
  await database.contestDailyTheme.deleteMany({ where: { businessDate: { in: dates } } });
  playerIds.clear(); characterIds.clear(); rolls = [];
}

describe('Contest persistence', () => {
  it('protects every new table from browser roles and tracks migration 017', async () => {
    const tables = ['contest_daily_themes', 'contests', 'contest_participants', 'contest_spectators', 'contest_daily_participations', 'contest_lobby_removals', 'contest_events', 'contest_rewards'];
    const rls = await database.$queryRawUnsafe<{ relname: string; relrowsecurity: boolean }[]>(`SELECT relname, relrowsecurity FROM pg_class WHERE relname = ANY($1::text[]) ORDER BY relname`, tables);
    expect(rls).toHaveLength(tables.length); expect(rls.every(({ relrowsecurity }) => relrowsecurity)).toBe(true);
    const grants = await database.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM information_schema.role_table_grants WHERE table_name = ANY($1::text[]) AND grantee IN ('anon','authenticated')`, tables);
    expect(grants[0]?.count).toBe(0n);
    expect(await database.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM _prisma_migrations WHERE migration_name = '20260913170000_017_add_contests' AND finished_at IS NOT NULL`)).toEqual([{ count: 1n }]);
  });

  it('opens one global lobby, keeps the daily unused, resets readiness and blocks a fourth rejoin after three removals', async () => {
    now = new Date('2098-09-01T10:00:00Z'); const organizer = await fixture('Organizer'); const guest = await fixture('Guest'); const key = randomUUID();
    const opened = await organizer.service.createLobby(identity, organizer.character.id, key);
    expect(opened.active).toMatchObject({ status: 'LOBBY', organizerPlayerId: organizer.id, participants: [{ slot: 1, ready: false }] }); expect(opened.dailyUsed).toBe(false);
    expect((await organizer.service.createLobby(identity, organizer.character.id, key)).active?.id).toBe(opened.active?.id);
    await expect(organizer.service.createLobby(identity, organizer.character.id, randomUUID())).rejects.toMatchObject({ code: 'CONTEST_ALREADY_ACTIVE' });
    await organizer.service.setReady(identity, true, randomUUID());
    await guest.service.joinAsParticipant(identity, guest.character.id, randomUUID());
    expect((await organizer.service.getCurrent(identity)).active?.participants.every(({ ready }) => !ready)).toBe(true);
    for (let index = 0; index < 3; index += 1) {
      await organizer.service.removeFromLobby(identity, guest.id, randomUUID());
      if (index < 2) await guest.service.joinAsParticipant(identity, guest.character.id, randomUUID());
    }
    await expect(guest.service.joinAsParticipant(identity, guest.character.id, randomUUID())).rejects.toMatchObject({ code: 'CONTEST_ALREADY_JOINED' });
    expect(await database.contestDailyParticipation.count({ where: { playerId: { in: [organizer.id, guest.id] } } })).toBe(0);
  }, 30_000);

  it('accepts only an active owned five-star C6 Legend, never an orphan C6 row', async () => {
    now = new Date('2098-09-06T10:00:00Z');
    const invalid = await Promise.all([
      eligibilityFixture('FourStar', { rarity: 4, constellation: 6, isActive: true, possession: true }),
      eligibilityFixture('C5', { rarity: 5, constellation: 5, isActive: true, possession: true }),
      eligibilityFixture('Inactive', { rarity: 5, constellation: 6, isActive: false, possession: true }),
      eligibilityFixture('Orphan', { rarity: 5, constellation: 6, isActive: true, possession: false }),
    ]);
    for (const candidate of invalid) {
      await expect(candidate.service.createLobby(identity, candidate.character.id, randomUUID())).rejects.toMatchObject({ code: 'CONTEST_LEGEND_INELIGIBLE' });
    }
    const eligible = await eligibilityFixture('Eligible', { rarity: 5, constellation: 6, isActive: true, possession: true });
    await expect(eligible.service.createLobby(identity, eligible.character.id, randomUUID())).resolves.toMatchObject({ active: { organizerPlayerId: eligible.id } });
  }, 30_000);

  it('creates one deterministic theme per Paris business day under concurrency and permits consecutive repeats', async () => {
    now = new Date('2098-09-06T21:59:59Z'); rolls = [0, 0, 0, 0];
    const left = await fixture('ThemeLeft'); const right = await fixture('ThemeRight');
    const [first, same] = await Promise.all([left.service.getCurrent(identity), right.service.getCurrent(identity)]);
    expect(first.businessDate).toBe('2098-09-06'); expect(same.theme).toEqual(first.theme);
    expect(await database.contestDailyTheme.count({ where: { businessDate: new Date('2098-09-06T00:00:00Z') } })).toBe(1);
    now = new Date('2098-09-06T22:00:00Z');
    const next = await left.service.getCurrent(identity);
    expect(next.businessDate).toBe('2098-09-07'); expect(next.theme.key).toBe(first.theme.key);
    expect(await database.contestDailyTheme.count({ where: { businessDate: { in: [new Date('2098-09-06T00:00:00Z'), new Date('2098-09-07T00:00:00Z')] } } })).toBe(2);
  }, 30_000);

  it('snapshots a C6 Legend, fills bots, pays one idempotent ranking reward and advances title counters', async () => {
    now = new Date('2098-09-02T10:00:00Z'); const player = await fixture('Champion'); rolls = Array(40).fill(0);
    await player.service.createLobby(identity, player.character.id, randomUUID()); await player.service.setReady(identity, true, randomUUID());
    const started = await player.service.start(identity, randomUUID());
    expect(started.dailyUsed).toBe(true); expect(started.active?.participants).toHaveLength(4); expect(started.active?.participants.filter(({ kind }) => kind === 'BOT')).toHaveLength(3);
    const contestId = started.active!.id; const human = started.active!.participants.find(({ playerId }) => playerId === player.id)!;
    const persisted = await database.contestParticipant.findUniqueOrThrow({ where: { contestId_slot: { contestId, slot: human.slot } } });
    expect(persisted).toMatchObject({ themeStatSnapshot: 20, basePointsSnapshot: 5, titleRankSnapshot: 0 });
    await database.c6CompetitionProgress.update({ where: { playerId_characterId: { playerId: player.id, characterId: player.character.id } }, data: { strength: 1, totalContests: 2n, totalWins: 2n, strengthParticipations: 2n, strengthWins: 2n } });
    expect((await database.contestParticipant.findUniqueOrThrow({ where: { contestId_slot: { contestId, slot: human.slot } } })).themeStatSnapshot).toBe(20);
    await database.contestParticipant.update({ where: { contestId_slot: { contestId, slot: human.slot } }, data: { score: 49 } });
    const playKey = randomUUID(); const finished = await player.service.play(identity, 'BASIC', playKey); const replay = await player.service.play(identity, 'BASIC', playKey);
    expect(finished).toMatchObject({ active: null, lastResult: { winnerSlot: human.slot } }); expect(replay.lastResult?.id).toBe(contestId);
    await expect(player.service.play(identity, 'RISK', playKey)).rejects.toMatchObject({ code: 'CONTEST_IDEMPOTENCY_CONFLICT' });
    expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: 'primogems' } } })).amount).toBe(800n);
    expect(await database.resourceMovement.count({ where: { playerId: player.id, causeKey: 'contest.ranking' } })).toBe(1);
    expect(await database.contestReward.count({ where: { contestId } })).toBe(1);
    expect(await database.c6CompetitionProgress.findUniqueOrThrow({ where: { playerId_characterId: { playerId: player.id, characterId: player.character.id } } })).toMatchObject({ totalContests: 3n, totalWins: 3n, strengthParticipations: 3n, strengthWins: 3n, strengthTitleFloor: 2 });
    expect(await database.contestEvent.findFirst({ where: { contestId, type: 'TITLE_PROMOTED', targetPlayerId: player.id } })).toMatchObject({ payload: expect.objectContaining({ from: 0, to: 2, title: 'Titan Argent' }) });
  }, 30_000);

  it('fills exactly 2/2, 3/1 and 4/0 rosters while enforcing organizer, Ready and single-start rules', async () => {
    rolls = Array(300).fill(0);
    for (const humanCount of [2, 3, 4]) {
      now = new Date(`2098-09-${String(8 + humanCount).padStart(2, '0')}T10:00:00Z`);
      const players = await Promise.all(Array.from({ length: humanCount }, (_, index) => fixture(`Roster${humanCount}-${index + 1}`)));
      const organizer = players[0]!;
      await organizer.service.createLobby(identity, organizer.character.id, randomUUID());
      for (const player of players.slice(1)) await player.service.joinAsParticipant(identity, player.character.id, randomUUID());
      await expect(players[1]!.service.start(identity, randomUUID())).rejects.toMatchObject({ code: 'CONTEST_NOT_ORGANIZER' });
      await organizer.service.setReady(identity, true, randomUUID());
      await expect(organizer.service.start(identity, randomUUID())).rejects.toMatchObject({ code: 'CONTEST_NOT_READY' });
      for (const player of players.slice(1)) await player.service.setReady(identity, true, randomUUID());
      const startKey = randomUUID(); const started = await organizer.service.start(identity, startKey); const replay = await organizer.service.start(identity, startKey);
      expect(started.active?.participants.filter(({ kind }) => kind === 'HUMAN')).toHaveLength(humanCount);
      expect(started.active?.participants.filter(({ kind }) => kind === 'BOT')).toHaveLength(4 - humanCount);
      expect(replay.active?.id).toBe(started.active?.id);
      await expect(organizer.service.start(identity, randomUUID())).rejects.toMatchObject({ code: 'CONTEST_NOT_IN_LOBBY' });
      await organizer.service.cancel(identity, randomUUID());
    }
  }, 60_000);

  it('keeps bot ranks in place without redistributing their rewards', async () => {
    now = new Date('2098-09-13T10:00:00Z'); rolls = Array(120).fill(0);
    const alpha = await fixture('RankAlpha'); const bravo = await fixture('RankBravo');
    await alpha.service.createLobby(identity, alpha.character.id, randomUUID()); await bravo.service.joinAsParticipant(identity, bravo.character.id, randomUUID());
    await alpha.service.setReady(identity, true, randomUUID()); await bravo.service.setReady(identity, true, randomUUID());
    const started = await alpha.service.start(identity, randomUUID()); const contestId = started.active!.id;
    const humans = started.active!.participants.filter(({ kind }) => kind === 'HUMAN'); const bots = started.active!.participants.filter(({ kind }) => kind === 'BOT');
    await database.contestParticipant.updateMany({ where: { contestId }, data: { turnOrder: null } });
    await database.contestParticipant.update({ where: { contestId_slot: { contestId, slot: bots[0]!.slot } }, data: { score: 49, turnOrder: 1 } });
    await database.contestParticipant.update({ where: { contestId_slot: { contestId, slot: humans[0]!.slot } }, data: { score: 40, turnOrder: 2 } });
    await database.contestParticipant.update({ where: { contestId_slot: { contestId, slot: humans[1]!.slot } }, data: { score: 30, turnOrder: 3 } });
    await database.contestParticipant.update({ where: { contestId_slot: { contestId, slot: bots[1]!.slot } }, data: { score: 20, turnOrder: 4 } });
    await database.contest.update({ where: { id: contestId }, data: { currentTurnOrder: 1, turnDeadlineAt: new Date(now.getTime() + 60_000) } });
    await alpha.service.reconcile();
    const result = await database.contest.findUniqueOrThrow({ where: { id: contestId }, include: { participants: { orderBy: { finalRank: 'asc' } }, rewards: { orderBy: { rank: 'asc' } } } });
    expect(result).toMatchObject({ status: 'FINISHED', winnerSlot: bots[0]!.slot });
    expect(result.participants.map(({ kind, finalRank, rewardPrimogems }) => [kind, finalRank, rewardPrimogems])).toEqual([
      ['BOT', 1, 0n], ['HUMAN', 2, 400n], ['HUMAN', 3, 200n], ['BOT', 4, 0n],
    ]);
    expect(result.rewards.map(({ rank, primogems }) => [rank, primogems])).toEqual([[2, 400n], [3, 200n]]);
  }, 30_000);

  it('selects support independently, applies it once, and keeps exact spectator/participant exclusivity', async () => {
    now = new Date('2098-09-03T10:00:00Z'); const player = await fixture('Player'); const fan = await fixture('Fan'); rolls = Array(40).fill(0);
    await player.service.createLobby(identity, player.character.id, randomUUID()); await fan.service.joinAsSpectator(identity, randomUUID());
    await expect(fan.service.joinAsSpectator(identity, randomUUID())).resolves.toBeDefined();
    await player.service.setReady(identity, true, randomUUID()); const started = await player.service.start(identity, randomUUID()); const contestId = started.active!.id;
    await database.contest.update({ where: { id: contestId }, data: { phase: 'SUPPORT', currentTurnOrder: null, turnDeadlineAt: null, selectedSpectatorPlayerId: fan.id, supportDeadlineAt: new Date(now.getTime() + 30_000) } });
    const target = started.active!.participants[0]!; const before = (await database.contestParticipant.findUniqueOrThrow({ where: { contestId_slot: { contestId, slot: target.slot } } })).score;
    const key = randomUUID(); await fan.service.support(identity, target.slot, key); await fan.service.support(identity, target.slot, key);
    expect((await database.contestParticipant.findUniqueOrThrow({ where: { contestId_slot: { contestId, slot: target.slot } } })).score).toBe(before + 1);
    expect((await fan.service.getCurrent(identity)).active?.viewer.spectator).toBe(true);
    const bot = started.active!.participants.find(({ kind }) => kind === 'BOT')!;
    await database.contest.update({ where: { id: contestId }, data: { phase: 'SUPPORT', currentTurnOrder: null, turnDeadlineAt: null, selectedSpectatorPlayerId: fan.id, supportDeadlineAt: new Date(now.getTime() + 30_000) } });
    await fan.service.support(identity, bot.slot, randomUUID());
    expect((await database.contestParticipant.findUniqueOrThrow({ where: { contestId_slot: { contestId, slot: bot.slot } } })).score).toBe(bot.score + 1);
    await database.contest.update({ where: { id: contestId }, data: { phase: 'SUPPORT', currentTurnOrder: null, turnDeadlineAt: null, selectedSpectatorPlayerId: fan.id, supportDeadlineAt: new Date(now.getTime() - 1) } });
    await player.service.reconcile();
    expect(await database.contest.findUniqueOrThrow({ where: { id: contestId } })).toMatchObject({ phase: 'TURNS', currentRound: 4, currentTurnOrder: 4, selectedSpectatorPlayerId: null });
  }, 30_000);

  it('refunds only other humans on organizer cancellation and hides cancellation from history', async () => {
    now = new Date('2098-09-04T10:00:00Z'); const organizer = await fixture('Organizer'); const guest = await fixture('Guest'); rolls = Array(40).fill(0);
    await organizer.service.createLobby(identity, organizer.character.id, randomUUID()); await guest.service.joinAsParticipant(identity, guest.character.id, randomUUID());
    await organizer.service.setReady(identity, true, randomUUID()); await guest.service.setReady(identity, true, randomUUID()); await organizer.service.start(identity, randomUUID());
    await organizer.service.cancel(identity, randomUUID());
    const daily = await database.contestDailyParticipation.findMany({ where: { playerId: { in: [organizer.id, guest.id] } }, orderBy: { playerId: 'asc' } });
    expect(daily.find(({ playerId }) => playerId === organizer.id)?.refundedAt).toBeNull(); expect(daily.find(({ playerId }) => playerId === guest.id)?.refundedAt).not.toBeNull();
    expect((await organizer.service.getHistory(1)).contests).toHaveLength(0);
  }, 30_000);

  it('transfers the lobby organizer, replaces a running leaver without refund, and cancels at zero humans', async () => {
    now = new Date('2098-09-08T10:00:00Z'); const organizer = await fixture('LeavingOrganizer'); const guest = await fixture('RemainingGuest'); rolls = Array(80).fill(0);
    await organizer.service.createLobby(identity, organizer.character.id, randomUUID()); await guest.service.joinAsSpectator(identity, randomUUID());
    await guest.service.joinAsParticipant(identity, guest.character.id, randomUUID());
    expect((await guest.service.getCurrent(identity)).active?.viewer).toMatchObject({ participantSlot: 2, spectator: false });
    await organizer.service.leave(identity, randomUUID());
    expect((await guest.service.getCurrent(identity)).active).toMatchObject({ status: 'LOBBY', organizerPlayerId: guest.id });
    await guest.service.setReady(identity, true, randomUUID()); await guest.service.start(identity, randomUUID());
    const contestId = (await guest.service.getCurrent(identity)).active!.id;
    await guest.service.leave(identity, randomUUID());
    const persisted = await database.contest.findUniqueOrThrow({ where: { id: contestId }, include: { participants: true } });
    expect(persisted.status).toBe('CANCELLED');
    expect(persisted.participants.find(({ originalPlayerId }) => originalPlayerId === guest.id)).toMatchObject({ kind: 'BOT', replacementReason: 'LEFT', eligibleForResult: false });
    expect((await database.contestDailyParticipation.findUniqueOrThrow({ where: { playerId_businessDate: { playerId: guest.id, businessDate: new Date('2098-09-08T00:00:00Z') } } })).refundedAt).toBeNull();
  }, 30_000);

  it('paginates only finished snapshot history at ten entries', async () => {
    now = new Date('2098-09-09T10:00:00Z'); const viewer = await fixture('Historian');
    const businessDate = new Date('2098-09-09T00:00:00Z');
    await viewer.service.getCurrent(identity);
    for (let index = 0; index < 12; index += 1) {
      await database.contest.create({ data: { businessDate, theme: 'STRENGTH', status: 'FINISHED', phase: 'FINISHED', currentRound: index + 1, winnerSlot: 1, startedAt: new Date(now.getTime() - 60_000), finishedAt: new Date(now.getTime() + index) } });
    }
    await database.contest.create({ data: { businessDate, theme: 'STRENGTH', status: 'CANCELLED', phase: 'CANCELLED', currentRound: 1, cancelledAt: now, cancellationKind: 'TECHNICAL' } });
    const first = await viewer.service.getHistory(1); const second = await viewer.service.getHistory(2);
    expect(first).toMatchObject({ pageSize: 10, total: 12, pageCount: 2 }); expect(first.contests).toHaveLength(10); expect(second.contests).toHaveLength(2);
    expect([...first.contests, ...second.contests].every(({ status }) => status === 'FINISHED')).toBe(true);
  }, 30_000);

  it('serializes concurrent restart reconciliation, auto-plays timed-out humans and cancels after the third inactive replacement', async () => {
    now = new Date('2098-09-05T10:00:00Z'); const player = await fixture('Timeout'); rolls = Array(100).fill(0);
    await player.service.createLobby(identity, player.character.id, randomUUID()); await player.service.setReady(identity, true, randomUUID());
    const started = await player.service.start(identity, randomUUID()); const contestId = started.active!.id;
    const human = started.active!.participants.find(({ playerId }) => playerId === player.id)!;
    await database.contestParticipant.updateMany({ where: { contestId }, data: { turnOrder: null } });
    await database.contestParticipant.update({ where: { contestId_slot: { contestId, slot: human.slot } }, data: { turnOrder: 1 } });
    let nextOrder = 2;
    for (const participant of started.active!.participants.filter(({ slot }) => slot !== human.slot)) {
      await database.contestParticipant.update({ where: { contestId_slot: { contestId, slot: participant.slot } }, data: { turnOrder: nextOrder++ } });
    }
    await database.contest.update({ where: { id: contestId }, data: { currentTurnOrder: 1, turnDeadlineAt: new Date(now.getTime() + 60_000) } });
    for (let timeout = 1; timeout <= 3; timeout += 1) {
      now = new Date(now.getTime() + 61_000);
      const restarted = new ContestService(new GetCurrentPlayer({ findByIdentity: async () => ({ id: player.id, displayName: 'Restarted', elementKey: 'hydro', status: 'ACTIVE' as const }), provision: async () => { throw new Error('not used'); } }), database, clock, random);
      await Promise.all([player.service.reconcile(), restarted.reconcile()]);
      const participant = await database.contestParticipant.findUniqueOrThrow({ where: { contestId_slot: { contestId, slot: human.slot } } });
      expect(await database.contestEvent.count({ where: { contestId, type: 'TURN_AUTO_BASIC' } })).toBe(timeout);
      if (timeout < 3) expect(participant).toMatchObject({ kind: 'HUMAN', inactivityCount: timeout });
      else expect(participant).toMatchObject({ kind: 'BOT', inactivityCount: 3, replacementReason: 'INACTIVE', eligibleForResult: false });
    }
    expect((await database.contest.findUniqueOrThrow({ where: { id: contestId } })).status).toBe('CANCELLED');
    expect((await database.contestDailyParticipation.findUniqueOrThrow({ where: { playerId_businessDate: { playerId: player.id, businessDate: new Date('2098-09-05T00:00:00Z') } } })).refundedAt).toBeNull();
    expect(await database.contestReward.count({ where: { contestId } })).toBe(0);
  }, 30_000);
});
