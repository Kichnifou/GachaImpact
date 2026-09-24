// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { EventRankingDto } from '../api/types'
import EventRankingSection from './EventRankingSection'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const roots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = []
let visibility = 'visible'
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })

afterEach(() => {
  for (const { root, container } of roots.splice(0)) { act(() => root.unmount()); container.remove() }
  vi.useRealTimers()
  visibility = 'visible'
})

function mount(onLoad: () => Promise<EventRankingDto>, editionId = 'edition-one') {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push({ root, container })
  act(() => root.render(<EventRankingSection editionId={editionId} onLoad={onLoad} />))
  return { root, container }
}
const ranking = (points = 4): EventRankingDto => ({ editionId: 'edition-one', entries: [{ rank: 1, playerId: 'player-one', displayName: 'Un pseudo très très long qui doit rester lisible', points }] })

describe('Event Ranking visible refresh', () => {
  it('shows the active edition publicly with rank, name, points and no reward', async () => {
    const { container } = mount(vi.fn(async () => ranking()))
    await act(async () => { await Promise.resolve() })
    expect(container.querySelectorAll('.event-ranking-list li')).toHaveLength(1)
    expect(container.textContent).toContain('#1')
    expect(container.textContent).toContain('Un pseudo très très long')
    expect(container.textContent).toContain('4 points')
    expect(container.textContent).toContain('Aucune récompense')
  })

  it('polls every three seconds only while visible and refreshes on focus', async () => {
    vi.useFakeTimers()
    const onLoad = vi.fn(async () => ranking(onLoad.mock.calls.length))
    const { container } = mount(onLoad)
    await act(async () => { await Promise.resolve() })
    expect(onLoad).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(onLoad).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('2 points')
    visibility = 'hidden'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await act(async () => { await vi.advanceTimersByTimeAsync(9_000) })
    expect(onLoad).toHaveBeenCalledTimes(2)
    visibility = 'visible'
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve() })
    expect(onLoad).toHaveBeenCalledTimes(3)
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    expect(onLoad).toHaveBeenCalledTimes(4)
  })

  it('does not overlap requests or publish a stale edition after unmount', async () => {
    vi.useFakeTimers()
    let resolveFirst!: (value: EventRankingDto) => void
    const first = new Promise<EventRankingDto>((resolve) => { resolveFirst = resolve })
    const onLoad = vi.fn(() => first)
    const { root, container } = mount(onLoad)
    await act(async () => { await vi.advanceTimersByTimeAsync(12_000); window.dispatchEvent(new Event('focus')) })
    expect(onLoad).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
    roots.splice(roots.findIndex((entry) => entry.root === root), 1)
    container.remove()
    await act(async () => { resolveFirst(ranking()); await Promise.resolve(); await vi.advanceTimersByTimeAsync(6_000) })
    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.event-ranking-list')).toBeNull()
  })

  it('does not restart polling when only the loader callback identity changes', async () => {
    vi.useFakeTimers()
    const onLoad = vi.fn(async () => ranking())
    const { root } = mount(() => onLoad())
    await act(async () => { await Promise.resolve() })
    expect(onLoad).toHaveBeenCalledTimes(1)
    for (let tick = 0; tick < 4; tick += 1) {
      act(() => root.render(<EventRankingSection editionId="edition-one" onLoad={() => onLoad()} />))
    }
    await act(async () => { await Promise.resolve() })
    expect(onLoad).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(onLoad).toHaveBeenCalledTimes(2)
  })
})
