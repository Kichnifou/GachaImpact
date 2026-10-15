import { describe, expect, it } from 'vitest'
import { formatLocalWindow } from './local-window'
describe('local Event windows', () => {
  it('converts instants during different Europe/Canada DST weeks', () => {
    expect(formatLocalWindow('2026-10-28T12:00:00Z', '2026-10-28T14:00:00Z', 'Europe/Paris')).toBe('13:00 – 15:00')
    expect(formatLocalWindow('2026-10-28T12:00:00Z', '2026-10-28T14:00:00Z', 'America/Toronto')).toBe('08:00 – 10:00')
    expect(formatLocalWindow('2026-11-02T12:00:00Z', '2026-11-02T14:00:00Z', 'America/Toronto')).toBe('07:00 – 09:00')
  })
  it('includes dates for a local midnight crossing and handles unavailable zones', () => {
    expect(formatLocalWindow('2026-10-15T03:00:00Z', '2026-10-15T05:00:00Z', 'America/Toronto')).toContain('14/10/2026')
    expect(formatLocalWindow('2026-10-15T03:00:00Z', '2026-10-15T05:00:00Z', 'America/Toronto')).toContain('15/10/2026')
    expect(formatLocalWindow('2026-10-15T03:00:00Z', '2026-10-15T05:00:00Z', 'invalid')).toContain('(UTC)')
  })
})
