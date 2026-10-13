import { useEffect, useId, useState } from 'react'
import type { ActivityHistoryDto, ActivityPlayersDto, ActivityRange, ActivityStatisticsDto } from '../api/types'
import { getGameApiClient } from '../api/game-api'
import { apiErrorMessage } from '../utils/formatters'
import AppButton from '../components/AppButton'
import { useModalDialog } from '../components/useModalDialog'
import { createPortal } from 'react-dom'

export const activityRanges: readonly [ActivityRange, string][] = [['5d', '5 derniers jours'], ['10d', '10 derniers jours'], ['1m', '1 mois'], ['3m', '3 mois'], ['6m', '6 mois'], ['1y', '1 an'], ['2y', '2 ans'], ['5y', '5 ans'], ['all', 'Depuis toujours']]
const dateLabel = (date: string, compact = false) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...(compact ? { day: 'numeric', month: 'short' } as const : { dateStyle: 'long' } as const) }).format(new Date(`${date}T12:00:00Z`))
const playerLabel = (count: number) => `${count.toLocaleString('fr-FR')} joueur${count === 1 ? '' : 's'} actif${count === 1 ? '' : 's'}`
const loadPlayers = (date: string, after?: string) => getGameApiClient().getActivityPlayers(date, after)
const loadStatistics = (range: ActivityRange) => getGameApiClient().getActivityStatistics(range)
export type ActivityReaders = { onPlayers?: typeof loadPlayers; onStatistics?: typeof loadStatistics }

function DayPlayers({ date, onPlayers }: { date: string; onPlayers: typeof loadPlayers }) {
  const [value, setValue] = useState<ActivityPlayersDto | null>(null)
  const [after, setAfter] = useState<string | undefined>(), [revision, setRevision] = useState(0)
  const [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    void onPlayers(date, after).then(next => { if (active) setValue(previous => ({ ...next, names: !after ? next.names : [...(previous?.names ?? []), ...next.names] })) })
      .catch(reason => { if (active) setError(apiErrorMessage(reason)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [date, after, revision, onPlayers])
  return <div className="activity-players">
    {value && <>{value.names.length ? <ul>{value.names.map((name, i) => <li key={i}>{name}</li>)}</ul> : <p>Aucun pseudo visible pour cette journée.</p>}
      {value.visibleTotal < value.total && <small>Certains pseudos ne sont pas visibles selon les règles de confidentialité.</small>}
      {value.nextCursor && <AppButton disabled={loading || !!error} onClick={() => { setLoading(true); setError(null); setAfter(value.nextCursor!) }}>Afficher la suite</AppButton>}</>}
    {loading && <p role="status">Chargement des pseudos…</p>}
    {error && <div role="alert"><p>{error}</p><AppButton onClick={() => { setError(null); setLoading(true); setRevision(r => r + 1) }}>Réessayer</AppButton></div>}
  </div>
}

export function ActivityStatisticsModal({ onClose, onStatistics = loadStatistics }: { onClose: () => void; onStatistics?: typeof loadStatistics }) {
  const ref = useModalDialog<HTMLElement>(onClose), titleId = useId()
  const [range, setRange] = useState<ActivityRange>('10d'), [revision, setRevision] = useState(0)
  const [response, setResponse] = useState<{ range: ActivityRange; revision: number; value?: ActivityStatisticsDto; error?: string } | null>(null)
  const [selected, setSelected] = useState(0)
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])
  useEffect(() => {
    let active = true
    void onStatistics(range).then(next => { if (active) { setResponse({ range, revision, value: next }); setSelected(Math.max(0, next.entries.length - 1)) } })
      .catch(reason => { if (active) setResponse({ range, revision, error: apiErrorMessage(reason) }) })
    return () => { active = false }
  }, [range, revision, onStatistics])
  const current = response?.range === range && response.revision === revision ? response : null
  const value = current?.value, error = current?.error
  const rows = value?.range === range ? value.entries : []
  const maximum = Math.max(1, ...rows.map(row => row.count)), ceiling = Math.ceil(maximum / 4) * 4
  const x = (i: number) => rows.length < 2 ? 320 : 48 + i * 544 / (rows.length - 1)
  const y = (count: number) => 216 - count * 180 / ceiling
  const point = rows[Math.min(selected, rows.length - 1)]
  const labels = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])].filter(i => i >= 0)
  return createPortal(<div className="modal-layer activity-statistics-layer" onMouseDown={onClose}><section ref={ref} tabIndex={-1} className="floating-panel activity-statistics-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={e => e.stopPropagation()}>
    <header className="floating-panel-heading"><h2 id={titleId}>Statistiques d'activité</h2><button type="button" className="icon-button" aria-label="Fermer les statistiques" onClick={onClose}>×</button></header>
    <div className="activity-statistics-body"><label className="activity-range">Période<select value={range} onChange={e => setRange(e.target.value as ActivityRange)}>{activityRanges.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
      <div className="activity-chart-region" aria-busy={!current}>
      {error ? <div role="alert"><p>{error}</p><AppButton onClick={() => setRevision(r => r + 1)}>Réessayer</AppButton></div> : !value ? <p role="status">{response ? 'Actualisation des statistiques…' : 'Chargement des statistiques…'}</p> : !rows.length ? <p>Aucune journée couverte dans cette période.</p> : <>
        <svg viewBox="0 0 640 266" role="img" aria-label="Joueurs uniques actifs par journée Europe/Paris" className="activity-chart">
          {[0, 1, 2, 3, 4].map(i => { const count = ceiling * i / 4; return <g key={i}><line x1="48" x2="592" y1={y(count)} y2={y(count)} className="activity-chart-grid" /><text x="38" y={y(count) + 4} textAnchor="end">{count}</text></g> })}
          {rows.length > 1 && <polyline points={rows.map((row, i) => `${x(i)},${y(row.count)}`).join(' ')} className="activity-chart-line" />}
          {rows.map((row, i) => <circle key={row.date} cx={x(i)} cy={y(row.count)} r={rows.length > 100 ? 2 : 4} className="activity-chart-point" onMouseEnter={() => setSelected(i)} onClick={() => setSelected(i)}><title>{dateLabel(row.date)} : {playerLabel(row.count)}</title></circle>)}
          {labels.map(i => <text key={i} x={x(i)} y="244" textAnchor={rows.length === 1 ? 'middle' : i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}>{dateLabel(rows[i]!.date, true)}</text>)}
        </svg>
        {point && <><output className="activity-chart-tooltip">{dateLabel(point.date)} : {playerLabel(point.count)}{point.today ? ' · en cours' : ''}</output><label className="activity-chart-selector">Explorer les journées<input type="range" min="0" max={Math.max(0, rows.length - 1)} value={selected} onChange={e => setSelected(Number(e.target.value))} aria-valuetext={`${dateLabel(point.date)} : ${playerLabel(point.count)}`} /></label></>}
      </>}
      </div>
    </div>
  </section></div>, document.body)
}

export default function ActivityHistory({ value, onPlayers = loadPlayers, onStatistics = loadStatistics }: { value: ActivityHistoryDto } & ActivityReaders) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set()), [statistics, setStatistics] = useState(false)
  const id = useId()
  // Defensive during rolling deployments with the previous history endpoint.
  // Server pagination is independently bounded to covered days in R1081.
  const entries = value.entries.filter(entry => entry.status !== 'UNAVAILABLE' && entry.count !== null)
  return <>
    <div className="activity-introduction"><p>Liste des joueurs actifs par jour.</p><button type="button" className="activity-statistics-link" onClick={() => setStatistics(true)}>Statistiques →</button></div>
    {!entries.length && <p>Collecte indisponible.</p>}
    <ol className="history-list activity-history-list">{entries.map(entry => <li key={entry.date}>
      <strong>{dateLabel(entry.date)}{entry.today ? ' · Aujourd’hui (en cours)' : ''}</strong>
      <button type="button" className="activity-players-toggle" aria-expanded={open.has(entry.date)} aria-controls={`${id}-${entry.date}`} onClick={() => setOpen(previous => { const next = new Set(previous); if (next.has(entry.date)) next.delete(entry.date); else next.add(entry.date); return next })}>{playerLabel(entry.count ?? 0)} <span aria-hidden="true">{open.has(entry.date) ? '▾' : '▸'}</span></button>
      {open.has(entry.date) && <div id={`${id}-${entry.date}`}><DayPlayers date={entry.date} onPlayers={onPlayers} /></div>}
    </li>)}</ol>
    {statistics && <ActivityStatisticsModal onClose={() => setStatistics(false)} onStatistics={onStatistics} />}
  </>
}
