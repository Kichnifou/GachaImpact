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
import { PrismaTeamStore } from '../src/infrastructure/database/prisma-team-store.js';
import { PrismaDailyChallengeStore } from '../src/infrastructure/database/prisma-daily-challenge-store.js';
import { getBusinessDate } from '../src/domain/time/business-date.js';

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
    const canonicalCatalog = { externalKey: { startsWith: 'legacy:' } };
    expect(await database.character.count({ where: canonicalCatalog })).toBe(118);
    expect(await database.character.count({ where: { ...canonicalCatalog, rarity: 5 } })).toBe(67);
    expect(await database.character.count({ where: { ...canonicalCatalog, rarity: 4 } })).toBe(51);
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

  it('advances and completes a pull Daily Challenge inside the pull transaction exactly once', async () => {
    const fixture = await createPullPlayer(160n);
    try {
      await database.playerResourceBalance.update({
        where: { playerId_resourceKey: { playerId: fixture.playerId, resourceKey: 'moras' } },
        data: { amount: 10_000n },
      });
      const challenges = new PrismaDailyChallengeStore(database);
      const businessDate = getBusinessDate(fixture.now);
      await challenges.purchase({
        playerId: fixture.playerId,
        playerElementKey: 'hydro',
        businessDate,
        now: fixture.now,
        idempotencyKey: randomUUID(),
        random: { nextInt: () => 0 },
      });
      const store = new PrismaGachaStore(database, undefined, undefined, undefined, undefined, challenges);
      await expect(store.pull({ playerId: fixture.playerId, playerElementKey: 'hydro', count: 10, idempotencyKey: randomUUID(), now: fixture.now, random: maxRandom })).rejects.toMatchObject({ code: 'INSUFFICIENT_PRIMOGEMS' });
      expect((await challenges.getView(fixture.playerId, businessDate)).challenge).toMatchObject({ progress: 0n });
      await store.pull({ playerId: fixture.playerId, playerElementKey: 'hydro', count: 1, idempotencyKey: randomUUID(), now: fixture.now, random: maxRandom });
      expect((await challenges.getView(fixture.playerId, businessDate)).challenge).toMatchObject({ progress: 1n });
      await database.playerResourceBalance.update({
        where: { playerId_resourceKey: { playerId: fixture.playerId, resourceKey: 'primogems' } },
        data: { amount: 1_600n },
      });
      const idempotencyKey = randomUUID();
      const input = { playerId: fixture.playerId, playerElementKey: 'hydro' as const, count: 10 as const, idempotencyKey, now: fixture.now, random: maxRandom };
      const first = await store.pull(input);
      const retry = await store.pull({ ...input, random: { nextInt: () => { throw new Error('A committed retry must not progress the challenge twice.'); } } });
      expect(first.operation.alreadyProcessed).toBe(false);
      expect(retry.operation).toMatchObject({ id: first.operation.id, alreadyProcessed: true });
      expect(await challenges.getView(fixture.playerId, businessDate)).toMatchObject({
        status: 'COMPLETED',
        challenge: { externalKey: 'daily_pulls_5', progress: 5n, target: 5n },
      });
      expect((await database.playerResourceBalance.findUniqueOrThrow({
        where: { playerId_resourceKey: { playerId: fixture.playerId, resourceKey: 'primogems' } },
      })).amount).toBe(800n);
      expect(await database.resourceMovement.count({
        where: { playerId: fixture.playerId, causeKey: 'daily-challenge.completion' },
      })).toBe(1);
    } finally { await deletePullPlayer(fixture.playerId); }
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

      await store.pull({ playerId: small.playerId, playerElementKey: 'hydro', count: 1, idempotencyKey: randomUUID(), now: small.now, random: maxRandom });
      await store.pull({ playerId: small.playerId, playerElementKey: 'hydro', count: 1, idempotencyKey: randomUUID(), now: small.now, random: maxRandom });
      const smallHistory = await store.getHistory(small.playerId, 1);
      expect(smallHistory).toMatchObject({ totalResults: 2, totalPages: 1, hasPrevious: false, hasNext: false });
      expect((await store.getHistory(small.playerId, 1)).results.map(({ operationId }) => operationId))
        .toEqual(smallHistory.results.map(({ operationId }) => operationId));

      await store.pull({ playerId: exact.playerId, playerElementKey: 'hydro', count: 10, idempotencyKey: randomUUID(), now: exact.now, random: maxRandom });
      const exactHistory = await store.getHistory(exact.playerId, 1);
      expect(exactHistory).toMatchObject({ totalResults: 10, totalPages: 1, hasPrevious: false, hasNext: false });
      expect(exactHistory.results.map(({ index }) => index)).toEqual([10,9,8,7,6,5,4,3,2,1]);

      await store.pull({ playerId: over.playerId, playerElementKey: 'hydro', count: 1, idempotencyKey: randomUUID(), now: new Date(over.now.getTime() - 2_000), random: maxRandom });
      await store.pull({ playerId: over.playerId, playerElementKey: 'hydro', count: 1, idempotencyKey: randomUUID(), now: new Date(over.now.getTime() - 1_000), random: maxRandom });
      const newest = await store.pull({ playerId: over.playerId, playerElementKey: 'hydro', count: 10, idempotencyKey: randomUUID(), now: over.now, random: maxRandom });
      const firstPage = await store.getHistory(over.playerId, 1);
      const secondPage = await store.getHistory(over.playerId, 2);
      expect(firstPage).toMatchObject({ totalResults: 12, totalPages: 2, hasPrevious: false, hasNext: true });
      expect(firstPage.results.every(({ operationId }) => operationId === newest.operation.id)).toBe(true);
      expect(firstPage.results.map(({ index }) => index)).toEqual([10,9,8,7,6,5,4,3,2,1]);
      expect(firstPage.results.map(({ pity5AtPull }) => pity5AtPull)).toEqual([12,11,10,9,8,7,6,5,4,3]);
      expect(firstPage.results.map(({ pity4AtPull }) => pity4AtPull)).toEqual([2,1,10,9,8,7,6,5,4,3]);
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

  it('replays the persisted post-Pull state even after a later Pull changes the current state', async () => {
    const fixture = await createPullPlayer(320n);
    try {
      const store = new PrismaGachaStore(database);
      const firstInput = {
        playerId: fixture.playerId,
        playerElementKey: 'hydro' as const,
        count: 1 as const,
        idempotencyKey: randomUUID(),
        now: fixture.now,
        random: maxRandom,
      };
      const first = await store.pull(firstInput);
      const second = await store.pull({ ...firstInput, idempotencyKey: randomUUID() });
      const retry = await store.pull({
        ...firstInput,
        random: { nextInt: () => { throw new Error('A committed retry must not reroll.'); } },
      });

      expect(second.playerState.totalPulls).toBe(2n);
      expect(retry.operation).toMatchObject({ id: first.operation.id, alreadyProcessed: true });
      expect(retry.results).toEqual(first.results);
      expect(retry.playerState).toEqual(first.playerState);
      expect(retry.playerState).not.toEqual(second.playerState);
    } finally { await deletePullPlayer(fixture.playerId); }
  });

  it('applies compatible active-Team passives together and ignores an inactive Team', async () => {
    const fixture = await createPullPlayer(1_600n);
    try {
      await configureTeams(fixture.playerId, ['pyro', 'hydro', 'electro', 'dendro'], ['hydro', 'hydro']);
      const result = await new PrismaGachaStore(database).pull({
        playerId: fixture.playerId, playerElementKey: 'hydro', count: 1,
        idempotencyKey: randomUUID(), now: fixture.now, random: procResourceRandom,
      });
      expect(result.results[0]).toMatchObject({ resultType: 'resource', resourceKey: 'particles_pyro', resourceAmount: 25n });
      expect(result.results[0]!.passiveEffects.map(({ elementKey, type }) => [elementKey, type])).toEqual([
        ['hydro', 'five_star_chance_bonus'],
        ['pyro', 'secondary_reward_multiplier'],
        ['electro', 'pity5'],
        ['dendro', 'resource_bundle'],
      ]);
      expect(result.playerState.pity5).toBe(3);
      expect(result.results[0]!.bonusRewards).toHaveLength(9);
      const persisted = await database.pullResult.findFirstOrThrow({ where: { pullOperationId: result.operation.id } });
      expect(persisted.snapshot).toMatchObject({ activeTeam: { elements: ['pyro', 'hydro', 'electro', 'dendro'] } });
    } finally { await deletePullPlayer(fixture.playerId); }
  }, 15_000);

  it('applies Geo, Cryo and Anemo transactionally without touching message counters', async () => {
    const fixture = await createPullPlayer(1_600n);
    try {
      await configureTeams(fixture.playerId, ['geo', 'cryo', 'anemo']);
      await database.playerProgression.update({
        where: { playerId: fixture.playerId },
        data: { xp: 29n, totalMessages: 9n, countedMessages: 4n, lastXpMessageAt: new Date('2026-09-08T10:00:00Z') },
      });
      const beforeMessageAt = (await database.playerProgression.findUniqueOrThrow({ where: { playerId: fixture.playerId } })).lastXpMessageAt;
      const result = await new PrismaGachaStore(database).pull({
        playerId: fixture.playerId, playerElementKey: 'hydro', count: 1,
        idempotencyKey: randomUUID(), now: fixture.now, random: procMoraRandom,
      });
      expect(result.results[0]).toMatchObject({ resultType: 'resource', resourceKey: 'moras', resourceAmount: 6_250n });
      expect(result.results[0]!.passiveEffects.map(({ elementKey }) => elementKey)).toEqual(['geo', 'cryo', 'anemo']);
      const progression = await database.playerProgression.findUniqueOrThrow({ where: { playerId: fixture.playerId } });
      expect(progression).toMatchObject({ xp: 30n, totalMessages: 9n, countedMessages: 4n, lastXpAt: fixture.now, lastXpMessageAt: beforeMessageAt });
      expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: fixture.playerId, resourceKey: 'primogems' } } })).amount).toBe(2_320n);
      expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: fixture.playerId, resourceKey: 'moras' } } })).amount).toBe(16_250n);
    } finally { await deletePullPlayer(fixture.playerId); }
  }, 15_000);

  it('replays x10 passive effects exactly without rerolls or duplicate XP and resource credits', async () => {
    const fixture = await createPullPlayer(1_600n);
    try {
      await configureTeams(fixture.playerId, ['cryo', 'anemo', 'dendro']);
      await database.playerProgression.update({ where: { playerId: fixture.playerId }, data: { xp: 20n } });
      const store = new PrismaGachaStore(database);
      const input = {
        playerId: fixture.playerId, playerElementKey: 'hydro' as const, count: 10 as const,
        idempotencyKey: randomUUID(), now: fixture.now, random: procMoraRandom,
      };
      const first = await store.pull(input);
      const retry = await store.pull({ ...input, random: { nextInt: () => { throw new Error('A committed passive retry must not reroll.'); } } });
      expect(retry.operation).toMatchObject({ id: first.operation.id, alreadyProcessed: true });
      expect(retry.results).toEqual(first.results);
      expect(first.results).toHaveLength(10);
      expect(first.results.every(({ passiveEffects }) => ['cryo', 'anemo', 'dendro'].every((element) => passiveEffects.some(({ elementKey }) => elementKey === element)))).toBe(true);
      expect((await database.playerProgression.findUniqueOrThrow({ where: { playerId: fixture.playerId } })).xp).toBe(30n);
      expect(await database.resourceMovement.count({ where: { playerId: fixture.playerId, causeKey: 'team.passive.anemo.primogem-recovery' } })).toBe(10);
      expect(await database.resourceMovement.count({ where: { playerId: fixture.playerId, causeKey: 'team.passive.dendro.bundle' } })).toBe(90);
      expect(await database.pullOperation.count({ where: { playerId: fixture.playerId } })).toBe(1);
      const snapshots = await database.pullResult.findMany({ where: { pullOperationId: first.operation.id }, select: { snapshot: true }, orderBy: { resultIndex: 'asc' } });
      expect(snapshots).toHaveLength(10);
      expect(snapshots.every(({ snapshot }) => JSON.stringify(snapshot).includes('activeTeam'))).toBe(true);
    } finally { await deletePullPlayer(fixture.playerId); }
  }, 30_000);

  it('excludes disabled characters from the active Team snapshot', async () => {
    const fixture = await createPullPlayer(160n);
    let disabledCharacterId: string | null = null;
    try {
      const ids = await configureTeams(fixture.playerId, ['hydro']);
      disabledCharacterId = ids[0]!;
      await database.character.update({ where: { id: disabledCharacterId }, data: { isActive: false } });
      const result = await new PrismaGachaStore(database).pull({
        playerId: fixture.playerId, playerElementKey: 'hydro', count: 1,
        idempotencyKey: randomUUID(), now: fixture.now, random: maxRandom,
      });
      expect(result.results[0]!.passiveEffects).toEqual([]);
    } finally {
      if (disabledCharacterId) await database.character.update({ where: { id: disabledCharacterId }, data: { isActive: true } });
      await deletePullPlayer(fixture.playerId);
    }
  }, 15_000);

  it('uses every level-II passive contract from two active element stacks', async () => {
    const fixture = await createPullPlayer(2_000n);
    try {
      const store = new PrismaGachaStore(database);
      const pullWith = async (element: string, random: { nextInt(maximum: number): number }) => {
        await configureTeams(fixture.playerId, [element, element]);
        return store.pull({
          playerId: fixture.playerId,
          playerElementKey: 'hydro',
          count: 1,
          idempotencyKey: randomUUID(),
          now: fixture.now,
          random,
        });
      };

      const pyro = await pullWith('pyro', procResourceRandom);
      expect(pyro.results[0]).toMatchObject({ resourceKey: 'particles_pyro', resourceAmount: 30n });
      expect(pyro.results[0]!.passiveEffects).toContainEqual(expect.objectContaining({ elementKey: 'pyro', numerator: 3, denominator: 2 }));

      const geo = await pullWith('geo', procMoraRandom);
      expect(geo.results[0]).toMatchObject({ resourceKey: 'moras', resourceAmount: 7_500n });
      expect(geo.results[0]!.passiveEffects).toContainEqual(expect.objectContaining({ elementKey: 'geo', numerator: 3, denominator: 2 }));

      const hydro = await pullWith('hydro', maxRandom);
      expect(hydro.results[0]!.passiveEffects).toContainEqual({ elementKey: 'hydro', type: 'five_star_chance_bonus', basisPoints: 60 });

      const cryoRandom = { nextInt: vi.fn(procMoraRandom.nextInt) };
      const cryo = await pullWith('cryo', cryoRandom);
      expect(cryoRandom.nextInt).toHaveBeenCalledWith(10);
      expect(cryo.results[0]!.passiveEffects).toContainEqual(expect.objectContaining({ elementKey: 'cryo', type: 'xp', amount: 1n }));

      const electroRandom = { nextInt: vi.fn(procMoraRandom.nextInt) };
      const electro = await pullWith('electro', electroRandom);
      expect(electroRandom.nextInt).toHaveBeenCalledWith(20);
      expect(electro.results[0]!.passiveEffects).toContainEqual(expect.objectContaining({ elementKey: 'electro', type: 'pity5', requestedAmount: 2 }));

      const anemoRandom = { nextInt: vi.fn(procMoraRandom.nextInt) };
      const anemo = await pullWith('anemo', anemoRandom);
      expect(anemoRandom.nextInt).toHaveBeenCalledWith(8);
      expect(anemo.results[0]!.passiveEffects).toContainEqual({ elementKey: 'anemo', type: 'primogem_recovery', amount: 80n });

      const dendroRandom = { nextInt: vi.fn(procMoraRandom.nextInt) };
      const dendro = await pullWith('dendro', dendroRandom);
      expect(dendroRandom.nextInt).toHaveBeenCalledWith(15);
      expect(dendro.results[0]!.passiveEffects).toContainEqual(expect.objectContaining({ elementKey: 'dendro', type: 'resource_bundle' }));
    } finally { await deletePullPlayer(fixture.playerId); }
  }, 35_000);
});

const maxRandom = { nextInt: (maximum: number) => maximum - 1 };
const procResourceRandom = { nextInt: (maximum: number) => maximum === 10_000 ? 9_999 : maximum === 2 ? 1 : 0 };
const procMoraRandom = { nextInt: (maximum: number) => maximum === 10_000 ? 9_999 : 0 };

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

async function configureTeams(playerId: string, activeElements: readonly string[], inactiveElements: readonly string[] = []): Promise<readonly string[]> {
  await new PrismaTeamStore(database).getOrProvision(playerId);
  const teams = await database.team.findMany({ where: { playerId }, orderBy: { displayPosition: 'asc' }, take: 2 });
  if (teams.length < 2) throw new Error('Pull fixture must have at least two provisioned Teams.');
  await database.team.updateMany({ where: { playerId }, data: { isActive: false } });
  await database.team.update({ where: { id: teams[0]!.id }, data: { isActive: true } });
  await database.teamMember.deleteMany({ where: { teamId: { in: teams.map(({ id }) => id) } } });
  const used = new Set<string>();

  const fill = async (teamId: string, elements: readonly string[]) => {
    const ids: string[] = [];
    for (const [index, elementKey] of elements.entries()) {
      const character = await database.character.findFirstOrThrow({ where: { elementKey, isActive: true, id: { notIn: [...used] } }, select: { id: true } });
      used.add(character.id);
      ids.push(character.id);
      await database.playerCharacter.upsert({
        where: { playerId_characterId: { playerId, characterId: character.id } },
        create: { playerId, characterId: character.id, copies: 1, constellation: 0, firstObtainedAt: new Date('2026-09-09T00:00:00Z') },
        update: {},
      });
      await database.teamMember.create({ data: { teamId, position: index + 1, characterId: character.id } });
    }
    return ids;
  };

  const activeIds = await fill(teams[0]!.id, activeElements);
  await fill(teams[1]!.id, inactiveElements);
  return activeIds;
}

async function cleanupPullFixtures() {
  for (const playerId of [...pullFixturePlayerIds]) await deletePullPlayer(playerId);
}
