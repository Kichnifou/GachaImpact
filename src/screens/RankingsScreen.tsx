import { useEffect, useState } from 'react'
import type { RankingPageDto } from '../api/types'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { apiErrorMessage } from '../utils/formatters'
import './rankings.css'

const categoryLabels = { PROGRESSION: 'Progression', GACHA: 'Gacha', RESSOURCES: 'Ressources', COLLECTION: 'Collection', ACTIVITE: 'Activité' } as const
type Props = { onLoad: (metric: string, page: number) => Promise<RankingPageDto>; onProfile: (playerId: string) => void }
export default function RankingsScreen({ onLoad, onProfile }: Props) {
  const [metric, setMetric] = useState('xp')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<RankingPageDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { let active = true; void onLoad(metric, page).then(value => { if (active) setData(value) }).catch(reason => { if (active) setError(apiErrorMessage(reason)) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [metric, page, onLoad])
  const category = data?.metrics.find(item => item.id === metric)?.category ?? 'PROGRESSION'
  const visibleData = !error && data?.metric.id === metric && data.page === page ? data : null
  const choose = (next: string) => { setLoading(true); setError(null); setMetric(next); setPage(1) }
  const turnPage = (next: number) => { setLoading(true); setError(null); setPage(next) }
  return <div className="screen-content rankings-screen long-screen-layout">
    <ScreenHeader eyebrow="Communauté" title="Classements" description="Classements publics en direct, sans saison ni récompense." />
    <ScrollableScreenPanel className="rankings-frame" bodyClassName="rankings-body" fixed={<div className="rankings-controls">
      <div className="rankings-categories" role="tablist" aria-label="Catégories des classements">{data?.categories.map(item => <button key={item} type="button" role="tab" aria-selected={category === item} className={category === item ? 'active' : ''} onClick={() => choose(data.metrics.find(metric => metric.category === item)?.id ?? 'xp')}>{categoryLabels[item]}</button>)}</div>
      <label>Métrique <select value={metric} onChange={event => choose(event.target.value)}>{data?.metrics.filter(item => item.category === category).map(item => <option key={item.id} value={item.id}>{item.label}</option>) ?? <option value="xp">XP</option>}</select></label>
    </div>}>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Chargement des classements…</p>}
      {!loading && visibleData && <>
        <h2>{visibleData.metric.label}</h2>
        {visibleData.entries.length ? <ol className="rankings-list" start={(visibleData.page - 1) * visibleData.pageSize + 1}>{visibleData.entries.map(entry => <li key={entry.playerId} className={`${entry.isSelf ? 'self' : ''} ${entry.rank <= 3 ? 'podium' : ''}`}><span className="rankings-rank">#{entry.rank}</span><button type="button" onClick={() => onProfile(entry.playerId)} aria-label={`Voir le profil de ${entry.displayName}`}><span className={`mini-avatar ${entry.elementKey}`} aria-hidden="true">{entry.displayName.slice(0, 1).toUpperCase()}</span>{entry.displayName}</button><strong>{entry.value}</strong></li>)}</ol> : <p>Aucune donnée publique positive pour cette métrique.</p>}
        {visibleData.self && !visibleData.entries.some(entry => entry.isSelf) && <p className="rankings-self">Votre rang : #{visibleData.self.rank} · {visibleData.self.value}</p>}
        {!visibleData.self && <p className="rankings-self">{visibleData.selfStatus === 'NOT_PUBLIC' ? 'Votre donnée n’est pas publique : vous ne participez pas à ce classement.' : 'Vous n’avez pas de rang pour cette métrique : valeur absente, nulle ou critère de participation non rempli.'}</p>}
        <div className="rankings-pages"><button type="button" disabled={page <= 1} onClick={() => turnPage(page - 1)}>Précédent</button><span>Page {page} / {visibleData.totalPages}</span><button type="button" disabled={page >= visibleData.totalPages} onClick={() => turnPage(page + 1)}>Suivant</button></div>
      </>}
    </ScrollableScreenPanel>
  </div>
}
