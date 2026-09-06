import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { GetCharacters, GetCurrentGacha, PerformGachaPull, SetGachaTarget } from '../src/application/gacha/gacha-services.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import type { GachaStore } from '../src/application/gacha/gacha-store.js';
import { BusinessError } from '../src/application/errors.js';

const character = (id: string, rarity: 4 | 5) => ({ id, externalKey: `legacy:${id}`, name: id, rarity, elementKey: 'hydro', weaponType: null, region: null, classKey: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null });
const five = Array.from({ length: 4 }, (_, i) => character(`five-${i}`, 5));
const four = Array.from({ length: 6 }, (_, i) => character(`four-${i}`, 4));
const state = { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: 0n, totalFiveStars: 0n, totalFourStars: 0n, fiftyFiftyWon: 0n, fiftyFiftyLost: 0n, capturesTriggered: 0n };

describe('Gacha HTTP contracts', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));
  async function setup() {
    const playerId = crypto.randomUUID();
    const setTarget = vi.fn(async (_player: string, id: string) => ({ ...state, selectedBannerCharacterId: id }));
    const pull = vi.fn(async (input: { count: 1 | 10 }) => ({
      operation: { id: 'operation', pullCount: input.count, primogemCost: input.count === 1 ? 160n : 1_600n, createdAt: new Date('2026-09-06T12:00:00Z'), alreadyProcessed: false },
      results: Array.from({ length: input.count }, (_, index) => ({ index: index + 1, resultType: 'resource' as const, character: null, rarity: null, resourceKey: 'moras' as const, resourceAmount: 5_000n, wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null })),
      playerState: { ...state, totalPulls: BigInt(input.count) },
    }));
    const store = { listActiveCharacters: async () => [...five, ...four], getCurrent: async () => ({ banner: { id: 'b1', startsAt: new Date('2026-09-01T00:00:00Z'), endsAt: new Date('2026-09-08T00:00:00Z'), featuredFiveStars: five, featuredFourStars: four }, playerState: state }), setTarget, pull } as unknown as GachaStore;
    const playerStore = { findByIdentity: async () => ({ id: playerId, displayName: 'Test', elementKey: 'hydro', status: 'ACTIVE' as const }), provision: vi.fn() };
    const currentPlayer = new GetCurrentPlayer(playerStore);
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async () => ({ subject: 'subject' }) }, getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore), getCharacters: new GetCharacters(store), getCurrentGacha: new GetCurrentGacha(currentPlayer, store), setGachaTarget: new SetGachaTarget(currentPlayer, store), performGachaPull: new PerformGachaPull(currentPlayer, store, { now: () => new Date('2026-09-06T12:00:00Z') }, { nextInt: () => 0 }) });
    apps.push(app); return { app, setTarget, pull, playerId };
  }
  it('protects all endpoints', async () => { const { app } = await setup(); for (const url of ['/api/v1/characters', '/api/v1/gacha/current']) expect((await app.inject({ url })).statusCode).toBe(401); expect((await app.inject({ method: 'POST', url: '/api/v1/gacha/target', payload: { characterId: crypto.randomUUID() } })).statusCode).toBe(401); expect((await app.inject({ method: 'POST', url: '/api/v1/gacha/pull', payload: { count: 1, idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(401); });
  it('serializes a valid banner, catalog and lossless state', async () => { const { app } = await setup(); const headers = { authorization: 'Bearer token' }; const current = await app.inject({ url: '/api/v1/gacha/current', headers }); expect(current.json().banner.featuredFiveStars).toHaveLength(4); expect(current.json().banner.featuredFourStars).toHaveLength(6); expect(current.json().playerState.totalPulls).toBe('0'); expect((await app.inject({ url: '/api/v1/characters', headers })).json().characters).toHaveLength(10); });
  it('updates only the requested target through the service', async () => { const { app, setTarget, playerId } = await setup(); const id = crypto.randomUUID(); const response = await app.inject({ method: 'POST', url: '/api/v1/gacha/target', headers: { authorization: 'Bearer token' }, payload: { characterId: id } }); expect(response.statusCode).toBe(200); expect(response.json().playerState.selectedBannerCharacterId).toBe(id); expect(setTarget).toHaveBeenCalledWith(playerId, id); });
  it('validates pull payloads and serializes ordered bigint-safe x1/x10 results', async () => {
    const { app, pull } = await setup(); const headers = { authorization: 'Bearer token' };
    expect((await app.inject({ method: 'POST', url: '/api/v1/gacha/pull', headers, payload: { count: 2, idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/gacha/pull', headers, payload: { count: 1, idempotencyKey: 'bad' } })).statusCode).toBe(400);
    const key = crypto.randomUUID();
    const one = await app.inject({ method: 'POST', url: '/api/v1/gacha/pull', headers, payload: { count: 1, idempotencyKey: key } });
    expect(one.statusCode).toBe(200); expect(one.json()).toMatchObject({ operation: { pullCount: 1, primogemCost: '160' }, results: [{ index: 1, resourceAmount: '5000' }], playerState: { totalPulls: '1' } });
    const ten = await app.inject({ method: 'POST', url: '/api/v1/gacha/pull', headers, payload: { count: 10, idempotencyKey: crypto.randomUUID() } });
    expect(ten.statusCode).toBe(200); expect(ten.json().results).toHaveLength(10); expect(ten.json().results.map((result: { index: number }) => result.index)).toEqual([1,2,3,4,5,6,7,8,9,10]);
    expect(pull).toHaveBeenCalledTimes(2);
  });
  it('returns normal Gacha business failures as explicit non-500 errors', async () => {
    const { app, pull } = await setup();
    pull.mockRejectedValueOnce(new BusinessError('INSUFFICIENT_PRIMOGEMS', 'Not enough.'));
    const response = await app.inject({ method: 'POST', url: '/api/v1/gacha/pull', headers: { authorization: 'Bearer token' }, payload: { count: 1, idempotencyKey: crypto.randomUUID() } });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'INSUFFICIENT_PRIMOGEMS', message: 'Not enough.' } });
  });
});
