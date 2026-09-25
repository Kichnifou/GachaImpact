import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CurrentPlayerMissions } from '../src/application/missions/get-current-player-missions.js';
import type { GetCurrentPlayerMissions } from '../src/application/missions/get-current-player-missions.js';
import { buildApp } from '../src/app.js';

const identity = { subject: 'missions-owner-subject' } as const;
const completedAt = new Date('2026-09-25T06:00:00.000Z');
const unlockedAt = new Date('2026-09-25T05:00:00.000Z');

const mission = (rank: 'B' | 'A' | 'S' | 'Z', index: number, status: 'ACTIVE' | 'LOCKED' | 'COMPLETED' = 'ACTIVE') => ({
  externalKey: `mission_${rank.toLowerCase()}_${index}`,
  rank,
  displayName: `Mission ${rank} ${index}`,
  description: `Objectif ${rank} ${index}`,
  progressLabel: 'actions',
  progress: status === 'COMPLETED' ? 9_007_199_254_740_999n : BigInt(index),
  target: 9_007_199_254_740_999n,
  status,
  rewardPrimogems: rank === 'Z' ? 160_000n : 160n,
  completedAt: status === 'COMPLETED' ? completedAt : null,
});

const ranks = {
  B: Array.from({ length: 9 }, (_, index) => mission('B', index + 1, index === 0 ? 'COMPLETED' : 'ACTIVE')),
  A: Array.from({ length: 9 }, (_, index) => mission('A', index + 1, 'LOCKED')),
  S: Array.from({ length: 9 }, (_, index) => mission('S', index + 1, 'LOCKED')),
} as const;

describe('Personal Missions HTTP route', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map(app => app.close())));

  async function setup(view: CurrentPlayerMissions) {
    const execute = vi.fn(async () => view);
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
      authIdentityVerifier: { verify: async () => identity },
      getOrProvisionCurrentPlayer: { execute: vi.fn() } as never,
      getCurrentPlayerMissions: { execute } as unknown as GetCurrentPlayerMissions,
    });
    apps.push(app);
    return { app, execute };
  }

  it('requires authentication and resolves only the authenticated identity', async () => {
    const { app, execute } = await setup({ catchUpApplied: false, ranks, z: { status: 'LOCKED' } });
    expect((await app.inject({ url: '/api/v1/me/missions' })).statusCode).toBe(401);
    const response = await app.inject({ url: '/api/v1/me/missions', headers: { authorization: 'Bearer owner' } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(identity);
  });

  it('rejects every client-supplied playerId instead of enabling third-party reads', async () => {
    const { app, execute } = await setup({ catchUpApplied: false, ranks, z: { status: 'LOCKED' } });
    const response = await app.inject({ url: '/api/v1/me/missions?playerId=someone-else', headers: { authorization: 'Bearer owner' } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('MISSIONS_QUERY_INVALID');
    expect(execute).not.toHaveBeenCalled();
  });

  it('serializes B/A/S losslessly and keeps locked Z absent from the raw payload', async () => {
    const { app } = await setup({ catchUpApplied: true, ranks, z: { status: 'LOCKED' } });
    const response = await app.inject({ url: '/api/v1/me/missions', headers: { authorization: 'Bearer owner' } });
    const body = response.body;
    const payload = response.json();
    expect(payload.catchUpApplied).toBe(true);
    expect(payload.ranks.B).toHaveLength(9);
    expect(payload.ranks.A).toHaveLength(9);
    expect(payload.ranks.S).toHaveLength(9);
    expect(payload.ranks.B[0]).toMatchObject({ progress: '9007199254740999', target: '9007199254740999', rewardPrimogems: '160', completedAt: completedAt.toISOString() });
    expect(payload.z).toEqual({ status: 'LOCKED' });
    expect(body).not.toMatch(/Couronne des constellations|Amitié parfaite|Sommet de l’aventure|Maître du combat|160000|mission_z_/u);
  });

  it('serializes the four unlocked Z missions and dates only after server authorization', async () => {
    const zMissions = Array.from({ length: 4 }, (_, index) => mission('Z', index + 1, index === 0 ? 'COMPLETED' : 'ACTIVE'));
    const { app } = await setup({ catchUpApplied: false, ranks, z: { status: 'ACTIVE', unlockedAt, missions: zMissions } });
    const payload = (await app.inject({ url: '/api/v1/me/missions', headers: { authorization: 'Bearer owner' } })).json();
    expect(payload.z).toMatchObject({ status: 'ACTIVE', unlockedAt: unlockedAt.toISOString() });
    expect(payload.z.missions).toHaveLength(4);
    expect(payload.z.missions[0]).toMatchObject({ rank: 'Z', status: 'COMPLETED', rewardPrimogems: '160000', completedAt: completedAt.toISOString() });
  });
});
