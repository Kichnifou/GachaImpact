import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { GetCharacters, GetCurrentGacha, SetGachaTarget } from '../src/application/gacha/gacha-services.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import type { GachaStore } from '../src/application/gacha/gacha-store.js';

const character = (id: string, rarity: 4 | 5) => ({ id, externalKey: `legacy:${id}`, name: id, rarity, elementKey: 'hydro', weaponType: null, region: null, classKey: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null });
const five = Array.from({ length: 4 }, (_, i) => character(`five-${i}`, 5));
const four = Array.from({ length: 6 }, (_, i) => character(`four-${i}`, 4));
const state = { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: 0n, totalFiveStars: 0n, totalFourStars: 0n, fiftyFiftyWon: 0n, fiftyFiftyLost: 0n, capturesTriggered: 0n };

describe('Gacha HTTP contracts', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));
  async function setup() {
    const setTarget = vi.fn(async (_player: string, id: string) => ({ ...state, selectedBannerCharacterId: id }));
    const store = { listActiveCharacters: async () => [...five, ...four], getCurrent: async () => ({ banner: { id: 'b1', startsAt: new Date('2026-09-01T00:00:00Z'), endsAt: new Date('2026-09-08T00:00:00Z'), featuredFiveStars: five, featuredFourStars: four }, playerState: state }), setTarget } as unknown as GachaStore;
    const playerStore = { findByIdentity: async () => ({ id: 'player', displayName: 'Test', elementKey: 'hydro', status: 'ACTIVE' as const }), provision: vi.fn() };
    const currentPlayer = new GetCurrentPlayer(playerStore);
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async () => ({ subject: 'subject' }) }, getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore), getCharacters: new GetCharacters(store), getCurrentGacha: new GetCurrentGacha(currentPlayer, store), setGachaTarget: new SetGachaTarget(currentPlayer, store) });
    apps.push(app); return { app, setTarget };
  }
  it('protects all endpoints', async () => { const { app } = await setup(); for (const url of ['/api/v1/characters', '/api/v1/gacha/current']) expect((await app.inject({ url })).statusCode).toBe(401); expect((await app.inject({ method: 'POST', url: '/api/v1/gacha/target', payload: { characterId: crypto.randomUUID() } })).statusCode).toBe(401); });
  it('serializes a valid banner, catalog and lossless state', async () => { const { app } = await setup(); const headers = { authorization: 'Bearer token' }; const current = await app.inject({ url: '/api/v1/gacha/current', headers }); expect(current.json().banner.featuredFiveStars).toHaveLength(4); expect(current.json().banner.featuredFourStars).toHaveLength(6); expect(current.json().playerState.totalPulls).toBe('0'); expect((await app.inject({ url: '/api/v1/characters', headers })).json().characters).toHaveLength(10); });
  it('updates only the requested target through the service', async () => { const { app, setTarget } = await setup(); const id = crypto.randomUUID(); const response = await app.inject({ method: 'POST', url: '/api/v1/gacha/target', headers: { authorization: 'Bearer token' }, payload: { characterId: id } }); expect(response.statusCode).toBe(200); expect(response.json().playerState.selectedBannerCharacterId).toBe(id); expect(setTarget).toHaveBeenCalledWith('player', id); });
});
