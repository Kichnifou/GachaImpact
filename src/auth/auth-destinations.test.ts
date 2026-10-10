import { afterEach, describe, expect, it, vi } from 'vitest'
import { confirmationDestination, recoveryDestination } from './auth-destinations'
afterEach(() => vi.unstubAllEnvs())
describe('Auth destinations', () => {
  it.each(['https://gachaimpact.pages.dev', 'https://gachaimpact.fr'])('keeps confirmations and recovery on the exact starting origin %s', origin => {
    vi.stubEnv('DEV', false)
    expect(confirmationDestination(origin)).toBe(origin)
    expect(recoveryDestination(origin)).toBe(origin + '/auth/recovery')
  })
  it.each(['https://gachaimpact.fr.evil.example', 'https://www.gachaimpact.fr', 'http://gachaimpact.fr', 'https://user:pass@gachaimpact.fr', 'https://gachaimpact.fr/', 'https://gachaimpact.fr/path', 'https://gachaimpact.fr?next=x', 'https://gachaimpact.fr#x', 'null'])('rejects redirect substitution %s', origin => {
    expect(() => confirmationDestination(origin)).toThrow()
    expect(() => recoveryDestination(origin)).toThrow()
  })
  it('enables localhost only in development', () => {
    vi.stubEnv('DEV', true); expect(recoveryDestination('http://localhost:5173')).toBe('http://localhost:5173/auth/recovery')
    vi.stubEnv('DEV', false); expect(() => recoveryDestination('http://localhost:5173')).toThrow()
  })
})
