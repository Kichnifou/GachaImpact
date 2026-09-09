import { useEffect } from 'react'

import type { LevelUpFeedbackEvent } from '../progression/level-up-feedback'
import { levelUpRewardLabel, levelUpTitle } from '../progression/level-up-feedback'

export const LEVEL_UP_FEEDBACK_DURATION_MS = 5_400

function LevelUpFeedback({ event, onFinished }: { event: LevelUpFeedbackEvent; onFinished: (id: string) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onFinished(event.id), LEVEL_UP_FEEDBACK_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [event.id, onFinished])

  return <div className="level-up-feedback-anchor" aria-live="polite">
    <section className="level-up-feedback" aria-label={levelUpTitle(event.levelsGained)}>
      <span className="level-up-feedback-kicker">Progression</span>
      <strong>{levelUpTitle(event.levelsGained)}</strong>
      {event.rewards.length > 0 && <small>{event.rewards.map(levelUpRewardLabel).join(' · ')}</small>}
    </section>
  </div>
}

export default LevelUpFeedback
