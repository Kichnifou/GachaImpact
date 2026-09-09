import { useCallback, useEffect, useRef, useState } from 'react'

import type { LevelUpFeedbackEvent } from '../progression/level-up-feedback'
import { levelUpRewardLabel, levelUpTitle } from '../progression/level-up-feedback'

export const LEVEL_UP_FEEDBACK_DURATION_MS = 5_400
export const LEVEL_UP_FEEDBACK_DISMISS_LOCK_MS = 1_000

function LevelUpFeedback({ event, onFinished }: { event: LevelUpFeedbackEvent; onFinished: (id: string) => void }) {
  const [dismissible, setDismissible] = useState(false)
  const finished = useRef(false)
  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    onFinished(event.id)
  }, [event.id, onFinished])

  useEffect(() => {
    const unlockTimer = window.setTimeout(() => setDismissible(true), LEVEL_UP_FEEDBACK_DISMISS_LOCK_MS)
    const finishTimer = window.setTimeout(finish, LEVEL_UP_FEEDBACK_DURATION_MS)
    return () => {
      window.clearTimeout(unlockTimer)
      window.clearTimeout(finishTimer)
    }
  }, [event.id, finish])

  useEffect(() => {
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape' && dismissible) finish()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [dismissible, finish])

  return <div className={`level-up-feedback-overlay${dismissible ? ' dismissible' : ''}`} onClick={() => { if (dismissible) finish() }}>
    <section className="level-up-feedback" role="dialog" aria-modal="true" aria-live="polite" aria-label={levelUpTitle(event.levelsGained)}>
      <span className="level-up-feedback-kicker">Progression</span>
      <strong>{levelUpTitle(event.levelsGained)}</strong>
      {event.rewards.length > 0 && <small>{event.rewards.map(levelUpRewardLabel).join(' · ')}</small>}
    </section>
  </div>
}

export default LevelUpFeedback
