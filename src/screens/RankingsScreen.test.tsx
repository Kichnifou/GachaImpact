// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { RankingPageDto } from '../api/types'
import RankingsScreen from './RankingsScreen'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const metrics: RankingPageDto['metrics'] = [
  { id: 'xp', label: 'XP', category: 'PROGRESSION', aliases: ['xp'], source: 'progression', format: 'INTEGER', privacy: ['GENERAL_STATISTICS'], eligibility: 'positive' },
  { id: 'pulls', label: 'Pulls', category: 'GACHA', aliases: ['pulls'], source: 'gacha', format: 'INTEGER', privacy: ['GENERAL_STATISTICS'], eligibility: 'positive' },
  { id: 'pity5', label: 'Pity 5★', category: 'GACHA', aliases: ['pity'], source: 'gacha', format: 'PITY5', privacy: ['PITY_GUARANTEE'], eligibility: 'positive' },
]
const page = (metric = 'xp', number = 1): RankingPageDto => ({ metric: metrics.find(item => item.id === metric)!, metrics, categories: ['PROGRESSION', 'GACHA'], page: number, pageSize: 20, total: 21, totalPages: 2,
  entries: [{ playerId: 'p1', displayName: 'Éloïse', elementKey: 'pyro', rank: number === 1 ? 1 : 21, value: '9007199254740993', isSelf: false }],
  self: { playerId: 'me', displayName: 'Moi', elementKey: 'hydro', rank: 22, value: '42', isSelf: true }, selfStatus: 'RANKED',
})
describe('RankingsScreen', () => {
  it('shows the personal rank outside the page, opens Profile, and changes metric and page', async () => {
    const container = document.createElement('div'); const root = createRoot(container)
    const onLoad = vi.fn(async (metric: string, number: number) => page(metric, number))
    const onProfile = vi.fn()
    try {
      await act(async () => { root.render(<RankingsScreen onLoad={onLoad} onProfile={onProfile} />); await Promise.resolve() })
      expect(container.textContent).toContain('Votre rang : #22')
      expect(container.textContent).toContain('9007199254740993')
      await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Voir le profil de Éloïse"]')!.click() })
      expect(onProfile).toHaveBeenCalledWith('p1')
      await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent === 'Gacha')!.click(); await Promise.resolve() })
      expect(onLoad).toHaveBeenLastCalledWith('pulls', 1)
      await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('.rankings-pages button')].find(button => button.textContent === 'Suivant')!.click(); await Promise.resolve() })
      expect(onLoad).toHaveBeenLastCalledWith('pulls', 2)
    } finally { act(() => root.unmount()) }
  })
  it('explains a non-public personal metric without inventing a rank', async () => {
    const container = document.createElement('div'); const root = createRoot(container)
    try {
      await act(async () => { root.render(<RankingsScreen onLoad={async () => ({ ...page(), self: null, selfStatus: 'NOT_PUBLIC' })} onProfile={() => {}} />); await Promise.resolve() })
      expect(container.textContent).toContain('Votre donnée n’est pas publique')
      expect(container.textContent).not.toContain('Votre rang :')
    } finally { act(() => root.unmount()) }
  })
  it('does not show an XP snapshot after Pulls fails', async () => {
    const container = document.createElement('div'); const root = createRoot(container)
    const onLoad = vi.fn(async (metric: string, number: number) => {
      if (metric === 'pulls') throw new Error('Lecture Pulls indisponible')
      return page(metric, number)
    })
    try {
      await act(async () => { root.render(<RankingsScreen onLoad={onLoad} onProfile={() => {}} />); await Promise.resolve() })
      expect(container.textContent).toContain('9007199254740993')
      await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent === 'Gacha')!.click(); await Promise.resolve() })
      expect(onLoad).toHaveBeenLastCalledWith('pulls', 1)
      expect(container.querySelector('select')?.value).toBe('pulls')
      expect(container.querySelector('[role="alert"]')).not.toBeNull()
      expect(container.textContent).not.toContain('9007199254740993')
      expect(container.textContent).not.toContain('Page 1 / 2')
    } finally { act(() => root.unmount()) }
  })
  it('does not present page 1 as page 2 after a paging error', async () => {
    const container = document.createElement('div'); const root = createRoot(container)
    const onLoad = vi.fn(async (metric: string, number: number) => {
      if (number === 2) throw new Error('Page indisponible')
      return page(metric, number)
    })
    try {
      await act(async () => { root.render(<RankingsScreen onLoad={onLoad} onProfile={() => {}} />); await Promise.resolve() })
      await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('.rankings-pages button')].find(button => button.textContent === 'Suivant')!.click(); await Promise.resolve() })
      expect(onLoad).toHaveBeenLastCalledWith('xp', 2)
      expect(container.querySelector('[role="alert"]')).not.toBeNull()
      expect(container.textContent).not.toContain('9007199254740993')
      expect(container.textContent).not.toContain('Page 2 / 2')
    } finally { act(() => root.unmount()) }
  })
  it('shows the server-provided Pity value without changing it into a frontend score', async () => {
    const container = document.createElement('div'); const root = createRoot(container)
    const onLoad = vi.fn(async (metric: string, number: number): Promise<RankingPageDto> => ({ ...page(metric, number), entries: [{ ...page(metric, number).entries[0]!, value: metric === 'pity5' ? '74/90' : '10' }] }))
    try {
      await act(async () => { root.render(<RankingsScreen onLoad={onLoad} onProfile={() => {}} />); await Promise.resolve() })
      await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent === 'Gacha')!.click(); await Promise.resolve() })
      await act(async () => { const select = container.querySelector('select')!; select.value = 'pity5'; select.dispatchEvent(new Event('change', { bubbles: true })); await Promise.resolve() })
      expect(onLoad).toHaveBeenLastCalledWith('pity5', 1)
      expect(container.textContent).toContain('74/90')
    } finally { act(() => root.unmount()) }
  })
  it('keeps the latest metric when an earlier response arrives late', async () => {
    const container = document.createElement('div'); const root = createRoot(container)
    let resolvePulls!: (value: RankingPageDto) => void
    const onLoad = vi.fn((metric: string, number: number) => metric === 'pulls'
      ? new Promise<RankingPageDto>(resolve => { resolvePulls = resolve })
      : Promise.resolve(page(metric, number)))
    try {
      await act(async () => { root.render(<RankingsScreen onLoad={onLoad} onProfile={() => {}} />); await Promise.resolve() })
      await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent === 'Gacha')!.click() })
      expect(container.textContent).toContain('Chargement des classements')
      await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent === 'Progression')!.click(); await Promise.resolve() })
      await act(async () => { resolvePulls(page('pulls')); await Promise.resolve() })
      expect(container.querySelector('select')?.value).toBe('xp')
      expect(container.textContent).toContain('9007199254740993')
      expect(container.querySelector('[role="alert"]')).toBeNull()
    } finally { act(() => root.unmount()) }
  })
});
