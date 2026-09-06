import { describe, expect, it } from 'vitest';
import { acquireCharacter } from '../src/domain/collection/possession.js';
import { initialC6Stats, progressC6 } from '../src/domain/contest/c6-progress.js';
import { fiveStarChanceBasisPoints, fourStarChanceBasisPoints, resolvePulls, type PullState } from '../src/domain/gacha/pull.js';
import type { GachaCharacter } from '../src/domain/gacha/gacha.js';

const character = (id: string, rarity: 4 | 5): GachaCharacter => ({ id, externalKey: id, name: id, rarity, elementKey: 'hydro', weaponType: null, region: null, classKey: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null });
const five = Array.from({ length: 4 }, (_, index) => character(`five-${index}`, 5));
const four = Array.from({ length: 6 }, (_, index) => character(`four-${index}`, 4));
const banner = { target: five[0]!, featuredFiveStars: five, featuredFourStars: four };
const base: PullState = { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, totalPulls: 0n, totalFiveStars: 0n, totalFourStars: 0n, fiftyFiftyWon: 0n, fiftyFiftyLost: 0n, capturesTriggered: 0n };
const sequence = (...values: number[]) => ({ nextInt: (maximum: number) => {
  const value = values.shift();
  if (value === undefined) throw new Error(`Missing deterministic roll for maximum ${maximum}.`);
  if (value < 0 || value >= maximum) throw new Error(`Invalid deterministic roll ${value}/${maximum}.`);
  return value;
} });

describe('Gacha pull probabilities', () => {
  it('matches the exact five-star base, soft pity and hard pity thresholds', () => {
    expect(fiveStarChanceBasisPoints(1)).toBe(60);
    expect(fiveStarChanceBasisPoints(73)).toBe(60);
    expect(fiveStarChanceBasisPoints(74)).toBe(660);
    expect(fiveStarChanceBasisPoints(75)).toBe(1_260);
    expect(fiveStarChanceBasisPoints(90)).toBe(10_000);
  });
  it('matches the exact four-star thresholds', () => {
    expect(fourStarChanceBasisPoints(1)).toBe(150);
    expect(fourStarChanceBasisPoints(8)).toBe(150);
    expect(fourStarChanceBasisPoints(9)).toBe(1_950);
    expect(fourStarChanceBasisPoints(10)).toBe(10_000);
  });
  it('resets five-star pity but preserves four-star pity when both rolls succeed', () => {
    const result = resolvePulls({ ...base, pity5: 73, pity4: 8 }, banner, 1, sequence(0, 0, 0));
    expect(result.results[0]?.outcome).toMatchObject({ type: 'character', rarity: 5 });
    expect(result.state).toMatchObject({ pity5: 0, pity4: 9, totalFiveStars: 1n, totalFourStars: 0n });
  });
  it('guarantees and resets the tenth four-star', () => {
    const result = resolvePulls({ ...base, pity4: 9 }, banner, 1, sequence(9_999, 2));
    expect(result.results[0]?.outcome).toMatchObject({ type: 'character', character: four[2] });
    expect(result.state.pity4).toBe(0);
  });
  it('guarantees and resets the ninetieth five-star', () => {
    const result = resolvePulls({ ...base, pity5: 89 }, banner, 1, sequence(9_999, 0));
    expect(result.results[0]?.outcome).toMatchObject({ type: 'character', rarity: 5, wonFiftyFifty: true });
    expect(result.state.pity5).toBe(0);
  });
});

describe('Gacha five-star state machine', () => {
  it('wins a natural 50/50 and decrements Capture', () => {
    const result = resolvePulls({ ...base, pity5: 89, captureProgress: 2, fiftyFiftyLostStreak: 2 }, banner, 1, sequence(9_999, 0));
    expect(result.results[0]?.outcome).toMatchObject({ character: five[0], wasFiftyFifty: true, wonFiftyFifty: true });
    expect(result.state).toMatchObject({ captureProgress: 1, fiftyFiftyLostStreak: 0, fiftyFiftyWon: 1n });
  });
  it('loses a natural 50/50 to one of the three alternatives and activates guarantee', () => {
    const result = resolvePulls({ ...base, pity5: 89, captureProgress: 2 }, banner, 1, sequence(9_999, 1, 2));
    expect(result.results[0]?.outcome).toMatchObject({ character: five[3], wasFiftyFifty: true, wonFiftyFifty: false });
    expect(result.state).toMatchObject({ guaranteedFeatured5: true, captureProgress: 3, fiftyFiftyLostStreak: 1, fiftyFiftyLost: 1n });
  });
  it('consumes guarantee first without changing Capture or 50/50 counters', () => {
    const result = resolvePulls({ ...base, pity5: 89, guaranteedFeatured5: true, captureProgress: 3, fiftyFiftyLostStreak: 4 }, banner, 1, sequence(9_999));
    expect(result.results[0]?.outcome).toMatchObject({ character: five[0], guaranteeConsumed: true, captureTriggered: false, wasFiftyFifty: false });
    expect(result.state).toMatchObject({ guaranteedFeatured5: false, captureProgress: 3, fiftyFiftyLostStreak: 4, fiftyFiftyWon: 0n, fiftyFiftyLost: 0n });
  });
  it('triggers Capture after guarantee priority and resets only Capture', () => {
    const result = resolvePulls({ ...base, pity5: 89, captureProgress: 3, fiftyFiftyLostStreak: 2 }, banner, 1, sequence(9_999));
    expect(result.results[0]?.outcome).toMatchObject({ character: five[0], captureTriggered: true, wasFiftyFifty: false });
    expect(result.state).toMatchObject({ captureProgress: 0, capturesTriggered: 1n, fiftyFiftyLostStreak: 2, fiftyFiftyWon: 0n, fiftyFiftyLost: 0n });
  });
  it('advances Capture 0→1→2→3 across three real losses', () => {
    let state = { ...base, pity5: 89 };
    for (const expected of [1, 2, 3]) {
      state = resolvePulls({ ...state, pity5: 89 }, banner, 1, sequence(9_999, 1, 0)).state;
      expect(state.captureProgress).toBe(expected);
      state = { ...state, guaranteedFeatured5: false };
    }
  });
  it('uses each result state for the next result in a x10', () => {
    const values = [9_999, 1, 0, 0, 9_999, ...Array.from({ length: 7 }, () => [9_999, 9_999, 0, 0]).flat(), 9_999, 0];
    const result = resolvePulls({ ...base, pity5: 89 }, banner, 10, sequence(...values));
    expect(result.results[0]?.outcome).toMatchObject({ rarity: 5, wonFiftyFifty: false });
    expect(result.results[1]?.outcome).toMatchObject({ rarity: 5, guaranteeConsumed: true });
    expect(result.results.map(({ index }) => index)).toEqual([1,2,3,4,5,6,7,8,9,10]);
  });
});

describe('secondary rewards, possession and C6 progression', () => {
  it('uses inclusive Moras and particle bounds', () => {
    expect(resolvePulls(base, banner, 1, sequence(9_999, 9_999, 0, 10_000)).results[0]?.outcome).toMatchObject({ resourceKey: 'moras', amount: 15_000n });
    expect(resolvePulls(base, banner, 1, sequence(9_999, 9_999, 1, 6, 60)).results[0]?.outcome).toMatchObject({ resourceKey: 'particles_dendro', amount: 80n });
  });
  it('creates C0, advances to C1/C6, preserves first date and keeps copies after C6', () => {
    const firstDate = new Date('2026-09-01T00:00:00Z');
    const later = new Date('2026-09-02T00:00:00Z');
    const fresh = acquireCharacter(null, firstDate);
    const c1 = acquireCharacter(fresh, later);
    const c6 = acquireCharacter({ copies: 6, constellation: 5, firstObtainedAt: firstDate }, later);
    const plus = acquireCharacter(c6, later);
    expect(fresh).toMatchObject({ copies: 1, constellation: 0, wasNewCharacter: true });
    expect(c1).toMatchObject({ copies: 2, constellation: 1, firstObtainedAt: firstDate });
    expect(c6).toMatchObject({ copies: 7, constellation: 6, reachedC6: true });
    expect(plus).toMatchObject({ copies: 8, constellation: 6, wasAlreadyC6: true });
  });
  it('initializes all C6 stats to one, progresses an available stat and compensates a maxed entry', () => {
    expect(initialC6Stats()).toEqual({ strength: 1, intelligence: 1, beauty: 1, charisma: 1, popularity: 1 });
    expect(progressC6(initialC6Stats(), sequence(2))).toMatchObject({ type: 'stat', stat: 'beauty', stats: { beauty: 2 } });
    expect(progressC6({ strength: 20, intelligence: 20, beauty: 20, charisma: 20, popularity: 20 }, sequence())).toEqual({ type: 'moras', amount: 100_000n, stats: { strength: 20, intelligence: 20, beauty: 20, charisma: 20, popularity: 20 } });
  });
});
