import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { GiftSupremeService, GiftSupremeIdempotencyConflict, GIFT_SUPREME_EVENT_TYPE, type GiftSupremeInput } from '../src/application/gift-supreme/gift-supreme-service.js';
import { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
import { NotificationService } from '../src/application/notification/notification-service.js';
import { TwitchGiftSupremeRedemptionConsumer } from '../src/application/twitch/twitch-gift-supreme-redemption.js';

const fixture = isolatedBatchDatabase(), db = fixture.database, clock = { now: () => new Date('2099-09-29T12:00:00Z') };
const rewardId = 'private-test-reward', service = new GiftSupremeService(db, clock, rewardId);
beforeAll(() => fixture.setup({ seedPublicCatalog: true }), 60_000);
afterAll(() => fixture.cleanup(), 60_000);
async function player(name: string, elementKey: string | null = 'pyro', status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE') {
  return db.player.create({ data: { displayName: name, elementKey, status, progression: { create: { xp: 0n } }, economyStats: { create: {} },
    resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 100n })) } } });
}
const input = (userInput: string, changes: Partial<GiftSupremeInput> = {}): GiftSupremeInput => ({ redemptionId: randomUUID(), rewardId,
  gifterTwitchUserId: '999999', gifterLogin: 'outside_gifter', gifterDisplayName: 'Outside Gifter', userInput, redeemedAt: '2026-09-29T12:00:00.000Z', ...changes });
async function effects(playerId: string) {
  return { wallet: (await db.playerResourceBalance.findMany({ where: { playerId }, orderBy: { resourceKey: 'asc' }, select: { resourceKey: true, amount: true } })),
    stats: await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId } }), progression: await db.playerProgression.findUniqueOrThrow({ where: { playerId } }),
    operations: await db.businessOperation.count({ where: { playerId } }), movements: await db.resourceMovement.count({ where: { playerId } }), notifications: await db.notification.count({ where: { playerId } }) };
}

describe('Gift Suprême atomic native core, private schema only', () => {
  it.each(['pyro', 'hydro'])('credits only 1600 %s with a durable journal and one informational notification', async element => {
    const p = await player(`Gift ${element}`, element), beforeCount = await db.player.count(), sent = input(p.displayName);
    const result = await service.process(sent); expect(result).toMatchObject({ action: 'FULFILL', targetPlayerId: p.id, elementKey: element, creditedParticles: '1600' });
    const snapshot = await effects(p.id);
    expect(snapshot.wallet.every(row => row.amount === (row.resourceKey === `particles_${element}` ? 1700n : 100n))).toBe(true);
    expect(snapshot.stats).toMatchObject({ totalMainElementParticlesEarned: 1600n, totalPrimosEarned: 0n, totalMorasEarned: 0n });
    expect(snapshot.progression).toMatchObject({ xp: 0n, totalMessages: 0n, countedMessages: 0n });
    expect(snapshot).toMatchObject({ operations: 1, movements: 1, notifications: 1 });
    expect(await db.businessOperation.findFirst({ where: { playerId: p.id } })).toMatchObject({ operationType: 'gift-supreme.redeem', status: 'COMPLETED', sourceChannel: 'TWITCH', idempotencyKey: `gift-supreme:${sent.redemptionId}` });
    expect(await db.resourceMovement.findFirst({ where: { playerId: p.id } })).toMatchObject({ resourceKey: `particles_${element}`, delta: 1600n, balanceBefore: 100n, balanceAfter: 1700n, sourceChannel: 'TWITCH', causeKey: 'gift-supreme', domainKey: 'gift-supreme' });
    const notification = await db.notification.findFirstOrThrow({ where: { playerId: p.id } });
    expect(notification).toMatchObject({ domainKey: 'gift-supreme', typeKey: 'GIFT_SUPREME_RECEIVED', state: 'UNREAD', actionKey: null, actionTargetId: null,
      payload: { title: '🎁 Gift Suprême reçu', message: `Outside Gifter t'a offert +1 600 particules ${element[0]!.toUpperCase() + element.slice(1)}.` } });
    const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: `gift-supreme:${sent.redemptionId}` } });
    expect(receipt).toMatchObject({ eventType: GIFT_SUPREME_EVENT_TYPE, state: 'PROCESSED', twitchUserId: sent.gifterTwitchUserId,
      payloadMinimal: { proof: { redemptionId: sent.redemptionId, rewardId, gifterTwitchUserId: sent.gifterTwitchUserId, redeemedAt: sent.redeemedAt }, targetPlayerId: p.id, localOutcome: 'SUCCESS', result } });
    expect(receipt.processedAt).not.toBeNull(); expect(receipt.externalReference).not.toBeNull();
    expect(await db.player.count()).toBe(beforeCount); expect(await db.twitchIdentity.count()).toBe(0);
    expect(await db.favorDailyClaim.count()).toBe(0); expect(await db.favorGrant.count()).toBe(0); expect(await db.playerPermanentMissionState.count()).toBe(0);
    expect(await service.process(sent)).toEqual(result); expect(await effects(p.id)).toEqual(snapshot);
  });
  it('permits self-gift and never requires a gifter Player', async () => {
    const p = await player('Self Gift'); await db.twitchIdentity.create({ data: { playerId: p.id, twitchUserId: '12345', login: 'self_gift' } });
    expect(await service.process(input(p.displayName, { gifterTwitchUserId: '12345' }))).toMatchObject({ action: 'FULFILL', targetPlayerId: p.id });
  });
  it.each(['empty', 'absent', 'inactive', 'no-element', 'ambiguous'])('durably cancels %s without economy or notification', async mode => {
    let name = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
    const reasons = { empty: 'EMPTY_INPUT', absent: 'TARGET_NOT_FOUND', inactive: 'TARGET_INACTIVE', 'no-element': 'TARGET_ELEMENT_MISSING', ambiguous: 'TARGET_AMBIGUOUS' };
    if (mode === 'empty') name = '   ';
    if (mode === 'inactive') { name = 'Archived Target'; await player(name, 'hydro', 'ARCHIVED'); }
    if (mode === 'no-element') { name = 'No Element Target'; await player(name, null); }
    if (mode === 'ambiguous') { name = 'equal-gift-bop'; await player('equal-gift-bob'); await player('equal-gift-bot'); }
    const counts = [await db.player.count(), await db.businessOperation.count(), await db.resourceMovement.count(), await db.notification.count()];
    const sent = input(name), expected = { action: 'CANCEL', reason: reasons[mode as keyof typeof reasons] };
    expect(await service.process(sent)).toEqual(expected); expect(await service.process(sent)).toEqual(expected);
    expect([await db.player.count(), await db.businessOperation.count(), await db.resourceMovement.count(), await db.notification.count()]).toEqual(counts);
    expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: `gift-supreme:${sent.redemptionId}` } })).toMatchObject({ state: 'PROCESSED', errorMessage: expected.reason, payloadMinimal: { localOutcome: 'INVALID', result: expected } });
  });
  it('keeps invalid replay invalid after the account becomes eligible', async () => {
    const p = await player('Later Element', null), sent = input(p.displayName);
    const result = await service.process(sent); await db.player.update({ where: { id: p.id }, data: { elementKey: 'pyro' } });
    expect(await service.process(sent)).toEqual(result); expect((await effects(p.id)).movements).toBe(0);
  });
  it.each(['rewardId', 'gifterTwitchUserId', 'userInput', 'redeemedAt'])('rejects contradictory success %s', async field => {
    const p = await player(`Conflict ${field}`), sent = input(p.displayName); await service.process(sent); const before = await effects(p.id);
    const replacements = { rewardId: 'other-reward', gifterTwitchUserId: '123', userInput: 'other person', redeemedAt: '2026-09-30T12:00:00Z' };
    await expect(service.process({ ...sent, [field]: replacements[field as keyof typeof replacements] })).rejects.toBeInstanceOf(GiftSupremeIdempotencyConflict);
    expect(await effects(p.id)).toEqual(before);
  });
  it('also rejects contradictory invalid replay', async () => {
    const sent = input(''); await service.process(sent);
    await expect(service.process({ ...sent, userInput: 'Gift pyro' })).rejects.toBeInstanceOf(GiftSupremeIdempotencyConflict);
  });
  it('ignores a different reward ID regardless of its descriptive title', async () => {
    const p = await player('Wrong Reward'), before = await db.twitchEventReceipt.count();
    expect(await service.process(input(p.displayName, { rewardId: 'another-reward' }))).toEqual({ action: 'IGNORE', reason: 'OTHER_REWARD' });
    expect(await db.twitchEventReceipt.count()).toBe(before); expect((await effects(p.id)).movements).toBe(0);
  });
  it('serializes two workers for one redemption into one credit and one notification', async () => {
    const p = await player('Concurrent Gift'), sent = input(p.displayName);
    const results = await Promise.all([service.process(sent), new GiftSupremeService(db, clock, rewardId).process(sent)]);
    expect(results[0]).toEqual(results[1]); expect(await effects(p.id)).toMatchObject({ movements: 1, operations: 1, notifications: 1 });
  });
  it('serializes distinct redemptions to the same target without losing a credit', async () => {
    const p = await player('Distinct Concurrent'); await Promise.all([service.process(input(p.displayName)), service.process(input(p.displayName))]);
    expect(await effects(p.id)).toMatchObject({ movements: 2, operations: 2, notifications: 2, stats: { totalMainElementParticlesEarned: 3200n } });
  });
  it('rolls back a failure after economy credit and retries cleanly', async () => {
    const p = await player('Rollback Gift'), sent = input(p.displayName), economy = new PrismaEconomyService(() => clock.now()), original = economy.credit.bind(economy);
    const failing = new GiftSupremeService(db, clock, rewardId, economy);
    const failure = vi.spyOn(economy, 'credit').mockImplementationOnce(async (tx, value) => { await original(tx, value); throw new Error('injected after credit'); });
    try { await expect(failing.process(sent)).rejects.toThrow('injected after credit'); } finally { failure.mockRestore(); }
    expect(await effects(p.id)).toMatchObject({ movements: 0, operations: 0, notifications: 0, stats: { totalMainElementParticlesEarned: 0n } });
    expect(await db.twitchEventReceipt.count({ where: { externalEventId: `gift-supreme:${sent.redemptionId}` } })).toBe(0);
    expect(await failing.process(sent)).toMatchObject({ action: 'FULFILL' });
  });
  it('recovers after a committed result is lost, even after target changes and reward reconfiguration', async () => {
    const p = await player('Recovery Gift'), sent = input(p.displayName); const committed = await service.process(sent); const before = await effects(p.id);
    await db.player.update({ where: { id: p.id }, data: { status: 'ARCHIVED', elementKey: 'hydro', displayName: 'Changed Recovery Name' } });
    expect(await new GiftSupremeService(db, clock, 'replacement-reward').process(sent)).toEqual(committed);
    expect(await effects(p.id)).toEqual(before);
  });
  it('keeps the already-paid informational notification visible until user handling', async () => {
    const p = await player('Notification Gift'); const sent = input(p.displayName); const result = await service.process(sent);
    const notifications = new NotificationService({ execute: async () => p } as never, db, clock, { getState: async () => ({}) } as never);
    const snapshot = await notifications.list({ subject: 'private-test' });
    expect(snapshot.notifications).toHaveLength(1); expect(snapshot.unreadCount).toBe(1); expect(snapshot.notifications[0]).toMatchObject({ state: 'UNREAD', actionKey: null });
    if (result.action !== 'FULFILL') throw new Error('Expected gift');
    await notifications.readOne({ subject: 'private-test' }, result.notificationId); await service.process(sent);
    expect(await db.notification.findUniqueOrThrow({ where: { id: result.notificationId } })).toMatchObject({ state: 'READ' });
  });
  it('uses the authenticated-adapter contract and configured reward ID rather than the title', async () => {
    const p = await player('Adapter Gift'), consumer = new TwitchGiftSupremeRedemptionConsumer(service, '111');
    const wire = { subscription: { type: GIFT_SUPREME_EVENT_TYPE, version: '1' }, event: { id: randomUUID(), broadcaster_user_id: '111',
      user_id: '222', user_login: 'external', user_name: 'External', user_input: p.displayName, status: 'unfulfilled',
      reward: { id: 'wrong-reward', title: 'Gift Suprême', cost: 10000 }, redeemed_at: '2026-09-29T12:00:00.000Z' } };
    expect(await consumer.consumeAuthenticated(wire)).toEqual({ action: 'IGNORE', reason: 'OTHER_REWARD' });
    expect((await effects(p.id)).movements).toBe(0);
    wire.event.reward = { ...wire.event.reward, id: rewardId, title: 'A descriptive renamed title' };
    expect(await consumer.consumeAuthenticated(wire)).toMatchObject({ action: 'FULFILL', targetPlayerId: p.id });
  });
  it('rolls back notification failure together with economy and the receipt', async () => {
    const p = await player('Notification Rollback Gift'), sent = input(p.displayName);
    // Root Prisma delegates are different from transaction delegates: inject a real private-schema failure.
    if (!/^batch_test_[0-9a-f]{32}$/.test(fixture.schema)) throw new Error('Invalid private fixture schema');
    await fixture.admin.query(`ALTER TABLE "${fixture.schema}".notifications ADD CONSTRAINT private_notification_failure CHECK (false) NOT VALID`);
    try { await expect(service.process(sent)).rejects.toThrow(); }
    finally { await fixture.admin.query(`ALTER TABLE "${fixture.schema}".notifications DROP CONSTRAINT private_notification_failure`); }
    expect(await effects(p.id)).toMatchObject({ movements: 0, operations: 0, notifications: 0, stats: { totalMainElementParticlesEarned: 0n } });
    expect(await db.twitchEventReceipt.count({ where: { externalEventId: `gift-supreme:${sent.redemptionId}` } })).toBe(0);
    expect(await service.process(sent)).toMatchObject({ action: 'FULFILL' });
  });
  it('never accepts two contradictory concurrent proofs for one redemption', async () => {
    const p = await player('Concurrent Proof Gift'), sent = input(p.displayName);
    const results = await Promise.allSettled([service.process(sent), service.process({ ...sent, gifterTwitchUserId: '888' })]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(GiftSupremeIdempotencyConflict);
    expect(await effects(p.id)).toMatchObject({ movements: 1, operations: 1, notifications: 1 });
  });
});
