import { describe, expect, it } from 'vitest';
import { chatLength, chatResponseLimit, logicalChatParts, logicalTwitchParts } from '../src/application/chat/chat-list-result.js';
import { giveawayAnnouncementText } from '../src/application/giveaway/giveaway-announcement-format.js';
import { withPlayerCommandExecution } from '../src/application/player/player-command-execution.js';
import { twitchReplyBodyLimit, twitchResponseEntries } from '../src/application/twitch/twitch-response-format.js';

const now = new Date('2026-10-09T16:00:00Z');
const scope = <T>(limit: number, action: () => T) => withPlayerCommandExecution({ now, source: 'TWITCH', responseBodyLimit: limit }, action);
const packedEntries = ['A'.repeat(205), 'B'.repeat(205)].map(text => ({ text, separator: ', ' }));

describe('Twitch reply budget includes the automatic mention', () => {
  it('reserves both @ and space for the observed reply display name', () => {
    const name = 'Kichnifou';
    const limit = twitchReplyBodyLimit({ chatter_user_login: 'kichnifou', chatter_user_name: name });
    expect(limit).toBe(439);
    const entries = twitchResponseEntries('A'.repeat(limit), limit);
    expect(entries).toEqual([{ text: 'A'.repeat(limit) }]);
    expect(chatLength(`@${name} ${entries[0]!.text}`)).toBe(450);
    expect(twitchResponseEntries('A'.repeat(limit + 1), limit)[0]!.fullText).toBe('A'.repeat(limit + 1));
  });

  it('uses the longest verified name when a short chatter replies in a longer thread', () => {
    const thread = 'RacineDuFil' + 'é'.repeat(70);
    const event = { chatter_user_login: 'a', chatter_user_name: 'A', reply: {
      parent_user_login: 'parent', parent_user_name: 'Parent', thread_user_login: 'racine', thread_user_name: thread,
    } };
    const limit = twitchReplyBodyLimit(event);
    expect(limit).toBe(450 - chatLength(thread) - 2);
    expect(chatLength(`@${thread} ${'x'.repeat(limit)}`)).toBe(450);
  });

  it('reserves a longer parent or login too, without assuming the standalone actor name is used', () => {
    const parent = 'parent_'.repeat(15);
    expect(twitchReplyBodyLimit({ chatter_user_name: 'C', chatter_user_login: 'court', reply: {
      parent_user_name: 'P', parent_user_login: parent, thread_user_name: 'T', thread_user_login: 'fil',
    } })).toBe(450 - chatLength(parent) - 2);
  });

  it('counts composed emoji and combining marks as Unicode code points', () => {
    const name = '👩🏽‍🚀e\u0301🇫🇷';
    expect(name.length).toBeGreaterThan(chatLength(name));
    const limit = twitchReplyBodyLimit({ chatter_user_name: name, chatter_user_login: 'a' });
    expect(limit).toBe(450 - [...name].length - 2);
    expect(chatLength(`@${name} ${'x'.repeat(limit)}`)).toBe(450);
  });

  it.each([
    {},
    { chatter_user_name: 'C', reply: {} },
    { chatter_user_login: 'c', reply: { parent_user_name: 'Parent' } },
    { chatter_user_login: 'c', reply: { thread_user_name: 'Racine' } },
  ])('uses the full supported-name reserve when required reply metadata is absent: %j', event => {
    expect(twitchReplyBodyLimit(event)).toBe(320);
  });

  it('handles the maximum supported Unicode name without exceeding the visible message contract', () => {
    const name = '界'.repeat(128), limit = twitchReplyBodyLimit({ chatter_user_name: name });
    expect(limit).toBe(320);
    expect(chatLength(`@${name} ${'A'.repeat(limit)}`)).toBe(450);
  });
});

describe('reply presentation scope and frozen overflow', () => {
  it('reduces even an explicit 450 packing budget, keeping whole entries and continuation prefixes', () => {
    const parts = scope(320, () => logicalChatParts('Box :', packedEntries, 'Box suite :', 450));
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe(`Box : ${packedEntries[0]!.text}`);
    expect(parts[1]).toBe(`Box suite : ${packedEntries[1]!.text}`);
    for (const part of parts) expect(chatLength(part)).toBeLessThanOrEqual(320);
  });

  it('keeps two concurrent command budgets isolated and restores the outside scope', async () => {
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const run = (limit: number) => scope(limit, async () => {
      const before = chatResponseLimit();
      await barrier;
      await Promise.resolve();
      return { before, after: chatResponseLimit(), parts: logicalChatParts('Box :', packedEntries, 'Box suite :') };
    });
    const small = run(320), large = run(439);
    expect(chatResponseLimit()).toBe(500);
    release();
    const [a, b] = await Promise.all([small, large]);
    expect(a.before).toBe(320); expect(a.after).toBe(320); expect(a.parts).toHaveLength(2);
    expect(b.before).toBe(439); expect(b.after).toBe(439); expect(b.parts).toHaveLength(1);
    expect(chatResponseLimit()).toBe(500);
  });

  it('does not shrink standalone chat or unthreaded Giveaway and Gift presentations', () => {
    const internal = withPlayerCommandExecution({ now, source: 'INTERNAL_CHAT', responseBodyLimit: 320 }, () => ({
      limit: chatResponseLimit(), parts: logicalChatParts('Box :', packedEntries, 'Box suite :'),
    }));
    expect(internal.limit).toBe(500); expect(internal.parts).toHaveLength(1);
    scope(320, () => {
      expect(logicalTwitchParts('Liste :', packedEntries, 'Liste suite :')).toHaveLength(1);
      expect(logicalTwitchParts('Liste :', packedEntries, 'Liste suite :', 320)).toHaveLength(2);
      expect(giveawayAnnouncementText('A'.repeat(450))).toEqual({ text: 'A'.repeat(450), fullText: null });
      expect(twitchResponseEntries('G'.repeat(450))).toEqual([{ text: 'G'.repeat(450) }]);
    });
  });

  it('retains an exceptional whole atom privately and budgets the visible notice with the mention', () => {
    const name = '界'.repeat(128), limit = twitchReplyBodyLimit({ chatter_user_name: name });
    const atom = 'Yoimiya (C6) · ' + '👩🏽‍🚀'.repeat(100);
    const packed = scope(limit, () => logicalChatParts('Box :', ['AVANT', atom, 'APRÈS'].map(text => ({ text, separator: ', ' })), 'Box suite :'));
    const responses = twitchResponseEntries(packed, limit);
    expect(responses.filter(row => row.fullText !== undefined)).toEqual([{ text: expect.stringContaining('Contenu intégral conservé'), fullText: atom }]);
    expect(responses[0]!.text).toContain('AVANT'); expect(responses.at(-1)!.text).toContain('APRÈS');
    for (const row of responses) expect(chatLength(`@${name} ${row.text}`)).toBeLessThanOrEqual(450);
    expect(responses.map(row => row.fullText ?? row.text).join('\n')).toContain(atom);
  });
});
