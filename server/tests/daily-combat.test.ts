import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatService } from '../src/application/combat/daily-combat-service.js';
import type { DailyCombatStore, DailyCombatView } from '../src/application/combat/daily-combat-store.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { buildApp } from '../src/app.js';

const playerId = randomUUID();
const view: DailyCombatView = {
  businessDate: '2026-09-12', status: 'TODO', encounter: { id: randomUUID(), enemies: [] },
  loadout: { nextAttemptMode: 'MANUAL', slots: [1, 2, 3, 4].map((position) => ({ position: position as 1 | 2 | 3 | 4, character: null, ko: false })) },
  availableCharacters: [], koCharacterIds: [], availableCharacterCount: 0, preview: null, canFight: false,
  reward: { primogems: 800n, moras: 20_000n }, lastAttempt: null,
  playerStats: { totalFights: 0n, totalWins: 0n, totalLosses: 0n, totalManualWins: 0n },
};

describe('Daily Combat HTTP contract', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  async function setup() {
    const store: DailyCombatStore = {
      getView: vi.fn(async () => view), setSlot: vi.fn(async () => view), removeSlot: vi.fn(async () => view),
      copyActiveTeam: vi.fn(async () => view), autoSelect: vi.fn(async () => view), clearLoadout: vi.fn(async () => view),
      fight: vi.fn(async () => ({ operation: { id: randomUUID(), alreadyProcessed: false }, result: { won: true, mode: 'MANUAL' as const, chanceHalfPoints: 148 }, view: { ...view, status: 'COMPLETED' as const }, resources: { primogems: 800n, moras: 20_000n, particles_pyro: 0n, particles_hydro: 0n, particles_cryo: 0n, particles_electro: 0n, particles_anemo: 0n, particles_geo: 0n, particles_dendro: 0n } })),
    };
    const current = new GetCurrentPlayer({ findByIdentity: async () => ({ id: playerId, displayName: 'Combat Fixture', elementKey: 'hydro', status: 'ACTIVE' as const }), provision: vi.fn() });
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
      authIdentityVerifier: { verify: async () => ({ subject: 'subject' }) }, getOrProvisionCurrentPlayer: { execute: vi.fn() } as never,
      dailyCombatService: new CombatService(current, store, { now: () => new Date('2026-09-12T12:00:00.000Z') }),
    });
    apps.push(app); return { app, store };
  }

  it('protects and serializes the private view without an RNG roll', async () => {
    const { app } = await setup();
    expect((await app.inject({ url: '/api/v1/me/combat/daily' })).statusCode).toBe(401);
    const response = await app.inject({ url: '/api/v1/me/combat/daily', headers: { authorization: 'Bearer token' } });
    expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({ businessDate: '2026-09-12', reward: { primogems: '800', moras: '20000' } });
    expect(JSON.stringify(response.json())).not.toContain('rngRoll');
  });

  it('accepts only server-safe slot and fight intentions', async () => {
    const { app, store } = await setup(); const headers = { authorization: 'Bearer token' }; const characterId = randomUUID(); const idempotencyKey = randomUUID();
    expect((await app.inject({ method: 'PUT', url: '/api/v1/me/combat/daily/loadout/2', headers, payload: { characterId } })).statusCode).toBe(200);
    expect(store.setSlot).toHaveBeenCalledWith(expect.objectContaining({ playerId, position: 2, characterId }));
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/combat/daily/fight', headers, payload: { idempotencyKey } })).statusCode).toBe(200);
    expect(store.fight).toHaveBeenCalledWith(expect.objectContaining({ playerId, idempotencyKey }));
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/combat/daily/fight', headers, payload: { idempotencyKey: randomUUID(), chance: 200 } })).statusCode).toBe(400);
  });
});
