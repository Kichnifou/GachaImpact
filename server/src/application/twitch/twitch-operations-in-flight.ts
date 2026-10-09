import type { Prisma } from '../../../generated/prisma/client.js';

type Receipt = Pick<Prisma.TwitchEventReceiptGetPayload<Record<string, never>>,
  'eventType' | 'state' | 'processedAt' | 'externalReference' | 'payloadMinimal'>;
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** Conservative superset for safety checks, including PENDING used by community
 * restoration. A terminal receipt can still contain an uncertain outbound.
 * Always apply the caller's safety decision after reading these candidates. */
export function receiptSafetyCandidates(): Prisma.TwitchEventReceiptWhereInput {
  return { OR: [
    { state: 'RECEIVED' },
    { externalReference: { startsWith: 'message-native:' }, state: { notIn: ['PROCESSED', 'FAILED'] } },
    { payloadMinimal: { path: ['commandPilot', 'stage'], equals: 'EXECUTING' } },
    ...['PENDING', 'SENDING', 'AMBIGUOUS'].map(status => ({
      payloadMinimal: { path: ['commandPilot', 'responses'], array_contains: [{ status }] },
    })),
  ] };
}

export function receiptSafety(receipt: Receipt) {
  const payload = record(receipt.payloadMinimal), pilot = record(payload?.commandPilot);
  const unresolvedOutbound = Array.isArray(pilot?.responses) && pilot.responses.some(response =>
    record(response)?.status === 'SENDING' || record(response)?.status === 'AMBIGUOUS');
  const terminal = receipt.state === 'PROCESSED' || receipt.state === 'FAILED';
  const reservedMessage = receipt.externalReference?.startsWith('message-native:') === true && !terminal;
  // Only a raw Chat observation is passive. Other RECEIVED events/references and
  // even malformed native reservations remain protected. Terminal semantics stay
  // unchanged: EXECUTING or uncertain outbound still requires operator review.
  const passive = receipt.eventType === 'channel.chat.message' && receipt.processedAt === null
    && receipt.externalReference === null && !Object.hasOwn(payload ?? {}, 'commandPilot')
    && !Object.hasOwn(payload ?? {}, 'messageActivity');
  return { unresolvedOutbound, blocking: unresolvedOutbound || pilot?.stage === 'EXECUTING'
    || reservedMessage || receipt.state === 'RECEIVED' && !passive };
}

/** Shared read-only safety gate for canary plan/import and authority rollback. */
export async function assessTwitchOperationsInFlight(
  db: Pick<Prisma.TransactionClient, 'businessOperation' | 'twitchEventReceipt'>,
  twitchUserId: string, playerId?: string,
) {
  const pendingBusinessOperation = playerId !== undefined
    && await db.businessOperation.count({ where: { playerId, status: 'PENDING' } }) > 0;
  // A gift offered by an outsider is journaled under the gifter's Twitch identity.
  // Its held beneficiary proof must also prevent compensation of that Player.
  const receipts = await db.twitchEventReceipt.findMany({ where: playerId === undefined ? { twitchUserId } : {
    OR: [{ twitchUserId }, { payloadMinimal: { path: ['recoveryDeferred', 'playerId'], equals: playerId } }],
  }, select: {
    eventType: true, state: true, processedAt: true, externalReference: true, payloadMinimal: true,
  } });
  const safety = receipts.map(receiptSafety);
  return { blocked: pendingBusinessOperation || safety.some(row => row.blocking),
    unresolvedOutbound: safety.some(row => row.unresolvedOutbound) };
}
