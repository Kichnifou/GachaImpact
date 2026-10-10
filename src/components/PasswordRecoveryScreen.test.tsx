// @vitest-environment happy-dom
// @vitest-environment-options {"url":"http://localhost:5173/"}
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import PasswordForm from './PasswordForm'
import AuthScreen from './AuthScreen'
import { AuthContext, type AuthContextValue } from '../auth/auth-context'
import type { SupabaseClient } from '@supabase/supabase-js'

const f = vi.hoisted(() => ({ auth: { initialize: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), resetPasswordForEmail: vi.fn(), reauthenticate: vi.fn() }, gameplay: vi.fn(), normal: vi.fn() }))
vi.mock('../infrastructure/supabase/client', () => ({ getRecoveryClient: () => ({ auth: f.auth }), getSupabaseClient: f.normal }))
vi.mock('../AppBootstrap', () => ({ default: () => { f.gameplay(); return <p>gameplay</p> } }))
vi.mock('../auth/AuthProvider', () => ({ AuthProvider: ({ children }: { children: React.ReactNode }) => { f.normal(); return children } }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let container: HTMLDivElement, root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.clearAllMocks(); history.replaceState(null, '', 'http://localhost:5173/auth/recovery')
  f.auth.initialize.mockResolvedValue({ error: null }); f.auth.getUser.mockResolvedValue({ data: { user: { id: 'unchanged' } }, error: null })
  f.auth.updateUser.mockResolvedValue({ error: null }); f.auth.signOut.mockResolvedValue({ error: null })
  f.auth.resetPasswordForEmail.mockResolvedValue({ error: null }); f.normal.mockReturnValue({ auth: f.auth })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove() })
async function fill(id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`)!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
}
async function submit() { await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve() }) }
it('isolates callback before AuthProvider and all gameplay, including native signed-in sessions and reload', async () => {
  for (let attempt = 0; attempt < 2; attempt++) {
    await act(async () => { root.render(<App key={attempt} />) })
    expect(container.textContent).toContain('Nouveau mot de passe')
    expect(f.gameplay).not.toHaveBeenCalled(); expect(f.normal).not.toHaveBeenCalled()
  }
  expect(location.hash).toBe(''); expect(location.search).toBe('')
})
it.each(['expired', 'already-used', 'invalid-token'])('rejects callback %s even with an old stored session', async code => {
  f.auth.initialize.mockResolvedValue({ error: { code } })
  await act(async () => root.render(<App />))
  expect(container.textContent).toContain('invalide, expiré ou déjà utilisé')
  expect(f.auth.getUser).not.toHaveBeenCalled(); expect(f.auth.updateUser).not.toHaveBeenCalled(); expect(f.gameplay).not.toHaveBeenCalled()
})
it('rejects missing provider identity and never bootstraps a Player', async () => {
  f.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
  await act(async () => root.render(<App />))
  expect(container.querySelector('form')).toBeNull(); expect(f.gameplay).not.toHaveBeenCalled()
})
it('validates confirmation, clears secrets after success and revokes only the recovery session', async () => {
  await act(async () => root.render(<App />))
  await fill('new-password', 'test-password'); await fill('confirm-new-password', 'different-password'); await submit()
  expect(f.auth.updateUser).not.toHaveBeenCalled()
  await fill('confirm-new-password', 'test-password'); await submit()
  expect(f.auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password: 'test-password' })
  expect(f.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  expect(container.querySelector('input')).toBeNull(); expect(container.textContent).toContain('Votre mot de passe a été modifié')
})
it('prevents double submission until the provider finishes', async () => {
  let finish!: (value: unknown) => void
  f.auth.updateUser.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await act(async () => root.render(<PasswordForm client={{ auth: f.auth } as unknown as SupabaseClient} />))
  await fill('new-password', 'test-password'); await fill('confirm-new-password', 'test-password')
  await submit(); await submit(); expect(f.auth.updateUser).toHaveBeenCalledOnce()
  expect(container.querySelector('button')!.disabled).toBe(true)
  await act(async () => finish({ error: null }))
  expect(container.querySelector<HTMLInputElement>('#new-password')!.value).toBe('')
})
it.each(['returned', 'thrown'])('reports unconfirmed recovery sign-out (%s) separately from a successful password update', async failure => {
  if (failure === 'returned') f.auth.signOut.mockResolvedValue({ error: { message: 'secret-provider-detail' } })
  else f.auth.signOut.mockRejectedValue(new Error('secret-provider-detail'))
  await act(async () => root.render(<App />))
  await fill('new-password', 'test-password'); await fill('confirm-new-password', 'test-password'); await submit()
  expect(f.auth.updateUser).toHaveBeenCalledOnce()
  expect(container.querySelector('form')).toBeNull()
  expect(container.textContent).toContain('Votre mot de passe a été modifié')
  expect(container.textContent).toContain('La fermeture de la session de récupération n’a pas pu être confirmée')
  expect(container.textContent).not.toContain('secret-provider-detail')
  await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Retour à la connexion')!.click())
  expect(f.auth.signOut).toHaveBeenCalledTimes(2)
  expect(f.gameplay).not.toHaveBeenCalled()
})
it('reuses login email, returns to login and shows a neutral recovery confirmation', async () => {
  history.replaceState(null, '', 'http://localhost:5173/')
  const auth = { signIn: vi.fn(), signUp: vi.fn() } as unknown as AuthContextValue
  await act(async () => root.render(<AuthContext value={auth}><AuthScreen /></AuthContext>))
  await fill('auth-email', 'test@example.com')
  await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Mot de passe oublié ?')!.click())
  expect(container.querySelector<HTMLInputElement>('#auth-email')!.value).toBe('test@example.com')
  expect(container.querySelector('#auth-password')).toBeNull(); await submit()
  expect(container.textContent).toContain('Si un compte correspond à cette adresse')
  await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Retour à la connexion')!.click())
  expect(container.querySelector('#auth-password')).not.toBeNull()
})
it.each(['login', 'register'])('preserves the existing %s provider call', async mode => {
  const auth = { signIn: vi.fn(), signUp: vi.fn(async () => ({ confirmationRequired: true })) } as unknown as AuthContextValue
  await act(async () => root.render(<AuthContext value={auth}><AuthScreen /></AuthContext>))
  if (mode === 'register') await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Créer un compte')!.click())
  await fill('auth-email', 'test@example.com'); await fill('auth-password', 'test-password')
  if (mode === 'register') await fill('auth-password-confirmation', 'test-password')
  await submit()
  expect(mode === 'register' ? auth.signUp : auth.signIn).toHaveBeenCalledExactlyOnceWith('test@example.com', 'test-password')
  expect(f.auth.updateUser).not.toHaveBeenCalled()
})
it('uses a native nonce and supports an explicit current-password requirement', async () => {
  f.auth.updateUser.mockResolvedValueOnce({ error: { code: 'reauthentication_needed', message: 'internal-detail' } }).mockResolvedValueOnce({ error: { code: 'current_password_required' } }).mockResolvedValue({ error: null })
  f.auth.reauthenticate.mockResolvedValue({ error: null })
  await act(async () => root.render(<PasswordForm client={{ auth: f.auth } as unknown as SupabaseClient} />))
  await fill('new-password', 'test-password'); await fill('confirm-new-password', 'test-password'); await submit()
  expect(f.auth.reauthenticate).toHaveBeenCalledOnce(); expect(container.textContent).not.toContain('internal-detail')
  await fill('password-nonce', '123456'); await submit()
  await fill('current-password', 'old-test-password'); await submit()
  expect(f.auth.updateUser).toHaveBeenLastCalledWith({ password: 'test-password', nonce: '123456', current_password: 'old-test-password' })
  expect(container.querySelector<HTMLInputElement>('#current-password')).toBeNull()
})
it('handles a network failure while sending a reauthentication code without leaking provider details', async () => {
  f.auth.updateUser.mockResolvedValue({ error: { code: 'reauthentication_needed' } })
  f.auth.reauthenticate.mockRejectedValueOnce(new Error('secret-internal-network-detail')).mockResolvedValue({ error: null })
  await act(async () => root.render(<PasswordForm client={{ auth: f.auth } as unknown as SupabaseClient} />))
  await fill('new-password', 'test-password'); await fill('confirm-new-password', 'test-password'); await submit()
  expect(container.textContent).toContain('Le code n’a pas pu être envoyé')
  expect(container.textContent).not.toContain('secret-internal')
  expect(container.querySelector('button')!.disabled).toBe(false)
  expect(container.querySelector('#password-nonce')).toBeNull()
  expect(container.querySelector('form')!.checkValidity()).toBe(true)
  await submit()
  expect(f.auth.reauthenticate).toHaveBeenCalledTimes(2)
  expect(container.querySelector('#password-nonce')).not.toBeNull()
})
it('resends an expired nonce independently of form validation and prevents concurrent resends', async () => {
  f.auth.updateUser.mockResolvedValue({ error: { code: 'reauthentication_needed' } })
  f.auth.reauthenticate.mockResolvedValueOnce({ error: null })
  await act(async () => root.render(<PasswordForm client={{ auth: f.auth } as unknown as SupabaseClient} />))
  await fill('new-password', 'test-password'); await fill('confirm-new-password', 'test-password'); await submit()
  expect(container.querySelector('form')!.checkValidity()).toBe(false)
  let finish!: (value: unknown) => void
  f.auth.reauthenticate.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const resend = [...container.querySelectorAll('button')].find(b => b.textContent === 'Renvoyer le code')!
  await act(async () => { resend.click(); resend.click() })
  expect(f.auth.reauthenticate).toHaveBeenCalledTimes(2)
  expect(resend.disabled).toBe(true)
  await act(async () => finish({ error: null }))
  expect(container.textContent).toContain('Un nouveau code de confirmation a été envoyé')
  expect(resend.disabled).toBe(false)
  expect(f.auth.updateUser).toHaveBeenCalledTimes(1)
})
