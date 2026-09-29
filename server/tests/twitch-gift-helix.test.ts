import { describe, expect, it, vi } from 'vitest';
import { giftFixture, giftPlayerId } from './helpers/twitch-gift-fixture.js';
import { TwitchGiftHelixError } from '../src/infrastructure/twitch/twitch-gift-helix-client.js';
describe('Gift typed Helix client', () => {
  it.each(['FULFILLED', 'CANCELED'] as const)('settles exact IDs as %s', async status => {
    const f = giftFixture(); await f.manager.helix!.settle(giftPlayerId, '12345', 'reward-1', 'redemption-1', status);
    const [url, options] = f.network.mock.calls.at(-1)!;
    expect(new URL(String(url)).searchParams.get('reward_id')).toBe('reward-1'); expect(new URL(String(url)).searchParams.get('id')).toBe('redemption-1');
    expect(options).toMatchObject({ method: 'PATCH', headers: { authorization: 'Bearer private-access', 'client-id': 'client' } }); expect(JSON.parse(String(options?.body))).toEqual({ status });
  });
  it('recovers an ambiguous PATCH via matching terminal state, refuses opposite state', async () => {
    const f = giftFixture(); f.state.failPatch = true; f.state.redemptionStatus = 'FULFILLED';
    await expect(f.manager.helix!.settle(giftPlayerId, '12345', 'reward-1', 'redemption-1', 'FULFILLED')).resolves.toBeUndefined();
    f.state.redemptionStatus = 'CANCELED'; await expect(f.manager.helix!.settle(giftPlayerId, '12345', 'reward-1', 'redemption-1', 'FULFILLED')).rejects.toMatchObject({ upstreamStatus: 409 });
  });
  it('refreshes user access once after Helix 401 and refuses malformed/foreign rewards', async () => {
    const f = giftFixture(); await f.manager.tokens!.getToken(giftPlayerId);
    f.network.mockResolvedValueOnce(Response.json({}, { status: 401 })); await f.manager.helix!.rewards(giftPlayerId, '12345', true);
    expect(f.request.mock.calls.filter(([url]) => String(url).includes('/oauth2/token'))).toHaveLength(2);
    f.network.mockResolvedValueOnce(Response.json({ data: [{ id: 'private-access', broadcaster_id: '999' }] }));
    await expect(f.manager.helix!.rewards(giftPlayerId, '12345', true)).rejects.toBeInstanceOf(TwitchGiftHelixError);
  });
  it('sends only the specialized message from the broadcaster and distinguishes ambiguous dispatch', async () => {
    const f = giftFixture(); const message = '🎁 Outside Gifter offre un Gift Suprême à Target ! +1 600 particules Pyro';
    expect(await f.manager.helix!.announce(giftPlayerId, '12345', message)).toBe('chat-message-1');
    const [, options] = f.network.mock.calls.at(-1)!;
    expect(JSON.parse(String(options?.body))).toEqual({ broadcaster_id: '12345', sender_id: '12345', message });
    f.state.chatMode = 'ambiguous'; await expect(f.manager.helix!.announce(giftPlayerId, '12345', message)).rejects.toMatchObject({ uncertain: true });
    f.state.chatMode = 'failed'; await expect(f.manager.helix!.announce(giftPlayerId, '12345', message)).rejects.toMatchObject({ uncertain: false, upstreamStatus: 400 });
    const provider = vi.spyOn(f.manager.tokens!, 'getToken'); provider.mockRejectedValueOnce(Error('local failure'));
    const count = f.network.mock.calls.length; await expect(f.manager.helix!.announce(giftPlayerId, '12345', message)).rejects.toThrow('local failure'); expect(f.network).toHaveBeenCalledTimes(count);
  });
});
