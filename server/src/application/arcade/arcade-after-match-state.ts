import { createHash } from 'node:crypto';
import type { ArcadeSession, Prisma } from '../../../generated/prisma/client.js';
export const AFTER_MATCH_GRACE_MS = 5000;
export type ArcadeAfterMatchState = { status: 'WAITING' | 'CANCELLED' | 'STARTED'; revision: number; hostReady: boolean; guestReady: boolean;
  graceUntil: number; nextSessionId: string | null; tabs: Record<string, { playerId: string; sequence: number; visible: boolean; until: number }> };
export function initialAfterMatch(now: Date): ArcadeAfterMatchState { return { status: 'WAITING', revision: 1, hostReady: false, guestReady: false, graceUntil: +now + AFTER_MATCH_GRACE_MS, nextSessionId: null, tabs: {} } }
export function readAfterMatch(value: Prisma.JsonValue | null | undefined): ArcadeAfterMatchState | null {
  if (value == null) return null;
  const row = value as unknown as ArcadeAfterMatchState;
  if (!row || !['WAITING', 'CANCELLED', 'STARTED'].includes(row.status) || !Number.isSafeInteger(row.revision) || row.revision < 1
    || typeof row.hostReady !== 'boolean' || typeof row.guestReady !== 'boolean' || !Number.isSafeInteger(row.graceUntil)
    || !row.tabs || typeof row.tabs !== 'object' || Array.isArray(row.tabs) || Object.keys(row.tabs).length > 32
    || row.nextSessionId !== null && typeof row.nextSessionId !== 'string') throw Error('ARCADE_AFTER_MATCH_STATE_INVALID');
  for (const [key, tab] of Object.entries(row.tabs)) if (!/^[a-f0-9]{64}$/.test(key) || !tab || typeof tab.playerId !== 'string'
    || !Number.isSafeInteger(tab.sequence) || typeof tab.visible !== 'boolean' || !Number.isSafeInteger(tab.until)) throw Error('ARCADE_AFTER_MATCH_STATE_INVALID');
  return structuredClone(row);
}
export function afterMatchDeadline(state: ArcadeAfterMatchState, host: string, guest: string): Date {
  const until = (id: string) => Math.max(state.graceUntil, ...Object.values(state.tabs).filter(tab => tab.playerId === id).map(tab => tab.until));
  return new Date(Math.min(until(host), until(guest)));
}
export function afterMatchExpired(row: Pick<ArcadeSession, 'afterMatchExpiresAt'>, now: Date): boolean { return !!row.afterMatchExpiresAt && row.afterMatchExpiresAt < now }
export function cancelAfterMatch(state: ArcadeAfterMatchState): void { state.status = 'CANCELLED'; state.hostReady = false; state.guestReady = false; state.revision++; state.tabs = {} }
export function afterMatchTabKey(playerId: string, tabKey: string): string { return createHash('sha256').update(playerId + ':' + tabKey).digest('hex') }
export function touchAfterMatch(state: ArcadeAfterMatchState, playerId: string, tabKey: string, sequence: number, visible: boolean, now: Date): boolean {
  const key = afterMatchTabKey(playerId, tabKey), previous = state.tabs[key];
  if (previous && previous.sequence >= sequence) return false;
  // Retain sequence tombstones throughout the window so a delayed tab cannot revive itself.
  if (!previous && Object.values(state.tabs).filter(tab => tab.playerId === playerId).length >= 16) throw Error('ARCADE_AFTER_MATCH_TAB_LIMIT');
  state.tabs[key] = { playerId, sequence, visible, until: +now + AFTER_MATCH_GRACE_MS }; state.revision++; return true;
}
export function projectAfterMatch(row: Pick<ArcadeSession, 'afterMatch' | 'afterMatchExpiresAt' | 'playerId'>, viewer: string, now: Date) {
  const state = readAfterMatch(row.afterMatch); if (!state) return null;
  const expired = state.status === 'WAITING' && afterMatchExpired(row, now);
  return { status: expired ? 'CANCELLED' as const : state.status, revision: state.revision + (expired ? 1 : 0),
    requested: !expired && (viewer === row.playerId ? state.hostReady : state.guestReady), opponentRequested: !expired && (viewer === row.playerId ? state.guestReady : state.hostReady) };
}
