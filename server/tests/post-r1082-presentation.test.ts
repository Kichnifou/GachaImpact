import { expect, it } from 'vitest';
import type { GachaPullResult, PullResultRecord } from '../src/application/gacha/gacha-store.js';
import { standalonePullSummary } from '../src/application/chat/gacha-command-result.js';
import { harness, actor } from './helpers/chat-command-harness.js';
import { PlayerCommandResolver } from '../src/application/chat/player-command-resolver.js';
import { withPlayerCommandExecution } from '../src/application/player/player-command-execution.js';
import { findRanking } from '../src/application/ranking/ranking-service.js';
const row = (patch: Partial<PullResultRecord> = {}): PullResultRecord => ({ index: 1, resultType: 'resource', character: null, rarity: null, resourceKey: 'moras', resourceAmount: 1000n, wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null, passiveEffects: [], ...patch });
const operation = (rows: PullResultRecord[]): GachaPullResult => ({ operation: { id: 'receipt', pullCount: rows.length as 1, primogemCost: 160n * BigInt(rows.length), createdAt: new Date(), alreadyProcessed: false }, results: rows, playerState: {} as never });
it.each(['TWITCH','INTERNAL_CHAT'] as const)('advertises loose5050 and preserves ranking aliases on %s', async source => {
  const h=harness(), resolver=new PlayerCommandResolver(h.chat as never,h.services as never,source);
  const text=await withPlayerCommandExecution({now:new Date(),source},()=>resolver.resolve(actor,'!top','top-help'));
  expect(text).toContain('loose5050'); expect(text).not.toContain(', lose5050,');
  expect(findRanking('loose5050')?.id).toBe('lost5050');
  expect(findRanking('LOSE5050')).toBe(findRanking('loose5050')); expect(findRanking('lost5050')).toBe(findRanking('loose5050'));
});
it.each([0, 1, 2])('keeps exact consumed guarantee count %s without ×1', count => {
  const result = standalonePullSummary(operation(Array.from({length: Math.max(1, count)}, () => row({ guaranteeConsumed: count > 0 }))));
  expect(result.facts.filter(f => f.includes('Garantie'))).toEqual(count ? [`🎯 Garantie utilisée${count > 1 ? ' ×2' : ''}`] : []);
});
it.each(['pyro', 'geo'] as const)('deduplicates the actual %s multiplier without reapplying it', element => {
  const result = standalonePullSummary(operation(Array.from({length: 10}, () => row({ resourceKey: element === 'geo' ? 'moras' : 'particles_hydro', resourceAmount: 1250n, passiveEffects: [{type:'secondary_reward_multiplier',elementKey:element,numerator:5,denominator:4,amountBefore:1000n,amountAfter:1250n}] }))));
  expect(result.text).toContain('12 500'); expect(result.text).not.toContain('15 625');
  expect(result.facts).toEqual([`🧩 passif : ${element === 'geo' ? 'Moras' : 'particules'} ×1,25`]);
});
it('groups Anemo, Cryo and Electro once without a second credit', () => {
  const result = standalonePullSummary(operation([row({ bonusRewards:[{resourceKey:'primogems',amount:80n,causeKey:'team.passive.anemo.recovery'}], passiveEffects:[{type:'primogem_recovery',elementKey:'anemo',amount:80n},{type:'xp',elementKey:'cryo',amount:1n,xpAfter:1n,levelsReached:[],overflowRewardsGranted:0},{type:'pity5',elementKey:'electro',amount:2,requestedAmount:2}] })]), 'Pseudo');
  expect(result.text).toBe('Pseudo obtient : +💰 1 000 Moras | +💎 80 Primos | +✨ 1 XP');
  expect(result.facts).toHaveLength(1); expect(result.facts[0]).toMatch(/^🧩 passifs :/u);
  expect(result.facts[0]).toContain('+80 Primos'); expect(result.facts[0]).toContain('+1 XP'); expect(result.facts[0]).toContain('+2 pity 5★');
  expect(result.facts[0]?.match(/pity/g)).toHaveLength(1);
});
it('keeps recorded Dendro totals and separate level/C6 facts', () => {
  const rewards = [{resourceKey:'primogems' as const,amount:40n,causeKey:'team.passive.dendro.bundle'},{resourceKey:'moras' as const,amount:1000n,causeKey:'team.passive.dendro.bundle'}];
  const result = standalonePullSummary(operation([row({bonusRewards:[...rewards,{resourceKey:'primogems',amount:80n,causeKey:'gacha.c6-duplicate-refund'},{resourceKey:'primogems',amount:800n,causeKey:'player.level.reward'}],c6Progression:{type:'stat',stat:'beauty',valueAfter:2},passiveEffects:[{type:'resource_bundle',elementKey:'dendro',rewards}] }),row({bonusRewards:rewards,passiveEffects:[{type:'resource_bundle',elementKey:'dendro',rewards}] })]));
  expect(result.text).toContain('4 000 Moras'); expect(result.text).toContain('960 Primos');
  expect(result.facts.join(' ')).toContain('+80 Primos'); expect(result.facts.join(' ')).toContain('+2 000 Moras');
  expect(result.facts.filter(f=>f.startsWith('🧩'))).toHaveLength(1); expect(result.facts[0]).toContain('+1 Beauté');
  expect(result.facts.join(' ')).not.toContain('+960 Primos');
});
it('presents effective recorded bonuses including Hydro chance', () => {
  expect(standalonePullSummary(operation([row()])).facts).toEqual([]);
  const result=standalonePullSummary(operation([row({passiveEffects:[{type:'five_star_chance_bonus',elementKey:'hydro',basisPoints:60},{type:'secondary_reward_multiplier',elementKey:'geo',numerator:5,denominator:4,amountBefore:0n,amountAfter:0n},{type:'pity5',elementKey:'electro',amount:0,requestedAmount:2}]})]));
  expect(result.facts).toEqual(['🧩 passif : chance 5★ +0,6%']);
});
