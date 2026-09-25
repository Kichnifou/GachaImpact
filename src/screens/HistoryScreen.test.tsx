// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { BannerHistoryDto, EventHistoryDto } from '../api/types'
import HistoryScreen from './HistoryScreen'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const banners: BannerHistoryDto = { category: 'banners', page: 1, pageSize: 10, total: 1, totalPages: 1, entries: [{ id: 'old', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-08T00:00:00Z', status: 'ENDED', featured: [], generationVoteSnapshot: null }] }
const events: EventHistoryDto = { category: 'event', page: 1, pageSize: 10, total: 0, totalPages: 1, entries: [] }
const props = {
  onInvocations: vi.fn(async () => ({ page: 1, pageSize: 10 as const, totalResults: 0, totalPages: 0, hasPrevious: false, hasNext: false, results: [] })),
  onBannersOrEvent: vi.fn(async (category: 'banners' | 'event') => category === 'banners' ? banners : events),
  onBank: vi.fn(async (page: number) => ({ page, totalPages: 0, totalCount: 0, operations: [] })),
  onShop: vi.fn(async (page: number) => ({ page, pageSize: 10 as const, totalPages: 0, totalCount: 0, purchases: [] })),
}
const tab = (container: HTMLElement, name: string) => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent === name)!

describe('HistoryScreen', () => {
  it('keeps empty categories on page one and uses a compact neutral header', async () => {
    const container = document.createElement('div'); const root = createRoot(container)
    try {
      await act(async () => { root.render(<HistoryScreen {...props} />); await Promise.resolve() })
      expect(container.textContent).toContain('ARCHIVES')
      expect(container.textContent).toContain('Historique')
      expect(container.textContent).not.toContain('Retrouvez vos activités')
      for (const category of ['Invocations', 'Banque', 'Boutique']) {
        if (category !== 'Invocations') await act(async () => { tab(container, category).click(); await Promise.resolve() })
        expect(container.textContent).toContain('Page 1 / 1')
        expect(container.textContent).not.toContain('Page 1 / 0')
      }
    } finally { act(() => root.unmount()); vi.clearAllMocks() }
  })

  it('loads only the selected category and shows unavailable legacy banner votes', async () => {
    const container = document.createElement('div'); const root = createRoot(container)
    try {
      await act(async () => { root.render(<HistoryScreen {...props} initialCategory="banners" />); await Promise.resolve() })
      expect(props.onBannersOrEvent).toHaveBeenLastCalledWith('banners', 1)
      expect(props.onInvocations).not.toHaveBeenCalled()
      expect(container.textContent).toContain('Snapshot détaillé des votes indisponible')
      await act(async () => { tab(container, 'Banque').click(); await Promise.resolve() })
      expect(props.onBank).toHaveBeenLastCalledWith(1, undefined)
      await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Filtrer les opérations bancaires"] button')].find(button => button.textContent === 'Dépôts')!.click(); await Promise.resolve() })
      expect(props.onBank).toHaveBeenLastCalledWith(1, 'DEPOSIT')
    } finally { act(() => root.unmount()); vi.clearAllMocks() }
  })

  it('ignores an obsolete response and clears the prior category after an error', async () => {
    const container = document.createElement('div'); const root = createRoot(container)
    let resolveBanners!: (value: BannerHistoryDto) => void
    const onBannersOrEvent = vi.fn((category: 'banners' | 'event') => category === 'banners'
      ? new Promise<BannerHistoryDto>(resolve => { resolveBanners = resolve })
      : Promise.reject(new Error('Event indisponible')))
    try {
      await act(async () => { root.render(<HistoryScreen {...props} onBannersOrEvent={onBannersOrEvent} initialCategory="banners" />); await Promise.resolve() })
      await act(async () => { tab(container, 'Event').click(); await Promise.resolve() })
      await act(async () => { resolveBanners(banners); await Promise.resolve() })
      expect(container.querySelector('[role="alert"]')).not.toBeNull()
      expect(container.textContent).not.toContain('Snapshot détaillé des votes')
    } finally { act(() => root.unmount()) }
  })
})
