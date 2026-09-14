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
const service = new GiftCodeService(getPlayer, database, clock);
let fixtureSubject: string | null = null;
let fixtureCodeIds: string[] = [];

async function cleanupSubject(subject: string) {
  const identity = await database.webIdentity.findUnique({ where: { provider_providerSubject: { provider: 'supabase', providerSubject: subject } }, select: { playerId: true } });
  if (identity) {
    const operations = await database.businessOperation.findMany({ where: { playerId: identity.playerId, operationType: { startsWith: 'gift-code.' } }, select: { id: true } });
    await database.notification.deleteMany({ where: { playerId: identity.playerId, domainKey: 'gift-codes' } });
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
  fixtureCodeIds = [];
  const stale = await database.webIdentity.findMany({ where: { provider: 'supabase', providerSubject: { startsWith: 'codex-gift-code-' } }, select: { providerSubject: true } });
  for (const row of stale) await cleanupSubject(row.providerSubject);
});
afterEach(async () => {
  if (fixtureSubject) await cleanupSubject(fixtureSubject);
  if (fixtureCodeIds.length) await database.giftCode.deleteMany({ where: { id: { in: fixtureCodeIds } } });
  fixtureSubject = null;
  fixtureCodeIds = [];
});
afterAll(async () => database.$disconnect());

describe('GiftCodeService on Supabase DEV', () => {
  it('claims one annual edition exactly once under concurrent requests and resolves its notification atomically', async () => {
    fixtureSubject = `codex-gift-code-${randomUUID()}`;
    const identity = { subject: fixtureSubject };
    const created = await provision.execute(identity, `Codex Gift ${randomUUID().slice(0, 8)}`);
    const before = await service.listForPlayer(identity);
    const festival = before.available.find(({ token }) => token === 'FESTIVALRECOLTES');
    expect(festival?.rewards.map(({ resourceKey, amount }) => [resourceKey, amount])).toEqual([['moras', '200000'], ['primogems', '1600']]);
    const leftKey = randomUUID(); const rightKey = randomUUID();
    const [left, right] = await Promise.all([service.claim(identity, festival!.editionId, leftKey), service.claim(identity, festival!.editionId, rightKey)]);
    expect([left.operation.alreadyProcessed, right.operation.alreadyProcessed].sort()).toEqual([false, true]);
    expect(left.operation.id).toBe(right.operation.id);
    const completedKey = left.operation.alreadyProcessed ? rightKey : leftKey;
    const retry = await service.claim(identity, festival!.editionId, completedKey);
    expect(retry.operation).toEqual({ id: left.operation.id, alreadyProcessed: true });
    const [claimCount, movements, balances, notification] = await Promise.all([
      database.giftCodeClaim.count({ where: { giftCodeEditionId: festival!.editionId, playerId: created.player.id } }),
      database.resourceMovement.findMany({ where: { playerId: created.player.id, operationId: left.operation.id }, orderBy: { resourceKey: 'asc' } }),
      database.playerResourceBalance.findMany({ where: { playerId: created.player.id, resourceKey: { in: ['moras', 'primogems'] } }, orderBy: { resourceKey: 'asc' } }),
      database.notification.findUnique({ where: { deduplicationKey: `gift-code:${created.player.id}:${festival!.editionId}` } }),
    ]);
    expect(claimCount).toBe(1);
    expect(movements.map(({ resourceKey, delta }) => [resourceKey, delta])).toEqual([['moras', 200000n], ['primogems', 1600n]]);
    expect(balances.map(({ resourceKey, amount }) => [resourceKey, amount])).toEqual([['moras', 200000n], ['primogems', 1600n]]);
    expect(notification?.state).toBe('RESOLVED');
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

    testNow = new Date('2027-09-14T12:00:00.000Z');
    const nextYear = await service.listForPlayer(identity);
    const nextEdition = nextYear.available.find(({ token, editionKey }) => token === 'FESTIVALRECOLTES' && editionKey === '2027');
    expect(nextEdition).toBeDefined();
    await service.claim(identity, nextEdition!.editionId, randomUUID());
    const [annualClaimCount, annualBalances] = await Promise.all([
      database.giftCodeClaim.count({ where: { playerId: created.player.id, edition: { giftCode: { token: 'FESTIVALRECOLTES' } } } }),
      database.playerResourceBalance.findMany({ where: { playerId: created.player.id, resourceKey: { in: ['moras', 'primogems'] } }, orderBy: { resourceKey: 'asc' } }),
    ]);
    expect(annualClaimCount).toBe(2);
    expect(annualBalances.map(({ resourceKey, amount }) => [resourceKey, amount])).toEqual([['moras', 400000n], ['primogems', 3200n]]);
  }, 15_000);

  it('rejects unavailable one-off editions and preserves lossless bigint particle rewards for a player without an element', async () => {
    fixtureSubject = `codex-gift-code-${randomUUID()}`;
    const identity = { subject: fixtureSubject };
    const created = await provision.execute(identity, `Codex Gift ${randomUUID().slice(0, 8)}`);
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
    await database.playerRoleAssignment.create({ data: { playerId: created.player.id, role: 'ADMIN', source: 'codex-gift-code-test' } });
    const token = `CODEXADMIN${randomUUID().replace(/-/g, '').slice(0, 8)}`.toUpperCase();
    const createKey = randomUUID();
    const draftInput = { token, title: 'Cadeau test', description: 'Brouillon test', type: 'ANNUAL' as const, recurringMonth: 9, rewards: [{ resourceKey: 'primogems' as const, amount: 123n }], idempotencyKey: createKey };
    const createdDraft = await service.createDraft(identity, draftInput);
    const draft = createdDraft.codes.find((code) => code.token === token)!;
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
    expect(editedDraft.codes.find((code) => code.id === draft.id)).toMatchObject({ token: editedToken, type: 'ONE_OFF', locked: false, rewards: [{ resourceKey: 'moras', amount: '456' }] });

    const publishKey = randomUUID();
    await service.publish(identity, draft.id, publishKey);
    await service.publish(identity, draft.id, publishKey);
    const available = (await service.listForPlayer(identity)).available.find((code) => code.token === editedToken)!;
    expect(available.rewards).toEqual([{ resourceKey: 'moras', displayName: 'Moras', amount: '456' }]);
    await service.claim(identity, available.editionId, randomUUID());
    await expect(service.update(identity, draft.id, { token, type: 'ANNUAL', recurringMonth: 10, rewards: [{ resourceKey: 'primogems', amount: 123n }], idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'GIFT_CODE_LOCKED' });
    const disabled = await service.update(identity, draft.id, { title: 'Cadeau test obtenu', disabled: true, idempotencyKey: randomUUID() });
    expect(disabled.codes.find((code) => code.id === draft.id)).toMatchObject({ title: 'Cadeau test obtenu', status: 'DISABLED', claimCount: 1, locked: true });
    expect((await service.listForPlayer(identity)).claimed.some((code) => code.token === editedToken)).toBe(true);
    expect((await service.claimants(identity, draft.id)).claimants).toHaveLength(1);
    const audits = await database.adminAuditEntry.findMany({ where: { actorPlayerId: created.player.id, domain: 'gift-codes' }, select: { action: true } });
    expect(audits.map(({ action }) => action).sort()).toEqual(['create', 'disable', 'publish', 'update']);
  }, 30_000);
});
