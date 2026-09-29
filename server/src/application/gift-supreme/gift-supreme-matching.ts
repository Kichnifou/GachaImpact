import { normalizePlayerSearch } from '../social/social-service.js';

export type GiftCandidate = Readonly<{ id: string; displayName: string }>;
export type GiftMatch<T> = { status: 'MATCH'; target: T } | { status: 'INVALID'; reason: 'EMPTY_INPUT' | 'TARGET_NOT_FOUND' | 'TARGET_AMBIGUOUS' };
const normalize = (value: string) => normalizePlayerSearch(value).replaceAll('@', '').trim();

export function levenshteinDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 0; i < left.length; i++) {
    const row = [i + 1];
    for (let j = 0; j < right.length; j++) row.push(Math.min(row[j]! + 1, previous[j + 1]! + 1, previous[j]! + Number(left[i] !== right[j])));
    previous = row;
  }
  return previous[right.length]!;
}

/** Pure legacy priority; never break a best-score tie by database order. */
export function matchGiftSupremeTarget<T extends GiftCandidate>(input: string, candidates: readonly T[], fuzzy = true): GiftMatch<T> {
  const needle = normalize(input);
  if (!needle) return { status: 'INVALID', reason: 'EMPTY_INPUT' };
  const entries = candidates.map(target => ({ target, name: normalize(target.displayName) })).filter(entry => entry.name);
  const choose = (matches: typeof entries): GiftMatch<T> => matches.length === 1
    ? { status: 'MATCH', target: matches[0]!.target } : { status: 'INVALID', reason: 'TARGET_AMBIGUOUS' };
  const exact = entries.filter(entry => entry.name === needle);
  if (exact.length) return choose(exact);
  const contained = entries.filter(entry => needle.includes(entry.name));
  if (contained.length) return choose(contained.filter(entry => entry.name.length === Math.max(...contained.map(value => value.name.length))));
  if (!fuzzy || !entries.length) return { status: 'INVALID', reason: 'TARGET_NOT_FOUND' };
  const scores = entries.map(entry => ({ ...entry, distance: levenshteinDistance(needle, entry.name) }));
  const best = Math.min(...scores.map(entry => entry.distance));
  const matches = scores.filter(entry => entry.distance === best);
  return matches.some(entry => best <= (entry.name.length <= 4 ? 1 : entry.name.length <= 8 ? 2 : 3))
    ? choose(matches) : { status: 'INVALID', reason: 'TARGET_NOT_FOUND' };
}
