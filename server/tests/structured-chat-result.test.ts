import { describe, expect, it } from 'vitest';
import { graphicalCommands, isStructuredChatResult } from '../src/domain/chat/structured-result.js';

const valid = () => ({ version: 1, command: 'pull', title: 'Invocation ×1', source: { channel: 'INTERNAL_CHAT', commandMessageId: 'command' }, characters: [{ id: 'furina', name: 'Furina', portrait: '/assets/characters/furina.png', rarity: 5, constellation: 0, isNew: true }], facts: ['Coût : 160 Primos'] });
describe('Standalone public result boundary', () => {
  it.each(graphicalCommands)('accepts the bounded %s protocol', command => expect(isStructuredChatResult({ ...valid(), command })).toBe(true));
  it.each(['root', 'source', 'character'])('rejects unknown private fields at %s', level => {
    const value = valid();
    Object.assign(level === 'root' ? value : level === 'source' ? value.source : value.characters[0]!, { privateFixture: { player: 'PRIVATE' } });
    expect(isStructuredChatResult(value)).toBe(false);
  });
  it.each([
    { characters: Array(11).fill(valid().characters[0]) }, { facts: ['x'.repeat(301)] },
    { facts: Array(25).fill('fact') }, { source: { channel: 'TWITCH', commandMessageId: 'command' } },
    { characters: [{ ...valid().characters[0], constellation: 7 }] },
    { characters: [{ ...valid().characters[0], portrait: 'https://untrusted.example/avatar.png' }] },
    { title: 'line\nbreak' }, { version: 2 },
  ])('rejects invalid or excessive data %#', patch => expect(isStructuredChatResult({ ...valid(), ...patch })).toBe(false));
});
