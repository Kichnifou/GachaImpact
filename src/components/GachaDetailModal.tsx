import { useEffect, useState } from 'react'
import type { GachaHistoryDto } from '../api/types'
import { historyDateLabel, historyEventLabel, historyPityLabel, historyProgressionLabel, historyResultLabel } from '../gacha/history-presentation'
import { fiveStarProbabilityRows, fourStarProbabilityRows, probabilityPercent } from '../gacha/probabilities'
import { apiErrorMessage } from '../utils/formatters'
import { passiveEffectLabel } from '../gacha/pull-result-presentation'

type DetailTab = 'history' | 'probabilities' | 'passives'

function GachaDetailModal({ onClose, onGetHistory }: { onClose: () => void; onGetHistory: (page: number) => Promise<GachaHistoryDto> }) {
  const [tab, setTab] = useState<DetailTab>('history')
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState<GachaHistoryDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    if (tab !== 'history') return
    let active = true
    void Promise.resolve().then(async () => {
      if (!active) return
      setLoading(true)
      setError(null)
      try {
        const nextHistory = await onGetHistory(page)
        if (active) setHistory(nextHistory)
      } catch (reason) {
        if (active) setError(apiErrorMessage(reason))
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => { active = false }
  }, [onGetHistory, page, tab])

  return (
    <div className="gacha-detail-overlay" onClick={onClose}>
      <section className="gacha-detail-modal" role="dialog" aria-modal="true" aria-labelledby="gacha-detail-title" onClick={(event) => event.stopPropagation()}>
        <header>
          <div><span>Informations de bannière</span><h2 id="gacha-detail-title">Détail des Invocations</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer le détail"><span className="icon-glyph">×</span></button>
        </header>
        <div className="gacha-detail-tabs" role="tablist" aria-label="Détails de l’Invocation">
          <Tab id="history" active={tab} onSelect={setTab}>Historique</Tab>
          <Tab id="probabilities" active={tab} onSelect={setTab}>Probabilités</Tab>
          <Tab id="passives" active={tab} onSelect={setTab}>Passifs</Tab>
        </div>
        <div className="gacha-detail-content">
          {tab === 'history' && <HistoryPanel history={history} loading={loading} error={error} onPage={setPage} />}
          {tab === 'probabilities' && <ProbabilityPanel />}
          {tab === 'passives' && <PassivesPanel />}
        </div>
      </section>
    </div>
  )
}

function Tab({ id, active, onSelect, children }: { id: DetailTab; active: DetailTab; onSelect: (tab: DetailTab) => void; children: string }) {
  return <button type="button" role="tab" aria-selected={active === id} className={active === id ? 'active' : ''} onClick={() => onSelect(id)}>{children}</button>
}

export function HistoryPanel({ history, loading, error, onPage }: { history: GachaHistoryDto | null; loading: boolean; error: string | null; onPage: (page: number) => void }) {
  if (loading && !history) return <p className="detail-status">Chargement de l’historique…</p>
  if (error) return <p className="detail-status error" role="alert">{error}</p>
  if (!history) return <p className="detail-status">Chargement de l’historique…</p>
  if (history.totalResults === 0) return <p className="detail-status">Aucune Invocation enregistrée.</p>
  return <div className="history-panel">
    <div className="history-table-wrap">
      <table className="gacha-history-table">
        <thead><tr><th>Date</th><th>Résultat</th><th>Rareté</th><th>Pity</th><th>Événement</th><th>Progression</th></tr></thead>
        <tbody>{history.results.map((result) => <tr key={`${result.operationId}-${result.index}`}>
          <td>{historyDateLabel(result.occurredAt)}</td>
          <td>{historyResultLabel(result)}</td>
          <td>{result.resultType === 'resource' ? '3★' : `${result.rarity}★`}</td>
          <td>{historyPityLabel(result)}</td>
          <td>{historyEventLabel(result)}</td>
          <td><span>{historyProgressionLabel(result)}</span>{(result.passiveEffects ?? []).flatMap((effect) => { const label = passiveEffectLabel(effect); return label ? [<small className="history-passive-effect" key={`${effect.elementKey}-${effect.type}`}>{label}</small>] : [] })}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <footer className="history-pagination">
      <button type="button" disabled={!history.hasPrevious || loading} onClick={() => onPage(history.page - 1)}>Précédent</button>
      <span>Page {history.page} / {Math.max(history.totalPages, 1)}</span>
      <button type="button" disabled={!history.hasNext || loading} onClick={() => onPage(history.page + 1)}>Suivant</button>
    </footer>
  </div>
}

function ProbabilityPanel() {
  return <div className="probability-panel">
    <section><h3>Rareté 5★</h3><p>0,6 % du Pull 1 au 73, puis +6 points par Pull à partir du 74. Hard pity au Pull 90.</p><ProbabilityTable rows={fiveStarProbabilityRows} /></section>
    <section><h3>Rareté 4★</h3><p>1,5 % du Pull 1 au 8, 19,5 % au Pull 9 et 100 % au Pull 10.</p><ProbabilityTable rows={fourStarProbabilityRows} /></section>
    <section className="probability-rules"><h3>Résolution et cible</h3><ul>
      <li>Si les jets 5★ et 4★ réussissent ensemble, le 5★ gagne et la pity 4★ ne reset pas.</li>
      <li>Un 5★ naturel donne 50 % de chance à la cible et 50 % à l’un des trois autres 5★, uniformément.</li>
      <li>Une vraie perte active la Garantie pour la cible actuelle ou future. La Garantie est prioritaire sur Capture.</li>
      <li>Capture va de 0 à 3 : perte +1, victoire −1, Garantie sans changement. À 3/3, elle garantit la cible puis revient à 0.</li>
      <li>Sans 4★ ni 5★ : 50 % Moras (5 000–15 000), 50 % Particules (20–80, un élément parmi sept).</li>
    </ul></section>
  </div>
}

function ProbabilityTable({ rows }: { rows: readonly { pity: string; chance: number }[] }) {
  return <table className="probability-table"><thead><tr><th>Pity</th><th>Chance</th></tr></thead><tbody>{rows.map((row) => <tr key={row.pity}><td>{row.pity}</td><td>{probabilityPercent(row.chance)}</td></tr>)}</tbody></table>
}

const passives = [
  ['Pyro', 'Particules secondaires ×1,25', 'Particules secondaires ×1,5'],
  ['Hydro', '+0,3 point de % à la chance 5★', '+0,6 point de %'],
  ['Cryo', '1/20 de gagner +1 XP par Pull', '1/10 de gagner +1 XP par Pull'],
  ['Electro', '1/30 de gagner +2 pity 5★', '1/20 de gagner +2 pity 5★'],
  ['Anemo', '1/12 de récupérer +80 Primogemmes', '1/8 de récupérer +80 Primogemmes'],
  ['Geo', 'Moras secondaires ×1,25', 'Moras secondaires ×1,5'],
  ['Dendro', '1/25 : +40 Primogemmes, +1 000 Moras et +5 particules de chaque élément', '1/15 : mêmes gains'],
] as const

export function PassivesPanel() {
  return <div className="passives-panel">
    <p className="passives-notice">Les passifs de votre Team active sont appliqués à vos Invocations.</p>
    <div className="passives-grid">{passives.map(([element, one, two]) => <article key={element}><h3>{element}</h3><p><strong>1 stack</strong>{one}</p><p><strong>2 stacks</strong>{two}</p></article>)}</div>
  </div>
}

export default GachaDetailModal
