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
  it.each([
    ['COMPLETED', 'Gagnant du tirage : Hors Top 10'],
    ['NO_ELIGIBLE', 'Aucun gagnant — aucun participant éligible.'],
    ['PENDING', 'Tirage en cours de finalisation.'], ['FROZEN', 'Tirage en cours de finalisation.'],
    ['NOT_RECORDED', 'Aucun tirage enregistré pour cette édition.'],
  ])('shows public draw state %s after Top 10 and before the personal edition', async (status, expected) => {
    const container = document.createElement('div'); const root = createRoot(container)
    const value: EventHistoryDto = { ...events, total: 1, entries: [{ id: 'edition', festival: 'Festival figé', month: 10, year: 2026, startsAt: '2026-10-01', endsAt: '2026-11-01', participantCount: 11,
      top: [{ rank: 1, playerId: 'rank-one', displayName: 'Premier', points: 999 }], personal: null,
      draw: { status, winnerName: status === 'COMPLETED' ? 'Hors Top 10' : null, reward: status === 'COMPLETED' ? { itemKey: 'masterless-stella-fortuna', displayName: 'Masterless Stella Fortuna', amount: 1 } : null } }] }
    try {
      await act(async () => { root.render(<HistoryScreen {...props} initialCategory="event" onBannersOrEvent={async () => value} />) })
      expect(container.textContent).toContain(expected)
      expect([...container.querySelectorAll('h3')].map(h => h.textContent)).toEqual(['Top 10', 'Tirage mensuel', 'Votre édition'])
      expect(container.textContent?.includes('✨ +1 Masterless Stella Fortuna')).toBe(status === 'COMPLETED')
      expect(container.textContent).toContain('Vous n’avez pas participé')
    } finally { act(() => root.unmount()) }
  })
  it.each([[0, 0, 2, 1], [0, 0, 0, 0]])('keeps banner snapshots but presents only positive votes: %j', async (...counts) => {
    const container = document.createElement('div'); const root = createRoot(container)
    const snapshot: BannerHistoryDto = { ...banners, entries: [{ ...banners.entries[0]!, featured: [{ characterId: 'chosen', name: 'Skirk', rarity: 5, slot: 4, source: 'COMMUNITY_VOTE' }],
      generationVoteSnapshot: { sourceRotationId: 'source', capturedAt: '2026-09-01T00:00:00Z', selectedCharacterId: 'chosen', selectedCharacterName: 'Skirk', selectionSource: 'COMMUNITY_VOTE',
        candidates: counts.map((voteCount, i) => ({ characterId: `hero-${i}`, characterName: `Candidat ${i}`, voteCount })) } }] }
    const before = JSON.stringify(snapshot)
    try {
      await act(async () => { root.render(<HistoryScreen {...props} initialCategory="banners" onBannersOrEvent={async () => snapshot} />); await Promise.resolve() })
      expect(container.textContent).toContain('Skirk · vote communautaire')
      expect(container.textContent).not.toContain('slot communautaire')
      const choice = [...container.querySelectorAll('p')].find(row => row.textContent?.startsWith('Choix communauté'))!
      expect(choice.textContent).toBe('Choix communauté : Skirk')
      expect(container.querySelectorAll('.history-votes li')).toHaveLength(counts.filter(value => value > 0).length)
      if (counts.some(Boolean)) { expect(container.textContent).toContain('Candidat 2'); expect(container.textContent).toContain('Candidat 3') }
      else expect(container.querySelector('.history-votes')).toBeNull()
      expect(container.textContent).not.toContain('Candidat 0'); expect(container.textContent).not.toContain('Candidat 1')
      expect(JSON.stringify(snapshot)).toBe(before)
    } finally { act(() => root.unmount()) }
  })
  it('uses the shared tabs for five categories and keeps bank filters secondary', async () => {
    const container = document.createElement('div'); const root = createRoot(container)
    try {
      await act(async () => { root.render(<HistoryScreen {...props} />); await Promise.resolve() })
      const nav = container.querySelector<HTMLElement>('nav.activity-inner-tabs[role="tablist"]')!
      expect([...nav.querySelectorAll('button')].map(button => button.textContent)).toEqual(['Invocations', 'Bannières', 'Banque', 'Boutique', 'Event'])
      expect(nav.querySelectorAll('.app-button, .history-tabs')).toHaveLength(0)
      for (const name of ['Bannières', 'Banque', 'Boutique', 'Event']) {
        await act(async () => { tab(container, name).click(); await Promise.resolve() })
        expect(nav.querySelectorAll('[aria-selected="true"]')).toHaveLength(1)
        expect(tab(container, name).getAttribute('aria-selected')).toBe('true')
        if (name === 'Banque') expect(container.querySelector('[aria-label="Filtrer les opérations bancaires"]')).not.toBeNull()
      }
    } finally { act(() => root.unmount()); vi.clearAllMocks() }
  })
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

  it('loads only the selected category and silently accepts missing old banner snapshots', async () => {
    const container = document.createElement('div'); const root = createRoot(container)
    try {
      await act(async () => { root.render(<HistoryScreen {...props} initialCategory="banners" />); await Promise.resolve() })
      expect(props.onBannersOrEvent).toHaveBeenLastCalledWith('banners', 1)
      expect(props.onInvocations).not.toHaveBeenCalled()
      expect(container.textContent).not.toContain('Snapshot détaillé des votes indisponible')
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
