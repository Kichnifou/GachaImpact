import { createHash } from 'node:crypto';
import type { PrismaClient, TwitchEventReceipt } from '../../../generated/prisma/client.js';
import { TwitchReceiptRetention } from './twitch-receipt-retention.js';
import { twitchSubscriptionProof, twitchSubscriptionGiftProof, type TwitchSubscriptionProof, type TwitchSubscriptionGiftProof } from './twitch-subscription-proof.js';

/** Internal observation contract. A future transport must pass only a digest of message content, never raw chat text. */
export type TwitchObservedEvent = Readonly<{
  externalEventId: string;
  eventType: string;
  twitchUserId: string | null;
  login?: string | null;
  displayName?: string | null;
  sourceTimestamp?: string | null;
  contentHash?: string | null;
  transportPayloadHash?: string | null;
  subscriptionProof?: TwitchSubscriptionProof;
  subscriptionGiftProof?: TwitchSubscriptionGiftProof;
}>;

export class TwitchObservationConflict extends Error {
  readonly code = 'TWITCH_EVENT_CONFLICT';
  constructor() { super('Twitch event ID already has a different observation.'); }
}

function required(value: string, name: string, max: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(`Invalid ${name}.`);
  return normalized;
}

function optional(value: string | null | undefined, name: string, max: number): string | null {
  if (value == null) return null;
  return required(value, name, max);
}

function normalize(input: TwitchObservedEvent) {
  const sourceTimestamp = optional(input.sourceTimestamp, 'source timestamp', 64);
  const parsedTimestamp = sourceTimestamp ? new Date(sourceTimestamp) : null;
  if (sourceTimestamp && (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(sourceTimestamp) || Number.isNaN(parsedTimestamp!.getTime())))
    throw new Error('Invalid source timestamp.');
  const contentHash = optional(input.contentHash, 'content hash', 64);
  if (contentHash && !/^[0-9a-f]{64}$/i.test(contentHash)) throw new Error('Invalid content hash.');
  const transportPayloadHash = optional(input.transportPayloadHash, 'transport payload hash', 64);
  if (transportPayloadHash && !/^[0-9a-f]{64}$/i.test(transportPayloadHash)) throw new Error('Invalid transport payload hash.');
  if (input.subscriptionProof !== undefined && input.eventType !== 'channel.subscribe') throw new Error('Invalid subscription proof.');
  if (input.subscriptionGiftProof !== undefined && input.eventType !== 'channel.subscription.gift') throw new Error('Invalid gift proof.');
  const giftProof = input.subscriptionGiftProof === undefined ? undefined : twitchSubscriptionGiftProof.parse(input.subscriptionGiftProof);
  if (input.eventType === 'channel.subscription.gift' && !giftProof) throw new Error('Missing gift proof.');
  if (giftProof?.isAnonymous) {
    if (input.twitchUserId != null || input.login != null || input.displayName != null) throw new Error('Anonymous gift has an identity.');
  } else if (input.twitchUserId == null) throw new Error('Missing Twitch User ID.');
  if (giftProof && input.twitchUserId != null && !/^\d+$/.test(input.twitchUserId)) throw new Error('Invalid gifter User ID.');
  return {
    externalEventId: required(input.externalEventId, 'external event ID', 256),
    eventType: required(input.eventType, 'event type', 120),
    twitchUserId: input.twitchUserId == null ? null : required(input.twitchUserId, 'Twitch User ID', 128),
    login: optional(input.login, 'login', 64),
    displayName: optional(input.displayName, 'display name', 128),
    sourceTimestamp: parsedTimestamp?.toISOString() ?? null,
    contentHash: contentHash?.toLowerCase() ?? null,
    transportPayloadHash: transportPayloadHash?.toLowerCase() ?? null,
    // Omit this member for Chat: preserve the existing observation/hash contract.
    ...(input.subscriptionProof ? { subscriptionProof: twitchSubscriptionProof.parse(input.subscriptionProof) } : {}),
    ...(giftProof ? { subscriptionGiftProof: giftProof } : {}),
  };
}

export class TwitchEventObserver {
  constructor(private readonly db: PrismaClient, private readonly retention = new TwitchReceiptRetention(db)) {}

  async observeTwitchEvent(input: TwitchObservedEvent) {
    const event = normalize(input);
    const payloadHash = createHash('sha256').update(JSON.stringify(event)).digest('hex');
    const result = (receipt: TwitchEventReceipt, playerId: string | null, duplicate: boolean) => ({
      receipt, duplicate, playerId, identity: playerId ? 'resolved' as const : 'unresolved' as const,
    });
    const check = (receipt: TwitchEventReceipt, playerId: string | null) => {
      if (receipt.payloadHash !== payloadHash || receipt.eventType !== event.eventType || receipt.twitchUserId !== event.twitchUserId)
        throw new TwitchObservationConflict();
      return result(receipt, playerId, true);
    };
    const observe = () => this.db.$transaction(async tx => {
      const identity = event.twitchUserId == null ? null : await tx.twitchIdentity.findUnique({ where: { twitchUserId: event.twitchUserId }, select: { playerId: true } });
      const existing = await tx.twitchEventReceipt.findUnique({ where: { externalEventId: event.externalEventId } });
      if (existing) return check(existing, identity?.playerId ?? null);
      const receipt = await tx.twitchEventReceipt.create({ data: {
        externalEventId: event.externalEventId, eventType: event.eventType, twitchUserId: event.twitchUserId,
        payloadHash, payloadMinimal: event,
      } });
      return result(receipt, identity?.playerId ?? null, false);
    });
    let observed;
    try { observed = await observe(); }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) throw error;
      observed = await this.db.$transaction(async tx => {
        const receipt = await tx.twitchEventReceipt.findUnique({ where: { externalEventId: event.externalEventId } });
        if (!receipt) throw error;
        const identity = event.twitchUserId == null ? null : await tx.twitchIdentity.findUnique({ where: { twitchUserId: event.twitchUserId }, select: { playerId: true } });
        return check(receipt, identity?.playerId ?? null);
      });
    }
    if (event.eventType === 'channel.chat.message') this.retention.maybeCleanup();
    return observed;
  }
}
