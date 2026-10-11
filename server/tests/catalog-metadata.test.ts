import { describe, expect, it } from 'vitest';
import { normalizeRegion, normalizeWeapon } from '../src/application/character-catalog/catalog-metadata.js';
describe('catalogue metadata vocabulary',()=>{
  it('canonicalizes known French and English weapons and rejects arbitrary values',()=>{
    expect(['Sword','Claymore','Polearm','Bow','Catalyst'].map(normalizeWeapon)).toEqual(['Épée','Claymore','Lance','Arc','Catalyseur']);
    expect(normalizeWeapon(' Épée à deux mains ')).toBe('Claymore');
    expect(()=>normalizeWeapon('gun')).toThrow();
  });
  it('normalizes regions while preserving atypical historical labels',()=>{
    expect(normalizeRegion('  Nod-Krai \t')).toBe('Nod-Krai');
    expect(normalizeRegion('Horizon')).toBe('Horizon');
    expect(normalizeRegion('Espace')).toBe('Espace');
    expect(()=>normalizeRegion('<script>')).toThrow();
    expect(()=>normalizeRegion('x\u200by')).toThrow();
  });
});
