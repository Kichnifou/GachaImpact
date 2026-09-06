import type { KeyboardEvent, MouseEvent } from 'react'
import type { InvocationSequenceState } from '../gacha/invocation-sequence'
import PullResults, { PullResultCard } from './PullResults'

type Props = Readonly<{
  state: Exclude<InvocationSequenceState, { phase: 'idle' }>
  onAdvance: () => void
  onSkip: () => void
  onClose: () => void
}>

function InvocationSequence({ state, onAdvance, onSkip, onClose }: Props) {
  const canAdvance = state.phase === 'intro' || state.phase === 'reveal'
  const advance = (event: MouseEvent<HTMLElement>) => {
    if (canAdvance && !isControl(event.target)) onAdvance()
  }
  const advanceWithKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!canAdvance || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onAdvance()
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
        <PullResultCard result={state.pull.results[state.resultIndex]!} />
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
