import { useEffect, useState } from 'react'
import { getGameApiClient } from '../api/game-api'
import './twitch-live-link.css'
const loadLive = () => getGameApiClient().getTwitchLive()
export default function TwitchLiveLink({ sessionKey, load = loadLive }: { sessionKey?: string; load?: () => Promise<{ live: boolean; validForMs?: number }> }) {
  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => {
    setConfirmed(false)
    if (!sessionKey) return
    let active = true, pending = false, timer: number | undefined, expiry: number | undefined
    const refresh = async () => {
      if (!active || pending || document.visibilityState === 'hidden') return
      window.clearTimeout(timer); pending = true
      try { const state = await load(); if (active) { window.clearTimeout(expiry); setConfirmed(state.live === true); expiry = window.setTimeout(() => setConfirmed(false), Math.min(45_000, Math.max(0, state.validForMs ?? 30_000))) } }
      catch { if (active) setConfirmed(false) }
      finally { pending = false; if (active) timer = window.setTimeout(refresh, 30_000) }
    }
    const visible = () => { if (document.visibilityState === 'hidden') { setConfirmed(false); window.clearTimeout(timer) } else void refresh() }
    void refresh(); document.addEventListener('visibilitychange', visible)
    return () => { active = false; window.clearTimeout(timer); window.clearTimeout(expiry); document.removeEventListener('visibilitychange', visible) }
  }, [sessionKey, load])
  return confirmed ? <a className="app-button app-button-danger twitch-live-link" href="https://www.twitch.tv/kichnifou" target="_blank" rel="noopener noreferrer"><span className="twitch-live-dot" aria-hidden="true"/><span><span className="sr-only">🔴 </span>Kichni est en Live !</span></a> : null
}
