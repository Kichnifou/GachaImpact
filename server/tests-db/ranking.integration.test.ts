import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { RankingService } from '../src/application/ranking/ranking-service.js';
import { SocialService } from '../src/application/social/social-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { buildApp } from '../src/app.js';

const fixture = isolatedBatchDatabase();
const { database } = fixture;
const ranking = new RankingService(database);
let app: Awaited<ReturnType<typeof buildApp>>;
let viewer: string, publicId: string, friendOnly: string, privateId: string, noElement: string;
beforeAll(async () => {
  await fixture.setup();
  await database.element.create({ data: { key: 'pyro', displayName: 'Pyro', displayOrder: 1 } });
  await database.resourceDefinition.create({ data: { key: 'moras', displayName: 'Moras', category: 'currency' } });
  const make = async (displayName: string, xp: bigint, elementKey: string | null = 'pyro') => (await database.player.create({ data: { displayName, elementKey, progression: { create: { xp } } } })).id;
  viewer = await make('Viewer', 0n); publicId = await make('Public', 90n); friendOnly = await make('Friend', 200n); privateId = await make('Private', 300n); noElement = await make('No element', 400n, null);
  await database.privacySetting.createMany({ data: [{ playerId: friendOnly, categoryKey: 'GENERAL_STATISTICS', level: 'FRIENDS' }, { playerId: privateId, categoryKey: 'GENERAL_STATISTICS', level: 'PRIVATE' }] });
  const [playerAId, playerBId] = [viewer, friendOnly].sort();
  await database.friendship.create({ data: { playerAId: playerAId!, playerBId: playerBId!, state: 'ACTIVE' } });
  const store = { findByIdentity: async (_provider: string, subject: string) => {
    const row = await database.player.findUnique({ where: { id: subject } });
    return row ? { id: row.id, displayName: row.displayName, status: row.status, elementKey: row.elementKey } : null;
  }, provision: async () => { throw Error('no provisioning'); } };
  const getPlayer = new GetCurrentPlayer(store);
  app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async token => ({ subject: token }) }, getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(store), socialService: new SocialService(getPlayer, database, { now: () => new Date() }), rankingService: ranking });
}, 60_000);
afterAll(async () => { await app?.close(); await fixture.cleanup(); }, 60_000);

describe('Ranking isolated PostgreSQL', () => {
  it('exposes only public positive sources through the authenticated read-only route', async () => {
    const countBefore = await database.playerProgression.count();
    const response = await app.inject({ url: '/api/v1/rankings?metric=xp', headers: { authorization: `Bearer ${viewer}` } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json().entries.map((entry: { playerId: string }) => entry.playerId)).toEqual([publicId]);
    expect(response.json().entries.some((entry: { playerId: string }) => entry.playerId === noElement)).toBe(false);
    expect(response.json().total).toBe(1);
    expect((await ranking.list('xp', privateId))?.selfStatus).toBe('NOT_PUBLIC');
    expect((await ranking.list('xp', friendOnly))?.selfStatus).toBe('NOT_PUBLIC');
    expect(await database.playerProgression.count()).toBe(countBefore);
    expect((await app.inject({ url: '/api/v1/rankings?metric=xp' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/v1/rankings?metric=unknown', headers: { authorization: `Bearer ${viewer}` } })).statusCode).toBe(400);
  });
  it('removes public to private changes immediately and never reserves a rank', async () => {
    await database.privacySetting.create({ data: { playerId: publicId, categoryKey: 'GENERAL_STATISTICS', level: 'PRIVATE' } });
    expect((await ranking.list('xp', viewer))?.entries).toEqual([]);
    await database.privacySetting.update({ where: { playerId_categoryKey: { playerId: publicId, categoryKey: 'GENERAL_STATISTICS' } }, data: { level: 'PUBLIC' } });
    expect((await ranking.list('xp', viewer))?.entries[0]?.rank).toBe(1);
  });
  it('requires both currency and bank public for derived wealth', async () => {
    await database.playerResourceBalance.create({ data: { playerId: publicId, resourceKey: 'moras', amount: 50n } });
    await database.playerBankAccount.create({ data: { playerId: publicId, balance: 100n, lastInterestDate: new Date('2026-09-25') } });
    expect((await ranking.list('moras', viewer))?.entries).toEqual([]);
    await database.privacySetting.createMany({ data: [{ playerId: publicId, categoryKey: 'CURRENCY_BALANCES', level: 'PUBLIC' }, { playerId: publicId, categoryKey: 'BANK', level: 'PUBLIC' }] });
    expect((await ranking.list('moras', viewer))?.entries[0]?.value).toBe('150');
    await database.privacySetting.update({ where: { playerId_categoryKey: { playerId: publicId, categoryKey: 'BANK' } }, data: { level: 'FRIENDS' } });
    expect((await ranking.list('moras', viewer))?.entries).toEqual([]);
  });
  it('counts only currently active catalogue possessions for Box, C6 and copies', async () => {
    const active = await database.character.create({ data: { externalKey: 'rank-active', name: 'Active', rarity: 5, elementKey: 'pyro', isActive: true } });
    const disabled = await database.character.create({ data: { externalKey: 'rank-disabled', name: 'Disabled', rarity: 5, elementKey: 'pyro', isActive: false } });
    await database.playerCharacter.createMany({ data: [
      { playerId: publicId, characterId: active.id, constellation: 6, copies: 7, firstObtainedAt: new Date() },
      { playerId: publicId, characterId: disabled.id, constellation: 6, copies: 7, firstObtainedAt: new Date() },
    ] });
    expect((await ranking.list('box', viewer))?.entries[0]?.value).toBe('1');
    expect((await ranking.list('c6', viewer))?.entries[0]?.value).toBe('1');
    expect((await ranking.list('copies', viewer))?.entries[0]?.value).toBe('7');
    await database.privacySetting.create({ data: { playerId: publicId, categoryKey: 'BOX', level: 'PRIVATE' } });
    expect((await ranking.list('box', viewer))?.entries).toEqual([]);
    expect(await ranking.personal(publicId)).toContain('Box 1 · C6 1');
  });
});
