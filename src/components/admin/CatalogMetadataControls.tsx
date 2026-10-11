import { useEffect, useState } from 'react'
import { getGameApiClient } from '../../api/game-api'
import { catalogValue, catalogWeapons } from './catalog-presentation'

export function CatalogWeaponSelect({value,onChange,disabled=false,empty='Non renseigné'}:{value:string;onChange:(value:string)=>void;disabled?:boolean;empty?:string}) {
  return <select aria-label="Arme" value={String(catalogValue('weapon',value))} disabled={disabled} onChange={event=>onChange(event.target.value)}><option value="">{empty}</option>{catalogWeapons.map(weapon=><option key={weapon} value={weapon}>{weapon}</option>)}</select>
}
export function CatalogRegionSelect({value,current,onChange,disabled=false,empty='Non renseignée'}:{value:string;current?:string;onChange:(value:string)=>void;disabled?:boolean;empty?:string}) {
  const [regions,setRegions]=useState<readonly string[]>([]),[adding,setAdding]=useState(false),[error,setError]=useState('')
  useEffect(()=>{let live=true;void getGameApiClient().getAdminCharacterOptions().then(result=>{if(live)setRegions(result.regions)}).catch(()=>{if(live)setError('Choix des régions indisponibles. Réessayez en rouvrant la fiche.')});return()=>{live=false}},[])
  const options=[...new Set([...regions,...[current,value].filter((region):region is string=>Boolean(region))])].sort((a,b)=>a.localeCompare(b,'fr'))
  return <><select aria-label="Région" value={adding?'__add__':value} disabled={disabled} onChange={event=>{const add=event.target.value==='__add__';setAdding(add);if(!add)onChange(event.target.value)}}><option value="">{empty}</option>{options.map(region=><option key={region} value={region}>{region}</option>)}<option value="__add__">Ajouter une région…</option></select>{adding&&<input aria-label="Nouvelle région" maxLength={100} value={value} disabled={disabled} onChange={event=>onChange(event.target.value)} placeholder="Nom de la région"/>}{error&&<small role="alert">{error}</small>}</>
}
