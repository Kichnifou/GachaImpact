import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GiftCodeService } from '../src/application/gift-code/gift-code-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { loadConfig } from '../src/config/environment.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for gift-code integration tests.');
const database = createDatabase(config.databaseUrl);
const store = new PrismaCurrentPlayerStore(database);
const provision = new GetOrProvisionCurrentPlayer(store);
const getPlayer = new GetCurrentPlayer(store);
let testNow = new Date('2026-09-14T12:00:00.000Z');
const clock = { now: () => testNow };
let service: GiftCodeService;
let fixtureSubject: string | null = null;
let extraFixtureSubjects: string[] = [];
let fixtureCodeIds: string[] = [];

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function cleanupSubject(subject: string) {
  const identity = await database.webIdentity.findUnique({ where: { provider_providerSubject: { provider: 'supabase', providerSubject: subject } }, select: { playerId: true } });
  if (identity) {
    const operations = await database.businessOperation.findMany({ where: { playerId: identity.playerId, operationType: { startsWith: 'gift-code.' } }, select: { id: true } });
    await database.notification.deleteMany({ where: { playerId: identity.playerId } });
    await database.giftCodeClaim.deleteMany({ where: { playerId: identity.playerId } });
    await database.resourceMovement.deleteMany({ where: { operationId: { in: operations.map(({ id }) => id) } } });
    await database.adminAuditEntry.deleteMany({ where: { OR: [{ actorPlayerId: identity.playerId }, { targetPlayerId: identity.playerId }] } });
    await database.businessOperation.deleteMany({ where: { id: { in: operations.map(({ id }) => id) } } });
    await database.webIdentity.deleteMany({ where: { playerId: identity.playerId, providerSubject: subject } });
    await database.player.delete({ where: { id: identity.playerId } });
  }
}
beforeEach(async () => {
  testNow = new Date('2026-09-14T12:00:00.000Z');
  extraFixtureSubjects = [];
  fixtureCodeIds = [];
});
afterEach(async () => {
  if (fixtureSubject) await cleanupSubject(fixtureSubject);
  for (const subject of extraFixtureSubjects) await cleanupSubject(subject);
  if (fixtureCodeIds.length) await database.giftCode.deleteMany({ where: { id: { in: fixtureCodeIds } } });
  fixtureSubject = null;
  extraFixtureSubjects = [];
  fixtureCodeIds = [];
});
afterAll(async () => database.$disconnect());

describe('GiftCodeService on Supabase DEV', () => {
  async function createConcurrencyFixture() {
    fixtureSubject = `codex-gift-code-lock-${randomUUID()}`;
    const otherSubject = `codex-gift-code-lock-other-${randomUUID()}`;
    extraFixtureSubjects.push(otherSubject);
    const identity = { subject: fixtureSubject };
    const otherIdentity = { subject: otherSubject };
    const [created, other] = await Promise.all([
      provision.execute(identity, `Codex Lock ${randomUUID().slice(0, 8)}`),
      provision.execute(otherIdentity, `Codex Other ${randomUUID().slice(0, 8)}`),
    ]);
    await database.playerRoleAssignment.create({ data: { playerId: created.player.id, role: 'ADMIN', source: 'codex-gift-code-test' } });
    const baseService = new GiftCodeService(getPlayer, database, clock, { annualCodeIds: [], activePlayerIds: [created.player.id, other.player.id] });
    const createPublished = async (label: string) => {
      const draft = await baseService.createDraft(identity, {
        token: `CODEXLOCK${label}${randomUUID().replace(/-/g, '').slice(0, 8)}`.toUpperCase(),
        title: `Verrou ${label}`, description: `Fixture isolée ${label}`, type: 'ONE_OFF',
        startsAt: new Date('2026-09-01T00:00:00.000Z'), endsAt: new Date('2026-10-01T00:00:00.000Z'),
        rewards: [{ resourceKey: 'primogems', amount: 1n }], idempotencyKey: randomUUID(),
      });
      fixtureCodeIds.push(draft.code.id);
      const published = await baseService.publish(identity, draft.code.id, randomUUID());
      return { codeId: draft.code.id, editionId: published.code.editions[0]!.id };
    };
    const affected = await createPublished('AFFECTED');
    const guard = await createPublished('GUARD');
    await Promise.all([
      baseService.reconcileNotificationsForPlayer(created.player.id),
      baseService.reconcileNotificationsForPlayer(other.player.id),
    ]);
    return {
      identity,
      playerIds: [created.player.id, other.player.id] as const,
      affected,
      guard,
      serviceWithHooks: (testHooks: Readonly<{ afterReconciliationCodeLock?: () => Promise<void>; afterAdminCodeLock?: () => Promise<void> }>) => new GiftCodeService(getPlayer, database, clock, { annualCodeIds: [], activePlayerIds: [created.player.id, other.player.id], testHooks }),
    };
  }

  async function expectDisabledFixtureState(fixture: Awaited<ReturnType<typeof createConcurrencyFixture>>) {
    const [codes, notifications] = await Promise.all([
      database.giftCode.findMany({ where: { id: { in: [fixture.affected.codeId, fixture.guard.codeId] } }, select: { id: true, status: true } }),
      database.notification.findMany({ where: { playerId: { in: [...fixture.playerIds] }, actionTargetId: { in: [fixture.affected.editionId, fixture.guard.editionId] } }, select: { playerId: true, actionTargetId: true, state: true } }),
    ]);
    expect(codes.find(({ id }) => id === fixture.affected.codeId)?.status).toBe('DISABLED');
    expect(codes.find(({ id }) => id === fixture.guard.codeId)?.status).toBe('PUBLISHED');
    expect(notifications).toHaveLength(4);
    expect(notifications.filter(({ actionTargetId }) => actionTargetId === fixture.affected.editionId).map(({ state }) => state).sort()).toEqual(['RESOLVED', 'RESOLVED']);
    expect(notifications.filter(({ actionTargetId }) => actionTargetId === fixture.guard.editionId).map(({ state }) => state).sort()).toEqual(['UNREAD', 'UNREAD']);
  }

  it('claims one isolated edition exactly once and resolves only its own notification atomically', async () => {
    fixtureSubject = `codex-gift-code-${randomUUID()}`;
    const identity = { subject: fixtureSubject };
    const created = await provision.execute(identity, `Codex Gift ${randomUUID().slice(0, 8)}`);
    service = new GiftCodeService(getPlayer, database, clock, { annualCodeIds: [], activePlayerIds: [created.player.id] });
    const code = await database.giftCode.create({ data: { token: `CODEXISO${randomUUID().replace(/-/g, '').slice(0, 12)}`.toUpperCase(), title: 'Code isolé', description: 'Fixture exacte', type: 'ONE_OFF', status: 'PUBLISHED', startsAt: new Date('2026-09-01T00:00:00Z'), endsAt: new Date('2026-10-01T00:00:00Z'), publishedAt: testNow, createdById: created.player.id, updatedById: created.player.id, rewards: { create: [{ resourceKey: 'primogems', amount: 1600n }, { resourceKey: 'moras', amount: 200000n }] }, editions: { create: { editionKey: 'once', startsAt: new Date('2026-09-01T00:00:00Z'), endsAt: new Date('2026-10-01T00:00:00Z') } } }, include: { editions: true } });
    fixtureCodeIds.push(code.id);
    await database.notification.create({ data: { playerId: created.player.id, domainKey: 'expedition', typeKey: 'ready', payload: { characterName: 'Fixture' }, actionKey: 'open-expedition-character', actionTargetId: randomUUID(), deduplicationKey: `gift-code-isolation-expedition:${created.player.id}` } });
    const before = await service.listForPlayer(identity);
    const festival = before.available.find(({ id }) => id === code.id);
    expect(festival?.rewards.map(({ resourceKey, amount }) => [resourceKey, amount])).toEqual([['moras', '200000'], ['primogems', '1600']]);
    const leftKey = randomUUID(); const rightKey = randomUUID();
    const [left, right] = await Promise.all([service.claim(identity, festival!.editionId, leftKey), service.claim(identity, festival!.editionId, rightKey)]);
    expect([left.operation.alreadyProcessed, right.operation.alreadyProcessed].sort()).toEqual([false, true]);
    expect(left.operation.id).toBe(right.operation.id);
    const completedKey = left.operation.alreadyProcessed ? rightKey : leftKey;
    const retry = await service.claim(identity, festival!.editionId, completedKey);
    expect(retry.operation).toEqual({ id: left.operation.id, alreadyProcessed: true });
    const [claimCount, movements, balances, notification, expeditionNotification] = await Promise.all([
      database.giftCodeClaim.count({ where: { giftCodeEditionId: festival!.editionId, playerId: created.player.id } }),
      database.resourceMovement.findMany({ where: { playerId: created.player.id, operationId: left.operation.id }, orderBy: { resourceKey: 'asc' } }),
      database.playerResourceBalance.findMany({ where: { playerId: created.player.id, resourceKey: { in: ['moras', 'primogems'] } }, orderBy: { resourceKey: 'asc' } }),
      database.notification.findUnique({ where: { deduplicationKey: `gift-code:${created.player.id}:${festival!.editionId}` } }),
      database.notification.findUniqueOrThrow({ where: { deduplicationKey: `gift-code-isolation-expedition:${created.player.id}` } }),
    ]);
    expect(claimCount).toBe(1);
    expect(movements.map(({ resourceKey, delta }) => [resourceKey, delta])).toEqual([['moras', 200000n], ['primogems', 1600n]]);
    expect(balances.map(({ resourceKey, amount }) => [resourceKey, amount])).toEqual([['moras', 200000n], ['primogems', 1600n]]);
    expect(notification?.state).toBe('RESOLVED');
    expect(expeditionNotification.state).toBe('UNREAD');
    const after = await service.listForPlayer(identity);
    expect(after.available.some(({ editionId }) => editionId === festival!.editionId)).toBe(false);
    expect(after.claimed.some(({ editionId }) => editionId === festival!.editionId)).toBe(true);

    testNow = new Date('2026-10-02T12:00:00.000Z');
    const expiredRetry = await service.claim(identity, festival!.editionId, completedKey);
    expect(expiredRetry.operation).toEqual({ id: left.operation.id, alreadyProcessed: true });
    await expect(service.claim(identity, festival!.editionId, randomUUID())).rejects.toMatchObject({ code: 'GIFT_CODE_UNAVAILABLE' });
    const [expiredClaimCount, expiredMovements, expiredBalances] = await Promise.all([
      database.giftCodeClaim.count({ where: { giftCodeEditionId: festival!.editionId, playerId: created.player.id } }),
      database.resourceMovement.findMany({ where: { playerId: created.player.id, operationId: left.operation.id }, orderBy: { resourceKey: 'asc' } }),
      database.playerResourceBalance.findMany({ where: { playerId: created.player.id, resourceKey: { in: ['moras', 'primogems'] } }, orderBy: { resourceKey: 'asc' } }),
    ]);
    expect(expiredClaimCount).toBe(1);
    expect(expiredMovements.map(({ resourceKey, delta }) => [resourceKey, delta])).toEqual([['moras', 200000n], ['primogems', 1600n]]);
    expect(expiredBalances.map(({ resourceKey, amount }) => [resourceKey, amount])).toEqual([['moras', 200000n], ['primogems', 1600n]]);

  }, 15_000);

  it('rejects unavailable one-off editions and preserves lossless bigint particle rewards for a player without an element', async () => {
    fixtureSubject = `codex-gift-code-${randomUUID()}`;
    const identity = { subject: fixtureSubject };
    const created = await provision.execute(identity, `Codex Gift ${randomUUID().slice(0, 8)}`);
    service = new GiftCodeService(getPlayer, database, clock, { annualCodeIds: [], activePlayerIds: [created.player.id] });
    expect(created.player.elementKey).toBeNull();
    await expect(service.listAdmin(identity)).rejects.toMatchObject({ code: 'GIFT_CODE_ADMIN_FORBIDDEN' });
    await database.playerRoleAssignment.createMany({ data: [
      { playerId: created.player.id, role: 'MODERATOR', source: 'codex-gift-code-test' },
      { playerId: created.player.id, role: 'TESTER', source: 'codex-gift-code-test' },
    ] });
    await expect(service.listAdmin(identity)).rejects.toMatchObject({ code: 'GIFT_CODE_ADMIN_FORBIDDEN' });
    await database.playerRoleAssignment.create({ data: { playerId: created.player.id, role: 'ADMIN', source: 'codex-gift-code-test' } });
    await expect(service.listAdmin(identity)).resolves.toMatchObject({ actorPlayerId: created.player.id });
    const createCode = async (suffix: string, status: 'PUBLISHED' | 'DISABLED', startsAt: Date, endsAt: Date, amount = 1n) => {
      const code = await database.giftCode.create({
        data: {
          token: `CODEX${suffix}${randomUUID().replace(/-/g, '').slice(0, 8)}`.toUpperCase(), title: suffix, description: suffix,
          type: 'ONE_OFF', status, startsAt, endsAt, publishedAt: startsAt, createdById: created.player.id, updatedById: created.player.id,
          rewards: { create: [{ resourceKey: 'particles_hydro', amount }] },
          editions: { create: [{ editionKey: 'once', startsAt, endsAt }] },
        },
        include: { editions: true },
      });
      fixtureCodeIds.push(code.id);
      return code.editions[0]!;
    };
    const active = await createCode('ACTIVE', 'PUBLISHED', new Date('2026-09-01T00:00:00Z'), new Date('2026-10-01T00:00:00Z'), 9007199254740993n);
    const expired = await createCode('EXPIRED', 'PUBLISHED', new Date('2026-08-01T00:00:00Z'), new Date('2026-09-01T00:00:00Z'));
    const disabled = await createCode('DISABLED', 'DISABLED', new Date('2026-09-01T00:00:00Z'), new Date('2026-10-01T00:00:00Z'));

    await expect(service.claim(identity, expired.id, randomUUID())).rejects.toMatchObject({ code: 'GIFT_CODE_UNAVAILABLE' });
    await expect(service.claim(identity, disabled.id, randomUUID())).rejects.toMatchObject({ code: 'GIFT_CODE_UNAVAILABLE' });
    const snapshot = await service.listForPlayer(identity);
    expect(snapshot.available.map(({ editionId }) => editionId)).toContain(active.id);
    expect(snapshot.available.map(({ editionId }) => editionId)).not.toContain(expired.id);
    expect(snapshot.available.map(({ editionId }) => editionId)).not.toContain(disabled.id);

    const result = await service.claim(identity, active.id, randomUUID());
    expect(result.resources.particles.hydro).toBe('9007199254740993');
    const movement = await database.resourceMovement.findFirstOrThrow({ where: { playerId: created.player.id, operationId: result.operation.id, resourceKey: 'particles_hydro' } });
    expect(movement.delta).toBe(9007199254740993n);
  }, 15_000);

  it('keeps drafts private, audits idempotent ADMIN publication, locks configuration after claim, and permits disable', async () => {
    fixtureSubject = `codex-gift-code-${randomUUID()}`;
    const identity = { subject: fixtureSubject };
    const created = await provision.execute(identity, `Codex Gift ${randomUUID().slice(0, 8)}`);
    service = new GiftCodeService(getPlayer, database, clock, { annualCodeIds: [], activePlayerIds: [created.player.id] });
    await database.playerRoleAssignment.create({ data: { playerId: created.player.id, role: 'ADMIN', source: 'codex-gift-code-test' } });
    const token = `CODEXADMIN${randomUUID().replace(/-/g, '').slice(0, 8)}`.toUpperCase();
    const createKey = randomUUID();
    const draftInput = { token, title: 'Cadeau test', description: 'Brouillon test', type: 'ANNUAL' as const, recurringMonth: 9, rewards: [{ resourceKey: 'primogems' as const, amount: 123n }], idempotencyKey: createKey };
    const createdDraft = await service.createDraft(identity, draftInput);
    const draft = createdDraft.code;
    fixtureCodeIds.push(draft.id);
    expect(draft.status).toBe('DRAFT');
    await service.createDraft(identity, draftInput);
    expect(await database.giftCode.count({ where: { token } })).toBe(1);
    expect((await service.listForPlayer(identity)).available.some((code) => code.token === token)).toBe(false);

    const editedToken = `${token}EDIT`;
    const editedDraft = await service.update(identity, draft.id, {
      token: editedToken,
      type: 'ONE_OFF',
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      endsAt: new Date('2026-10-01T00:00:00.000Z'),
      rewards: [{ resourceKey: 'moras', amount: 456n }],
      idempotencyKey: randomUUID(),
    });
    expect(editedDraft.code).toMatchObject({ token: editedToken, type: 'ONE_OFF', locked: false, rewards: [{ resourceKey: 'moras', amount: '456' }] });

    const publishKey = randomUUID();
    await service.publish(identity, draft.id, publishKey);
    await service.publish(identity, draft.id, publishKey);
    const available = (await service.listForPlayer(identity)).available.find((code) => code.token === editedToken)!;
    expect(available.rewards).toEqual([{ resourceKey: 'moras', displayName: 'Moras', amount: '456' }]);
    await service.claim(identity, available.editionId, randomUUID());
    await expect(service.update(identity, draft.id, { token, type: 'ANNUAL', recurringMonth: 10, rewards: [{ resourceKey: 'primogems', amount: 123n }], idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'GIFT_CODE_LOCKED' });
    const disabled = await service.update(identity, draft.id, { title: 'Cadeau test obtenu', disabled: true, idempotencyKey: randomUUID() });
    expect(disabled.code).toMatchObject({ title: 'Cadeau test obtenu', status: 'DISABLED', claimCount: 1, locked: true });
    expect((await service.listForPlayer(identity)).claimed.some((code) => code.token === editedToken)).toBe(true);
    expect((await service.claimants(identity, draft.id)).claimants).toHaveLength(1);
    const audits = await database.adminAuditEntry.findMany({ where: { actorPlayerId: created.player.id, domain: 'gift-codes' }, select: { action: true } });
    expect(audits.map(({ action }) => action).sort()).toEqual(['create', 'disable', 'publish', 'update']);
  }, 30_000);

  it('cannot resurrect an affected notification when disable races reconciliation', async () => {
    fixtureSubject = `codex-gift-code-${randomUUID()}`;
    const identity = { subject: fixtureSubject };
    const created = await provision.execute(identity, `Codex Gift ${randomUUID().slice(0, 8)}`);
    await database.playerRoleAssignment.create({ data: { playerId: created.player.id, role: 'ADMIN', source: 'codex-gift-code-test' } });
    service = new GiftCodeService(getPlayer, database, clock, { annualCodeIds: [], activePlayerIds: [created.player.id] });
    const draft = await service.createDraft(identity, {
      token: `CODEXRACE${randomUUID().replace(/-/g, '').slice(0, 8)}`.toUpperCase(),
      title: 'Course notification', description: 'Fixture exacte de concurrence', type: 'ONE_OFF',
      startsAt: new Date('2026-09-01T00:00:00.000Z'), endsAt: new Date('2026-10-01T00:00:00.000Z'),
      rewards: [{ resourceKey: 'primogems', amount: 1n }], idempotencyKey: randomUUID(),
    });
    fixtureCodeIds.push(draft.code.id);
    const published = await service.publish(identity, draft.code.id, randomUUID());
    const editionId = published.code.editions[0]!.id;
    await service.reconcileNotificationsForPlayer(created.player.id);

    await Promise.all([
      service.reconcileNotificationsForPlayer(created.player.id),
      service.update(identity, draft.code.id, { disabled: true, idempotencyKey: randomUUID() }),
    ]);

    const notification = await database.notification.findUniqueOrThrow({ where: { deduplicationKey: `gift-code:${created.player.id}:${editionId}` } });
    expect(notification.state).toBe('RESOLVED');
  }, 30_000);

  it('serializes disable after a reconciliation that already holds the published-code lock', async () => {
    const fixture = await createConcurrencyFixture();
    const reconciliationLocked = deferred();
    const releaseReconciliation = deferred();
    const order: string[] = [];
    service = fixture.serviceWithHooks({
      afterReconciliationCodeLock: async () => {
        order.push('reconciliation-locked');
        reconciliationLocked.resolve();
        await releaseReconciliation.promise;
        order.push('reconciliation-released');
      },
      afterAdminCodeLock: async () => { order.push('disable-locked'); },
    });

    const reconciliation = service.reconcileNotificationsForPlayer(fixture.playerIds[0]);
    await reconciliationLocked.promise;
    const disable = service.update(fixture.identity, fixture.affected.codeId, { disabled: true, idempotencyKey: randomUUID() });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(order).toEqual(['reconciliation-locked']);
    releaseReconciliation.resolve();
    await Promise.all([reconciliation, disable]);

    expect(order.indexOf('disable-locked')).toBeGreaterThan(order.indexOf('reconciliation-released'));
    await expectDisabledFixtureState(fixture);
  }, 30_000);

  it('makes reconciliation wait for a disable that already holds the code lock', async () => {
    const fixture = await createConcurrencyFixture();
    const disableLocked = deferred();
    const releaseDisable = deferred();
    const order: string[] = [];
    service = fixture.serviceWithHooks({
      afterAdminCodeLock: async () => {
        order.push('disable-locked');
        disableLocked.resolve();
        await releaseDisable.promise;
        order.push('disable-released');
      },
      afterReconciliationCodeLock: async () => { order.push('reconciliation-locked'); },
    });

    const disable = service.update(fixture.identity, fixture.affected.codeId, { disabled: true, idempotencyKey: randomUUID() });
    await disableLocked.promise;
    const reconciliation = service.reconcileNotificationsForPlayer(fixture.playerIds[0]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(order).toEqual(['disable-locked']);
    releaseDisable.resolve();
    await Promise.all([disable, reconciliation]);

    expect(order.indexOf('reconciliation-locked')).toBeGreaterThan(order.indexOf('disable-released'));
    await expectDisabledFixtureState(fixture);
  }, 30_000);
});
