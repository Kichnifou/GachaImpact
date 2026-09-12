import { describe, expect, it } from 'vitest';
import { calculateDailyCombatPreview, projectElementMatchups } from '../src/domain/combat/daily-combat.js';
import type { ElementKey } from '../src/domain/economy/resources.js';

const enemies = ['geo', 'geo', 'geo', 'geo'] as const;
const relations = new Map<string, number>();
const members = (rarity: 4 | 5, constellation: number, elementKey: ElementKey = 'pyro') => [0, 1, 2, 3].map((index) => ({ id: `c${index}`, rarity, constellation, elementKey }));

describe('Daily Combat authoritative formula', () => {
  it('calculates four neutral 5-star C0 members at 74%', () => expect(calculateDailyCombatPreview(members(5, 0), enemies, relations).finalHalfPoints).toBe(148));
  it('adds four net favorable relations to reach 90%', () => {
    const map = new Map([['pyro:geo', 1]]);
    expect(calculateDailyCombatPreview(members(5, 0), ['geo'] as const, map).finalHalfPoints).toBe(180);
  });
  it('clamps a raw 98% chance to 95%', () => {
    const map = new Map([['pyro:geo', 1], ['pyro:cryo', 1]]);
    const mixed = [...members(5, 0).slice(0, 2), ...members(5, 0, 'hydro').slice(2)];
    const result = calculateDailyCombatPreview(mixed, ['geo', 'geo', 'cryo'] as const, map);
    expect(result.rawHalfPoints).toBe(196); expect(result.finalHalfPoints).toBe(190); expect(result.clamp).toBe('MAXIMUM');
  });
  it('calculates four neutral 4-star C0 members at 62%', () => expect(calculateDailyCombatPreview(members(4, 0), enemies, relations).finalHalfPoints).toBe(124));
  it('calculates four neutral 4-star C6 members at 74%', () => expect(calculateDailyCombatPreview(members(4, 6), enemies, relations).finalHalfPoints).toBe(148));
});

describe('Daily Combat enemy matchup projection', () => {
  it('derives Cryo weaknesses and resistances in canonical attacker order', () => {
    const matrix = new Map<string, number>([
      ['electro:cryo', 1],
      ['anemo:cryo', -1],
      ['pyro:cryo', 1],
      ['geo:cryo', 0],
    ]);
    expect(projectElementMatchups('cryo', matrix)).toEqual({
      weakAgainstElements: ['pyro', 'electro'],
      resistantAgainstElements: ['anemo'],
    });
  });
});
