// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { elementKeys, type ElementKey, type GachaCharacterDto } from '../api/types'
import { compareCharacters, normalizeCharacterSearch } from '../characters/character-catalog'
import CharactersScreen from './CharactersScreen'

const names: Record<ElementKey, string> = { pyro: 'Amber', hydro: 'Furina', cryo: 'Kaeya', electro: 'Keqing', anemo: 'Venti', geo: 'Noëlle', dendro: 'Nahida' }
const characters = elementKeys.map((elementKey, index): GachaCharacterDto => ({ id: elementKey, externalKey: elementKey, name: names[elementKey], rarity: index % 2 ? 4 : 5, elementKey, weaponType: 'Épée', region: 'Teyvat', classKey: null, iconPath: '/icon.png', splashPath: null, wishPath: null, fullbodyPath: null }))
const roots: Root[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren() })
function mount() { const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root); act(() => root.render(<CharactersScreen characters={characters} />)); return container }
function input(element: HTMLInputElement, value: string) { act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })) }) }
function namesInGrid(container: HTMLElement) { return Array.from(container.querySelectorAll('.character-card h3')).map((node) => node.textContent) }

describe('CharactersScreen real catalog controls', () => {
  it('renders shared catalog cards and starts with Nom ascending without Niveau', () => {
    const container = mount()
    expect(container.querySelector('.character-portrait-frame')).not.toBeNull()
    expect(container.textContent).toContain('7 personnages actifs')
    expect(container.textContent).not.toContain('Niveau')
    expect(namesInGrid(container)).toEqual(characters.slice().sort((a, b) => compareCharacters(a, b, 'name')).map(({ name }) => name))
  })

  it('normalizes case, accents and trim for contiguous live search and exposes reset', () => {
    const container = mount()
    input(container.querySelector('input[type="search"]')!, '  NOEL ')
    expect(namesInGrid(container)).toEqual(['Noëlle'])
    expect(container.textContent).toContain('1 / 7 personnages')
    input(container.querySelector('input[type="search"]')!, 'xyz')
    expect(container.textContent).toContain('Aucun personnage ne correspond à ces filtres.')
    act(() => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Réinitialiser')!.click())
    expect(container.textContent).toContain('7 personnages actifs')
    expect(normalizeCharacterSearch(' ÉLÉ ')).toBe('ele')
  })

  it('combines rarity and all seven ElementKey filters including Dendro', () => {
    const container = mount()
    for (const element of elementKeys) expect(container.querySelector(`[aria-label="${element === 'electro' ? 'Electro' : element[0]!.toUpperCase() + element.slice(1)}"]`)).not.toBeNull()
    act(() => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '5★')!.click())
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Dendro"]')!.click())
    expect(namesInGrid(container)).toEqual(['Nahida'])
    expect(container.querySelector('[aria-label="Dendro"]')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('implements name, rarity and canonical element ordering in both directions with alphabetic tie-breaks', () => {
    const same = [{ ...characters[0]!, name: 'Zeta' }, { ...characters[0]!, id: 'a', name: 'Alpha' }]
    expect(same.slice().sort((a,b) => compareCharacters(a,b,'element')).map(({ name }) => name)).toEqual(['Alpha','Zeta'])
    expect(characters.slice().sort((a,b) => compareCharacters(a,b,'rarity')).map(({ rarity }) => rarity)).toEqual([4,4,4,5,5,5,5])
    expect(characters.slice().sort((a,b) => -compareCharacters(a,b,'rarity')).map(({ rarity }) => rarity)).toEqual([5,5,5,5,4,4,4])
    expect(characters.slice().sort((a,b) => compareCharacters(a,b,'element')).map(({ elementKey }) => elementKey)).toEqual(elementKeys)
    expect(characters.slice().sort((a,b) => -compareCharacters(a,b,'element')).map(({ elementKey }) => elementKey)).toEqual(elementKeys.slice().reverse())
    const container = mount()
    act(() => container.querySelector<HTMLButtonElement>('.sort-direction-button')!.click())
    expect(namesInGrid(container)).toEqual(characters.slice().sort((a,b) => -compareCharacters(a,b,'name')).map(({ name }) => name))
  })
})
