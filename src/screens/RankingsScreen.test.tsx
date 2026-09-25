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
});
