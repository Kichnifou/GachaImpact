import { useEffect, useRef } from 'react'
import type { TutorialPreferenceDto } from '../api/types'
import type { TutorialApi, TutorialController } from './tutorial-controller'

export function tutorialLaunchBlockedReason(busy: boolean) {
  return busy || document.querySelector('.invocation-sequence-panel, [data-business-pending="true"]')
    ? 'Terminez l’action ou la présentation en cours avant de lancer le Tutoriel.' : null
}

/** The server owns the once-per-Player marker. DOM observation only waits for a safe launch. */
export function useTutorialAutostart(playerId: string, eligible: boolean, api: TutorialApi, controller: TutorialController, busy: boolean, beforeLaunch: () => void) {
  const latest = useRef({ eligible, busy, beforeLaunch, controller })
  const retry = useRef<() => void>(() => undefined)
  latest.current = { eligible, busy, beforeLaunch, controller }
  const state = useRef<{ playerId: string; live: boolean; flight: boolean; settled: boolean; preference: (TutorialPreferenceDto & { status: 'IN_PROGRESS' }) | null }>({ playerId, live: false, flight: false, settled: false, preference: null })
  useEffect(() => {
    if (state.current.playerId !== playerId) state.current = { playerId, live: false, flight: false, settled: false, preference: null }
    const current = state.current
    current.live = true
    let wake: number | undefined
    const attempt = () => {
      if (!current.live || state.current !== current || !latest.current.eligible || latest.current.controller.getSnapshot().active || tutorialLaunchBlockedReason(latest.current.busy) || document.visibilityState === 'hidden') return
      if (current.preference) {
        const preference = current.preference; current.preference = null
        latest.current.beforeLaunch(); void latest.current.controller.startConfirmed(preference)
      } else if (!current.settled && !current.flight && api.claimAutostart) {
        current.flight = true
        void Promise.resolve().then(api.claimAutostart).then(result => {
          current.settled = true
          if (result.shouldLaunch) current.preference = result.preference
        }).catch(() => undefined).finally(() => { current.flight = false; if (current.settled) attempt() })
      }
    }
    const changed = () => { window.clearTimeout(wake); wake = window.setTimeout(attempt, 80) }
    retry.current = changed
    const observer = new MutationObserver(changed)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-business-pending'] })
    window.addEventListener('focus', changed); document.addEventListener('visibilitychange', changed)
    // Defer until commit; StrictMode reuses the same in-flight claim and confirmed result.
    changed()
    return () => { current.live = false; window.clearTimeout(wake); observer.disconnect(); window.removeEventListener('focus', changed); document.removeEventListener('visibilitychange', changed) }
  }, [playerId, api, controller])
  useEffect(() => { retry.current() }, [busy, eligible])
}
