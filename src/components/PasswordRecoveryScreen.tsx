import { useEffect, useState } from 'react'
import { getRecoveryClient } from '../infrastructure/supabase/client'
import PasswordForm from './PasswordForm'
import AppButton from './AppButton'

export default function PasswordRecoveryScreen() {
  const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'done'>('loading')
  const [exitError, setExitError] = useState('')
  const [client] = useState(getRecoveryClient)
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const { error } = await client.auth.initialize()
        // A failed callback must never fall back to a previous stored session.
        if (error) { if (active) setState('invalid'); return }
        const { data, error: identityError } = await client.auth.getUser()
        if (active) setState(!identityError && data.user ? 'ready' : 'invalid')
      } catch { if (active) setState('invalid') }
      finally { history.replaceState(history.state, '', '/auth/recovery') }
    })()
    return () => { active = false }
  }, [client])
  const closeSession = async () => {
    const { error } = await client.auth.signOut({ scope: 'local' }).catch(() => ({ error: true }))
    setExitError(error ? 'La fermeture de la session de récupération n’a pas pu être confirmée. Réessayez avec « Retour à la connexion ».' : '')
    return !error
  }
  const leave = async () => {
    if (!await closeSession()) { if (state !== 'done') setState('invalid'); return }
    location.replace('/')
  }
  return <main className="entry-shell"><section className="entry-panel panel password-recovery-panel" aria-labelledby="recovery-title">
    <h1 id="recovery-title">Réinitialiser mon mot de passe</h1>
    {state === 'loading' && <p role="status">Vérification du lien…</p>}
    {state === 'invalid' && <p role="alert">Ce lien est invalide, expiré ou déjà utilisé. Retournez à la connexion pour demander un nouveau lien.</p>}
    {state === 'ready' && <PasswordForm client={client} onSuccess={async () => {
      // Revoke only this recovery session; the ordinary game session has its own storage.
      await closeSession(); setState('done')
    }} />}
    {state === 'done' && <p role="status">Votre mot de passe a été modifié. Vous pouvez vous connecter avec le nouveau mot de passe.</p>}
    {exitError && <p role="alert">{exitError}</p>}
    {state !== 'loading' && <AppButton className="auth-secondary-link" onClick={() => void leave()}>Retour à la connexion</AppButton>}
  </section></main>
}
