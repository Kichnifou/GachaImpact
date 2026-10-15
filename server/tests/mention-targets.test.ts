import { expect, it } from 'vitest';
import { resolveMentionTargets } from '../src/application/chat/mention-targets.js';

const players = [{ id: 'a', displayName: 'TechnicalA', presentationName: 'Alpha' }, { id: 'b', displayName: 'TechnicalB', presentationName: 'Alpha' }];
it('binds a selected current token to its UUID even among homonyms', () => {
  expect(resolveMentionTargets(players, new Set(), 'Bonjour @Alpha', [{ playerId: 'b', displayName: 'Alpha' }])).toEqual(['b']);
  expect(resolveMentionTargets(players, new Set(), 'Bonjour @Alpha', [])).toEqual([]);
});
it('rejects a stale or forged selected label before any message is committed', () => {
  const renamed = [{ ...players[0]!, presentationName: 'Beta' }, players[1]!];
  expect(() => resolveMentionTargets(renamed, new Set(), '@Alpha', [{ playerId: 'a', displayName: 'Alpha' }])).toThrowError(expect.objectContaining({ code: 'CHAT_MENTION_CHANGED' }));
  expect(() => resolveMentionTargets(players, new Set(), '@Fake', [{ playerId: 'a', displayName: 'Fake' }])).toThrowError(expect.objectContaining({ code: 'CHAT_MENTION_CHANGED' }));
});
it('does not notify a UUID whose token is absent from text or only matches a prefix', () => {
  expect(resolveMentionTargets(players, new Set(), 'Sans mention @Alphabet', [{ playerId: 'a', displayName: 'Alpha' }])).toEqual([]);
});
it('revalidates active and block policy for structured selections', () => {
  expect(() => resolveMentionTargets(players, new Set(['a']), '@Alpha', [{ playerId: 'a', displayName: 'Alpha' }])).toThrowError(expect.objectContaining({ code: 'CHAT_MENTION_CHANGED' }));
  expect(() => resolveMentionTargets(players, new Set(), '@Absent', [{ playerId: 'gone', displayName: 'Absent' }])).toThrowError(expect.objectContaining({ code: 'CHAT_MENTION_CHANGED' }));
});
it('explicitly refuses two selected UUIDs sharing one label instead of silently dropping both', () => {
  expect(() => resolveMentionTargets(players, new Set(), '@Alpha @Alpha', [{ playerId: 'a', displayName: 'Alpha' }, { playerId: 'b', displayName: 'Alpha' }])).toThrowError(expect.objectContaining({ code: 'CHAT_MENTION_CHANGED' }));
});
