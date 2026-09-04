import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import type { AuthIdentityVerifier } from '../src/application/auth/auth-identity-verifier.js';
import type {
  CurrentPlayerResult,
  CurrentPlayerStore,
  ProvisionCurrentPlayerInput,
} from '../src/application/player/current-player-store.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import type { CurrentPlayer } from '../src/domain/player/current-player.js';

const config = { host: '127.0.0.1', port: 3001, supabase: {} } as const;
const identity = { subject: 'supabase-user-1' } as const;
const existingPlayer: CurrentPlayer = {
  id: 'player-1',
  displayName: 'Kichnifou',
  elementKey: null,
  status: 'ACTIVE',
};

class FakeCurrentPlayerStore implements CurrentPlayerStore {
  public player: CurrentPlayer | null = null;
  public readonly provisionInputs: ProvisionCurrentPlayerInput[] = [];

  public async findByIdentity(): Promise<CurrentPlayer | null> {
    return this.player;
  }

  public async provision(input: ProvisionCurrentPlayerInput): Promise<CurrentPlayerResult> {
    this.provisionInputs.push(input);
    this.player = {
      id: 'new-player',
      displayName: input.displayName,
      elementKey: null,
      status: 'ACTIVE',
    };

    return { player: this.player, created: true };
  }
}

describe('authenticated player routes', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function createApp(verifier: AuthIdentityVerifier, store: CurrentPlayerStore) {
    const app = await buildApp(config, {
      authIdentityVerifier: verifier,
      getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(store),
    });
    apps.push(app);
    return app;
  }

  it('returns a structured 401 when the Bearer token is absent', async () => {
    const verifier = { verify: vi.fn(async () => identity) };
    const app = await createApp(verifier, new FakeCurrentPlayerStore());

    const response = await app.inject({ method: 'GET', url: '/api/v1/me' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: {
        code: 'UNAUTHORIZED',
        message: 'A Bearer access token is required.',
      },
    });
    expect(response.json().error.requestId).toEqual(expect.any(String));
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('returns 401 when the verifier rejects the token', async () => {
    const verifier = { verify: vi.fn(async () => null) };
    const app = await createApp(verifier, new FakeCurrentPlayerStore());

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer invalid-token' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
    expect(verifier.verify).toHaveBeenCalledWith('invalid-token');
  });

  it('returns the current Player DTO for a valid identity', async () => {
    const store = new FakeCurrentPlayerStore();
    store.player = existingPlayer;
    const app = await createApp({ verify: async () => identity }, store);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(existingPlayer);
    expect(store.provisionInputs).toHaveLength(0);
  });

  it('requires a valid display name when onboarding a new Player', async () => {
    const app = await createApp(
      { verify: async () => identity },
      new FakeCurrentPlayerStore(),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/player',
      headers: { authorization: 'Bearer valid-token' },
      payload: {},
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: {
        code: 'ONBOARDING_DISPLAY_NAME_REQUIRED',
      },
    });
  });

  it('trims the display name and returns 201 when provisioning', async () => {
    const store = new FakeCurrentPlayerStore();
    const app = await createApp({ verify: async () => identity }, store);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/player',
      headers: { authorization: 'Bearer valid-token' },
      payload: { displayName: '  Kichnifou  ' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().displayName).toBe('Kichnifou');
    expect(store.provisionInputs).toEqual([
      {
        provider: 'supabase',
        providerSubject: identity.subject,
        displayName: 'Kichnifou',
      },
    ]);
  });

  it('returns an existing Player without recreating or renaming it', async () => {
    const store = new FakeCurrentPlayerStore();
    store.player = existingPlayer;
    const app = await createApp({ verify: async () => identity }, store);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/player',
      headers: { authorization: 'Bearer valid-token' },
      payload: { displayName: 'Another name' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(existingPlayer);
    expect(store.provisionInputs).toHaveLength(0);
  });
});
