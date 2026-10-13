import { useEffect, useState } from 'react'

import type { EventRankingPageDto } from '../api/types'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'
import { useLatestRef } from '../hooks/use-latest-ref'
import AppButton from '../components/AppButton'
import '../event/event-ranking-layout.css'

type Props = Readonly<{ editionId: string; onLoad?: (page: number, editionId: string) => Promise<EventRankingPageDto> }>

export default function EventRankingSection({ editionId, onLoad }: Props) {
  const [ranking, setRanking] = useState<EventRankingPageDto | null>(null)
  const [error, setError] = useState('')
  const [selection, setSelection] = useState({ editionId, page: 1 })
  const page = selection.editionId === editionId ? selection.page : 1
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
        const next = await loadRef.current!(page, editionId)
        if (active && next.editionId === editionId) {
          setRanking(next); setError('')
          if (next.page !== page) setSelection({ editionId, page: next.page })
        }
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
  }, [editionId, page, loadAvailable, loadRef])

  const current = ranking?.editionId === editionId && ranking.page === page ? ranking : null

  return <section data-tutorial-anchor="event-ranking" data-tutorial-state={!current && !error && loadAvailable ? "loading" : undefined} className="panel event-ranking" aria-label="Classement du Festival">
    <header><div><span className="eyebrow">Édition en cours</span><h2>Classement du Festival</h2></div><span data-tutorial-anchor="event-ranking" className="event-ranking-honor">Classement honorifique</span></header>
    {error && <p role="alert">{error}</p>}
    {!current && !error && <p>Chargement du classement…</p>}
    {current?.entries.length === 0 && <p>Aucun participant inscrit pour cette édition.</p>}
    {current && current.entries.length > 0 && <ol className="event-ranking-list">{current.entries.map((entry) => <li key={entry.playerId}><span className="event-ranking-rank">#{entry.rank}</span><strong>{entry.displayName}</strong><span>{formatResourceAmount(String(entry.points))} point{entry.points > 1 ? 's' : ''}</span></li>)}</ol>}
    <footer className="event-ranking-pagination">
      <span>{current?.self ? `Votre rang : #${current.self.rank}` : ''}</span>
      <AppButton aria-label="Classement précédent" disabled={!current || page <= 1} onClick={() => setSelection({ editionId, page: page - 1 })}>‹</AppButton>
      <span aria-live="polite">{page} / {current?.pageCount ?? '…'}</span>
      <AppButton aria-label="Classement suivant" disabled={!current || page >= current.pageCount} onClick={() => setSelection({ editionId, page: page + 1 })}>›</AppButton>
    </footer>
  </section>
}
