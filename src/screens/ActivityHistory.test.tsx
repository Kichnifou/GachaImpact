// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import ActivityHistory, { activityRanges } from './ActivityHistory'
import type { ActivityHistoryDto, ActivityPlayersDto, ActivityRange } from '../api/types'
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const value: ActivityHistoryDto = { category: 'activity', page: 1, total: 2, totalPages: 1, pageSize: 10, today: '2026-10-14', coverageStartedAt: '2026-10-13T07:21:41Z', entries: [{ date: '2026-10-14', count: 3, today: true, status: 'COVERED' }, { date: '2026-10-13', count: 0, today: false, status: 'PARTIAL' }] }
const click = async (button: HTMLElement) => act(async () => button.click())
describe('Daily activity interactions', () => {
  it('opens several days independently, reports hidden names and retries the same cursor without skipping', async () => {
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
    const reader = vi.fn(async (date: string, after?: string): Promise<ActivityPlayersDto> => ({ date, total: 3, visibleTotal: 2, nextCursor: after ? null : 'cursor', names: after ? ['長い名前 🌙'] : ['Éloïse'] }))
    try {
      await act(async () => root.render(<ActivityHistory value={value} onPlayers={reader} />))
      expect(host.textContent).not.toContain('partielle')
      const buttons = host.querySelectorAll<HTMLButtonElement>('.activity-players-toggle')
      await click(buttons[0]!)
      expect(buttons[0]!.getAttribute('aria-expanded')).toBe('true')
      expect(host.textContent).toContain('Éloïse')
      expect(host.textContent).toContain('Certains pseudos ne sont pas visibles')
      reader.mockRejectedValueOnce(new Error('Échec de lecture'))
      await click([...host.querySelectorAll('button')].find(b => b.textContent === 'Afficher la suite')!)
      expect(host.querySelector('[role="alert"]')).not.toBeNull()
      expect([...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Afficher la suite')!.disabled).toBe(true)
      await click([...host.querySelectorAll('button')].find(b => b.textContent === 'Réessayer')!)
      expect(reader.mock.calls.slice(-2).map(call => call[1])).toEqual(['cursor', 'cursor'])
      expect(host.textContent).toContain('長い名前 🌙')
      await click(buttons[1]!)
      expect([...host.querySelectorAll('.activity-players-toggle')].every(b => b.getAttribute('aria-expanded') === 'true')).toBe(true)
      await click(buttons[0]!)
      expect(buttons[0]!.getAttribute('aria-expanded')).toBe('false')
      expect(buttons[1]!.getAttribute('aria-expanded')).toBe('true')
    } finally { act(() => root.unmount()); host.remove() }
  })
  it('loads the nine real ranges, shows a single point and exact data, restores focus and closes with Escape', async () => {
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
    const onStatistics = vi.fn(async (range: ActivityRange) => ({ range, today: '2026-10-13', coverageStartedAt: value.coverageStartedAt, entries: [{ date: '2026-10-13', count: 2, today: true }] }))
    try {
      await act(async () => root.render(<ActivityHistory value={value} onStatistics={onStatistics} />))
      const trigger = host.querySelector<HTMLButtonElement>('.activity-statistics-link')!; trigger.focus()
      await click(trigger)
      expect(onStatistics).toHaveBeenCalledWith('10d')
      expect(document.body.style.overflow).toBe('hidden')
      expect(document.querySelectorAll('svg circle')).toHaveLength(1)
      expect(document.querySelector('svg polyline')).toBeNull()
      const select = document.querySelector<HTMLSelectElement>('.activity-range select')!
      expect([...select.options].map(o => o.textContent)).toEqual(activityRanges.map(row => row[1]))
      for (const [range] of activityRanges) {
        await act(async () => { select.value = range; select.dispatchEvent(new Event('change', { bubbles: true })) })
        expect(document.querySelectorAll('svg circle')).toHaveLength(1)
        expect(document.querySelector('tbody')).toBeNull()
        expect(document.querySelector('output')?.textContent).toContain('13 octobre 2026')
      }
      const explore = document.querySelector<HTMLInputElement>('input[type="range"]')!
      explore.focus()
      expect(explore.getAttribute('aria-valuetext')).toContain('2 joueurs actifs')
      await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      expect(document.activeElement).toBe(trigger)
      expect(document.body.style.overflow).toBe('')
    } finally { act(() => root.unmount()); host.remove() }
  })
  it('keeps a graph frame while switching ranges, rejects obsolete responses and retains errors inside it', async () => {
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
    const pending = new Map<string, { resolve: (v: unknown) => void; reject: (v: unknown) => void }>()
    const reader = vi.fn((range: ActivityRange) => new Promise((resolve, reject) => pending.set(range, { resolve, reject })))
    const series = (range: ActivityRange, count: number) => ({ range, today: '2026-10-13', coverageStartedAt: value.coverageStartedAt, entries: [{ date: '2026-10-13', count, today: true }] })
    try {
      await act(async () => root.render(<ActivityHistory value={value} onStatistics={reader as never} />))
      await click(host.querySelector('.activity-statistics-link')!)
      const frame = document.querySelector('.activity-chart-region')!
      expect(frame).not.toBeNull()
      await act(async () => pending.get('10d')!.resolve(series('10d', 2)))
      const select = document.querySelector<HTMLSelectElement>('select')!
      const change = async (range: string) => act(async () => { select.value = range; select.dispatchEvent(new Event('change', { bubbles: true })) })
      await change('1m')
      expect(document.querySelector('.activity-chart-region')).toBe(frame)
      expect(frame.getAttribute('aria-busy')).toBe('true')
      expect(document.querySelector('output')).toBeNull()
      await change('5d')
      await act(async () => pending.get('5d')!.resolve(series('5d', 7)))
      await act(async () => pending.get('1m')!.resolve(series('1m', 99)))
      expect(document.querySelector('output')?.textContent).toContain('7 joueurs')
      expect(document.body.textContent).not.toContain('99 joueurs')
      await change('all')
      await act(async () => pending.get('all')!.reject(new Error('Lecture interrompue')))
      expect(document.querySelector('.activity-chart-region')).toBe(frame)
      expect(frame.querySelector('[role="alert"]')?.textContent).toContain('Réessayer')
      expect(document.querySelector('.activity-exact-data')).toBeNull()
    } finally { act(() => root.unmount()); host.remove() }
  })
});
