// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import type { ContestLegendDto } from '../api/types'
import ProfileLegends from './ProfileLegends'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
describe('Profile Legends privacy', () => {
  it('keeps a hidden Box private, distinguishes hidden statistics and presents allowed titles', () => {
    const container = document.createElement('div'), root = createRoot(container)
    const character = { id: 'legend', name: 'Durin' }
    const render = (value: Parameters<typeof ProfileLegends>[0]['value']) => act(() => root.render(<ProfileLegends value={value} box={{ access: 'PRIVATE' }} />))
    render({ access: 'PRIVATE' })
    expect(container.textContent).toContain('privées')
    expect(container.textContent).not.toContain('Durin')
    render({ access: 'ALLOWED', data: { characters: [character], legends: [] } })
    expect(container.textContent).toContain('Durin')
    expect(container.textContent).toContain('statistiques de cette Légende sont privées')
    const legend = { character: { ...character, externalKey: 'durin', elementKey: 'pyro', iconPath: null }, stats: { strength: 16, intelligence: 8, beauty: 17, charisma: 5, popularity: 18 }, totals: { contests: '7', wins: '3' }, themes: Object.fromEntries(['STRENGTH', 'INTELLIGENCE', 'BEAUTY', 'CHARISMA', 'POPULARITY'].map(key => [key, { participations: '7', wins: '3', titleRank: 2, title: key === 'CHARISMA' ? 'Icône d’Argent' : null }])) } as ContestLegendDto
    render({ access: 'ALLOWED', data: { characters: [character], legends: [legend] } })
    expect(container.textContent).toContain('Icône d’Argent')
    expect(container.textContent).toContain('7 participations · 3 victoires')
    render({ access: 'ALLOWED', data: { characters: [], legends: [] } })
    expect(container.textContent).toContain('Aucune Légende C6')
    act(() => root.unmount())
  })
})
