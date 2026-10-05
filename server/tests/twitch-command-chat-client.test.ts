import { describe, expect, it, vi } from 'vitest';
import { TwitchCommandChatClient, TwitchCommandSendError } from '../src/infrastructure/twitch/twitch-command-chat-client.js';

const input = { broadcasterId: '123', senderId: '123', message: 'Réponse 🎯', replyParentMessageId: 'source' };
function fixture() {
  const tokens = { getToken: vi.fn(async () => 'private-fixture-token'), invalidate: vi.fn() };
  const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ data: [{ is_sent: true, message_id: 'sent' }] }), { status: 200 }));
  return { tokens, request, client: new TwitchCommandChatClient('client', tokens, request) };
}
describe('Twitch command outbound with app authorization', () => {
  it('does not start HTTP when disarmed while the app token is still being acquired', async () => {
    const f = fixture(); let armed = true; let complete!: (token: string) => void;
    f.tokens.getToken.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    const sending = f.client.send(input, () => armed); armed = false; complete('private-fixture-token');
    await expect(sending).rejects.toMatchObject({ certainty: 'CERTAIN', reason: 'PILOT_DISABLED' });
    expect(f.request).not.toHaveBeenCalled();
  });
  it('uses an app token and exact sender/channel/reply; never shares the reply with another channel', async () => {
    const f = fixture(); expect(await f.client.send(input)).toBe('sent');
    const [url, init] = f.request.mock.calls[0]!;
    expect(url).toBe('https://api.twitch.tv/helix/chat/messages');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer private-fixture-token', 'client-id': 'client' });
    expect(JSON.parse(String(init?.body))).toEqual({ broadcaster_id: '123', sender_id: '123', message: 'Réponse 🎯', reply_parent_message_id: 'source', for_source_only: true });
  });
  it('enforces strict IDs, one-line Unicode length and no unknown credentials', async () => {
    const f = fixture();
    await expect(f.client.send({ ...input, message: '🎯'.repeat(500) })).resolves.toBe('sent');
    for (const bad of [{ ...input, message: '🎯'.repeat(501) }, { ...input, message: '' }, { ...input, message: 'A\nB' },
      { ...input, broadcasterId: 'name' }, { ...input, accessToken: 'private' }]) {
      await expect(f.client.send(bad)).rejects.toMatchObject({ certainty: 'CERTAIN', reason: 'INVALID_INPUT' });
    }
    expect(f.request).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 429, 500, 503])('handles HTTP %i without exposing response or credential contents', async status => {
    const f = fixture(); f.request.mockImplementation(async () => new Response('private-upstream-secret', { status }));
    await expect(f.client.send(input)).rejects.toMatchObject({ certainty: status >= 500 ? 'AMBIGUOUS' : 'CERTAIN' });
    expect(f.request).toHaveBeenCalledTimes(status === 401 ? 2 : 1);
    if (status === 401) expect(f.tokens.invalidate).toHaveBeenCalledWith('private-fixture-token');
    try { await f.client.send(input); } catch (error) { expect(String(error)).not.toMatch(/private/); }
  });
  it('refreshes only after a certain 401 refusal', async () => {
    const f = fixture(); f.request.mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(f.client.send(input)).resolves.toBe('sent'); expect(f.tokens.invalidate).toHaveBeenCalledTimes(1);
  });
  it.each([
    [{ data: [{ is_sent: false, message_id: '', drop_reason: { code: 'automod', message: 'private' } }] }, 'CERTAIN'],
    [{ data: [{ is_sent: true, message_id: '' }] }, 'AMBIGUOUS'],
    [{ data: [{ is_sent: true }] }, 'AMBIGUOUS'], [{ data: [] }, 'AMBIGUOUS'],
    [{ data: [{ is_sent: true, message_id: 'A' }, { is_sent: true, message_id: 'B' }] }, 'AMBIGUOUS'],
  ])('validates Twitch acknowledgement %#', async (body, certainty) => {
    const f = fixture(); f.request.mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(f.client.send(input)).rejects.toMatchObject({ certainty });
  });
  it('treats network and invalid JSON outcomes as ambiguous without an automatic retry', async () => {
    const f = fixture(); f.request.mockRejectedValue(new Error('private-token-from-upstream'));
    await expect(f.client.send(input)).rejects.toBeInstanceOf(TwitchCommandSendError); expect(f.request).toHaveBeenCalledTimes(1);
    f.request.mockResolvedValue(new Response('{broken'));
    await expect(f.client.send(input)).rejects.toMatchObject({ certainty: 'AMBIGUOUS', reason: 'INVALID_RESPONSE' });
  });
});
