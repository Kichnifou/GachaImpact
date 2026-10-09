import type { Prisma } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import { STREAMERBOT_PATH_DISABLED } from './twitch-native-authority.js';

/** Shared order: immutable identity -> authority -> canonicalization/Players.
 * Authority transitions take authority -> Players and never wait for identity. */
export async function lockTwitchNativeAdmission(tx: Prisma.TransactionClient, twitchUserId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`twitch-provision:${twitchUserId}`}, 0))::text`;
  await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id='twitch-commands' FOR SHARE`;
}

/** Called only after signed EventSub bootstrap or definitive verified OAuth/R1055.
 * Never promotes a reserved legacy target or restores any historical gameplay. */
export async function admitLinkedNativePlayer(tx: Prisma.TransactionClient, twitchUserId: string, playerId: string, at = new Date()) {
  const blocked = () => new AppError('Cette identité Twitch nécessite une vérification opérateur.', 409, 'TWITCH_NATIVE_TARGET_CONFLICT');
  const [identity, target, pending] = await Promise.all([
    tx.twitchIdentity.findUnique({ where: { twitchUserId }, include: { player: true } }),
    tx.twitchNativeTarget.findUnique({ where: { twitchUserId } }),
    tx.twitchLinkResolution.findFirst({ where: { twitchUserId, completedAt: null, expiresAt: { gt: at } } }),
  ]);
  if (!identity || identity.playerId !== playerId || identity.player.status !== 'ACTIVE' || pending) throw blocked();
  if (target) {
    if (target.dataAuthority !== 'NATIVE' || target.acknowledgement !== STREAMERBOT_PATH_DISABLED || !target.transferredAt
      || target.playerId && target.playerId !== playerId) throw blocked();
    if (!target.playerId) await tx.twitchNativeTarget.update({ where: { twitchUserId }, data: { playerId } });
    return;
  }
  if (identity.player.legacyUsername !== null || identity.player.legacyRecovery !== null) throw blocked();
  await tx.twitchNativeTarget.create({ data: { twitchUserId, playerId, dataAuthority: 'NATIVE', canary: false,
    acknowledgement: STREAMERBOT_PATH_DISABLED, transferredAt: at } });
  await tx.twitchNativeAudit.create({ data: { actorPlayerId: playerId, twitchUserId, action: 'VERIFIED_NATIVE_ADMISSION', acknowledgement: STREAMERBOT_PATH_DISABLED } });
}
