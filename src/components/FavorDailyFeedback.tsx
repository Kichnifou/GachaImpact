import { useCallback, useEffect, useRef, useState } from 'react'
import { LEVEL_UP_FEEDBACK_DISMISS_LOCK_MS, LEVEL_UP_FEEDBACK_DURATION_MS } from './LevelUpFeedback'
import { useModalDialog } from './useModalDialog'

export default function FavorDailyFeedback({ id, onFinished }: { id: string; onFinished: (id: string) => void }) {
  const [dismissible, setDismissible] = useState(false), finished = useRef(false)
  const finish = useCallback(() => { if (!finished.current) { finished.current = true; onFinished(id) } }, [id, onFinished])
  const dialog = useModalDialog<HTMLElement>(() => { if (dismissible) finish() })
  useEffect(() => {
    const unlock = window.setTimeout(() => setDismissible(true), LEVEL_UP_FEEDBACK_DISMISS_LOCK_MS)
    const timeout = window.setTimeout(finish, LEVEL_UP_FEEDBACK_DURATION_MS)
    return () => { window.clearTimeout(unlock); window.clearTimeout(timeout) }
  }, [finish])
  return <div className={`level-up-feedback-overlay${dismissible ? ' dismissible' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget && dismissible) finish() }}>
    <section ref={dialog} tabIndex={-1} className="level-up-feedback favor-daily-feedback" role="dialog" aria-modal="true" aria-live="polite" aria-label="Récompense quotidienne Faveur">
      <span className="level-up-feedback-kicker">Faveur de l’Astre</span>
      <strong>Récompense quotidienne</strong>
      <small>+800 Primogemmes</small>
    </section>
  </div>
}
