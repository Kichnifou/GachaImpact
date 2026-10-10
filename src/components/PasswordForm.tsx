import { useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import AppButton from './AppButton'
import { changePassword, PasswordSecurityError } from '../auth/password-security'

export default function PasswordForm({ client, onSuccess }: { client: SupabaseClient; onSuccess?: () => Promise<void> | void }) {
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('')
  const [nonce, setNonce] = useState(''), [currentPassword, setCurrentPassword] = useState('')
  const [needsNonce, setNeedsNonce] = useState(false), [needsCurrent, setNeedsCurrent] = useState(false)
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(false)
  const flight = useRef(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (flight.current) return
    flight.current = true; setPending(true); setError(''); setSuccess(false)
    try {
      await changePassword(client, password, confirmation, nonce, currentPassword)
      setPassword(''); setConfirmation(''); setNonce(''); setCurrentPassword('')
      setNeedsNonce(false); setNeedsCurrent(false); setSuccess(true)
      await onSuccess?.()
    } catch (reason) {
      if (reason instanceof PasswordSecurityError && reason.code === 'reauthentication_needed') {
        setNeedsNonce(true)
        const { error: sendError } = await client.auth.reauthenticate().catch(() => ({ error: true }))
        if (sendError) { setError('Le code n’a pas pu être envoyé. Réessayez dans quelques instants.'); return }
      }
      if (reason instanceof PasswordSecurityError && reason.code === 'current_password_required') setNeedsCurrent(true)
      setError(reason instanceof Error ? reason.message : 'Le changement n’a pas pu aboutir.')
    } finally { flight.current = false; setPending(false) }
  }
  return <form className="entry-form password-form" onSubmit={submit} aria-busy={pending}>
    <label htmlFor="new-password">Nouveau mot de passe</label>
    <input id="new-password" type="password" autoComplete="new-password" required minLength={8} disabled={pending} value={password} onChange={e => setPassword(e.target.value)} />
    <label htmlFor="confirm-new-password">Confirmer le nouveau mot de passe</label>
    <input id="confirm-new-password" type="password" autoComplete="new-password" required minLength={8} disabled={pending} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
    {needsCurrent && <><label htmlFor="current-password">Mot de passe actuel</label><input id="current-password" type="password" autoComplete="current-password" required disabled={pending} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></>}
    {needsNonce && <><label htmlFor="password-nonce">Code reçu par e-mail</label><input id="password-nonce" autoComplete="one-time-code" required disabled={pending} value={nonce} onChange={e => setNonce(e.target.value)} /></>}
    {error && <p className="form-feedback error" role="alert">{error}</p>}
    {success && <p className="form-feedback success" role="status">Votre mot de passe a été modifié.</p>}
    <AppButton type="submit" disabled={pending}>{pending ? 'Modification…' : 'Valider le nouveau mot de passe'}</AppButton>
  </form>
}
