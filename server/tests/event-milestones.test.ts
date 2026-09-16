import { describe, expect, it, vi } from 'vitest';
import { elementKeys } from '../src/domain/economy/resources.js';
import { EVENT_MILESTONES, milestoneParticleElement } from '../src/domain/event/milestones.js';

describe('Event milestones', () => {
  it('keeps the exact eight reward thresholds', () => {
    expect(EVENT_MILESTONES).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });
  it.each(elementKeys.map((element, index) => [element, index] as const))('can choose %s for the random particle reward', (element, index) => {
    expect(milestoneParticleElement(10, 'geo', { nextInt: () => index })).toBe(element);
    expect(milestoneParticleElement(30, null, { nextInt: () => index })).toBe(element);
  });
  it('uses the permanent personal element at 30 without invoking RNG', () => {
    const nextInt = vi.fn(() => 0);
    expect(milestoneParticleElement(30, 'dendro', { nextInt })).toBe('dendro');
    expect(nextInt).not.toHaveBeenCalled();
  });
});
