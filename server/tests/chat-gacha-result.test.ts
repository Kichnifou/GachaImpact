import { describe, expect, it } from 'vitest';
import { pullChatResult, stellaChatResult } from '../src/application/chat/gacha-command-result.js';
import type { GachaPullResult, PullResultRecord } from '../src/application/gacha/gacha-store.js';
import type { StellaUseResult } from '../src/application/box/box-store.js';

const base: PullResultRecord = { index: 1, resultType: 'character', character: { id: 'royal', name: 'Étoile Royale', rarity: 5, elementKey: 'pyro', externalKey: 'royal', classKey: null, region: null, weaponType: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null }, rarity: 5, resourceKey: null, resourceAmount: null, wasNewCharacter: false, constellationAfter: 6, copiesAfter: 8, wasFiftyFifty: true, wonFiftyFifty: true, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null, passiveEffects: [], pity5AtPull: 30, backToBack: true };
const result = (rows: readonly PullResultRecord[]): GachaPullResult => ({ operation: { id: 'op', pullCount: 10, primogemCost: 1600n, createdAt: new Date(), alreadyProcessed: false }, results: rows, playerState: {} as GachaPullResult['playerState'] });
describe('Authoritative Gacha chat presentation', () => {
  it('retains all ten results, secondary gains, C6 refunds and every triggered passive beyond 500 characters', () => {
    const row: PullResultRecord = { ...base, bonusRewards: [{ resourceKey: 'primogems', amount: 160n, causeKey: 'gacha.c6-duplicate-refund' }, { resourceKey: 'moras', amount: 100000n, causeKey: 'gacha.c6-maxed-compensation' }, { resourceKey: 'primogems', amount: 80n, causeKey: 'team.passive.anemo.primogem-recovery' }, { resourceKey: 'moras', amount: 1000n, causeKey: 'team.passive.dendro.bundle' }], c6Progression: { type: 'maxed' }, passiveEffects: [{ elementKey: 'cryo', type: 'xp', amount: 4n, xpAfter: 30n, levelsReached: [1], overflowRewardsGranted: 0 }, { elementKey: 'electro', type: 'pity5', amount: 1, requestedAmount: 2 }, { elementKey: 'anemo', type: 'primogem_recovery', amount: 80n }, { elementKey: 'dendro', type: 'resource_bundle', rewards: [{ resourceKey: 'moras', amount: 1000n }, { resourceKey: 'primogems', amount: 40n }, { resourceKey: 'particles_dendro', amount: 5n }] }] };
    const parts = pullChatResult('Axel', result(Array.from({ length: 10 }, (_, i) => ({ ...row, index: i + 1 }))));
    expect(parts.length).toBeGreaterThan(1); expect(parts.every(part => Array.from(part).length <= 500)).toBe(true);
    const text = parts.join(' ');
    for (let i = 1; i <= 10; i++) {
      expect(parts.filter(part => part.includes(`[${i}/10] ⭐⭐⭐⭐⭐ 🔥 Étoile Royale`))).toHaveLength(1);
      expect(parts.filter(part => part.includes(`[${i}/10] Remboursement C6 : +💠160`))).toHaveLength(1);
    }
    expect(text).toContain('100 000 Moras'); expect(text).toContain('Early · B2B · 50/50 gagné'); expect(text).toContain('niveaux 1'); expect(text).toContain('Electro : +1 pity'); expect(text).toContain('Anemo : +💠80'); expect(text).toContain('Dendro : +5 particules 🌿 Dendro');
    expect(pullChatResult('Axel', { ...result([row]), operation: { ...result([row]).operation, alreadyProcessed: true } })).toEqual(pullChatResult('Axel', result([row])));
  });
  it('shows recorded C6 statistics, Capture/guarantee and Hard, with secondary amounts unchanged', () => {
    const text = pullChatResult('Axel', result([{ ...base, pity5AtPull: 85, captureTriggered: true, c6Progression: { type: 'stat', stat: 'strength', valueAfter: 12 } }, { ...base, index: 2, rarity: null, character: null, resourceKey: 'moras', resourceAmount: 9007199254740993n, passiveEffects: [{ elementKey: 'geo', type: 'secondary_reward_multiplier', numerator: 3, denominator: 2, amountBefore: 2n, amountAfter: 3n }] }])).join(' ');
    expect(text).toContain('Hard'); expect(text).toContain('✨ Capture'); expect(text).not.toContain('50/50 gagné'); expect(text).toContain('Force (12/20)'); expect(text).toContain('9 007 199 254 740 993 Moras');
  });
  it('uses Stella progression and remaining quantity without a fictitious refund', () => {
    const outcome = { character: { name: 'Étoile Royale', elementKey: 'pyro', constellation: 6 }, stellaRemaining: 2n, c6Progression: { type: 'stat', stat: 'beauty', valueAfter: 19 } } as StellaUseResult;
    expect(stellaChatResult('Axel', outcome)).toContain('Beauté (19/20)'); expect(stellaChatResult('Axel', outcome)).toContain('Stella restantes : 2'); expect(stellaChatResult('Axel', outcome)).not.toContain('Primogemmes');
  });
});
