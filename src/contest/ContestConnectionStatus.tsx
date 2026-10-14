import { useEffect, useState } from 'react'
import AppButton from '../components/AppButton'

// Presentation threshold only: never a network/SQL timeout or business deadline.
export const CONTEST_PERSISTENT_WAIT_MS = 60_000

export default function ContestConnectionStatus({ waiting, error, pending, retry }: {
  waiting: boolean; error: string | null; pending?: boolean; retry?: () => Promise<unknown>
}) {
  const [persistent, setPersistent] = useState(false)
  const [offline, setOffline] = useState(() => navigator.onLine === false)
  useEffect(() => {
    if (!waiting) { setPersistent(false); return }
    const timer = window.setTimeout(() => setPersistent(true), CONTEST_PERSISTENT_WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [waiting])
  useEffect(() => {
    const update = () => setOffline(navigator.onLine === false)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  const denied = error?.includes('refusé') || error?.includes('Reconnectez-vous')
  const message = offline ? 'Connexion interrompue. La reprise sera automatique.' : denied ? error
    : persistent && waiting ? (error ?? 'La réponse du Concours tarde à arriver. La reprise reste automatique.') : null
  return <>
    {waiting && <span className="sr-only" role="status">Actualisation du Concours en cours.</span>}
    {message && <div className="contest-connection-status" role="status"><span>{message}</span>
      {!denied && retry && <AppButton disabled={pending} onClick={() => { void retry().catch(() => undefined) }}>Vérifier la connexion</AppButton>}
    </div>}
  </>
}
