// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { clearTwitchReturn, readTwitchReturn, rememberTwitchLink, twitchReturnContext } from './twitch-return'
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); sessionStorage.clear(); history.replaceState(null, '', '/') })
it('accepts only bounded callback outcomes, without granting any account authority', () => {
  for (const outcome of ['connected', 'progression-choice', 'profile-recovered', 'error', 'TWITCH_OAUTH_EXPIRED']) {
    history.replaceState(null, '', `/?twitch=${outcome}`); expect(readTwitchReturn()).toBe(outcome)
  }
  history.replaceState(null, '', '/?twitch=https://evil.example'); expect(readTwitchReturn()).toBeNull()
})
it('binds the navigation context to its subject and expires or rejects future timestamps', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z'))
  rememberTwitchLink('owner', 'player'); expect(twitchReturnContext('owner')).toBe('initiated'); expect(twitchReturnContext('other')).toBe('stale')
  vi.setSystemTime(new Date('2026-10-15T10:16:00Z')); expect(twitchReturnContext('owner')).toBe('stale')
  vi.setSystemTime(new Date('2026-10-15T09:59:00Z')); expect(twitchReturnContext('owner')).toBe('stale')
})
it('consumes only the return data and preserves unrelated query parameters and history state', () => {
  rememberTwitchLink('owner', 'player'); history.replaceState({ keep: true }, '', '/?keep=1&twitch=connected#configuration')
  clearTwitchReturn(true); expect(location.search).toBe('?keep=1'); expect(location.hash).toBe('#home'); expect(history.state).toEqual({ keep: true }); expect(twitchReturnContext('owner')).toBe('unrecorded')
})
it('continues OAuth without storage while treating unreadable context as stale', () => {
  vi.stubGlobal('sessionStorage', { setItem: () => { throw Error('unavailable') }, getItem: () => { throw Error('unavailable') } })
  expect(() => rememberTwitchLink('owner', 'player')).not.toThrow()
  expect(twitchReturnContext('owner')).toBe('stale')
})
