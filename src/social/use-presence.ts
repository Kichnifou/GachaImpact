import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/game-api'
import type { ConnectedPlayers, SocialActions } from './types'

/** Fresh tab identity; one shared, observer-filtered snapshot for Chat and Players. */
export function usePresence(playerId: string, actions?: SocialActions) {
  const closeRef = useRef<() => Promise<unknown>>(async () => undefined)
  const close = useCallback(() => closeRef.current(), [])
  const refreshRef = useRef<() => void>(() => undefined)
  const refreshPresence = useCallback(() => refreshRef.current(), [])
  const [value, setValue] = useState<{ playerId: string; data: ConnectedPlayers } | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!actions) return
    let active = true, inFlight = false, polling = false, dirty = false, started = false, suspended = false
    let requested = false, revision = 0, lastReadAt: number | null = null, failures = 0, pulseFailed = false, pulseRequested = false
    let key = crypto.randomUUID()
    try { sessionStorage.setItem('gachaimpact.presence.tab', key) } catch { /* Memory still isolates this tab. */ }
    let pulseTimer: number | undefined, pollTimer: number | undefined, interactionTimer: number | undefined
    const scheduleRead = (delay = Math.min(60_000, 12_000 * 2 ** Math.min(failures, 2)) + Math.round(Math.random() * 3_000)) => {
      window.clearTimeout(pollTimer)
      if (active && !suspended && document.visibilityState !== 'hidden') pollTimer = window.setTimeout(() => void refresh(), delay)
    }
    const refresh = async () => {
      if (!active || suspended || document.visibilityState === 'hidden') return
      if (polling) { requested = true; return }
      const elapsed = lastReadAt === null ? Infinity : Date.now() - lastReadAt
      if (elapsed < 2_000) { scheduleRead(2_000 - elapsed); return }
      polling = true; requested = false; lastReadAt = Date.now()
      const readRevision = revision
      try {
        const data = await actions.connected()
        if (active && !suspended && readRevision === revision) { setValue({ playerId, data }); setError(false); failures = 0 }
      } catch {
        if (active && !suspended && readRevision === revision) { setValue(null); setError(true); failures++ }
      } finally {
        polling = false
        if (requested) scheduleRead(Math.max(0, 2_000 - (Date.now() - lastReadAt)))
        else scheduleRead()
      }
    }
    const wake = () => { window.clearTimeout(pollTimer); void refresh() }
    const confirmedPresence = () => { revision++; wake() }
    refreshRef.current = wake
    const pulse = async () => {
      if (!active || suspended || inFlight) return
      inFlight = true
      const pulseKey=key
      const activity = dirty; dirty = false
      try {
        const establish = !started || pulseFailed
        await (started ? actions.heartbeat(key, activity) : actions.session(key, activity))
        if (!active || suspended || key!==pulseKey) return
        started = true; pulseFailed = false
        if (establish) confirmedPresence()
      } catch (reason) {
        if (!active || suspended || key!==pulseKey) return
        pulseFailed = true; dirty ||= activity
        if (active && !suspended && reason instanceof ApiError && reason.code === 'PRESENCE_SESSION_ENDED') { key = crypto.randomUUID(); started = false }
      } finally {
        inFlight = false
        if (active && !suspended) { window.clearTimeout(pulseTimer); if(pulseRequested){pulseRequested=false;void pulse()}else pulseTimer = window.setTimeout(() => void pulse(), 45_000) }
      }
    }
    const interaction = (event: Event) => {
      if (!event.isTrusted) return
      dirty = true
      if (interactionTimer === undefined) interactionTimer = window.setTimeout(() => { interactionTimer = undefined; void pulse() }, 15_000)
    }
    const end = () => { suspended = true; revision++; window.clearTimeout(pollTimer); window.clearTimeout(pulseTimer); return actions.end(key).catch(() => undefined) }
    closeRef.current = end
    const restore = () => { if (!suspended) return; suspended = false; key = crypto.randomUUID(); started = false; dirty = false; if(inFlight)pulseRequested=true;else void pulse() }
    void pulse().then(()=>{if(!started)wake()})
    for (const event of ['pointerdown', 'keydown', 'touchstart', 'wheel']) window.addEventListener(event, interaction, { passive: true })
    window.addEventListener('pagehide', end); window.addEventListener('pageshow', restore)
    window.addEventListener('focus', wake); window.addEventListener('online', wake)
    document.addEventListener('visibilitychange', wake)
    return () => {
      active = false; refreshRef.current = () => undefined
      window.clearTimeout(pulseTimer); window.clearTimeout(pollTimer); window.clearTimeout(interactionTimer)
      for (const event of ['pointerdown', 'keydown', 'touchstart', 'wheel']) window.removeEventListener(event, interaction)
      window.removeEventListener('pagehide', end); window.removeEventListener('pageshow', restore)
      window.removeEventListener('focus', wake); window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', wake)
      end()
    }
  }, [actions, playerId])
  return { close, refresh: refreshPresence, value: value?.playerId === playerId ? value.data : null, error }
}
