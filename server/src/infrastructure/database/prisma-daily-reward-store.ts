import { OperationStatus, Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import type { DailyRewardClaimInput, DailyRewardStore } from '../../application/daily-reward/daily-reward-store.js';
import { BusinessError } from '../../application/errors.js';
import { DAILY_REWARDS, type DailyRewardClaimResult } from '../../domain/daily-reward/daily-reward.js';
import { isElementKey, particleResourceKey } from '../../domain/economy/resources.js';
import { businessDateToDatabaseDate, databaseDateToBusinessDate } from '../../domain/time/business-date.js';
import { PrismaEconomyService } from './prisma-economy-service.js';
import { isPrismaConcurrencyCollision } from './prisma-concurrency.js';

const MAX_CLAIM_ATTEMPTS = 2;
type LockedPlayer = Readonly<{ elementKey: string | null }>;

export class PrismaDailyRewardStore implements DailyRewardStore {
  public constructor(private readonly database: PrismaClient, private readonly economy = new PrismaEconomyService()) {}

  public async isClaimed(playerId: string, businessDate: string): Promise<boolean> {
    const state = await this.database.playerDailyRewardState.findUnique({ where: { playerId }, select: { lastClaimDate: true } });
    return state?.lastClaimDate ? databaseDateToBusinessDate(state.lastClaimDate) === businessDate : false;
  }

  public async claim(input: DailyRewardClaimInput): Promise<DailyRewardClaimResult> {
    for (let attempt = 1; attempt <= MAX_CLAIM_ATTEMPTS; attempt += 1) {
      try {
        return await this.claimInTransaction(input);
      } catch (error) {
        if (!isPrismaConcurrencyCollision(error)) throw error;
        if (await this.isClaimed(input.playerId, input.businessDate)) return this.result(input.businessDate, true);
        if (attempt === MAX_CLAIM_ATTEMPTS) throw error;
      }
    }
    throw new Error('Daily reward claim exhausted all retry attempts.');
  }

  private async claimInTransaction(input: DailyRewardClaimInput): Promise<DailyRewardClaimResult> {
    return this.database.$transaction(async (transaction) => {
      const players = await transaction.$queryRaw<LockedPlayer[]>`
        SELECT element_key AS "elementKey" FROM players WHERE id = ${input.playerId}::uuid FOR UPDATE
      `;
      const player = players[0];
      if (!player) throw new BusinessError('PLAYER_NOT_FOUND', 'No Player is linked to this account.');
      if (!player.elementKey || !isElementKey(player.elementKey) || player.elementKey !== input.playerElementKey) {
        throw new BusinessError('PLAYER_ELEMENT_REQUIRED', 'A permanent element is required to claim the daily reward.');
      }

      const state = await transaction.playerDailyRewardState.findUnique({ where: { playerId: input.playerId } });
      if (state?.lastClaimDate && databaseDateToBusinessDate(state.lastClaimDate) === input.businessDate) {
        return this.result(input.businessDate, true);
      }

      const operation = await transaction.businessOperation.create({ data: {
        playerId: input.playerId, operationType: 'daily-reward.claim', sourceChannel: SourceChannel.UI,
        idempotencyKey: `daily-reward:${input.playerId}:${input.businessDate}`,
      }, select: { id: true } });

      const credits = [
        ['primogems', DAILY_REWARDS.primogems],
        [particleResourceKey(player.elementKey), DAILY_REWARDS.mainElementParticles],
        ['moras', DAILY_REWARDS.moras],
      ] as const;
      for (const [resourceKey, amount] of credits) {
        await this.economy.credit(transaction, { playerId: input.playerId, playerElementKey: player.elementKey, resourceKey, amount, causeKey: 'daily-reward.claim', domainKey: 'daily-reward', operationId: operation.id, sourceChannel: SourceChannel.UI });
      }

      const databaseDate = businessDateToDatabaseDate(input.businessDate);
      await transaction.playerDailyRewardState.upsert({ where: { playerId: input.playerId }, create: {
        playerId: input.playerId, firstClaimDate: databaseDate, lastClaimDate: databaseDate, lastClaimedAt: input.claimedAt, lastOperationId: operation.id,
      }, update: {
        firstClaimDate: state?.firstClaimDate ?? databaseDate, lastClaimDate: databaseDate, lastClaimedAt: input.claimedAt, lastOperationId: operation.id,
      } });
      await transaction.businessOperation.update({ where: { id: operation.id }, data: {
        status: OperationStatus.COMPLETED, completedAt: input.claimedAt,
        resultSummary: { businessDate: input.businessDate, primogems: '160', mainElementParticles: '160', elementKey: player.elementKey, moras: '10000' },
      } });
      return this.result(input.businessDate, false);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private result(businessDate: string, alreadyClaimed: boolean): DailyRewardClaimResult {
    return { claimed: true, businessDate, rewards: DAILY_REWARDS, alreadyClaimed };
  }
}
