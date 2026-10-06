import { describe, expect, it } from 'vitest';
import { parseLegacyElement } from '../src/application/migration/legacy-element.js';
import { mapLegacyPersonalFacts } from '../src/application/migration/legacy-personal-facts.js';
import { identityResolutionLogins, createVerifiedTwitchReport, parseIdentityResolutionArguments } from '../src/application/migration/verified-twitch-report.js';
import { canarySnapshot } from './helpers/legacy-canary-snapshot.js';

describe('strict nullable legacy element and explicit identity scope', () => {
  it.each([undefined, null, ''])('accepts actual absence %s without changing other personal facts', element => {
    expect(parseLegacyElement(element)).toEqual({ kind: 'ABSENT_ELEMENT', elementKey: null });
    const facts = mapLegacyPersonalFacts({ element, dates: {}, stats: {} }, 'a'.repeat(64), new Date());
    expect(facts.elementKey).toBeNull();
    const { snapshot, report } = canarySnapshot({ element });
    const scope = { kind: 'CANARY' as const, legacyLogin: 'fixture_canary' };
    expect(identityResolutionLogins(snapshot, scope)).toEqual(['fixture_canary']);
    expect(createVerifiedTwitchReport(snapshot, report, new Date(), scope).users).toHaveLength(1);
  });
  it.each(['pyrp', 'none', 0, false, {}])('rejects an unknown value %s instead of erasing it', value => {
    expect(() => parseLegacyElement(value)).toThrow('LEGACY_ELEMENT_INVALID');
  });
  it.each(['Pyro','Hydro','Cryo','Electro','Anemo','Geo','Dendro'])('preserves %s', value => expect(parseLegacyElement(value).elementKey).toBe(value.toLowerCase()));
  it('parses a canary or a complete fixed-population scope and retains explicitly historical fallback', () => {
    expect(parseIdentityResolutionArguments(['capture','output','--canary-login','fixture_canary']).canaryLogin).toBe('fixture_canary');
    expect(parseIdentityResolutionArguments(['capture','output','--population','population','--historical-identities','report','--historical-snapshot','historical']).population).toBe('population');
    expect(parseIdentityResolutionArguments(['capture','output','prior']).prior).toBe('prior');
    expect(() => parseIdentityResolutionArguments(['capture','output','--population','partial'])).toThrow();
    expect(() => parseIdentityResolutionArguments(['capture','output','--canary-login','fixture','--canary-login','duplicate'])).toThrow();
  });
});
