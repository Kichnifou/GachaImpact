import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { SetGachaTarget } from '../src/application/gacha/gacha-services.js';
import { getParisWeekWindow } from '../src/domain/gacha/gacha.js';
import { loadConfig } from '../src/config/environment.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { PrismaGachaStore } from '../src/infrastructure/database/prisma-gacha-store.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Gacha database tests.');
const database = createDatabase(config.databaseUrl);
const pullFixturePlayerIds = new Set<string>();
afterEach(async () => cleanupPullFixtures());
afterAll(async () => {
  await cleanupPullFixtures();
  await database.$disconnect();
});

describe('Gacha foundation on the development database', () => {
  it('has the complete catalog, RLS, state backfill and one concurrency-safe current banner', async () => {
    const store = new PrismaGachaStore(database);
    const window = getParisWeekWindow(new Date());
    expect(await database.bannerRotation.count({ where: { status: 'ACTIVE' } })).toBe(1);
    const select = () => { throw new Error('An existing weekly banner must not be regenerated.'); };
    const [first, second] = await Promise.all([store.ensureRotation(window.startsAt, window.endsAt, select), store.ensureRotation(window.startsAt, window.endsAt, select)]);
    expect(first.id).toBe(second.id);
    expect(first.featuredFiveStars).toHaveLength(4);
    expect(first.featuredFourStars).toHaveLength(6);
    expect(await database.character.count()).toBe(118);
    expect(await database.character.count({ where: { rarity: 5 } })).toBe(67);
    expect(await database.character.count({ where: { rarity: 4 } })).toBe(51);
    expect(await database.bannerRotation.count({ where: { status: 'ACTIVE' } })).toBe(1);
    expect(await database.player.count()).toBe(await database.playerGachaState.count());
    const rls = await database.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('characters','banner_rotations','banner_featured_characters','banner_votes','player_gacha_states')`;
    expect(rls).toHaveLength(5);
    expect(rls.every(({ relrowsecurity }) => relrowsecurity)).toBe(true);
  });

  it('has private RLS-enabled pull, possession and C6 tables with database constraints', async () => {
    const names = ['player_characters', 'c6_competition_progress', 'pull_operations', 'pull_results'];
    const rls = await database.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity FROM pg_class WHERE relname = ANY(${names}::text[])
    `;
    expect(rls).toHaveLength(4);
    expect(rls.every(({ relrowsecurity }) => relrowsecurity)).toBe(true);
    const grants = await database.$queryRaw<{ grantee: string }[]>`
      SELECT grantee FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = ANY(${names}::text[]) AND grantee IN ('anon', 'authenticated')
    `;
    expect(grants).toHaveLength(0);
  });

  it('persists one atomic, idempotent x1 with its debit, result, pity and possession-independent reward', async () => {
    const fixture = await createPullPlayer(160n);
    try {
      const store = new PrismaGachaStore(database);
      const input = { playerId: fixture.playerId, playerElementKey: 'hydro' as const, count: 1 as const, idempotencyKey: randomUUID(), now: fixture.now, random: maxRandom };
      const first = await store.pull(input);
      const retry = await store.pull({ ...input, random: { nextInt: () => { throw new Error('A committed retry must not reroll.'); } } });
      expect(first.operation).toMatchObject({ pullCount: 1, primogemCost: 160n, alreadyProcessed: false });
      expect(retry.operation).toMatchObject({ id: first.operation.id, alreadyProcessed: true });
      expect(retry.results).toEqual(first.results);
      expect(first.results).toHaveLength(1);
      expect(await database.pullOperation.count({ where: { playerId: fixture.playerId } })).toBe(1);
      expect(await database.pullResult.count({ where: { pullOperation: { playerId: fixture.playerId } } })).toBe(1);
      expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: fixture.playerId, resourceKey: 'primogems' } } })).amount).toBe(0n);
      const debit = await database.resourceMovement.findFirstOrThrow({ where: { playerId: fixture.playerId, causeKey: 'gacha.pull.cost' } });
      expect(debit).toMatchObject({ delta: -160n, balanceBefore: 160n, balanceAfter: 0n, operationId: expect.any(String) });
      expect((await database.playerEconomyStats.findUniqueOrThrow({ where: { playerId: fixture.playerId } })).totalPrimosSpent).toBe(160n);
      expect((await database.businessOperation.findFirstOrThrow({ where: { playerId: fixture.playerId, operationType: 'gacha.pull' } })).status).toBe('COMPLETED');
      expect((await database.playerGachaState.findUniqueOrThrow({ where: { playerId: fixture.playerId } })).totalPulls).toBe(1n);
    } finally { await deletePullPlayer(fixture.playerId); }
  });

  it('persists ten ordered sequential results and prevents concurrent overspending', async () => {
    const ten = await createPullPlayer(1_600n);
    try {
      const result = await new PrismaGachaStore(database).pull({ playerId: ten.playerId, playerElementKey: 'hydro', count: 10, idempotencyKey: randomUUID(), now: ten.now, random: maxRandom });
      expect(result.results.map(({ index }) => index)).toEqual([1,2,3,4,5,6,7,8,9,10]);
      expect(await database.pullResult.count({ where: { pullOperationId: result.operation.id } })).toBe(10);
      expect(await database.playerGachaState.findUniqueOrThrow({ where: { playerId: ten.playerId } })).toMatchObject({ totalPulls: 10n, pity5: 10, pity4: 0 });
      expect(await database.playerCharacter.count({ where: { playerId: ten.playerId } })).toBe(1);
      expect(await database.resourceMovement.findFirstOrThrow({ where: { playerId: ten.playerId, causeKey: 'gacha.pull.cost' } })).toMatchObject({ delta: -1_600n, balanceBefore: 1_600n, balanceAfter: 0n });
    } finally { await deletePullPlayer(ten.playerId); }

    const concurrent = await createPullPlayer(160n);
    try {
      const store = new PrismaGachaStore(database);
      const baseInput = { playerId: concurrent.playerId, playerElementKey: 'hydro' as const, count: 1 as const, now: concurrent.now, random: maxRandom };
      const outcomes = await Promise.allSettled([
        store.pull({ ...baseInput, idempotencyKey: randomUUID() }),
        store.pull({ ...baseInput, idempotencyKey: randomUUID() }),
      ]);
      expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(1);
      expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: concurrent.playerId, resourceKey: 'primogems' } } })).amount).toBe(0n);
      expect(await database.pullOperation.count({ where: { playerId: concurrent.playerId } })).toBe(1);
    } finally { await deletePullPlayer(concurrent.playerId); }
  }, 15_000);

  it('paginates history by ten, keeps newest operations and x10 order, and isolates players', async () => {
    const empty = await createPullPlayer(0n);
    const small = await createPullPlayer(320n);
    const exact = await createPullPlayer(1_600n);
    const over = await createPullPlayer(1_920n);
    try {
      const store = new PrismaGachaStore(database);
      const emptyHistory = await store.getHistory(empty.playerId, 1);
      expect(emptyHistory).toMatchObject({ page: 1, pageSize: 10, totalResults: 0, totalPages: 0, hasPrevious: false, hasNext: false, results: [] });

      await store.pull({ playerId: small.playerId, playerElementKey: 'hydro', count: 1, idempotencyKey: randomUUID(), now: new Date(small.now.getTime() - 2_000), random: maxRandom });
      await store.pull({ playerId: small.playerId, playerElementKey: 'hydro', count: 1, idempotencyKey: randomUUID(), now: new Date(small.now.getTime() - 1_000), random: maxRandom });
      const smallHistory = await store.getHistory(small.playerId, 1);
      expect(smallHistory).toMatchObject({ totalResults: 2, totalPages: 1, hasPrevious: false, hasNext: false });

      await store.pull({ playerId: exact.playerId, playerElementKey: 'hydro', count: 10, idempotencyKey: randomUUID(), now: exact.now, random: maxRandom });
      const exactHistory = await store.getHistory(exact.playerId, 1);
      expect(exactHistory).toMatchObject({ totalResults: 10, totalPages: 1, hasPrevious: false, hasNext: false });
      expect(exactHistory.results.map(({ index }) => index)).toEqual([1,2,3,4,5,6,7,8,9,10]);

      await store.pull({ playerId: over.playerId, playerElementKey: 'hydro', count: 1, idempotencyKey: randomUUID(), now: new Date(over.now.getTime() - 2_000), random: maxRandom });
      await store.pull({ playerId: over.playerId, playerElementKey: 'hydro', count: 1, idempotencyKey: randomUUID(), now: new Date(over.now.getTime() - 1_000), random: maxRandom });
      const newest = await store.pull({ playerId: over.playerId, playerElementKey: 'hydro', count: 10, idempotencyKey: randomUUID(), now: over.now, random: maxRandom });
      const firstPage = await store.getHistory(over.playerId, 1);
      const secondPage = await store.getHistory(over.playerId, 2);
      expect(firstPage).toMatchObject({ totalResults: 12, totalPages: 2, hasPrevious: false, hasNext: true });
      expect(firstPage.results.every(({ operationId }) => operationId === newest.operation.id)).toBe(true);
      expect(firstPage.results.map(({ index }) => index)).toEqual([1,2,3,4,5,6,7,8,9,10]);
      expect(firstPage.results.map(({ pity5AtPull }) => pity5AtPull)).toEqual([3,4,5,6,7,8,9,10,11,12]);
      expect(firstPage.results.map(({ pity4AtPull }) => pity4AtPull)).toEqual([3,4,5,6,7,8,9,10,1,2]);
      expect(secondPage).toMatchObject({ page: 2, totalResults: 12, totalPages: 2, hasPrevious: true, hasNext: false });
      expect(secondPage.results).toHaveLength(2);
      expect(secondPage.results[0]!.occurredAt.getTime()).toBeGreaterThan(secondPage.results[1]!.occurredAt.getTime());
      const smallOperationIds = new Set(smallHistory.results.map(({ operationId }) => operationId));
      expect(firstPage.results.some(({ operationId }) => smallOperationIds.has(operationId))).toBe(false);
      expect((await store.getHistory(small.playerId, 1)).results).toHaveLength(2);
    } finally {
      await deletePullPlayer(empty.playerId);
      await deletePullPlayer(small.playerId);
      await deletePullPlayer(exact.playerId);
      await deletePullPlayer(over.playerId);
    }
  }, 25_000);

  it('rolls the complete transaction back when resolution fails after the debit', async () => {
    const fixture = await createPullPlayer(160n);
    try {
      await expect(new PrismaGachaStore(database).pull({ playerId: fixture.playerId, playerElementKey: 'hydro', count: 1, idempotencyKey: randomUUID(), now: fixture.now, random: { nextInt: () => { throw new Error('forced failure'); } } })).rejects.toThrow('forced failure');
      expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: fixture.playerId, resourceKey: 'primogems' } } })).amount).toBe(160n);
      expect(await database.pullOperation.count({ where: { playerId: fixture.playerId } })).toBe(0);
      expect(await database.resourceMovement.count({ where: { playerId: fixture.playerId } })).toBe(0);
      expect((await database.playerGachaState.findUniqueOrThrow({ where: { playerId: fixture.playerId } })).totalPulls).toBe(0n);
    } finally { await deletePullPlayer(fixture.playerId); }
  });

  it('deduplicates concurrent retries and serializes two first acquisitions of the same character', async () => {
    const retryFixture = await createPullPlayer(160n);
    try {
      const store = new PrismaGachaStore(database);
      const key = randomUUID();
      const input = { playerId: retryFixture.playerId, playerElementKey: 'hydro' as const, count: 1 as const, idempotencyKey: key, now: retryFixture.now, random: maxRandom };
      const [first, retry] = await Promise.all([store.pull(input), store.pull(input)]);
      expect(first.operation.id).toBe(retry.operation.id);
      expect(await database.pullOperation.count({ where: { playerId: retryFixture.playerId } })).toBe(1);
      expect(await database.resourceMovement.count({ where: { playerId: retryFixture.playerId, causeKey: 'gacha.pull.cost' } })).toBe(1);
    } finally { await deletePullPlayer(retryFixture.playerId); }

    const acquisitionFixture = await createPullPlayer(320n);
    try {
      const store = new PrismaGachaStore(database);
      const alwaysZero = { nextInt: () => 0 };
      const baseInput = { playerId: acquisitionFixture.playerId, playerElementKey: 'hydro' as const, count: 1 as const, now: acquisitionFixture.now, random: alwaysZero };
      await Promise.all([
        store.pull({ ...baseInput, idempotencyKey: randomUUID() }),
        store.pull({ ...baseInput, idempotencyKey: randomUUID() }),
      ]);
      const possession = await database.playerCharacter.findUniqueOrThrow({ where: { playerId_characterId: { playerId: acquisitionFixture.playerId, characterId: acquisitionFixture.targetId } } });
      expect(possession).toMatchObject({ copies: 2, constellation: 1 });
      expect(await database.pullOperation.count({ where: { playerId: acquisitionFixture.playerId } })).toBe(2);
    } finally { await deletePullPlayer(acquisitionFixture.playerId); }
  }, 15_000);

  it('prevents a concurrent x10 and x1 from overspending the same 1600 Primogemmes', async () => {
    const fixture = await createPullPlayer(1_600n);
    try {
      const store = new PrismaGachaStore(database);
      const baseInput = { playerId: fixture.playerId, playerElementKey: 'hydro' as const, now: fixture.now, random: maxRandom };
      const outcomes = await Promise.allSettled([
        store.pull({ ...baseInput, count: 10, idempotencyKey: randomUUID() }),
        store.pull({ ...baseInput, count: 1, idempotencyKey: randomUUID() }),
      ]);
      expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
      const balance = (await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: fixture.playerId, resourceKey: 'primogems' } } })).amount;
      expect(balance >= 0n).toBe(true);
      expect([0n, 1_440n]).toContain(balance);
      expect(await database.pullOperation.count({ where: { playerId: fixture.playerId } })).toBe(1);
    } finally { await deletePullPlayer(fixture.playerId); }
  }, 15_000);

  it('persists and replays the exact C6+ stat progression without a second random choice', async () => {
    const fixture = await createPullPlayer(160n);
    try {
      await database.playerGachaState.update({ where: { playerId: fixture.playerId }, data: { pity5: 89, guaranteedFeatured5: true } });
      await database.playerCharacter.create({ data: { playerId: fixture.playerId, characterId: fixture.targetId, copies: 7, constellation: 6, firstObtainedAt: fixture.now } });
      await database.c6CompetitionProgress.create({ data: { playerId: fixture.playerId, characterId: fixture.targetId, unlockedAt: fixture.now } });
      const random = { nextInt: vi.fn((maximum: number) => maximum === 5 ? 2 : maximum - 1) };
      const store = new PrismaGachaStore(database);
      const idempotencyKey = randomUUID();
      const input = { playerId: fixture.playerId, playerElementKey: 'hydro' as const, count: 1 as const, idempotencyKey, now: fixture.now, random };
      const result = await store.pull(input);
      const randomCallsAfterPull = random.nextInt.mock.calls.length;
      const retry = await store.pull({ ...input, random: { nextInt: () => { throw new Error('A committed retry must not choose another C6 progression.'); } } });
      const persisted = await database.pullResult.findFirstOrThrow({ where: { pullOperationId: result.operation.id } });
      expect(result.results[0]).toMatchObject({ c6Progression: { type: 'stat', stat: 'beauty', valueAfter: 2 } });
      expect(persisted.snapshot).toMatchObject({ c6Progression: { type: 'stat', stat: 'beauty', valueAfter: 2 } });
      expect(retry.operation).toMatchObject({ id: result.operation.id, alreadyProcessed: true });
      expect(retry.results).toEqual(result.results);
      expect(random.nextInt).toHaveBeenCalledTimes(randomCallsAfterPull);
      expect(await database.c6CompetitionProgress.findUniqueOrThrow({ where: { playerId_characterId: { playerId: fixture.playerId, characterId: fixture.targetId } } })).toMatchObject({ beauty: 2 });
      expect(await database.resourceMovement.count({ where: { playerId: fixture.playerId, causeKey: 'gacha.c6-duplicate-refund' } })).toBe(1);
    } finally { await deletePullPlayer(fixture.playerId); }
  });

  it('persists C6+ possession, refund, maxed compensation and economy earned counters', async () => {
    const fixture = await createPullPlayer(160n);
    try {
      await database.playerGachaState.update({ where: { playerId: fixture.playerId }, data: { pity5: 89, guaranteedFeatured5: true } });
      await database.playerCharacter.create({ data: { playerId: fixture.playerId, characterId: fixture.targetId, copies: 7, constellation: 6, firstObtainedAt: fixture.now } });
      await database.c6CompetitionProgress.create({ data: { playerId: fixture.playerId, characterId: fixture.targetId, unlockedAt: fixture.now, strength: 20, intelligence: 20, beauty: 20, charisma: 20, popularity: 20 } });
      const store = new PrismaGachaStore(database);
      const idempotencyKey = randomUUID();
      const input = { playerId: fixture.playerId, playerElementKey: 'hydro' as const, count: 1 as const, idempotencyKey, now: fixture.now, random: maxRandom };
      const result = await store.pull(input);
      const retry = await store.pull({ ...input, random: { nextInt: () => { throw new Error('A committed retry must not reroll C6 rewards.'); } } });
      const persisted = await database.pullResult.findFirstOrThrow({ where: { pullOperationId: result.operation.id } });
      expect(result.results[0]).toMatchObject({ character: { id: fixture.targetId }, copiesAfter: 8, constellationAfter: 6, bonusRewards: [{ resourceKey: 'primogems', amount: 160n }, { resourceKey: 'moras', amount: 100_000n }], c6Progression: { type: 'maxed' } });
      expect(persisted.snapshot).toMatchObject({ c6Progression: { type: 'maxed' } });
      expect(retry.operation).toMatchObject({ id: result.operation.id, alreadyProcessed: true });
      expect(retry.results).toEqual(result.results);
      expect((await database.playerCharacter.findUniqueOrThrow({ where: { playerId_characterId: { playerId: fixture.playerId, characterId: fixture.targetId } } })).copies).toBe(8);
      const stats = await database.playerEconomyStats.findUniqueOrThrow({ where: { playerId: fixture.playerId } });
      expect(stats).toMatchObject({ totalPrimosSpent: 160n, totalPrimosEarned: 160n, totalMorasEarned: 100_000n });
      expect(await database.resourceMovement.count({ where: { playerId: fixture.playerId, causeKey: 'gacha.c6-duplicate-refund' } })).toBe(1);
      expect(await database.resourceMovement.count({ where: { playerId: fixture.playerId, causeKey: 'gacha.c6-maxed-compensation' } })).toBe(1);
    } finally { await deletePullPlayer(fixture.playerId); }
  });

  it('refunds exactly 80 Primogemmes for an already-C6 four-star while copies continue at C6', async () => {
    const fixture = await createPullPlayer(160n);
    try {
      await database.playerGachaState.update({ where: { playerId: fixture.playerId }, data: { pity4: 9 } });
      await database.playerCharacter.create({ data: { playerId: fixture.playerId, characterId: fixture.fourStarId, copies: 7, constellation: 6, firstObtainedAt: fixture.now } });
      const result = await new PrismaGachaStore(database).pull({ playerId: fixture.playerId, playerElementKey: 'hydro', count: 1, idempotencyKey: randomUUID(), now: fixture.now, random: maxRandom });
      expect(result.results[0]).toMatchObject({ character: { id: fixture.fourStarId }, rarity: 4, copiesAfter: 8, constellationAfter: 6, bonusRewards: [{ resourceKey: 'primogems', amount: 80n }] });
      expect(await database.playerCharacter.findUniqueOrThrow({ where: { playerId_characterId: { playerId: fixture.playerId, characterId: fixture.fourStarId } } })).toMatchObject({ copies: 8, constellation: 6 });
      expect(await database.c6CompetitionProgress.count({ where: { playerId: fixture.playerId, characterId: fixture.fourStarId } })).toBe(0);
      expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: fixture.playerId, resourceKey: 'primogems' } } })).amount).toBe(80n);
    } finally { await deletePullPlayer(fixture.playerId); }
  });

  it('persists a valid target without changing counters, resources or progression', async () => {
    const identity = { subject: `test-gacha-${randomUUID()}` };
    const playerStore = new PrismaCurrentPlayerStore(database);
    const player = (await new GetOrProvisionCurrentPlayer(playerStore).execute(identity, `Gacha ${randomUUID().slice(0, 8)}`)).player;
    try {
      const store = new PrismaGachaStore(database);
      const current = await store.getCurrent(player.id);
      const target = current!.banner.featuredFiveStars[0]!;
      const beforeBalances = await database.playerResourceBalance.findMany({ where: { playerId: player.id }, orderBy: { resourceKey: 'asc' } });
      const beforeProgression = await database.playerProgression.findUniqueOrThrow({ where: { playerId: player.id } });
      const result = await new SetGachaTarget(new GetCurrentPlayer(playerStore), store).execute(identity, target.id);
      expect(result).toMatchObject({ selectedBannerCharacterId: target.id, pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, totalPulls: 0n });
      expect(await database.playerResourceBalance.findMany({ where: { playerId: player.id }, orderBy: { resourceKey: 'asc' } })).toEqual(beforeBalances);
      expect(await database.playerProgression.findUniqueOrThrow({ where: { playerId: player.id } })).toEqual(beforeProgression);
      await expect(store.setTarget(player.id, current!.banner.featuredFourStars[0]!.id)).rejects.toMatchObject({ code: 'GACHA_TARGET_INVALID' });
      await expect(store.setTarget(player.id, randomUUID())).rejects.toMatchObject({ code: 'GACHA_TARGET_INVALID' });
    } finally {
      await database.webIdentity.deleteMany({ where: { playerId: player.id } });
      await database.player.delete({ where: { id: player.id } });
    }
  });
});

const maxRandom = { nextInt: (maximum: number) => maximum - 1 };

async function createPullPlayer(primogems: bigint) {
  const identity = { subject: `test-pull-${randomUUID()}` };
  const playerStore = new PrismaCurrentPlayerStore(database);
  const player = (await new GetOrProvisionCurrentPlayer(playerStore).execute(identity, `Pull ${randomUUID().slice(0, 8)}`)).player;
  pullFixturePlayerIds.add(player.id);
  await database.player.update({ where: { id: player.id }, data: { elementKey: 'hydro' } });
  await database.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: 'primogems' } }, data: { amount: primogems } });
  const current = await new PrismaGachaStore(database).getCurrent(player.id);
  const target = current!.banner.featuredFiveStars[0]!;
  const fourStar = current!.banner.featuredFourStars.at(-1)!;
  await database.playerGachaState.update({ where: { playerId: player.id }, data: { selectedBannerCharacterId: target.id } });
  return { playerId: player.id, targetId: target.id, fourStarId: fourStar.id, now: new Date((current!.banner.startsAt.getTime() + current!.banner.endsAt.getTime()) / 2) };
}

async function deletePullPlayer(playerId: string) {
  await database.$transaction(async (transaction) => {
    await transaction.pullResult.deleteMany({ where: { pullOperation: { playerId } } });
    await transaction.pullOperation.deleteMany({ where: { playerId } });
    await transaction.resourceMovement.deleteMany({ where: { playerId } });
    await transaction.businessOperation.deleteMany({ where: { playerId } });
    await transaction.webIdentity.deleteMany({ where: { playerId } });
    await transaction.player.deleteMany({ where: { id: playerId } });
  });
  pullFixturePlayerIds.delete(playerId);
}

async function cleanupPullFixtures() {
  for (const playerId of [...pullFixturePlayerIds]) await deletePullPlayer(playerId);
}
