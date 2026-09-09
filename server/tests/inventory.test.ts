import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { GetCurrentPlayerInventory } from '../src/application/inventory/inventory-services.js';
import type { InventoryStore } from '../src/application/inventory/inventory-store.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { resourceKeys } from '../src/domain/economy/resources.js';

const playerId = crypto.randomUUID();

describe('personal inventory API', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  async function setup() {
    const store: InventoryStore = {
      getInventory: vi.fn(async (requestedPlayerId) => ({
        resources: resourceKeys.map((key, index) => ({ key, displayName: key, category: 'currency', elementKey: key.startsWith('particles_') ? key.slice(10) as never : null, amount: requestedPlayerId === playerId && index === 0 ? 9_007_199_254_740_993n : 0n })),
        items: [{ id: crypto.randomUUID(), externalKey: 'masterless-stella-fortuna', displayName: 'Masterless Stella Fortuna', category: 'SPECIAL', section: 'objects' as const, description: 'Renforce un personnage.', quantity: 2n, firstObtainedAt: new Date('2026-09-09T12:00:00Z'), acquisitionHint: null }],
      })),
    };
    const playerStore = { findByIdentity: async () => ({ id: playerId, displayName: 'Test', elementKey: 'hydro', status: 'ACTIVE' as const }), provision: vi.fn() };
    const currentPlayer = new GetCurrentPlayer(playerStore);
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
      authIdentityVerifier: { verify: async () => ({ subject: 'subject' }) },
      getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore),
      getCurrentPlayerInventory: new GetCurrentPlayerInventory(currentPlayer, store),
    });
    apps.push(app);
    return { app, store };
  }

  it('protects the aggregate endpoint', async () => {
    const { app } = await setup();
    expect((await app.inject({ url: '/api/v1/me/inventory' })).statusCode).toBe(401);
  });

  it('returns all resources, real item categories and lossless bigint strings', async () => {
    const { app, store } = await setup();
    const response = await app.inject({ url: '/api/v1/me/inventory', headers: { authorization: 'Bearer token' } });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.resources).toHaveLength(9);
    expect(payload.resources[0].amount).toBe('9007199254740993');
    expect(payload.resources.slice(1).every(({ amount }: { amount: string }) => amount === '0')).toBe(true);
    expect(payload.items[0]).toMatchObject({ externalKey: 'masterless-stella-fortuna', section: 'objects', quantity: '2', firstObtainedAt: '2026-09-09T12:00:00.000Z' });
    expect(store.getInventory).toHaveBeenCalledWith(playerId);
  });
});
