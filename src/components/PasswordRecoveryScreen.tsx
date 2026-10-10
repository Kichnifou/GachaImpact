import { useEffect, useState } from 'react'
import { getRecoveryClient } from '../infrastructure/supabase/client'
import PasswordForm from './PasswordForm'
import AppButton from './AppButton'

export default function PasswordRecoveryScreen() {
  const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'done'>('loading')
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
  const leave = async () => {
    const { error } = await client.auth.signOut({ scope: 'local' })
    if (error) { setState('invalid'); return }
    location.replace('/')
  }
  return <main className="entry-shell"><section className="entry-panel panel password-recovery-panel" aria-labelledby="recovery-title">
    <h1 id="recovery-title">Réinitialiser mon mot de passe</h1>
    {state === 'loading' && <p role="status">Vérification du lien…</p>}
    {state === 'invalid' && <p role="alert">Ce lien est invalide, expiré ou déjà utilisé. Retournez à la connexion pour demander un nouveau lien.</p>}
    {state === 'ready' && <PasswordForm client={client} onSuccess={async () => {
      // Revoke only this recovery session; the ordinary game session has its own storage.
      await client.auth.signOut({ scope: 'local' }); setState('done')
    }} />}
    {state === 'done' && <p role="status">Votre mot de passe a été modifié. Vous pouvez vous connecter avec le nouveau mot de passe.</p>}
    {state !== 'loading' && <AppButton onClick={() => void leave()}>Retour à la connexion</AppButton>}
  </section></main>
}
