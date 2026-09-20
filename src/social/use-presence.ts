import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/game-api'
import type { ConnectedPlayers, SocialActions } from './types'

/** Every mount gets a fresh tab key (including tabs duplicated with copied sessionStorage). */
export function usePresence(playerId: string, actions?: SocialActions) {
  const closeRef = useRef<() => Promise<unknown>>(async () => undefined)
  const close = useCallback(() => closeRef.current(), [])
  const [value, setValue] = useState<{ playerId: string; data: ConnectedPlayers } | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!actions) return
    let active = true, inFlight = false, polling = false, dirty = true, started = false, suspended = false
    let key = crypto.randomUUID()
    try { sessionStorage.setItem('gachaimpact.presence.tab', key) } catch { /* Memory still isolates this tab. */ }
    let pulseTimer: number | undefined, pollTimer: number | undefined, interactionTimer: number | undefined
    const refresh = async () => {
      if (!active || polling || document.visibilityState === 'hidden') return
      polling = true
      try { const data = await actions.connected(); if (active) { setValue({ playerId, data }); setError(false) } }
      catch { if (active) { setValue(null); setError(true) } }
      finally { polling = false; if (active) pollTimer = window.setTimeout(() => void refresh(), 30_000) }
    }
    const pulse = async () => {
      if (!active || suspended || inFlight) return
      inFlight = true
      const activity = dirty; dirty = false
      try {
        await (started ? actions.heartbeat(key, activity) : actions.session(key, activity)); started = true
      } catch (reason) {
        dirty ||= activity
        if (active && !suspended && reason instanceof ApiError && reason.code === 'PRESENCE_SESSION_ENDED') { key = crypto.randomUUID(); started = false }
      } finally { inFlight = false; if (active) { window.clearTimeout(pulseTimer); pulseTimer = window.setTimeout(() => void pulse(), 45_000) } }
    }
    const interaction = (event: Event) => {
      if (!event.isTrusted) return
      dirty = true
      if (interactionTimer === undefined) interactionTimer = window.setTimeout(() => { interactionTimer = undefined; void pulse() }, 15_000)
    }
    const wake = () => { window.clearTimeout(pollTimer); void refresh() }
    const end = () => { suspended = true; return actions.end(key).catch(() => undefined) }
    closeRef.current = end
    const restore = () => { if (!suspended) return; suspended = false; key = crypto.randomUUID(); started = false; dirty = true; void pulse(); wake() }
    void pulse().then(wake)
    for (const event of ['pointerdown', 'keydown', 'touchstart', 'wheel']) window.addEventListener(event, interaction, { passive: true })
    window.addEventListener('pagehide', end)
    window.addEventListener('pageshow', restore)
    window.addEventListener('focus', wake)
    document.addEventListener('visibilitychange', wake)
    return () => {
      active = false
      window.clearTimeout(pulseTimer); window.clearTimeout(pollTimer); window.clearTimeout(interactionTimer)
      for (const event of ['pointerdown', 'keydown', 'touchstart', 'wheel']) window.removeEventListener(event, interaction)
      window.removeEventListener('pagehide', end); window.removeEventListener('pageshow', restore); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake)
      end()
    }
  }, [actions, playerId])
  return { close, value: value?.playerId === playerId ? value.data : null, error }
}
