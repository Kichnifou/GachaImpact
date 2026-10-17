import type { Prisma } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
export type AutomaticLiveContext = { broadcasterId: string; streamId: string };
export const LIVE_OFFLINE_GRACE_MS = 45_000;
export const LIVE_FRESH_MS = 45_000;
export async function assertAutomaticLive(tx: Prisma.TransactionClient, actor: string, live: AutomaticLiveContext, action: 'OPEN' | 'CLOSE', now: Date) {
  await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id='twitch-commands' FOR SHARE`;
  const authority = await tx.twitchNativeAuthority.findUnique({ where: { id: 'twitch-commands' } });
  const credential = await tx.twitchGiveawayCredential.findUnique({ where: { playerId: actor } });
  const identity = await tx.twitchIdentity.findUnique({ where: { playerId: actor } });
  const player = await tx.player.findUnique({ where: { id: actor }, select: { status: true, rolesGranted: { where: { revokedAt: null, role: 'ADMIN' } } } });
  const channel = await tx.twitchLiveChannel.findUnique({ where: { broadcasterId: live.broadcasterId } });
  const stream = await tx.twitchLiveStream.findUnique({ where: { id: live.streamId } });
  if (authority?.desiredMode !== 'GLOBAL' || authority.operatorPlayerId !== actor || authority.acknowledgement !== 'STREAMERBOT_PATH_DISABLED'
    || player?.status !== 'ACTIVE' || !player.rolesGranted.length || !credential?.enabled || credential.twitchUserId !== live.broadcasterId
    || identity?.twitchUserId !== live.broadcasterId || identity.login.trim().toLowerCase() !== 'kichnifou'
    || !channel?.checkedAt || +now - +channel.checkedAt > LIVE_FRESH_MS || +channel.checkedAt > +now
    || channel.currentStreamId !== live.streamId || stream?.broadcasterId !== live.broadcasterId
    || action === 'OPEN' && (channel.status !== 'LIVE' || stream.endedAt)
    || action === 'CLOSE' && (channel.status !== 'OFFLINE' || !channel.offlineSince || +now - +channel.offlineSince < LIVE_OFFLINE_GRACE_MS))
    throw new AppError('Automatisation Live non autorisée ou état non confirmé.', 409, 'TWITCH_LIVE_NOT_READY');
  return stream;
}
