import { isDeepStrictEqual } from 'node:util';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { chatLength, chatLine, chatResponseLimit } from '../chat/chat-list-result.js';
import { twitchResponseEntries } from '../twitch/twitch-response-format.js';
import { businessDateToDatabaseDate, getBusinessDate } from '../../domain/time/business-date.js';
import { lockPlayerMutationState } from '../player/player-mutation-guard.js';
import { reconcileEventMessageAggregate } from '../notification/event-message-notifications.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';

export type EventMessageBinding = { messageId: string; responseIndexes: number[] };
type ResponseProof = { status: string; messageId?: string; fullText?: string };

/** Only Event free text is split here, before the final transport gate. Each
 * segment keeps its sender/recipient context and its durable message binding. */
export function eventMessageParts(recipient: string, sender: string, content: string, limit = chatResponseLimit()): string[] {
  let remaining = Array.from(chatLine(content));
  const parts: string[] = [];
  while (remaining.length) {
    const prefix = `🎁 ${recipient}, message de ${sender}${parts.length ? ' (suite)' : ''} : `;
    const capacity = limit - chatLength(prefix);
    if (capacity < 1) throw new Error('EVENT_MESSAGE_PREFIX_TOO_LONG');
    const chunk = remaining.slice(0, capacity).join('');
    parts.push(prefix + chunk);
    remaining = remaining.slice(capacity);
  }
  return parts;
}

/** IDs/indices come from the Event owner, never from parsing announcement text. */
export async function bindEventMessageResponses(tx: Prisma.TransactionClient, playerId: string, key: string, output: readonly string[], bodyLimit?: number): Promise<EventMessageBinding[]> {
  const complete = await tx.businessOperation.findFirst({ where: { playerId, sourceChannel: 'TWITCH', operationType: 'twitch.message.complete', idempotencyKey: `message-complete:${key}`, status: 'COMPLETED' } });
  const summary = record(complete?.resultSummary);
  if (!summary || !isDeepStrictEqual(summary.responses, output) || !Array.isArray(summary.eventMessageBindings)) return [];
  let offset = 0;
  const offsets = output.map(text => { const at = offset; offset += twitchResponseEntries([text], bodyLimit).length; return at; });
  const entries = twitchResponseEntries(output, bodyLimit);
  const bindings = summary.eventMessageBindings as unknown as EventMessageBinding[];
  return bindings.filter(binding => binding && typeof binding.messageId === 'string' && Array.isArray(binding.responseIndexes) && binding.responseIndexes.length > 0 && binding.responseIndexes.every(index => Number.isInteger(index) && index >= 0 && index < output.length && twitchResponseEntries([output[index]!], bodyLimit).length === 1 && entries[offsets[index]!]?.fullText === undefined))
    .map(binding => ({ messageId: binding.messageId, responseIndexes: binding.responseIndexes.map(index => offsets[index]!) }));
}

/** Called in the same transaction that durably acknowledges SENT. Any partial,
 * uncertain, interrupted or fallback-only response leaves the message unread. */
export async function confirmEventMessageDeliveries(tx: Prisma.TransactionClient, playerId: string, bindings: readonly EventMessageBinding[], responses: readonly ResponseProof[], now: Date): Promise<number> {
  const ids = bindings.filter(binding => binding.responseIndexes.length > 0 && binding.responseIndexes.every(index => Number.isInteger(index) && index >= 0 && responses[index]?.status === 'SENT' && Boolean(responses[index]?.messageId) && responses[index]?.fullText === undefined)).map(binding => binding.messageId);
  return markMessagesViewed(tx, playerId, ids, now);
}

async function markMessagesViewed(tx: Prisma.TransactionClient, playerId: string, ids: readonly string[], now: Date) {
  if (!ids.length || !await lockPlayerMutationState(tx, playerId)) return 0;
  const changed = await tx.eventSocialMessage.updateMany({ where: { id: { in: [...new Set(ids)] }, recipientPlayerId: playerId, viewedAt: null }, data: { viewedAt: now } });
  if (changed.count) {
    const day = getBusinessDate(now);
    const pending = await tx.eventSocialMessage.findFirst({ where: { recipientPlayerId: playerId, businessDate: businessDateToDatabaseDate(day), viewedAt: null }, select: { eventEditionId: true } });
    await reconcileEventMessageAggregate(tx, playerId, pending?.eventEditionId ?? null, day, now);
  }
  return changed.count;
}

/** Conservative same-day compatibility for old receipts without per-segment IDs.
 * Every response of the canonical, completed activity must be SENT, untruncated
 * and identical to its persisted output. Receipt key + plan IDs join the owners;
 * no substring matching, guessed segment or merely prepared delivery is enough. */
export async function reconcileConfirmedEventMessages(db: PrismaClient, playerId: string, now: Date): Promise<number> {
  // Most normal chatters have no unread Event message. Avoid a transaction and
  // Player lock on that hot path; a concurrent arrival will be handled normally.
  const day = businessDateToDatabaseDate(getBusinessDate(now));
  if (!await db.eventSocialMessage.findFirst({ where: { recipientPlayerId: playerId, businessDate: day, viewedAt: null }, select: { id: true } })) return 0;
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async tx => {
        if (!await lockPlayerMutationState(tx, playerId)) return 0;
        const messages = await tx.eventSocialMessage.findMany({ where: { recipientPlayerId: playerId, businessDate: day, viewedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 100, select: { id: true } });
        if (!messages.length) return 0;
        const deliveries = await tx.businessOperation.findMany({ where: { playerId, sourceChannel: 'TWITCH', operationType: 'event.message.delivery', status: 'COMPLETED', idempotencyKey: { in: messages.map(message => `event-message-delivery:${message.id}`) } }, select: { idempotencyKey: true, resultSummary: true } });
        const confirmed: string[] = [];
        for (const delivery of deliveries) {
          const proof = record(delivery.resultSummary), key = proof?.receiptKey, messageId = proof?.messageId;
          if (typeof key !== 'string' || typeof messageId !== 'string' || delivery.idempotencyKey !== `event-message-delivery:${messageId}` || !messages.some(message => message.id === messageId)) continue;
          const complete = await tx.businessOperation.findFirst({ where: { playerId, sourceChannel: 'TWITCH', operationType: 'twitch.message.complete', status: 'COMPLETED', idempotencyKey: `message-complete:${key}` } });
          const presence = await tx.businessOperation.findFirst({ where: { playerId, sourceChannel: 'TWITCH', operationType: 'event.presence.delivery', status: 'COMPLETED', idempotencyKey: `event-presence:${key}` } });
          if (!complete || !presence) continue;
          const announced = record(presence.resultSummary)?.responses;
          if (!Array.isArray(announced) || !announced.length || !announced.every(text => typeof text === 'string')) continue;
          const receipts = await tx.twitchEventReceipt.findMany({ where: { eventType: 'channel.chat.message', state: 'PROCESSED', externalReference: `command-pilot:${key}` }, take: 2, select: { payloadMinimal: true } });
          if (receipts.length !== 1) continue;
          const minimal = record(receipts[0]!.payloadMinimal), execution = record(minimal?.commandPilot), activity = record(minimal?.messageActivity), plan = record(activity?.plan), event = record(plan?.event);
          if (execution?.playerId !== playerId || execution.handler !== 'message' || execution.commandKey !== key || execution.stage !== 'RESPONSES' || !Array.isArray(event?.messageIds) || !event.messageIds.includes(messageId)) continue;
          const summary = record(complete.resultSummary);
          if (!Array.isArray(summary?.responses) || !summary.responses.every(text => typeof text === 'string') || !Array.isArray(execution.responses) || !execution.responses.length) continue;
          // The prepared Event owner's whole output must actually be present in
          // the completed activity. Join by IDs above; compare complete atoms
          // here, never infer a message from a substring of announcement text.
          const completedResponses = summary.responses as string[];
          if (!completedResponses.some((_text, index) => isDeepStrictEqual(completedResponses.slice(index, index + announced.length), announced))) continue;
          const expected = twitchResponseEntries(completedResponses, typeof execution.responseBodyLimit === 'number' ? execution.responseBodyLimit : undefined);
          const sent = execution.responses.map(record);
          if (expected.length !== sent.length || !sent.every((response, index) => response?.status === 'SENT' && typeof response.messageId === 'string' && response.messageId.length > 0 && response.fullText === undefined && expected[index]?.fullText === undefined && response.text === expected[index]?.text)) continue;
          confirmed.push(messageId);
        }
        return markMessagesViewed(tx, playerId, confirmed, now);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
    } catch (error) { if (attempt < 4 && isPrismaConcurrencyCollision(error)) continue; throw error; }
  }
}

function record(value: unknown): Record<string, Prisma.JsonValue> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : null;
}
