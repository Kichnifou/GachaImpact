import type { Prisma } from '../../../generated/prisma/client.js';
import { businessDateToDatabaseDate, getBusinessDate } from '../../domain/time/business-date.js';
import { parseLegacyParisInstant } from './legacy-box-mapping.js';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import type { LegacyGlobalPlan } from './legacy-global-plan.js';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function knownDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const paris = parseLegacyParisInstant(value);
  if (paris) return paris;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) throw new Error('Invalid present legacy Social date.');
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid present legacy Social date.');
  return parsed;
}
function heartDate(value: unknown): Date | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return businessDateToDatabaseDate(value);
  const instant = knownDate(value);
  return instant ? businessDateToDatabaseDate(getBusinessDate(instant)) : null;
}

export async function applyLegacySocial(tx: Prisma.TransactionClient, snapshot: Snapshot, plan: LegacyGlobalPlan, batchId: string) {
  const playerByName = new Map(plan.players.map(player => [normalizeLegacyName(player.legacyUsername), player.playerId]));
  const source = object(snapshot.sources['friendships_data.json']);
  let friendships = 0, requests = 0, heartCarryovers = 0;
  for (const raw of Object.values(object(source.friendships))) {
    const friendship = object(raw);
    if (!Array.isArray(friendship.users) || friendship.users.length !== 2) throw new Error('Invalid friendship pair.');
    const first = playerByName.get(normalizeLegacyName(String(friendship.users[0])));
    const second = playerByName.get(normalizeLegacyName(String(friendship.users[1])));
    if (!first || !second) continue; // R933: no ghost Player.
    if (first === second) throw new Error('Self friendship in legacy source.');
    const [playerAId, playerBId] = [first, second].sort() as [string, string];
    const retained = await tx.friendship.findFirst({ where: { playerAId, playerBId, supersededAt: null } });
    if (retained) { friendships++; continue; }
    const level = friendship.level;
    const totalHearts = friendship.sparkleHearts;
    if (!Number.isSafeInteger(level) || Number(level) < 1 || Number(level) > 1000 || !Number.isSafeInteger(totalHearts) || Number(totalHearts) < 0)
      throw new Error('Invalid friendship aggregate.');
    const createdAt = knownDate(friendship.createdAt);
    const row = await tx.friendship.create({ data: { playerAId, playerBId, state: 'ACTIVE', level: Number(level),
      totalHearts: BigInt(Number(totalHearts)), becameFriendsAt: createdAt, ...(createdAt ? { createdAt } : {}) } });
    friendships++;
    for (const [senderName, rawDate] of Object.entries(object(friendship.lastHeartSent))) {
      const senderPlayerId = playerByName.get(normalizeLegacyName(senderName));
      if (!senderPlayerId || ![first, second].includes(senderPlayerId)) throw new Error('Invalid directional heart owner.');
      const lastHeartSentDate = heartDate(rawDate);
      if (!lastHeartSentDate && rawDate !== '' && rawDate !== null) throw new Error('Invalid directional heart date.');
      await tx.friendshipLegacyHeartState.create({ data: { friendshipId: row.id, senderPlayerId, lastHeartSentDate,
        legacyProvenance: { source: 'friendships_data.json.lastHeartSent', batchId } } });
      heartCarryovers++;
    }
  }
  for (const raw of Array.isArray(source.requests) ? source.requests : []) {
    const request = object(raw);
    const senderPlayerId = typeof request.from === 'string' ? playerByName.get(normalizeLegacyName(request.from)) : null;
    const recipientPlayerId = typeof request.to === 'string' ? playerByName.get(normalizeLegacyName(request.to)) : null;
    if (!senderPlayerId || !recipientPlayerId) continue;
    if (senderPlayerId === recipientPlayerId) throw new Error('Self friend request in legacy source.');
    if (await tx.friendRequest.findFirst({ where: { senderPlayerId, recipientPlayerId, state: 'PENDING' } })) { requests++; continue; }
    const createdAt = knownDate(request.createdAt);
    if (!createdAt) throw new Error('Friend request date unknown.');
    await tx.friendRequest.create({ data: { senderPlayerId, recipientPlayerId, state: 'PENDING', sourceChannel: 'MIGRATION', createdAt } });
    requests++;
  }
  if (friendships !== plan.friendshipCount || requests !== plan.requestCount) throw new Error('Social import count mismatch.');
  if (plan.friendshipExcluded || plan.requestExcluded) await tx.migrationIssue.create({ data: { batchId,
    sourceName: 'friendships_data.json', path: 'friendships/requests', domain: 'SOCIAL', severity: 'INFO',
    issueCode: 'RELATIONS_TO_EXCLUDED_PROFILES_DROPPED', description: 'Relations involving R930-excluded profiles were not imported.',
    resolution: 'No ghost Player created.', details: { friendships: plan.friendshipExcluded, requests: plan.requestExcluded } } });
  return { friendships, requests, heartCarryovers, friendHearts: 0, excludedFriendships: plan.friendshipExcluded, excludedRequests: plan.requestExcluded };
}
