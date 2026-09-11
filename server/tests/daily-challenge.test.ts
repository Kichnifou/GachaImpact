import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { ConvertPersonalParticles, GetDailyChallenge, PurchaseDailyChallenge, SwitchDailyChallenge } from '../src/application/daily-challenge/daily-challenge-services.js';
import type { DailyChallengeStore, DailyChallengeView } from '../src/application/daily-challenge/daily-challenge-store.js';
import { GetCurrentPlayerInventory } from '../src/application/inventory/inventory-services.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { resourceKeys } from '../src/domain/economy/resources.js';

const playerId = crypto.randomUUID();
const now = new Date('2026-09-11T12:00:00.000Z');
const resources = Object.fromEntries(resourceKeys.map((key) => [key, key === 'moras' ? 90_000n : 0n])) as Record<(typeof resourceKeys)[number], bigint>;
const available: DailyChallengeView = { businessDate: '2026-09-11', status: 'AVAILABLE', assigned: false, purchaseCost: 10_000n, challenge: null, switchCount: 0, nextSwitchCost: null, canSwitch: false, completedAt: null };
const active: DailyChallengeView = { ...available, status: 'ACTIVE', assigned: true, challenge: { externalKey: 'daily_pulls_5', type: 'pulls', displayName: 'Vœux du jour', description: 'Effectuez 5 Invocations.', progressLabel: 'Invocations effectuées', progress: 0n, target: 5n, rewardPrimogems: 800n }, nextSwitchCost: 20_000n, canSwitch: true };

describe('Daily Challenge HTTP contract', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  async function setup() {
    const store: DailyChallengeStore = {
      getView: vi.fn(async () => available),
      purchase: vi.fn(async () => ({ operation: { id: crypto.randomUUID(), alreadyProcessed: false }, view: active, resources })),
      switchChallenge: vi.fn(async () => ({ operation: { id: crypto.randomUUID(), alreadyProcessed: false }, view: active, resources })),
      convertParticles: vi.fn(async () => ({ operation: { id: crypto.randomUUID(), alreadyProcessed: false }, view: active, resources })),
      progress: vi.fn(async () => undefined),
    };
    const playerStore = { findByIdentity: async () => ({ id: playerId, displayName: 'Daily Test', elementKey: 'hydro', status: 'ACTIVE' as const }), provision: vi.fn() };
    const current = new GetCurrentPlayer(playerStore);
    const clock = { now: () => now };
    const inventoryStore = { getInventory: vi.fn(async () => ({ resources: [], items: [] })) };
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
      authIdentityVerifier: { verify: async () => ({ subject: 'subject' }) },
      getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore),
      getCurrentPlayerInventory: new GetCurrentPlayerInventory(current, inventoryStore),
      convertPersonalParticles: new ConvertPersonalParticles(current, store, clock),
      getDailyChallenge: new GetDailyChallenge(current, store, clock),
      purchaseDailyChallenge: new PurchaseDailyChallenge(current, store, clock, { nextInt: () => 0 }),
      switchDailyChallenge: new SwitchDailyChallenge(current, store, clock, { nextInt: () => 0 }),
    });
    apps.push(app);
    return { app, store };
  }

  it('protects the routes and hides the objective before assignment', async () => {
    const { app } = await setup();
    expect((await app.inject({ url: '/api/v1/me/daily-challenge' })).statusCode).toBe(401);
    const response = await app.inject({ url: '/api/v1/me/daily-challenge', headers: { authorization: 'Bearer token' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ businessDate: '2026-09-11', status: 'AVAILABLE', assigned: false, purchaseCost: '10000', challenge: null, switchCount: 0, nextSwitchCost: null, canSwitch: false, completedAt: null });
  });

  it('accepts only a UUID intention and never accepts client-controlled economics or RNG', async () => {
    const { app, store } = await setup(); const headers = { authorization: 'Bearer token' }; const key = crypto.randomUUID();
    const response = await app.inject({ method: 'POST', url: '/api/v1/me/daily-challenge/purchase', headers, payload: { idempotencyKey: key } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ACTIVE', purchaseCost: '10000', challenge: { externalKey: 'daily_pulls_5', target: '5', rewardPrimogems: '800' }, resources: { moras: '90000' } });
    expect(store.purchase).toHaveBeenCalledWith(expect.objectContaining({ playerId, playerElementKey: 'hydro', businessDate: '2026-09-11', idempotencyKey: key }));
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/daily-challenge/purchase', headers, payload: { idempotencyKey: crypto.randomUUID(), price: '1' } })).statusCode).toBe(400);
  });

  it('validates lossless particle conversion and passes only the authenticated Player element', async () => {
    const { app, store } = await setup(); const headers = { authorization: 'Bearer token' }; const key = crypto.randomUUID();
    const response = await app.inject({ method: 'POST', url: '/api/v1/me/inventory/particles/convert', headers, payload: { amount: '320', idempotencyKey: key } });
    expect(response.statusCode).toBe(200);
    expect(store.convertParticles).toHaveBeenCalledWith(expect.objectContaining({ playerId, playerElementKey: 'hydro', amount: 320n, idempotencyKey: key }));
    for (const amount of ['0', '-1', '1.5', 'text']) expect((await app.inject({ method: 'POST', url: '/api/v1/me/inventory/particles/convert', headers, payload: { amount, idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(400);
  });
});
