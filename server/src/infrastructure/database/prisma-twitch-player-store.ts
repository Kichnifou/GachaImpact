import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { bootstrapPlayer } from './player-bootstrap.js';
import { isPrismaConcurrencyCollision } from './prisma-concurrency.js';
import type { NativeAuthorityStore } from '../../application/twitch/twitch-native-authority.js';
import { STREAMERBOT_PATH_DISABLED } from '../../application/twitch/twitch-native-authority.js';
import { lockTwitchNativeAdmission } from '../../application/twitch/twitch-native-admission.js';

export class PrismaTwitchPlayerStore {
  constructor(private readonly db: PrismaClient, private readonly authority: NativeAuthorityStore) {}
  async resolve(input: { twitchUserId: string; login: string; displayName: string; observedAt: Date }) {
    for (let retry = 0; ; retry++) {
      try {
        return await this.db.$transaction(async tx => {
          await lockTwitchNativeAdmission(tx, input.twitchUserId);
          // The deployment gate may differ between replicas. Recheck it after the control lock.
          if (!await this.authority.covers(input.twitchUserId, tx)) return null;
          // Recheck in the same transaction, including a kill switch committed while waiting for the identity lock.
          const control = await tx.twitchNativeAuthority.findUnique({ where: { id: 'twitch-commands' } });
          const target = await tx.twitchNativeTarget.findUnique({ where: { twitchUserId: input.twitchUserId } });
          if (!control || control.desiredMode === 'OFF' || target && (target.dataAuthority !== 'NATIVE' || target.acknowledgement !== STREAMERBOT_PATH_DISABLED)
            || control.desiredMode === 'CANARY' && !target?.canary) return null;
          const existing = await tx.twitchIdentity.findUnique({ where: { twitchUserId: input.twitchUserId }, include: { player: true } });
          if (existing) return existing.player.status === 'ACTIVE' ? existing : null;
          if (target?.playerId || target && target.dataAuthority !== 'NATIVE') return null;
          const player = await bootstrapPlayer(tx, { displayName: input.displayName || input.login || 'Voyageur', twitchIdentity: {
            twitchUserId: input.twitchUserId, login: input.login, displayName: input.displayName, firstSeenAt: input.observedAt } }, input.observedAt);
          await tx.twitchNativeTarget.upsert({ where: { twitchUserId: input.twitchUserId }, create: { twitchUserId: input.twitchUserId,
            playerId: player.id, canary: control.desiredMode === 'CANARY', dataAuthority: 'NATIVE', acknowledgement: STREAMERBOT_PATH_DISABLED, transferredAt: input.observedAt }, update: { playerId: player.id } });
          return tx.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: input.twitchUserId }, include: { player: true } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 });
      } catch (error) { if (retry < 4 && isPrismaConcurrencyCollision(error)) continue; throw error; }
    }
  }
}
