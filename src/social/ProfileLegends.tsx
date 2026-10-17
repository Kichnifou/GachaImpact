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
  for (const columns of [3,2,1]) if ((width-(columns-1)*12)/columns >= Math.min(width,270) && cardHeights[columns-1] <= height-footerHeight-10) return columns
  return 1
}

type LegendData = Extract<NonNullable<Profile['legends']>, { access: 'ALLOWED' }>['data']
const themes = Object.entries(stats) as [keyof typeof stats, string][]
const victories = (count: string) => `${count} ${BigInt(count) <= 1n ? 'victoire' : 'victoires'}`
const participations = (count: string) => `${count} ${BigInt(count) <= 1n ? 'participation' : 'participations'}`

function LegendCard({ character, data, box }: { character: LegendData['characters'][number]; data: LegendData; box: Profile['box'] }) {
  const legend = data.legends.find(item => item.character.id === character.id)
  const portrait = box.access === 'ALLOWED' ? box.data.find(item => item.id === character.id)?.iconPath : null
  return <article className="panel profile-legend">
    <header><CharacterPortraitFrame characterName={character.name} element={legend?.character.elementKey ?? 'unknown'} assetPaths={[portrait ?? null]} frameClassName="profile-legend-portrait" imageClassName="profile-legend-image"/><div><h2>{character.name}</h2></div></header>
    {legend ? <>
      <dl className="profile-legend-themes">{themes.map(([key, label]) => {
        const theme = legend.themes[contestStatThemes[key]]
        return <div key={key} data-legend-theme={key}>
          <dt>{label}</dt><dd className="profile-legend-score">{legend.stats[key]} / 20</dd>
          <dd className="profile-legend-title">{theme.title && theme.titleRank > 0 ? <ContestTitleBadge title={theme.title} rank={theme.titleRank}/> : <span className="profile-legend-no-title">Sans titre</span>}</dd>
          <dd className="profile-legend-wins">{victories(theme.wins)}</dd>
          <dd className="profile-legend-size-reserve" aria-hidden="true"><dl>
            <dt>{label}</dt><dd className="profile-legend-score">{legend.stats[key]} / 20</dd>
            <dd className="profile-legend-title">{theme.title && theme.titleRank > 0 ? <ContestTitleBadge title={theme.title} rank={theme.titleRank}/> : <span className="profile-legend-no-title">Sans titre</span>}</dd>
            <dd className="profile-legend-legacy-wins">{theme.wins} / {theme.participations} victoires</dd>
          </dl></dd>
        </div>
      })}<div className="profile-legend-totals"><dt className="profile-legend-totals-label">Résultats de la Légende</dt><dd><span>{participations(legend.totals.contests)}</span><span>{victories(legend.totals.wins)}</span></dd></div></dl>
    </> : <p>Les statistiques de cette Légende sont privées.</p>}
  </article>
}

function LegendPages({ data, box }: { data: LegendData; box: Profile['box'] }) {
  const viewport = useRef<HTMLElement>(null), probe = useRef<HTMLDivElement>(null), footer = useRef<HTMLElement>(null), page = useRef<HTMLDivElement>(null)
  const [capacity, setCapacity] = useState(1), [anchor, setAnchor] = useState(0)
  const pages = Math.max(1, Math.ceil(data.characters.length / capacity)), current = Math.min(Math.floor(anchor / capacity), pages - 1)
  useLayoutEffect(() => {
    const node = viewport.current, measurement = probe.current
    if (!node || !measurement) return
    let active = true
    const measure = () => {
      if (!active || !node.clientWidth || !node.clientHeight) return
      const navHeight = footer.current?.querySelector('nav')?.getBoundingClientRect().height ?? 36
      const heights = [1, 2, 3].map(columns => {
        measurement.style.width = Math.max(1, (node.clientWidth - (columns - 1) * 12) / columns) + 'px'
        // Every measurement includes all five themes, titles and counters.
        return Math.max(1, ...Array.from(measurement.children, card => card.getBoundingClientRect().height))
      })
      setCapacity(legendPageCapacity(node.clientWidth, node.clientHeight, heights, navHeight))
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node)
    if (footer.current) observer?.observe(footer.current)
    if (page.current) for (const card of Array.from(page.current.children)) observer?.observe(card)
    window.addEventListener('resize', measure)
    node.addEventListener('load', measure, true)
    document.fonts?.addEventListener('loadingdone', measure)
    void document.fonts?.ready.then(measure)
    return () => { active = false; observer?.disconnect(); window.removeEventListener('resize', measure); node.removeEventListener('load', measure, true); document.fonts?.removeEventListener('loadingdone', measure) }
  }, [data, box, current])
  return <section ref={viewport} className="profile-legends-paged" aria-label="Légendes C6">
    <div ref={page} className="profile-legends-page" style={{ gridTemplateColumns: 'repeat(' + capacity + ',minmax(0,1fr))' }}>{data.characters.slice(current * capacity, (current + 1) * capacity).map(character => <LegendCard key={character.id} character={character} data={data} box={box}/>)}</div>
    <footer ref={footer} className="profile-legends-pagination">
      <nav aria-label="Pages des Légendes"><AppButton variant="icon" aria-label="Légendes précédentes" disabled={current === 0} onClick={() => { setAnchor((current - 1) * capacity) }}>‹</AppButton><span role="status">{current + 1} / {pages}</span><AppButton variant="icon" aria-label="Légendes suivantes" disabled={current === pages - 1} onClick={() => { setAnchor((current + 1) * capacity) }}>›</AppButton></nav>
    </footer>
    <div ref={probe} className="profile-legends-measure" aria-hidden="true" inert>{data.characters.map(character => <LegendCard key={character.id} character={character} data={data} box={box}/>)}</div>
  </section>
}
