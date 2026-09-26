import type { Prisma } from '../../../generated/prisma/client.js';
import { parseLegacyParisInstant } from './legacy-box-mapping.js';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import type { LegacyGlobalPlan } from './legacy-global-plan.js';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function knownInstant(value: unknown): Date | null {
  const paris = parseLegacyParisInstant(value);
  if (paris) return paris;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function applyLegacyGiveaway(tx: Prisma.TransactionClient, snapshot: Snapshot, plan: LegacyGlobalPlan, batchId: string) {
  const source = object(snapshot.sources['giveaway.json']);
  const byName = new Map(plan.players.map(player => [normalizeLegacyName(player.legacyUsername), player.playerId]));
  if (source.status !== 'closed') throw new Error('Open Giveaway requires a dedicated cutover contract.');
  const winnerId = typeof source.winner === 'string' ? byName.get(normalizeLegacyName(source.winner)) : null;
  if (source.winner && !winnerId) throw new Error('Giveaway winner is outside the migrable population.');
  const participants = Array.isArray(source.participants) ? source.participants : [];
  const messageCounts = object(source.messageCounts);
  const session = await tx.giveawaySession.create({ data: { legacySessionKey: `streamerbot:${snapshot.hash}`,
    status: 'CLOSED', winnerPlayerId: winnerId ?? null, openedAt: knownInstant(source.openedAt),
    closedAt: knownInstant(source.closedAt), rerollCount: null, rerolledAt: null,
    rewardStatus: 'UNKNOWN', distributionState: {
      chatRewardsDistributed: source.chatRewardsDistributed === true,
      rewardPrimos: typeof source.rewardPrimos === 'number' ? source.rewardPrimos : null,
      lastParticipantId: typeof source.lastParticipant === 'string' ? byName.get(normalizeLegacyName(source.lastParticipant)) ?? null : null,
      lastWishAt: knownInstant(source.lastWishAt)?.toISOString() ?? null,
      openedByPlayerId: typeof source.openedBy === 'string' ? byName.get(normalizeLegacyName(source.openedBy)) ?? null : null,
      closedByPlayerId: typeof source.closedBy === 'string' ? byName.get(normalizeLegacyName(source.closedBy)) ?? null : null,
    }, legacyProvenance: { source: 'giveaway.json', batchId, snapshotHash: snapshot.hash } } });
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
    if (!Number.isSafeInteger(raw) || Number(raw) < 0) throw new Error('Invalid Giveaway chat count.');
    await tx.giveawayChatStat.create({ data: { sessionId: session.id, playerId, messageCount: BigInt(Number(raw)),
      legacyProvenance: { source: 'giveaway.json.messageCounts', batchId } } });
    importedChatStats++;
  }
  return { sessions: 1, participants: importedParticipants, chatStats: importedChatStats, rewardsCreated: 0 };
}
