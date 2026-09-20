import { createHash } from 'node:crypto';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { AppError } from '../../api/errors.js';

export const PRESENCE_AWAY_MS = 10 * 60_000;
export const PRESENCE_INACTIVE_MS = 2 * 60 * 60_000;
export const PRESENCE_CONNECTION_TIMEOUT_MS = 3 * 60_000;
export type PresenceStatus = 'ONLINE' | 'AWAY' | 'OFFLINE';
type Session = { endedAt: Date | null; lastHeartbeatAt: Date; lastActivityAt: Date | null };
export function derivePresence(sessions: readonly Session[], now: Date): PresenceStatus {
  const recent = sessions.filter(s => !s.endedAt && now.getTime() - s.lastHeartbeatAt.getTime() < PRESENCE_CONNECTION_TIMEOUT_MS && s.lastActivityAt && now.getTime() - s.lastActivityAt.getTime() < PRESENCE_INACTIVE_MS);
  if (!recent.length) return 'OFFLINE';
  return recent.some(s => now.getTime() - s.lastActivityAt!.getTime() < PRESENCE_AWAY_MS) ? 'ONLINE' : 'AWAY';
}

export class PresenceService {
  constructor(private readonly database: PrismaClient, private readonly clock: Clock) {}
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
      const recordActivity = activity && (!row?.lastActivityAt || now.getTime() - row.lastActivityAt.getTime() >= 15_000);
      if (!row) await tx.playerSession.create({ data: { playerId, sessionTokenHash, startedAt: now, lastHeartbeatAt: now, lastActivityAt: activity ? now : null } });
      else await tx.playerSession.update({ where: { id: row.id }, data: { lastHeartbeatAt: now, ...(start ? { endedAt: null } : {}), ...(recordActivity ? { lastActivityAt: now } : {}) } });
      if (recordActivity) await tx.playerActivityState.upsert({ where: { playerId }, create: { playerId, lastAppActivityAt: now, updatedAt: now }, update: { lastAppActivityAt: now, updatedAt: now } });
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
