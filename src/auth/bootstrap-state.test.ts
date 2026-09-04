import { describe, expect, it } from 'vitest'

import type { PlayerDto, WheelTodayDto } from '../api/types'
import { resolveBootstrapStage } from './bootstrap-state'

const player = (elementKey: PlayerDto['elementKey']): PlayerDto => ({
  id: 'player-1',
  displayName: 'Kichnifou',
  elementKey,
  status: 'ACTIVE',
})

describe('application bootstrap stages', () => {
  it('shows authentication when signed out', () => {
    expect(resolveBootstrapStage('signedOut', null, false)).toBe('signedOut')
  })

  it('requires display-name onboarding when no Player exists', () => {
    expect(resolveBootstrapStage('signedIn', null, true)).toBe('onboarding')
  })

  it('requires a permanent element for a Player without one', () => {
    expect(resolveBootstrapStage('signedIn', player(null), true)).toBe('elementRequired')
  })

  it('enters the existing game shell for a complete Player', () => {
    expect(resolveBootstrapStage('signedIn', player('hydro'), true)).toBe('ready')
  })

  it.each([
    { spun: false, businessDate: '2026-09-05', result: null },
    {
      spun: true,
      businessDate: '2026-09-05',
      result: { resultType: 'moras', resourceKey: 'moras', amount: '50000' },
    },
  ] satisfies WheelTodayDto[])('accepts both unused and already-used Wheel bootstrap states', (wheelToday) => {
    expect(wheelToday.businessDate).toBe('2026-09-05')
    expect(resolveBootstrapStage('signedIn', player('hydro'), true, true)).toBe('ready')
  })

  it('waits for resources and the daily Wheel state before entering the shell', () => {
    expect(resolveBootstrapStage('signedIn', player('hydro'), true, false)).toBe('loading')
  })
})
