import { randomBytes } from 'node:crypto';
import { Prisma, type PrismaClient, type ArcadeInvitation } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { elementKeys } from '../../domain/economy/resources.js';
import type { ArcadeGame, ArcadeDifficulty } from '../../domain/arcade/types.js';
import { PresenceService, PRESENCE_CONNECTION_TIMEOUT_MS, PRESENCE_AWAY_MS } from '../social/presence-service.js';
import { activeFriendOf, privacyAllowedWhere } from '../social/privacy-service.js';
import { AppError } from '../../api/errors.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { arcadeTransaction, lockArcadePlayers, arcadeConflict } from './arcade-transaction.js';
import { createArcadeSession } from './arcade-session-factory.js';

export const arcadeGameNames = { MEMORY: 'Memory', CONNECT_FOUR: 'Puissance 4', TIC_TAC_TOE: 'Morpion' } as const;
export const invitationIdentities = { host: { select: { id: true, displayName: true } }, guest: { select: { id: true, displayName: true } } } as const;
type InvitationRow = ArcadeInvitation & { host: { id: string; displayName: string }; guest: { id: string; displayName: string } };
export type ArcadeInviteInput = { opponentPlayerId: string; game: ArcadeGame; difficulty: ArcadeDifficulty; friendsOnly: boolean; replaySessionId?: string; idempotencyKey: string };
export type ArcadeInviteAction = { kind: 'READY' | 'CANCEL' | 'REFUSE'; idempotencyKey: string };
export function projectInvitation(row: InvitationRow, viewer: string) {
  return { id: row.id, direction: row.hostPlayerId === viewer ? 'OUTGOING' as const : 'INCOMING' as const,
    host: row.host, guest: row.guest, game: row.game as ArcadeGame, difficulty: row.difficulty as ArcadeDifficulty,
    status: row.status as 'PENDING' | 'STARTED' | 'REFUSED' | 'CANCELLED' | 'EXPIRED' | 'INVALIDATED', hostReady: row.hostReady, guestReady: row.guestReady,
    expiresAt: row.expiresAt.toISOString(), sessionId: row.sessionId };
}
export type ArcadeInvitationMutation = { invitation: ReturnType<typeof projectInvitation>; operationId: string; alreadyProcessed: boolean; unavailable?: boolean };
export const participantWhere = (id: string) => ({ OR: [{ playerId: id }, { opponentPlayerId: id }] });
export const invitationParticipantWhere = (id: string) => ({ OR: [{ hostPlayerId: id }, { guestPlayerId: id }] });
export async function arcadeBusy(tx: Prisma.TransactionClient, id: string, exceptInvitation?: string) {
  const [session, invitation] = await Promise.all([
    tx.arcadeSession.findFirst({ where: { ...participantWhere(id), status: 'ACTIVE' }, select: { id: true } }),
    tx.arcadeInvitation.findFirst({ where: { ...invitationParticipantWhere(id), status: 'PENDING', ...(exceptInvitation ? { id: { not: exceptInvitation } } : {}) }, select: { id: true } }),
  ]);
  return Boolean(session || invitation);
}
export async function validArcadePair(tx: Prisma.TransactionClient, a: string, b: string) {
  if (a === b) return false;
  const [players, blocks] = await Promise.all([
    tx.player.count({ where: { id: { in: [a, b] }, status: 'ACTIVE', elementKey: { in: [...elementKeys] } } }),
    tx.playerBlock.count({ where: { OR: [{ blockerPlayerId: a, blockedPlayerId: b }, { blockerPlayerId: b, blockedPlayerId: a }] } }),
  ]);
  return players === 2 && blocks === 0;
}
export async function resolveArcadeInvite(tx: Prisma.TransactionClient, row: ArcadeInvitation, status: string, now: Date) {
  await tx.arcadeInvitation.update({ where: { id: row.id }, data: { status, resolvedAt: now } });
  await resolveArcadeInviteNotification(tx, row.id, now);
}
async function resolveArcadeInviteNotification(tx: Prisma.TransactionClient, id: string, now: Date) {
  await tx.notification.updateMany({ where: { domainKey: 'arcade', typeKey: 'ARCADE_INVITE', actionTargetId: id, state: { in: ['UNREAD', 'READ'] } }, data: { state: 'RESOLVED', resolvedAt: now } });
}

export class ArcadeInvitations {
  private readonly presence: PresenceService;
  constructor(private readonly database: PrismaClient, private readonly clock: Clock, private readonly seed = () => randomBytes(4).readUInt32LE()) {
    this.presence = new PresenceService(database, clock);
  }
  /** Reconcile under the same sorted locks as invitation/start/move, never from presence. */
  async reconcileNotificationsForPlayer(playerId: string, _now?: Date) {
    const rows = await this.database.arcadeInvitation.findMany({ where: { ...invitationParticipantWhere(playerId), status: 'PENDING' } });
    for (const candidate of rows) {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await this.database.$transaction(async tx => {
            await lockArcadePlayers(tx, [candidate.hostPlayerId, candidate.guestPlayerId]);
            const row = await tx.arcadeInvitation.findUniqueOrThrow({ where: { id: candidate.id } });
            if (row.status !== 'PENDING') return;
            const now = this.clock.now();
            if (row.expiresAt <= now) await resolveArcadeInvite(tx, row, 'EXPIRED', now);
            else if (!await validArcadePair(tx, row.hostPlayerId, row.guestPlayerId)) await resolveArcadeInvite(tx, row, 'INVALIDATED', now);
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
          break;
        } catch (error) { if (attempt < 4 && isPrismaConcurrencyCollision(error)) continue; throw error; }
      }
    }
    // Missing invitation references must not leave an actionable notification.
    await this.database.$transaction(async tx => {
      await lockArcadePlayers(tx, [playerId]);
      const pending = await tx.arcadeInvitation.findMany({ where: { guestPlayerId: playerId, status: 'PENDING' }, select: { id: true } });
      await tx.notification.updateMany({ where: { playerId, domainKey: 'arcade', typeKey: 'ARCADE_INVITE', state: { in: ['UNREAD', 'READ'] },
        OR: [{ actionTargetId: null }, { actionTargetId: { notIn: pending.map(row => row.id) } }] }, data: { state: 'RESOLVED', resolvedAt: this.clock.now() } });
    });
  }
  async pending(tx: Prisma.TransactionClient, playerId: string) {
    const row = await tx.arcadeInvitation.findFirst({ where: { ...invitationParticipantWhere(playerId), status: 'PENDING' }, include: invitationIdentities });
    return row ? projectInvitation(row, playerId) : null;
  }
  async opponents(playerId: string, friendsOnly: boolean) {
    await this.reconcileNotificationsForPlayer(playerId);
    const now = this.clock.now();
    // Query only identities with a recent actual connection/activity. Never load the directory.
    const rows = await this.database.player.findMany({ where: {
      id: { not: playerId }, status: 'ACTIVE', elementKey: { in: [...elementKeys] },
      AND: [privacyAllowedWhere(playerId, 'PRESENCE'), ...(friendsOnly ? [activeFriendOf(playerId)] : [])],
      sessions: { some: { endedAt: null, lastHeartbeatAt: { gt: new Date(now.getTime() - PRESENCE_CONNECTION_TIMEOUT_MS) }, lastActivityAt: { gt: new Date(now.getTime() - PRESENCE_AWAY_MS) } } },
      arcadeSessions: { none: { status: 'ACTIVE' } }, arcadeOpponentSessions: { none: { status: 'ACTIVE' } },
      arcadeInvitationsSent: { none: { status: 'PENDING', expiresAt: { gt: now } } }, arcadeInvitationsReceived: { none: { status: 'PENDING', expiresAt: { gt: now } } },
    }, select: { id: true, displayName: true }, orderBy: [{ displayName: 'asc' }, { id: 'asc' }], take: 100 });
    const visible = await this.presence.visibleFor(playerId, rows.map(row => row.id));
    return { opponents: rows.filter(row => visible.get(row.id) === 'ONLINE') };
  }
  async invite(playerId: string, input: ArcadeInviteInput): Promise<ArcadeInvitationMutation> {
    await this.reconcileNotificationsForPlayer(playerId);
    await this.reconcileNotificationsForPlayer(input.opponentPlayerId);
    return arcadeTransaction<ArcadeInvitationMutation>(this.database, this.clock, playerId, [input.opponentPlayerId], input.idempotencyKey,
      { action: 'INVITE', opponentPlayerId: input.opponentPlayerId, game: input.game, difficulty: input.difficulty, friendsOnly: input.friendsOnly, replaySessionId: input.replaySessionId ?? null },
      async (tx, _element, operationId, now) => {
        if (input.replaySessionId) {
          const previous = await tx.arcadeSession.findFirst({ where: { id: input.replaySessionId, ...participantWhere(playerId), mode: 'MULTIPLAYER', status: 'FINISHED', game: input.game, difficulty: input.difficulty } });
          if (!previous || (previous.playerId === playerId ? previous.opponentPlayerId : previous.playerId) !== input.opponentPlayerId) throw arcadeConflict('Cette revanche est indisponible.', 'ARCADE_OPPONENT_UNAVAILABLE');
        }
        if (!await validArcadePair(tx, playerId, input.opponentPlayerId) || await arcadeBusy(tx, playerId) || await arcadeBusy(tx, input.opponentPlayerId)) throw arcadeConflict('Ce joueur est indisponible. Actualisez Arcade.', 'ARCADE_OPPONENT_UNAVAILABLE');
        const presence = await this.presence.visibleFor(playerId, [input.opponentPlayerId], tx);
        const friend = !input.friendsOnly || await tx.player.count({ where: { id: input.opponentPlayerId, ...activeFriendOf(playerId) } });
        if (presence.get(input.opponentPlayerId) !== 'ONLINE' || !friend) throw arcadeConflict('Ce joueur est indisponible. Choisissez un autre adversaire.', 'ARCADE_OPPONENT_UNAVAILABLE');
        const row = await tx.arcadeInvitation.create({ data: { hostPlayerId: playerId, guestPlayerId: input.opponentPlayerId, game: input.game, difficulty: input.difficulty, createdAt: now, expiresAt: new Date(now.getTime() + 120000) }, include: invitationIdentities });
        await tx.notification.create({ data: { playerId: input.opponentPlayerId, domainKey: 'arcade', typeKey: 'ARCADE_INVITE', deduplicationKey: `arcade-invite:${row.id}`, actionKey: 'OPEN_ARCADE_INVITE', actionTargetId: row.id,
          payload: { invitationId: row.id, hostPlayerId: playerId, hostDisplayName: row.host.displayName, game: row.game, difficulty: row.difficulty, message: `${row.host.displayName} vous invite à jouer à ${arcadeGameNames[input.game]}.` }, createdAt: now } });
        return { response: { invitation: projectInvitation(row, playerId), operationId, alreadyProcessed: false }, invitationId: row.id };
      });
  }
  async act(playerId: string, id: string, input: ArcadeInviteAction): Promise<ArcadeInvitationMutation> {
    const candidate = await this.database.arcadeInvitation.findFirst({ where: { id, ...invitationParticipantWhere(playerId) } });
    if (!candidate) throw new AppError('Invitation introuvable.', 404, 'ARCADE_INVITATION_NOT_FOUND');
    const seed = this.seed();
    return arcadeTransaction<ArcadeInvitationMutation>(this.database, this.clock, playerId, [candidate.hostPlayerId, candidate.guestPlayerId], input.idempotencyKey, { action: input.kind, invitationId: id },
      async (tx, _element, operationId, now) => {
        let row = await tx.arcadeInvitation.findUniqueOrThrow({ where: { id }, include: invitationIdentities });
        if (input.kind === 'CANCEL' ? row.hostPlayerId !== playerId : row.guestPlayerId !== playerId) throw new AppError('Action interdite sur cette invitation.', 403, 'ARCADE_FORBIDDEN');
        if (row.status !== 'PENDING') throw arcadeConflict('Cette invitation est terminée.', 'ARCADE_INVITATION_STALE');
        if (row.expiresAt <= now || !await validArcadePair(tx, row.hostPlayerId, row.guestPlayerId)) {
          const status = row.expiresAt <= now ? 'EXPIRED' : 'INVALIDATED';
          await resolveArcadeInvite(tx, row, status, now);
          row = { ...row, status, resolvedAt: now };
          return { response: { invitation: projectInvitation(row, playerId), operationId, alreadyProcessed: false, unavailable: true }, invitationId: id };
        }
        if (input.kind === 'READY') {
          if (await arcadeBusy(tx, row.hostPlayerId, id) || await arcadeBusy(tx, row.guestPlayerId, id)) throw arcadeConflict('Une partie est déjà en cours.', 'ARCADE_ACTIVE_EXISTS');
          const session = await createArcadeSession(tx, row.hostPlayerId, row.game as ArcadeGame, row.difficulty as ArcadeDifficulty, seed, now, row.guestPlayerId);
          row = await tx.arcadeInvitation.update({ where: { id }, data: { status: 'STARTED', guestReady: true, resolvedAt: now, sessionId: session.id }, include: invitationIdentities });
        } else {
          const status = input.kind === 'CANCEL' ? 'CANCELLED' : 'REFUSED';
          await resolveArcadeInvite(tx, row, status, now);
          row = { ...row, status, resolvedAt: now };
          if (input.kind === 'REFUSE') await tx.notification.create({ data: { playerId: row.hostPlayerId, domainKey: 'arcade', typeKey: 'ARCADE_INVITE_REFUSED', deduplicationKey: `arcade-refused:${id}`,
            payload: { invitationId: id, message: `${row.guest.displayName} a refusé votre invitation à ${arcadeGameNames[row.game as ArcadeGame]}.` }, createdAt: now } });
        }
        await resolveArcadeInviteNotification(tx, id, now);
        return { response: { invitation: projectInvitation(row, playerId), operationId, alreadyProcessed: false }, invitationId: id, sessionId: row.sessionId ?? undefined };
      });
  }
}
