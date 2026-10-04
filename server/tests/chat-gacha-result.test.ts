import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pullChatResult, stellaChatResult } from '../src/application/chat/gacha-command-result.js';
import type { GachaPullResult, PullResultRecord } from '../src/application/gacha/gacha-store.js';
import type { StellaUseResult } from '../src/application/box/box-store.js';

const base: PullResultRecord = { index: 1, resultType: 'character', character: { id: 'royal', name: 'Étoile Royale', rarity: 5, elementKey: 'pyro', externalKey: 'royal', classKey: null, region: null, weaponType: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null }, rarity: 5, resourceKey: null, resourceAmount: null, wasNewCharacter: false, constellationAfter: 6, copiesAfter: 8, wasFiftyFifty: true, wonFiftyFifty: true, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null, passiveEffects: [], pity5AtPull: 30, backToBack: true };
const result = (rows: readonly PullResultRecord[]): GachaPullResult => ({ operation: { id: 'op', pullCount: rows.length as GachaPullResult['operation']['pullCount'], primogemCost: BigInt(rows.length) * 160n, createdAt: new Date(), alreadyProcessed: false }, results: rows, playerState: {} as GachaPullResult['playerState'] });
describe('Authoritative Gacha chat presentation', () => {
  it('returns exactly ten independent bounded results including every recorded gain and passive', () => {
    const row: PullResultRecord = { ...base, bonusRewards: [{ resourceKey: 'primogems', amount: 160n, causeKey: 'gacha.c6-duplicate-refund' }, { resourceKey: 'moras', amount: 100000n, causeKey: 'gacha.c6-maxed-compensation' }, { resourceKey: 'primogems', amount: 80n, causeKey: 'team.passive.anemo.primogem-recovery' }, { resourceKey: 'moras', amount: 1000n, causeKey: 'team.passive.dendro.bundle' }], c6Progression: { type: 'maxed' }, passiveEffects: [{ elementKey: 'cryo', type: 'xp', amount: 4n, xpAfter: 30n, levelsReached: [1], overflowRewardsGranted: 0 }, { elementKey: 'electro', type: 'pity5', amount: 1, requestedAmount: 2 }, { elementKey: 'anemo', type: 'primogem_recovery', amount: 80n }, { elementKey: 'dendro', type: 'resource_bundle', rewards: [{ resourceKey: 'moras', amount: 1000n }, { resourceKey: 'primogems', amount: 40n }, { resourceKey: 'particles_dendro', amount: 5n }] }] };
    const parts = pullChatResult('Axel', result(Array.from({ length: 10 }, (_, i) => ({ ...row, index: i + 1 }))));
    expect(parts).toHaveLength(10); expect(parts.every(part => Array.from(part).length <= 500)).toBe(true);
    const text = parts.join(' ');
    for (let i = 1; i <= 10; i++) {
      expect(parts.filter(part => part.includes(`🎉 [${i}/10] Axel obtient ⭐⭐⭐⭐⭐ 🔥 Étoile Royale`))).toHaveLength(1);
      expect(parts[i - 1]).toContain('Déjà C6 : remboursement +160 primos');
    }
    expect(text).toContain('100 000 💰 moras'); expect(text).toContain('Early · B2B · 50/50 gagné'); expect(text).toContain('niveaux 1'); expect(text).toContain('⚡ +1 pity'); expect(text).toContain('🌪️ +80 primos'); expect(text).toContain('+5 🌿 chacun');
    expect(pullChatResult('Axel', { ...result([row]), operation: { ...result([row]).operation, alreadyProcessed: true } })).toEqual(pullChatResult('Axel', result([row])));
  });
  it('shows recorded C6 statistics, Capture/guarantee and Hard, with secondary amounts unchanged', () => {
    const text = pullChatResult('Axel', result([{ ...base, pity5AtPull: 85, captureTriggered: true, c6Progression: { type: 'stat', stat: 'strength', valueAfter: 12 } }, { ...base, index: 2, rarity: null, character: null, resourceKey: 'moras', resourceAmount: 9007199254740993n, passiveEffects: [{ elementKey: 'geo', type: 'secondary_reward_multiplier', numerator: 3, denominator: 2, amountBefore: 2n, amountAfter: 3n }] }])).join(' ');
    expect(text).toContain('Hard'); expect(text).toContain('✨ Capture'); expect(text).not.toContain('50/50 gagné'); expect(text).toContain('Force (12/20)'); expect(text).toContain('9 007 199 254 740 993 💰 moras');
  });
  it.each([1, 3, 10])('publishes exactly %i logical results in order without an aggregate header', count => {
    const rows = Array.from({ length: count }, (_, index) => ({ ...base, index: index + 1, wasNewCharacter: true, constellationAfter: 0 }));
    const messages = pullChatResult('Axel', result(rows));
    expect(messages).toHaveLength(count);
    for (let i = 0; i < count; i++) {
      expect(messages[i]).toContain(count > 1 ? `[${i + 1}/${count}]` : '🎉 Axel');
      expect(messages[i]).toContain('Nouveau personnage : C0.');
      expect(messages[i]).not.toContain('Invocation'); expect(messages[i]).not.toContain('[1/1]');
    }
  });
  it.each([
    [{ wasFiftyFifty: true, wonFiftyFifty: false }, '50/50 perdu'],
    [{ wasFiftyFifty: true, wonFiftyFifty: true }, '50/50 gagné'],
    [{ guaranteeConsumed: true }, '🎯 Garantie'],
    [{ captureTriggered: true }, '✨ Capture'],
  ])('uses recorded five-star facts %j', (facts, expected) => {
    expect(pullChatResult('Axel', result([{ ...base, ...facts }])).join(' ')).toContain(expected);
  });
  it('shows secondary totals and modern C6 refunds from each recorded step, without Number conversion', () => {
    const rows: PullResultRecord[] = [
      { ...base, index: 1, rarity: 4, bonusRewards: [{ resourceKey: 'primogems', amount: 80n, causeKey: 'gacha.c6-duplicate-refund' }], resourceTotalsAfter: { primogems: '9007199254740993' } },
      { ...base, index: 2, character: null, rarity: null, resourceKey: 'particles_cryo', resourceAmount: 20n, resourceTotalsAfter: { particles_cryo: '555' } },
      { ...base, index: 3, character: null, rarity: null, resourceKey: 'moras', resourceAmount: 6664n, resourceTotalsAfter: { moras: '3209037' } },
    ];
    const messages = pullChatResult('Axel', result(rows));
    expect(messages[0]).toContain('Déjà C6 : remboursement +80 primos (9 007 199 254 740 993).');
    expect(messages[1]).toBe('✅ [2/3] Axel obtient +20 particules ❄️ Cryo (555).');
    expect(messages[2]).toBe('✅ [3/3] Axel obtient +6 664 💰 moras (3 209 037).');
    expect(pullChatResult('Axel', result([{ ...base, rarity: 4, constellationAfter: 2 }]))[0]).toContain('Doublon : passe C2.');
  });
  it('shows all triggered procs but hides constant effects without losing level or bundle gains', () => {
    const row: PullResultRecord = { ...base, passiveEffects: [
      { elementKey: 'hydro', type: 'five_star_chance_bonus', basisPoints: 60 },
      { elementKey: 'pyro', type: 'secondary_reward_multiplier', numerator: 5, denominator: 4, amountBefore: 20n, amountAfter: 25n },
      { elementKey: 'geo', type: 'secondary_reward_multiplier', numerator: 3, denominator: 2, amountBefore: 200n, amountAfter: 300n },
      { elementKey: 'cryo', type: 'xp', amount: 1n, xpAfter: 100n, levelsReached: [3], overflowRewardsGranted: 1 },
      { elementKey: 'electro', type: 'pity5', amount: 2, requestedAmount: 2 },
      { elementKey: 'anemo', type: 'primogem_recovery', amount: 80n },
      { elementKey: 'dendro', type: 'resource_bundle', rewards: [{ resourceKey: 'primogems', amount: 40n }, { resourceKey: 'moras', amount: 1000n }, ...['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].map(e => ({ resourceKey: ('particles_' + e) as 'particles_pyro', amount: 5n }))] },
    ], bonusRewards: [{ resourceKey: 'primogems', amount: 160n, causeKey: 'player.xp.level-reward' }] };
    const messages = pullChatResult('Axel', result([row])); expect(messages).toHaveLength(1);
    expect(Array.from(messages[0]!).length).toBeLessThanOrEqual(500);
    for (const fact of ['💧 +0.6%', '🔥 ×1,25', '☄️ ×1,5']) expect(messages[0]).not.toContain(fact);
    for (const fact of ['❄️ +1 XP', 'niveaux 3', 'bonus niv.100 ×1', '⚡ +2 pity', '🌪️ +80 primos', '🌿 +40 primos, +1 000 💰 moras', '+5 🔥💧❄️⚡🌪️☄️🌿 chacun', 'Niveau : +160 primos']) expect(messages[0]).toContain(fact);
  });
  it.each([3, 10])('keeps procs on their own row and exactly replays x%i', count => {
    const effects: PullResultRecord['passiveEffects'] = [
      { elementKey: 'cryo', type: 'xp', amount: 1n, xpAfter: 1n, levelsReached: [], overflowRewardsGranted: 0 },
      { elementKey: 'electro', type: 'pity5', amount: 2, requestedAmount: 2 },
      { elementKey: 'anemo', type: 'primogem_recovery', amount: 80n },
      { elementKey: 'dendro', type: 'resource_bundle', rewards: [{ resourceKey: 'moras', amount: 1000n }] },
    ];
    for (const effect of effects) {
      const rows = Array.from({ length: count }, (_, i): PullResultRecord => ({
        ...base, index: i + 1, rarity: null, character: null, resourceKey: 'moras', resourceAmount: 9000n,
        passiveEffects: [{ elementKey: 'hydro', type: 'five_star_chance_bonus', basisPoints: 60 },
          { elementKey: 'geo', type: 'secondary_reward_multiplier', numerator: 3, denominator: 2, amountBefore: 6000n, amountAfter: 9000n },
          ...(i === 1 ? [effect] : [])],
      }));
      const recorded = result(rows);
      const messages = pullChatResult('Axel', recorded);
      expect(messages).toHaveLength(count);
      messages.forEach((message, i) => {
        expect(message).toContain('+9 000 💰 moras');
        expect(message.includes(' | ')).toBe(i === 1);
        expect(message).not.toMatch(/chance 5★|×1,5/u);
      });
      expect(messages[1]).toContain({ cryo: '❄️ +1 XP', electro: '⚡ +2 pity', anemo: '🌪️ +80 primos', dendro: '🌿 +1 000' }[effect.elementKey as 'cryo' | 'electro' | 'anemo' | 'dendro']);
      expect(pullChatResult('Axel', { ...recorded, operation: { ...recorded.operation, alreadyProcessed: true } })).toEqual(messages);
    }
  });
  it('uses Stella progression and remaining quantity without a fictitious refund', () => {
    const outcome = { character: { name: 'Étoile Royale', elementKey: 'pyro', constellation: 6 }, stellaRemaining: 2n, c6Progression: { type: 'stat', stat: 'beauty', valueAfter: 19 } } as StellaUseResult;
    expect(stellaChatResult('Axel', outcome)).toContain('Beauté (19/20)'); expect(stellaChatResult('Axel', outcome)).toContain('Stella restantes : 2'); expect(stellaChatResult('Axel', outcome)).not.toContain('Primogemmes');
  });
  it('keeps a valid four-element Team with C6, XP overflow and maximum exact balances within one 500-character result', () => {
    const catalog = JSON.parse(readFileSync('prisma/data/characters.json', 'utf8')) as { name: string }[];
    const longest = catalog.sort((a, b) => Array.from(b.name).length - Array.from(a.name).length)[0]!.name;
    const totals = { primogems: '9223372036854775807', moras: '9223372036854775807' };
    const row: PullResultRecord = { ...base, index: 10, character: { ...base.character!, name: longest }, resourceTotalsAfter: totals,
      c6Progression: { type: 'maxed' },
      bonusRewards: [{ resourceKey: 'primogems', amount: 160n, causeKey: 'gacha.c6-duplicate-refund' }, { resourceKey: 'moras', amount: 100000n, causeKey: 'gacha.c6-maxed-compensation' },
        ...[{ resourceKey: 'primogems' as const, amount: 800n }, { resourceKey: 'moras' as const, amount: 10000n }, { resourceKey: 'particles_hydro' as const, amount: 80n }, { resourceKey: 'particles_pyro' as const, amount: 40n }].map(reward => ({ ...reward, causeKey: 'player.xp.level-reward' }))],
      passiveEffects: [{ elementKey: 'cryo', type: 'xp', amount: 1n, xpAfter: 2001n, levelsReached: [], overflowRewardsGranted: 1 }, { elementKey: 'electro', type: 'pity5', amount: 2, requestedAmount: 2 }, { elementKey: 'anemo', type: 'primogem_recovery', amount: 80n },
        { elementKey: 'dendro', type: 'resource_bundle', rewards: [{ resourceKey: 'primogems', amount: 40n }, { resourceKey: 'moras', amount: 1000n }, ...['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].map(element => ({ resourceKey: ('particles_' + element) as 'particles_pyro', amount: 5n }))] }],
    };
    const messages = pullChatResult('É'.repeat(40), { ...result([row]), operation: { ...result([row]).operation, pullCount: 10 } });
    expect(messages).toHaveLength(1); expect(Array.from(messages[0]!).length).toBeLessThanOrEqual(500);
    expect(messages[0]).toContain(longest); expect(messages[0]).toContain('É'.repeat(40));
    const normalized = messages[0]!.replace(/\d{1,3}(?: \d{3})+/gu, value => value.replaceAll(' ', ''));
    for (const gain of ['+160 primos', '+100000 💰 moras', '+800 primos', '+10000 💰 moras', '+80 💧', '+40 🔥', '+2 pity 5★', '+80 primos', '+5 🔥💧❄️⚡🌪️☄️🌿 chacun', '9223372036854775807']) expect(normalized).toContain(gain);
    const actorName = ('Joueur 123 456 ' + 'É'.repeat(40)).slice(0, 40);
    const characterName = ('Personnage 123 456 ' + 'É'.repeat(60)).slice(0, 60);
    const compact = pullChatResult(actorName, { ...result([{ ...row, character: { ...row.character!, name: characterName } }]), operation: { ...result([row]).operation, pullCount: 10 } })[0]!;
    expect(Array.from(compact).length).toBeLessThanOrEqual(500);
    expect(compact).toContain(actorName); expect(compact).toContain(characterName);
    expect(compact).toContain('🌟 Stats max : +100000 💰 moras');
  });
});
