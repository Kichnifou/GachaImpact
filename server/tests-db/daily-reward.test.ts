import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { ClaimDailyReward } from '../src/application/daily-reward/claim-daily-reward.js';
import { GetTodayDailyReward } from '../src/application/daily-reward/get-today-daily-reward.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { loadConfig } from '../src/config/environment.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { PrismaDailyRewardStore } from '../src/infrastructure/database/prisma-daily-reward-store.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { PrismaPlayerElementStore } from '../src/infrastructure/database/prisma-player-element-store.js';
import { ChoosePlayerElement } from '../src/application/player/choose-player-element.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for database daily reward tests.');
const database = createDatabase(config.databaseUrl);
afterAll(async () => database.$disconnect());

describe('daily reward transaction on the development database', () => {
  it('credits exactly once under concurrency and becomes available without catch-up next day', async () => {
    const subject = `test-daily-${randomUUID()}`;
    const identity = { subject };
    const playerStore = new PrismaCurrentPlayerStore(database);
    const getPlayer = new GetCurrentPlayer(playerStore);
    const provision = new GetOrProvisionCurrentPlayer(playerStore);
    let now = new Date('2026-09-05T12:00:00Z');
    const clock = { now: () => now };
    const store = new PrismaDailyRewardStore(database);
    const today = new GetTodayDailyReward(getPlayer, store, clock);
    const claim = new ClaimDailyReward(getPlayer, store, clock);
    let playerId: string | undefined;
    try {
      playerId = (await provision.execute(identity, `Daily ${randomUUID().slice(0, 8)}`)).player.id;
      await new ChoosePlayerElement(getPlayer, new PrismaPlayerElementStore(database)).execute(identity, 'cryo');
      await expect(today.execute(identity)).resolves.toMatchObject({ claimed: false });
      const concurrent = await Promise.all([claim.execute(identity), claim.execute(identity)]);
      expect(concurrent.filter((result) => !result.alreadyClaimed)).toHaveLength(1);
      expect(concurrent.filter((result) => result.alreadyClaimed)).toHaveLength(1);
      const [balances, movements, stats, operations] = await Promise.all([
        database.playerResourceBalance.findMany({ where: { playerId } }), database.resourceMovement.findMany({ where: { playerId } }),
        database.playerEconomyStats.findUniqueOrThrow({ where: { playerId } }), database.businessOperation.findMany({ where: { playerId } }),
      ]);
      expect(Object.fromEntries(balances.map((row) => [row.resourceKey, row.amount]))).toMatchObject({ primogems: 160n, particles_cryo: 160n, moras: 10_000n });
      expect(movements).toHaveLength(3);
      expect(movements.map(({ resourceKey, delta, causeKey }) => ({ resourceKey, delta, causeKey }))).toEqual(expect.arrayContaining([
        { resourceKey: 'primogems', delta: 160n, causeKey: 'daily-reward.claim' }, { resourceKey: 'particles_cryo', delta: 160n, causeKey: 'daily-reward.claim' }, { resourceKey: 'moras', delta: 10_000n, causeKey: 'daily-reward.claim' },
      ]));
      expect(stats).toMatchObject({ totalPrimosEarned: 160n, totalMorasEarned: 10_000n, totalMainElementParticlesEarned: 160n });
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({ operationType: 'daily-reward.claim', sourceChannel: 'UI', status: 'COMPLETED' });
      now = new Date('2026-09-07T12:00:00Z');
      await expect(today.execute(identity)).resolves.toMatchObject({ claimed: false, businessDate: '2026-09-07' });
      await claim.execute(identity);
      expect(await database.businessOperation.count({ where: { playerId } })).toBe(2);
      expect(await database.resourceMovement.count({ where: { playerId } })).toBe(6);
    } finally {
      if (playerId) await database.$transaction([
        database.playerDailyRewardState.deleteMany({ where: { playerId } }), database.resourceMovement.deleteMany({ where: { playerId } }), database.businessOperation.deleteMany({ where: { playerId } }),
        database.playerResourceBalance.deleteMany({ where: { playerId } }), database.playerEconomyStats.deleteMany({ where: { playerId } }), database.playerWheelStats.deleteMany({ where: { playerId } }), database.webIdentity.deleteMany({ where: { playerId } }), database.player.deleteMany({ where: { id: playerId } }),
      ]);
    }
  });
});
