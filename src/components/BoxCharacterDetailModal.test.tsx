// @vitest-environment happy-dom

import { act, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BoxCharacterDto, ExpeditionDto } from '../api/types'
import BoxCharacterDetailModal from './BoxCharacterDetailModal'
import { createExpeditionClientSnapshot } from '../expedition/expedition-client-snapshot'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const character: BoxCharacterDto = { id: 'furina', externalKey: 'furina', name: 'Furina', rarity: 5, elementKey: 'hydro', weaponType: 'Épée', region: 'Fontaine', iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null, constellation: 0, copies: 1, firstObtainedAt: '2026-09-12T12:00:00Z', favorite: false, c6CompetitionStats: null }
const idle: ExpeditionDto = { businessDate: '2040-01-01', operationalStatus: 'IDLE', departureUsedToday: false, canStartToday: true, activeCharacter: null, departedAt: null, readyAt: null, remainingSeconds: 0, startedOnCurrentBusinessDate: false, totalCompleted: '0' }
const shared = { character, stellaQuantity: '0', stellaRetryAvailable: false, favoritePending: false, stellaPending: false, stellaFeedback: null, onUseStella: vi.fn(), onClose: vi.fn() }

afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('BoxCharacterDetailModal Expedition countdown', () => {
  it('keeps one monotonic snapshot across close/reopen and reanchors only on a fresh server projection', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const running: ExpeditionDto = { ...idle, operationalStatus: 'RUNNING', activeCharacter: character, departedAt: '2040-01-01T00:00:00Z', readyAt: '2040-01-01T20:00:00Z', remainingSeconds: 71_420, startedOnCurrentBusinessDate: true, departureUsedToday: true, canStartToday: false }
    const snapshot = createExpeditionClientSnapshot(running, performance.now())
    act(() => root.render(<CountdownHarness key={snapshot.observedAt} snapshot={snapshot} open />))
    expect(container.textContent).toContain('19:50:20')
    expect(container.textContent).not.toMatch(/\d{4,}:/)

    act(() => vi.advanceTimersByTime(5_000))
    expect(container.textContent).toContain('19:50:15')
    act(() => root.render(<CountdownHarness key={snapshot.observedAt} snapshot={snapshot} open={false} />))
    act(() => root.render(<CountdownHarness key={snapshot.observedAt} snapshot={snapshot} open />))
    expect(container.textContent).toContain('19:50:15')
    expect(container.textContent).not.toContain('19:50:20')

    const fresh = createExpeditionClientSnapshot({ ...running, remainingSeconds: 71_390 }, performance.now())
    act(() => root.render(<CountdownHarness key={fresh.observedAt} snapshot={fresh} open />))
    expect(container.textContent).toContain('19:49:50')

    vi.setSystemTime(new Date('1999-01-01T00:00:00Z'))
    act(() => vi.advanceTimersByTime(1_000))
    expect(container.textContent).toContain('19:49:49')
    act(() => root.unmount())
  })
})

function CountdownHarness({ snapshot, open }: { snapshot: ReturnType<typeof createExpeditionClientSnapshot>; open: boolean }) {
  const [monotonicNow, setMonotonicNow] = useState(snapshot.observedAt)
  useEffect(() => {
    const timer = window.setInterval(() => setMonotonicNow(performance.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])
  return open ? <BoxCharacterDetailModal {...shared} expedition={snapshot} expeditionMonotonicNow={monotonicNow} /> : <div>Fiche fermée</div>
}
