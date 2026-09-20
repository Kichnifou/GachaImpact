import { NotificationState, Prisma, type PrismaClient, type SourceChannel } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import { businessDateToDatabaseDate, getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import { PrismaEconomyService } from '../../infrastructure/database/prisma-economy-service.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { PlayerActivityRecorder } from '../player/player-activity-recorder.js';
import { unblockedRecipient } from './contact-permission.js';
import { randomInt } from 'node:crypto';
import { friendshipPhrases } from './friendship-phrases.js';

export type FriendAction = 'ADD' | 'ACCEPT' | 'REFUSE' | 'CANCEL' | 'REMOVE';
export type FriendshipSource = Extract<SourceChannel, 'UI' | 'INTERNAL_CHAT' | 'TWITCH'>;
export const friendSorts = ['presence', 'name', 'level', 'heart'] as const;
export type FriendSort = typeof friendSorts[number];
export type FriendMutationResult = { state: string; requestId?: string; friendshipId?: string };
export type HeartResult = { sent: number; alreadySent: number; unavailable: number; activeFriends: number; senderReward: string; recipientReward: string; status: 'SENT' | 'NO_FRIENDS' | 'ALL_SENT' | 'UNAVAILABLE'; level?: number; tier?: string; message?: string };
export const friendshipTier = (level: number) => level >= 1000 ? 'Amitié Parfaite' : level >= 300 ? 'Amitié Légendaire' : level >= 100 ? 'Amitié Fusionnelle' : 'Amitié Sincère';
const relationWhere = (playerId: string): Prisma.FriendshipWhereInput => ({ OR: [{ playerAId: playerId }, { playerBId: playerId }] });
const pair = (a: string, b: string) => { const ids = [a, b].sort(); return { playerAId: ids[0]!, playerBId: ids[1]! }; };
const unavailable = () => new AppError('Cette interaction est indisponible.', 409, 'SOCIAL_UNAVAILABLE');

/** Sole owner of friendship transitions and rewards, independently of transport. */
export class FriendshipService {
  constructor(private readonly database: PrismaClient, private readonly clock: Clock,
    private readonly economy = new PrismaEconomyService(), private readonly activity = new PlayerActivityRecorder()) {}

  private async transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.database.$transaction(async tx => {
          // A small alpha benefits from one short Social writer lock. Other domains
          // coordinate through Player rows, always acquired in ascending UUID order.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('social:friendship'))`;
          return run(tx);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 30_000 });
      } catch (error) { if (attempt < 5 && isPrismaConcurrencyCollision(error)) continue; throw error; }
    }
  }
  private async lockPlayers(tx: Prisma.TransactionClient, ids: string[]) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM players WHERE id IN (${Prisma.join([...new Set(ids)].sort().map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
  }
  private async requireActor(tx: Prisma.TransactionClient, id: string) {
    if (!await tx.player.findFirst({ where: { id, status: 'ACTIVE' }, select: { id: true } })) throw unavailable();
  }
  private async replay<T>(tx: Prisma.TransactionClient, playerId: string, key: string, source: SourceChannel, type: string, target: string): Promise<T | null> {
    const row = await tx.businessOperation.findFirst({ where: { sourceChannel: source, idempotencyKey: key } });
    if (!row) return null;
    const summary = row.resultSummary as { target?: string; result?: T } | null;
    if (row.playerId !== playerId || row.operationType !== type || row.status !== 'COMPLETED' || summary?.target !== target || !summary.result) throw new AppError('Cette clé appartient à une autre action.', 409, 'SOCIAL_IDEMPOTENCY_CONFLICT');
    return summary.result;
  }
  private async complete(tx: Prisma.TransactionClient, playerId: string, key: string, source: SourceChannel, type: string, target: string, result: FriendMutationResult | HeartResult, now: Date) {
    await tx.businessOperation.create({ data: { playerId, idempotencyKey: key, sourceChannel: source, operationType: type, status: 'COMPLETED', startedAt: now, completedAt: now, resultSummary: { target, result } } });
  }

  async mutate(playerId: string, target: string, action: FriendAction, key: string, source: FriendshipSource = 'UI', requestId?: string): Promise<FriendMutationResult> {
    if (!['UI', 'INTERNAL_CHAT', 'TWITCH'].includes(source)) throw unavailable();
    if (playerId === target) throw unavailable();
    return this.transaction(async tx => {
      await this.lockPlayers(tx, [playerId, target]);
      await this.requireActor(tx, playerId);
      const type = `friendship.${action.toLowerCase()}`;
      const intentTarget = requestId ? `${target}:${requestId}` : target;
      const replay = await this.replay<FriendMutationResult>(tx, playerId, key, source, type, intentTarget);
      if (replay) return replay;
      // Refuse/cancel/remove can close existing state even if contact is now blocked.
      if (action === 'ADD' || action === 'ACCEPT') {
        if (!await tx.player.findFirst({ where: { AND: [{ id: target }, unblockedRecipient(playerId)] }, select: { id: true } })) throw unavailable();
      }
      const now = this.clock.now(), playerPair = pair(playerId, target);
      const friendship = await tx.friendship.findUnique({ where: { playerAId_playerBId: playerPair } });
      const pending = await tx.friendRequest.findFirst({ where: { state: 'PENDING', OR: [{ senderPlayerId: playerId, recipientPlayerId: target }, { senderPlayerId: target, recipientPlayerId: playerId }] } });
      let result: FriendMutationResult;
      let changed = false;
      if (action === 'REMOVE') {
        if (!friendship) throw unavailable();
        if (friendship.state === 'ACTIVE') { await tx.friendship.update({ where: { id: friendship.id }, data: { state: 'ARCHIVED', archivedAt: now } }); changed = true; }
        result = { state: 'ARCHIVED', friendshipId: friendship.id };
      } else if (action === 'ADD' && friendship?.state === 'ACTIVE') {
        result = { state: 'ACTIVE', friendshipId: friendship.id };
      } else if (action === 'ADD' && (!pending || pending.senderPlayerId === playerId)) {
        const request = pending ?? await tx.friendRequest.create({ data: { senderPlayerId: playerId, recipientPlayerId: target, sourceChannel: source, createdAt: now } });
        changed = !pending; result = { state: 'PENDING', requestId: request.id };
        if (!pending) {
          const sender = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { displayName: true } });
          await tx.notification.create({ data: { playerId: target, domainKey: 'social', typeKey: 'FRIEND_REQUEST_RECEIVED', deduplicationKey: `friend-request:${request.id}`, payload: { senderPlayerId: playerId, senderDisplayName: sender.displayName }, actionKey: 'OPEN_SOCIAL_REQUESTS', actionTargetId: playerId, state: NotificationState.UNREAD, createdAt: now } });
        }
      } else {
        if (!pending || (requestId && pending.id !== requestId) || (action === 'CANCEL' ? pending.senderPlayerId !== playerId : pending.recipientPlayerId !== playerId)) throw unavailable();
        const state = action === 'REFUSE' ? 'REFUSED' : action === 'CANCEL' ? 'CANCELLED' : 'ACCEPTED';
        await tx.friendRequest.update({ where: { id: pending.id }, data: { state, resolvedAt: now } });
        await tx.notification.updateMany({ where: { deduplicationKey: `friend-request:${pending.id}`, state: { in: [NotificationState.UNREAD, NotificationState.READ] } }, data: { state: NotificationState.RESOLVED, resolvedAt: now } });
        changed = true; result = { state, requestId: pending.id };
        if (state === 'ACCEPTED') {
          const relation = await tx.friendship.upsert({ where: { playerAId_playerBId: playerPair }, create: { ...playerPair, level: 1, becameFriendsAt: now }, update: { state: 'ACTIVE', archivedAt: null } });
          result.friendshipId = relation.id;
        }
      }
      await this.complete(tx, playerId, key, source, type, intentTarget, result, now);
      if (changed) await this.activity.record(tx, playerId, now, source === 'TWITCH' ? 'TWITCH' : source === 'INTERNAL_CHAT' ? 'INTERNAL_CHAT' : 'APPLICATION');
      return result;
    });
  }

  async sendHearts(playerId: string, target: string | 'all', key: string, source: FriendshipSource = 'UI'): Promise<HeartResult> {
    if (!['UI', 'INTERNAL_CHAT', 'TWITCH'].includes(source)) throw unavailable();
    if (target === playerId) throw unavailable();
    return this.transaction(async tx => {
      const relations = await tx.friendship.findMany({ where: { ...relationWhere(playerId), state: 'ACTIVE', ...(target === 'all' ? {} : { AND: [{ OR: [{ playerAId: target }, { playerBId: target }] }] }) }, orderBy: { id: 'asc' } });
      await this.lockPlayers(tx, [playerId, ...relations.flatMap(r => [r.playerAId, r.playerBId])]);
      await this.requireActor(tx, playerId);
      const type = 'friendship.hearts';
      const replay = await this.replay<HeartResult>(tx, playerId, key, source, type, target);
      if (replay) return replay;
      if (target !== 'all' && !relations.length) throw unavailable();
      const now = this.clock.now(), date = businessDateToDatabaseDate(getBusinessDate(now));
      const eligible = new Set((await tx.player.findMany({ where: { AND: [unblockedRecipient(playerId), { id: { in: relations.map(r => r.playerAId === playerId ? r.playerBId : r.playerAId) } }] }, select: { id: true } })).map(p => p.id));
      const existing = new Set((await tx.friendHeart.findMany({ where: { senderPlayerId: playerId, businessDate: date, friendshipId: { in: relations.map(r => r.id) } }, select: { friendshipId: true } })).map(h => h.friendshipId));
      const result: HeartResult = { sent: 0, alreadySent: 0, unavailable: 0, activeFriends: relations.length, senderReward: '0', recipientReward: '5', status: 'NO_FRIENDS' };
      for (const relation of relations) {
        const recipient = relation.playerAId === playerId ? relation.playerBId : relation.playerAId;
        if (!eligible.has(recipient)) { if (target !== 'all') throw unavailable(); result.unavailable++; continue; }
        if (existing.has(relation.id)) { result.alreadySent++; continue; }
        const level = Math.min(1000, relation.level + 1);
        const operation = await tx.businessOperation.create({ data: { playerId, operationType: 'friendship.heart', sourceChannel: source, status: 'COMPLETED', startedAt: now, completedAt: now, resultSummary: { friendshipId: relation.id, recipientPlayerId: recipient, businessDate: getBusinessDate(now) } } });
        await tx.friendHeart.create({ data: { friendshipId: relation.id, senderPlayerId: playerId, recipientPlayerId: recipient, businessDate: date, operationId: operation.id, createdAt: now } });
        await tx.friendship.update({ where: { id: relation.id }, data: { level, totalHearts: { increment: 1n } } });
        for (const beneficiary of [playerId, recipient].sort()) await this.economy.credit(tx, { playerId: beneficiary, playerElementKey: null, resourceKey: 'primogems', amount: 5n, causeKey: 'friendship.heart', domainKey: 'social', operationId: operation.id, sourceChannel: source });
        result.sent++; if (target !== 'all') { result.level = level; result.tier = friendshipTier(level); }
      }
      if (result.sent) {
        await tx.playerSocialStats.upsert({ where: { playerId }, create: { playerId, totalFriendHeartsSent: BigInt(result.sent) }, update: { totalFriendHeartsSent: { increment: BigInt(result.sent) } } });
        await this.activity.record(tx, playerId, now, source === 'TWITCH' ? 'TWITCH' : source === 'INTERNAL_CHAT' ? 'INTERNAL_CHAT' : 'APPLICATION');
      }
      result.senderReward = String(result.sent * 5);
      if (target !== 'all' && result.sent) {
        const participants = await tx.player.findMany({ where: { id: { in: [playerId, target] } }, select: { id: true, displayName: true } });
        result.message = `${participants.find(p => p.id === playerId)!.displayName} envoie un cœur à ${participants.find(p => p.id === target)!.displayName} : ${friendshipPhrases[randomInt(friendshipPhrases.length)]}`;
      }
      result.status = result.sent ? 'SENT' : !relations.length ? 'NO_FRIENDS' : result.unavailable ? 'UNAVAILABLE' : 'ALL_SENT';
      await this.complete(tx, playerId, key, source, type, target, result, now);
      return result;
    });
  }

  async snapshot(playerId: string) {
    const now = this.clock.now(), date = businessDateToDatabaseDate(getBusinessDate(now));
    return this.database.$transaction(async tx => {
      const [relations, requests, hearts, eligible, stats, preference] = await Promise.all([
        tx.friendship.findMany({ where: { ...relationWhere(playerId), state: 'ACTIVE' } }),
        tx.friendRequest.findMany({ where: { state: 'PENDING', OR: [{ senderPlayerId: playerId }, { recipientPlayerId: playerId }] }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
        tx.friendHeart.findMany({ where: { senderPlayerId: playerId, businessDate: date }, select: { friendshipId: true } }),
        tx.player.findMany({ where: unblockedRecipient(playerId), select: { id: true } }),
        tx.playerSocialStats.findUnique({ where: { playerId } }),
        tx.playerPreference.findUnique({ where: { playerId_preferenceKey: { playerId, preferenceKey: 'friend_sort_v1' } } }),
      ]);
      const sent = new Set(hearts.map(h => h.friendshipId)), allowed = new Set(eligible.map(p => p.id));
      const friends = relations.map(r => { const target = r.playerAId === playerId ? r.playerBId : r.playerAId; return { id: r.id, playerId: target, level: r.level, tier: friendshipTier(r.level), totalHearts: r.totalHearts.toString(), heartSent: sent.has(r.id), canSend: !sent.has(r.id) && allowed.has(target) }; });
      return { businessDate: getBusinessDate(now), friends, requests: requests.map(r => ({ id: r.id, playerId: r.senderPlayerId === playerId ? r.recipientPlayerId : r.senderPlayerId, direction: r.senderPlayerId === playerId ? 'SENT' as const : 'RECEIVED' as const, createdAt: r.createdAt.toISOString() })), totalFriendHeartsSent: stats?.totalFriendHeartsSent.toString() ?? '0', sort: friendSorts.includes(preference?.value as FriendSort) ? preference!.value as FriendSort : 'presence' as FriendSort, summary: { activeFriends: friends.length, available: friends.filter(r => r.canSend).length, alreadySent: friends.filter(r => r.heartSent).length } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async saveSort(playerId: string, sort: FriendSort) {
    await this.database.playerPreference.upsert({ where: { playerId_preferenceKey: { playerId, preferenceKey: 'friend_sort_v1' } }, create: { playerId, preferenceKey: 'friend_sort_v1', value: sort }, update: { value: sort } });
    return { sort };
  }
}
