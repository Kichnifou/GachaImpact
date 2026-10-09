import { describe, expect, it, vi } from 'vitest';
import { classifyGiveawayText, giveawayRanked, oneLine, rankingText } from '../src/domain/giveaway/giveaway.js';
import { giveawayAnnouncementText, giveawayRankingAnnouncements } from '../src/application/giveaway/giveaway-announcement-format.js';
import { TwitchGiveawayManager } from '../src/application/twitch/twitch-giveaway-manager.js';
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

  it('preserves three complete podium entries with emoji, amounts and ordered 450-codepoint prefixes', () => {
    const names = ['Aurore', 'Boréal', 'Céleste'].map(name => `${name} ${'👩🏽‍🚀é'.repeat(35)}`);
    const ranked = names.map((displayName, index) => ({ displayName, rank: index + 1, messageCount: BigInt(30 - index),
      amount: [2000n, 1500n, 1000n][index]!, elementKey: 'pyro' }));
    const parts = giveawayRankingAnnouncements(ranked);
    expect(parts).toHaveLength(3);
    expect(parts.every(part => Array.from(part.text).length <= 450 && part.fullText === null)).toBe(true);
    for (const [index, name] of names.entries()) {
      const atom = `${index + 1}e ${name} (${30 - index} messages) +${ranked[index]!.amount} particules pyro`;
      expect(parts[index]!.text).toContain(atom);
      expect(parts.map(part => part.text).join('').split(atom)).toHaveLength(2);
      expect(rankingText(ranked)).toContain(atom);
    }
    expect(parts[0]!.text.startsWith('💬 Activité Giveaway : ')).toBe(true);
    expect(parts[1]!.text.startsWith('💬 Activité Giveaway (suite) : ')).toBe(true);
  });

  it('retains an exceptional whole atom privately and sends an explicit bounded notice without truncating a name', () => {
    const atom = `🎁 ${'👨‍👩‍👧‍👦'.repeat(80)} : participation enregistrée.`;
    expect(oneLine(atom)).toBe(atom);
    const result = giveawayAnnouncementText(atom)!;
    expect(result.fullText).toBe(atom);
    expect(Array.from(result.text).length).toBeLessThanOrEqual(450);
    expect(result.text).toContain('Contenu intégral conservé');
    expect(result.text).not.toContain('👨');
  });

  it.each(['PENDING', 'FAILED', 'RESERVED', 'AMBIGUOUS'])('orders milestones and stops immediately at %s', async state => {
    const rows = ['OPEN', 'RESULT', 'RANKING', 'RANKING'].map((kind, index) => ({ id: String(index), kind,
      sourceEventId: `source:${index}`, createdAt: new Date(0) }));
    const manager = new TwitchGiveawayManager({ giveawayAnnouncement: { findMany: async () => [...rows].reverse() } } as never, {} as never);
    const send = vi.spyOn(manager, 'sendAnnouncement').mockImplementation(async id => ({ state: id === '0' ? 'SENT' : state } as never));
    await manager.sendSessionMilestones('session');
    expect(send.mock.calls).toEqual([['0'], ['1']]);
  });

  it.each(['PENDING', 'FAILED', 'RESERVED', 'AMBIGUOUS'])('blocks a direct ranking retry while a predecessor is %s', async state => {
    const predecessor = { id: 'earlier', kind: 'RANKING', state, sourceEventId: 'ranking:0000', createdAt: new Date(0) };
    const row = { id: 'later', sessionId: 'session', kind: 'RANKING', state: 'FAILED', sourceEventId: 'ranking:0001', createdAt: new Date(0) };
    const db = { giveawayAnnouncement: { findUnique: async () => row, findMany: async () => [row, predecessor], updateMany: vi.fn() },
      twitchGiveawayCredential: { findFirst: vi.fn() } };
    const manager = new TwitchGiveawayManager(db as never, {} as never);
    expect(await manager.sendAnnouncement(row.id, true)).toEqual({ state: 'FAILED', error: 'PREVIOUS_ANNOUNCEMENT_PENDING' });
    expect(db.giveawayAnnouncement.updateMany).not.toHaveBeenCalled();
    expect(db.twitchGiveawayCredential.findFirst).not.toHaveBeenCalled();
  });

  it('sends exactly one bounded message with the broadcaster as sender', async () => {
    const tokens = { getToken: vi.fn().mockResolvedValue('token'), invalidate: vi.fn() };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ is_sent: true, message_id: 'out-1' }] }), { status: 200 }));
    const chat = new TwitchGiveawayChatClient('client', tokens as unknown as TwitchGiveawayAccessTokenProvider, request);
    expect(await chat.send('player', 'broadcaster', 'Salut')).toBe('out-1');
    expect(request).toHaveBeenCalledTimes(1);
    expect(JSON.parse(request.mock.calls[0]![1].body)).toEqual({ broadcaster_id: 'broadcaster', sender_id: 'broadcaster', message: 'Salut' });
  });

  it('counts Unicode codepoints at the transport ceiling and preserves old 500-codepoint wire payloads', async () => {
    const tokens = { getToken: vi.fn().mockResolvedValue('token'), invalidate: vi.fn() };
    const request = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: [{ is_sent: true, message_id: 'unicode-out' }] }), { status: 200 }));
    const chat = new TwitchGiveawayChatClient('client', tokens as unknown as TwitchGiveawayAccessTokenProvider, request);
    for (const length of [450, 500]) {
      const text = '🌠'.repeat(length);
      expect(await chat.send('player', 'broadcaster', text)).toBe('unicode-out');
      expect(JSON.parse(request.mock.calls.at(-1)![1].body).message).toBe(text);
    }
    await expect(chat.send('player', 'broadcaster', '🌠'.repeat(501))).rejects.toMatchObject({ certainty: 'CERTAIN', reason: 'INVALID_TEXT' });
    expect(request).toHaveBeenCalledTimes(2);
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
