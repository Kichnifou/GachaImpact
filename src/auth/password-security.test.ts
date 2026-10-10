// @vitest-environment happy-dom
// @vitest-environment-options {"url":"http://localhost:5173/"}
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { changePassword, isRecoveryLocation, passwordErrorMessage, recoveryDestination, requestPasswordReset } from './password-security'

function fixture() {
  const auth = { getUser: vi.fn(async () => ({ data: { user: { id: 'same-auth-subject' } }, error: null })),
    updateUser: vi.fn(async () => ({ error: null })), resetPasswordForEmail: vi.fn(async () => ({ error: null })) }
  return { auth, client: { auth } as unknown as SupabaseClient }
}
beforeEach(() => history.replaceState(null, '', 'http://localhost:5173/'))
describe('Supabase password boundary', () => {
  it.each([['short', 'short'], ['long-password', 'different']])('rejects invalid fields without a provider mutation', async (value, confirmation) => {
    const f = fixture(); await expect(changePassword(f.client, value, confirmation)).rejects.toThrow()
    expect(f.auth.getUser).not.toHaveBeenCalled(); expect(f.auth.updateUser).not.toHaveBeenCalled()
  })
  it('validates the actual provider user and changes only the password attributes', async () => {
    const f = fixture(); await changePassword(f.client, 'new-password', 'new-password')
    expect(f.auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password: 'new-password' })
    expect(f.auth.getUser).toHaveBeenCalledOnce()
  })
  it('requires an authenticated provider identity', async () => {
    const f = fixture(); f.auth.getUser.mockResolvedValue({ data: { user: null }, error: null } as never)
    await expect(changePassword(f.client, 'new-password', 'new-password')).rejects.toThrow('session a expiré')
    expect(f.auth.updateUser).not.toHaveBeenCalled()
  })
  it('supports native reauthentication without a second auth or gameplay operation', async () => {
    const f = fixture(); await changePassword(f.client, 'new-password', 'new-password', '123456', 'old-password')
    expect(f.auth.updateUser).toHaveBeenCalledWith({ password: 'new-password', nonce: '123456', current_password: 'old-password' })
  })
  it.each(['weak_password', 'same_password', 'reauthentication_needed', 'reauthentication_not_valid', 'current_password_required', 'current_password_mismatch', 'over_request_rate_limit', 'session_not_found', 'unknown'])('masks provider details: %s', async code => {
    const f = fixture(); f.auth.updateUser.mockResolvedValue({ error: { code, message: 'secret internal detail' } } as never)
    await expect(changePassword(f.client, 'new-password', 'new-password')).rejects.toThrow(passwordErrorMessage(code))
  })
  it('sends only to the fixed standalone/local destination', async () => {
    const f = fixture(); await requestPasswordReset(f.client, ' test@example.com ')
    expect(f.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', { redirectTo: 'http://localhost:5173/auth/recovery' })
    expect(recoveryDestination('https://gachaimpact.pages.dev')).toBe('https://gachaimpact.pages.dev/auth/recovery')
    expect(() => recoveryDestination('https://attacker.example')).toThrow()
  })
  it.each(['', 'bad-address'])('rejects invalid email %s', async email => {
    const f = fixture(); await expect(requestPasswordReset(f.client, email)).rejects.toThrow('valide')
    expect(f.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })
  it.each(['user_not_found', 'email_not_confirmed'])('does not enumerate accounts: %s', async code => {
    const f = fixture(); f.auth.resetPasswordForEmail.mockResolvedValue({ error: { code } } as never)
    await expect(requestPasswordReset(f.client, 'test@example.com')).resolves.toBeUndefined()
  })
  it('does not trust a recovery flag and quarantines native recovery URLs', () => {
    expect(isRecoveryLocation(new URL('https://gachaimpact.pages.dev/?recovery=true'))).toBe(false)
    expect(isRecoveryLocation(new URL('https://gachaimpact.pages.dev/auth/recovery'))).toBe(true)
    expect(isRecoveryLocation(new URL('https://gachaimpact.pages.dev/#type=recovery&access_token=invalid'))).toBe(true)
  })
})
