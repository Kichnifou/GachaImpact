import { elementKeys,type ElementKey,type ResourceKey } from '../economy/resources.js';
export const explorationQuotas={primogems:100,moras:200,own:300,other:400} as const;
export type UsefulCategory=keyof typeof explorationQuotas;
export type ExplorationProgress=Readonly<Record<UsefulCategory,number>>;
export type ExplorationReward=Readonly<{category:UsefulCategory|'empty';resourceKey:ResourceKey|null;amount:string}>;
export const emptyProgress=():ExplorationProgress=>({primogems:0,moras:0,own:0,other:0});
export const usefulOpened=(progress:ExplorationProgress)=>Object.values(progress).reduce((a,b)=>a+b,0);
const empty:ExplorationReward={category:'empty',resourceKey:null,amount:'0'};
export function drawExplorationRewards(progress:ExplorationProgress,element:ElementKey,random:()=>number):ExplorationReward[] {
  for(const key of Object.keys(explorationQuotas) as UsefulCategory[])if(!Number.isInteger(progress[key])||progress[key]<0||progress[key]>explorationQuotas[key])throw new RangeError('Invalid Exploration stock.');
  const others=elementKeys.filter(key=>key!==element);
  const otherResource=()=>`particles_${others[Math.floor(random()*others.length)]!}` as const;
  const total=usefulOpened(progress);
  if(total===1000){
    const rewards:ExplorationReward[]=[empty,{category:'own',resourceKey:`particles_${element}`,amount:String(1+Math.floor(random()*5))},{category:'other',resourceKey:otherResource(),amount:String(1+Math.floor(random()*5))}];
    for(let i=2;i>0;i--){const j=Math.floor(random()*(i+1));[rewards[i],rewards[j]]=[rewards[j]!,rewards[i]!];}return rewards;
  }
  const stocks=(Object.keys(explorationQuotas) as UsefulCategory[]).map(category=>({category,left:explorationQuotas[category]-progress[category]})).filter(row=>row.left>0);
  const useful=():ExplorationReward=>{
    let ticket=random()*(1000-total);let category=stocks[stocks.length-1]!.category;
    for(const row of stocks){ticket-=row.left;if(ticket<0){category=row.category;break;}}
    return {category,resourceKey:category==='primogems'?'primogems':category==='moras'?'moras':category==='own'?`particles_${element}`:otherResource(),amount:category==='primogems'?'500':category==='moras'?'20000':category==='own'?'300':'100'};
  };
  // Empty chances grow with depletion; an unopened chest never consumes stock.
  const rewards=Array.from({length:3},()=>random()<.03+.65*total/1000?empty:useful());
  if(rewards.every(reward=>reward.category==='empty'))rewards[Math.floor(random()*3)]=useful();
  return rewards;
}
