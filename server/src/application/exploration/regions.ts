import type { Prisma } from '../../../generated/prisma/client.js';
import { normalizeRegion } from '../character-catalog/catalog-metadata.js';
const names:Readonly<Record<string,string>>={mondstadt:'Mondstadt',liyue:'Liyue',inazuma:'Inazuma',sumeru:'Sumeru',fontaine:'Fontaine',natlan:'Natlan',snezhnaya:'Snezhnaya',nodkrai:'Nod-Krai',espace:'Espace',space:'Espace',celestia:'Celestia'};
export function explorationRegion(value:string):{key:string;name:string}|null {
  const normalized=normalizeRegion(value),alias=normalized.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[\s_–—-]+/g,'');
  if(alias==='horizon')return null;
  const name=names[alias]??normalized;
  return {key:name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[\s_–—-]+/g,''),name};
}
/** Characters is the published canonical table; candidates/dry runs are excluded. */
export async function activeExplorationRegions(tx:Pick<Prisma.TransactionClient,'character'>) {
  const rows=await tx.character.findMany({where:{isActive:true,region:{not:null}},select:{region:true},orderBy:{region:'asc'},distinct:['region']});
  const regions=new Map<string,{key:string;name:string}>();
  for(const row of rows){const value=explorationRegion(row.region!);if(value&&!regions.has(value.key))regions.set(value.key,value);}
  return [...regions.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr'));
}
