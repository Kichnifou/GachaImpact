import { expect, it } from 'vitest';
import { appendCommandFeedback } from '../src/application/chat/command-mission-feedback.js';
import { harness } from './helpers/chat-command-harness.js';

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
