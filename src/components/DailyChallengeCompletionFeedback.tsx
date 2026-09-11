import { useCallback, useEffect, useRef, useState } from 'react'
import type { DailyChallengeDto } from '../api/types'
import { dailyChallengeProgressSentence } from '../daily-challenge/presentation'
import { LEVEL_UP_FEEDBACK_DISMISS_LOCK_MS, LEVEL_UP_FEEDBACK_DURATION_MS } from './LevelUpFeedback'

function DailyChallengeCompletionFeedback({ challenge, onFinished }: { challenge: NonNullable<DailyChallengeDto['challenge']>; onFinished: () => void }) {
  const [dismissible, setDismissible] = useState(false)
  const finished = useRef(false)
  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    onFinished()
  }, [onFinished])

  useEffect(() => {
    const unlockTimer = window.setTimeout(() => setDismissible(true), LEVEL_UP_FEEDBACK_DISMISS_LOCK_MS)
    const finishTimer = window.setTimeout(finish, LEVEL_UP_FEEDBACK_DURATION_MS)
    return () => { window.clearTimeout(unlockTimer); window.clearTimeout(finishTimer) }
  }, [finish])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && dismissible) finish() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [dismissible, finish])

  return <div className={`level-up-feedback-overlay challenge-completion-overlay${dismissible ? ' dismissible' : ''}`} onMouseDown={() => { if (dismissible) finish() }}>
    <section className="level-up-feedback challenge-completion-feedback" role="dialog" aria-modal="true" aria-live="polite" aria-label="Défi du jour terminé" onMouseDown={(event) => event.stopPropagation()}>
      <span className="level-up-feedback-kicker">Quotidiennes</span>
      <strong>Défi terminé !</strong>
      <small>{dailyChallengeProgressSentence(challenge)}</small>
      <small>+{challenge.rewardPrimogems} Primos</small>
    </section>
  </div>
}

export default DailyChallengeCompletionFeedback
