import type { Prisma } from '../../../generated/prisma/client.js';
import { businessDateToDatabaseDate, getBusinessDate } from '../../domain/time/business-date.js';

type Tx = Prisma.TransactionClient;

/** Semantic notification references have no FK; include their exact images in consent/backup. */
export async function losingSocialDecisionEvidence(tx: Tx, loser: string) {
  const requests = await tx.friendRequest.findMany({ where: { state: 'PENDING', OR: [{ senderPlayerId: loser }, { recipientPlayerId: loser }] }, select: { id: true }, orderBy: { id: 'asc' } });
  const notifications = await tx.notification.findMany({ where: { deduplicationKey: { in: requests.map(request => `friend-request:${request.id}`) }, state: { in: ['UNREAD', 'READ'] } }, orderBy: { id: 'asc' } });
  return { notifications };
}

/** The caller owns the Social/Player locks, immutable plan and explicit R1055 consent. */
export async function planLosingSocialState(tx: Tx, loser: string) {
  const [friendships, friendRequests, directRequests, directParticipants] = await Promise.all([
    tx.friendship.count({ where: { supersededAt: null, state: 'ACTIVE', OR: [{ playerAId: loser }, { playerBId: loser }] } }),
    tx.friendRequest.count({ where: { state: 'PENDING', OR: [{ senderPlayerId: loser }, { recipientPlayerId: loser }] } }),
    tx.directConversationRequest.count({ where: { state: 'PENDING', OR: [{ senderPlayerId: loser }, { recipientPlayerId: loser }] } }),
    tx.directConversationParticipant.count({ where: { playerId: loser, OR: [{ archivedAt: null }, { typingUntil: { not: null } }] } }),
  ]);
  return { friendships, friendRequests, directRequests, directParticipants, blockers: [] as string[] };
}

/** No identity transfer, economy, third-party read state, historical author or message mutation. */
export async function archiveLosingSocialState(tx: Tx, loser: string, now: Date) {
  const plan = await planLosingSocialState(tx, loser);
  await tx.friendship.updateMany({
    where: { supersededAt: null, state: 'ACTIVE', OR: [{ playerAId: loser }, { playerBId: loser }] },
    data: { state: 'ARCHIVED', archivedAt: now, retiredByProgressionAt: now },
  });
  const requests = await tx.friendRequest.findMany({ where: { state: 'PENDING', OR: [{ senderPlayerId: loser }, { recipientPlayerId: loser }] }, select: { id: true, senderPlayerId: true } });
  for (const request of requests) {
    await tx.friendRequest.update({ where: { id: request.id }, data: { state: request.senderPlayerId === loser ? 'CANCELLED' : 'REFUSED', resolvedAt: now } });
    await tx.notification.updateMany({ where: { deduplicationKey: `friend-request:${request.id}`, state: { in: ['UNREAD', 'READ'] } }, data: { state: 'RESOLVED', resolvedAt: now } });
  }
  // The operator-resolution audit is the reason; no fabricated human response is emitted.
  await tx.directConversationRequest.updateMany({ where: { state: 'PENDING', OR: [{ senderPlayerId: loser }, { recipientPlayerId: loser }] }, data: { state: 'REFUSED', resolvedAt: now } });
  await tx.directConversationParticipant.updateMany({ where: { playerId: loser, OR: [{ archivedAt: null }, { typingUntil: { not: null } }] }, data: { archivedAt: now, typingUntil: null } });
  return plan;
}

/** Only proven usage of today's action follows the explicit identity choice, never progression. */
export async function carryRetiredFriendshipUsage(tx: Tx, input: { loser: string; winner: string; now: Date }) {
  if (input.loser === input.winner) throw new Error('FRIENDSHIP_RETIRED_USAGE_IDENTITY_CONFLICT');
  const loser = await tx.player.findUnique({ where: { id: input.loser }, select: { status: true } });
  const winner = await tx.player.findUnique({ where: { id: input.winner }, select: { status: true } });
  if (loser?.status !== 'ARCHIVED' || winner?.status !== 'ACTIVE') throw new Error('FRIENDSHIP_RETIRED_USAGE_CHOICE_REQUIRED');
  const date = businessDateToDatabaseDate(getBusinessDate(input.now));
  const oldRelations = await tx.friendship.findMany({ where: { OR: [{ playerAId: input.loser }, { playerBId: input.loser }] }, orderBy: { id: 'asc' }, include: {
    hearts: { where: { businessDate: date }, orderBy: { id: 'asc' }, include: { operation: { select: { status: true, playerId: true, operationType: true } } } }, legacyHeartStates: { where: { lastHeartSentDate: date }, orderBy: { senderPlayerId: 'asc' } },
  } });
  let carried = 0;
  for (const old of oldRelations) {
    const peer = old.playerAId === input.loser ? old.playerBId : old.playerAId;
    if (peer === input.winner || !old.hearts.length && !old.legacyHeartStates.length) continue;
    const ids = [input.winner, peer].sort();
    const effective = await tx.friendship.findFirst({ where: { playerAId: ids[0]!, playerBId: ids[1]!, state: 'ACTIVE', supersededAt: null } });
    if (!effective) continue;
    if (old.hearts.some(heart => heart.operation.status !== 'COMPLETED' || heart.operation.playerId !== heart.senderPlayerId || heart.operation.operationType !== 'friendship.heart')
      || old.legacyHeartStates.some(state => ![input.loser, peer].includes(state.senderPlayerId))) throw new Error('FRIENDSHIP_RETIRED_USAGE_PROOF_INVALID');
    for (const oldSender of [input.loser, peer]) {
      const receipts = old.hearts.filter(heart => heart.senderPlayerId === oldSender);
      const carryovers = old.legacyHeartStates.filter(state => state.senderPlayerId === oldSender);
      if (!receipts.length && !carryovers.length) continue;
      const senderPlayerId = oldSender === input.loser ? input.winner : peer;
      const key = { friendshipId: effective.id, senderPlayerId };
      const previous = await tx.friendshipLegacyHeartState.findUnique({ where: { friendshipId_senderPlayerId: key } });
      if (previous?.lastHeartSentDate?.getTime() === date.getTime()) continue;
      if (previous?.lastHeartSentDate && previous.lastHeartSentDate > date) throw new Error('FRIENDSHIP_RETIRED_USAGE_DATE_CONFLICT');
      const provenance: Prisma.InputJsonObject = {
        source: 'R1055_RETIRED_USAGE', losingPlayerId: input.loser, winningPlayerId: input.winner, sourceFriendshipId: old.id,
        originalSenderPlayerId: oldSender, businessDate: getBusinessDate(input.now),
        receipts: receipts.map(heart => ({ heartId: heart.id, operationId: heart.operationId })),
        carryovers: carryovers.map(state => ({ friendshipId: state.friendshipId, senderPlayerId: state.senderPlayerId, provenance: state.legacyProvenance })),
        previous: previous?.legacyProvenance ?? null,
      };
      await tx.friendshipLegacyHeartState.upsert({ where: { friendshipId_senderPlayerId: key }, create: { ...key, lastHeartSentDate: date, legacyProvenance: provenance }, update: { lastHeartSentDate: date, legacyProvenance: provenance } });
      carried++;
    }
  }
  return { carried };
}
