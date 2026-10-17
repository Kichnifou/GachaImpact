import { useLayoutEffect, useRef, useState } from 'react'
import CharacterPortraitFrame from '../components/CharacterPortraitFrame'
import AppButton from '../components/AppButton'
import ContestTitleBadge, { contestStatThemes } from '../contest/ContestTitleBadge'
import type { Profile } from './types'
import './profile-legends.css'

const stats = { strength:'Force', intelligence:'Intelligence', beauty:'Beauté', charisma:'Charisme', popularity:'Popularité' } as const
export default function ProfileLegends({ value, box }: { value: Profile['legends']; box: Profile['box'] }) {
  if (!value || value.access === 'PRIVATE') return <p>Ces informations sont privées.</p>
  if (!value.data.characters.length) return <p>Aucune Légende C6 possédée pour le moment.</p>
  return <LegendPages key={value.data.characters.map(row => row.id).join(':')} data={value.data} box={box}/>
}

export function legendPageCapacity(width:number, height:number, cardHeights:readonly number[], footerHeight=32) {
  for (const columns of [3,2,1]) if ((width-(columns-1)*12)/columns >= Math.min(width,270) && cardHeights[columns-1] <= height-footerHeight-8) return columns
  return 1
}

function LegendPages({ data, box }: { data:Extract<NonNullable<Profile['legends']>,{access:'ALLOWED'}>['data']; box:Profile['box'] }) {
  const viewport=useRef<HTMLElement>(null), probe=useRef<HTMLDivElement>(null), footer=useRef<HTMLElement>(null)
  const [layout,setLayout]=useState({capacity:1,compact:false}), [anchor,setAnchor]=useState(0)
  const {capacity,compact}=layout
  const pages=Math.max(1,Math.ceil(data.characters.length/capacity)),current=Math.min(Math.floor(anchor/capacity),pages-1)
  useLayoutEffect(()=>{
    const node=viewport.current,measurement=probe.current
    if(!node||!measurement)return
    const measure=()=>{
      if(!node.clientWidth||!node.clientHeight)return
      if(window.innerWidth<=1120){setLayout(previous=>previous.capacity===1&&!previous.compact?previous:{capacity:1,compact:false});return}
      const footerHeight=footer.current?.getBoundingClientRect().height??32
      for(const dense of [false,true]){
        measurement.dataset.density=dense?'compact':'normal'
        const heights=[1,2,3].map(columns=>{
          measurement.style.width=Math.max(1,(node.clientWidth-(columns-1)*12)/columns)+'px'
          return Math.max(1,...Array.from(measurement.children).map(child=>child.getBoundingClientRect().height))
        })
        const capacity=legendPageCapacity(node.clientWidth,node.clientHeight,heights,footerHeight)
        if(heights[capacity-1]<=node.clientHeight-footerHeight-8||dense){
          setLayout(previous=>previous.capacity===capacity&&previous.compact===dense?previous:{capacity,compact:dense});return
        }
      }
    }
    measure()
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure)
    observer?.observe(node);if(footer.current)observer?.observe(footer.current)
    window.addEventListener('resize',measure)
    return()=>{observer?.disconnect();window.removeEventListener('resize',measure)}
  },[data])
  const card=(character:typeof data.characters[number])=>{
    const legend=data.legends.find(item=>item.character.id===character.id)
    const portrait=box.access==='ALLOWED'?box.data.find(item=>item.id===character.id)?.iconPath:null
    return <article className="panel profile-legend" key={character.id}>
      <header><CharacterPortraitFrame characterName={character.name} element={legend?.character.elementKey??'unknown'} assetPaths={[portrait??null]} frameClassName="profile-legend-portrait" imageClassName="profile-legend-image"/><div><h2>{character.name}</h2><span>C6 · Légende</span></div></header>
      {legend?<>
        <dl className="profile-legend-stats">{(Object.entries(stats) as [keyof typeof stats,string][]).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{legend.stats[key]} / 20</dd></div>)}</dl>
        <p>{legend.totals.contests} participations · {legend.totals.wins} victoires</p>
        <ul className="profile-legend-titles">{(Object.entries(stats) as [keyof typeof stats,string][]).map(([key,label])=>{
          const theme=legend.themes[contestStatThemes[key]]
          return <li key={key}><span>{label}</span>{theme.title&&theme.titleRank>0?<ContestTitleBadge title={theme.title} rank={theme.titleRank}/>:<small className="profile-legend-no-title">Sans titre</small>}<small className="profile-legend-wins">{theme.wins} / {theme.participations} victoires</small></li>
        })}</ul>
      </>:<p>Les statistiques de cette Légende sont privées.</p>}
    </article>
  }
  return <section ref={viewport} className="profile-legends-paged" data-density={compact?'compact':'normal'} aria-label="Légendes C6">
    <div className="profile-legends-page" style={{gridTemplateColumns:'repeat('+capacity+',minmax(0,1fr))'}}>{data.characters.slice(current*capacity,(current+1)*capacity).map(card)}</div>
    <nav ref={footer} className="profile-legends-pagination" aria-label="Pages des Légendes"><AppButton variant="icon" aria-label="Légendes précédentes" disabled={current===0} onClick={()=>setAnchor((current-1)*capacity)}>‹</AppButton><span role="status">{current+1} / {pages}</span><AppButton variant="icon" aria-label="Légendes suivantes" disabled={current===pages-1} onClick={()=>setAnchor((current+1)*capacity)}>›</AppButton></nav>
    <div ref={probe} className="profile-legends-measure" aria-hidden="true" inert>{data.characters.map(card)}</div>
  </section>
}
