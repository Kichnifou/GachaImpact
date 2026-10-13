import {planPlayerXpGrant} from '../src/domain/player/xp-grant.js';
import {it,expect} from 'vitest';
import {harness} from './helpers/chat-command-harness.js';
import {standalonePullSummary} from '../src/application/chat/gacha-command-result.js';
import {pullPresentation} from '../src/application/chat/result-presentation.js';
it('packs canonical C6/passive/Mission bursts without loss and replays one frozen result after publication interruption',async()=>{
 const h=harness();
 const rows=Array.from({length:10},(_,i)=>({index:i+1,resultType:'character',character:{id:'five',name:'A',elementKey:'pyro',rarity:5,iconPath:null},rarity:5,resourceKey:null,resourceAmount:null,wasNewCharacter:false,constellationAfter:6,copiesAfter:8+i,wasFiftyFifty:i>0,wonFiftyFifty:i>0?true:null,guaranteeConsumed:i===0,captureTriggered:false,backToBack:i>0,pity5AtPull:i===0?1:3,pity4AtPull:1,
 c6Progression:{type:'stat',stat:'strength',valueAfter:2+i},
 bonusRewards:[{resourceKey:'primogems',amount:160n,causeKey:'gacha.c6-duplicate-refund'},{resourceKey:'primogems',amount:80n,causeKey:'team.passive.anemo.primogem-recovery'},...([{resourceKey:'primogems',amount:40n},{resourceKey:'moras',amount:1000n},...['pyro','hydro','cryo','electro','anemo','geo','dendro'].map(k=>({resourceKey:`particles_${k}`,amount:5n}))].map(r=>({...r,causeKey:'team.passive.dendro.bundle'})))],
 passiveEffects:[{type:'xp',elementKey:'cryo',amount:1n,xpAfter:2991n+BigInt(i),levelsReached:i===9?[100]:[],overflowRewardsGranted:0},{type:'pity5',elementKey:'electro',amount:2,requestedAmount:2},{type:'primogem_recovery',elementKey:'anemo',amount:80n},{type:'resource_bundle',elementKey:'dendro',rewards:[{resourceKey:'primogems',amount:40n},{resourceKey:'moras',amount:1000n},...['pyro','hydro','cryo','electro','anemo','geo','dendro'].map(k=>({resourceKey:`particles_${k}`,amount:5n}))]}]}));
 const level=planPlayerXpGrant({xp:2999n,level100OverflowRewardsClaimed:0,totalMessages:0n,countedMessages:0n,lastXpAt:null,lastXpMessageAt:null},1n,'pyro',new Date('2026-10-13T12:00:00Z'),{nextInt:()=>0});
 rows[9]!.bonusRewards.push(...level.rewards.map(reward=>({...reward,causeKey:'player.xp.level-reward'})));
 const result={operation:{id:'pull-op',pullCount:10,primogemCost:1600n,createdAt:new Date('2026-10-13T12:00:00Z'),alreadyProcessed:false},results:rows,playerState:{}};
 h.services.performGachaPullChat.execute.mockResolvedValue(result as never);
 const missions=['Archonte des vœux','Millionnaire','Archonte élémentaire','Couronne des constellations','Amitié parfaite','Sommet de l’aventure','Maître du combat'].map((name,index)=>`🎯 Mission terminée : ${name} (+${index<3?16000:160000} Primogemmes).`);
 missions.push('✅ Défi terminé : +💠800 Primogemmes.');h.chat.commandMissionCompletions.mockResolvedValue(missions);
 const summary=standalonePullSummary(result as never,'Moi'),presentation=pullPresentation(result as never);
 h.chat.publishGameResult.mockRejectedValueOnce(new Error('publication interruption'));
 await expect(h.send('!pull 10')).rejects.toThrow('publication interruption');
 const frozen=h.chat.freezeCommandResult.mock.calls[0]![1];
 expect(presentation.facts.length+missions.length).toBeGreaterThan(24);
 expect(frozen.presentation!.facts.length).toBeLessThanOrEqual(24);
 expect(frozen.presentation!.facts.every(f=>Array.from(f).length<=300)).toBe(true);
 const all=frozen.presentation!.facts.join(' · ');
 for(const fact of [...presentation.facts,...missions]) expect(all).toContain(fact);
 expect(frozen.content).toBe(summary.text);
 h.chat.readCommandResult.mockResolvedValue(frozen as never);
 await h.send('!pull 10');
 expect(h.services.performGachaPullChat.execute).toHaveBeenCalledOnce();
 expect(h.chat.publishGameResult.mock.calls[1]![1]).toBe(frozen.content);
 expect(h.chat.publishGameResult.mock.calls[1]).toHaveLength(3);
});
