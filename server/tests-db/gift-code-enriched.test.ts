import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { GiftCodeService, type GiftCodeRewardInput } from '../src/application/gift-code/gift-code-service.js';
import { EventService } from '../src/application/event/event-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { withPlayerCommandExecution } from '../src/application/player/player-command-execution.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { PrismaBoxStore } from '../src/infrastructure/database/prisma-box-store.js';
import { PrismaInventoryStore } from '../src/infrastructure/database/prisma-inventory-store.js';
import { GetCurrentPlayerInventory } from '../src/application/inventory/inventory-services.js';
import { sacCommand } from '../src/application/chat/chat-command-format.js';
import { SocialService } from '../src/application/social/social-service.js';

const isolated = isolatedBatchDatabase(), db = isolated.database;
const store = new PrismaCurrentPlayerStore(db), getPlayer = new GetCurrentPlayer(store), provision = new GetOrProvisionCurrentPlayer(store);
let year = 2700, now = new Date(`${year}-10-15T12:00:00Z`);
const clock = { now: () => new Date(now) };
const event = new EventService(getPlayer, db, clock, { nextInt: () => 0 });
const service = new GiftCodeService(getPlayer, db, clock, { activePlayerIds: [] }, event);
let admin: { subject: string };
beforeAll(async () => {
  await isolated.setup({ seedPublicCatalog: true, prismaMigrations: true });
  expect(isolated.migrationStatus).toContain('68 migrations');
  const actor = await player(); admin = actor.identity;
  await db.playerRoleAssignment.create({ data: { playerId: actor.id, role: 'ADMIN', source: 'r1057-private' } });
}, 180_000);
beforeEach(() => { year += 1; now = new Date(`${year}-10-15T12:00:00Z`); });
afterAll(() => isolated.cleanup(), 60_000);
async function player() {
  const identity = { subject: `r1057-${randomUUID()}` };
  const result = await provision.execute(identity, 'Private code player');
  return { identity, id: result.player.id };
}
async function code(rewards: readonly GiftCodeRewardInput[], annual = false) {
  const draft = await service.createDraft(admin, { token: `R1057-${randomUUID().slice(0, 12)}`, title: 'Private gift', description: 'Private only', type: annual ? 'ANNUAL' : 'ONE_OFF', recurringMonth: annual ? 10 : undefined, startsAt: annual ? undefined : new Date(`${year}-01-01T00:00:00Z`), endsAt: annual ? undefined : new Date(`${year + 2}-01-01T00:00:00Z`), rewards, idempotencyKey: randomUUID() });
  const published = await service.publish(admin, draft.code.id, randomUUID());
  return { id: draft.code.id, editionId: published.code.editions[0]!.id, published: published.code };
}
async function joined(p: Awaited<ReturnType<typeof player>>, points = 0) {
  const context = await event.resolveCurrentEdition(db, now);
  await db.eventParticipant.create({ data: { eventEditionId: context.edition.id, playerId: p.id, points, joinedAt: now } });
  return context;
}
async function currency(playerId: string, eventDefinitionId: string) { return (await db.playerEventCurrencyBalance.findUnique({ where: { playerId_eventDefinitionId: { playerId, eventDefinitionId } } }))?.amount ?? 0n; }

it('keeps backend-only security and nonnegative physical guards, without publishing or crediting migration data', async () => {
  const security = await db.$queryRaw<Array<{ rls: boolean; browser: boolean }>>`SELECT relrowsecurity rls, (has_table_privilege('anon', oid, 'SELECT') OR has_table_privilege('authenticated', oid, 'UPDATE')) browser FROM pg_class WHERE oid = 'gift_codes'::regclass`;
  expect(security).toEqual([{ rls: true, browser: false }]);
  const existing = await db.giftCode.findMany();
  expect(existing.length).toBeGreaterThan(0);
  expect(existing.every(row => row.stellaAmount === 0n && row.eventPoints === 0 && row.eventCurrency === 0n)).toBe(true);
  expect(await db.giftCodeClaim.count()).toBe(0);
  await expect(db.giftCode.update({ where: { id: existing[0]!.id }, data: { eventCurrency: -1n } })).rejects.toThrow();
});
it('credits Stella through the existing inventory, with one acquisition and unchanged first obtain on replay', async () => {
  const p = await player(), c = await code([{ resourceKey: 'masterless-stella-fortuna', amount: 3n }]);
  const key = randomUUID(), first = await service.claim(p.identity, c.editionId, key);
  expect(first.grantedRewards).toEqual([{ resourceKey: 'masterless-stella-fortuna', displayName: 'Masterless Stella Fortuna', amount: '3' }]);
  expect(await new PrismaBoxStore(db).getStellaQuantity(p.id)).toBe(3n);
  const item = await db.playerItem.findFirstOrThrow({ where: { playerId: p.id } });
  expect(await service.claim(p.identity, c.editionId, key)).toMatchObject({ operation: { id: first.operation.id, alreadyProcessed: true }, grantedRewards: first.grantedRewards });
  expect(await db.playerItem.findUniqueOrThrow({ where: { playerId_itemId: { playerId: p.id, itemId: item.itemId } } })).toEqual(item);
  expect(await db.itemAcquisition.count({ where: { playerId: p.id } })).toBe(1);
  expect(await db.eventParticipant.count({ where: { playerId: p.id } })).toBe(0);
});
it('credits points alone and pays one reached milestone atomically', async () => {
  const p = await player(), context = await joined(p, 9), c = await code([{ resourceKey: 'event_points', amount: 1n }]);
  const result = await service.claim(p.identity, c.editionId, randomUUID());
  expect(result.eventReward).toEqual({ granted: true, reason: null, editionId: context.edition.id, milestones: [10] });
  expect(result.grantedRewards).toEqual(expect.arrayContaining([{ resourceKey: 'event_points', displayName: 'Points Event', amount: '1' }]));
  expect(await db.eventMilestoneClaim.count({ where: { playerId: p.id } })).toBe(1);
  expect(await currency(p.id, context.definition.id)).toBe(0n);
});
it('preserves an unknown first obtain date and the existing Stella stock', async () => {
  const p = await player(), item = await db.itemDefinition.findUniqueOrThrow({ where: { externalKey: 'masterless-stella-fortuna' } });
  await db.playerItem.create({ data: { playerId: p.id, itemId: item.id, quantity: 5n, firstObtainedAt: null } });
  const c = await code([{ resourceKey: 'masterless-stella-fortuna', amount: 2n }]);
  await service.claim(p.identity, c.editionId, randomUUID());
  expect(await db.playerItem.findUniqueOrThrow({ where: { playerId_itemId: { playerId: p.id, itemId: item.id } } })).toMatchObject({ quantity: 7n, firstObtainedAt: null });
  expect(await db.itemAcquisition.count({ where: { playerId: p.id } })).toBe(1);
});
it('credits currency alone to the current definition and never triggers milestones', async () => {
  const p = await player(), context = await joined(p, 80), c = await code([{ resourceKey: 'event_currency', amount: 7n }]);
  const result = await service.claim(p.identity, c.editionId, randomUUID());
  expect(result.grantedRewards).toEqual([{ resourceKey: 'event_currency', displayName: context.editionSnapshot.config.currency.label, amount: '7' }]);
  expect(await currency(p.id, context.definition.id)).toBe(7n);
  expect(await db.eventMilestoneClaim.count({ where: { playerId: p.id } })).toBe(0);
});
it('pays only newly crossed milestones, without inventing missing historical rewards', async () => {
  const p = await player(); await joined(p, 79);
  const c = await code([{ resourceKey: 'event_points', amount: 1n }]);
  const result = await service.claim(p.identity, c.editionId, randomUUID());
  expect(result.eventReward?.milestones).toEqual([80]);
  expect(await db.eventMilestoneClaim.count({ where: { playerId: p.id } })).toBe(1);
});
it('keeps already-paid legacy milestones byte-for-byte and never pays them again', async () => {
  const p = await player(), context = await joined(p, 10);
  const legacy = await db.eventMilestoneClaim.create({ data: { eventEditionId: context.edition.id, playerId: p.id, milestone: 10, origin: 'LEGACY', operationId: null, claimedAt: null, legacyProvenance: { privateFixture: true } } });
  const c = await code([{ resourceKey: 'event_points', amount: 10n }]);
  const result = await service.claim(p.identity, c.editionId, randomUUID());
  expect(result.eventReward?.milestones).toEqual([20]);
  expect(await db.eventMilestoneClaim.findUnique({ where: { eventEditionId_playerId_milestone: { eventEditionId: context.edition.id, playerId: p.id, milestone: 10 } } })).toEqual(legacy);
  expect(await db.resourceMovement.count({ where: { playerId: p.id } })).toBe(0);
});
it('mixes all reward kinds, crosses all eight milestones once and persists actual aggregate gains', async () => {
  const p = await player(), context = await joined(p), c = await code([{ resourceKey: 'primogems', amount: 5n }, { resourceKey: 'moras', amount: 2n }, { resourceKey: 'particles_geo', amount: 3n }, { resourceKey: 'masterless-stella-fortuna', amount: 2n }, { resourceKey: 'event_points', amount: 80n }, { resourceKey: 'event_currency', amount: 3n }]);
  const key = randomUUID(), result = await service.claim(p.identity, c.editionId, key, 'TWITCH');
  expect(result.eventReward?.milestones).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  expect(result.grantedRewards?.find(r => r.resourceKey === 'primogems')?.amount).toBe('1605');
  expect(result.grantedRewards?.find(r => r.resourceKey === 'moras')?.amount).toBe('50002');
  expect(result.grantedRewards?.find(r => r.resourceKey === 'event_currency')?.amount).toBe('21');
  const breakdown = result.claimed.find(row => row.editionId === c.editionId)!.rewardBreakdown!;
  expect(breakdown.direct.find(row => row.resourceKey === 'event_currency')?.amount).toBe('3');
  expect(breakdown.milestones.find(row => row.resourceKey === 'event_currency')?.amount).toBe('18');
  expect(breakdown.direct.find(row => row.resourceKey === 'primogems')?.amount).toBe('5');
  expect(breakdown.milestones.find(row => row.resourceKey === 'primogems')?.amount).toBe('1600');
  expect(await currency(p.id, context.definition.id)).toBe(21n);
  expect(await db.eventMilestoneClaim.count({ where: { playerId: p.id } })).toBe(8);
  const operations = await db.businessOperation.findMany({ where: { playerId: p.id } });
  expect(operations.filter(row => row.operationType === 'event.milestone.reward')).toHaveLength(8);
  expect(operations.every(row => row.status === 'COMPLETED')).toBe(true);
  now = new Date(`${year}-11-15T12:00:00Z`);
  const replay = await service.claim(p.identity, c.editionId, key, 'TWITCH');
  expect(replay.grantedRewards).toEqual(result.grantedRewards);
  expect(replay.eventReward).toEqual(result.eventReward);
  expect(replay.claimed.find(row => row.editionId === c.editionId)!.rewardBreakdown).toEqual(breakdown);
  expect((await service.listForPlayer(p.identity)).claimed.find(row => row.editionId === c.editionId)?.rewards).toEqual(result.grantedRewards);
  expect(await db.eventMilestoneClaim.count({ where: { playerId: p.id } })).toBe(8);
});
it('keeps identical notification rows untouched across repeated and concurrent reconciliations', async () => {
  const p = await player(), c = await code([{ resourceKey: 'moras', amount: 100n }]);
  await service.reconcileNotificationsForPlayer(p.id, now, false);
  const key = `gift-code:${p.id}:${c.editionId}`;
  const version = async () => db.$queryRaw<Array<{ version: string }>>`SELECT xmin::text version FROM notifications WHERE deduplication_key=${key}`;
  const before = await version(); expect(before).toHaveLength(1);
  for (let i = 0; i < 5; i++) await service.reconcileNotificationsForPlayer(p.id, now, false);
  await Promise.all([service.reconcileNotificationsForPlayer(p.id, now, false), service.reconcileNotificationsForPlayer(p.id, now, false)]);
  expect(await version()).toEqual(before);
  await service.update(admin, c.id, { title: 'Updated private title', idempotencyKey: randomUUID() });
  await service.reconcileNotificationsForPlayer(p.id, now, false);
  expect(await version()).not.toEqual(before);
  expect((await db.notification.findUniqueOrThrow({ where: { deduplicationKey: key } })).payload).toMatchObject({ title: 'Updated private title' });
});
it('projects the real Stella inventory after gift credit and canonical consumption without another award', async () => {
  const p = await player(), c = await code([{ resourceKey: 'masterless-stella-fortuna', amount: 2n }]);
  const services = { socialService: new SocialService(getPlayer, db, clock), getCurrentPlayerInventory: new GetCurrentPlayerInventory(getPlayer, new PrismaInventoryStore(db)) };
  expect((await sacCommand(p.identity, services)).join(' ')).not.toContain('Stella');
  await service.claim(p.identity, c.editionId, randomUUID());
  expect((await sacCommand(p.identity, services)).join(' ')).toContain('✨ Masterless Stella Fortuna : 2');
  const character = await db.character.findFirstOrThrow({ where: { rarity: 5, isActive: true } });
  await db.playerCharacter.create({ data: { playerId: p.id, characterId: character.id, constellation: 0, copies: 1, firstObtainedAt: now } });
  await new PrismaBoxStore(db).useStella({ playerId: p.id, characterId: character.id, idempotencyKey: randomUUID(), now, random: { nextInt: () => 0 } });
  expect((await sacCommand(p.identity, services)).join(' ')).toContain('✨ Masterless Stella Fortuna : 1');
  expect(await db.itemAcquisition.count({ where: { playerId: p.id, sourceKey: 'GIFT_CODE' } })).toBe(1);
});
it.each(['NOT_JOINED', 'FINISHED', 'SCHEDULED', 'ABSENT', 'EXPIRED'] as const)('skips every Event gain for %s while independently granting classic rewards and Stella', async state => {
  const p = await player();
  if (state !== 'ABSENT') {
    const context = state === 'NOT_JOINED' ? await event.resolveCurrentEdition(db, now) : await joined(p);
    if (state === 'FINISHED' || state === 'SCHEDULED') await db.eventEdition.update({ where: { id: context.edition.id }, data: { status: state } });
    if (state === 'EXPIRED') await db.eventEdition.update({ where: { id: context.edition.id }, data: { endsAt: new Date(now.getTime() - 1) } });
  }
  const c = await code([{ resourceKey: 'primogems', amount: 6n }, { resourceKey: 'masterless-stella-fortuna', amount: 1n }, { resourceKey: 'event_points', amount: 80n }, { resourceKey: 'event_currency', amount: 40n }]);
  const before = await db.eventEdition.count(), result = await service.claim(p.identity, c.editionId, randomUUID());
  expect(result.grantedRewards?.map(row => row.resourceKey)).toEqual(['primogems', 'masterless-stella-fortuna']);
  expect(result.eventReward?.granted).toBe(false);
  expect(await db.eventEdition.count()).toBe(before);
  expect(await db.playerEventCurrencyBalance.count({ where: { playerId: p.id } })).toBe(0);
  expect(await db.eventMilestoneClaim.count({ where: { playerId: p.id } })).toBe(0);
  expect(await db.eventParticipant.count({ where: { playerId: p.id } })).toBe(state === 'NOT_JOINED' || state === 'ABSENT' ? 0 : 1);
});
it('consumes an Event-only code without deferred entitlement or enrollment when ineligible', async () => {
  const p = await player(), c = await code([{ resourceKey: 'event_points', amount: 80n }]);
  const first = await service.claim(p.identity, c.editionId, randomUUID());
  expect(first.grantedRewards).toEqual([]);
  await joined(p);
  expect(await service.claim(p.identity, c.editionId, randomUUID())).toMatchObject({ grantedRewards: [], operation: { id: first.operation.id, alreadyProcessed: true } });
  expect(await db.eventMilestoneClaim.count({ where: { playerId: p.id } })).toBe(0);
});
it('serializes simultaneous claims with distinct keys and sources, preserving the first result', async () => {
  const p = await player(), context = await joined(p), c = await code([{ resourceKey: 'masterless-stella-fortuna', amount: 2n }, { resourceKey: 'event_points', amount: 80n }, { resourceKey: 'event_currency', amount: 3n }]);
  const results = await Promise.all([service.claim(p.identity, c.editionId, randomUUID(), 'UI'), service.claim(p.identity, c.editionId, randomUUID(), 'TWITCH')]);
  expect(results.map(r => r.operation.alreadyProcessed).sort()).toEqual([false, true]);
  expect(results[0]!.operation.id).toBe(results[1]!.operation.id);
  expect(results[0]!.grantedRewards).toEqual(results[1]!.grantedRewards);
  expect(await new PrismaBoxStore(db).getStellaQuantity(p.id)).toBe(2n);
  expect(await currency(p.id, context.definition.id)).toBe(21n);
  expect(await db.giftCodeClaim.count({ where: { playerId: p.id } })).toBe(1);
  expect(await db.itemAcquisition.count({ where: { playerId: p.id } })).toBe(1);
});
it('rechecks a concurrently closed edition after its lock, skipping Event without losing independent rewards', async () => {
  const p = await player(), context = await joined(p), c = await code([{ resourceKey: 'primogems', amount: 1n }, { resourceKey: 'event_points', amount: 80n }]);
  await isolated.admin.query('BEGIN');
  try {
    await isolated.admin.query('UPDATE event_editions SET status = $1 WHERE id = $2', ['FINISHED', context.edition.id]);
    const pending = service.claim(p.identity, c.editionId, randomUUID());
    await vi.waitFor(async () => {
      const locks = await isolated.admin.query("SELECT count(*)::int n FROM pg_locks WHERE NOT granted AND locktype = 'transactionid'");
      expect(locks.rows[0].n).toBeGreaterThan(0);
    }, { timeout: 3_000, interval: 10 });
    await isolated.admin.query('COMMIT');
    const result = await pending;
    expect(result.eventReward?.granted).toBe(false);
    expect(result.grantedRewards?.map(reward => reward.resourceKey)).toEqual(['primogems']);
    expect(await db.eventMilestoneClaim.count({ where: { playerId: p.id } })).toBe(0);
    expect(await currency(p.id, context.definition.id)).toBe(0n);
  } finally { await isolated.admin.query('ROLLBACK'); }
});
it('rolls back every gain, claim, acquisition and milestone when points overflow', async () => {
  const p = await player(), context = await joined(p, 2_147_483_647), c = await code([{ resourceKey: 'primogems', amount: 1n }, { resourceKey: 'masterless-stella-fortuna', amount: 2n }, { resourceKey: 'event_points', amount: 1n }]);
  const balances = await db.playerResourceBalance.findMany({ where: { playerId: p.id }, orderBy: { resourceKey: 'asc' } });
  await expect(service.claim(p.identity, c.editionId, randomUUID())).rejects.toMatchObject({ code: 'EVENT_POINTS_OVERFLOW' });
  expect(await db.playerResourceBalance.findMany({ where: { playerId: p.id }, orderBy: { resourceKey: 'asc' } })).toEqual(balances);
  expect(await db.giftCodeClaim.count({ where: { playerId: p.id } })).toBe(0);
  expect(await db.itemAcquisition.count({ where: { playerId: p.id } })).toBe(0);
  expect(await db.businessOperation.count({ where: { playerId: p.id } })).toBe(0);
  expect((await db.eventParticipant.findUniqueOrThrow({ where: { eventEditionId_playerId: { eventEditionId: context.edition.id, playerId: p.id } } })).points).toBe(2_147_483_647);
});
it('rolls back classic rewards, Stella and newly crossed milestones if the Event balance overflows', async () => {
  const p = await player(), context = await joined(p);
  await db.playerEventCurrencyBalance.create({ data: { playerId: p.id, eventDefinitionId: context.definition.id, amount: 9_223_372_036_854_775_807n } });
  const c = await code([{ resourceKey: 'primogems', amount: 1n }, { resourceKey: 'masterless-stella-fortuna', amount: 1n }, { resourceKey: 'event_points', amount: 10n }, { resourceKey: 'event_currency', amount: 1n }]);
  await expect(service.claim(p.identity, c.editionId, randomUUID())).rejects.toThrow();
  expect(await db.giftCodeClaim.count({ where: { playerId: p.id } })).toBe(0);
  expect(await db.itemAcquisition.count({ where: { playerId: p.id } })).toBe(0);
  expect(await db.resourceMovement.count({ where: { playerId: p.id, domainKey: { in: ['event', 'gift-codes'] } } })).toBe(0);
  expect(await db.eventMilestoneClaim.count({ where: { playerId: p.id } })).toBe(0);
  expect(await currency(p.id, context.definition.id)).toBe(9_223_372_036_854_775_807n);
});
it('rejects a reused operation key for another Player or code before any new gain', async () => {
  const p = await player(), other = await player(), c = await code([{ resourceKey: 'masterless-stella-fortuna', amount: 1n }]);
  const second = await code([{ resourceKey: 'masterless-stella-fortuna', amount: 2n }]), key = randomUUID();
  await service.claim(p.identity, c.editionId, key);
  await expect(service.claim(other.identity, c.editionId, key)).rejects.toMatchObject({ code: 'GIFT_CODE_IDEMPOTENCY_CONFLICT' });
  await expect(service.claim(p.identity, second.editionId, key)).rejects.toMatchObject({ code: 'GIFT_CODE_IDEMPOTENCY_CONFLICT' });
  expect(await new PrismaBoxStore(db).getStellaQuantity(p.id)).toBe(1n);
  expect(await new PrismaBoxStore(db).getStellaQuantity(other.id)).toBe(0n);
});
it('ignores a frozen old Event target and only credits the existing, joined current edition', async () => {
  const p = await player(), old = await joined(p), c = await code([{ resourceKey: 'event_points', amount: 1n }, { resourceKey: 'event_currency', amount: 3n }]);
  const captured = now; now = new Date(`${year}-11-15T12:00:00Z`);
  const current = await joined(p);
  const result = await withPlayerCommandExecution({ source: 'TWITCH', now: captured, eventEditionId: old.edition.id }, () => service.claim(p.identity, c.editionId, randomUUID(), 'TWITCH'));
  expect(result.eventReward?.editionId).toBe(current.edition.id);
  expect(await currency(p.id, old.definition.id)).toBe(0n);
  expect(await currency(p.id, current.definition.id)).toBe(3n);
  expect((await db.eventParticipant.findUniqueOrThrow({ where: { eventEditionId_playerId: { eventEditionId: old.edition.id, playerId: p.id } } })).points).toBe(0);
});
it('preserves historical claims and locks all enriched reward configuration after the first claim', async () => {
  const p = await player(), c = await code([{ resourceKey: 'primogems', amount: 6n }]);
  const legacy = await db.giftCodeClaim.create({ data: { giftCodeEditionId: c.editionId, playerId: p.id, sourceChannel: 'TWITCH', origin: 'LEGACY', operationId: null, claimedAt: null, legacyProvenance: { privateFixture: true } } });
  await expect(service.claim(p.identity, c.editionId, randomUUID())).rejects.toMatchObject({ code: 'GIFT_CODE_ALREADY_CLAIMED' });
  await expect(service.update(admin, c.id, { rewards: [{ resourceKey: 'masterless-stella-fortuna', amount: 50n }], idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'GIFT_CODE_LOCKED' });
  expect(await db.giftCodeClaim.findUnique({ where: { giftCodeEditionId_playerId: { giftCodeEditionId: c.editionId, playerId: p.id } } })).toEqual(legacy);
  expect(await db.resourceMovement.count({ where: { playerId: p.id, domainKey: 'gift-codes' } })).toBe(0);
});
it('edits and clears enriched draft quantities, validates bounds, and keeps annual edition claim uniqueness', async () => {
  const p = await player(), c = await code([{ resourceKey: 'masterless-stella-fortuna', amount: 1n }], true);
  const updated = await service.update(admin, c.id, { rewards: [{ resourceKey: 'event_currency', amount: 4n }], idempotencyKey: randomUUID() });
  expect(updated.code.rewards).toEqual([{ resourceKey: 'event_currency', amount: '4', displayName: 'Monnaie de l’édition Event en cours' }]);
  expect((await db.giftCode.findUniqueOrThrow({ where: { id: c.id } })).stellaAmount).toBe(0n);
  await expect(service.update(admin, c.id, { rewards: [{ resourceKey: 'event_points', amount: 2_147_483_648n }], idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'GIFT_CODE_INVALID_CONFIGURATION' });
  const first = await service.claim(p.identity, c.editionId, randomUUID());
  expect(first.grantedRewards).toEqual([]);
  now = new Date(`${year + 1}-10-15T12:00:00Z`);
  const next = await service.listForPlayer(p.identity), nextEdition = next.available.find(row => row.id === c.id)!;
  expect(nextEdition.editionId).not.toBe(c.editionId);
  await service.claim(p.identity, nextEdition.editionId, randomUUID());
  expect(await db.giftCodeClaim.count({ where: { playerId: p.id, edition: { giftCodeId: c.id } } })).toBe(2);
});
