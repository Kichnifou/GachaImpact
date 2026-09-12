import { describe, expect, it } from 'vitest';
import { selectExpeditionReward } from '../src/domain/expedition/expedition.js';

describe('Expedition reward table', () => {
  it('maps the ten authoritative outcomes without ambiguity', () => {
    expect(selectExpeditionReward(1, 'hydro')).toMatchObject({ kind: 'primogems', resourceKey: 'primogems', amount: 1_600n });
    for (const roll of [2, 3, 4]) expect(selectExpeditionReward(roll, 'hydro')).toMatchObject({ kind: 'particles', resourceKey: 'particles_hydro', amount: 800n });
    for (const roll of [5, 6, 7, 8, 9, 10]) expect(selectExpeditionReward(roll, 'hydro')).toMatchObject({ kind: 'moras', resourceKey: 'moras', amount: 30_000n });
  });
  it('rejects rolls outside 1..10', () => { expect(() => selectExpeditionReward(0, 'pyro')).toThrow(); expect(() => selectExpeditionReward(11, 'pyro')).toThrow(); });
});
