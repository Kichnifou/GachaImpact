import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { eligibility, mergeEvidence, type CatalogFields } from '../src/application/character-catalog/catalog-policy.js';
import { CatalogFetchError, RequestBudget, checkSourceUrl, isPublicIp } from '../src/infrastructure/character-catalog/catalog-http.js';
import { CatalogImageStorage, validateImage } from '../src/infrastructure/character-catalog/catalog-images.js';
import { parseOfficialPost, officialReleaseEvidence, CatalogSources } from '../src/infrastructure/character-catalog/catalog-sources.js';
import { getBusinessDate, getNextBusinessResetAt } from '../src/domain/time/business-date.js';
import { officialCharacterAsset } from '../src/application/character-catalog/catalog-asset-url.js';

const now = new Date('2026-10-11T10:00:00Z');
const evidence = (value: string | number) => ({ value, provider: 'hoyoverse', reliability: 'OFFICIAL' as const, url: 'https://www.hoyolab.com/article/1', fetchedAt: now.toISOString() });
const fields: CatalogFields = { originalName: evidence('Private'), rarity: evidence(5), element: evidence('electro'), numericId: evidence(10000999), releaseDate: evidence('2026-10-12') };
const official = (uid = '1015537', content = '◆Name: Private\n◆Vision: Electro\n') => ({ post: { post_id: '1', uid, game_id: 2, created_at: 1790654467,
  subject: 'Official', structured_content: JSON.stringify([{ insert: content }]), is_deleted: 0 }, user: { uid, certification: { type: 1, desc: 'Official Big Boss' } } });

describe('catalogue eligibility and provenance', () => {
  it('requires trustworthy fundamentals, real UI assets and official availability', () => {
    expect(eligibility(fields, ['icon', 'splash'], now).status).toBe('ELIGIBLE');
    expect(eligibility({ ...fields, rarity: undefined }, ['icon', 'splash'], now).missing).toContain('rarity');
    expect(eligibility(fields, ['icon'], now).status).toBe('INCOMPLETE');
    expect(eligibility({ ...fields, releaseDate: { ...evidence('2026-10-12'), reliability: 'STRUCTURED' } }, ['icon', 'splash'], now).missing).toContain('officialReleaseDate');
  });
  it('allows published dates and J+7, blocks unknown and distant dates; override only changes the window', () => {
    expect(eligibility({ ...fields, releaseDate: evidence('2026-10-18') }, ['icon', 'splash'], now).status).toBe('ELIGIBLE');
    const distant = { ...fields, releaseDate: evidence('2026-11-04') };
    expect(eligibility(distant, ['icon', 'splash'], now).status).toBe('OUT_OF_WINDOW');
    expect(eligibility(distant, ['icon', 'splash'], now, true).status).toBe('ELIGIBLE');
    expect(eligibility({ ...distant, rarity: undefined }, ['icon', 'splash'], now, true).status).toBe('INCOMPLETE');
  });
  it('preserves ADMIN data and flags disagreement without erasing the good value', () => {
    expect(mergeEvidence(fields, 'rarity', evidence(4)).rarity).toMatchObject({ value: 5, conflict: true });
    const admin = { rarity: { ...evidence(4), reliability: 'ADMIN' as const, override: true } };
    expect(mergeEvidence(admin, 'rarity', evidence(5))).toEqual(admin);
  });
  it('does not require a distinct fullbody or wish strip for publication', () => expect(eligibility(fields, ['icon', 'splash'], now).missing).toEqual([]));
  it('blocks conflicts even under an out-of-window override', () => expect(eligibility({ ...fields, rarity: { ...evidence(5), conflict: true } }, ['icon', 'splash'], now, true).status).toBe('CONFLICT'));
});

describe('official discovery and source failures', () => {
  it('matches qualified spelling aliases while retaining manifest technical names rather than deriving them', async () => {
    const attempts: unknown[] = [];
    const sources = new CatalogSources(async url => {
      const value = url.includes('commits/main') ? { sha: 'a'.repeat(40) } : url.includes('/contents/') ?
        [{ name: 'kamisatoayaka.json', download_url: null }, ...Array.from({ length: 99 }, (_, i) => ({ name: `unused${i}.json`, download_url: null }))] :
        url.endsWith('/image/characters.json') ? { kamisatoayaka: { filename_icon: 'UI_AvatarIcon_ExplicitAlias', filename_gachaSplash: 'UI_Gacha_AvatarImg_ExplicitAlias' } } :
        { id: 10000002, name: 'Kamisato Ayaka', rarity: 5, elementType: 'ELEMENT_CRYO', weaponText: 'Sword', affiliation: 'Inazuma' };
      return { status: 200, mime: 'application/json', body: Buffer.from(JSON.stringify(value)), url };
    }, async row => { attempts.push(row); }, now);
    const result = await sources.structured(['Kamisato Ayaka']);
    expect(result?.fields.numericId?.value).toBe(10000002);
    expect(result?.images.icon).toEqual([{ provider: 'enka', url: 'https://enka.network/ui/UI_AvatarIcon_ExplicitAlias.png' }]);
    expect(result?.images.splash?.[0]?.url).toContain('ExplicitAlias');
  });
  it('verifies author identity rather than the hosting domain or is_official flag', () => {
    expect(parseOfficialPost(official(), now)).toMatchObject({ name: 'Private', fields: { element: { value: 'electro' } } });
    expect(() => parseOfficialPost(official('123'), now)).toThrow('AUTHOR_NOT_OFFICIAL');
  });
  it('rejects schema changes, uncertified authors and future announcements', () => {
    expect(() => parseOfficialPost({}, now)).toThrow('SCHEMA_CHANGED');
    const post = official(); post.user.certification.type = 0;
    expect(() => parseOfficialPost(post, now)).toThrow('AUTHOR_NOT_OFFICIAL');
    const future = official(); future.post.created_at = 1900000000;
    expect(() => parseOfficialPost(future, now)).toThrow('UNCONFIRMED');
  });
  it('never turns an announcement date into a release date', () => {
    const post = parseOfficialPost(official(), now);
    expect(officialReleaseEvidence(post, ['Private'], now)).toBeNull();
  });
  it('accepts an explicit availability sentence or one dated Wish, rejecting mixed phases', () => {
    const post = parseOfficialPost(official('1015537', 'The new character Private will be available from 2026/11/04\n'), now);
    expect(officialReleaseEvidence(post, ['Private'], now)?.value).toBe('2026-11-04');
    expect(officialReleaseEvidence({ ...post, text: post.text.replace('new character ', '') }, ['Private'], now)).toBeNull();
    const wish = parseOfficialPost(official('1015537', 'Event Wish: new character Private receives a boosted drop-rate\nDuration: 2026/11/04 18:00 – 2026/11/25\n'), now);
    expect(officialReleaseEvidence(wish, ['Private'], now)?.value).toBe('2026-11-04');
    expect(officialReleaseEvidence({ ...wish, text: wish.text + '\nDuration: 2026/11/25' }, ['Private'], now)).toBeNull();
    expect(officialReleaseEvidence({ ...wish, text: wish.text.replace('new character ', '') }, ['Private'], now)).toBeNull();
  });
  it.each(['TIMEOUT', 'UNAVAILABLE', 'HTTP_404', 'SCHEMA_CHANGED'])('records %s independently and never changes provider priority', async code => {
    const attempts: unknown[] = [];
    const sources = new CatalogSources(async () => { throw new CatalogFetchError(code, code === 'HTTP_404' ? 404 : undefined); }, async row => { attempts.push(row); }, now);
    expect(await sources.json('https://enka.network/test', 'enka', 'icon')).toBeNull();
    expect(attempts).toEqual([expect.objectContaining({ errorCode: code, provider: 'enka', field: 'icon' })]);
  });
  it('rejects HTML masquerading as JSON', async () => {
    const attempts: unknown[] = [];
    const sources = new CatalogSources(async () => ({ body: Buffer.from('<html/>'), mime: 'text/html', status: 200, url: 'https://enka.network/test' }), async row => { attempts.push(row); }, now);
    await sources.json('https://enka.network/test', 'enka', 'icon');
    expect(attempts).toEqual([expect.objectContaining({ errorCode: 'SCHEMA_CHANGED' })]);
  });
  it('bounds the total request budget without a retry loop', async () => {
    const fetcher = vi.fn(async () => ({ body: Buffer.alloc(0), mime: '', status: 404, url: '' }));
    const budget = new RequestBudget(fetcher, 1);
    await budget.request('https://enka.network/ui/a.png');
    await expect(budget.request('https://enka.network/ui/a.png')).rejects.toThrow('BUDGET_EXHAUSTED');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('secure binary ingestion and immutable storage', () => {
  it('projects owned catalogue avatars only from the configured public bucket', () => {
    const path = '/storage/v1/object/public/character-catalog/characters/00000000-0000-4000-8000-000000000001/icon/' + 'a'.repeat(64) + '.png';
    expect(officialCharacterAsset('https://fixture.supabase.co' + path, 'https://fixture.supabase.co')).toBe('https://fixture.supabase.co' + path);
    expect(officialCharacterAsset('https://evil.example' + path, 'https://fixture.supabase.co')).toBeNull();
    expect(officialCharacterAsset('https://fixture.supabase.co' + path + '?token=private', 'https://fixture.supabase.co')).toBeNull();
    expect(officialCharacterAsset('/assets/../secret.png', 'https://fixture.supabase.co')).toBeNull();
  });
  const image = () => sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 100, g: 180, b: 200, alpha: .8 } } }).png().toBuffer();
  it('decodes a healthy PNG, checks its role and hashes the stored bytes', async () => {
    const validated = await validateImage(await image(), 'image/png', 'icon');
    expect(validated).toMatchObject({ width: 256, height: 256, mime: 'image/png' }); expect(validated.hash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('rejects corruption, MIME deception, wrong roles and empty images', async () => {
    await expect(validateImage(Buffer.from('not png'), 'image/png', 'icon')).rejects.toThrow('IMAGE_CORRUPT');
    await expect(validateImage(await image(), 'image/jpeg', 'icon')).rejects.toThrow('MIME_MISMATCH');
    await expect(validateImage(await image(), 'image/png', 'splash')).rejects.toThrow('ROLE_INVALID');
    const blank = await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    await expect(validateImage(blank, 'image/png', 'icon')).rejects.toThrow('IMAGE_EMPTY');
  });
  it('uses hash paths, no destructive upsert, public verification and long cache; retries a conflict safely', async () => {
    const validated = await validateImage(await image(), 'image/png', 'icon');
    const fetcher = vi.fn(async (_url: string, options?: { method?: string }) => options?.method === 'POST' ?
      { body: Buffer.from('{}'), mime: 'application/json', status: 409, url: '' } : { body: validated.body, mime: 'image/png', status: 200, url: '' });
    const store = new CatalogImageStorage('https://test.supabase.co', 'sb_secret_private_fixture', fetcher);
    expect(await store.store('00000000-0000-4000-8000-000000000001', 'icon', validated)).toContain(`/icon/${validated.hash}.png`);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ noRedirect: true, headers: { 'x-upsert': 'false', 'cache-control': 'max-age=31536000, immutable' } });
  });
  it('fails on unavailable buckets or changed public bytes without losing a prior asset', async () => {
    const validated = await validateImage(await image(), 'image/png', 'icon');
    const offline = new CatalogImageStorage('https://test.supabase.co', 'fixture', async () => ({ body: Buffer.alloc(0), mime: '', status: 503, url: '' }));
    await expect(offline.store('00000000-0000-4000-8000-000000000001', 'icon', validated)).rejects.toThrow('BUCKET_UNAVAILABLE');
    const corrupt = new CatalogImageStorage('https://test.supabase.co', 'fixture', async (_url, options) => ({ body: options?.method === 'POST' ? Buffer.alloc(0) : Buffer.from('changed'), mime: 'image/png', status: 200, url: '' }));
    await expect(corrupt.store('00000000-0000-4000-8000-000000000001', 'icon', validated)).rejects.toThrow('STORAGE_VERIFICATION_FAILED');
    await expect(new CatalogImageStorage().store('00000000-0000-4000-8000-000000000001', 'icon', validated)).rejects.toThrow('STORAGE_NOT_CONFIGURED');
  });
  it.each([
    { code: 'ResourceAlreadyExists' }, { code: 'KeyAlreadyExists' }, { code: 'already_exists' },
    { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' },
  ])('verifies immutable public bytes after an identified legacy 400 duplicate: %j', async duplicate => {
    const validated = await validateImage(await image(), 'image/png', 'icon');
    const fetcher = vi.fn(async (_url: string, options?: { method?: string }) => options?.method === 'POST' ?
      { body: Buffer.from(JSON.stringify(duplicate)), mime: 'application/json', status: 400, url: '' } :
      { body: validated.body, mime: 'image/png', status: 200, url: '' });
    const store = new CatalogImageStorage('https://test.supabase.co', 'fixture', fetcher);
    await expect(store.store('00000000-0000-4000-8000-000000000001', 'icon', validated)).resolves.toContain(validated.hash);
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockImplementation(async (_url, options) => options?.method === 'POST' ?
      { body: Buffer.from(JSON.stringify(duplicate)), mime: 'application/json', status: 400, url: '' } :
      { body: Buffer.from('changed'), mime: 'image/png', status: 200, url: '' });
    await expect(store.store('00000000-0000-4000-8000-000000000001', 'icon', validated)).rejects.toThrow('STORAGE_VERIFICATION_FAILED');
  });
  it.each(['{}', '{"code":"InvalidMimeType"}', '{"error":"Duplicate","message":"Unknown failure"}', 'invalid'])('does not hide unrelated 400 responses: %s', async body => {
    const validated = await validateImage(await image(), 'image/png', 'icon');
    const fetcher = vi.fn(async () => ({ body: Buffer.from(body), mime: 'application/json', status: 400, url: '' }));
    await expect(new CatalogImageStorage('https://test.supabase.co', 'fixture', fetcher).store('00000000-0000-4000-8000-000000000001', 'icon', validated)).rejects.toThrow('BUCKET_UNAVAILABLE');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1'])('blocks private address %s', ip => expect(isPublicIp(ip)).toBe(false));
  it('blocks arbitrary domains, credentials, nonstandard ports, HTTP and localhost', () => {
    for (const url of ['http://enka.network/ui/a.png', 'https://localhost/a', 'https://evil.example/a', 'https://u:p@enka.network/a', 'https://enka.network:444/a']) expect(() => checkSourceUrl(url)).toThrow('SOURCE_NOT_ALLOWED');
    expect(isPublicIp('1.1.1.1')).toBe(true);
  });
});

describe('Paris midnight and DST', () => {
  it('chooses the local calendar date around the two clock changes', () => {
    expect(getBusinessDate(new Date('2026-03-28T23:30:00Z'))).toBe('2026-03-29');
    expect(getNextBusinessResetAt(new Date('2026-03-28T23:30:00Z')).toISOString()).toBe('2026-03-29T22:00:00.000Z');
    expect(getNextBusinessResetAt(new Date('2026-10-24T22:30:00Z')).toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });
});
