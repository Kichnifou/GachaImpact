import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { elementKeys, isElementKey, particleResourceKey } from '../../domain/economy/resources.js';
import { PrismaEconomyService } from '../../infrastructure/database/prisma-economy-service.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { matchGiftSupremeTarget } from './gift-supreme-matching.js';

export const GIFT_SUPREME_EVENT_TYPE = 'channel.channel_points_custom_reward_redemption.add';
const identifier = z.string().trim().min(1).max(128);
export const giftSupremeInput = z.object({
  redemptionId: identifier, rewardId: identifier, gifterTwitchUserId: z.string().regex(/^\d+$/),
  gifterLogin: z.string().min(1).max(100).optional(), gifterDisplayName: z.string().min(1).max(100).optional(),
  userInput: z.string().max(500), redeemedAt: z.iso.datetime({ offset: true }),
}).strict();
export type GiftSupremeInput = z.infer<typeof giftSupremeInput>;
const cancelReason = z.enum(['EMPTY_INPUT', 'TARGET_NOT_FOUND', 'TARGET_AMBIGUOUS', 'TARGET_INACTIVE', 'TARGET_ELEMENT_MISSING']);
const resultSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('FULFILL'), targetPlayerId: z.uuid(), targetDisplayName: z.string(), elementKey: z.enum(elementKeys),
    creditedParticles: z.literal('1600'), balanceAfterParticles: z.string().regex(/^\d+$/), operationId: z.uuid(), notificationId: z.uuid() }),
  z.object({ action: z.literal('CANCEL'), reason: cancelReason }),
]);
export type GiftSupremeResult = z.infer<typeof resultSchema>;
export class GiftSupremeIdempotencyConflict extends Error {
  readonly code = 'GIFT_SUPREME_IDEMPOTENCY_CONFLICT';
  constructor() { super('Conflicting Gift Suprême redemption proof.'); }
}

/** Internal authenticated-adapter boundary only. Not wired to any browser route or runtime. */
export class GiftSupremeService {
  constructor(private readonly database: PrismaClient, private readonly clock: Clock, private readonly giftSupremeRewardId: string,
    private readonly economy = new PrismaEconomyService(() => clock.now())) {
    this.giftSupremeRewardId = identifier.parse(giftSupremeRewardId);
  }

  async process(value: GiftSupremeInput): Promise<GiftSupremeResult | { action: 'IGNORE'; reason: 'OTHER_REWARD' }> {
    const input = giftSupremeInput.parse(value), key = `gift-supreme:${input.redemptionId}`;
    const proof = { redemptionId: input.redemptionId, rewardId: input.rewardId, gifterTwitchUserId: input.gifterTwitchUserId,
      redeemedAt: new Date(input.redeemedAt).toISOString(), inputHash: createHash('sha256').update(input.userInput).digest('hex') };
    const hash = createHash('sha256').update(JSON.stringify(proof)).digest('hex');
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.database.$transaction(async tx => {
          const existing = await tx.twitchEventReceipt.findUnique({ where: { externalEventId: key } });
          if (existing && (existing.eventType !== GIFT_SUPREME_EVENT_TYPE || existing.payloadHash !== hash)) throw new GiftSupremeIdempotencyConflict();
          if (!existing && input.rewardId !== this.giftSupremeRewardId) return { action: 'IGNORE' as const, reason: 'OTHER_REWARD' as const };
          const receipt = existing ?? await tx.twitchEventReceipt.create({ data: { externalEventId: key,
            eventType: GIFT_SUPREME_EVENT_TYPE, twitchUserId: input.gifterTwitchUserId, payloadHash: hash, payloadMinimal: { proof } } });
          await tx.$queryRaw`SELECT id FROM twitch_event_receipts WHERE id = ${receipt.id}::uuid FOR NO KEY UPDATE`;
          const current = await tx.twitchEventReceipt.findUniqueOrThrow({ where: { id: receipt.id } });
          if (current.state === 'PROCESSED') {
            const journal = z.object({ result: resultSchema }).parse(current.payloadMinimal);
            return journal.result;
          }
          if (input.rewardId !== this.giftSupremeRewardId) return { action: 'IGNORE' as const, reason: 'OTHER_REWARD' as const };
          if (current.state !== 'RECEIVED') throw new Error('Invalid Gift Suprême receipt state.');
          const now = this.clock.now();
          const finalize = async (result: GiftSupremeResult, targetPlayerId: string | null = null) => {
            await tx.twitchEventReceipt.update({ where: { id: receipt.id }, data: { state: 'PROCESSED', processedAt: now,
              externalReference: result.action === 'FULFILL' ? `gift-supreme:operation:${result.operationId}` : `gift-supreme:invalid:${result.reason}`,
              errorMessage: result.action === 'CANCEL' ? result.reason : null,
              payloadMinimal: { proof, gifterDisplayName: input.gifterDisplayName ?? input.gifterLogin ?? input.gifterTwitchUserId,
                targetPlayerId, localOutcome: result.action === 'FULFILL' ? 'SUCCESS' : 'INVALID', result } } });
            return result;
          };
          const players = await tx.player.findMany({ select: { id: true, displayName: true, status: true, elementKey: true } });
          // Explicitly naming an ineligible account must not fall through to a fuzzy neighbour.
          const direct = matchGiftSupremeTarget(input.userInput, players, false);
          const eligible = players.filter(player => player.status === 'ACTIVE' && player.elementKey && isElementKey(player.elementKey));
          const matched = direct.status === 'MATCH' || direct.reason !== 'TARGET_NOT_FOUND' ? direct : matchGiftSupremeTarget(input.userInput, eligible);
          if (matched.status === 'INVALID') return finalize({ action: 'CANCEL', reason: matched.reason });
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${matched.target.id}::uuid FOR UPDATE`;
          const target = await tx.player.findUnique({ where: { id: matched.target.id }, select: { id: true, displayName: true, status: true, elementKey: true } });
          if (!target || target.status !== 'ACTIVE') return finalize({ action: 'CANCEL', reason: 'TARGET_INACTIVE' }, matched.target.id);
          if (!target.elementKey || !isElementKey(target.elementKey)) return finalize({ action: 'CANCEL', reason: 'TARGET_ELEMENT_MISSING' }, target.id);
          const operation = await tx.businessOperation.create({ data: { playerId: target.id, operationType: 'gift-supreme.redeem',
            sourceChannel: 'TWITCH', idempotencyKey: key, startedAt: now } });
          await this.economy.credit(tx, { playerId: target.id, playerElementKey: target.elementKey, resourceKey: particleResourceKey(target.elementKey),
            amount: 1600n, causeKey: 'gift-supreme', domainKey: 'gift-supreme', sourceChannel: 'TWITCH', operationId: operation.id,
            // Passive beneficiary credit: no standalone mission catch-up or extra reward.
            skipPermanentMissions: true });
          const balance = await tx.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: {
            playerId: target.id, resourceKey: particleResourceKey(target.elementKey) } }, select: { amount: true } });
          const gifter = input.gifterDisplayName ?? input.gifterLogin ?? input.gifterTwitchUserId;
          const element = target.elementKey[0]!.toUpperCase() + target.elementKey.slice(1);
          const notification = await tx.notification.create({ data: { playerId: target.id, domainKey: 'gift-supreme', typeKey: 'GIFT_SUPREME_RECEIVED',
            deduplicationKey: key, payload: { title: '🎁 Gift Suprême reçu', message: `${gifter} t'a offert +1 600 particules ${element}.`,
              gifterDisplayName: gifter, elementKey: target.elementKey, creditedParticles: '1600' }, createdAt: now } });
          const result: GiftSupremeResult = { action: 'FULFILL', targetPlayerId: target.id, targetDisplayName: target.displayName,
            elementKey: target.elementKey, creditedParticles: '1600', balanceAfterParticles: balance.amount.toString(),
            operationId: operation.id, notificationId: notification.id };
          await tx.businessOperation.update({ where: { id: operation.id }, data: { status: 'COMPLETED', completedAt: now,
            resultSummary: { proof, receiptId: receipt.id, result } } });
          return finalize(result, target.id);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 30_000 });
      } catch (error) { if (attempt < 5 && isPrismaConcurrencyCollision(error)) continue; throw error; }
    }
  }
}
