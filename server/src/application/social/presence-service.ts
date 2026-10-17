import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import { getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import { AppError } from '../../api/errors.js';
import { PlayerActivityRecorder } from '../player/player-activity-recorder.js';
import { privacyAllowedWhere } from './privacy-service.js';

export const PRESENCE_AWAY_MS = 10 * 60_000;
export const PRESENCE_INACTIVE_MS = 2 * 60 * 60_000;
export const PRESENCE_CONNECTION_TIMEOUT_MS = 3 * 60_000;
export type PresenceStatus = 'ONLINE' | 'AWAY' | 'OFFLINE';
type Session = { startedAt?: Date; endedAt: Date | null; lastHeartbeatAt: Date; lastActivityAt: Date | null };
export function derivePresence(sessions: readonly Session[], now: Date): PresenceStatus {
  // A confirmed connection is the initial baseline, never a fabricated user activity.
  const activityAt = (session: Session) => session.lastActivityAt ?? session.startedAt
  const recent = sessions.filter(s => !s.endedAt && now.getTime() - s.lastHeartbeatAt.getTime() < PRESENCE_CONNECTION_TIMEOUT_MS && activityAt(s) && now.getTime() - activityAt(s)!.getTime() < PRESENCE_INACTIVE_MS);
  if (!recent.length) return 'OFFLINE';
  return recent.some(s => now.getTime() - activityAt(s)!.getTime() < PRESENCE_AWAY_MS) ? 'ONLINE' : 'AWAY';
}

export class PresenceService {
  constructor(private readonly database: PrismaClient, private readonly clock: Clock) {}
  /** Two batched queries, independent of Arcade and shared by all presence consumers. */
  async visibleFor(viewer: string, ids: readonly string[], db: PrismaClient | Prisma.TransactionClient = this.database) {
    if (!ids.length) return new Map<string, PresenceStatus>();
    const owners = await db.player.findMany({ where: { id: { in: [...ids] }, status: 'ACTIVE', ...privacyAllowedWhere(viewer, 'PRESENCE') }, select: { id: true } });
    const now = this.clock.now();
    const sessions = await db.playerSession.findMany({ where: { playerId: { in: owners.map(p => p.id) }, endedAt: null, lastHeartbeatAt: { gt: new Date(now.getTime() - PRESENCE_CONNECTION_TIMEOUT_MS) } }, select: { playerId: true, startedAt: true, endedAt: true, lastHeartbeatAt: true, lastActivityAt: true } });
    const grouped = new Map<string, typeof sessions>();
    for (const session of sessions) { const list = grouped.get(session.playerId) ?? []; list.push(session); grouped.set(session.playerId, list); }
    return new Map(owners.map(p => [p.id, derivePresence(grouped.get(p.id) ?? [], now)]));
  }
  private hash(playerId: string, key: string) { return createHash('sha256').update(`${playerId}:${key}`).digest('hex'); }
  async touch(playerId: string, key: string, activity: boolean, start = false) {
    const sessionTokenHash = this.hash(playerId, key);
    return this.database.$transaction(async tx => {
      // Serializes start/heartbeat/end for this tab, using server time after locking.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`presence:${playerId}`}))`;
      const now = this.clock.now();
      const row = await tx.playerSession.findUnique({ where: { sessionTokenHash } });
      if (row?.endedAt || (!row && !start)) throw new AppError('Session de présence terminée.', 409, 'PRESENCE_SESSION_ENDED');
      // Heartbeats never advance user activity. Client coalesces interactions; server bounds writes too.
      const recordActivity = activity && (!row?.lastActivityAt || getBusinessDate(now) !== getBusinessDate(row.lastActivityAt) || now.getTime() - row.lastActivityAt.getTime() >= 15_000);
      if (!row) await tx.playerSession.create({ data: { playerId, sessionTokenHash, startedAt: now, lastHeartbeatAt: now, lastActivityAt: activity ? now : null } });
      else await tx.playerSession.update({ where: { id: row.id }, data: { lastHeartbeatAt: now, ...(start ? { endedAt: null } : {}), ...(recordActivity ? { lastActivityAt: now } : {}) } });
      if (recordActivity) await new PlayerActivityRecorder().record(tx, playerId, now, 'APPLICATION');
      return { serverTime: now.toISOString() };
    });
  }
  async end(playerId: string, key: string) {
    const hash = this.hash(playerId, key);
    await this.database.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`presence:${playerId}`}))`;
      const now = this.clock.now();
      // A tombstone also closes a start request still in flight during logout.
      await tx.playerSession.upsert({ where: { sessionTokenHash: hash }, create: { playerId, sessionTokenHash: hash, startedAt: now, lastHeartbeatAt: now, endedAt: now }, update: { endedAt: now } });
    });
    return { ended: true };
  }
}
