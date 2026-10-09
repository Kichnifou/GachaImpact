import type { Prisma } from '../../../generated/prisma/client.js';
import { BusinessError } from '../errors.js';
import { communityHash } from '../migration/legacy-community-proof.js';

type Tx = Prisma.TransactionClient;
const conflict = (): never => { throw new BusinessError('BANNER_VOTE_IDENTITY_CONFLICT', 'Les votes liés à ce compte nécessitent une vérification.'); };
type Binding = { playerId: string; resolutionId: string | null };
function history(value: Prisma.JsonValue): Binding[] {
  if (!Array.isArray(value) || value.some(v => !v || typeof v !== 'object' || Array.isArray(v) || typeof v.playerId !== 'string'
    || !(v.resolutionId === null || typeof v.resolutionId === 'string'))) return conflict();
  return value as unknown as Binding[];
}

/** Single owner for native/external tally. No login or display name participates. */
export async function bannerVoteContributions(tx: Tx, rotationId: string) {
  const [native, external] = await Promise.all([
    tx.bannerVote.findMany({ where: { bannerRotationId: rotationId }, orderBy: { id: 'asc' } }),
    tx.externalBannerVote.findMany({ where: { bannerRotationId: rotationId }, orderBy: { id: 'asc' } }),
  ]);
  const identities = await tx.twitchIdentity.findMany({ where: { OR: [
    { playerId: { in: native.map(v => v.playerId) } }, { twitchUserId: { in: external.map(v => v.twitchUserId) } },
  ] }, include: { player: { select: { status: true } } } });
  const aliases = new Map<string, string>();
  const alias = (playerId: string, twitchId: string) => {
    if (aliases.has(playerId) && aliases.get(playerId) !== twitchId) return conflict();
    aliases.set(playerId, twitchId);
  };
  for (const identity of identities) {
    if (identity.player.status !== 'ACTIVE') return conflict();
    alias(identity.playerId, identity.twitchUserId);
  }
  for (const vote of external) {
    const provenance = vote.provenance;
    if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) return conflict();
    const { operationId: _operation, ...source } = provenance;
    if (communityHash(source) !== vote.proofHash || source.source !== 'banner_votes.json.voters'
      || source.twitchUserId !== vote.twitchUserId || source.characterId !== vote.characterId
      || ['snapshotHash', 'originalSourceHash', 'populationHash', 'historicalReportHash', 'verificationReportHash']
        .some(key => typeof source[key] !== 'string' || !/^[a-f0-9]{64}$/.test(source[key] as string))) return conflict();
    const bindings = history(vote.bindingHistory);
    if (vote.playerId && !bindings.some(b => b.playerId === vote.playerId)) return conflict();
    const current = identities.find(i => i.twitchUserId === vote.twitchUserId);
    if (vote.playerId && current && vote.playerId !== current.playerId) {
      const resolution = await tx.twitchLinkResolution.findFirst({ where: { twitchUserId: vote.twitchUserId, completedAt: { not: null }, OR: [
        { choice: 'WEB', webPlayerId: current.playerId, twitchPlayerId: vote.playerId },
        { choice: 'TWITCH', twitchPlayerId: current.playerId, webPlayerId: vote.playerId },
      ] } });
      if (!resolution) return conflict();
    }
    for (const binding of bindings) alias(binding.playerId, vote.twitchUserId);
  }
  const contributions = new Map<string, { characterId: string; votedAt: Date | null }>();
  const add = (key: string, characterId: string, votedAt: Date | null) => {
    const previous = contributions.get(key);
    if (previous && previous.characterId !== characterId) return conflict();
    if (!previous) contributions.set(key, { characterId, votedAt });
  };
  for (const vote of native) add(aliases.has(vote.playerId) ? `t:${aliases.get(vote.playerId)}` : `p:${vote.playerId}`, vote.characterId, vote.votedAt);
  for (const vote of external) add(`t:${vote.twitchUserId}`, vote.characterId, null);
  const counts = new Map<string, number>();
  for (const vote of contributions.values()) counts.set(vote.characterId, (counts.get(vote.characterId) ?? 0) + 1);
  return { counts, totalVotes: contributions.size,
    own: (playerId: string) => contributions.get(aliases.has(playerId) ? `t:${aliases.get(playerId)}` : `p:${playerId}`) ?? null };
}

/** Called under identity -> cycle -> Player locks by R1055, or cycle lock by Vote.
 * Pending WEB/TWITCH decisions never select a winner. Frozen counts stay untouched. */
export async function reconcileExternalBannerVotes(tx: Tx, twitchUserId: string) {
  const rows = await tx.externalBannerVote.findMany({ where: { twitchUserId }, orderBy: { id: 'asc' } });
  if (!rows.length) return;
  const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId }, include: { player: true } });
  if (!identity) return; // A proof remains valid without a Player, including after unlink.
  if (identity.player.status !== 'ACTIVE') return conflict();
  if (await tx.twitchLinkResolution.findFirst({ where: { twitchUserId, completedAt: null, expiresAt: { gt: new Date() } } })) return;
  for (const row of rows) {
    const previous = history(row.bindingHistory);
    if (row.playerId === identity.playerId) continue;
    let resolutionId: string | null = null;
    if (row.playerId) {
      const resolution = await tx.twitchLinkResolution.findFirst({ where: { twitchUserId, completedAt: { not: null }, OR: [
        { choice: 'WEB', webPlayerId: identity.playerId, twitchPlayerId: row.playerId },
        { choice: 'TWITCH', twitchPlayerId: identity.playerId, webPlayerId: row.playerId },
      ] }, orderBy: { completedAt: 'desc' } });
      if (!resolution) return conflict();
      resolutionId = resolution.id;
    }
    const native = await tx.bannerVote.findUnique({ where: { bannerRotationId_playerId: { bannerRotationId: row.bannerRotationId, playerId: identity.playerId } } });
    if (native && native.characterId !== row.characterId) return conflict();
    await tx.externalBannerVote.update({ where: { id: row.id }, data: { playerId: identity.playerId,
      bindingHistory: [...previous, { playerId: identity.playerId, resolutionId }] } });
    await bannerVoteContributions(tx, row.bannerRotationId); // Fail closed if any old alias contradicts the identity.
  }
}
