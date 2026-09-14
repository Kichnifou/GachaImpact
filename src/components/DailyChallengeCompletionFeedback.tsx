import { useCallback, useEffect, useRef } from 'react'
import type { DailyChallengeDto } from '../api/types'
import { dailyChallengeProgressSentence } from '../daily-challenge/presentation'
import { LEVEL_UP_FEEDBACK_DURATION_MS } from './LevelUpFeedback'

function DailyChallengeCompletionFeedback({ challenge, onFinished }: { challenge: NonNullable<DailyChallengeDto['challenge']>; onFinished: () => void }) {
  const finished = useRef(false)
  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    onFinished()
  }, [onFinished])

  useEffect(() => {
    const finishTimer = window.setTimeout(finish, LEVEL_UP_FEEDBACK_DURATION_MS)
    return () => window.clearTimeout(finishTimer)
  }, [finish])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') finish() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [finish])

  return <div className="level-up-feedback-overlay challenge-completion-overlay dismissible" onMouseDown={(event) => { if (event.target === event.currentTarget) finish() }}>
    <section className="level-up-feedback challenge-completion-feedback" role="dialog" aria-modal="true" aria-live="polite" aria-label="Défi du jour terminé" onMouseDown={(event) => event.stopPropagation()}>
      <span className="level-up-feedback-kicker">Quotidiennes</span>
      <strong>Défi terminé !</strong>
      <small>{dailyChallengeProgressSentence(challenge)}</small>
      <small>+{challenge.rewardPrimogems} Primos</small>
    </section>
  </div>
}

export default DailyChallengeCompletionFeedback
