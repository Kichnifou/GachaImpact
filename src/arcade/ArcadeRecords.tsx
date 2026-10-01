import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getGameApiClient } from '../api/game-api'
import { arcadeDifficulties, arcadeGames, type ArcadeGame, type ArcadeDifficulty, type ArcadeRanking, type ArcadeRecord } from '../api/arcade-types'
import { apiErrorMessage } from '../utils/formatters'
import AppButton from '../components/AppButton'
import ModalCloseButton from '../components/ModalCloseButton'
import { useModalDialog } from '../components/useModalDialog'
import { arcadeLabels, difficultyLabels, outcomeLabels, scoreText } from './presentation'

export default function ArcadeRecords({ records, initialGame, onClose }: { records: ArcadeRecord[]; initialGame: ArcadeGame; onClose: () => void }) {
  const [tab, setTab] = useState<'PERSONAL' | 'GLOBAL' | 'SCORE'>('PERSONAL')
  const [game, setGame] = useState<ArcadeGame | 'TOTAL'>(initialGame)
  const [difficulty, setDifficulty] = useState<ArcadeDifficulty>('MEDIUM')
  const [page, setPage] = useState<number | undefined>(undefined)
  const [refresh, setRefresh] = useState(0)
  const [value, setValue] = useState<ArcadeRanking | null>(null)
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const request = useRef(0), pageRef = useRef<number | undefined>(undefined)
  const dialog = useModalDialog<HTMLElement>(onClose)
  useEffect(() => {
    if (tab === 'PERSONAL') return
    const token = ++request.current
    setPending(true); setError('')
    void getGameApiClient().getArcadeRecords({ kind: tab, game, difficulty, page: page ?? pageRef.current }).then(next => {
      if (token !== request.current) return
      setValue(next); pageRef.current = next.page
    }).catch(reason => { if (token === request.current) setError(apiErrorMessage(reason)) }).finally(() => { if (token === request.current) setPending(false) })
    return () => { request.current++ }
  }, [tab, game, difficulty, page, refresh])
  const resetCategory = () => { pageRef.current = undefined; setPage(undefined); setValue(null) }
  return createPortal(<div className="arcade-records-overlay" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialog} tabIndex={-1} className="arcade-records panel" role="dialog" aria-modal="true" aria-label="Records Arcade">
      <header><div><span className="eyebrow">Arcade</span><h2>Records</h2></div><ModalCloseButton onClose={onClose} /></header>
      <div className="arcade-record-controls">
        <nav aria-label="Types de records">{(['PERSONAL', 'GLOBAL', 'SCORE'] as const).map(key => <AppButton key={key} aria-pressed={tab === key} onClick={() => { if (tab === key) return; setTab(key); if (game === 'TOTAL' && key !== 'SCORE') setGame(initialGame); resetCategory() }}>{key === 'PERSONAL' ? 'Personnel' : key === 'GLOBAL' ? 'Global' : 'Score'}</AppButton>)}</nav>
        {tab === 'SCORE' ? <nav className="arcade-score-tabs" aria-label="Classement de score">{([...arcadeGames, 'TOTAL'] as const).map(key => <AppButton key={key} aria-pressed={game === key} onClick={() => { if (game === key) return; setGame(key); resetCategory() }}>{key === 'TOTAL' ? 'Total' : arcadeLabels[key]}</AppButton>)}</nav>
          : <div className="arcade-record-filters"><label>Jeu<select value={game} onChange={event => { setGame(event.target.value as ArcadeGame); resetCategory() }}>{arcadeGames.map(key => <option key={key} value={key}>{arcadeLabels[key]}</option>)}</select></label>
            <label>Difficulté<select value={difficulty} onChange={event => { setDifficulty(event.target.value as ArcadeDifficulty); resetCategory() }}>{arcadeDifficulties.map(key => <option key={key} value={key}>{difficultyLabels[key]}</option>)}</select></label></div>}
      </div>
      <div className="arcade-record-body" aria-busy={pending}>
        {error && <p role="alert">{error}</p>}
        {tab === 'PERSONAL' ? (() => {
          const record = records.find(row => row.game === game && row.difficulty === difficulty)
          return record ? <dl className="arcade-personal"><div><dt>Meilleure partie</dt><dd>{record.best.points} points · {outcomeLabels[record.best.outcome]}</dd></div>
            {record.best.pairs !== null && <div><dt>Paires de la meilleure partie</dt><dd>{record.best.pairs} / {record.best.totalPairs} paires</dd></div>}
            <div><dt>Score cumulé · toutes difficultés</dt><dd>{scoreText(records.filter(row => row.game === game).reduce((sum, row) => sum + BigInt(row.score), 0n).toString())}</dd></div>
            <div><dt>Score cumulé · {difficultyLabels[difficulty]}</dt><dd>{scoreText(record.score)}</dd></div><div><dt>Parties terminées</dt><dd>{scoreText(record.played)}</dd></div>
            <div><dt>Victoires / égalités / défaites</dt><dd>{scoreText(record.wins)} / {scoreText(record.draws)} / {scoreText(record.losses)}</dd></div></dl> : <p className="arcade-empty">Aucun record pour ce jeu et cette difficulté.</p>
        })() : <><table className="arcade-ranking"><thead><tr><th scope="col">Rang</th><th scope="col">Joueur</th><th scope="col">{tab === 'SCORE' ? 'Score' : 'Meilleure partie'}</th></tr></thead>
          <tbody>{value?.entries.map(row => <tr key={row.playerId} className={row.isSelf ? 'self' : ''}><td>{row.rank}</td><td>{row.displayName}{row.isSelf && <strong className="arcade-you">Vous</strong>}</td>
            <td>{scoreText(row.value)}{row.pairs !== null && <small>{row.pairs} / {row.totalPairs} paires</small>}</td></tr>)}
            {Array.from({ length: 10 - (value?.entries.length ?? 0) }, (_, index) => <tr className="arcade-ranking-placeholder" key={`empty-${index}`} aria-hidden="true"><td colSpan={3}>&nbsp;</td></tr>)}
          </tbody></table></>}
      </div>
      <footer><span aria-live="polite">{tab === 'PERSONAL' ? 'Les parties interrompues ne comptent pas.' : pending ? 'Chargement…' : value?.selfStatus === 'NOT_PUBLIC' ? 'Non classé : vos statistiques ne sont pas publiques.' : value?.selfStatus === 'NOT_ELIGIBLE' ? 'Non classé : aucune partie terminée dans cette catégorie.' : `Votre page : ${value?.selfPage ?? '—'}`}</span>
        {tab !== 'PERSONAL' && <div className="arcade-pagination"><AppButton disabled={pending || !value || value.page <= 1} onClick={() => setPage(value!.page - 1)}>Précédent</AppButton>
          <span>{value?.page ?? 1} / {value?.totalPages ?? 1}</span><AppButton disabled={pending || !value || value.page >= value.totalPages} onClick={() => setPage(value!.page + 1)}>Suivant</AppButton>
          <AppButton disabled={pending} onClick={() => setRefresh(count => count + 1)}>Actualiser</AppButton></div>}
      </footer>
    </section>
  </div>, document.body)
}
