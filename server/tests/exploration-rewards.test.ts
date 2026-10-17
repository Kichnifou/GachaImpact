import {expect,it} from 'vitest';
import {drawExplorationRewards,emptyProgress,explorationQuotas,type ExplorationProgress} from '../src/domain/exploration/rewards.js';
import {seededRandom} from '../src/domain/exploration/maze.js';
import {explorationRegion} from '../src/application/exploration/regions.js';
it('normalizes published region aliases and always excludes Horizon',()=>{
  expect(explorationRegion('  NOD – KRAI ')).toEqual({key:'nodkrai',name:'Nod-Krai'});expect(explorationRegion(' CÉLESTIA ')).toEqual({key:'celestia',name:'Celestia'});expect(explorationRegion('space')).toEqual({key:'espace',name:'Espace'});expect(explorationRegion(' HORIZON ')).toBeNull();expect(explorationRegion('Nouvelle Région')).toEqual({key:'nouvelleregion',name:'Nouvelle Région'});
});
it('never gives three empty chests before completion and never draws an exhausted category',()=>{
  for(let seed=0;seed<1000;seed++)for(const progress of [emptyProgress(),{primogems:100,moras:200,own:300,other:399}]){
    const rewards=drawExplorationRewards(progress,'cryo',seededRandom(seed));expect(rewards).toHaveLength(3);expect(rewards.some(row=>row.category!=='empty')).toBe(true);
    for(const reward of rewards){if(reward.category==='empty')continue;expect(progress[reward.category]).toBeLessThan(explorationQuotas[reward.category]);if(reward.category==='own')expect(reward.resourceKey).toBe('particles_cryo');if(reward.category==='other')expect(reward.resourceKey).not.toBe('particles_cryo');}
  }
});
it('draws exactly empty/own/other at100% with1..5particles and stable hidden outcomes',()=>{
  const progress:ExplorationProgress={primogems:100,moras:200,own:300,other:400};
  for(let seed=0;seed<1000;seed++){
    const rewards=drawExplorationRewards(progress,'electro',seededRandom(seed));expect(rewards.map(row=>row.category).sort()).toEqual(['empty','other','own']);
    expect(drawExplorationRewards(progress,'electro',seededRandom(seed))).toEqual(rewards);
    for(const reward of rewards.filter(row=>row.category!=='empty')){expect(Number(reward.amount)).toBeGreaterThanOrEqual(1);expect(Number(reward.amount)).toBeLessThanOrEqual(5);expect(reward.resourceKey?.startsWith('particles_')).toBe(true);}
  }
});
it('rejects invalid stock instead of silently replacing reward categories',()=>{expect(()=>drawExplorationRewards({...emptyProgress(),own:301},'pyro',seededRandom(1))).toThrow();});
