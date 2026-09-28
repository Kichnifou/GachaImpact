import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { TwitchPilotService } from '../src/application/twitch/twitch-pilot-service.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

const fixture = isolatedBatchDatabase();
let playerId: string;
let service: TwitchPilotService;
const identity = { subject: 'private-runtime-fixture' };
beforeAll(async () => {
  await fixture.setup();
  const player = await fixture.database.player.create({ data: { displayName: 'Private runtime state' } }); playerId = player.id;
  await fixture.database.twitchIdentity.create({ data: { playerId, twitchUserId: '12345', login: 'kichnifou' } });
  service = new TwitchPilotService(fixture.database, { execute: async () => ({ id: playerId }) } as unknown as GetCurrentPlayer,
    { host: '127.0.0.1', port: 3001, supabase: {}, twitch: { clientId: 'test-client', clientSecret: 'test-secret', redirectUri: 'https://backend.example/api/v1/me/twitch/callback', pilotPlayerIds: [playerId], pilotLogin: 'kichnifou' } });
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);
describe('private DB runtime OAuth states', () => {
  it('binds the purpose to the whole state and atomically consumes it once under concurrency', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No live Twitch calls allowed'));
    try {
      const state = new URL((await service.startRuntime(identity)).url).searchParams.get('state')!;
      await expect(service.callback({ state: state.slice('runtime_'.length), error: 'access_denied' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
      expect(await fixture.database.twitchLinkState.count()).toBe(1);
      const results = await Promise.allSettled([service.callback({ state, error: 'access_denied' }), service.callback({ state, error: 'access_denied' })]);
      const codes = results.map(result => result.status === 'rejected' ? (result.reason as { code: string }).code : 'unexpected-success').sort();
      expect(codes).toEqual(['TWITCH_AUTH_DENIED', 'TWITCH_STATE_INVALID']);
      expect(await fixture.database.twitchLinkState.count()).toBe(0);
      expect(await fixture.database.twitchIdentity.count()).toBe(1);
      expect(await fixture.database.twitchEventReceipt.count()).toBe(0);
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
  it('rejects an expired runtime state', async () => {
    const state = new URL((await service.startRuntime(identity)).url).searchParams.get('state')!;
    await fixture.database.twitchLinkState.updateMany({ data: { expiresAt: new Date('2000-01-01') } });
    await expect(service.callback({ state, error: 'access_denied' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
  });
});
