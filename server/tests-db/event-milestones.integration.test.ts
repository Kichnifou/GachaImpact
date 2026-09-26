import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { EventService } from '../src/application/event/event-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { loadConfig } from '../src/config/environment.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Event milestone DB tests.');
const isolated = isolatedBatchDatabase();
const database = isolated.database;
beforeAll(() => isolated.setup({ seedPublicCatalog: true }), 60_000);
afterAll(() => isolated.cleanup(), 60_000);
const store = new PrismaCurrentPlayerStore(database);
const provision = new GetOrProvisionCurrentPlayer(store);
const getPlayer = new GetCurrentPlayer(store);
const playerIds: string[] = [];
const editionIds: string[] = [];
let year = 2250;
let now = new Date(`${year}-09-15T12:00:00.000Z`);
let particleIndex = 0;
let gameBIndex = 0;
const service = new EventService(getPlayer, database, { now: () => now }, { nextInt: (max) => max === 32 ? gameBIndex : particleIndex });

async function fixture() {
  const identity = { subject: `codex-event-milestone-${randomUUID()}` };
  const created = await provision.execute(identity, `Milestone ${randomUUID().slice(0, 8)}`);
  playerIds.push(created.player.id);
  return { identity, playerId: created.player.id };
}
async function view(player: Awaited<ReturnType<typeof fixture>>) {
  const snapshot = await service.getCurrent(player.identity);
  if (!editionIds.includes(snapshot.edition.id)) editionIds.push(snapshot.edition.id);
  return snapshot;
}
async function join(player: Awaited<ReturnType<typeof fixture>>) { await view(player); return service.join(player.identity, randomUUID()); }
async function setPoints(playerId: string, editionId: string, points: number) {
  await database.eventParticipant.update({ where: { eventEditionId_playerId: { eventEditionId: editionId, playerId } }, data: { points } });
}
async function balance(playerId: string, resourceKey: string) {
  return (await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey } } })).amount;
}

afterEach(async () => {
  const editions = editionIds.splice(0);
  const players = playerIds.splice(0);
  if (editions.length) {
    await database.eventMilestoneClaim.deleteMany({ where: { eventEditionId: { in: editions }, playerId: { in: players } } });
    await database.eventSocialMessage.deleteMany({ where: { eventEditionId: { in: editions } } });
    await database.eventGameBDailyState.deleteMany({ where: { eventEditionId: { in: editions } } });
    await database.eventDailyPlayerState.deleteMany({ where: { eventEditionId: { in: editions }, playerId: { in: players } } });
    await database.eventParticipant.deleteMany({ where: { eventEditionId: { in: editions }, playerId: { in: players } } });
    await database.eventEdition.deleteMany({ where: { id: { in: editions }, participants: { none: {} } } });
  }
  if (players.length) {
    await database.notification.deleteMany({ where: { playerId: { in: players } } });
    await database.playerEventCurrencyBalance.deleteMany({ where: { playerId: { in: players } } });
    await database.resourceMovement.deleteMany({ where: { playerId: { in: players } } });
    await database.playerPermanentMissionProgress.deleteMany({ where: { playerId: { in: players } } });
    await database.businessOperation.deleteMany({ where: { playerId: { in: players } } });
    await database.webIdentity.deleteMany({ where: { playerId: { in: players } } });
    await database.player.deleteMany({ where: { id: { in: players } } });
  }
  year += 1;
  now = new Date(`${year}-09-15T12:00:00.000Z`);
  particleIndex = 0;
  gameBIndex = 0;
});
afterAll(async () => database.$disconnect());

describe('Event daily bonus and milestone persistence', () => {
  it('keeps milestone claims private with the edition/player/threshold PK and unique operation', async () => {
    const [security] = await database.$queryRaw<Array<{ rls: boolean; anonSelect: boolean; authenticatedSelect: boolean }>>`
      SELECT c.relrowsecurity AS rls,
        has_table_privilege('anon', c.oid, 'SELECT') AS "anonSelect",
        has_table_privilege('authenticated', c.oid, 'SELECT') AS "authenticatedSelect"
      FROM pg_class c WHERE c.oid = 'event_milestone_claims'::regclass`;
    expect(security).toEqual({ rls: true, anonSelect: false, authenticatedSelect: false });
    const constraints = await database.$queryRaw<Array<{ name: string; definition: string }>>`
      SELECT conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'event_milestone_claims'::regclass`;
    expect(constraints.find(({ name }) => name === 'event_milestone_claims_pkey')?.definition).toContain('event_edition_id, player_id, milestone');
    expect(constraints.find(({ name }) => name === 'event_milestone_claims_milestone_check')?.definition).toContain('10');
    const indexes = await database.$queryRaw<Array<{ name: string; unique: boolean }>>`
      SELECT c.relname AS name, i.indisunique AS "unique" FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE i.indrelid = 'event_milestone_claims'::regclass`;
    expect(indexes).toContainEqual({ name: 'event_milestone_claims_operation_id_key', unique: true });
  }, 60_000);
  it('rejects a nonparticipant, grants one daily currency, replays the same key, and resets next Paris day', async () => {
    const player = await fixture();
    await view(player);
    await expect(service.claimDailyBonus(player.identity, randomUUID())).rejects.toMatchObject({ code: 'EVENT_NOT_JOINED' });
    const joined = await join(player);
    expect(joined.dailyBonus).toEqual({ claimedToday: false, canClaim: true });
    const key = randomUUID();
    const claimed = await service.claimDailyBonus(player.identity, key);
    expect(claimed).toMatchObject({ dailyBonus: { claimedToday: true, canClaim: false }, currency: { amount: '2' }, operation: { alreadyProcessed: false } });
    expect((await service.claimDailyBonus(player.identity, key)).operation).toEqual({ id: claimed.operation.id, alreadyProcessed: true });
    await expect(service.claimDailyBonus(player.identity, randomUUID())).rejects.toMatchObject({ code: 'EVENT_DAILY_BONUS_ALREADY_CLAIMED' });
    now = new Date(`${year}-09-16T12:00:00.000Z`);
    expect((await view(player)).dailyBonus.canClaim).toBe(true);
    expect((await service.claimDailyBonus(player.identity, randomUUID())).currency.amount).toBe('3');
  }, 60_000);

  it('serializes two concurrent daily bonus keys into one credit', async () => {
    const player = await fixture(); await join(player);
    const outcomes = await Promise.allSettled([service.claimDailyBonus(player.identity, randomUUID()), service.claimDailyBonus(player.identity, randomUUID())]);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect((await view(player)).currency.amount).toBe('2');
    expect(await database.businessOperation.count({ where: { playerId: player.playerId, operationType: 'event.daily-bonus.claim' } })).toBe(1);
  }, 60_000);

  it('routes a Game A success through the same atomic milestone reward', async () => {
    now = new Date(`${year}-09-15T05:00:00.000Z`);
    const player = await fixture(); const joined = await join(player);
    await setPoints(player.playerId, joined.edition.id, 9);
    const result = await service.attemptGameA(player.identity, randomUUID());
    expect(result.attempt.succeeded).toBe(true);
    expect(result.participation.points).toBe(10);
    expect(result.milestones.thresholds[0]).toMatchObject({ reached: true, rewarded: true });
    expect(await balance(player.playerId, 'particles_pyro')).toBe(500n);
  }, 60_000);

  it.each([
    [10, 'particles_pyro', 500n, 0n], [20, null, 0n, 1n], [30, 'particles_geo', 500n, 1n], [40, null, 0n, 3n],
    [50, 'moras', 50_000n, 3n], [60, null, 0n, 8n], [70, 'primogems', 1_600n, 8n], [80, null, 0n, 18n],
  ])('grants exactly the %i-point reward once, with an audited operation', async (milestone, resourceKey, amount, currencyBonus) => {
    const sender = await fixture(); const recipient = await fixture();
    const joined = await join(sender);
    if (milestone === 30) await database.player.update({ where: { id: sender.playerId }, data: { elementKey: 'geo' } });
    await setPoints(sender.playerId, joined.edition.id, milestone - 1);
    const before = resourceKey ? await balance(sender.playerId, resourceKey) : 0n;
    const movementBefore = resourceKey ? await database.resourceMovement.aggregate({ where: { playerId: sender.playerId, resourceKey }, _sum: { delta: true } }) : null;
    const key = randomUUID();
    const sent = await service.sendGameC(sender.identity, recipient.playerId, 'Bonjour !', key);
    expect(sent.participation.points).toBe(milestone);
    expect(sent.milestones.thresholds.find((item) => item.points === milestone)).toMatchObject({ reached: true, rewarded: true });
    expect(BigInt(sent.currency.amount)).toBe(2n + currencyBonus);
    if (resourceKey) {
      const movementAfter = await database.resourceMovement.aggregate({ where: { playerId: sender.playerId, resourceKey }, _sum: { delta: true } });
      expect(await balance(sender.playerId, resourceKey)).toBe(before + (movementAfter._sum.delta ?? 0n) - (movementBefore?._sum.delta ?? 0n));
      expect((await database.resourceMovement.findMany({ where: { playerId: sender.playerId, resourceKey, causeKey: `event.milestone.${milestone}` }, select: { delta: true } })).map(({ delta }) => delta)).toEqual([amount]);
    }
    const claim = await database.eventMilestoneClaim.findUniqueOrThrow({ where: { eventEditionId_playerId_milestone: { eventEditionId: joined.edition.id, playerId: sender.playerId, milestone } }, include: { operation: true } });
    expect(claim.operation).toMatchObject({ operationType: 'event.milestone.reward', sourceChannel: 'SYSTEM', status: 'COMPLETED' });
    expect((await service.sendGameC(sender.identity, recipient.playerId, 'Bonjour !', key)).operation.alreadyProcessed).toBe(true);
    expect(await database.eventMilestoneClaim.count({ where: { eventEditionId: joined.edition.id, playerId: sender.playerId } })).toBe(milestone / 10);
  }, 60_000);

  it('awards all skipped thresholds and lets the score continue above 80', async () => {
    const sender = await fixture(); const recipient = await fixture();
    const joined = await join(sender);
    await setPoints(sender.playerId, joined.edition.id, 80);
    const result = await service.sendGameC(sender.identity, recipient.playerId, 'Bonjour !', randomUUID());
    expect(result.participation.points).toBe(81);
    expect(result.milestones.thresholds).toHaveLength(8);
    expect(result.milestones.thresholds.every((entry) => entry.rewarded)).toBe(true);
    expect(await database.eventMilestoneClaim.count({ where: { eventEditionId: joined.edition.id, playerId: sender.playerId } })).toBe(8);
    expect(result.currency.amount).toBe('20');
  }, 60_000);

  it('rewards each participant crossing ten points in a single Game B resolution', async () => {
    const first = await fixture(); const second = await fixture();
    gameBIndex = 31;
    const firstJoin = await join(first); await join(second);
    await setPoints(first.playerId, firstJoin.edition.id, 9);
    await setPoints(second.playerId, firstJoin.edition.id, 9);
    particleIndex = 6;
    const result = await service.attemptGameB(first.identity, '11111', randomUUID());
    expect(result.attempt.kind).toBe('CORRECT');
    for (const player of [first, second]) {
      expect((await view(player)).participation.points).toBe(10);
      expect(await balance(player.playerId, 'particles_dendro')).toBe(500n);
      expect(await database.eventMilestoneClaim.count({ where: { eventEditionId: firstJoin.edition.id, playerId: player.playerId } })).toBe(1);
    }
  }, 60_000);

  it('rolls back the point and claim if the standard economic credit cannot complete', async () => {
    const sender = await fixture(); const recipient = await fixture();
    const joined = await join(sender);
    await setPoints(sender.playerId, joined.edition.id, 9);
    await database.playerResourceBalance.delete({ where: { playerId_resourceKey: { playerId: sender.playerId, resourceKey: 'particles_pyro' } } });
    await expect(service.sendGameC(sender.identity, recipient.playerId, 'Bonjour !', randomUUID())).rejects.toThrow();
    expect((await view(sender)).participation.points).toBe(9);
    expect(await database.eventMilestoneClaim.count({ where: { eventEditionId: joined.edition.id, playerId: sender.playerId } })).toBe(0);
    expect(await database.eventSocialMessage.count({ where: { eventEditionId: joined.edition.id, senderPlayerId: sender.playerId } })).toBe(0);
  }, 60_000);
});
