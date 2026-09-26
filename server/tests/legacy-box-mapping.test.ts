import { describe, expect, it } from 'vitest';
import { mapLegacyBox } from '../src/application/migration/legacy-box-mapping.js';

const catalog = [{ id: 'character-1', externalKey: 'legacy:1' }];
const cutover = new Date('2026-09-26T15:00:00.000Z');

describe('legacy Box mapping', () => {
  it('maps a certain Paris acquisition date and repairs the minimum certain copies', () => {
    const result = mapLegacyBox({ box: { '1': { characterId: 1, constellation: 4, copies: 2, firstObtainedAt: '2026-07-01 12:30:00' } }, boxFavorites: ['1'] }, catalog, cutover);
    expect(result.blockers).toEqual([]);
    expect(result.rows).toMatchObject([{ characterId: 'character-1', constellation: 4, copies: 5, favorite: true }]);
    expect(result.rows[0]?.firstObtainedAt.toISOString()).toBe('2026-07-01T10:30:00.000Z');
    expect(result.rows[0]?.provenance.firstObtainedAtFallback).toBe(false);
  });
  it('uses a marked cutover fallback for a DST-ambiguous date', () => {
    const result = mapLegacyBox({ box: { '1': { characterId: 1, constellation: 0, copies: 1, firstObtainedAt: '2026-10-25 02:30:00' } } }, catalog, cutover);
    expect(result.rows[0]?.firstObtainedAt).toEqual(cutover);
    expect(result.rows[0]?.provenance.firstObtainedAtFallback).toBe(true);
    expect(result.anomalies).toHaveLength(1);
  });
  it('blocks conflicting identifiers and missing physical catalog targets', () => {
    const conflict = mapLegacyBox({ box: { '1': { characterId: 2, constellation: 0, copies: 1 } } }, catalog, cutover);
    expect(conflict.blockers).toHaveLength(1);
    const missing = mapLegacyBox({ box: { '1': { characterId: 1, constellation: 0, copies: 1 } } }, [], cutover);
    expect(missing.blockers).toHaveLength(1);
  });
});
