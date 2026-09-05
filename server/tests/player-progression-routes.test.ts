import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import { GetCurrentPlayerProgression } from '../src/application/player/get-current-player-progression.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import type { CurrentPlayerResult, CurrentPlayerStore, ProvisionCurrentPlayerInput } from '../src/application/player/current-player-store.js';
import type { PlayerProgressionStore } from '../src/application/player/player-progression-store.js';
import type { CurrentPlayer } from '../src/domain/player/current-player.js';

const identity = { subject: 'progression-route-subject' } as const;
const player: CurrentPlayer = {
  id: 'progression-route-player',
  displayName: 'Progression Test',
  elementKey: 'hydro',
  status: 'ACTIVE',
};

class RoutePlayerStore implements CurrentPlayerStore {
  public async findByIdentity() { return player; }
  public async provision(_input: ProvisionCurrentPlayerInput): Promise<CurrentPlayerResult> {
    return { player, created: false };
  }
}

describe('Player progression HTTP route', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function createApp(progressionStore: PlayerProgressionStore) {
    const playerStore = new RoutePlayerStore();
    const app = await buildApp(
      { host: '127.0.0.1', port: 3001, supabase: {} },
      {
        authIdentityVerifier: { verify: async () => identity },
        getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore),
        getCurrentPlayerProgression: new GetCurrentPlayerProgression(
          new GetCurrentPlayer(playerStore),
          progressionStore,
        ),
      },
    );
    apps.push(app);
    return app;
  }

  it('requires authentication', async () => {
    const store = { getByPlayerId: vi.fn() } as unknown as PlayerProgressionStore;
    const app = await createApp(store);
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/progression' });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('returns lossless real progression without side effects', async () => {
    const getByPlayerId = vi.fn(async () => ({
      xp: 9_007_199_254_741_001n,
      level100OverflowRewardsClaimed: 12,
      totalMessages: 9_007_199_254_740_993n,
      countedMessages: 8_000_000_000_000_000n,
      lastXpAt: null,
      lastXpMessageAt: null,
    }));
    const app = await createApp({ getByPlayerId });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me/progression',
      headers: { authorization: 'Bearer route-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      totalXp: '9007199254741001',
      level: 100,
      xpIntoCurrentStep: '11',
      xpPerStep: '30',
      isMaxLevel: true,
      level100OverflowRewardsClaimed: 12,
      totalMessages: '9007199254740993',
      countedMessages: '8000000000000000',
    });
    expect(getByPlayerId).toHaveBeenCalledOnce();
    expect(getByPlayerId).toHaveBeenCalledWith(player.id);
  });

  it('reports an abnormal missing progression state instead of inventing one', async () => {
    const app = await createApp({ getByPlayerId: async () => null });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me/progression',
      headers: { authorization: 'Bearer route-token' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('PLAYER_PROGRESSION_STATE_MISSING');
  });
});
