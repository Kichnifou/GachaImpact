import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { Clock } from '../../domain/time/business-date.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { derivePlayerProgression } from '../../domain/player/player-progression.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { PrismaBoxStore } from '../../infrastructure/database/prisma-box-store.js';
import { PrismaTeamStore } from '../../infrastructure/database/prisma-team-store.js';
import { PrismaInventoryStore } from '../../infrastructure/database/prisma-inventory-store.js';
import { AppError } from '../../api/errors.js';
import { PrivacyService, privacyAllowedWhere } from './privacy-service.js';
import { PresenceService, derivePresence, PRESENCE_CONNECTION_TIMEOUT_MS } from './presence-service.js';

export type SocialQuery = { q: string; element?: string; page: number };
export type Access<T> = { access: 'PRIVATE' } | { access: 'ALLOWED'; data: T };
const hidden = { access: 'PRIVATE' } as const;
const allowed = <T>(data: T): Access<T> => ({ access: 'ALLOWED', data });
export const normalizePlayerSearch = (value: string) => value.trim().normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr-FR');

export class SocialService {
  readonly privacy: PrivacyService;
  readonly presence: PresenceService;
  constructor(private readonly getPlayer: GetCurrentPlayer, private readonly database: PrismaClient, private readonly clock: Clock) {
    this.privacy = new PrivacyService(database);
    this.presence = new PresenceService(database, clock);
  }
  async actor(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    if (player.status !== 'ACTIVE') throw new AppError('Compte indisponible.', 403, 'PLAYER_INACTIVE');
    return player;
  }
  private async identities(element?: string) {
    const rows = await this.database.player.findMany({ where: { status: 'ACTIVE', ...(element ? { elementKey: element } : {}) }, select: { id: true, displayName: true, elementKey: true, progression: true } });
    return rows.map(row => ({ id: row.id, displayName: row.displayName, elementKey: row.elementKey && isElementKey(row.elementKey) ? row.elementKey : null, level: row.progression ? derivePlayerProgression(row.progression).level : 0 }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' }) || a.id.localeCompare(b.id));
  }
  private async visiblePresence(viewer: string, ids: string[]) {
    const owners = await this.database.player.findMany({ where: { id: { in: ids }, ...privacyAllowedWhere(viewer, 'PRESENCE') }, select: { id: true } });
    const now = this.clock.now();
    const sessions = await this.database.playerSession.findMany({ where: { playerId: { in: owners.map(p => p.id) }, endedAt: null, lastHeartbeatAt: { gt: new Date(now.getTime() - PRESENCE_CONNECTION_TIMEOUT_MS) } }, select: { playerId: true, endedAt: true, lastHeartbeatAt: true, lastActivityAt: true } });
    const byPlayer = new Map<string, typeof sessions>();
    for (const session of sessions) { const list = byPlayer.get(session.playerId) ?? []; list.push(session); byPlayer.set(session.playerId, list); }
    return new Map(owners.map(p => [p.id, derivePresence(byPlayer.get(p.id) ?? [], now)]));
  }
  async directory(identity: AuthenticatedIdentity, query: SocialQuery) {
    const viewer = await this.actor(identity);
    // Same accent/case/substring semantics as the existing Player browser. Only identities
    // are scanned; private reads are batched for the requested page, never per Player.
    const needle = normalizePlayerSearch(query.q);
    const identities = (await this.identities(query.element)).filter(p => normalizePlayerSearch(p.displayName).includes(needle));
    const totalPages = Math.max(1, Math.ceil(identities.length / 20));
    const page = Math.min(query.page, totalPages);
    const rows = identities.slice((page - 1) * 20, page * 20);
    const presence = await this.visiblePresence(viewer.id, rows.map(p => p.id));
    return { players: rows.map(p => ({ ...p, presence: presence.has(p.id) ? allowed(presence.get(p.id)!) : hidden })), page, pageSize: 20, total: identities.length, totalPages };
  }
  async connected(identity: AuthenticatedIdentity) {
    const viewer = await this.actor(identity);
    const rows = await this.identities();
    const statuses = await this.visiblePresence(viewer.id, rows.map(p => p.id));
    const players = rows.flatMap(p => { const status = statuses.get(p.id); return status && status !== 'OFFLINE' ? [{ ...p, status }] : []; });
    players.sort((a, b) => Number(a.status === 'AWAY') - Number(b.status === 'AWAY') || a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' }));
    return { players, total: players.length };
  }
  async profile(identity: AuthenticatedIdentity, playerId: string) {
    const viewer = await this.actor(identity);
    const row = await this.database.player.findFirst({ where: { id: playerId, status: 'ACTIVE' }, select: { id: true, displayName: true, elementKey: true, progression: true } });
    if (!row) throw new AppError('Joueur introuvable.', 404, 'PLAYER_NOT_FOUND');
    const permissions = await this.privacy.permissions(playerId, viewer.id);
    const [presence, activity, team, box, collection, statistics] = await Promise.all([
      permissions.PRESENCE ? this.visiblePresence(viewer.id, [playerId]).then(m => allowed(m.get(playerId)!)) : hidden,
      permissions.LAST_ACTIVITY ? this.database.playerActivityState.findUnique({ where: { playerId }, select: { lastAppActivityAt: true } }).then(r => allowed(r?.lastAppActivityAt?.toISOString() ?? null)) : hidden,
      permissions.ACTIVE_TEAM ? new PrismaTeamStore(this.database).readActive(playerId).then(allowed) : hidden,
      permissions.BOX ? new PrismaBoxStore(this.database).listProfilePossessions(playerId).then(rows => allowed(rows.map(c => ({ ...c, firstObtainedAt: c.firstObtainedAt.toISOString() })))) : hidden,
      permissions.COLLECTION ? new PrismaInventoryStore(this.database).getCollection(playerId).then(items => allowed(items.map(i => ({ ...i, quantity: i.quantity.toString(), firstObtainedAt: i.firstObtainedAt?.toISOString() ?? null })))) : hidden,
      permissions.GENERAL_STATISTICS ? this.statistics(playerId).then(allowed) : hidden,
    ]);
    return { player: { id: row.id, displayName: row.displayName, elementKey: row.elementKey, level: row.progression ? derivePlayerProgression(row.progression).level : 0 }, own: viewer.id === playerId, presence, lastActivity: activity, team, box, collection, statistics };
  }
  private async statistics(playerId: string) {
    const [progression, gacha, combat, expedition] = await Promise.all([
      this.database.playerProgression.findUnique({ where: { playerId }, select: { xp: true } }),
      this.database.playerGachaState.findUnique({ where: { playerId }, select: { totalPulls: true, totalFiveStars: true, totalFourStars: true } }),
      this.database.playerCombatStats.findUnique({ where: { playerId }, select: { totalWins: true } }),
      this.database.playerExpedition.findUnique({ where: { playerId }, select: { totalCompleted: true } }),
    ]);
    return { totalXp: progression?.xp.toString() ?? null, totalPulls: gacha?.totalPulls.toString() ?? null, totalFiveStars: gacha?.totalFiveStars.toString() ?? null, totalFourStars: gacha?.totalFourStars.toString() ?? null, combatWins: combat?.totalWins.toString() ?? null, expeditionsCompleted: expedition?.totalCompleted.toString() ?? null };
  }
}
