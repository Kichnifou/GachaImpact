import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MonthlyBossView } from '../src/application/combat/monthly-boss-service.js';
import { buildApp } from '../src/app.js';

const bossId = randomUUID();
const playerId = randomUUID();
const view: MonthlyBossView = {
  businessDate: '2026-09-13',
  boss: { id: bossId, monthStart: '2026-09-01', name: 'Seigneur des Ruines Oubliées', baseHp: 1_500_000n, hpVariationPercent: 0, maxHp: 1_500_000n, currentHp: 1_490_000n, resistanceElementKey: 'hydro', defeatedAt: null, finalBlowPlayer: null, nextBaseAdjustment: null },
  status: 'ALIVE', attackState: 'AVAILABLE', canAttack: false,
  loadout: { slots: [1, 2, 3, 4].map((position) => ({ position: position as 1 | 2 | 3 | 4, character: null })) }, availableCharacters: [], preview: null,
  reward: { primogems: 16_000n, moras: 500_000n }, participation: null, ranking: [], playerStats: { totalDamage: 0n, totalAttacks: 0n, totalParticipated: 0n, totalRewarded: 0n, finalBlows: 0n, bestHit: 0n },
};

describe('monthly Boss HTTP contract', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));
  async function setup() {
    const service = {
      getCurrent: vi.fn(async () => view), setSlot: vi.fn(async () => view), removeSlot: vi.fn(async () => view), copyActiveTeam: vi.fn(async () => view), clearLoadout: vi.fn(async () => view),
      attack: vi.fn(async () => ({ operation: { id: randomUUID(), alreadyProcessed: false }, result: { damage: 10_000n, defeated: false }, view, resources: { primogems: 0n, moras: 0n, particles_pyro: 0n, particles_hydro: 0n, particles_cryo: 0n, particles_electro: 0n, particles_anemo: 0n, particles_geo: 0n, particles_dendro: 0n } })),
      getRanking: vi.fn(async () => ({ boss: { id: bossId, nameSnapshot: view.boss.name, monthStart: view.boss.monthStart, defeatedAt: null }, ranking: [{ rank: 1, playerId, displayName: 'Fixture', totalDamage: 10_000n, attackCount: 1n, bestHit: 10_000n }] })),
      getHistory: vi.fn(async () => ({ page: 1, pageSize: 10, total: 0, totalPages: 1, bosses: [] })),
    };
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async () => ({ subject: 'subject' }) }, getOrProvisionCurrentPlayer: { execute: vi.fn() } as never, monthlyBossService: service as never });
    apps.push(app); return { app, service };
  }

  it('protects private endpoints while keeping the explicit ranking public', async () => {
    const { app } = await setup();
    expect((await app.inject({ url: '/api/v1/me/combat/boss' })).statusCode).toBe(401);
    const current = await app.inject({ url: '/api/v1/me/combat/boss', headers: { authorization: 'Bearer token' } });
    expect(current.statusCode).toBe(200); expect(current.json()).toMatchObject({ boss: { id: bossId, maxHp: '1500000', currentHp: '1490000' }, reward: { primogems: '16000', moras: '500000' } });
    const ranking = await app.inject({ url: `/api/v1/combat/boss/${bossId}/ranking` });
    expect(ranking.statusCode).toBe(200); expect(ranking.json().ranking[0]).toMatchObject({ playerId, totalDamage: '10000' });
  });

  it('accepts only the stable server-safe mutation payloads', async () => {
    const { app, service } = await setup(); const headers = { authorization: 'Bearer token' }; const characterId = randomUUID(); const idempotencyKey = randomUUID();
    expect((await app.inject({ method: 'PUT', url: '/api/v1/me/combat/boss/loadout/slots/2', headers, payload: { characterId } })).statusCode).toBe(200);
    expect(service.setSlot).toHaveBeenCalledWith(expect.anything(), 2, characterId);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/combat/boss/attack', headers, payload: { bossId, idempotencyKey } })).statusCode).toBe(200);
    expect(service.attack).toHaveBeenCalledWith(expect.anything(), bossId, idempotencyKey);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/combat/boss/attack', headers, payload: { bossId, idempotencyKey: randomUUID(), damage: '999999' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/combat/boss/loadout/clear', headers })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/v1/combat/boss/history?page=1' })).statusCode).toBe(200);
  });
});
