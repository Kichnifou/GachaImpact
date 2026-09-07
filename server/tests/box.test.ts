import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { GetCurrentPlayerBox, SetBoxCharacterFavorite } from '../src/application/box/box-services.js';
import type { BoxCharacter, BoxStore } from '../src/application/box/box-store.js';
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
  public async listVisiblePossessions(requestedPlayerId: string) { return requestedPlayerId === playerId ? this.records : []; }
  public async setFavorite(requestedPlayerId: string, characterId: string, favorite: boolean) {
    this.favoriteCalls.push([requestedPlayerId, characterId, favorite]);
    const current = requestedPlayerId === playerId ? this.records.find(({ id }) => id === characterId) : undefined;
    if (!current) return null;
    const updated = { ...current, favorite };
    this.records = this.records.map((record) => record.id === characterId ? updated : record);
    return updated;
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
    });
    apps.push(app);
    return { app, store };
  }

  it('protects both personal endpoints', async () => {
    const { app } = await setup();
    expect((await app.inject({ url: '/api/v1/me/box' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/me/box/${characters[0]!.id}/favorite`, payload: { favorite: true } })).statusCode).toBe(401);
  });

  it('returns joined possession values and an exact derived summary', async () => {
    const { app } = await setup();
    const response = await app.inject({ url: '/api/v1/me/box', headers: { authorization: 'Bearer token' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      characters: characters.map((character) => ({ ...character, firstObtainedAt: firstObtainedAt.toISOString() })),
      summary: { totalOwned: 2, fiveStars: 1, fourStars: 1, c6: 1 },
    });
  });

  it('returns a genuine empty Box without catalog fallback', async () => {
    const { app } = await setup([]);
    expect((await app.inject({ url: '/api/v1/me/box', headers: { authorization: 'Bearer token' } })).json()).toEqual({ characters: [], summary: { totalOwned: 0, fiveStars: 0, fourStars: 0, c6: 0 } });
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
