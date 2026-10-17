// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { ContestLegendDto } from '../api/types'
import ProfileLegends, { legendPageCapacity } from './ProfileLegends'

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

it('uses the available height and one readable mobile row per page',()=>{
 expect(legendPageCapacity(1000,500,[140,140,140])).toBe(3)
 expect(legendPageCapacity(1000,320,[300,300,300])).toBe(1)
 expect(legendPageCapacity(390,1000,[300,300,300])).toBe(1)
 expect(legendPageCapacity(1108,604,[480,500,520],36)).toBe(3)
 expect(legendPageCapacity(638,408,[359,359,450],36)).toBe(2)
 expect(legendPageCapacity(638,408,[359,376,450],36)).toBe(1)
})
it('preserves a page across ordinary refresh and resets after a count change or privacy closure',()=>{
 const container=document.createElement('div'),root=createRoot(container)
 const characters=[{id:'one',name:'Premier'},{id:'two',name:'Deuxième'},{id:'three',name:'Troisième'}]
 const render=(rows=characters)=>act(()=>root.render(<ProfileLegends value={{access:'ALLOWED',data:{characters:rows,legends:[]}}} box={{access:'PRIVATE'}}/>))
 render();act(()=>container.querySelector<HTMLButtonElement>('[aria-label="Légendes suivantes"]')!.click())
 expect(container.querySelector('.profile-legends-page')?.textContent).toContain('Deuxième')
 render([...characters]);expect(container.querySelector('.profile-legends-page')?.textContent).toContain('Deuxième')
 render(characters.slice(0,2));expect(container.querySelector('.profile-legends-page')?.textContent).toContain('Premier')
 act(()=>root.render(<ProfileLegends value={{access:'PRIVATE'}} box={{access:'PRIVATE'}}/>));render()
 expect(container.querySelector('.profile-legends-page')?.textContent).toContain('Premier');act(()=>root.unmount())
})

it('always renders five themes and changes only character capacity on resize', () => {
  let availableHeight = 400
  const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
  const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => availableHeight)
  const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const visibleThemes = Array.from(this.querySelectorAll<HTMLElement>('[data-legend-theme]')).filter(row => row.style.display !== 'none').length
    return { height: this.matches('.profile-legend') ? 150 + visibleThemes * 60 : 36 } as DOMRect
  })
  const container = document.createElement('div'), root = createRoot(container)
  const character = { id:'legend', name:'Durin' }
  const legend = { character: { ...character, externalKey:'durin', elementKey:'pyro', iconPath:null }, stats:{strength:16,intelligence:8,beauty:17,charisma:5,popularity:18}, totals:{contests:'7',wins:'3'}, themes:Object.fromEntries(['STRENGTH','INTELLIGENCE','BEAUTY','CHARISMA','POPULARITY'].map(key => [key,{participations:'7',wins:'3',titleRank:2,title:'Titre '+key}])) } as ContestLegendDto
  try {
    act(() => root.render(<ProfileLegends value={{access:'ALLOWED',data:{characters:[character],legends:[legend]}}} box={{access:'PRIVATE'}}/>))
    const visible = () => container.querySelector('.profile-legends-page')!
    expect(visible().querySelectorAll('[data-legend-theme]')).toHaveLength(5)
    expect(container.querySelector('[aria-label="Informations de la L?gende"]')).toBeNull()
    expect(container.textContent).not.toContain('Thèmes ')
    expect(container.querySelector('.profile-legends-page')?.getAttribute('style')).toContain('repeat(1')
    expect(container.querySelectorAll('[data-legend-theme][style]')).toHaveLength(0)
    availableHeight = 700
    act(() => window.dispatchEvent(new Event('resize')))
    expect(visible().querySelectorAll('[data-legend-theme]')).toHaveLength(5)
    expect(container.querySelector('[aria-label="Informations de la Légende"]')).toBeNull()
    expect(container.querySelector('.profile-legends-page')?.getAttribute('style')).toContain('repeat(3')
  } finally { act(() => root.unmount()); width.mockRestore(); height.mockRestore(); rect.mockRestore() }
})
