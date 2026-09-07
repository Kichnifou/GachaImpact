import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { GetCurrentPlayerBox, SetBoxCharacterFavorite, SetBoxSortPreference, UseMasterlessStella } from '../src/application/box/box-services.js';
import { defaultBoxSortPreference, type BoxCharacter, type BoxSortPreference, type BoxStore, type StellaUseResult } from '../src/application/box/box-store.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';

const playerId = crypto.randomUUID();
const firstObtainedAt = new Date('2026-08-15T10:30:00.000Z');
const characters: BoxCharacter[] = [
  { id: crypto.randomUUID(), externalKey: 'box:five', name: 'Furina', rarity: 5, elementKey: 'hydro', weaponType: 'sword', region: 'fontaine', iconPath: '/icon.png', splashPath: '/splash.png', wishPath: '/wish.png', fullbodyPath: '/fullbody.png', constellation: 6, copies: 9, firstObtainedAt, favorite: true },
  { id: crypto.randomUUID(), externalKey: 'box:four', name: 'Collei', rarity: 4, elementKey: 'dendro', weaponType: 'bow', region: 'sumeru', iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null, constellation: 0, copies: 1, firstObtainedAt, favorite: false },
];

class FakeBoxStore implements BoxStore {
  public records = [...characters];
  public readonly favoriteCalls: [string, string, boolean][] = [];
  public readonly stellaCalls: [string, string, string][] = [];
  public preference: BoxSortPreference = defaultBoxSortPreference;
  public async listVisiblePossessions(requestedPlayerId: string) { return requestedPlayerId === playerId ? this.records : []; }
  public async setFavorite(requestedPlayerId: string, characterId: string, favorite: boolean) {
    this.favoriteCalls.push([requestedPlayerId, characterId, favorite]);
    const current = requestedPlayerId === playerId ? this.records.find(({ id }) => id === characterId) : undefined;
    if (!current) return null;
    const updated = { ...current, favorite };
    this.records = this.records.map((record) => record.id === characterId ? updated : record);
    return updated;
  }
  public async getSortPreference() { return this.preference; }
  public async setSortPreference(_playerId: string, preference: BoxSortPreference) { this.preference = preference; return preference; }
  public async getStellaQuantity() { return 0n; }
  public async useStella(input: Parameters<BoxStore['useStella']>[0]): Promise<StellaUseResult> {
    this.stellaCalls.push([input.playerId, input.characterId, input.idempotencyKey]);
    const current = this.records.find(({ id }) => id === input.characterId)!;
    const character = { ...current, copies: current.copies + 1, constellation: Math.min(6, current.constellation + 1) };
    this.records = this.records.map((record) => record.id === character.id ? character : record);
    return { operation: { id: crypto.randomUUID(), alreadyProcessed: false }, character, stellaRemaining: 1n, c6Progression: null };
  }
}

describe('personal Box', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  async function setup(records: BoxCharacter[] = [...characters]) {
    const store = new FakeBoxStore();
    store.records = records;
    const playerStore = { findByIdentity: async () => ({ id: playerId, displayName: 'Test', elementKey: 'hydro', status: 'ACTIVE' as const }), provision: vi.fn() };
    const currentPlayer = new GetCurrentPlayer(playerStore);
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
      authIdentityVerifier: { verify: async () => ({ subject: 'subject' }) },
      getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore),
      getCurrentPlayerBox: new GetCurrentPlayerBox(currentPlayer, store),
      setBoxCharacterFavorite: new SetBoxCharacterFavorite(currentPlayer, store),
      setBoxSortPreference: new SetBoxSortPreference(currentPlayer, store),
      useMasterlessStella: new UseMasterlessStella(currentPlayer, store, { now: () => new Date() }, { nextInt: () => 0 }),
    });
    apps.push(app);
    return { app, store };
  }

  it('protects both personal endpoints', async () => {
    const { app } = await setup();
    expect((await app.inject({ url: '/api/v1/me/box' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/me/box/${characters[0]!.id}/favorite`, payload: { favorite: true } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PATCH', url: '/api/v1/me/box/preference', payload: { sortKey: 'element', direction: 'asc' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: `/api/v1/me/box/${characters[0]!.id}/stella`, payload: { idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(401);
  });

  it('returns joined possession values and an exact derived summary', async () => {
    const { app } = await setup();
    const response = await app.inject({ url: '/api/v1/me/box', headers: { authorization: 'Bearer token' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      characters: characters.map((character) => ({ ...character, firstObtainedAt: firstObtainedAt.toISOString() })),
      summary: { totalOwned: 2, fiveStars: 1, fourStars: 1, c6: 1 },
      preference: defaultBoxSortPreference,
      stella: { quantity: '0' },
    });
  });

  it('returns a genuine empty Box without catalog fallback', async () => {
    const { app } = await setup([]);
    expect((await app.inject({ url: '/api/v1/me/box', headers: { authorization: 'Bearer token' } })).json()).toEqual({ characters: [], summary: { totalOwned: 0, fiveStars: 0, fourStars: 0, c6: 0 }, preference: defaultBoxSortPreference, stella: { quantity: '0' } });
  });

  it('persists only canonical Box sort preferences and rejects arbitrary fields', async () => {
    const { app, store } = await setup();
    const headers = { authorization: 'Bearer token' };
    const valid = await app.inject({ method: 'PATCH', url: '/api/v1/me/box/preference', headers, payload: { sortKey: 'obtainedAt', direction: 'desc' } });
    expect(valid.statusCode).toBe(200);
    expect(valid.json()).toEqual({ preference: { sortKey: 'obtainedAt', direction: 'desc' } });
    expect(store.preference).toEqual({ sortKey: 'obtainedAt', direction: 'desc' });
    for (const payload of [{ sortKey: 'unknown', direction: 'asc' }, { sortKey: 'element', direction: 'sideways' }, { sortKey: 'element', direction: 'asc', tab: 5 }]) {
      expect((await app.inject({ method: 'PATCH', url: '/api/v1/me/box/preference', headers, payload })).statusCode).toBe(400);
    }
  });

  it('accepts only one server-decided Stella intent and serializes its authoritative result', async () => {
    const { app, store } = await setup();
    const headers = { authorization: 'Bearer token' };
    const idempotencyKey = crypto.randomUUID();
    const response = await app.inject({ method: 'POST', url: `/api/v1/me/box/${characters[1]!.id}/stella`, headers, payload: { idempotencyKey } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ character: { id: characters[1]!.id, copies: 2, constellation: 1 }, stella: { quantity: '1' }, c6Progression: null });
    expect(store.stellaCalls).toEqual([[playerId, characters[1]!.id, idempotencyKey]]);
    expect((await app.inject({ method: 'POST', url: `/api/v1/me/box/${characters[1]!.id}/stella`, headers, payload: { idempotencyKey: 'not-a-uuid', constellation: 6 } })).statusCode).toBe(400);
  });

  it('sets and clears only the favorite state for the current player possession', async () => {
    const { app, store } = await setup();
    const before = { ...store.records[1]! };
    for (const favorite of [true, false]) {
      const response = await app.inject({ method: 'PATCH', url: `/api/v1/me/box/${before.id}/favorite`, headers: { authorization: 'Bearer token' }, payload: { favorite } });
      expect(response.statusCode).toBe(200);
      expect(response.json().character).toMatchObject({ id: before.id, favorite, constellation: before.constellation, copies: before.copies, firstObtainedAt: before.firstObtainedAt.toISOString() });
    }
    expect(store.favoriteCalls).toEqual([[playerId, before.id, true], [playerId, before.id, false]]);
  });

  it('rejects invalid favorite payloads and non-owned characters cleanly', async () => {
    const { app } = await setup();
    const headers = { authorization: 'Bearer token' };
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/me/box/${characters[0]!.id}/favorite`, headers, payload: { favorite: 'yes' } })).statusCode).toBe(400);
    const missing = await app.inject({ method: 'PATCH', url: `/api/v1/me/box/${crypto.randomUUID()}/favorite`, headers, payload: { favorite: true } });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('BOX_CHARACTER_NOT_OWNED');
  });
});
