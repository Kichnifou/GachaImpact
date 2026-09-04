import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { ChoosePlayerElement } from '../src/application/player/choose-player-element.js';
import type {
  CurrentPlayerResult,
  CurrentPlayerStore,
  ProvisionCurrentPlayerInput,
} from '../src/application/player/current-player-store.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetCurrentPlayerResources } from '../src/application/player/get-current-player-resources.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import type { PlayerElementStore } from '../src/application/player/player-element-store.js';
import type { PlayerResourceStore } from '../src/application/player/player-resource-store.js';
import { SpinDailyWheel } from '../src/application/wheel/spin-daily-wheel.js';
import { GetTodayWheelState } from '../src/application/wheel/get-today-wheel-state.js';
import type { WheelStore, WheelStoreInput } from '../src/application/wheel/wheel-store.js';
import { resourceKeys, type ResourceKey } from '../src/domain/economy/resources.js';
import type { CurrentPlayer } from '../src/domain/player/current-player.js';

const identity = { subject: 'route-test-subject' } as const;
const player: CurrentPlayer = {
  id: 'route-test-player',
  displayName: 'Route Test',
  elementKey: 'hydro',
  status: 'ACTIVE',
};

class RouteCurrentPlayerStore implements CurrentPlayerStore {
  public async findByIdentity() {
    return player;
  }

  public async provision(_input: ProvisionCurrentPlayerInput): Promise<CurrentPlayerResult> {
    return { player, created: false };
  }
}

class RouteElementStore implements PlayerElementStore {
  public async chooseElement() {
    return 'already-selected' as const;
  }
}

class RouteResourceStore implements PlayerResourceStore {
  public async getBalances() {
    return new Map<ResourceKey, bigint>(resourceKeys.map((key) => [key, 0n]));
  }
}

class RouteWheelStore implements WheelStore {
  public persisted = false;

  public async spin(input: WheelStoreInput) {
    this.persisted = true;
    return {
      businessDate: input.businessDate,
      resultType: 'nothing' as const,
      resourceKey: null,
      amount: null,
      alreadySpun: false,
    };
  }

  public async findByDate(_playerId: string, businessDate: string) {
    return this.persisted
      ? {
          businessDate,
          resultType: 'nothing' as const,
          resourceKey: null,
          amount: null,
        }
      : null;
  }
}

describe('gameplay HTTP routes', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function createApp() {
    const playerStore = new RouteCurrentPlayerStore();
    const getCurrentPlayer = new GetCurrentPlayer(playerStore);
    const wheelStore = new RouteWheelStore();
    const clock = { now: () => new Date('2026-09-04T12:00:00.000Z') };
    const app = await buildApp(
      { host: '127.0.0.1', port: 3001, supabase: {} },
      {
        authIdentityVerifier: { verify: async () => identity },
        getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore),
        choosePlayerElement: new ChoosePlayerElement(getCurrentPlayer, new RouteElementStore()),
        getCurrentPlayerResources: new GetCurrentPlayerResources(
          getCurrentPlayer,
          new RouteResourceStore(),
        ),
        getTodayWheelState: new GetTodayWheelState(getCurrentPlayer, wheelStore, clock),
        spinDailyWheel: new SpinDailyWheel(
          getCurrentPlayer,
          wheelStore,
          clock,
          { nextInt: () => 0 },
        ),
      },
    );
    apps.push(app);
    return app;
  }

  it('protects the new routes with the existing Bearer authentication', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/api/v1/wheel/today' });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('exposes permanent element, lossless resources, and Wheel DTOs', async () => {
    const app = await createApp();
    const headers = { authorization: 'Bearer route-token' };

    const elementResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/me/element',
      headers,
      payload: { elementKey: 'hydro' },
    });
    const resourcesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/me/resources',
      headers,
    });
    const unusedWheelResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/wheel/today',
      headers,
    });
    const wheelResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/wheel/spin',
      headers,
    });
    const usedWheelResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/wheel/today',
      headers,
    });

    expect(elementResponse.json()).toEqual({ elementKey: 'hydro', alreadySelected: true });
    expect(resourcesResponse.json()).toMatchObject({
      primogems: '0',
      moras: '0',
      particles: { pyro: '0', hydro: '0', dendro: '0' },
    });
    expect(unusedWheelResponse.json()).toEqual({
      spun: false,
      businessDate: '2026-09-04',
      result: null,
    });
    expect(wheelResponse.json()).toEqual({
      businessDate: '2026-09-04',
      resultType: 'nothing',
      resourceKey: null,
      amount: null,
      alreadySpun: false,
    });
    expect(usedWheelResponse.json()).toEqual({
      spun: true,
      businessDate: '2026-09-04',
      result: {
        resultType: 'nothing',
        resourceKey: null,
        amount: null,
      },
    });
  });
});
