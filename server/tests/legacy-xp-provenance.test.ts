import { describe, expect, it } from 'vitest';
import { mapLegacyXpProvenance } from '../src/application/migration/legacy-xp-provenance.js';

describe('legacy XP date provenance', () => {
  const message = new Date('2026-09-26T17:00:00Z');

  it('keeps the known message instant without presenting it as the last XP gain', () => {
    expect(mapLegacyXpProvenance('2026-09-26', message)).toMatchObject({
      lastXpAt: null, lastXpMessageAt: message, legacyLastXpDate: new Date('2026-09-26T00:00:00Z'), issue: null,
    });
  });

  it('retains a later non-message XP day without inventing an hour', () => {
    expect(mapLegacyXpProvenance('2026-09-27', message)).toMatchObject({
      lastXpAt: null, lastXpMessageAt: message, legacyLastXpDate: new Date('2026-09-27T00:00:00Z'),
      issue: { code: 'LEGACY_XP_DATE_DIVERGENCE', severity: 'INFO' },
    });
  });

  it('retains a day without a message instant', () => {
    expect(mapLegacyXpProvenance('2026-09-27', null)).toMatchObject({
      lastXpAt: null, lastXpMessageAt: null, legacyLastXpDate: new Date('2026-09-27T00:00:00Z'),
      issue: { code: 'LEGACY_XP_DAY_WITHOUT_MESSAGE_INSTANT', severity: 'INFO' },
    });
  });

  it('keeps a message instant separate when no XP day was recorded', () => {
    expect(mapLegacyXpProvenance(null, message)).toMatchObject({
      lastXpAt: null, lastXpMessageAt: message, legacyLastXpDate: null, issue: null,
    });
  });

  it('warns if the day predates a proven XP message', () => {
    expect(mapLegacyXpProvenance('2026-09-25', message)).toMatchObject({ lastXpAt: null,
      issue: { severity: 'WARNING' } });
  });

  it.each(['2026-02-30', 'yesterday', 27, {}])('blocks an invalid present value', value => {
    expect(() => mapLegacyXpProvenance(value, message)).toThrow('Invalid present legacy lastXpDate');
  });
});
