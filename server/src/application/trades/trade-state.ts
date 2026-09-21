import type { Prisma } from '../../../generated/prisma/client.js';

export async function particleStock(tx: Prisma.TransactionClient, playerId: string, resourceKey: string) {
  const balance = await tx.playerResourceBalance.findUnique({ where: { playerId_resourceKey: { playerId, resourceKey } } });
  const reserved = (await tx.tradeRequest.aggregate({ where: { senderPlayerId: playerId, senderResourceKey: resourceKey, state: 'PENDING' }, _sum: { currentAmount: true } }))._sum.currentAmount ?? 0n;
  const total = balance?.amount ?? 0n;
  return { total, reserved, available: total - reserved };
}

export async function refreshTradeNotification(tx: Prisma.TransactionClient, playerId: string, now: Date, newRequest = false) {
  const count = await tx.tradeRequest.count({ where: { recipientPlayerId: playerId, state: 'PENDING' } });
  const deduplicationKey = `trades:pending:${playerId}`;
  if (!count) {
    await tx.notification.updateMany({ where: { deduplicationKey }, data: { state: 'RESOLVED', resolvedAt: now, payload: { count: 0 } } });
  } else if (newRequest) {
    await tx.notification.upsert({ where: { deduplicationKey }, create: { playerId, domainKey: 'trades', typeKey: 'TRADES_PENDING', deduplicationKey, payload: { count }, actionKey: 'OPEN_TRADES', state: 'UNREAD', createdAt: now }, update: { payload: { count }, state: 'UNREAD', readAt: null, archivedAt: null, resolvedAt: null, createdAt: now } });
  } else {
    // Reductions and resolutions never resurface an archived/read aggregate.
    await tx.notification.updateMany({ where: { deduplicationKey }, data: { payload: { count } } });
  }
}

export async function expireTrades(tx: Prisma.TransactionClient, now: Date) {
  const expired = await tx.tradeRequest.findMany({ where: { state: 'PENDING', expiresAt: { lte: now } }, select: { id: true, recipientPlayerId: true }, orderBy: { id: 'asc' } });
  if (!expired.length) return;
  await tx.tradeRequest.updateMany({ where: { id: { in: expired.map(r => r.id) }, state: 'PENDING' }, data: { state: 'EXPIRED', resolvedAt: now, updatedAt: now } });
  for (const id of [...new Set(expired.map(r => r.recipientPlayerId))].sort()) await refreshTradeNotification(tx, id, now);
}

/** Called by the central economy in the same transaction as the stock mutation.
 * Each incoming request compares independently with the recipient's availability.
 * Releasing a reservation can only increase availability; reductions never grow back.
 */
export async function reconcileParticleTrades(tx: Prisma.TransactionClient, playerIds: string[], now: Date) {
  const requests = await tx.tradeRequest.findMany({ where: { state: 'PENDING', OR: [{ senderPlayerId: { in: playerIds } }, { recipientPlayerId: { in: playerIds } }] }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const recipients = new Set<string>();
  for (const request of requests) {
    const sender = await particleStock(tx, request.senderPlayerId, request.senderResourceKey);
    const recipient = await particleStock(tx, request.recipientPlayerId, request.recipientResourceKey);
    const maximum = [request.currentAmount, sender.available + request.currentAmount, recipient.available].reduce((a, b) => a < b ? a : b);
    const currentAmount = maximum > 0n ? maximum : 0n;
    if (currentAmount === request.currentAmount) continue;
    await tx.tradeRequest.update({ where: { id: request.id }, data: { currentAmount, updatedAt: now, ...(currentAmount === 0n ? { state: 'CANCELLED', resolvedAt: now } : {}) } });
    recipients.add(request.recipientPlayerId);
  }
  for (const id of [...recipients].sort()) await refreshTradeNotification(tx, id, now);
}
