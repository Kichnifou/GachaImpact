import {
  OperationStatus,
  Prisma,
  SourceChannel,
  type PlayerWheelDailyState,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import { BusinessError } from '../../application/errors.js';
import type { WheelStore, WheelStoreInput } from '../../application/wheel/wheel-store.js';
import { isElementKey, isResourceKey } from '../../domain/economy/resources.js';
import {
  businessDateToDatabaseDate,
  databaseDateToBusinessDate,
} from '../../domain/time/business-date.js';
import {
  getWheelStatsIncrement,
  type WheelResultType,
  type WheelSpinResult,
} from '../../domain/wheel/wheel.js';
import { PrismaEconomyService } from './prisma-economy-service.js';

const MAX_SPIN_ATTEMPTS = 2;
const resultTypes = ['nothing', 'particles', 'moras', 'primogems'] as const;

type LockedPlayer = Readonly<{ elementKey: string | null }>;

export class PrismaWheelStore implements WheelStore {
  public constructor(
    private readonly database: PrismaClient,
    private readonly economy = new PrismaEconomyService(),
  ) {}

  public async spin(input: WheelStoreInput): Promise<WheelSpinResult> {
    for (let attempt = 1; attempt <= MAX_SPIN_ATTEMPTS; attempt += 1) {
      try {
        return await this.spinInTransaction(input);
      } catch (error) {
        if (!this.isConcurrencyCollision(error)) {
          throw error;
        }

        const persistedResult = await this.findPersistedResult(
          input.playerId,
          input.businessDate,
        );

        if (persistedResult) {
          return { ...persistedResult, alreadySpun: true };
        }

        if (attempt === MAX_SPIN_ATTEMPTS) {
          throw error;
        }
      }
    }

    throw new Error('Wheel spin exhausted all retry attempts.');
  }

  private async spinInTransaction(input: WheelStoreInput): Promise<WheelSpinResult> {
    return this.database.$transaction(async (transaction) => {
      const players = await transaction.$queryRaw<LockedPlayer[]>`
        SELECT element_key AS "elementKey"
        FROM players
        WHERE id = ${input.playerId}::uuid
        FOR UPDATE
      `;
      const player = players[0];

      if (!player) {
        throw new BusinessError('PLAYER_NOT_FOUND', 'No Player is linked to this account.');
      }

      if (!player.elementKey || !isElementKey(player.elementKey)) {
        throw new BusinessError(
          'PLAYER_ELEMENT_REQUIRED',
          'A permanent element must be chosen before spinning the Wheel.',
        );
      }

      const databaseBusinessDate = businessDateToDatabaseDate(input.businessDate);
      const existing = await transaction.playerWheelDailyState.findUnique({
        where: {
          playerId_businessDate: {
            playerId: input.playerId,
            businessDate: databaseBusinessDate,
          },
        },
      });

      if (existing) {
        return { ...this.toResult(existing), alreadySpun: true };
      }

      const reward = input.roll();
      const operation = await transaction.businessOperation.create({
        data: {
          playerId: input.playerId,
          operationType: 'wheel.spin',
          sourceChannel: SourceChannel.UI,
          idempotencyKey: `wheel:${input.playerId}:${input.businessDate}`,
        },
        select: { id: true },
      });

      if (reward.resourceKey && reward.amount) {
        await this.economy.credit(transaction, {
          playerId: input.playerId,
          playerElementKey: player.elementKey,
          resourceKey: reward.resourceKey,
          amount: reward.amount,
          causeKey: 'wheel.reward',
          domainKey: 'wheel',
          operationId: operation.id,
          sourceChannel: SourceChannel.UI,
        });
      }

      const wheelStatsIncrement = getWheelStatsIncrement(reward);

      await transaction.playerWheelStats.update({
        where: { playerId: input.playerId },
        data: {
          totalSpins: { increment: wheelStatsIncrement.totalSpins },
          totalJackpots: { increment: wheelStatsIncrement.totalJackpots },
        },
      });

      const dailyState = await transaction.playerWheelDailyState.create({
        data: {
          playerId: input.playerId,
          businessDate: databaseBusinessDate,
          spunAt: input.spunAt,
          resultKnown: true,
          resultType: reward.resultType,
          resourceKey: reward.resourceKey,
          amount: reward.amount,
          operationId: operation.id,
        },
      });

      await transaction.businessOperation.update({
        where: { id: operation.id },
        data: {
          status: OperationStatus.COMPLETED,
          completedAt: input.spunAt,
          resultSummary: {
            businessDate: input.businessDate,
            resultType: reward.resultType,
            resourceKey: reward.resourceKey,
            amount: reward.amount?.toString() ?? null,
          },
        },
      });

      return { ...this.toResult(dailyState), alreadySpun: false };
    });
  }

  private async findPersistedResult(playerId: string, businessDate: string) {
    const state = await this.database.playerWheelDailyState.findUnique({
      where: {
        playerId_businessDate: {
          playerId,
          businessDate: businessDateToDatabaseDate(businessDate),
        },
      },
    });

    return state ? this.toResult(state) : null;
  }

  private toResult(state: PlayerWheelDailyState): Omit<WheelSpinResult, 'alreadySpun'> {
    if (!state.resultKnown || !this.isResultType(state.resultType)) {
      throw new Error('The persisted native Wheel result is incomplete.');
    }

    if (state.resourceKey !== null && !isResourceKey(state.resourceKey)) {
      throw new Error('The persisted Wheel resource key is invalid.');
    }

    return {
      businessDate: databaseDateToBusinessDate(state.businessDate),
      resultType: state.resultType,
      resourceKey: state.resourceKey,
      amount: state.amount,
    };
  }

  private isResultType(value: string | null): value is WheelResultType {
    return value !== null && (resultTypes as readonly string[]).includes(value);
  }

  private isConcurrencyCollision(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    );
  }
}
