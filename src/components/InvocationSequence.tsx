import { useEffect, useRef } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import {
  acquireRevealLock,
  releaseRevealLock,
  revealResultKey,
  revealTransitionDurationMs,
  shouldAdvanceSequenceWithKeyboard,
  type InvocationSequenceState,
} from '../gacha/invocation-sequence'
import PullResults, { PullResultCard } from './PullResults'

type Props = Readonly<{
  state: Exclude<InvocationSequenceState, { phase: 'idle' }>
  onAdvance: () => void
  onSkip: () => void
  onClose: () => void
}>

function InvocationSequence({ state, onAdvance, onSkip, onClose }: Props) {
  const canAdvance = state.phase === 'intro' || state.phase === 'reveal'
  const advanceLocked = useRef(false)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (advanceTimer.current !== null) clearTimeout(advanceTimer.current)
  }, [])
  const requestAdvance = () => {
    if (!canAdvance || !acquireRevealLock(advanceLocked)) return
    onAdvance()
    advanceTimer.current = setTimeout(() => {
      releaseRevealLock(advanceLocked)
      advanceTimer.current = null
    }, revealTransitionDurationMs)
  }
  const advance = (event: MouseEvent<HTMLElement>) => {
    if (canAdvance && !isControl(event.target)) requestAdvance()
  }
  const advanceWithKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!canAdvance || !shouldAdvanceSequenceWithKeyboard(event.key, isControl(event.target))) return
    event.preventDefault()
    requestAdvance()
  }
  const stop = (event: MouseEvent<HTMLButtonElement>) => event.stopPropagation()
  const rarity = state.phase === 'submitting' ? 'pending' : state.bestRarity

  return (
    <div
      className={`invocation-sequence sequence-${state.phase} sequence-rarity-${rarity}`}
      onClick={advance}
      onKeyDown={advanceWithKeyboard}
      role={canAdvance ? 'button' : undefined}
      tabIndex={canAdvance ? 0 : undefined}
      aria-label={canAdvance ? 'Révéler le résultat suivant' : undefined}
      aria-live="polite"
    >
      <div className="sequence-sky" aria-hidden="true">
        <span className="sequence-orbit orbit-a" />
        <span className="sequence-orbit orbit-b" />
        <span className="sequence-comet" />
        <span className="sequence-star">✦</span>
      </div>

      {state.phase === 'submitting' && <div className="sequence-message">
        <span>Connexion au portail</span>
        <h2>Les astres se rassemblent…</h2>
        <p>Le résultat est calculé et enregistré par le serveur.</p>
      </div>}

      {state.phase === 'intro' && <div className="sequence-message intro-message">
        <span>Invocation x{state.count}</span>
        <h2>{state.bestRarity === 5 ? 'Une lumière légendaire répond' : state.bestRarity === 4 ? 'Une lueur rare traverse le ciel' : 'Le portail s’ouvre'}</h2>
        <p>Cliquez dans le cadre pour révéler.</p>
      </div>}

      {state.phase === 'reveal' && <div className="sequence-reveal-stage">
        <div className="sequence-counter">Résultat {state.resultIndex + 1} / {state.pull.results.length}</div>
        <PullResultCard key={revealResultKey(state.pull.operation.id, state.pull.results[state.resultIndex]!.index)} result={state.pull.results[state.resultIndex]!} />
        {state.count === 10 && <p className="sequence-hint">Cliquez pour continuer</p>}
      </div>}

      {state.phase === 'summary' && <div className="sequence-summary">
        <header><span>Invocation validée</span><h2>Récapitulatif x10</h2></header>
        <PullResults pull={state.pull} />
      </div>}

      {(state.phase === 'intro' || (state.phase === 'reveal' && state.count === 10)) && <button type="button" className="sequence-control sequence-skip" onClick={(event) => { stop(event); onSkip() }}>Passer</button>}
      {((state.phase === 'reveal' && state.count === 1) || state.phase === 'summary') && <button type="button" className="icon-button sequence-control sequence-close" onClick={(event) => { stop(event); onClose() }} aria-label="Fermer les résultats"><span className="icon-glyph">×</span></button>}
    </div>
  )
}

function isControl(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, [role="tab"]'))
}

export default InvocationSequence
