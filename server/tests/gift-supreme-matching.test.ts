import { describe, expect, it } from 'vitest';
import { matchGiftSupremeTarget, levenshteinDistance } from '../src/application/gift-supreme/gift-supreme-matching.js';

const candidates = (...names: string[]) => names.map((displayName, i) => ({ id: String(i), displayName }));
describe('Gift Suprême legacy matching priority', () => {
  it.each(['Élio', ' ELIO ', '@élio', 'un cadeau pour @Élio merci'])('resolves normalized input %j', input => {
    expect(matchGiftSupremeTarget(input, candidates('Élio', 'Bob'))).toMatchObject({ status: 'MATCH', target: { displayName: 'Élio' } });
  });
  it('prefers exact first, then the most specific contained name', () => {
    expect(matchGiftSupremeTarget('Bob', candidates('Bob', 'Grand Bob'))).toMatchObject({ status: 'MATCH', target: { displayName: 'Bob' } });
    expect(matchGiftSupremeTarget('pour Grand Bob merci', candidates('Bob', 'Grand Bob'))).toMatchObject({ status: 'MATCH', target: { displayName: 'Grand Bob' } });
  });
  it.each([['bop', 'bob', 1], ['abxxef', 'abcdef', 2], ['abcxxxghi', 'abcdefghi', 3]])('allows the legacy length threshold for %s', (input, name, distance) => {
    expect(levenshteinDistance(input as string, name as string)).toBe(distance);
    expect(matchGiftSupremeTarget(input as string, candidates(name as string))).toMatchObject({ status: 'MATCH' });
  });
  it.each([['axx', 'bob'], ['abcdxxxh', 'abcdefgh'], ['abcxxxxhi', 'abcdefghi']])('rejects input beyond threshold %s', (input, name) => {
    expect(matchGiftSupremeTarget(input, candidates(name))).toEqual({ status: 'INVALID', reason: 'TARGET_NOT_FOUND' });
  });
  it.each([['bop', ['bob', 'bot']], ['elio', ['Élio', 'Elio']], ['pour bob et tom', ['bob', 'tom']]])('rejects ambiguous best matches for %s', (input, names) => {
    expect(matchGiftSupremeTarget(input as string, candidates(...names as string[]))).toEqual({ status: 'INVALID', reason: 'TARGET_AMBIGUOUS' });
  });
  it.each(['', ' \t ', '@'])('rejects empty input %j', input => {
    expect(matchGiftSupremeTarget(input, candidates('Bob'))).toEqual({ status: 'INVALID', reason: 'EMPTY_INPUT' });
  });
  it('never fuzzy matches when checking explicitly named ineligible accounts', () => {
    expect(matchGiftSupremeTarget('bop', candidates('Bob'), false)).toEqual({ status: 'INVALID', reason: 'TARGET_NOT_FOUND' });
  });
});
