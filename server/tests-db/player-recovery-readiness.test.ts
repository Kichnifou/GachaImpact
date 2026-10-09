import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { verifiedPlayerActor } from '../src/application/player/player-execution-actor.js';
import { recoveryDomains } from '../src/application/player/player-recovery-readiness.js';
import { EventService } from '../src/application/event/event-service.js';
import { EventChatPresence } from '../src/application/event/event-chat-presence.js';
import { EventLifecycleNotificationReconciler } from '../src/application/notification/event-lifecycle-notifications.js';
import { EventMessageNotificationReconciler, reconcileEventMessageAggregate } from '../src/application/notification/event-message-notifications.js';
import { MonthlyBossService } from '../src/application/combat/monthly-boss-service.js';
import { GiveawayService } from '../src/application/giveaway/giveaway-service.js';
import { businessDateToDatabaseDate, getBusinessDate } from '../src/domain/time/business-date.js';
import { FavorService } from '../src/application/favor/favor-service.js';
import { TwitchEventObserver } from '../src/application/twitch/twitch-event-observer.js';
import { TwitchFavorChatPresenceConsumer } from '../src/application/twitch/twitch-favor-chat-presence-consumer.js';
import { TwitchFavorSubscriptionConsumer } from '../src/application/twitch/twitch-favor-subscription-consumer.js';
import { isRecoveryDeferredReceipt } from '../src/application/twitch/twitch-recovery-deferrals.js';
import { playerRecoverySchema } from '../src/application/player/player-recovery-readiness.js';
import type { Prisma } from '../generated/prisma/client.js';

const host = new URL(process.env['DATABASE_URL'] ?? 'http://missing').hostname;
if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) throw new Error('Recovery tests require loopback PostgreSQL.');
const fixture = isolatedBatchDatabase(), db = fixture.database;
const getPlayer = new GetCurrentPlayer({ findByIdentity: vi.fn(), provision: vi.fn() });
let now = new Date('2190-10-09T10:00:00Z');
const random = { nextInt: vi.fn((max: number) => max - 1) };
const events = new EventService(getPlayer, db, { now: () => now }, random);
const boss = new MonthlyBossService(getPlayer, db, { now: () => now }, random);
beforeAll(() => fixture.setup({ seedPublicCatalog: true }), 90_000);
afterAll(() => fixture.cleanup(), 60_000);
let identitySequence = 900000;
const marker = () => ({ version: 1, operationId: randomUUID(), importId: randomUUID(),
  snapshotHash: 'a'.repeat(64), populationHash: 'b'.repeat(64), backupHash: 'c'.repeat(64), restrictedDomains: [...recoveryDomains] });
async function player(restricted = true) {
  const twitchUserId = String(++identitySequence);
  const created = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: `Recovery ${twitchUserId}`,
    twitchIdentity: { twitchUserId, login: `recovery_${twitchUserId}`, displayName: `Recovery ${twitchUserId}`, firstSeenAt: now } }, now));
  const updated = await db.player.update({ where: { id: created.id }, data: { elementKey: 'hydro', ...(restricted ? { legacyRecovery: marker() } : {}) } });
  await db.twitchNativeTarget.create({ data: { twitchUserId, playerId: created.id, dataAuthority: 'NATIVE', canary: true, acknowledgement: 'STREAMERBOT_PATH_DISABLED', transferredAt: now } });
  return { id: created.id, twitchUserId, actor: verifiedPlayerActor(updated) };
}
async function economicState(playerId: string) {
  return { resources: await db.playerResourceBalance.findMany({ where: { playerId }, orderBy: { resourceKey: 'asc' } }),
    operations: await db.businessOperation.count({ where: { playerId } }), movements: await db.resourceMovement.count({ where: { playerId } }),
    notifications: await db.notification.count({ where: { playerId } }) };
}

describe('recovery domain guards on isolated PostgreSQL', () => {
  it('blocks every Faveur mutation and chat presence while staging, and accepts only intact deferred proofs', async () => {
    const staged = await player(), clock = { now: () => now };
    await db.twitchNativeTarget.update({ where: { twitchUserId: staged.twitchUserId }, data: {
      dataAuthority: 'LEGACY', canary: false, acknowledgement: null, transferredAt: null,
    } });
    await db.playerFavorState.create({ data: { playerId: staged.id, activeFromDate: businessDateToDatabaseDate(getBusinessDate(now)),
      activeUntilDate: businessDateToDatabaseDate(getBusinessDate(new Date(now.getTime() + 86400000))) } });
    const favor = new FavorService(db, clock), before = await economicState(staged.id), observer = new TwitchEventObserver(db);
    await expect(favor.grant({ playerId: staged.id, tier: 1, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'PLAYER_RECOVERY_NOT_ACTIVATED' });
    await expect(favor.creditGifterBonus({ playerId: staged.id, tier: 1, total: 2, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'PLAYER_RECOVERY_NOT_ACTIVATED' });
    await expect(favor.claimToday(staged.id)).rejects.toMatchObject({ code: 'PLAYER_RECOVERY_NOT_ACTIVATED' });
    const chat = await observer.observeTwitchEvent({ externalEventId: randomUUID(), eventType: 'channel.chat.message', twitchUserId: staged.twitchUserId });
    await db.twitchEventReceipt.update({ where: { id: chat.receipt.id }, data: { receivedAt: now } });
    expect(await new TwitchFavorChatPresenceConsumer(db, clock).consume(chat.receipt.id)).toEqual({ status: 'IGNORED' });
    expect(await db.favorDailyClaim.count({ where: { playerId: staged.id } })).toBe(0);
    expect(await economicState(staged.id)).toEqual(before);

    const observed = await observer.observeTwitchEvent({ externalEventId: randomUUID(), eventType: 'channel.subscribe', twitchUserId: staged.twitchUserId,
      subscriptionProof: { broadcasterTwitchId: '12', tier: '1000', isGift: false } });
    await expect(new TwitchFavorSubscriptionConsumer(db, clock).consume(observed.receipt.id)).rejects.toMatchObject({ code: 'PLAYER_RECOVERY_NOT_ACTIVATED', statusCode: 503 });
    const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: observed.receipt.id } });
    const recovery = playerRecoverySchema.parse((await db.player.findUniqueOrThrow({ where: { id: staged.id } })).legacyRecovery);
    const additions = [{ playerId: staged.id, recovery }];
    const acceptable = (value = receipt) => db.$transaction(tx => isRecoveryDeferredReceipt(tx, value, additions));
    expect(await acceptable()).toBe(true);
    const payload = receipt.payloadMinimal as Prisma.JsonObject, markerValue = payload.recoveryDeferred as Prisma.JsonObject;
    for (const patch of [
      { payloadHash: 'f'.repeat(64) }, { processedAt: now }, { externalReference: 'already-consumed' },
      { payloadMinimal: { ...payload, outbound: { state: 'RESERVED' } } },
      { payloadMinimal: { ...payload, recoveryDeferred: { ...markerValue, kind: 'GIFT_SUPREME' } } },
      { payloadMinimal: { ...payload, recoveryDeferred: { ...markerValue, playerId: randomUUID() } } },
      { payloadMinimal: { ...payload, recoveryDeferred: { ...markerValue, recovery: { ...recovery, importId: randomUUID() } } } },
      { payloadMinimal: { ...payload, recoveryDeferred: { ...markerValue, recovery: { ...recovery, snapshotHash: 'f'.repeat(64) } } } },
    ]) expect(await acceptable({ ...receipt, ...patch })).toBe(false);
    const conflictingPayload = { ...payload, recoveryDeferred: { ...markerValue, recovery: { ...recovery, backupHash: 'f'.repeat(64) } } };
    await db.twitchEventReceipt.update({ where: { id: receipt.id }, data: { payloadMinimal: conflictingPayload } });
    await expect(new TwitchFavorSubscriptionConsumer(db, clock).consume(receipt.id)).rejects.toMatchObject({ code: 'PLAYER_RECOVERY_NOT_ACTIVATED', statusCode: 503 });
    expect((await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).payloadMinimal).toEqual(conflictingPayload);
    await db.twitchEventReceipt.update({ where: { id: receipt.id }, data: { payloadMinimal: payload as Prisma.InputJsonObject } });
    await db.player.update({ where: { id: staged.id }, data: { status: 'ARCHIVED' } });
    await expect(new TwitchFavorSubscriptionConsumer(db, clock).consume(receipt.id)).rejects.toMatchObject({ code: 'PLAYER_RECOVERY_NOT_ACTIVATED', statusCode: 503 });
    expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ state: 'RECEIVED', externalReference: null });
    await db.player.update({ where: { id: staged.id }, data: { status: 'ACTIVE' } });
    const op = await db.businessOperation.create({ data: { playerId: staged.id, operationType: 'favor.grant', sourceChannel: 'TWITCH',
      idempotencyKey: `favor:grant:eventsub:channel.subscribe:${receipt.externalEventId}`, status: 'COMPLETED', completedAt: now } });
    expect(await acceptable()).toBe(false);
    await db.businessOperation.delete({ where: { id: op.id } });
    expect(await economicState(staged.id)).toEqual(before);
  });

  it('refuses Event/Boss actions before RNG, daily state, operations or rewards while native Players work', async () => {
    const restricted = await player(), native = await player(false), before = await economicState(restricted.id);
    random.nextInt.mockClear();
    await expect(events.getCurrent(restricted.actor)).rejects.toMatchObject({ code: 'PLAYER_DOMAIN_TEMPORARILY_UNAVAILABLE' });
    await expect(events.join(restricted.actor, randomUUID())).rejects.toMatchObject({ code: 'PLAYER_DOMAIN_TEMPORARILY_UNAVAILABLE' });
    await expect(events.claimDailyBonus(restricted.actor, randomUUID())).rejects.toMatchObject({ code: 'PLAYER_DOMAIN_TEMPORARILY_UNAVAILABLE' });
    await expect(boss.getCurrent(restricted.actor)).rejects.toMatchObject({ code: 'PLAYER_DOMAIN_TEMPORARILY_UNAVAILABLE' });
    await expect(boss.attackWithActiveTeam(restricted.actor, randomUUID())).rejects.toMatchObject({ code: 'PLAYER_DOMAIN_TEMPORARILY_UNAVAILABLE' });
    expect(random.nextInt).not.toHaveBeenCalled();
    expect(await db.eventDailyPlayerState.count({ where: { playerId: restricted.id } })).toBe(0);
    expect(await economicState(restricted.id)).toEqual(before);
    const joined = await events.join(native.actor, randomUUID());
    expect(joined.participation.joined).toBe(true); expect(joined.currency.amount).toBe('1');
    expect((await boss.getCurrent(native.actor)).boss.id).toBeTruthy();
  });

  it.each(['NATIVE', 'LEGACY'] as const)('skips restricted %s presence and notification work, including a frozen delivery intent', async authority => {
    now = new Date('2191-10-09T10:00:00Z');
    const restricted = await player(), before = await economicState(restricted.id);
    if (authority === 'LEGACY') await db.twitchNativeTarget.update({ where: { twitchUserId: restricted.twitchUserId }, data: {
      dataAuthority: 'LEGACY', canary: false, acknowledgement: null, transferredAt: null,
    } });
    const current = await getPlayer.execute(restricted.actor);
    const presence = new EventChatPresence(db, events), editionResolver = vi.spyOn(events, 'resolveCurrentEdition');
    expect(await presence.prepare(current, now)).toBeNull();
    expect(await presence.deliver(current, { editionId: randomUUID(), title: 'Festival', currency: 'monnaies', bonus: true, messageIds: [randomUUID()], notices: ['EVENT_EDITION_AVAILABLE'] }, randomUUID(), now)).toEqual([]);
    await new EventLifecycleNotificationReconciler(db, events).reconcileNotificationsForPlayer(restricted.id, now);
    await new EventMessageNotificationReconciler(db).reconcileNotificationsForPlayer(restricted.id, now);
    await db.$transaction(tx => reconcileEventMessageAggregate(tx, restricted.id, randomUUID(), getBusinessDate(now), now, true));
    expect(editionResolver).not.toHaveBeenCalled(); editionResolver.mockRestore();
    expect(await economicState(restricted.id)).toEqual(before);
  });

  it('checks both Game C endpoints and filters Game B beneficiaries before milestone RNG or gain', async () => {
    now = new Date('2192-10-09T10:00:00Z');
    const native = await player(false), restricted = await player(false);
    const joined = await events.join(native.actor, randomUUID());
    await events.join(restricted.actor, randomUUID());
    await db.eventParticipant.update({ where: { eventEditionId_playerId: { eventEditionId: joined.edition.id, playerId: restricted.id } }, data: { points: 9 } });
    await db.player.update({ where: { id: restricted.id }, data: { legacyRecovery: marker() } });
    const before = await economicState(restricted.id);
    await expect(events.sendGameC(native.actor, restricted.id, 'Bonjour', randomUUID())).rejects.toMatchObject({ code: 'EVENT_GAME_C_CONTACT_UNAVAILABLE' });
    expect(await db.eventSocialMessage.count({ where: { recipientPlayerId: restricted.id } })).toBe(0);
    const solution = await db.eventGameBDailyState.findUniqueOrThrow({ where: { eventEditionId_businessDate: { eventEditionId: joined.edition.id, businessDate: businessDateToDatabaseDate(getBusinessDate(now)) } } });
    random.nextInt.mockClear();
    const solved = await events.attemptGameB(native.actor, solution.solutionCode, randomUUID());
    expect(solved.attempt.kind).toBe('CORRECT');
    expect(await db.eventParticipant.findUniqueOrThrow({ where: { eventEditionId_playerId: { eventEditionId: joined.edition.id, playerId: restricted.id } } })).toMatchObject({ points: 9 });
    expect(await db.eventMilestoneClaim.count({ where: { playerId: restricted.id } })).toBe(0);
    expect((await db.playerEventCurrencyBalance.findFirstOrThrow({ where: { playerId: restricted.id } })).amount).toBe(1n);
    expect(random.nextInt).not.toHaveBeenCalled();
    expect(await economicState(restricted.id)).toEqual(before);
  });

  it('excludes a restricted Boss participant from victory operations, gains and notifications', async () => {
    now = new Date('2193-10-09T10:00:00Z');
    const native = await player(false), restricted = await player();
    const characters = await db.character.findMany({ where: { isActive: true }, take: 4, orderBy: { id: 'asc' } });
    expect(characters).toHaveLength(4);
    await db.playerCharacter.createMany({ data: characters.map(character => ({ playerId: native.id, characterId: character.id, copies: 1, firstObtainedAt: now })) });
    for (let index = 0; index < characters.length; index++) await boss.setSlot(native.actor, index + 1, characters[index]!.id);
    const current = await boss.getCurrent(native.actor);
    await db.monthlyBoss.update({ where: { id: current.boss.id }, data: { currentHp: 1n } });
    await db.playerBossParticipation.create({ data: { bossId: current.boss.id, playerId: restricted.id, totalDamage: 10n, attackCount: 1n, bestHit: 10n, firstAttackAt: now, lastAttackAt: now } });
    const before = await economicState(restricted.id);
    const result = await boss.attack(native.actor, current.boss.id, randomUUID());
    expect(result.result.defeated).toBe(true);
    expect(await db.bossReward.count({ where: { playerId: restricted.id } })).toBe(0);
    expect(await db.bossReward.count({ where: { playerId: native.id } })).toBe(1);
    expect(await economicState(restricted.id)).toEqual(before);
  });

  it.each(['NATIVE', 'LEGACY'] as const)('refuses Giveaway entry/counting and filters restricted %s rows before draw, ranking and rewards', async authority => {
    now = new Date(authority === 'NATIVE' ? '2194-10-09T10:00:00Z' : '2195-10-09T10:00:00Z');
    const native = await player(false), restricted = await player(), admin = await player(false);
    await db.playerRoleAssignment.create({ data: { playerId: admin.id, role: 'ADMIN', source: 'private-recovery-test' } });
    const draw = vi.fn(() => 0), bridge = { assertActive: async () => {}, status: async () => ({ available: true, authorized: true, enabled: true, active: true, pending: false }) };
    const service = new GiveawayService(db, bridge, () => now, draw);
    const session = await db.giveawaySession.create({ data: { status: 'OPEN', origin: 'NATIVE', openedByPlayerId: admin.id, openedAt: now, rewardStatus: 'PENDING' } });
    if (authority === 'LEGACY') await db.twitchNativeTarget.update({ where: { twitchUserId: restricted.twitchUserId }, data: {
      dataAuthority: 'LEGACY', canary: false, acknowledgement: null, transferredAt: null,
    } });
    const before = await economicState(restricted.id);
    expect((await service.wish(restricted.twitchUserId, randomUUID())).outcome).toBe('RECOVERY_UNAVAILABLE');
    expect(await service.countMessage({ twitchUserId: restricted.twitchUserId, twitchMessageId: randomUUID(), observedAt: now })).toBe(false);
    expect(await db.giveawayParticipant.count({ where: { playerId: restricted.id } })).toBe(0);
    expect(await db.giveawayCountedMessage.count({ where: { playerId: restricted.id } })).toBe(0);
    expect((await service.wish(native.twitchUserId, randomUUID())).outcome).toBe('JOINED');
    expect(await service.countMessage({ twitchUserId: native.twitchUserId, twitchMessageId: randomUUID(), observedAt: now })).toBe(true);
    // Existing rows stay as facts; they cannot enter a new draw or reward calculation.
    await db.giveawayParticipant.create({ data: { sessionId: session.id, playerId: restricted.id } });
    await db.giveawayChatStat.create({ data: { sessionId: session.id, playerId: restricted.id, messageCount: 100n } });
    await db.giveawayDeferredMessage.create({ data: { sessionId: session.id, playerId: restricted.id, twitchMessageId: randomUUID(), observedAt: now } });
    expect(await service.settleDeferred()).toBe(0);
    expect((await service.state()).session).toMatchObject({ participantCount: 1, chatterCount: 1 });
    await service.close(admin.id, 'ADMIN', session.id, randomUUID());
    expect(draw).toHaveBeenCalledExactlyOnceWith(1);
    expect(await db.giveawayReward.count({ where: { playerId: restricted.id } })).toBe(0);
    expect(await db.giveawayWin.count({ where: { playerId: native.id } })).toBe(1);
    expect(await db.giveawayDeferredMessage.count({ where: { playerId: restricted.id } })).toBe(1);
    expect(await economicState(restricted.id)).toEqual(before);
  });

  it.each(['close', 'deferred'] as const)('locks all Giveaway Players in UUID order during %s', async action => {
    now = new Date(action === 'close' ? '2196-10-09T10:00:00Z' : '2197-10-09T10:00:00Z');
    const [first, moderator] = (await Promise.all([player(false), player(false)])).sort((a, b) => a.id.localeCompare(b.id));
    await db.playerRoleAssignment.create({ data: { playerId: moderator!.id, role: 'ADMIN', source: 'private-lock-order' } });
    const session = await db.giveawaySession.create({ data: { status: 'OPEN', origin: 'NATIVE', openedByPlayerId: moderator!.id, openedAt: now, rewardStatus: 'PENDING' } });
    const bridge = { assertActive: async () => {}, status: async () => ({ available: true, authorized: true, enabled: true, active: true, pending: false }) };
    const service = new GiveawayService(db, bridge, () => now, () => 0);
    if (action === 'close') await db.giveawayParticipant.create({ data: { sessionId: session.id, playerId: first!.id } });
    else await db.giveawayDeferredMessage.createMany({ data: [
      { sessionId: session.id, playerId: moderator!.id, twitchMessageId: randomUUID(), observedAt: now },
      { sessionId: session.id, playerId: first!.id, twitchMessageId: randomUUID(), observedAt: new Date(now.getTime() + 1) },
    ] });
    await fixture.admin.query('BEGIN');
    let pending: Promise<{ error?: unknown }> | undefined, released = false;
    try {
      await fixture.admin.query('SELECT id FROM players WHERE id=$1::uuid FOR UPDATE', [first!.id]);
      pending = (action === 'close' ? service.close(moderator!.id, 'ADMIN', session.id, randomUUID()) : service.settleDeferred())
        .then(() => ({}), error => ({ error }));
      await expect.poll(async () => (await fixture.admin.query('SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pg_backend_pid() = ANY(pg_blocking_pids(pid))) waiting')).rows[0].waiting,
        { timeout: 5_000, interval: 100 }).toBe(true);
      // The competing A -> M mutation can still acquire M while Giveaway waits for A.
      expect((await fixture.admin.query('SELECT id FROM players WHERE id=$1::uuid FOR UPDATE NOWAIT', [moderator!.id])).rowCount).toBe(1);
      await fixture.admin.query('COMMIT'); released = true;
      expect((await pending).error).toBeUndefined();
    } finally { if (!released) await fixture.admin.query('ROLLBACK'); await pending; }
  });
});
