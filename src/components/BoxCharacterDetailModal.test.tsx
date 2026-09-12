// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BoxCharacterDto, ExpeditionDto } from '../api/types'
import BoxCharacterDetailModal from './BoxCharacterDetailModal'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const character: BoxCharacterDto = { id: 'furina', externalKey: 'furina', name: 'Furina', rarity: 5, elementKey: 'hydro', weaponType: 'Épée', region: 'Fontaine', iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null, constellation: 0, copies: 1, firstObtainedAt: '2026-09-12T12:00:00Z', favorite: false, c6CompetitionStats: null }
const idle: ExpeditionDto = { businessDate: '2040-01-01', operationalStatus: 'IDLE', departureUsedToday: false, canStartToday: true, activeCharacter: null, departedAt: null, readyAt: null, remainingSeconds: 0, startedOnCurrentBusinessDate: false, totalCompleted: '0' }
const shared = { character, stellaQuantity: '0', stellaRetryAvailable: false, favoritePending: false, stellaPending: false, stellaFeedback: null, onUseStella: vi.fn(), onClose: vi.fn() }

afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('BoxCharacterDetailModal Expedition countdown', () => {
  it('reanchors immediately on IDLE to RUNNING and follows remainingSeconds despite client clock skew', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    act(() => root.render(<BoxCharacterDetailModal {...shared} expedition={idle} />))

    const running: ExpeditionDto = { ...idle, operationalStatus: 'RUNNING', activeCharacter: character, departedAt: '2040-01-01T00:00:00Z', readyAt: '2040-01-01T20:00:00Z', remainingSeconds: 72_000, startedOnCurrentBusinessDate: true, departureUsedToday: true, canStartToday: false }
    act(() => root.render(<BoxCharacterDetailModal {...shared} expedition={running} />))
    expect(container.textContent).toContain('20:00:00')
    expect(container.textContent).not.toMatch(/\d{4,}:/)

    act(() => vi.advanceTimersByTime(1_000))
    expect(container.textContent).toContain('19:59:59')
    act(() => root.unmount())
  })
})
