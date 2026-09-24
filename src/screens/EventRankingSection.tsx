import { useEffect, useState } from 'react'

import type { EventRankingDto } from '../api/types'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'
import { useLatestRef } from '../hooks/use-latest-ref'

type Props = Readonly<{ editionId: string; onLoad?: () => Promise<EventRankingDto> }>

export default function EventRankingSection({ editionId, onLoad }: Props) {
  const [ranking, setRanking] = useState<EventRankingDto | null>(null)
  const [error, setError] = useState('')
  const loadRef = useLatestRef(onLoad)
  const loadAvailable = Boolean(onLoad)

  useEffect(() => {
    if (!loadRef.current) return
    let active = true
    let inFlight = false
    let timer: number | undefined
    const refresh = async () => {
      if (!active || document.visibilityState !== 'visible' || inFlight) return
      inFlight = true
      try {
        const next = await loadRef.current!()
        if (active && next.editionId === editionId) { setRanking(next); setError('') }
      } catch (reason) {
        if (active) setError(apiErrorMessage(reason))
      } finally {
        inFlight = false
        if (active && document.visibilityState === 'visible') timer = window.setTimeout(() => void refresh(), 3_000)
      }
    }
    const wake = () => {
      window.clearTimeout(timer)
      if (document.visibilityState === 'visible') void refresh()
    }
    void refresh()
    window.addEventListener('focus', wake)
    document.addEventListener('visibilitychange', wake)
    return () => { active = false; window.clearTimeout(timer); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake) }
  }, [editionId, loadAvailable, loadRef])

  const current = ranking?.editionId === editionId ? ranking : null

  return <section className="panel event-ranking" aria-label="Classement du Festival">
    <header><div><span className="eyebrow">Édition en cours</span><h2>Classement du Festival</h2></div><span className="event-ranking-honor">Classement honorifique</span></header>
    <p>Les dix premiers participants, classés selon leurs points. Aucune récompense n’est associée au rang.</p>
    {error && <p role="alert">{error}</p>}
    {!current && !error && <p>Chargement du classement…</p>}
    {current?.entries.length === 0 && <p>Aucun participant inscrit pour cette édition.</p>}
    {current && current.entries.length > 0 && <ol className="event-ranking-list">{current.entries.map((entry) => <li key={entry.playerId}><span className="event-ranking-rank">#{entry.rank}</span><strong>{entry.displayName}</strong><span>{formatResourceAmount(String(entry.points))} point{entry.points > 1 ? 's' : ''}</span></li>)}</ol>}
  </section>
}
