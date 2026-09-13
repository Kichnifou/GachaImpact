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

async function addLegend(playerId: string, name: string) {
  const characterId = randomUUID(); characterIds.add(characterId);
  const character = await database.character.create({ data: { id: characterId, externalKey: `contest-fixture-${characterId}`, name: `Legend ${name}`, rarity: 5, elementKey: 'anemo', isActive: true } });
  await database.playerCharacter.create({ data: { playerId, characterId, constellation: 6, copies: 7, firstObtainedAt: now } });
  await database.c6CompetitionProgress.create({ data: { playerId, characterId, strength: 18, intelligence: 17, beauty: 16, charisma: 15, popularity: 14, unlockedAt: now } });
  return character;
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

  it('treats the lobby timeout as ten minutes of participant inactivity without GET, spectator or replay keep-alive', async () => {
    now = new Date('2098-09-01T10:00:00Z'); const organizer = await fixture('Organizer'); const guest = await fixture('Guest'); const key = randomUUID();
    const opened = await organizer.service.createLobby(identity, organizer.character.id, key);
    expect(opened.active).toMatchObject({ status: 'LOBBY', organizerPlayerId: organizer.id, lobbyDeadlineAt: '2098-09-01T10:10:00.000Z' }); expect(opened.dailyUsed).toBe(false);
    expect((await organizer.service.createLobby(identity, organizer.character.id, key)).active?.id).toBe(opened.active?.id);
    await expect(organizer.service.createLobby(identity, organizer.character.id, randomUUID())).rejects.toMatchObject({ code: 'CONTEST_ALREADY_ACTIVE' });
    now = new Date('2098-09-01T10:05:00Z'); const readyKey = randomUUID();
    expect((await organizer.service.setReady(identity, true, readyKey)).active?.lobbyDeadlineAt).toBe('2098-09-01T10:15:00.000Z');
    now = new Date('2098-09-01T10:06:00Z');
    expect((await organizer.service.setReady(identity, true, readyKey)).active?.lobbyDeadlineAt).toBe('2098-09-01T10:15:00.000Z');
    expect((await organizer.service.getCurrent(identity)).active?.lobbyDeadlineAt).toBe('2098-09-01T10:15:00.000Z');
    now = new Date('2098-09-01T10:07:00Z');
    expect((await guest.service.joinAsSpectator(identity, randomUUID())).active?.lobbyDeadlineAt).toBe('2098-09-01T10:15:00.000Z');
    now = new Date('2098-09-01T10:10:00Z');
    expect((await organizer.service.getCurrent(identity)).active?.status).toBe('LOBBY');
    now = new Date('2098-09-01T10:15:00Z');
    expect((await organizer.service.getCurrent(identity)).active).toBeNull();
    expect(await database.contest.findUniqueOrThrow({ where: { id: opened.active!.id } })).toMatchObject({ status: 'CANCELLED', cancellationKind: 'LOBBY_TIMEOUT' });
    expect(await database.contestDailyParticipation.count({ where: { playerId: { in: [organizer.id, guest.id] } } })).toBe(0);
  }, 30_000);

  it('scopes Ready to each human across join, Legend change and removal while preserving rejoin limits', async () => {
    now = new Date('2098-09-07T10:00:00Z'); const organizer = await fixture('ReadyOrganizer'); const guest = await fixture('ReadyGuest'); const secondLegend = await addLegend(organizer.id, 'Second');
    await organizer.service.createLobby(identity, organizer.character.id, randomUUID());
    await organizer.service.setReady(identity, true, randomUUID());
    await guest.service.joinAsParticipant(identity, guest.character.id, randomUUID());
    let participants = (await organizer.service.getCurrent(identity)).active!.participants;
    expect(participants.find(({ playerId }) => playerId === organizer.id)?.ready).toBe(true);
    expect(participants.find(({ playerId }) => playerId === guest.id)?.ready).toBe(false);
    await guest.service.setReady(identity, true, randomUUID());
    await organizer.service.selectLegend(identity, secondLegend.id, randomUUID());
    participants = (await organizer.service.getCurrent(identity)).active!.participants;
    expect(participants.find(({ playerId }) => playerId === organizer.id)?.ready).toBe(false);
    expect(participants.find(({ playerId }) => playerId === guest.id)?.ready).toBe(true);
    await organizer.service.setReady(identity, true, randomUUID());
    await organizer.service.removeFromLobby(identity, guest.id, randomUUID());
    expect((await organizer.service.getCurrent(identity)).active?.participants.find(({ playerId }) => playerId === organizer.id)?.ready).toBe(true);
    for (let index = 0; index < 3; index += 1) {
      if (index > 0) await organizer.service.removeFromLobby(identity, guest.id, randomUUID());
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

  it('persists and projects every title threshold without promoting bots or non-winning slots', async () => {
    const player = await fixture('TitleThresholds');
    const transitions = [
      { day: 10, wins: 0n, floor: 0, title: 'Titan Bronze', toRank: 1 },
      { day: 11, wins: 2n, floor: 1, title: 'Titan Argent', toRank: 2 },
      { day: 12, wins: 6n, floor: 2, title: 'Titan Or', toRank: 3 },
      { day: 13, wins: 14n, floor: 3, title: 'Titan Platine', toRank: 4 },
    ];
    for (const transition of transitions) {
      now = new Date(`2098-09-${transition.day}T10:00:00Z`); rolls = Array(80).fill(0);
      await database.c6CompetitionProgress.update({ where: { playerId_characterId: { playerId: player.id, characterId: player.character.id } }, data: { totalContests: transition.wins, totalWins: transition.wins, strengthParticipations: transition.wins, strengthWins: transition.wins, strengthTitleFloor: transition.floor } });
      await player.service.createLobby(identity, player.character.id, randomUUID()); await player.service.setReady(identity, true, randomUUID());
      const started = await player.service.start(identity, randomUUID()); const contestId = started.active!.id;
      const human = started.active!.participants.find(({ playerId }) => playerId === player.id)!;
      await database.contestParticipant.updateMany({ where: { contestId }, data: { turnOrder: null } });
      await database.contestParticipant.update({ where: { contestId_slot: { contestId, slot: human.slot } }, data: { score: 49, turnOrder: 1 } });
      await database.contest.update({ where: { id: contestId }, data: { currentTurnOrder: 1, turnDeadlineAt: new Date(now.getTime() + 60_000) } });
      const finished = await player.service.play(identity, 'BASIC', randomUUID());
      expect(finished.lastResult?.promotions).toEqual([{ playerId: player.id, slot: human.slot, characterName: player.character.name, fromRank: transition.floor, toRank: transition.toRank, title: transition.title }]);
      expect(finished.lastResult?.historyEvents).toContainEqual(expect.objectContaining({ kind: 'TITLE_PROMOTED', toRank: transition.toRank, title: transition.title }));
      expect(await database.contestEvent.count({ where: { contestId, type: 'TITLE_PROMOTED' } })).toBe(1);
      expect((await player.service.getHistoryDetail(contestId)).promotions).toEqual(finished.lastResult?.promotions);
    }
  }, 60_000);

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
    await guest.service.setReady(identity, true, randomUUID());
    await organizer.service.leave(identity, randomUUID());
    expect((await guest.service.getCurrent(identity)).active).toMatchObject({ status: 'LOBBY', organizerPlayerId: guest.id, participants: [expect.objectContaining({ playerId: guest.id, ready: true })] });
    await guest.service.start(identity, randomUUID());
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
    expect([...first.contests, ...second.contests].every(({ finishedAt }) => finishedAt !== null)).toBe(true);
  }, 30_000);

  it('projects a compact history list and an interpreted four-slot finished detail', async () => {
    now = new Date('2098-09-09T10:00:00Z');
    const alpha = await fixture('DetailAlpha'); const replaced = await fixture('DetailReplaced'); const fan = await fixture('DetailFan');
    const businessDate = new Date('2098-09-09T00:00:00Z');
    await alpha.service.getCurrent(identity);
    const contest = await database.contest.create({ data: {
      businessDate, theme: 'STRENGTH', status: 'FINISHED', phase: 'FINISHED', currentRound: 5, winnerSlot: 1,
      startedAt: new Date('2098-09-09T10:00:00Z'), finishedAt: new Date('2098-09-09T10:07:30Z'),
      participants: { create: [
        { slot: 1, kind: 'HUMAN', playerId: alpha.id, originalPlayerId: alpha.id, characterId: alpha.character.id, playerNameSnapshot: 'Alpha', characterNameSnapshot: alpha.character.name, themeStatSnapshot: 20, basePointsSnapshot: 5, turnOrder: 2, ready: true, score: 52, finalRank: 1, rewardPrimogems: 800n },
        { slot: 2, kind: 'BOT', originalPlayerId: replaced.id, playerNameSnapshot: 'Astra · Bot', characterNameSnapshot: 'Légende relayée', themeStatSnapshot: 12, basePointsSnapshot: 3, turnOrder: 1, ready: true, score: 41, finalRank: 2, rewardPrimogems: 0n, eligibleForResult: false, replacedAt: new Date('2098-09-09T10:04:00Z'), leftAt: new Date('2098-09-09T10:04:00Z'), replacementReason: 'LEFT' },
        { slot: 3, kind: 'BOT', playerNameSnapshot: 'Braise · Bot', characterNameSnapshot: 'Légende invitée', themeStatSnapshot: 10, basePointsSnapshot: 3, turnOrder: 4, ready: true, score: 35, finalRank: 3, rewardPrimogems: 0n },
        { slot: 4, kind: 'BOT', playerNameSnapshot: 'Céleste · Bot', characterNameSnapshot: 'Légende invitée', themeStatSnapshot: 9, basePointsSnapshot: 2, turnOrder: 3, ready: true, score: 29, finalRank: 4, rewardPrimogems: 0n },
      ] },
      spectators: { create: [{ playerId: fan.id }] },
      events: { create: [
        { type: 'MEMBER_LEFT', actorPlayerId: replaced.id, payload: { slot: 2 }, createdAt: new Date('2098-09-09T10:04:00Z') },
        { type: 'PARTICIPANT_REPLACED', targetPlayerId: replaced.id, targetSlot: 2, payload: { slot: 2, reason: 'LEFT', inheritedScore: 24 }, createdAt: new Date('2098-09-09T10:04:00Z') },
        { type: 'SUPPORT_SELECTED', actorPlayerId: fan.id, payload: { round: 4 }, createdAt: new Date('2098-09-09T10:05:00Z') },
        { type: 'SUPPORT_PLAYED', actorPlayerId: fan.id, targetPlayerId: alpha.id, targetSlot: 1, payload: { targetSlot: 1, points: 3 }, createdAt: new Date('2098-09-09T10:05:10Z') },
        { type: 'TITLE_PROMOTED', actorPlayerId: alpha.id, targetPlayerId: alpha.id, targetSlot: 1, payload: { slot: 1, from: 2, to: 3, title: 'Titan Or' }, createdAt: new Date('2098-09-09T10:07:30Z') },
      ] },
    } });
    await database.contest.create({ data: { businessDate, theme: 'STRENGTH', status: 'CANCELLED', phase: 'CANCELLED', cancelledAt: now, cancellationKind: 'TECHNICAL' } });
    const list = await alpha.service.getHistory(1);
    expect(list).toMatchObject({ total: 1, contests: [{ id: contest.id, currentRound: 5, winner: { slot: 1, displayName: 'Alpha', kind: 'HUMAN' } }] });
    expect(list.contests[0]).not.toHaveProperty('participants');
    const detail = await alpha.service.getHistoryDetail(contest.id);
    expect(detail.participants).toHaveLength(4);
    expect(detail.participants.find(({ slot }) => slot === 2)).toMatchObject({ kind: 'BOT', replaced: true, replacementReason: 'LEFT', finalRank: 2 });
    expect(detail.promotions).toEqual([{ playerId: alpha.id, slot: 1, characterName: alpha.character.name, fromRank: 2, toRank: 3, title: 'Titan Or' }]);
    expect(detail.historyEvents.map(({ kind }) => kind)).toEqual(['PARTICIPANT_LEFT', 'PARTICIPANT_REPLACED', 'SUPPORT_SELECTED', 'SUPPORT_PLAYED', 'TITLE_PROMOTED']);
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
