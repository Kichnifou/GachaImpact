import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { FriendshipService } from '../src/application/social/friendship-service.js';
import { PlayerActivityRecorder } from '../src/application/player/player-activity-recorder.js';
import { PresenceService } from '../src/application/social/presence-service.js';
import { PrivacyService } from '../src/application/social/privacy-service.js';
import { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';
import { SocialService } from '../src/application/social/social-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { EventService } from '../src/application/event/event-service.js';
import { buildApp } from '../src/app.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { PermanentMissionService } from '../src/application/missions/permanent-mission-service.js';

const fixture = isolatedBatchDatabase(), { database: db } = fixture;
let now = new Date('2026-09-20T12:00:00Z');
const clock = { now: () => now }, service = new FriendshipService(db, clock);
const privacy = new PrivacyService(db);
const social = new SocialService(new GetCurrentPlayer({ findByIdentity: async (_provider, id) => { const p = await db.player.findUnique({ where: { id } }); return p ? { id: p.id, displayName: p.displayName, elementKey: null, status: p.status } : null; }, provision: async () => { throw Error('No provisioning'); } }), db, clock);
beforeAll(async () => {
  await fixture.setup();
  const sql = readFileSync('prisma/migrations/20260920210000_029_add_friendship_workflows/migration.sql', 'utf8');
  // Prisma's schema diff omits CHECKs, partial indexes and triggers. Exercise the
  // actual migration's additional SQL in this UUID schema as well.
  await fixture.admin.query(sql.slice(sql.indexOf('-- The minimal')).replace('DROP CONSTRAINT "friendships_level_check"', 'DROP CONSTRAINT IF EXISTS "friendships_level_check"'));
  const hardening = readFileSync('prisma/migrations/20260920220000_030_harden_friend_heart_trigger_search_path/migration.sql', 'utf8')
    // The production migration fixes public. The fixture has its own schema, so adapt
    // only those schema identifiers before exercising the identical hardening there.
    .replace('public.check_friend_heart_pair()', `"${fixture.schema}".check_friend_heart_pair()`)
    .replace('pg_catalog, public', `pg_catalog, ${fixture.schema}`);
  await fixture.admin.query(hardening);
  const configuration = await fixture.admin.query<{ proconfig: string[] | null }>('SELECT p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1 AND p.proname = $2', [fixture.schema, 'check_friend_heart_pair']);
  expect(configuration.rows[0]?.proconfig).toEqual([`search_path=pg_catalog, ${fixture.schema}`]);
  await db.resourceDefinition.create({ data: { key: 'primogems', displayName: 'Primogemmes', category: 'currency' } });
}, 60_000);
afterAll(async () => { await fixture.cleanup(); }, 60_000);
const player = async () => {
  const p = await db.player.create({ data: { displayName: `Ami ${randomUUID()}` } });
  await db.playerResourceBalance.create({ data: { playerId: p.id, resourceKey: 'primogems', amount: 0n } });
  await db.playerEconomyStats.create({ data: { playerId: p.id } });
  await db.$transaction(tx => new PermanentMissionService().initializePlayer(tx, p.id, now, true));
  return p.id;
};
async function befriend(a: string, b: string) { await service.mutate(a, b, 'ADD', randomUUID()); return service.mutate(b, a, 'ACCEPT', randomUUID()); }
const balance = async (id: string) => (await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: id, resourceKey: 'primogems' } } })).amount;
const sent = async (id: string) => (await db.playerSocialStats.findUnique({ where: { playerId: id } }))?.totalFriendHeartsSent ?? 0n;

describe('Friendship isolated PostgreSQL', () => {
  it('authenticates REST mutations, rejects client ownership and stale request IDs, and sends no-store projections', async () => {
    const a = await player(), b = await player();
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async token => ({ subject: token }) }, getOrProvisionCurrentPlayer: {} as GetOrProvisionCurrentPlayer, socialService: social });
    try {
      const call = (subject: string, payload: object) => app.inject({ method: 'POST', url: '/api/v1/me/friends/actions', headers: { authorization: `Bearer ${subject}` }, payload });
      expect((await app.inject({ method: 'GET', url: '/api/v1/me/friends' })).statusCode).toBe(401);
      expect((await call(a, { playerId: b, targetPlayerId: b, action: 'ADD', idempotencyKey: randomUUID() })).statusCode).toBe(400);
      const request = await call(a, { targetPlayerId: b, action: 'ADD', idempotencyKey: randomUUID() }); expect(request.statusCode).toBe(200);
      expect((await call(b, { targetPlayerId: a, action: 'ACCEPT', idempotencyKey: randomUUID() })).statusCode).toBe(400);
      expect((await call(b, { targetPlayerId: a, action: 'ACCEPT', idempotencyKey: randomUUID(), requestId: randomUUID() })).statusCode).toBe(409);
      expect((await call(b, { targetPlayerId: a, action: 'ACCEPT', idempotencyKey: randomUUID(), requestId: request.json().requestId })).statusCode).toBe(200);
      const result = await app.inject({ method: 'GET', url: '/api/v1/me/friends', headers: { authorization: `Bearer ${a}` } });
      expect(result.headers['cache-control']).toBe('no-store'); expect(result.json().friends).toHaveLength(1);
    } finally { await app.close(); }
  }, 30_000);
  it('cannot pass a concurrent committed block or attribute a system action to the player', async () => {
    const a = await player(), b = await player(); await befriend(a, b);
    let locked!: () => void, release!: () => void;
    const ready = new Promise<void>(resolve => { locked = resolve });
    const gate = new Promise<void>(resolve => { release = resolve });
    const blocking = db.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM players WHERE id IN (${a}::uuid, ${b}::uuid) ORDER BY id FOR UPDATE`; await tx.playerBlock.create({ data: { blockerPlayerId: b, blockedPlayerId: a } }); locked(); await gate; });
    await ready;
    const sending = service.sendHearts(a, b, randomUUID()); release(); await blocking;
    await expect(sending).rejects.toThrow(); expect(await balance(a)).toBe(0n);
    // A runtime guard supplements the transport-level source type.
    await expect(service.mutate(a, b, 'REMOVE', randomUUID(), 'SYSTEM' as 'UI')).rejects.toThrow();
    expect((await service.snapshot(a)).friends).toHaveLength(1);
  }, 30_000);
  it('creates, deduplicates and replays requests; rejects self, inactive and missing players', async () => {
    const a = await player(), b = await player(), key = randomUUID();
    const first = await service.mutate(a, b, 'ADD', key);
    expect(first.state).toBe('PENDING');
    expect(await service.mutate(a, b, 'ADD', key)).toEqual(first);
    expect(await service.mutate(a, b, 'ADD', randomUUID())).toEqual(first);
    const notifications = await db.notification.findMany({ where: { playerId: b, domainKey: 'social' } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ typeKey: 'FRIEND_REQUEST_RECEIVED', actionKey: 'OPEN_SOCIAL_REQUESTS', actionTargetId: a, state: 'UNREAD' });
    await expect(service.mutate(a, a, 'ADD', randomUUID())).rejects.toThrow();
    await expect(service.mutate(a, randomUUID(), 'ADD', randomUUID())).rejects.toThrow();
    await db.player.update({ where: { id: b }, data: { status: 'SUSPENDED' } });
    await expect(service.mutate(a, b, 'ADD', randomUUID())).rejects.toThrow();
    await expect(service.mutate(a, await player(), 'ADD', key)).rejects.toThrow();
  }, 30_000);
  it('accepts reciprocal requests and serializes genuinely concurrent opposite requests', async () => {
    const a = await player(), b = await player();
    const results = await Promise.all([service.mutate(a, b, 'ADD', randomUUID()), service.mutate(b, a, 'ADD', randomUUID())]);
    expect(results.map(r => r.state).sort()).toEqual(['ACCEPTED', 'PENDING']);
    expect((await service.snapshot(a)).friends).toHaveLength(1);
    expect((await service.snapshot(a)).requests).toHaveLength(0);
    expect((await service.mutate(a, b, 'ADD', randomUUID())).state).toBe('ACTIVE');
  }, 30_000);
  it('notifies only the sender when a pending request is accepted', async () => {
    const a = await player(), b = await player();
    const request = await service.mutate(a, b, 'ADD', randomUUID());
    await service.mutate(b, a, 'ACCEPT', randomUUID(), 'UI', request.requestId);
    const accepted = await db.notification.findMany({ where: { deduplicationKey: `friend-request-accepted:${request.requestId}` } });
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({ playerId: a, typeKey: 'FRIEND_REQUEST_ACCEPTED', actionKey: 'OPEN_SOCIAL_FRIENDS', actionTargetId: b, state: 'UNREAD' });
    await service.sendHearts(a, b, randomUUID());
    expect(await db.notification.count({ where: { playerId: a, domainKey: 'social' } })).toBe(1);
    const c = await player(), d = await player(); const refused = await service.mutate(c, d, 'ADD', randomUUID());
    await service.mutate(d, c, 'REFUSE', randomUUID(), 'UI', refused.requestId);
    expect(await db.notification.count({ where: { deduplicationKey: `friend-request-accepted:${refused.requestId}` } })).toBe(0);
  }, 30_000);
  it('authorizes recipient/sender transitions, retains resolutions and gives only one concurrent transition the win', async () => {
    const a = await player(), b = await player();
    const request = await service.mutate(a, b, 'ADD', randomUUID());
    await expect(service.mutate(a, b, 'ACCEPT', randomUUID())).rejects.toThrow();
    await expect(service.mutate(b, a, 'CANCEL', randomUUID())).rejects.toThrow();
    const results = await Promise.allSettled([service.mutate(b, a, 'ACCEPT', randomUUID(), 'UI', request.requestId), service.mutate(b, a, 'REFUSE', randomUUID(), 'UI', request.requestId), service.mutate(a, b, 'CANCEL', randomUUID(), 'UI', request.requestId)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.friendRequest.findUniqueOrThrow({ where: { id: request.requestId! } })).state).not.toBe('PENDING');
    expect((await db.notification.findUniqueOrThrow({ where: { deduplicationKey: `friend-request:${request.requestId}` } })).state).toBe('RESOLVED');
    for (const action of ['REFUSE', 'CANCEL'] as const) {
      const c = await player(), d = await player();
      await service.mutate(c, d, 'ADD', randomUUID());
      const key = randomUUID(), sender = action === 'REFUSE' ? d : c, target = action === 'REFUSE' ? c : d;
      const result = await service.mutate(sender, target, action, key);
      expect(await service.mutate(sender, target, action, key)).toEqual(result);
      expect(result.state).toBe(action === 'REFUSE' ? 'REFUSED' : 'CANCELLED');
    }
  }, 30_000);
  it('credits both ledgers and earned stats, cumulative outgoing stats and common progression exactly once per Paris day', async () => {
    const a = await player(), b = await player(); await befriend(a, b);
    const notificationCount = await db.notification.count();
    const key = randomUUID(), first = await service.sendHearts(a, b, key);
    expect(first).toMatchObject({ sent: 1, senderReward: '5', level: 2 });
    expect(await service.sendHearts(a, b, key)).toEqual(first);
    expect((await service.sendHearts(a, b, randomUUID())).alreadySent).toBe(1);
    expect(await db.notification.count()).toBe(notificationCount);
    expect(await balance(a)).toBe(5n); expect(await balance(b)).toBe(5n);
    expect(await sent(a)).toBe(1n); expect(await sent(b)).toBe(0n);
    expect((await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId: a } })).totalPrimosEarned).toBe(5n);
    expect(await db.resourceMovement.count({ where: { playerId: { in: [a, b] } } })).toBe(2);
    expect((await service.sendHearts(b, a, randomUUID())).sent).toBe(1);
    now = new Date('2026-09-20T22:00:00Z'); // midnight Paris, still the same UTC day
    expect((await service.sendHearts(a, b, randomUUID())).sent).toBe(1);
    expect((await service.snapshot(a)).businessDate).toBe('2026-09-21');
    expect((await service.snapshot(a)).friends[0]).toMatchObject({ level: 4, totalHearts: '3' });
    expect(await sent(a)).toBe(2n);
  }, 30_000);
  it('caps at 1000 while total hearts continue; preserves imported individual history and daily lock on reactivation', async () => {
    const a = await player(), b = await player(), relation = await befriend(a, b);
    await db.friendship.update({ where: { id: relation.friendshipId! }, data: { level: 999, totalHearts: 998n } });
    await db.playerSocialStats.create({ data: { playerId: a, totalFriendHeartsSent: 10000n } });
    expect((await service.sendHearts(a, b, randomUUID())).level).toBe(1000);
    await service.mutate(a, b, 'REMOVE', randomUUID());
    await expect(service.sendHearts(a, b, randomUUID())).rejects.toThrow();
    const again = await befriend(a, b); expect(again.friendshipId).toBe(relation.friendshipId);
    expect((await service.sendHearts(a, b, randomUUID())).sent).toBe(0);
    expect((await service.sendHearts(b, a, randomUUID())).level).toBe(1000);
    expect((await service.snapshot(a)).friends[0]).toMatchObject({ level: 1000, totalHearts: '1000', tier: 'Amitié Parfaite' });
    expect(await sent(a)).toBe(10001n);
  }, 30_000);
  it('reconciles sender heart B/A/S and perfect-friendship Z for both participants without passive catch-up', async () => {
    const a = await player(), b = await player(), relation = await befriend(a, b);
    await db.friendship.update({ where: { id: relation.friendshipId! }, data: { level: 999, totalHearts: 999n } });
    await db.playerSocialStats.create({ data: { playerId: a, totalFriendHeartsSent: 199n } });
    for (const id of [a, b]) {
      await db.playerPermanentMissionState.update({ where: { playerId: id }, data: { zUnlockedAt: now } });
      await db.playerPermanentMissionProgress.updateMany({
        where: { playerId: id, definition: { externalKey: 'perfect_friendship_z' } },
        data: { status: 'ACTIVE', startedAt: now },
      });
    }
    await db.playerPermanentMissionState.update({ where: { playerId: b }, data: { standaloneCatchupCompletedAt: null } });
    const result = await service.sendHearts(a, b, randomUUID(), 'INTERNAL_CHAT');
    expect(result).toMatchObject({ sent: 1, level: 1000, senderReward: '5' });
    const intent = await db.businessOperation.findFirstOrThrow({ where: { playerId: a, operationType: 'friendship.hearts' }, orderBy: { startedAt: 'desc' } });
    const sender = await db.playerPermanentMissionProgress.findMany({
      where: { playerId: a, status: 'COMPLETED', definition: { externalKey: { in: ['friend_hearts_b', 'friend_hearts_a', 'friend_hearts_s', 'perfect_friendship_z'] } } },
      include: { definition: true, rewardOperation: true },
    });
    expect(sender.map(row => row.definition.externalKey).sort()).toEqual(['friend_hearts_a', 'friend_hearts_b', 'friend_hearts_s', 'perfect_friendship_z']);
    expect(sender.every(row => row.completionTriggerOperationId === intent.id)).toBe(true);
    expect(sender.every(row => row.rewardOperation?.sourceChannel === 'INTERNAL_CHAT')).toBe(true);
    const recipientPerfect = await db.playerPermanentMissionProgress.findFirstOrThrow({ where: { playerId: b, definition: { externalKey: 'perfect_friendship_z' } } });
    expect(recipientPerfect).toMatchObject({ status: 'COMPLETED', completionTriggerOperationId: intent.id });
    expect((await db.playerPermanentMissionState.findUniqueOrThrow({ where: { playerId: b } })).standaloneCatchupCompletedAt).toBeNull();
    expect(await db.resourceMovement.count({ where: { playerId: { in: [a, b] }, causeKey: 'friendship.heart', delta: 5n } })).toBe(2);
  }, 30_000);
  it('atomically sends to all using the individual primitive, with safe individual/all and all/all races', async () => {
    const a = await player(), b = await player(), c = await player(), d = await player();
    for (const p of [b, c, d]) await befriend(a, p);
    const key = randomUUID();
    const result = await Promise.all([service.sendHearts(a, b, randomUUID()), service.sendHearts(a, 'all', key), service.sendHearts(a, 'all', randomUUID())]);
    expect(result.reduce((n, r) => n + r.sent, 0)).toBe(3);
    expect(await balance(a)).toBe(15n); expect(await sent(a)).toBe(3n);
    for (const p of [b, c, d]) expect(await balance(p)).toBe(5n);
    expect(await service.sendHearts(a, 'all', key)).toEqual(result[1]);
    expect(await service.sendHearts(a, 'all', randomUUID())).toMatchObject({ sent: 0, alreadySent: 3, status: 'ALL_SENT' });
    expect(await service.sendHearts(await player(), 'all', randomUUID())).toMatchObject({ sent: 0, status: 'NO_FRIENDS' });
    const e = await player(), f = await player(); await befriend(e, f);
    const failing = new PrismaEconomyService(); const original = failing.credit.bind(failing);
    let calls = 0; vi.spyOn(failing, 'credit').mockImplementation(async (tx, input) => { await original(tx, input); if (++calls === 2) throw Error('Injected second-credit failure'); });
    await expect(new FriendshipService(db, clock, failing).sendHearts(e, 'all', randomUUID())).rejects.toThrow('Injected');
    expect(await balance(e)).toBe(0n); expect(await balance(f)).toBe(0n); expect(await sent(e)).toBe(0n);
    expect((await service.snapshot(e)).friends[0]).toMatchObject({ level: 1, totalHearts: '0', canSend: true });
  }, 60_000);
  it('runs one sender catch-up and one bounded Mission reconciliation for a multi-heart batch', async () => {
    const a = await player(), b = await player(), c = await player();
    await befriend(a, b); await befriend(a, c);
    const economy = new PrismaEconomyService(); const missions = new PermanentMissionService(economy);
    const catchUp = vi.spyOn(missions, 'catchUpStandalone'); const reconcile = vi.spyOn(missions, 'reconcileMetrics');
    const batch = new FriendshipService(db, clock, economy, new PlayerActivityRecorder(), missions);
    expect(await batch.sendHearts(a, 'all', randomUUID())).toMatchObject({ sent: 2, senderReward: '10' });
    expect(catchUp).toHaveBeenCalledTimes(1); expect(reconcile).toHaveBeenCalledTimes(1);
    expect(reconcile.mock.calls[0]?.[1]).toMatchObject({ playerId: a, metrics: ['FRIEND_HEARTS_SENT'] });
    expect(await sent(a)).toBe(2n); expect(await sent(b)).toBe(0n); expect(await sent(c)).toBe(0n);
  }, 30_000);
  it('respects blocks and ACTIVE-only privacy through archive/reactivation without resetting settings', async () => {
    const a = await player(), b = await player(); await befriend(a, b);
    await privacy.save(a, 'BOX', 'FRIENDS');
    expect((await privacy.permissions(a, b)).BOX).toBe(true);
    await service.mutate(a, b, 'REMOVE', randomUUID());
    expect((await privacy.permissions(a, b)).BOX).toBe(false);
    await db.playerBlock.create({ data: { blockerPlayerId: b, blockedPlayerId: a } });
    await expect(service.mutate(a, b, 'ADD', randomUUID())).rejects.toThrow();
    await db.playerBlock.deleteMany({ where: { blockerPlayerId: b, blockedPlayerId: a } });
    await service.mutate(a, b, 'ADD', randomUUID());
    await db.playerBlock.create({ data: { blockerPlayerId: b, blockedPlayerId: a } });
    await expect(service.mutate(b, a, 'ACCEPT', randomUUID())).rejects.toThrow();
    await db.playerBlock.deleteMany({ where: { blockerPlayerId: b, blockedPlayerId: a } });
    await service.mutate(b, a, 'ACCEPT', randomUUID());
    expect((await privacy.permissions(a, b)).BOX).toBe(true);
    await db.playerBlock.create({ data: { blockerPlayerId: a, blockedPlayerId: b } });
    await expect(service.sendHearts(b, a, randomUUID())).rejects.toThrow();
    expect((await service.sendHearts(a, 'all', randomUUID())).unavailable).toBe(1);
    expect((await privacy.permissions(a, b)).PRESENCE).toBe(false);
  }, 30_000);
  it('enforces PUBLIC, FRIENDS and PRIVATE for Missions with ACTIVE friendship only', async () => {
    const owner = await player(), viewer = await player();
    expect((await privacy.permissions(owner, viewer)).MISSIONS).toBe(true);
    await privacy.save(owner, 'MISSIONS', 'FRIENDS');
    expect((await privacy.permissions(owner, viewer)).MISSIONS).toBe(false);
    const pending = await service.mutate(viewer, owner, 'ADD', randomUUID());
    expect((await privacy.permissions(owner, viewer)).MISSIONS).toBe(false);
    await service.mutate(owner, viewer, 'ACCEPT', randomUUID(), 'UI', pending.requestId!);
    expect((await privacy.permissions(owner, viewer)).MISSIONS).toBe(true);
    await service.mutate(owner, viewer, 'REMOVE', randomUUID());
    expect((await privacy.permissions(owner, viewer)).MISSIONS).toBe(false);
    await privacy.save(owner, 'MISSIONS', 'PRIVATE');
    expect((await privacy.permissions(owner, viewer)).MISSIONS).toBe(false);
    expect((await privacy.permissions(owner, owner)).MISSIONS).toBe(true);
  }, 30_000);
  it('keeps activity monotonic, updates only the actor and excludes heartbeat, polling, failed action and passive recipients', async () => {
    const a = await player(), b = await player(), presence = new PresenceService(db, clock), key = randomUUID();
    await presence.touch(a, key, false, true);
    expect(await db.playerActivityState.findUnique({ where: { playerId: a } })).toBeNull();
    await presence.touch(a, key, true);
    const initial = await db.playerActivityState.findUniqueOrThrow({ where: { playerId: a } });
    now = new Date(now.getTime() + 60_000);
    await presence.touch(a, key, false); await service.snapshot(a); await social.directory({ subject: a }, { q: '', page: 1 });
    await expect(service.mutate(a, a, 'ADD', randomUUID())).rejects.toThrow();
    expect((await db.playerActivityState.findUniqueOrThrow({ where: { playerId: a } })).lastAppActivityAt).toEqual(initial.lastAppActivityAt);
    await service.mutate(a, b, 'ADD', randomUUID());
    expect((await db.playerActivityState.findUniqueOrThrow({ where: { playerId: a } })).lastAppActivityAt).toEqual(now);
    expect(await db.playerActivityState.findUnique({ where: { playerId: b } })).toBeNull();
    await db.$transaction(tx => new PlayerActivityRecorder().record(tx, a, initial.lastAppActivityAt!, 'GAMEPLAY'));
    expect((await db.playerActivityState.findUniqueOrThrow({ where: { playerId: a } })).lastAppActivityAt).toEqual(now);
  }, 30_000);
  it('paginates after presence filtering, never classifies hidden presence as offline, and persists sorting', async () => {
    const a = await player(), marker = randomUUID();
    const ids: string[] = [];
    for (let i = 0; i < 23; i++) { const id = await player(); ids.push(id); await db.player.update({ where: { id }, data: { displayName: `${marker} Élo ${String(i).padStart(2, '0')}` } }); }
    await privacy.save(ids[0]!, 'PRESENCE', 'PRIVATE');
    await new PresenceService(db, clock).touch(ids[1]!, randomUUID(), true, true);
    const query = { q: `${marker} elo`, page: 1 };
    expect((await social.directory({ subject: a }, query)).total).toBe(23);
    const offline = await social.directory({ subject: a }, { ...query, status: 'OFFLINE' });
    expect(offline.total).toBe(21); expect(offline.players).toHaveLength(20);
    expect((await social.directory({ subject: a }, { ...query, status: 'OFFLINE', page: 2 })).players).toHaveLength(1);
    expect((await social.directory({ subject: a }, { ...query, status: 'ONLINE' })).players.map(p => p.id)).toEqual([ids[1]]);
    const request = await service.mutate(ids[2]!, a, 'ADD', randomUUID());
    expect((await social.directory({ subject: a }, { ...query, relation: 'RECEIVED' })).players.map(p => p.id)).toEqual([ids[2]]);
    expect((await social.directory({ subject: a }, query)).players[0]).toMatchObject({ id: ids[2], relation: 'RECEIVED', requestId: request.requestId });
    await service.saveSort(a, 'heart'); expect((await service.snapshot(a)).sort).toBe('heart');
  }, 60_000);
  it('enforces physical pair, day, progress and pending uniqueness constraints', async () => {
    const a = await player(), b = await player(), c = await player();
    const relation = await befriend(a, b); await service.sendHearts(a, b, randomUUID());
    const heart = await db.friendHeart.findFirstOrThrow({ where: { senderPlayerId: a } });
    await expect(db.friendHeart.update({ where: { id: heart.id }, data: { recipientPlayerId: c } })).rejects.toThrow();
    await expect(db.friendship.update({ where: { id: relation.friendshipId! }, data: { level: 0 } })).rejects.toThrow();
    await expect(db.friendship.update({ where: { id: relation.friendshipId! }, data: { level: 1001 } })).rejects.toThrow();
    await service.mutate(a, c, 'ADD', randomUUID());
    await expect(db.friendRequest.create({ data: { senderPlayerId: c, recipientPlayerId: a, sourceChannel: 'UI' } })).rejects.toThrow();
  }, 30_000);
  it('records successful Game C only; GET reconciliation, replay, recipient notification and failure never record activity', async () => {
    now = new Date('2026-09-21T12:00:00Z');
    const original = (await fixture.admin.query('SELECT * FROM public.event_definitions WHERE calendar_month = 9')).rows[0];
    await db.eventDefinition.create({ data: { id: randomUUID(), externalKey: original.external_key, displayName: original.display_name, calendarMonth: 9, currencyKey: original.currency_key, config: original.config } });
    const a = await player(), b = await player();
    const get = { execute: async (identity: { subject: string }) => ({ id: identity.subject, displayName: 'Event fixture', elementKey: null, status: 'ACTIVE' }) } as unknown as GetCurrentPlayer;
    const event = new EventService(get, db, clock, { nextInt: () => 0 });
    await event.getCurrent({ subject: a }); await event.join({ subject: a }, randomUUID());
    expect(await db.playerActivityState.findUnique({ where: { playerId: a } })).toBeNull();
    await expect(event.sendGameC({ subject: a }, a, 'Test', randomUUID())).rejects.toThrow();
    expect(await db.playerActivityState.findUnique({ where: { playerId: a } })).toBeNull();
    const key = randomUUID(); await event.sendGameC({ subject: a }, b, 'Bonjour', key);
    const activity = await db.playerActivityState.findUniqueOrThrow({ where: { playerId: a } });
    expect(activity.lastAppActivityAt).toEqual(now); expect(activity.lastGameplayActivityAt).toEqual(now);
    expect(await db.playerActivityState.findUnique({ where: { playerId: b } })).toBeNull();
    now = new Date(now.getTime() + 60_000);
    await event.getCurrent({ subject: a }); await event.getCurrent({ subject: b });
    await event.sendGameC({ subject: a }, b, 'Bonjour', key);
    await expect(event.sendGameC({ subject: a }, b, 'Encore', randomUUID())).rejects.toThrow();
    expect((await db.playerActivityState.findUniqueOrThrow({ where: { playerId: a } })).lastAppActivityAt).toEqual(activity.lastAppActivityAt);
  }, 30_000);
});
