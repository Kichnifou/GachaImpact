import { useEffect, useState } from 'react'
import { arcadeDifficulties, arcadeGames, type ArcadeDifficulty, type ArcadeGame, type ArcadeMutation } from '../api/arcade-types'
import AppButton from '../components/AppButton'
import ArcadeBoards from '../arcade/ArcadeBoards'
import ArcadeRecords from '../arcade/ArcadeRecords'
import { useArcade } from '../arcade/use-arcade'
import { arcadeLabels, difficultyLabels, outcomeLabels, scoreText } from '../arcade/presentation'
import '../arcade/arcade.css'

export type ArcadeScreenProps = { playerId: string; onMutation?: (value: ArcadeMutation, playerId: string) => void; feedbackPending?: boolean }
export default function ArcadeScreen({ playerId, onMutation, feedbackPending = false }: ArcadeScreenProps) {
  const arcade = useArcade(playerId, onMutation)
  const [game, setGame] = useState<ArcadeGame>('MEMORY'), [difficulty, setDifficulty] = useState<ArcadeDifficulty>('MEDIUM')
  const [running, setRunning] = useState(false), [recordsOpen, setRecordsOpen] = useState(false), [help, setHelp] = useState(false)
  const session = arcade.value?.sessions.find(row => row.game === game)
  const active = session?.status === 'ACTIVE', actualDifficulty = active ? session.difficulty : difficulty
  const autoAdvance = active && (session.board.turn === 'AI' || session.board.kind === 'MEMORY' && session.board.phase === 'REVEAL')
  const blocked = arcade.pending || Boolean(arcade.retry) || !running || feedbackPending || recordsOpen
  const advance = arcade.act, actionError = arcade.error
  useEffect(() => { if (feedbackPending) setRecordsOpen(false) }, [feedbackPending])
  useEffect(() => {
    if (!session || !autoAdvance || blocked || actionError) return
    const delay = Math.max(750, Date.parse(session.nextActionAt) - Date.now() + 80)
    const timer = window.setTimeout(() => { void advance(session).then(success => { if (!success) setRunning(false) }) }, delay)
    return () => window.clearTimeout(timer)
  }, [session, autoAdvance, blocked, actionError, advance])
  useEffect(() => {
    const pause = () => { if (document.visibilityState === 'hidden') setRunning(false) }
    document.addEventListener('visibilitychange', pause)
    return () => document.removeEventListener('visibilitychange', pause)
  }, [])
  const daily = arcade.value?.daily.find(row => row.game === game)
  const startOrResume = async () => {
    if (active) { await arcade.load(); setRunning(true) }
    else { const success = await arcade.start(game, difficulty); setRunning(success) }
  }
  const status = session?.result ? 'Résultat enregistré' : active ? !running ? 'Partie en pause' : session.board.kind === 'MEMORY' && session.board.phase === 'REVEAL' ? 'Mémorisez ces deux cartes' : autoAdvance ? 'L’adversaire joue' : 'À vous' : 'Choisissez votre jeu et commencez une partie'
  return <div className="screen-content long-screen-layout arcade-screen">
    <header className="arcade-header"><div><span className="eyebrow">Activités</span><h1>Arcade</h1></div><div className="arcade-header-actions">
      <AppButton onClick={() => setHelp(value => !value)} aria-expanded={help}>Règles & gains</AppButton><AppButton disabled={!arcade.value || feedbackPending} onClick={() => { setRunning(false); setRecordsOpen(true) }}>Records →</AppButton></div></header>
    <div className="arcade-controls"><nav aria-label="Jeux Arcade">{arcadeGames.map(key => <AppButton key={key} aria-pressed={game === key} disabled={arcade.pending}
      onClick={() => { setGame(key); setRunning(false) }}>{arcadeLabels[key]}</AppButton>)}</nav><label>Difficulté<select value={actualDifficulty} disabled={active || arcade.pending} onChange={event => setDifficulty(event.target.value as ArcadeDifficulty)}>{arcadeDifficulties.map(key => <option key={key} value={key}>{difficultyLabels[key]}</option>)}</select></label></div>
    <div className="arcade-body">
      {help && <section className="arcade-help panel"><h2>À chacun son coup</h2><p>Memory : 18 paires, une paire permet de rejouer. Puissance 4 : alignez quatre jetons. Morpion : alignez trois symboles. Celui qui commence est choisi au hasard, une seule fois.</p>
        <p>Première partie terminée de chaque jeu : XP et score. Ensuite, score seulement. Les difficultés partagent ce quota, remis à zéro à minuit en Europe/Paris. Une interruption conserve votre partie ; seule sa fin compte.</p>
        <table><caption>Points par partie · Facile / Moyen / Difficile</caption><tbody><tr><th>Memory · défaite</th><td>1–2 / 1–4 / 1–6</td></tr><tr><th>Memory · égalité</th><td>3 / 5 / 7</td></tr><tr><th>Memory · victoire</th><td>4–6 / 6–8 / 8–10</td></tr><tr><th>Autres jeux · défaite</th><td>2 / 3 / 4</td></tr><tr><th>Autres jeux · égalité</th><td>3 / 5 / 7</td></tr><tr><th>Autres jeux · victoire</th><td>6 / 8 / 10</td></tr></tbody></table><p>À Memory, davantage de paires améliore le résultat. Maximum : 10 XP par jeu, 30 par jour. Le score reste cumulatif et ne donne aucune récompense de classement.</p>
        <p>L’adversaire Memory ne retient que des cartes révélées ; sa mémoire augmente avec la difficulté. Dans les jeux d’alignement, il anticipe davantage en Difficile. Utilisez les flèches puis Entrée ou Espace, ou touchez une case.</p></section>}
      <section className="arcade-arena panel" aria-label={arcadeLabels[game]}>
        <div className="arcade-versus"><div><span className="arcade-player-symbol" aria-hidden="true">●</span><strong>Vous</strong><small>{session?.board.kind === 'MEMORY' ? `${session.board.playerPairs} paires` : 'Cercle cyan'}</small></div>
          <span className="arcade-vs">VS</span><div><span className="arcade-automaton" aria-hidden="true">◇<i>••</i></span><strong>Adversaire</strong><small>{session?.board.kind === 'MEMORY' ? `${session.board.aiPairs} paires` : 'Symbole violet'}</small></div></div>
        <div className="arcade-play-area">{session ? <ArcadeBoards board={session.board} disabled={blocked || !active || autoAdvance || session.board.turn !== 'PLAYER'} onMove={position => { void arcade.act(session, position).then(success => { if (!success) setRunning(false) }) }} />
          : <div className={`arcade-ready ${game.toLowerCase()}`}><span aria-hidden="true">{game === 'MEMORY' ? '✦' : game === 'CONNECT_FOUR' ? '● ◆ ●' : '● ✕'}</span><h2>{arcadeLabels[game]}</h2><p>{game === 'MEMORY' ? '36 cartes · 18 paires · des portraits à retrouver' : game === 'CONNECT_FOUR' ? '7 colonnes · 6 lignes · quatre jetons à aligner' : '9 cases · trois symboles à aligner'}</p></div>}</div>
        <div className="arcade-status" aria-live="polite"><strong>{status}</strong>{session?.board.kind === 'MEMORY' && <span>{session.board.remainingPairs} paires restantes</span>}
          <span className="arcade-banter">{session?.banter.text ?? 'Trois jeux, à votre rythme.'}</span></div>
        <div className="arcade-result" aria-live="polite">{session?.result ? <><strong>{outcomeLabels[session.result.outcome]} · {difficultyLabels[session.difficulty]}</strong><span>+{session.result.scoreAwarded} score · +{session.result.xpAwarded} XP</span></> : <span>{daily?.used ? 'Partie libre — score disponible, XP du jour déjà obtenue' : 'XP du jour disponible · jusqu’à 10 XP'}</span>}</div>
        <div className="arcade-actions"><AppButton variant="primary" disabled={!arcade.value || arcade.pending || Boolean(arcade.retry) || Boolean(active && running)} onClick={() => void startOrResume()}>{arcade.pending ? 'En cours…' : active ? 'Reprendre' : session ? 'Rejouer' : 'Commencer'}</AppButton>
          {active && running && <AppButton disabled={arcade.pending} onClick={() => setRunning(false)}>Pause</AppButton>}
          {arcade.retry && <AppButton disabled={arcade.pending} onClick={() => void arcade.retry?.().then(success => setRunning(success))}>Réessayer le même coup</AppButton>}
          {arcade.error && !arcade.retry && <AppButton disabled={arcade.pending} onClick={() => void arcade.load()}>Actualiser</AppButton>}</div>
        <div className="arcade-error" role={arcade.error ? 'alert' : undefined}>{arcade.error}</div>
      </section>
    </div>
    <footer className="arcade-footer"><span>Score {arcadeLabels[game]} <strong>{scoreText(arcade.value?.scores[game] ?? '0')}</strong></span><span>Total Arcade <strong>{scoreText(arcade.value?.totalScore ?? '0')}</strong></span><span>{daily?.used ? `XP du jour : ${daily.xpAwarded} / 10 · obtenue` : 'XP du jour : disponible'}</span></footer>
    {recordsOpen && !feedbackPending && arcade.value && <ArcadeRecords records={arcade.value.records} initialGame={game} onClose={() => setRecordsOpen(false)} />}
  </div>
}
