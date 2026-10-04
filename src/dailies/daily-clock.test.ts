import { expect, it } from 'vitest'
import { nextParisMidnight, resetCountdownMessage } from './daily-clock'

it.each([
  ['2026-01-15T22:33:00Z', '2026-01-15T23:00:00Z'],
  ['2026-07-15T21:33:00Z', '2026-07-15T22:00:00Z'],
  ['2026-03-28T23:00:00Z', '2026-03-29T22:00:00Z'],
  ['2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z'],
  ['2026-03-28T22:33:00Z', '2026-03-28T23:00:00Z'],
  ['2026-10-24T21:33:00Z', '2026-10-24T22:00:00Z'],
])('uses Paris midnight, including CET/CEST and DST, at %s', (instant, reset) => {
  expect(nextParisMidnight(Date.parse(instant))).toBe(Date.parse(reset))
})
it('formats minutes without seconds and stops at zero until authoritative revalidation', () => {
  const now = Date.parse('2026-10-03T21:33:00Z')
  expect(resetCountdownMessage(nextParisMidnight(now), now)).toBe('Réinitialisation dans 27 min')
  expect(resetCountdownMessage(now + (5 * 60 + 27) * 60_000, now)).toBe('Réinitialisation dans 5 h 27 min')
  expect(resetCountdownMessage(now, now + 1000)).toBe('Réinitialisation dans 0 min')
})
