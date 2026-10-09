import type { Prisma } from '../../../generated/prisma/client.js';
import { parseLegacyParisInstant } from './legacy-box-mapping.js';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import { isIdentityQuarantined, isOwnerDiscarded, type LegacyGlobalPlan } from './legacy-global-plan.js';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function knownInstant(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const paris = parseLegacyParisInstant(value);
  if (paris) return paris;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new Error('Invalid present Giveaway instant.');
  const calendarDay = value.slice(0, 10);
  const parsedDay = new Date(`${calendarDay}T00:00:00.000Z`);
  if (Number.isNaN(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== calendarDay)
    throw new Error('Invalid present Giveaway instant.');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid present Giveaway instant.');
  return parsed;
}

export type LegacyGiveawayPlan = Pick<LegacyGlobalPlan, 'identityQuarantined' | 'ownerDiscardedKeys'> & {
  players: Pick<LegacyGlobalPlan['players'][number], 'legacyUsername' | 'playerId' | 'personalImport'>[];
};

export async function applyLegacyGiveaway(tx: Prisma.TransactionClient, snapshot: Snapshot, plan: LegacyGiveawayPlan, batchId: string,
  legacySessionKey = `streamerbot:${snapshot.hash}`) {
  const source = object(snapshot.sources['giveaway.json']);
  const byName = new Map(plan.players.map(player => [normalizeLegacyName(player.legacyUsername), player.playerId]));
  if (source.status !== 'closed') throw new Error('Open Giveaway requires a dedicated cutover contract.');
  const winnerId = typeof source.winner === 'string' ? byName.get(normalizeLegacyName(source.winner)) : null;
  const winnerQuarantined = isIdentityQuarantined(plan, source.winner);
  const winnerDiscarded = isOwnerDiscarded(plan, source.winner);
  if (source.winner && !winnerId && !winnerQuarantined && !winnerDiscarded) throw new Error('Giveaway winner is outside the migrable population.');
  const hasPreviousWinner = Object.hasOwn(source, 'previousWinner');
  const previousWinnerId = hasPreviousWinner && typeof source.previousWinner === 'string' && source.previousWinner.trim()
    ? byName.get(normalizeLegacyName(source.previousWinner)) : null;
  if (hasPreviousWinner && !previousWinnerId && !isIdentityQuarantined(plan, source.previousWinner) && !isOwnerDiscarded(plan, source.previousWinner))
    throw new Error('Giveaway previousWinner is outside the migrable population or invalid.');
  if (previousWinnerId && ((!winnerId && !winnerQuarantined && !winnerDiscarded) || previousWinnerId === winnerId))
    throw new Error('Giveaway previousWinner contradicts the current winner.');
  const hasRerolledAt = Object.hasOwn(source, 'rerolledAt');
  const rerolledAt = hasRerolledAt ? knownInstant(source.rerolledAt) : null;
  if (hasRerolledAt && !rerolledAt) throw new Error('Invalid present Giveaway rerolledAt.');
  const openedByPlayerId = typeof source.openedBy === 'string' ? byName.get(normalizeLegacyName(source.openedBy)) ?? null : null;
  const closedByPlayerId = typeof source.closedBy === 'string' ? byName.get(normalizeLegacyName(source.closedBy)) ?? null : null;
  const participants = Array.isArray(source.participants) ? source.participants : [];
  const messageCounts = object(source.messageCounts);
  const session = await tx.giveawaySession.create({ data: { legacySessionKey,
    status: 'CLOSED', winnerPlayerId: winnerId ?? null, previousWinnerPlayerId: previousWinnerId ?? null,
    openedByPlayerId, closedByPlayerId,
    openedAt: knownInstant(source.openedAt),
    closedAt: knownInstant(source.closedAt), rerollCount: null, rerolledAt,
    rewardStatus: 'UNKNOWN', distributionState: {
      chatRewardsDistributed: source.chatRewardsDistributed === true,
      rewardPrimos: typeof source.rewardPrimos === 'number' ? source.rewardPrimos : null,
      lastParticipantId: typeof source.lastParticipant === 'string' ? byName.get(normalizeLegacyName(source.lastParticipant)) ?? null : null,
      lastWishAt: knownInstant(source.lastWishAt)?.toISOString() ?? null,
    }, legacyProvenance: { source: 'giveaway.json', batchId, snapshotHash: snapshot.hash,
      openedByLegacy: typeof source.openedBy === 'string' && !isOwnerDiscarded(plan, source.openedBy) ? source.openedBy : null,
      closedByLegacy: typeof source.closedBy === 'string' && !isOwnerDiscarded(plan, source.closedBy) ? source.closedBy : null,
      previousWinnerLegacy: hasPreviousWinner && typeof source.previousWinner === 'string' && !isOwnerDiscarded(plan, source.previousWinner) ? source.previousWinner : null,
      previousWinnerRole: previousWinnerId ? 'IMMEDIATE_PREDECESSOR_ONLY' : null } } });
  // Index 0 means the sole result proven by this snapshot, not a reconstructed initial draw.
  if (winnerId) await tx.giveawayWin.create({ data: { sessionId: session.id, drawIndex: 0,
    playerId: winnerId, origin: 'LEGACY', operationId: null, drawnAt: null,
    legacyProvenance: { source: 'giveaway.json.winner', batchId, snapshotHash: snapshot.hash,
      ordinalKnown: false } } });
  let importedParticipants = 0, importedChatStats = 0;
  for (const raw of participants) {
    if (typeof raw !== 'string') throw new Error('Invalid Giveaway participant.');
    const playerId = byName.get(normalizeLegacyName(raw));
    if (!playerId) continue; // No ghost account for an R930 exclusion.
    await tx.giveawayParticipant.create({ data: { sessionId: session.id, playerId, joinedAt: null,
      legacyProvenance: { source: 'giveaway.json.participants', batchId } } });
    importedParticipants++;
  }
  for (const [login, raw] of Object.entries(messageCounts)) {
    const playerId = byName.get(normalizeLegacyName(login));
    if (!playerId) continue;
    if (plan.players.some(player => player.playerId === playerId && player.personalImport === false)) continue;
    if (!Number.isSafeInteger(raw) || Number(raw) < 0) throw new Error('Invalid Giveaway chat count.');
    await tx.giveawayChatStat.create({ data: { sessionId: session.id, playerId, messageCount: BigInt(Number(raw)),
      legacyProvenance: { source: 'giveaway.json.messageCounts', batchId } } });
    importedChatStats++;
  }
  return { sessions: 1, wins: winnerId ? 1 : 0, participants: importedParticipants,
    chatStats: importedChatStats, rewardsCreated: 0 };
}
