import { describe, expect, it, vi } from 'vitest';
import { classifyGiveawayText, giveawayRanked, oneLine } from '../src/domain/giveaway/giveaway.js';
import { TwitchGiveawayChatClient, TwitchGiveawaySendError } from '../src/infrastructure/twitch/twitch-giveaway-chat-client.js';
import type { TwitchGiveawayAccessTokenProvider } from '../src/infrastructure/twitch/twitch-giveaway-access-token-provider.js';

describe('Giveaway specialized Twitch contract', () => {
  it('classifies only Giveaway commands and excludes all commands from activity', () => {
    expect(classifyGiveawayText('  !wish  ')).toBe('WISH');
    expect(classifyGiveawayText('!giveaway stats')).toBe('STATS');
    expect(classifyGiveawayText('!giveaway ouvrir')).toBe('OPEN');
    expect(classifyGiveawayText('!giveaway fermer')).toBe('CLOSE');
    expect(classifyGiveawayText('!giveaway reroll')).toBe('HELP');
    expect(classifyGiveawayText('!xp')).toBe('OTHER_COMMAND');
    expect(classifyGiveawayText('bonjour')).toBe('MESSAGE');
    expect(oneLine('Bonjour\nà tous')).toBe('Bonjour à tous');
  });

  it('uses competition rank gaps and exact rewards', () => {
    const ranked = giveawayRanked([3n, 3n, 2n, 1n].map((messageCount, index) => ({
      playerId: String(index), displayName: String(index), messageCount,
    })));
    expect(ranked.map(row => [row.rank, row.amount])).toEqual([
      [1, 2000n], [1, 2000n], [3, 1000n], [4, 500n],
    ]);
  });

  it('sends exactly one bounded message with the broadcaster as sender', async () => {
    const tokens = { getToken: vi.fn().mockResolvedValue('token'), invalidate: vi.fn() };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ is_sent: true, message_id: 'out-1' }] }), { status: 200 }));
    const chat = new TwitchGiveawayChatClient('client', tokens as unknown as TwitchGiveawayAccessTokenProvider, request);
    expect(await chat.send('player', 'broadcaster', 'Salut')).toBe('out-1');
    expect(request).toHaveBeenCalledTimes(1);
    expect(JSON.parse(request.mock.calls[0]![1].body)).toEqual({ broadcaster_id: 'broadcaster', sender_id: 'broadcaster', message: 'Salut' });
  });

  it('retries one 401, treats a refusal as certain and network uncertainty as ambiguous', async () => {
    const tokens = { getToken: vi.fn().mockResolvedValue('token'), invalidate: vi.fn() };
    const request = vi.fn().mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ is_sent: false, drop_reason: { code: 'FORBIDDEN' } }] }), { status: 200 }));
    const chat = new TwitchGiveawayChatClient('client', tokens as unknown as TwitchGiveawayAccessTokenProvider, request);
    await expect(chat.send('player', 'broadcaster', 'Salut')).rejects.toMatchObject({ certainty: 'CERTAIN', reason: 'FORBIDDEN' });
    expect(request).toHaveBeenCalledTimes(2);
    expect(tokens.invalidate).toHaveBeenCalledTimes(1);
    const uncertain = new TwitchGiveawayChatClient('client', tokens as unknown as TwitchGiveawayAccessTokenProvider,
      vi.fn().mockRejectedValue(new Error('connection lost')));
    await expect(uncertain.send('player', 'broadcaster', 'Salut')).rejects.toMatchObject({ certainty: 'AMBIGUOUS', reason: 'NETWORK' });
    expect(new TwitchGiveawaySendError('AMBIGUOUS', 'NETWORK').certainty).toBe('AMBIGUOUS');
  });
});
