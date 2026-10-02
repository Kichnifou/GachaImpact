import { useTutorialPresentation, useTutorialView, useTutorialPanel } from '../tutorial/tutorial-presentation'
import { useEffect, useState } from 'react'
import { useLatestRef } from '../hooks/use-latest-ref'
import { arcadeDifficulties, arcadeGames, type ArcadeDifficulty, type ArcadeGame, type ArcadeMutation } from '../api/arcade-types'
import AppButton from '../components/AppButton'
import ArcadeBoards from '../arcade/ArcadeBoards'
import ArcadeRecords from '../arcade/ArcadeRecords'
import ArcadeRulesModal from '../arcade/ArcadeRulesModal'
import { ConfirmAction } from '../components/admin/AdminUi'
import { useArcade } from '../arcade/use-arcade'
import { arcadeLabels, difficultyLabels, outcomeLabels, scoreText } from '../arcade/presentation'
import '../arcade/arcade.css'

export type ArcadeScreenProps = { playerId: string; onMutation?: (value: ArcadeMutation, playerId: string) => void; feedbackPending?: boolean }
export default function ArcadeScreen({ playerId, onMutation, feedbackPending = false }: ArcadeScreenProps) {
  const presentation = useTutorialPresentation()
  const guidedRules = useTutorialPanel('arcade-rules'), guidedRecords = useTutorialPanel('arcade-records')
  const arcade = useArcade(playerId, onMutation)
  const [game, setGame] = useState<ArcadeGame>('MEMORY'), [difficulty, setDifficulty] = useState<ArcadeDifficulty>('MEDIUM')
  const [visible, setVisible] = useState(document.visibilityState !== 'hidden'), [recordsOpen, setRecordsOpen] = useState(false), [help, setHelp] = useState(false)
  const [quitSession, setQuitSession] = useState<string | null>(null)
  const guidedGame = useTutorialView('activities-arcade', game, ['MEMORY', 'CONNECT_FOUR', 'TIC_TAC_TOE'])
  const activeSession = arcade.value?.sessions.find(row => row.status === 'ACTIVE')
  const selectedGame = activeSession?.game ?? guidedGame
  const session = activeSession ?? arcade.value?.sessions.find(row => row.game === selectedGame)
  const active = session?.status === 'ACTIVE', actualDifficulty = active ? session.difficulty : difficulty
  const autoAdvance = active && (session.board.turn === 'AI' || session.board.kind === 'MEMORY' && session.board.phase === 'REVEAL')
  const blocked = presentation.active || arcade.pending || arcade.refreshing || arcade.quitting || Boolean(arcade.error) || !visible || feedbackPending || recordsOpen || help || Boolean(quitSession)
  const advance = arcade.act, actionError = arcade.error
  const presentationActive = useLatestRef(presentation.active)
  useEffect(() => { if (feedbackPending) { setRecordsOpen(false); setHelp(false) } }, [feedbackPending])
  const activeGame = activeSession?.game, activeDifficulty = activeSession?.difficulty
  useEffect(() => { if (activeGame && activeDifficulty) { setGame(activeGame); setDifficulty(activeDifficulty) } }, [activeGame, activeDifficulty])
  useEffect(() => {
    if (!session || !autoAdvance || blocked || actionError) return
    const delay = Math.max(750, Date.parse(session.nextActionAt) - Date.now() + 80)
    const timer = window.setTimeout(() => { if (!presentationActive.current && document.visibilityState !== 'hidden') void advance(session) }, delay)
    return () => window.clearTimeout(timer)
  }, [session, autoAdvance, blocked, actionError, advance, presentationActive])
  useEffect(() => {
    const pause = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', pause)
    return () => document.removeEventListener('visibilitychange', pause)
  }, [])
  const daily = arcade.value?.daily.find(row => row.game === selectedGame)
  const status = session?.result ? 'Résultat enregistré' : active ? session.board.kind === 'MEMORY' && session.board.phase === 'REVEAL' ? 'Mémorisez ces deux cartes' : autoAdvance ? 'L’adversaire joue' : 'À vous' : 'Choisissez votre jeu et commencez une partie'
  const pairTotal = difficulty === 'EASY' ? 8 : difficulty === 'MEDIUM' ? 12 : 18
  return <div data-business-pending={arcade.pending || arcade.quitting || feedbackPending} className="screen-content long-screen-layout arcade-screen">
    <h1 className="sr-only">Arcade</h1>
    <div data-tutorial-anchor="arcade-controls" data-tutorial-state={!arcade.value && !arcade.error ? "loading" : undefined} data-tutorial-fallback={activeSession && presentation.step?.view && presentation.step.view !== activeSession.game ? "true" : undefined} className="arcade-controls"><nav aria-label="Jeux Arcade">{arcadeGames.map(key => <AppButton key={key} aria-pressed={selectedGame === key} disabled={Boolean(activeSession)}
      onClick={() => setGame(key)}>{arcadeLabels[key]}</AppButton>)}</nav><label>Difficulté<select value={actualDifficulty} disabled={active || arcade.pending} onChange={event => setDifficulty(event.target.value as ArcadeDifficulty)}>{arcadeDifficulties.map(key => <option key={key} value={key}>{difficultyLabels[key]}</option>)}</select></label></div>
    <div className="arcade-body">
      <section className="arcade-arena panel" aria-label={arcadeLabels[selectedGame]}>
        <div className="arcade-top-actions"><div>{active && <AppButton onClick={() => setQuitSession(session.id)}>Quitter</AppButton>}</div>
          <div><AppButton onClick={() => setHelp(true)} aria-haspopup="dialog">Règles & gains</AppButton><AppButton disabled={!arcade.value || feedbackPending} onClick={() => setRecordsOpen(true)}>Records →</AppButton></div></div>
        <div className="arcade-versus"><div><span className="arcade-player-symbol" aria-hidden="true">●</span><strong>Vous</strong>{session?.board.kind === 'MEMORY' && <small>{session.board.playerPairs} paires</small>}</div>
          <span className="arcade-vs">VS</span><div><span className="arcade-automaton" aria-hidden="true">◇<i>••</i></span><strong>Adversaire</strong>{session?.board.kind === 'MEMORY' && <small>{session.board.aiPairs} paires</small>}</div></div>
        <div data-tutorial-anchor="arcade-board" className="arcade-play-area">{session && session.status !== 'ABANDONED' ? <ArcadeBoards board={session.board} disabled={blocked || !active || autoAdvance || session.board.turn !== 'PLAYER'} onMove={position => { void arcade.act(session, position) }} />
          : <div className={`arcade-ready ${selectedGame.toLowerCase()}`}><span aria-hidden="true">{selectedGame === 'MEMORY' ? '✦' : selectedGame === 'CONNECT_FOUR' ? '● ◆ ●' : '○ ✕'}</span><h2>{arcadeLabels[selectedGame]}</h2><p>{selectedGame === 'MEMORY' ? `${pairTotal * 2} cartes · ${pairTotal} paires · des portraits à retrouver` : selectedGame === 'CONNECT_FOUR' ? '7 colonnes · 6 lignes · quatre jetons à aligner' : '9 cases · trois symboles à aligner'}</p></div>}</div>
        <aside className="arcade-banter">« {session?.status !== 'ABANDONED' && session?.banter.text || 'Trois jeux, à votre rythme.'} »</aside>
        <div className="arcade-status" aria-live="polite"><strong>{status}</strong>{session?.status !== 'ABANDONED' && session?.board.kind === 'MEMORY' && <span>{session.board.remainingPairs} paires restantes</span>}</div>
        <div className="arcade-result" aria-live="polite">{session?.result && <><strong>{outcomeLabels[session.result.outcome]} · {difficultyLabels[session.difficulty]}</strong><span>+{session.result.scoreAwarded} score · +{session.result.xpAwarded} XP</span></>}</div>
        <div className="arcade-actions">{!active && <AppButton variant="primary" disabled={!arcade.value || blocked} onClick={() => void arcade.start(selectedGame, difficulty)}>{arcade.pending ? 'En cours…' : session ? 'Rejouer' : 'Commencer'}</AppButton>}
          {arcade.error && <AppButton disabled={arcade.pending || arcade.quitting} onClick={() => void arcade.load()}>Actualiser</AppButton>}</div>
        <div className="arcade-error" role={arcade.error ? 'alert' : undefined}>{arcade.error}</div>
      </section>
    </div>
    <footer data-tutorial-anchor="arcade-scores" className="arcade-footer"><span>Score {arcadeLabels[selectedGame]} <strong>{scoreText(arcade.value?.scores[selectedGame] ?? '0')}</strong></span><span>Total Arcade <strong>{scoreText(arcade.value?.totalScore ?? '0')}</strong></span><span>{daily?.used ? 'XP du jour : obtenue' : 'XP du jour : disponible'}</span></footer>
    {(recordsOpen || guidedRecords) && !feedbackPending && arcade.value && <ArcadeRecords records={arcade.value.records} initialGame={selectedGame} onClose={() => setRecordsOpen(false)} />}
    {(help || guidedRules) && <ArcadeRulesModal onClose={() => setHelp(false)} />}
    {quitSession && <ConfirmAction title="Quitter cette partie ?" pending={arcade.quitting} onCancel={() => setQuitSession(null)} onConfirm={() => { void arcade.quit(quitSession).then(() => setQuitSession(null)) }}>Cette partie ne donnera ni score ni XP.</ConfirmAction>}
  </div>
}
