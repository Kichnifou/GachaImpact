// @vitest-environment happy-dom
// @vitest-environment-options {"url":"http://localhost:5173/"}
import { afterEach, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined
afterEach(async () => { await client?.auth.stopAutoRefresh(); vi.unstubAllGlobals(); localStorage.clear(); history.replaceState(null, '', '/') })
const token = () => [btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), btoa(JSON.stringify({ sub: 'verified-auth-id', exp: Math.floor(Date.now()/1000)+3600 })), 'fake-signature'].join('.')
it('uses the installed native implicit callback and PASSWORD_RECOVERY event without replacing ordinary storage', async () => {
  localStorage.setItem('ordinary-game-session', 'unchanged-game-session')
  location.hash = `access_token=${token()}&refresh_token=fake-refresh-token&token_type=bearer&expires_in=3600&type=recovery`
  const fetcher = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify({ id: 'verified-auth-id', email: 'test@example.com', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  client = createClient('https://synthetic.supabase.co', 'synthetic-publishable-key', { auth: { storageKey: 'synthetic-recovery', autoRefreshToken: false }, global: { fetch: fetcher } })
  const events: string[] = []; client.auth.onAuthStateChange(event => { events.push(event) })
  expect((await client.auth.initialize()).error).toBeNull()
  await vi.waitFor(() => expect(events).toContain('PASSWORD_RECOVERY'))
  expect((await client.auth.getUser()).data.user?.id).toBe('verified-auth-id')
  expect(localStorage.getItem('ordinary-game-session')).toBe('unchanged-game-session')
  expect(localStorage.getItem('synthetic-recovery')).toContain('verified-auth-id')
  expect(location.hash).toBe('')
  expect(fetcher.mock.calls.every(args => String(args[0]).includes('/auth/v1/user'))).toBe(true)
})
it('rejects an invalid native callback, including provider details, without accepting a recovery URL flag', async () => {
  location.hash = 'error=access_denied&error_code=otp_expired&error_description=synthetic-private-detail&type=recovery'
  client = createClient('https://synthetic.supabase.co', 'synthetic-publishable-key', { auth: { storageKey: 'synthetic-invalid', autoRefreshToken: false }, global: { fetch: vi.fn() } })
  expect((await client.auth.initialize()).error).not.toBeNull()
  expect(localStorage.getItem('synthetic-invalid')).toBeNull()
})
