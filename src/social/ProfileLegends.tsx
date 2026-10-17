import { useLayoutEffect, useRef, useState } from 'react'
import CharacterPortraitFrame from '../components/CharacterPortraitFrame'
import AppButton from '../components/AppButton'
import ContestTitleBadge, { contestStatThemes } from '../contest/ContestTitleBadge'
import type { Profile } from './types'
import './profile-legends.css'

const stats = { strength: 'Force', intelligence: 'Intelligence', beauty: 'Beauté', charisma: 'Charisme', popularity: 'Popularité' } as const
export default function ProfileLegends({ value, box }: { value: Profile['legends']; box: Profile['box'] }) {
  if (!value || value.access === 'PRIVATE') return <p>Ces informations sont privées.</p>
  if (!value.data.characters.length) return <p>Aucune Légende C6 possédée pour le moment.</p>
  return <LegendPages key={value.data.characters.map(row => row.id).join(':')} data={value.data} box={box} />
}

export function legendPageCapacity(width: number, height: number, cardHeight: number) {
  return width <= 700 ? 1 : Math.max(1, Math.floor((height - 40 + 8) / (cardHeight + 8)))
}

function LegendPages({ data, box }: { data: Extract<NonNullable<Profile['legends']>, {access:'ALLOWED'}>['data']; box: Profile['box'] }) {
  const viewport = useRef<HTMLElement>(null), probe = useRef<HTMLDivElement>(null)
  const [capacity, setCapacity] = useState(1), [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(data.characters.length / capacity)), current = Math.min(page, pages - 1)
  useLayoutEffect(() => {
    const node = viewport.current, measurement = probe.current
    if (!node || !measurement) return
    const measure = () => {
      if (!node.clientWidth || !node.clientHeight) return
      measurement.style.width = `${node.clientWidth}px`
      const cardHeight = Math.max(1, ...Array.from(measurement.children).map(child => child.getBoundingClientRect().height))
      setCapacity(legendPageCapacity(node.clientWidth, node.clientHeight, cardHeight))
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node); observer?.observe(measurement)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [data])
  const card = (character: typeof data.characters[number]) => {
    const legend = data.legends.find(item => item.character.id === character.id)
    const portrait = box.access === 'ALLOWED' ? box.data.find(item => item.id === character.id)?.iconPath : null
    return <article className="panel profile-legend" key={character.id}>
      <header><CharacterPortraitFrame characterName={character.name} element={legend?.character.elementKey ?? 'unknown'} assetPaths={[portrait ?? null]} frameClassName="profile-legend-portrait" imageClassName="profile-legend-image" /><div><h2>{character.name} <small>C6</small></h2>{legend && <p>{legend.totals.contests} participations · {legend.totals.wins} victoires</p>}</div></header>
      {legend ? <>
        <dl className="profile-legend-stats">{(Object.entries(stats) as [keyof typeof stats,string][]).map(([key, label]) => {
          const theme = legend.themes[contestStatThemes[key]]
          return <div key={key}><dt><span>{label}</span><small>{theme.wins} / {theme.participations} victoires</small></dt><dd>{legend.stats[key]} / 20</dd><ContestTitleBadge title={theme.title} rank={theme.titleRank} /></div>
        })}</dl>
      </> : <p>Les statistiques de cette Légende sont privées.</p>}
    </article>
  }
  return <section ref={viewport} className="profile-legends-paged" aria-label="Légendes C6">
    <div className="profile-legends-page">{data.characters.slice(current * capacity, (current + 1) * capacity).map(card)}</div>
    <nav className="profile-legends-pagination" aria-label="Pages des Légendes"><AppButton variant="icon" aria-label="Légendes précédentes" disabled={current === 0} onClick={() => setPage(current - 1)}>‹</AppButton><span role="status">{current + 1} / {pages}</span><AppButton variant="icon" aria-label="Légendes suivantes" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>›</AppButton></nav>
    <div ref={probe} className="profile-legends-measure" aria-hidden="true" inert>{data.characters.map(card)}</div>
  </section>
}
