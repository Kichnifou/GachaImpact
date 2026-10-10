import { expect, it } from 'vitest';
import { appendCommandFeedback } from '../src/application/chat/command-mission-feedback.js';
import { harness } from './helpers/chat-command-harness.js';
import { GlobalChatService, splitGameResult } from '../src/application/chat/global-chat-service.js';

const one = '🎯 Mission terminée : Fortune croissante (+1600 Primogemmes).';
const two = '🎯 Mission terminée : Millionnaire (+16000 Primogemmes).';
it.each([[], [one], [one, two]].map(missions => ({ missions })))('separates each complete announcement: $missions', ({ missions }) => {
  const code = '✅ Code ! | 🎁 +10 | 🏅 +20 | Cadeau de compensation';
  expect(appendCommandFeedback(code, missions, 450)).toEqual([[code, ...missions].join(' | ')]);
});
it.each([450, 500])('uses a clean continuation at effective budget %s, preserving Unicode and all feedback', budget => {
  const code = '🌸'.repeat(budget - 10);
  const parts = appendCommandFeedback([code], [one, two], budget);
  expect(parts).toEqual([code, `${one} | ${two}`]);
  expect(parts.every(p => Array.from(p).length <= budget && !/^\s*\||\|\s*$/u.test(p))).toBe(true);
  expect(parts.join('')).not.toContain('||');
});
it('handles exact budgets, empty output and an already present trailing separator', () => {
  expect(appendCommandFeedback('Code | ', [one], 450)).toEqual([`Code | ${one}`]);
  expect(appendCommandFeedback([], [one], 450)).toEqual([one]);
  expect(appendCommandFeedback('X', [one], Array.from(one).length + 4)).toEqual([`X | ${one}`]);
  expect(appendCommandFeedback('X', [one], Array.from(one).length + 3)).toEqual(['X', one]);
});
it('uses the same separator in internal chat without repeating a reward', async () => {
  const f = harness(); f.chat.commandMissionCompletions.mockResolvedValueOnce([one, two]);
  const text = await f.send('!code CODE');
  expect(text).toContain(` | ${one} | ${two}`);
  expect(f.services.giftCodeService.claim).toHaveBeenCalledOnce();
});
it('preserves legacy free-text splitting before appending an intact mission', () => {
  const response = '🌸'.repeat(1001);
  const parts = appendCommandFeedback(splitGameResult(response), [one], 500);
  expect(parts.every(p => Array.from(p).length <= 500)).toBe(true);
  expect(parts.slice(0, -1)).toEqual(['🌸'.repeat(500), '🌸'.repeat(500)]);
  expect(parts.at(-1)).toBe(`🌸 | ${one}`);
});
it('publishes a long internal string and its mission through the real result validator', async () => {
  const f = harness(); f.services.rankingService.chatTop.mockResolvedValueOnce('🌸'.repeat(501));
  f.chat.commandMissionCompletions.mockResolvedValueOnce([one]);
  await f.send('!top xp');
  const [id, content] = f.chat.publishGameResult.mock.calls[0]!;
  const saved: string[] = [];
  const publisher = {
    database: {
      globalChatMessage: { findUnique: async () => ({ messageType: 'COMMAND', sourceChannel: 'INTERNAL_CHAT', generation: 0 }) },
      $transaction: async (action: (tx: unknown) => Promise<void>) => action({ globalChatMessage: { create: async ({ data }: { data: { content: string } }) => { saved.push(data.content); } } }),
    },
    findGameResult: async () => null,
    findGameResults: async () => saved.map(content => ({ content })),
  };
  await GlobalChatService.prototype.publishGameResult.call(publisher as unknown as GlobalChatService, id, content);
  expect(saved).toEqual(['🌸'.repeat(500), `🌸 | ${one}`]);
})
