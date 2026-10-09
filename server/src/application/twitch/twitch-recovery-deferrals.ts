import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Prisma, TwitchEventReceipt } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import { playerRecoverySchema, type PlayerRecovery } from '../player/player-recovery-readiness.js';
import { twitchSubscriptionProof, twitchSubscriptionGiftProof, twitchSubscriptionMessageProof } from './twitch-subscription-proof.js';
import { matchesTwitchObservationHash } from './twitch-event-observer.js';

type Tx = Prisma.TransactionClient;
export type RecoveryDeferredAddition = { playerId: string; recovery: PlayerRecovery };
export const recoveryDeferredSchema = z.object({ version: z.literal(1), kind: z.enum(['FAVOR', 'GIFT_SUPREME']),
  playerId: z.uuid(), recovery: playerRecoverySchema }).strict();
const identifier = z.string().min(1).max(128), twitchId = z.string().regex(/^[1-9][0-9]{0,127}$/);
const giftProof = z.object({ redemptionId: identifier, rewardId: identifier, gifterTwitchUserId: twitchId,
  redeemedAt: z.iso.datetime({ offset: true }), inputHash: z.string().regex(/^[0-9a-f]{64}$/) }).strict();
const giftDelivery = z.object({ redemptionId: identifier, rewardId: identifier, broadcasterId: twitchId }).strict();
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const recoveryDeferredError = () => new AppError('La reprise de ce profil est en cours. Cette attribution sera réessayée après sa remise en service.', 503, 'PLAYER_RECOVERY_NOT_ACTIVATED');

export function readRecoveryDeferred(receipt: Pick<TwitchEventReceipt, 'payloadMinimal'>) {
  const parsed = recoveryDeferredSchema.safeParse(object(receipt.payloadMinimal).recoveryDeferred);
  return parsed.success ? parsed.data : null;
}

export function checkedRecoveryDeferred(receipt: Pick<TwitchEventReceipt, 'payloadMinimal'>, kind: 'FAVOR' | 'GIFT_SUPREME') {
  const deferred = readRecoveryDeferred(receipt);
  if (Object.hasOwn(object(receipt.payloadMinimal), 'recoveryDeferred') && (!deferred || deferred.kind !== kind)) throw recoveryDeferredError();
  return deferred;
}

function untouched(receipt: TwitchEventReceipt) {
  const payload = object(receipt.payloadMinimal);
  return receipt.state === 'RECEIVED' && receipt.processedAt === null && receipt.externalReference === null
    && receipt.errorMessage === null && typeof receipt.payloadHash === 'string' && /^[0-9a-f]{64}$/.test(receipt.payloadHash)
    && !['commandPilot', 'messageActivity', 'result', 'remote', 'outbound'].some(key => Object.hasOwn(payload, key));
}

function favorProofValid(receipt: TwitchEventReceipt) {
  const payload = object(receipt.payloadMinimal);
  if (!matchesTwitchObservationHash(receipt) || !twitchId.safeParse(receipt.twitchUserId).success || payload.twitchUserId !== receipt.twitchUserId
    || payload.eventType !== receipt.eventType || payload.externalEventId !== receipt.externalEventId) return false;
  const fields = new Set(['externalEventId', 'eventType', 'twitchUserId', 'login', 'displayName', 'sourceTimestamp', 'contentHash',
    'transportPayloadHash', 'subscriptionProof', 'subscriptionGiftProof', 'subscriptionMessageProof', 'recoveryDeferred']);
  if (Object.keys(payload).some(key => !fields.has(key))) return false;
  if (receipt.eventType === 'channel.subscribe') return twitchSubscriptionProof.safeParse(payload.subscriptionProof).success
    && !Object.hasOwn(payload, 'subscriptionGiftProof') && !Object.hasOwn(payload, 'subscriptionMessageProof');
  if (receipt.eventType === 'channel.subscription.message') return twitchSubscriptionMessageProof.safeParse(payload.subscriptionMessageProof).success
    && !Object.hasOwn(payload, 'subscriptionProof') && !Object.hasOwn(payload, 'subscriptionGiftProof');
  const gift = twitchSubscriptionGiftProof.safeParse(payload.subscriptionGiftProof);
  return receipt.eventType === 'channel.subscription.gift' && gift.success && !gift.data.isAnonymous
    && !Object.hasOwn(payload, 'subscriptionProof') && !Object.hasOwn(payload, 'subscriptionMessageProof');
}

async function favorHasNoEffect(tx: Tx, receipt: TwitchEventReceipt) {
  const key = receipt.eventType === 'channel.subscription.gift' ? `favor:gifter:${receipt.externalEventId}`
    : `favor:grant:eventsub:${receipt.eventType}:${receipt.externalEventId}`;
  return await tx.favorGrant.count({ where: { twitchEventReceiptId: receipt.id } }) === 0
    && await tx.businessOperation.count({ where: { sourceChannel: 'TWITCH', OR: [{ idempotencyKey: key },
      { resultSummary: { path: ['twitchEventReceiptId'], equals: receipt.id } }] } }) === 0;
}

function coreGiftProof(receipt: TwitchEventReceipt) {
  if (receipt.eventType !== 'channel.channel_points_custom_reward_redemption.add') return null;
  const payload = object(receipt.payloadMinimal), parsed = giftProof.safeParse(payload.proof);
  if (!parsed.success || Object.keys(payload).some(key => !['proof', 'recoveryDeferred'].includes(key))
    || receipt.externalEventId !== `gift-supreme:${parsed.data.redemptionId}` || receipt.twitchUserId !== parsed.data.gifterTwitchUserId
    || createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex') !== receipt.payloadHash) return null;
  return parsed.data;
}

async function giftHasNoEffect(tx: Tx, core: TwitchEventReceipt) {
  return await tx.businessOperation.count({ where: { sourceChannel: 'TWITCH', idempotencyKey: core.externalEventId } }) === 0
    && await tx.notification.count({ where: { deduplicationKey: core.externalEventId } }) === 0;
}

function deliveryProof(receipt: TwitchEventReceipt) {
  if (receipt.eventType !== 'channel.channel_points_custom_reward_redemption.add' || receipt.externalEventId.startsWith('gift-supreme:')) return null;
  const { recoveryDeferred: _deferred, ...payload } = object(receipt.payloadMinimal);
  const parsed = giftDelivery.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/** Only authenticated wire receipts for this exact redemption may be completed. */
export function matchesRecoveryGiftDelivery(receipt: TwitchEventReceipt, input: {
  redemptionId: string; rewardId: string; broadcasterId: string; gifterTwitchUserId: string;
}, core: TwitchEventReceipt): boolean {
  const delivery = deliveryProof(receipt), deferred = readRecoveryDeferred(receipt);
  if (!delivery || !untouched(receipt) || receipt.twitchUserId !== input.gifterTwitchUserId
    || delivery.redemptionId !== input.redemptionId || delivery.rewardId !== input.rewardId || delivery.broadcasterId !== input.broadcasterId) return false;
  return !Object.hasOwn(object(receipt.payloadMinimal), 'recoveryDeferred')
    || deferred !== null && deferred.kind === 'GIFT_SUPREME' && isDeepStrictEqual(deferred, readRecoveryDeferred(core));
}

async function linkedCore(tx: Tx, receipt: TwitchEventReceipt) {
  const delivery = deliveryProof(receipt);
  if (!delivery) return null;
  const core = await tx.twitchEventReceipt.findUnique({ where: { externalEventId: `gift-supreme:${delivery.redemptionId}` } });
  const proof = core && coreGiftProof(core);
  return core && proof && untouched(core) && receipt.twitchUserId === proof.gifterTwitchUserId && delivery.rewardId === proof.rewardId ? core : null;
}

/** Caller owns the sorted Player locks. No receipt lock is acquired in the inverse order.
 * Only a new addition with the exact current provenance can justify this exception.
 * receiptSafety itself remains conservative for every other caller. */
export async function isRecoveryDeferredReceipt(tx: Tx, receipt: TwitchEventReceipt, additions: readonly RecoveryDeferredAddition[]): Promise<boolean> {
  if (!untouched(receipt)) return false;
  const direct = readRecoveryDeferred(receipt), core = coreGiftProof(receipt) ? receipt : await linkedCore(tx, receipt);
  const deferred = direct ?? (core && readRecoveryDeferred(core));
  if (!deferred || Object.hasOwn(object(receipt.payloadMinimal), 'recoveryDeferred') && !direct) return false;
  const addition = additions.find(row => row.playerId === deferred.playerId);
  if (!addition || !isDeepStrictEqual(deferred.recovery, addition.recovery)) return false;
  const player = await tx.player.findUnique({ where: { id: deferred.playerId }, select: { status: true, legacyRecovery: true, twitchIdentity: { select: { twitchUserId: true } } } });
  if (!player || player.status !== 'ACTIVE' || !isDeepStrictEqual(player.legacyRecovery, addition.recovery) || !player.twitchIdentity) return false;
  const target = await tx.twitchNativeTarget.findUnique({ where: { twitchUserId: player.twitchIdentity.twitchUserId } });
  if (!target || target.playerId !== addition.playerId || target.canary || target.dataAuthority !== 'LEGACY') return false;
  if (deferred.kind === 'FAVOR') return direct !== null && receipt.twitchUserId === player.twitchIdentity.twitchUserId
    && favorProofValid(receipt) && await favorHasNoEffect(tx, receipt);
  if (!core || !isDeepStrictEqual(readRecoveryDeferred(core), deferred) || !await giftHasNoEffect(tx, core)) return false;
  return direct === null || isDeepStrictEqual(direct, readRecoveryDeferred(core));
}

/** Trusted owners call this after proof validation and the Player lock, before
 * eligibility, claims or payments. True is committed before sending retryable 503. */
export async function deferRecoveryReceipt(tx: Tx, receiptId: string, playerId: string, kind: 'FAVOR' | 'GIFT_SUPREME'): Promise<boolean> {
  const receipt = await tx.twitchEventReceipt.findUniqueOrThrow({ where: { id: receiptId } });
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { status: true, legacyRecovery: true, twitchIdentity: { select: { twitchUserId: true } } } });
  const previous = readRecoveryDeferred(receipt), hasPrevious = Object.hasOwn(object(receipt.payloadMinimal), 'recoveryDeferred');
  if (player.legacyRecovery === null) { if (hasPrevious) throw recoveryDeferredError(); return false; }
  const recovery = playerRecoverySchema.parse(player.legacyRecovery);
  const deferred = recoveryDeferredSchema.parse({ version: 1, kind, playerId, recovery });
  if (hasPrevious && !isDeepStrictEqual(previous, deferred)) throw recoveryDeferredError();
  if (hasPrevious && (!untouched(receipt) || (kind === 'FAVOR'
    ? receipt.twitchUserId !== player.twitchIdentity?.twitchUserId || !favorProofValid(receipt) || !await favorHasNoEffect(tx, receipt)
    : !coreGiftProof(receipt) || !await giftHasNoEffect(tx, receipt)))) throw recoveryDeferredError();
  const target = player.twitchIdentity && await tx.twitchNativeTarget.findUnique({ where: { twitchUserId: player.twitchIdentity.twitchUserId } });
  if (target?.playerId === playerId && target.dataAuthority === 'NATIVE' && target.canary) return false;
  if (player.status !== 'ACTIVE' || !target || target.playerId !== playerId || target.dataAuthority !== 'LEGACY' || target.canary) throw recoveryDeferredError();
  const persist = async (row: TwitchEventReceipt) => {
    const payload = object(row.payloadMinimal), existing = readRecoveryDeferred(row);
    if (!untouched(row) || Object.hasOwn(payload, 'recoveryDeferred') && !isDeepStrictEqual(existing, deferred)) throw recoveryDeferredError();
    if (!existing) await tx.twitchEventReceipt.update({ where: { id: row.id }, data: { payloadMinimal: { ...payload, recoveryDeferred: deferred } as Prisma.InputJsonObject } });
  };
  if (kind === 'FAVOR') {
    if (receipt.twitchUserId !== player.twitchIdentity!.twitchUserId || !favorProofValid(receipt) || !await favorHasNoEffect(tx, receipt)) throw recoveryDeferredError();
    await persist(receipt);
  } else {
    const proof = coreGiftProof(receipt);
    if (!proof || !await giftHasNoEffect(tx, receipt)) throw recoveryDeferredError();
    const deliveries = await tx.twitchEventReceipt.findMany({ where: { eventType: receipt.eventType, state: 'RECEIVED',
      payloadMinimal: { path: ['redemptionId'], equals: proof.redemptionId } } });
    for (const delivery of deliveries) {
      const wire = deliveryProof(delivery);
      if (!wire || delivery.twitchUserId !== proof.gifterTwitchUserId || wire.rewardId !== proof.rewardId) throw recoveryDeferredError();
      await persist(delivery);
    }
    await persist(receipt);
  }
  return true;
}
