import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import {
  acquireRevealLock,
  canActivateInvocationSurface,
  characterRevealFocusDurationMs,
  fiveStarSuspenseDurationMs,
  invocationSurfaceAction,
  nextRevealRarity,
  revealControlVisibility,
  releaseRevealLock,
  revealResultKey,
  revealTransitionDurationMs,
  shouldAdvanceSequenceWithKeyboard,
  type InvocationSequenceState,
} from '../gacha/invocation-sequence'
import PullResults, { PullResultCard } from './PullResults'
import { c6StatLabel } from '../gacha/pull-result-presentation'

type Props = Readonly<{
  state: Exclude<InvocationSequenceState, { phase: 'idle' }>
  onAdvance: () => void
  onSkip: () => void
  onClose: () => void
}>

function InvocationSequence({ state, onAdvance, onSkip, onClose }: Props) {
  const [suspense, setSuspense] = useState(false)
  const [readyCharacterRevealKey, setReadyCharacterRevealKey] = useState<string | null>(null)
  const advanceLocked = useRef(false)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const surfaceAction = invocationSurfaceAction(state)
  const currentResult = state.phase === 'reveal' ? state.pull.results[state.resultIndex] : null
  const currentRevealKey = state.phase === 'reveal' && currentResult?.resultType === 'character'
    ? revealResultKey(state.pull.operation.id, currentResult.index)
    : null
  const characterRevealReady = currentRevealKey === null || readyCharacterRevealKey === currentRevealKey
  const c6StatFeedback = currentResult?.c6Progression?.type === 'stat'
    ? `${c6StatLabel(currentResult.c6Progression.stat)} +1`
    : null
  const revealControls = revealControlVisibility(state, characterRevealReady)
  const canUseSurface = canActivateInvocationSurface(state, suspense, characterRevealReady)

  useEffect(() => {
    if (currentRevealKey === null) return
    const timer = setTimeout(() => setReadyCharacterRevealKey(currentRevealKey), characterRevealFocusDurationMs)
    return () => clearTimeout(timer)
  }, [currentRevealKey])

  useEffect(() => () => {
    if (advanceTimer.current !== null) clearTimeout(advanceTimer.current)
  }, [])

  const unlockAfterReveal = () => {
    advanceTimer.current = setTimeout(() => {
      releaseRevealLock(advanceLocked)
      advanceTimer.current = null
    }, revealTransitionDurationMs)
  }

  const clearPresentation = () => {
    if (advanceTimer.current !== null) clearTimeout(advanceTimer.current)
    advanceTimer.current = null
    releaseRevealLock(advanceLocked)
    setSuspense(false)
  }

  const requestSurfaceAction = () => {
    if (!surfaceAction || !acquireRevealLock(advanceLocked)) return
    if (surfaceAction === 'close') {
      onClose()
      return
    }
    if (nextRevealRarity(state) === 5) {
      setSuspense(true)
      advanceTimer.current = setTimeout(() => {
        onAdvance()
        setSuspense(false)
        unlockAfterReveal()
      }, fiveStarSuspenseDurationMs)
      return
    }
    onAdvance()
    unlockAfterReveal()
  }

  const activateSurface = (event: MouseEvent<HTMLElement>) => {
    if (canUseSurface && !isControl(event.target)) requestSurfaceAction()
  }
  const activateSurfaceWithKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!canUseSurface || !shouldAdvanceSequenceWithKeyboard(event.key, isControl(event.target))) return
    event.preventDefault()
    requestSurfaceAction()
  }
  const stop = (event: MouseEvent<HTMLButtonElement>) => event.stopPropagation()
  const rarity = state.phase === 'submitting' ? 'pending' : state.bestRarity
  const surfaceLabel = surfaceAction === 'close' ? 'Fermer les résultats' : 'Révéler le résultat suivant'

  return (
    <div
      className={`invocation-sequence sequence-${state.phase} sequence-rarity-${rarity}${suspense ? ' sequence-suspense-active' : ''}`}
      onClick={activateSurface}
      onKeyDown={activateSurfaceWithKeyboard}
      role={canUseSurface ? 'button' : undefined}
      tabIndex={canUseSurface ? 0 : undefined}
      aria-label={canUseSurface ? surfaceLabel : undefined}
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
        <p>Le destin se met en mouvement…</p>
      </div>}

      {suspense && <div className="sequence-suspense-stage" role="status">
        <span className="suspense-star" aria-hidden="true">✦</span>
        <strong>Une présence exceptionnelle approche…</strong>
      </div>}

      {!suspense && state.phase === 'intro' && <div className="sequence-message intro-message">
        <span>Invocation x{state.count}</span>
        <h2>{state.bestRarity === 5 ? 'Une lumière légendaire répond' : state.bestRarity === 4 ? 'Une lueur rare traverse le ciel' : 'Le portail s’ouvre'}</h2>
        <p>Cliquez dans le cadre pour révéler.</p>
      </div>}

      {!suspense && state.phase === 'reveal' && <div className={`sequence-reveal-stage${currentRevealKey ? ` character-reveal character-reveal-${characterRevealReady ? 'ready' : 'focus'}` : ''}`}>
        {revealControls.counter && <div className="sequence-counter reveal-overlay-control">Résultat {state.resultIndex + 1} / {state.pull.results.length}</div>}
        <PullResultCard key={revealResultKey(state.pull.operation.id, state.pull.results[state.resultIndex]!.index)} result={state.pull.results[state.resultIndex]!} />
        {characterRevealReady && c6StatFeedback && <p className="reveal-c6-stat-feedback reveal-overlay-control">{c6StatFeedback}</p>}
        {revealControls.hint && <p className="sequence-hint reveal-overlay-control">Cliquez pour continuer</p>}
        {revealControls.skip && <button type="button" className="sequence-control sequence-skip reveal-overlay-control" onClick={(event) => { stop(event); clearPresentation(); onSkip() }}>Passer</button>}
        {revealControls.close && <button type="button" className="icon-button sequence-control sequence-close reveal-overlay-control" onClick={(event) => { stop(event); clearPresentation(); onClose() }} aria-label="Fermer les résultats"><span className="icon-glyph">×</span></button>}
      </div>}

      {!suspense && state.phase === 'summary' && <div className="sequence-summary">
        <header><span>Invocation validée</span><h2>Récapitulatif x10</h2></header>
        <PullResults pull={state.pull} />
      </div>}

      {state.phase === 'intro' && <button type="button" className="sequence-control sequence-skip" onClick={(event) => { stop(event); clearPresentation(); onSkip() }}>Passer</button>}
      {state.phase === 'summary' && <button type="button" className="icon-button sequence-control sequence-close" onClick={(event) => { stop(event); clearPresentation(); onClose() }} aria-label="Fermer les résultats"><span className="icon-glyph">×</span></button>}
    </div>
  )
}

function isControl(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, [role="tab"]'))
}

export default InvocationSequence
