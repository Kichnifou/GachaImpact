import { useEffect, useState } from 'react'
import { arcadeDifficulties, arcadeGames, type ArcadeDifficulty, type ArcadeGame, type ArcadeMutation, type ArcadeSession } from '../api/arcade-types'
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
  const arcade = useArcade(playerId, onMutation)
  const [game, setGame] = useState<ArcadeGame>('MEMORY'), [difficulty, setDifficulty] = useState<ArcadeDifficulty>('MEDIUM')
  const [visible, setVisible] = useState(document.visibilityState !== 'hidden'), [recordsOpen, setRecordsOpen] = useState(false), [help, setHelp] = useState(false)
  const [quitSession, setQuitSession] = useState<ArcadeSession | null>(null)
  const activeSession = arcade.value?.sessions.find(row => row.status === 'ACTIVE')
  const selectedGame = activeSession?.game ?? game
  const session = activeSession ?? arcade.value?.sessions.find(row => row.game === selectedGame)
  const active = session?.status === 'ACTIVE', actualDifficulty = active ? session.difficulty : difficulty
  const autoAdvance = active && (session.board.turn === 'AI' || session.board.kind === 'MEMORY' && session.board.phase === 'REVEAL')
  const blocked = arcade.pending || arcade.refreshing || Boolean(arcade.retry) || !visible || feedbackPending || recordsOpen || help || Boolean(quitSession)
  const advance = arcade.act, actionError = arcade.error
  useEffect(() => { if (feedbackPending) { setRecordsOpen(false); setHelp(false) } }, [feedbackPending])
  const activeGame = activeSession?.game, activeDifficulty = activeSession?.difficulty
  useEffect(() => { if (activeGame && activeDifficulty) { setGame(activeGame); setDifficulty(activeDifficulty) } }, [activeGame, activeDifficulty])
  useEffect(() => {
    if (!session || !autoAdvance || blocked || actionError) return
    const delay = Math.max(750, Date.parse(session.nextActionAt) - Date.now() + 80)
    const timer = window.setTimeout(() => { if (document.visibilityState !== 'hidden') void advance(session) }, delay)
    return () => window.clearTimeout(timer)
  }, [session, autoAdvance, blocked, actionError, advance])
  useEffect(() => {
    const pause = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', pause)
    return () => document.removeEventListener('visibilitychange', pause)
  }, [])
  const daily = arcade.value?.daily.find(row => row.game === selectedGame)
  const status = session?.result ? 'Résultat enregistré' : active ? session.board.kind === 'MEMORY' && session.board.phase === 'REVEAL' ? 'Mémorisez ces deux cartes' : autoAdvance ? 'L’adversaire joue' : 'À vous' : 'Choisissez votre jeu et commencez une partie'
  const pairTotal = difficulty === 'EASY' ? 8 : difficulty === 'MEDIUM' ? 12 : 18
  return <div className="screen-content long-screen-layout arcade-screen">
    <header className="arcade-header"><div><span className="eyebrow">Activités</span><h1>Arcade</h1></div><div className="arcade-header-actions">
      <AppButton onClick={() => setHelp(true)} aria-haspopup="dialog">Règles & gains</AppButton><AppButton disabled={!arcade.value || feedbackPending} onClick={() => setRecordsOpen(true)}>Records →</AppButton></div></header>
    <div className="arcade-controls"><nav aria-label="Jeux Arcade">{arcadeGames.map(key => <AppButton key={key} aria-pressed={selectedGame === key} disabled={Boolean(activeSession)}
      onClick={() => setGame(key)}>{arcadeLabels[key]}</AppButton>)}</nav><label>Difficulté<select value={actualDifficulty} disabled={active || arcade.pending} onChange={event => setDifficulty(event.target.value as ArcadeDifficulty)}>{arcadeDifficulties.map(key => <option key={key} value={key}>{difficultyLabels[key]}</option>)}</select></label></div>
    <div className="arcade-body">
      <section className="arcade-arena panel" aria-label={arcadeLabels[selectedGame]}>
        <div className="arcade-versus"><div><span className="arcade-player-symbol" aria-hidden="true">●</span><strong>Vous</strong><small>{session?.board.kind === 'MEMORY' ? `${session.board.playerPairs} paires` : 'Cercle cyan'}</small></div>
          <span className="arcade-vs">VS</span><div><span className="arcade-automaton" aria-hidden="true">◇<i>••</i></span><strong>Adversaire</strong><small>{session?.board.kind === 'MEMORY' ? `${session.board.aiPairs} paires` : 'Symbole violet'}</small></div></div>
        <div className="arcade-play-area">{session && session.status !== 'ABANDONED' ? <ArcadeBoards board={session.board} disabled={blocked || !active || autoAdvance || session.board.turn !== 'PLAYER'} onMove={position => { void arcade.act(session, position) }} />
          : <div className={`arcade-ready ${selectedGame.toLowerCase()}`}><span aria-hidden="true">{selectedGame === 'MEMORY' ? '✦' : selectedGame === 'CONNECT_FOUR' ? '● ◆ ●' : '○ ✕'}</span><h2>{arcadeLabels[selectedGame]}</h2><p>{selectedGame === 'MEMORY' ? `${pairTotal * 2} cartes · ${pairTotal} paires · des portraits à retrouver` : selectedGame === 'CONNECT_FOUR' ? '7 colonnes · 6 lignes · quatre jetons à aligner' : '9 cases · trois symboles à aligner'}</p></div>}</div>
        <aside className="arcade-banter">« {session?.status !== 'ABANDONED' && session?.banter.text || 'Trois jeux, à votre rythme.'} »</aside>
        <div className="arcade-status" aria-live="polite"><strong>{status}</strong>{session?.status !== 'ABANDONED' && session?.board.kind === 'MEMORY' && <span>{session.board.remainingPairs} paires restantes</span>}</div>
        <div className="arcade-result" aria-live="polite">{session?.result ? <><strong>{outcomeLabels[session.result.outcome]} · {difficultyLabels[session.difficulty]}</strong><span>+{session.result.scoreAwarded} score · +{session.result.xpAwarded} XP</span></> : <span>{daily?.used ? 'Partie libre — score disponible, XP du jour déjà obtenue' : 'XP du jour disponible · jusqu’à 10 XP'}</span>}</div>
        <div className="arcade-actions">{active ? <AppButton disabled={arcade.pending || Boolean(arcade.retry)} onClick={() => setQuitSession(session)}>Quitter</AppButton> : <AppButton variant="primary" disabled={!arcade.value || arcade.pending || Boolean(arcade.retry)} onClick={() => void arcade.start(selectedGame, difficulty)}>{arcade.pending ? 'En cours…' : session ? 'Rejouer' : 'Commencer'}</AppButton>}
          {arcade.retry && <AppButton disabled={arcade.pending} onClick={() => void arcade.retry?.()}>Réessayer la même action</AppButton>}
          {arcade.error && !arcade.retry && <AppButton disabled={arcade.pending} onClick={() => void arcade.load()}>Actualiser</AppButton>}</div>
        <div className="arcade-error" role={arcade.error ? 'alert' : undefined}>{arcade.error}</div>
      </section>
    </div>
    <footer className="arcade-footer"><span>Score {arcadeLabels[selectedGame]} <strong>{scoreText(arcade.value?.scores[selectedGame] ?? '0')}</strong></span><span>Total Arcade <strong>{scoreText(arcade.value?.totalScore ?? '0')}</strong></span><span>{daily?.used ? `XP du jour : ${daily.xpAwarded} / 10 · obtenue` : 'XP du jour : disponible'}</span></footer>
    {recordsOpen && !feedbackPending && arcade.value && <ArcadeRecords records={arcade.value.records} initialGame={selectedGame} onClose={() => setRecordsOpen(false)} />}
    {help && <ArcadeRulesModal onClose={() => setHelp(false)} />}
    {quitSession && <ConfirmAction title="Quitter cette partie ?" pending={arcade.pending} onCancel={() => setQuitSession(null)} onConfirm={() => { void arcade.quit(quitSession).then(() => setQuitSession(null)) }}>Cette partie ne donnera ni score ni XP.</ConfirmAction>}
  </div>
}
