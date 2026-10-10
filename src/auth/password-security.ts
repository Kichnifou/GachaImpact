import type { SupabaseClient, UserAttributes } from '@supabase/supabase-js'

export const recoveryPath = '/auth/recovery'
export const recoveryConfirmation = 'Si un compte correspond à cette adresse, un e-mail de réinitialisation va être envoyé.'

export function isRecoveryLocation(url = new URL(location.href)) {
  return url.pathname === recoveryPath || new URLSearchParams(url.hash.slice(1)).get('type') === 'recovery'
}

export function recoveryDestination(origin = location.origin) {
  // Only the deployed standalone and the documented local development origin.
  if (!['https://gachaimpact.pages.dev', 'http://localhost:5173'].includes(origin)) throw new Error('La récupération est disponible depuis le site officiel du jeu.')
  return `${origin}${recoveryPath}`
}

export class PasswordSecurityError extends Error {
  readonly code: string | undefined
  constructor(code: string | undefined) { super(passwordErrorMessage(code)); this.code = code }
}

export function passwordErrorMessage(code?: string) {
  switch (code) {
    case 'weak_password': return 'Le mot de passe choisi n’est pas assez sécurisé. Utilisez au moins 8 caractères et une combinaison plus variée.'
    case 'same_password': return 'Choisissez un mot de passe différent du précédent.'
    case 'reauthentication_needed': return 'Confirmez votre identité avec le code envoyé par e-mail.'
    case 'reauthentication_not_valid': return 'Le code de confirmation est incorrect ou expiré.'
    case 'current_password_required': return 'Saisissez votre mot de passe actuel pour confirmer ce changement.'
    case 'invalid_credentials': return 'Le mot de passe actuel est incorrect.'
    case 'current_password_mismatch': return 'Le mot de passe actuel est incorrect.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Trop de tentatives. Réessayez dans quelques instants.'
    case 'session_not_found':
    case 'session_expired':
    case 'refresh_token_not_found':
    case 'refresh_token_already_used': return 'Votre session a expiré. Reconnectez-vous ou demandez un nouveau lien.'
    default: return 'La demande n’a pas pu aboutir. Vérifiez votre connexion puis réessayez.'
  }
}

export async function requestPasswordReset(client: SupabaseClient, email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim())) throw new Error('Saisissez une adresse e-mail valide.')
  const destination = recoveryDestination()
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: destination }).catch(() => { throw new PasswordSecurityError(undefined) })
  // Account existence must never be disclosed, including provider-specific responses.
  if (error && !['user_not_found', 'email_not_confirmed'].includes(error.code ?? '')) throw new PasswordSecurityError(error.code)
}

export async function changePassword(client: SupabaseClient, password: string, confirmation: string, nonce?: string, currentPassword?: string) {
  if (password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.')
  if (password !== confirmation) throw new Error('Les deux mots de passe ne correspondent pas.')
  const { data, error: identityError } = await client.auth.getUser().catch(() => { throw new PasswordSecurityError(undefined) })
  if (identityError || !data.user) throw new PasswordSecurityError('session_not_found')
  // Match the physically installed auth-js 2.115.0 UserAttributes/wire contract.
  const attributes: UserAttributes = { password, ...(nonce ? { nonce } : {}), ...(currentPassword ? { current_password: currentPassword } : {}) }
  const { error } = await client.auth.updateUser(attributes).catch(() => { throw new PasswordSecurityError(undefined) })
  if (error) throw new PasswordSecurityError(error.code)
}
