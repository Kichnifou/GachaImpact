import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { validateImage } from '../src/infrastructure/character-catalog/catalog-images.js';
import type { CatalogFields } from '../src/application/character-catalog/catalog-policy.js';
import { CatalogFetchError } from '../src/infrastructure/character-catalog/catalog-http.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { CatalogEngine } from '../src/application/character-catalog/catalog-engine.js';
import { CatalogAdminService } from '../src/application/character-catalog/catalog-admin.js';
import { CatalogScheduler } from '../src/application/character-catalog/catalog-scheduler.js';
import { getNextBusinessResetAt } from '../src/domain/time/business-date.js';
import type { CatalogHttp } from '../src/infrastructure/character-catalog/catalog-http.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import type { AuthenticatedIdentity } from '../src/domain/identity/authenticated-identity.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
beforeAll(() => fixture.setup({ prismaMigrations: true, seedPublicCatalog: true }), 180_000);
afterAll(() => fixture.cleanup(), 60_000);
const official = { post: { post_id: '46884007', uid: '1015537', game_id: 2, created_at: 1790654467, subject: 'Fixture official',
  structured_content: JSON.stringify([{ insert: '◆Name: Private Catalog\n◆Vision: Electro\n' }]), is_deleted: 0 },
  user: { uid: '1015537', certification: { type: 1, desc: 'Official Big Boss' } } };
const http: CatalogHttp = async url => {
  let value: unknown;
  if (url.includes('getNewsList')) value = { retcode: 0, data: { list: [official], last_id: 0, is_last: true } };
  else if (url.includes('getPostFull')) value = { retcode: 0, data: { post: official } };
  else if (url.includes('commits/main')) value = { sha: 'a'.repeat(40) };
  else if (url.includes('/contents/')) value = Array.from({ length: 100 }, (_, i) => ({ name: `unused-${i}.json`, download_url: null }));
  else if (url.endsWith('/characters')) value = ['old-coverage'];
  else return { status: 404, body: Buffer.alloc(0), mime: 'text/plain', url };
  return { status: 200, body: Buffer.from(JSON.stringify(value)), mime: 'application/json', url };
};
const engine = () => new CatalogEngine(db, { enabled: true, publish: false, dryRun: false }, http);

describe('isolated catalogue migration, durable cycles and invariants', () => {
  it('replays all versioned migrations and protects the seven new tables from browser roles', async () => {
    expect(fixture.migrationStatus).toContain('up to date');
    const rows = await fixture.admin.query(`SELECT c.relname, c.relrowsecurity, has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon, has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS auth FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname=$1 AND c.relname LIKE 'catalog_%' AND c.relkind='r'`, [fixture.schema]);
    expect(rows.rows).toHaveLength(7);
    for (const row of rows.rows) expect(row).toMatchObject({ relrowsecurity: true, anon: false, auth: false });
  });
  it('rejects AVAILABLE assets with null dimensions, bytes or MIME at the SQL boundary', async () => {
    const candidate = await db.catalogCandidate.create({ data: { name: 'Private SQL constraint', nextCheckAt: new Date('2099-01-01T00:00:00Z') } });
    try {
      for (const field of ['width', 'height', 'bytes', 'mime'] as const) {
        await expect(db.catalogAsset.create({ data: { candidateId: candidate.id, role: 'icon', hash: 'a'.repeat(64),
          url: 'https://fixture.supabase.co/storage/v1/object/public/character-catalog/fixture.png', provider: 'fixture',
          status: 'AVAILABLE', width: 256, height: 256, bytes: 100, mime: 'image/png', [field]: null } })).rejects.toThrow();
      }
      expect(await db.catalogAsset.count({ where: { candidateId: candidate.id } })).toBe(0);
    } finally { await db.catalogCandidate.delete({ where: { id: candidate.id } }); }
  });
  it('two instances discover once; completed replay changes no active Character', async () => {
    const before = await db.character.findMany({ orderBy: { id: 'asc' } });
    const result = await Promise.all([engine().run(), engine().run()]);
    expect(result.some(value => 'skipped' in value && value.skipped === 'LEASE_BUSY')).toBe(true);
    expect(await db.catalogIdentity.count({ where: { namespace: 'hoyolab-post', externalId: '46884007' } })).toBe(1);
    expect(await db.catalogCandidate.count({ where: { name: 'Private Catalog' } })).toBe(1);
    const daily = await db.catalogRun.findFirstOrThrow({ where: { cycleKey: { startsWith: 'daily:' } } });
    expect(daily.status).toBe('QUEUED');
    expect((await db.catalogJob.findUniqueOrThrow({ where: { id: 'R1051' } })).lastSuccessDate).toBeNull();
    expect(await engine().run()).toEqual({ skipped: 'BACKOFF' });
    let remaining = await db.catalogCandidate.count({ where: { checkedAt: null } });
    expect(remaining).toBeGreaterThan(100);
    for (let batch = 0; remaining && batch < 10; batch++) {
      await db.catalogRun.update({ where: { id: daily.id }, data: { nextAttemptAt: new Date(0) } });
      const result = await engine().run(); // A fresh instance resumes the same durable daily cycle.
      expect(result).toMatchObject({ runId: daily.id });
      const next = await db.catalogCandidate.count({ where: { checkedAt: null } });
      expect(next).toBeLessThan(remaining);
      remaining = next;
    }
    expect(remaining).toBe(0);
    expect(await db.catalogRun.count({ where: { cycleKey: { startsWith: 'daily:' } } })).toBe(1);
    expect((await db.catalogRun.findUniqueOrThrow({ where: { id: daily.id } })).status).toBe('COMPLETED');
    expect(await engine().run()).toEqual({ skipped: 'ALREADY_COMPLETED' });
    expect(await db.character.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    expect(await db.catalogImportOutbox.count()).toBe(0);
  }, 300_000);
  it('missing fundamentals are durable and a manual retry remains idempotent', async () => {
    const candidate = await db.catalogCandidate.findFirstOrThrow({ where: { name: 'Private Catalog' } });
    expect(candidate.characterId).toBeNull(); expect(candidate.missing).toEqual(expect.arrayContaining(['rarity', 'officialReleaseDate', 'icon']));
    expect(candidate.nextCheckAt.getTime()).toBeGreaterThan(candidate.checkedAt!.getTime());
    expect(candidate.nextCheckAt).toEqual(getNextBusinessResetAt(candidate.checkedAt!));
    const requestId = randomUUID();
    const run = await db.catalogRun.create({ data: { cycleKey: `manual:${requestId}`, status: 'QUEUED', summary: { candidateId: candidate.id, mode: 'retry' } } });
    await engine().run('retry', candidate.id, run.id);
    expect(await engine().run('retry', candidate.id, run.id)).toEqual({ skipped: 'ALREADY_COMPLETED' });
    expect(await db.catalogCandidate.count({ where: { name: 'Private Catalog' } })).toBe(1);
    expect(await db.catalogAttempt.count({ where: { candidateId: candidate.id, errorCode: 'COVERAGE_UNQUALIFIED' } })).toBeGreaterThan(0);
  }, 60_000);
  it('reaudit writes its report and attempts without changing metadata/assets/Character', async () => {
    const candidate = await db.catalogCandidate.findFirstOrThrow({ where: { name: 'Private Catalog' } });
    const before = await db.catalogCandidate.findUniqueOrThrow({ where: { id: candidate.id }, include: { assets: true } });
    await engine().run('audit', candidate.id);
    expect(await db.catalogCandidate.findUniqueOrThrow({ where: { id: candidate.id }, include: { assets: true } })).toEqual(before);
  }, 60_000);
  it('expired leases are recovered; a live lease cannot be stolen', async () => {
    const token = randomUUID();
    await db.catalogJob.update({ where: { id: 'R1051' }, data: { leaseToken: token, leaseUntil: new Date(Date.now() + 60_000) } });
    expect(await engine().run()).toEqual({ skipped: 'LEASE_BUSY' });
    await db.catalogJob.update({ where: { id: 'R1051' }, data: { leaseUntil: new Date(Date.now() - 1000) } });
    expect(await engine().run()).toEqual({ skipped: 'ALREADY_COMPLETED' });
    expect(await db.catalogJob.findUnique({ where: { id: 'R1051' } })).toMatchObject({ leaseToken: null, leaseUntil: null });
  });
  it('scheduler catches up once for today after missed dates, independent of player activity', async () => {
    const job = await db.catalogJob.findUniqueOrThrow({ where: { id: 'R1051' } });
    const runs = await db.catalogRun.count();
    await new CatalogScheduler(db, engine()).catchUp();
    expect(await db.catalogRun.count()).toBe(runs);
    expect((await db.catalogJob.findUniqueOrThrow({ where: { id: 'R1051' } })).lastSuccessDate).toBe(job.lastSuccessDate);
  });
  it('ADMIN permissions are checked; metadata corrections survive retry and cannot bypass a publication gate', async () => {
    const player = await db.player.create({ data: { displayName: 'Private catalog admin', elementKey: 'hydro' } });
    const getPlayer = { execute: async () => player } as unknown as GetCurrentPlayer;
    const identity = {} as AuthenticatedIdentity;
    const admin = new CatalogAdminService(db, getPlayer, engine());
    const candidate = await db.catalogCandidate.findFirstOrThrow({ where: { name: 'Private Catalog' } });
    await expect(admin.overview(identity)).rejects.toMatchObject({ statusCode: 403 });
    await db.playerRoleAssignment.create({ data: { playerId: player.id, role: 'ADMIN', grantedByPlayerId: player.id } });
    await admin.edit(identity, candidate.id, { rarity: 4 }, randomUUID());
    await engine().run('retry', candidate.id);
    expect((await db.catalogCandidate.findUniqueOrThrow({ where: { id: candidate.id } })).fields).toMatchObject({ rarity: { value: 4, override: true } });
    await expect(admin.override(identity, candidate.id, randomUUID(), 'Private controlled reason', 0)).rejects.toMatchObject({ code: 'CATALOG_PUBLICATION_DISABLED' });
  }, 60_000);
  it('notifications come only from a committed outbox, deduplicate and target only current ADMIN', async () => {
    const candidate = await db.catalogCandidate.findFirstOrThrow({ where: { characterId: { not: null } } });
    const ordinary = await db.player.create({ data: { displayName: 'Private ordinary', elementKey: 'hydro' } });
    await db.catalogImportOutbox.create({ data: { candidateId: candidate.id, characterId: candidate.characterId!, name: 'Private notification', payload: { title: 'Nouveau personnage ajouté : Private notification' } } });
    await Promise.all([engine().deliverNotifications(), engine().deliverNotifications()]);
    expect(await db.notification.count({ where: { typeKey: 'CHARACTER_IMPORTED_ADMIN', playerId: ordinary.id } })).toBe(0);
    expect(await db.notification.count({ where: { typeKey: 'CHARACTER_IMPORTED_ADMIN' } })).toBe(1);
    await engine().deliverNotifications(); expect(await db.notification.count({ where: { typeKey: 'CHARACTER_IMPORTED_ADMIN' } })).toBe(1);
  });
  it('verifies public bytes, rolls back a failed publication, then imports once with a committed outbox', async () => {
    const now = new Date(), fields: CatalogFields = {};
    for (const [key, value] of [['originalName', 'Private Publish'], ['rarity', 5], ['element', 'electro'], ['numericId', 19999998], ['releaseDate', '2026-01-01']] as const)
      fields[key] = { value, provider: 'fixture', url: 'https://www.hoyolab.com/article/1', reliability: 'OFFICIAL', fetchedAt: now.toISOString() };
    const candidate = await db.catalogCandidate.create({ data: { name: 'Private Publish', fields, identities: { create: { namespace: 'genshin', externalId: '19999998' } } } });
    const bytes = new Map<string, Buffer>();
    for (const role of ['icon', 'splash'] as const) {
      const body = await sharp({ create: { width: role === 'icon' ? 256 : 1024, height: role === 'icon' ? 256 : 512, channels: 4, background: { r: 100, g: 180, b: 200, alpha: .8 } } }).png().toBuffer();
      const image = await validateImage(body, 'image/png', role);
      const url = `https://fixture.supabase.co/storage/v1/object/public/character-catalog/characters/${candidate.id}/${role}/${image.hash}.png`;
      bytes.set(url, image.body);
      await db.catalogAsset.create({ data: { candidateId: candidate.id, role, hash: image.hash, provider: 'fixture', url, mime: 'image/png', width: image.width, height: image.height, bytes: image.bytes, status: 'AVAILABLE' } });
    }
    const publisher = new CatalogEngine(db, { enabled: true, publish: true, dryRun: false, storageUrl: 'https://fixture.supabase.co', storageKey: 'private_fixture' },
      async url => ({ status: 200, mime: 'image/png', body: bytes.get(url) ?? Buffer.from('wrong'), url }));
    const verified = await publisher.verifyPublication(candidate.id);
    const count = await db.character.count(), notices = await db.notification.count({ where: { typeKey: 'CHARACTER_IMPORTED_ADMIN' } });
    await expect(db.$transaction(async tx => { await publisher.publish(tx, candidate, fields, false, verified); throw new Error('rollback fixture'); })).rejects.toThrow('rollback fixture');
    expect(await db.character.count()).toBe(count);
    expect(await db.catalogImportOutbox.findUnique({ where: { candidateId: candidate.id } })).toBeNull();
    await publisher.deliverNotifications(); expect(await db.notification.count({ where: { typeKey: 'CHARACTER_IMPORTED_ADMIN' } })).toBe(notices);
    await db.$transaction(tx => publisher.publish(tx, candidate, fields, false, verified));
    const published = await db.catalogCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
    expect(published.characterId).not.toBeNull(); expect(await db.character.count()).toBe(count + 1);
    await expect(db.$transaction(tx => publisher.publish(tx, published, fields, false, verified))).rejects.toThrow('IDENTITY_CONFLICT');
    await Promise.all([publisher.deliverNotifications(), publisher.deliverNotifications()]);
    expect(await db.catalogImportOutbox.count({ where: { candidateId: candidate.id } })).toBe(1);
    expect(await db.notification.count({ where: { typeKey: 'CHARACTER_IMPORTED_ADMIN', actionTargetId: published.characterId! } })).toBe(1);
    bytes.set([...bytes.keys()][0]!, Buffer.from('changed'));
    await expect(publisher.verifyPublication(candidate.id)).rejects.toThrow('STORAGE_VERIFICATION_FAILED');
  }, 60_000);
  it('backs off failed manual work durably and resumes it after a process restart', async () => {
    const candidate = await db.catalogCandidate.findFirstOrThrow({ where: { name: 'Private Catalog' } });
    const run = await db.catalogRun.create({ data: { cycleKey: `manual:${randomUUID()}`, status: 'QUEUED', summary: { candidateId: candidate.id, mode: 'audit' } } });
    const failing = new CatalogEngine(db, { enabled: true, publish: false, dryRun: false }, async () => { throw new CatalogFetchError('BUDGET_EXHAUSTED'); });
    await expect(failing.run('audit', candidate.id, run.id)).rejects.toThrow('BUDGET_EXHAUSTED');
    expect(await db.catalogRun.findUniqueOrThrow({ where: { id: run.id } })).toMatchObject({ status: 'FAILED', failureCount: 1, summary: { mode: 'audit', candidateId: candidate.id } });
    expect(await engine().run('audit', candidate.id, run.id)).toEqual({ skipped: 'BACKOFF' });
    await db.catalogRun.update({ where: { id: run.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
    await new CatalogScheduler(db, engine()).catchUp();
    expect(await db.catalogRun.findUniqueOrThrow({ where: { id: run.id } })).toMatchObject({ status: 'COMPLETED', failureCount: 0 });
  }, 60_000);
  it('resumes all dry-run batches without altering candidates, assets or active Characters', async () => {
    const now = new Date(Date.now() + 86_400_000);
    await db.catalogCandidate.updateMany({ data: { nextCheckAt: new Date(now.getTime() + 86_400_000) } });
    await db.catalogCandidate.createMany({ data: Array.from({ length: 16 }, (_, i) => ({ name: `Private dry run ${i}` })) });
    const before = await db.catalogCandidate.findMany({ orderBy: { id: 'asc' }, include: { assets: true } });
    const characters = await db.character.findMany({ orderBy: { id: 'asc' } });
    const simulation = () => new CatalogEngine(db, { enabled: true, publish: false, dryRun: true }, http, () => now);
    const first = await simulation().run();
    expect(first).toMatchObject({ processed: 15, remaining: 1 });
    if (!('runId' in first)) throw new Error('Expected daily run');
    expect(await simulation().run()).toEqual({ skipped: 'BACKOFF' });
    await db.catalogRun.update({ where: { id: first.runId }, data: { nextAttemptAt: new Date(0) } });
    expect(await simulation().run()).toMatchObject({ runId: first.runId, processed: 1, remaining: 0 });
    expect(await simulation().run()).toEqual({ skipped: 'ALREADY_COMPLETED' });
    expect(await db.catalogCandidate.findMany({ orderBy: { id: 'asc' }, include: { assets: true } })).toEqual(before);
    expect(await db.character.findMany({ orderBy: { id: 'asc' } })).toEqual(characters);
    const run = await db.catalogRun.findUniqueOrThrow({ where: { id: first.runId } });
    expect((run.summary as { processedCandidateIds: string[] }).processedCandidateIds).toHaveLength(16);
  }, 90_000);
});
