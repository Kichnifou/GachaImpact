import type { Prisma } from '../../../generated/prisma/client.js';

type Receipt = Pick<Prisma.TwitchEventReceiptGetPayload<Record<string, never>>,
  'eventType' | 'state' | 'processedAt' | 'externalReference' | 'payloadMinimal'>;
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

function receiptSafety(receipt: Receipt) {
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
  const receipts = await db.twitchEventReceipt.findMany({ where: { twitchUserId }, select: {
    eventType: true, state: true, processedAt: true, externalReference: true, payloadMinimal: true,
  } });
  const safety = receipts.map(receiptSafety);
  return { blocked: pendingBusinessOperation || safety.some(row => row.blocking),
    unresolvedOutbound: safety.some(row => row.unresolvedOutbound) };
}
