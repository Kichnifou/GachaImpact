// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth, type AuthContextValue } from './auth-context'
const auth = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: { session: { user: { id: 'same-supabase-subject' } } }, error: null })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
  signInWithPassword: vi.fn(async () => ({ error: null })), signOut: vi.fn(async () => ({ error: null })),
}))
vi.mock('../infrastructure/supabase/client', () => ({ getSupabaseClient: () => ({ auth }) }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
it.each(['https://gachaimpact.pages.dev', 'https://gachaimpact.fr'])('uses native signup on %s with a safe same-origin confirmation and unchanged sign-in/session', async origin => {
  vi.stubGlobal('location', { origin })
  const root = createRoot(document.createElement('div')); let value: AuthContextValue | undefined
  function Harness() { value = useAuth(); return null }
  try {
    await act(async () => { root.render(<AuthProvider><Harness /></AuthProvider>); await Promise.resolve() })
    expect(value?.session?.user.id).toBe('same-supabase-subject')
    await expect(value!.signUp('fixture@example.com', 'simulated-password')).resolves.toEqual({ confirmationRequired: true })
    expect(auth.signUp).toHaveBeenCalledExactlyOnceWith({ email: 'fixture@example.com', password: 'simulated-password', options: { emailRedirectTo: origin } })
    await value!.signIn('fixture@example.com', 'simulated-password')
    expect(auth.signInWithPassword).toHaveBeenCalledExactlyOnceWith({ email: 'fixture@example.com', password: 'simulated-password' })
    expect(value?.session?.user.id).toBe('same-supabase-subject')
  } finally { act(() => root.unmount()) }
})
it('rejects an untrusted signup origin before calling Supabase', async () => {
  vi.stubGlobal('location', { origin: 'https://attacker.example' })
  const root = createRoot(document.createElement('div')); let value: AuthContextValue | undefined
  function Harness() { value = useAuth(); return null }
  try {
    await act(async () => { root.render(<AuthProvider><Harness /></AuthProvider>); await Promise.resolve() })
    await expect(value!.signUp('fixture@example.com', 'simulated-password')).rejects.toThrow('site officiel')
    expect(auth.signUp).not.toHaveBeenCalled()
  } finally { act(() => root.unmount()) }
})
