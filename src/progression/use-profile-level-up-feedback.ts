import { useEffect, useState } from 'react'

import type { LevelUpFeedbackEvent } from './level-up-feedback'

export const PROFILE_LEVEL_UP_DURATION_MS = 2_000

export function useProfileLevelUpFeedback(event: LevelUpFeedbackEvent | null, onFinished?: (id: string) => void) {
  const [expiredEventId, setExpiredEventId] = useState<string | null>(null)
  const visible = Boolean(event && expiredEventId !== event.id)

  useEffect(() => {
    if (!event) return
    const timer = window.setTimeout(() => {
      setExpiredEventId(event.id)
      onFinished?.(event.id)
    }, PROFILE_LEVEL_UP_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [event, onFinished])

  return {
    visible,
    levelsGained: visible ? event?.levelsGained ?? null : null,
  }
}
