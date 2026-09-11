import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { Prisma, SourceChannel } from '../generated/prisma/client.js';
import { loadConfig } from '../src/config/environment.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { PrismaDailyChallengeStore } from '../src/infrastructure/database/prisma-daily-challenge-store.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Daily Challenge database tests.');
const database = createDatabase(config.databaseUrl);
const players = new Set<string>();
const businessDate = '2026-09-11';
const now = new Date('2026-09-11T12:00:00.000Z');

afterEach(cleanup);
afterAll(async () => { try { await cleanup(); } finally { await database.$disconnect(); } });

async function createPlayer(input: { moras: bigint; particles?: bigint }) {
  const id = randomUUID(); players.add(id);
  await database.player.create({ data: {
    id, displayName: `Daily Fixture ${id.slice(0, 8)}`, elementKey: 'hydro',
    resourceBalances: { create: resourceKeys.map((resourceKey) => ({ resourceKey, amount: resourceKey === 'moras' ? input.moras : resourceKey === 'particles_hydro' ? input.particles ?? 0n : 0n })) },
    economyStats: { create: {} },
  } });
  return id;
}

async function cleanup() {
  const ids = [...players];
  if (!ids.length) return;
  await database.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM players WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`);
    await tx.playerDailyChallenge.deleteMany({ where: { playerId: { in: ids } } });
    await tx.resourceMovement.deleteMany({ where: { playerId: { in: ids } } });
    await tx.businessOperation.deleteMany({ where: { playerId: { in: ids } } });
    await tx.playerResourceBalance.deleteMany({ where: { playerId: { in: ids } } });
    await tx.playerEconomyStats.deleteMany({ where: { playerId: { in: ids } } });
    await tx.player.deleteMany({ where: { id: { in: ids } } });
  });
  players.clear();
}

const purchaseInput = (playerId: string, roll: number, idempotencyKey = randomUUID()) => ({
  playerId, playerElementKey: 'hydro' as const, businessDate, now, idempotencyKey, random: { nextInt: () => roll },
});

describe('Daily Challenge persistence', () => {
  it('keeps the three-definition catalog while only real producers are eligible', async () => {
    const definitions = await database.dailyChallengeDefinition.findMany({ orderBy: { displayOrder: 'asc' } });
    expect(definitions.map(({ externalKey, weight, isEligible }) => ({ externalKey, weight, isEligible }))).toEqual([
      { externalKey: 'daily_messages_10', weight: 1, isEligible: false },
      { externalKey: 'daily_pulls_5', weight: 1, isEligible: true },
      { externalKey: 'daily_convert_particles_320', weight: 1, isEligible: true },
    ]);
  });

  it('purchases once, switches once for 20,000 Moras, preserves idempotency and resets progress', async () => {
    const playerId = await createPlayer({ moras: 100_000n });
    const firstRandom = { calls: 0, nextInt() { this.calls += 1; return 0; } };
    const store = new PrismaDailyChallengeStore(database);
    const key = randomUUID();
    const first = await store.purchase({ ...purchaseInput(playerId, 0, key), random: firstRandom });
    const retry = await store.purchase({ ...purchaseInput(playerId, 1, key), random: { nextInt: () => { throw new Error('must not reroll'); } } });
    expect(first.view.challenge?.externalKey).toBe('daily_pulls_5');
    expect(first.resources.moras).toBe(90_000n);
    expect(retry.operation).toEqual({ id: first.operation.id, alreadyProcessed: true });
    expect(firstRandom.calls).toBe(1);
    const switched = await store.switchChallenge({ ...purchaseInput(playerId, 0), random: { nextInt: () => 0 } });
    expect(switched.view).toMatchObject({ status: 'ACTIVE', switchCount: 1, nextSwitchCost: 40_000n });
    expect(switched.view.challenge).toMatchObject({ externalKey: 'daily_convert_particles_320', progress: 0n });
    expect(switched.resources.moras).toBe(70_000n);
    expect(await database.businessOperation.count({ where: { playerId } })).toBe(2);
  });

  it('hides the objective, validates before RNG, prevents a second same-day purchase and expires an unfinished prior day', async () => {
    const poorPlayerId = await createPlayer({ moras: 9_999n });
    const random = { calls: 0, nextInt() { this.calls += 1; return 0; } };
    const store = new PrismaDailyChallengeStore(database);
    expect(await store.getView(poorPlayerId, businessDate)).toMatchObject({ assigned: false, challenge: null, purchaseCost: 10_000n });
    await expect(store.purchase({ ...purchaseInput(poorPlayerId, 0), random })).rejects.toMatchObject({ code: 'DAILY_CHALLENGE_WALLET_INSUFFICIENT' });
    expect(random.calls).toBe(0);

    const playerId = await createPlayer({ moras: 20_000n });
    const first = await store.purchase(purchaseInput(playerId, 0));
    expect(first.view.challenge).toMatchObject({ progress: 0n });
    await expect(store.purchase(purchaseInput(playerId, 1))).rejects.toMatchObject({ code: 'DAILY_CHALLENGE_ALREADY_ASSIGNED' });
    const nextDate = '2026-09-12';
    const nextNow = new Date('2026-09-12T12:00:00.000Z');
    const next = await store.purchase({ ...purchaseInput(playerId, 1), businessDate: nextDate, now: nextNow });
    expect(next.view).toMatchObject({ businessDate: nextDate, assigned: true, status: 'ACTIVE' });
    expect((await database.playerDailyChallenge.findUniqueOrThrow({ where: { playerId_businessDate: { playerId, businessDate: new Date(`${businessDate}T00:00:00.000Z`) } } })).status).toBe('EXPIRED');
  });

  it('doubles switch prices, always changes definition, resets progress and rejects invalid switch states', async () => {
    const playerId = await createPlayer({ moras: 150_000n });
    const store = new PrismaDailyChallengeStore(database);
    await store.purchase(purchaseInput(playerId, 0));
    const progressOperation = await database.businessOperation.create({ data: { playerId, operationType: 'fixture.progress', sourceChannel: SourceChannel.UI } });
    await database.$transaction((tx) => store.progress(tx, { playerId, playerElementKey: 'hydro', businessDate, type: 'pulls', amount: 2n, now, operationId: progressOperation.id, sourceChannel: SourceChannel.UI }));
    const firstKey = randomUUID();
    const first = await store.switchChallenge({ ...purchaseInput(playerId, 0, firstKey), random: { nextInt: () => 0 } });
    const firstRetry = await store.switchChallenge({ ...purchaseInput(playerId, 0, firstKey), random: { nextInt: () => { throw new Error('must not reroll'); } } });
    expect(first.view).toMatchObject({ switchCount: 1, nextSwitchCost: 40_000n, challenge: { externalKey: 'daily_convert_particles_320', progress: 0n } });
    expect(firstRetry.operation).toEqual({ id: first.operation.id, alreadyProcessed: true });
    const second = await store.switchChallenge({ ...purchaseInput(playerId, 0), random: { nextInt: () => 0 } });
    const third = await store.switchChallenge({ ...purchaseInput(playerId, 0), random: { nextInt: () => 0 } });
    expect(second.view).toMatchObject({ switchCount: 2, nextSwitchCost: 80_000n, challenge: { externalKey: 'daily_pulls_5' } });
    expect(third.view).toMatchObject({ switchCount: 3, nextSwitchCost: 160_000n, challenge: { externalKey: 'daily_convert_particles_320' } });
    expect(third.resources.moras).toBe(0n);
    await expect(store.switchChallenge({ ...purchaseInput(playerId, 0), random: { nextInt: () => { throw new Error('RNG must not run without funds'); } } })).rejects.toMatchObject({ code: 'DAILY_CHALLENGE_WALLET_INSUFFICIENT' });

    const completedId = await createPlayer({ moras: 30_000n, particles: 320n });
    await store.purchase(purchaseInput(completedId, 1));
    await store.convertParticles({ playerId: completedId, playerElementKey: 'hydro', businessDate, now, amount: 320n, idempotencyKey: randomUUID() });
    await expect(store.switchChallenge({ ...purchaseInput(completedId, 0), random: { nextInt: () => 0 } })).rejects.toMatchObject({ code: 'DAILY_CHALLENGE_SWITCH_UNAVAILABLE' });
  });

  it('does not debit or invoke RNG when no other eligible definition can be selected', async () => {
    const playerId = await createPlayer({ moras: 30_000n });
    const store = new PrismaDailyChallengeStore(database);
    await store.purchase(purchaseInput(playerId, 0));
    await database.dailyChallengeDefinition.update({ where: { externalKey: 'daily_convert_particles_320' }, data: { isEligible: false } });
    const random = { calls: 0, nextInt() { this.calls += 1; return 0; } };
    try {
      await expect(store.switchChallenge({ ...purchaseInput(playerId, 0), random })).rejects.toMatchObject({ code: 'DAILY_CHALLENGE_SWITCH_UNAVAILABLE' });
      expect(random.calls).toBe(0);
      expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'moras' } } })).amount).toBe(20_000n);
    } finally {
      await database.dailyChallengeDefinition.update({ where: { externalKey: 'daily_convert_particles_320' }, data: { isEligible: true } });
    }
  });

  it('converts only personal particles 1:1 and completes with one automatic 800-Primo reward', async () => {
    const playerId = await createPlayer({ moras: 10_000n, particles: 320n });
    const store = new PrismaDailyChallengeStore(database);
    await store.purchase(purchaseInput(playerId, 1));
    const key = randomUUID();
    const converted = await store.convertParticles({ playerId, playerElementKey: 'hydro', businessDate, now, amount: 320n, idempotencyKey: key });
    const retry = await store.convertParticles({ playerId, playerElementKey: 'hydro', businessDate, now, amount: 320n, idempotencyKey: key });
    expect(converted.view).toMatchObject({ status: 'COMPLETED', canSwitch: false });
    expect(converted.view.challenge).toMatchObject({ progress: 320n, target: 320n });
    expect(converted.resources.particles_hydro).toBe(0n);
    expect(converted.resources.primogems).toBe(1_120n);
    expect(retry.operation.alreadyProcessed).toBe(true);
    expect(retry.resources.primogems).toBe(1_120n);
    expect(await database.resourceMovement.count({ where: { playerId } })).toBe(4);
  });

  it('rejects an over-stock conversion without movements or progress', async () => {
    const playerId = await createPlayer({ moras: 10_000n, particles: 100n });
    const store = new PrismaDailyChallengeStore(database);
    await store.purchase(purchaseInput(playerId, 1));
    await expect(store.convertParticles({ playerId, playerElementKey: 'hydro', businessDate, now, amount: 101n, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'PARTICLE_CONVERSION_INSUFFICIENT' });
    expect((await store.getView(playerId, businessDate)).challenge).toMatchObject({ progress: 0n });
    expect(await database.resourceMovement.count({ where: { playerId, causeKey: { startsWith: 'particles.convert' } } })).toBe(0);
  });

  it('supports the future counted-message producer without exposing a fake player route', async () => {
    const playerId = await createPlayer({ moras: 0n });
    const definition = await database.dailyChallengeDefinition.findUniqueOrThrow({ where: { externalKey: 'daily_messages_10' } });
    await database.playerDailyChallenge.create({ data: {
      playerId,
      businessDate: new Date(`${businessDate}T00:00:00.000Z`),
      definitionId: definition.id,
      definitionExternalKeySnapshot: definition.externalKey,
      typeSnapshot: definition.type,
      displayNameSnapshot: definition.displayName,
      descriptionSnapshot: definition.description,
      progressLabelSnapshot: definition.progressLabel,
      targetSnapshot: definition.target,
      rewardPrimogemsSnapshot: definition.rewardPrimogems,
      assignedAt: now,
    } });
    const operation = await database.businessOperation.create({ data: { playerId, operationType: 'fixture.counted-message', sourceChannel: SourceChannel.UI } });
    const store = new PrismaDailyChallengeStore(database);
    await database.$transaction((tx) => store.progress(tx, { playerId, playerElementKey: 'hydro', businessDate, type: 'messages', amount: 10n, now, operationId: operation.id, sourceChannel: SourceChannel.UI }));
    expect(await store.getView(playerId, businessDate)).toMatchObject({ status: 'COMPLETED', challenge: { progress: 10n, target: 10n } });
    expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'primogems' } } })).amount).toBe(800n);
  });

  it('clamps pull progress, rewards once, and exposes no automatic assignment on the next date', async () => {
    const playerId = await createPlayer({ moras: 10_000n });
    const store = new PrismaDailyChallengeStore(database);
    await store.purchase(purchaseInput(playerId, 0));
    const operation = await database.businessOperation.create({ data: { playerId, operationType: 'fixture.pull', sourceChannel: SourceChannel.UI } });
    await database.$transaction((tx) => store.progress(tx, { playerId, playerElementKey: 'hydro', businessDate, type: 'pulls', amount: 10n, now, operationId: operation.id, sourceChannel: SourceChannel.UI }));
    await database.$transaction((tx) => store.progress(tx, { playerId, playerElementKey: 'hydro', businessDate, type: 'pulls', amount: 10n, now, operationId: operation.id, sourceChannel: SourceChannel.UI }));
    const completed = await store.getView(playerId, businessDate);
    expect(completed.challenge).toMatchObject({ progress: 5n, target: 5n });
    expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'primogems' } } })).amount).toBe(800n);
    expect(await store.getView(playerId, '2026-09-12')).toMatchObject({ status: 'AVAILABLE', assigned: false });
    expect(await database.playerDailyChallenge.findFirstOrThrow({ where: { playerId } })).toMatchObject({ status: 'COMPLETED' });
  });
});
