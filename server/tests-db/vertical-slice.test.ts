import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { ChoosePlayerElement } from '../src/application/player/choose-player-element.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetCurrentPlayerResources } from '../src/application/player/get-current-player-resources.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { SpinDailyWheel } from '../src/application/wheel/spin-daily-wheel.js';
import { loadConfig } from '../src/config/environment.js';
import type { Clock } from '../src/domain/time/business-date.js';
import type { RandomSource } from '../src/domain/wheel/wheel.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { PrismaPlayerElementStore } from '../src/infrastructure/database/prisma-player-element-store.js';
import { PrismaPlayerResourceStore } from '../src/infrastructure/database/prisma-player-resource-store.js';
import { PrismaWheelStore } from '../src/infrastructure/database/prisma-wheel-store.js';

const config = loadConfig();

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required for database vertical-slice tests.');
}

const database = createDatabase(config.databaseUrl);

class FixedClock implements Clock {
  public now(): Date {
    return new Date('2026-09-04T12:00:00.000Z');
  }
}

class JackpotRandom implements RandomSource {
  public readonly nextInt = vi.fn(() => 92);
}

afterAll(async () => {
  await database.$disconnect();
});

describe('authenticated Player vertical slice on the development database', () => {
  it('persists one deterministic Wheel reward under repeated and concurrent calls', async () => {
    const subject = `test-vertical-slice-${randomUUID()}`;
    const displayName = `Vertical Slice ${randomUUID().slice(0, 8)}`;
    const identity = { subject };
    const currentPlayerStore = new PrismaCurrentPlayerStore(database);
    const getCurrentPlayer = new GetCurrentPlayer(currentPlayerStore);
    const provision = new GetOrProvisionCurrentPlayer(currentPlayerStore);
    const chooseElement = new ChoosePlayerElement(
      getCurrentPlayer,
      new PrismaPlayerElementStore(database),
    );
    const getResources = new GetCurrentPlayerResources(
      getCurrentPlayer,
      new PrismaPlayerResourceStore(database),
    );
    const random = new JackpotRandom();
    const spinWheel = new SpinDailyWheel(
      getCurrentPlayer,
      new PrismaWheelStore(database),
      new FixedClock(),
      random,
    );
    let playerId: string | undefined;

    try {
      const provisioned = await provision.execute(identity, displayName);
      playerId = provisioned.player.id;

      expect(provisioned.created).toBe(true);
      expect(await getResources.execute(identity)).toSatisfy((balances) =>
        Object.values(balances).every((amount) => amount === 0n),
      );

      await expect(chooseElement.execute(identity, 'hydro')).resolves.toEqual({
        elementKey: 'hydro',
        alreadySelected: false,
      });
      await expect(chooseElement.execute(identity, 'hydro')).resolves.toEqual({
        elementKey: 'hydro',
        alreadySelected: true,
      });
      await expect(chooseElement.execute(identity, 'pyro')).rejects.toMatchObject({
        code: 'ELEMENT_ALREADY_CHOSEN',
      });

      const concurrent = await Promise.all([spinWheel.execute(identity), spinWheel.execute(identity)]);
      const firstResult = concurrent.find(({ alreadySpun }) => !alreadySpun);
      const repeatedResult = concurrent.find(({ alreadySpun }) => alreadySpun);

      expect(firstResult).toEqual({
        businessDate: '2026-09-04',
        resultType: 'primogems',
        resourceKey: 'primogems',
        amount: 1_600n,
        alreadySpun: false,
      });
      expect(repeatedResult).toEqual({ ...firstResult, alreadySpun: true });
      expect(random.nextInt).toHaveBeenCalledTimes(1);

      await expect(spinWheel.execute(identity)).resolves.toEqual(repeatedResult);
      expect(random.nextInt).toHaveBeenCalledTimes(1);

      const [dailyStates, operations, movements, wheelStats, economyStats, balances] =
        await Promise.all([
          database.playerWheelDailyState.findMany({ where: { playerId } }),
          database.businessOperation.findMany({ where: { playerId } }),
          database.resourceMovement.findMany({ where: { playerId } }),
          database.playerWheelStats.findUniqueOrThrow({ where: { playerId } }),
          database.playerEconomyStats.findUniqueOrThrow({ where: { playerId } }),
          database.playerResourceBalance.findMany({
            where: { playerId },
            orderBy: { resourceKey: 'asc' },
          }),
        ]);

      expect(dailyStates).toHaveLength(1);
      expect(dailyStates[0]).toMatchObject({
        resultKnown: true,
        resultType: 'primogems',
        resourceKey: 'primogems',
        amount: 1_600n,
      });
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        operationType: 'wheel.spin',
        sourceChannel: 'UI',
        status: 'COMPLETED',
      });
      expect(movements).toHaveLength(1);
      expect(movements[0]).toMatchObject({
        resourceKey: 'primogems',
        delta: 1_600n,
        balanceBefore: 0n,
        balanceAfter: 1_600n,
        causeKey: 'wheel.reward',
        domainKey: 'wheel',
      });
      expect(wheelStats).toMatchObject({ totalSpins: 1n, totalJackpots: 1n });
      expect(economyStats).toMatchObject({
        totalPrimosEarned: 1_600n,
        totalMorasEarned: 0n,
        totalMainElementParticlesEarned: 0n,
      });
      expect(balances.find(({ resourceKey }) => resourceKey === 'primogems')?.amount).toBe(1_600n);
      expect(
        balances
          .filter(({ resourceKey }) => resourceKey !== 'primogems')
          .every(({ amount }) => amount === 0n),
      ).toBe(true);
    } finally {
      if (playerId) {
        await database.$transaction([
          database.playerWheelDailyState.deleteMany({ where: { playerId } }),
          database.resourceMovement.deleteMany({ where: { playerId } }),
          database.businessOperation.deleteMany({ where: { playerId } }),
          database.playerResourceBalance.deleteMany({ where: { playerId } }),
          database.playerEconomyStats.deleteMany({ where: { playerId } }),
          database.playerWheelStats.deleteMany({ where: { playerId } }),
          database.webIdentity.deleteMany({ where: { playerId } }),
          database.player.deleteMany({ where: { id: playerId } }),
        ]);
      }

      await expect(
        database.webIdentity.count({
          where: { provider: 'supabase', providerSubject: subject },
        }),
      ).resolves.toBe(0);
      await expect(database.player.count({ where: { displayName } })).resolves.toBe(0);
    }
  });
});
