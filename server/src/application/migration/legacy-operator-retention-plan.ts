import type { PrismaClient } from '../../../generated/prisma/client.js';
import { captureTargetedPlayerRows } from './targeted-player-rows.js';
import { communityHash } from './legacy-community-proof.js';

/** Preparation only: this does not authorize purge or relax its existing guard.
 * Expired and consumed plans remain evidence. Both R1055 graphs and social endpoints
 * must survive, with their FK closure, before any future global compensation design. */
export async function planOperatorRelationRetention(db: PrismaClient) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`;
    const plans = await tx.twitchCanonicalizationPlan.findMany({ orderBy: { id: 'asc' } });
    const resolutions = await tx.twitchLinkResolution.findMany({ where: { completedAt: { not: null } }, orderBy: { id: 'asc' } });
    const relations = await tx.friendship.findMany({ where: { legacyFactId: { not: null } }, orderBy: { id: 'asc' }, include: { legacyFact: true } });
    const targets = await tx.twitchNativeTarget.findMany({ where: { dataAuthority: 'NATIVE', playerId: { not: null } }, orderBy: { twitchUserId: 'asc' } });
    const playerIds = [...new Set([...plans.flatMap(p => [p.webPlayerId, p.twitchPlayerId, p.operatorPlayerId]),
      ...resolutions.flatMap(r => [r.webPlayerId, r.twitchPlayerId]), ...relations.flatMap(r => [r.playerAId, r.playerBId]), ...targets.map(t => t.playerId!)])].sort();
    // Bound the public preparation to relational proof. The complete gameplay graph
    // belongs to the future private rehearsal; capturing every domain here is unbounded.
    const graph = playerIds.length ? await captureTargetedPlayerRows(tx, playerIds, ['players', 'web_identities', 'twitch_identities',
      'twitch_canonicalization_plans', 'twitch_link_resolutions', 'legacy_friendship_facts', 'friendships', 'friend_hearts',
      'friendship_legacy_heart_state', 'business_operations', 'twitch_native_targets', 'twitch_canary_imports'], true) : null;
    const proof = { plans, resolutions, relations, targets, graph };
    return { status: plans.length || relations.length ? 'BLOCKED' as const : 'NO_OPERATOR_RELATION_PROOF' as const,
      reason: plans.length || relations.length ? 'CUTOVER_OPERATOR_RELATION_PROOFS_PRESENT' : null,
      playerIds, planCount: plans.length, expiredPlanCount: plans.filter(p => p.expiresAt <= new Date()).length, consumedPlanCount: plans.filter(p => p.consumedAt).length,
      materializedRelationCount: relations.length, fingerprint: communityHash(proof), proof, completeGameplayClosureVerified: false,
      requirements: ['RETAIN_IMMUTABLE_OPERATOR_PROOFS', 'RETAIN_BOTH_R1055_GRAPHS_AND_SOCIAL_FK_CLOSURE', 'RECONCILE_SHARED_FACTS_WITHOUT_NATIVE_REIMPORT', 'EXACT_PRIVATE_COMPENSATION_AND_INDEPENDENT_REVIEW'],
    };
  }, { isolationLevel: 'RepeatableRead', timeout: 30_000 });
}
