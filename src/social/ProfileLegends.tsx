import CharacterPortraitFrame from '../components/CharacterPortraitFrame'
import type { Profile } from './types'
import './profile-legends.css'

const stats = { strength: 'Force', intelligence: 'Intelligence', beauty: 'Beauté', charisma: 'Charisme', popularity: 'Popularité' } as const
const themes = { STRENGTH: 'Force', INTELLIGENCE: 'Intelligence', BEAUTY: 'Beauté', CHARISMA: 'Charisme', POPULARITY: 'Popularité' } as const

export default function ProfileLegends({ value, box }: { value: Profile['legends']; box: Profile['box'] }) {
  if (!value || value.access === 'PRIVATE') return <p>Ces informations sont privées.</p>
  if (!value.data.characters.length) return <p>Aucune Légende C6 possédée pour le moment.</p>
  return <section className="profile-legends-grid" aria-label="Légendes C6">{value.data.characters.map(character => {
    const legend = value.data.legends.find(item => item.character.id === character.id)
    const portrait = box.access === 'ALLOWED' ? box.data.find(item => item.id === character.id)?.iconPath : null
    return <article className="panel profile-legend" key={character.id}>
      <header><CharacterPortraitFrame characterName={character.name} element={legend?.character.elementKey ?? 'unknown'} assetPaths={[portrait ?? null]} frameClassName="profile-legend-portrait" imageClassName="profile-legend-image" /><div><h2>{character.name}</h2><span>C6 · Légende</span></div></header>
      {legend ? <>
        <dl className="profile-legend-stats">{Object.entries(stats).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{legend.stats[key as keyof typeof stats]} / 20</dd></div>)}</dl>
        <p>{legend.totals.contests} participations · {legend.totals.wins} victoires</p>
        <ul className="profile-legend-titles">{Object.entries(legend.themes).map(([key, theme]) => <li key={key}><span>{themes[key as keyof typeof themes]}</span><strong data-rank={theme.titleRank}>{theme.title ?? 'Sans titre'}</strong><small>{theme.wins} / {theme.participations} victoires</small></li>)}</ul>
      </> : <p>Les statistiques de cette Légende sont privées.</p>}
    </article>
  })}</section>
}
