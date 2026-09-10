// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BoxCharacterDto, PlayerBoxDto, PlayerInventoryDto, PlayerResourcesDto, StellaUseDto } from '../api/types'
import { presentInventory } from '../inventory/inventory-presentation'
import InventoryScreen from './InventoryScreen'
import inventorySource from './InventoryScreen.tsx?raw'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const resourceKeys = ['primogems', 'moras', 'particles_pyro', 'particles_hydro', 'particles_cryo', 'particles_electro', 'particles_anemo', 'particles_geo', 'particles_dendro'] as const
const resources: PlayerResourcesDto = { primogems: '2480', moras: '9007199254740993', particles: { pyro: '0', hydro: '80', cryo: '751', electro: '99', anemo: '36', geo: '0', dendro: '0' } }
const inventory: PlayerInventoryDto = {
  resources: resourceKeys.map((key) => ({ key, displayName: key === 'primogems' ? 'Primogemmes' : key === 'moras' ? 'Moras' : `Particules ${key.slice(10)}`, category: 'resource', elementKey: key.startsWith('particles_') ? key.slice(10) as never : null, amount: '999' })),
  items: [
    { id: 'stella', externalKey: 'masterless-stella-fortuna', displayName: 'Masterless Stella Fortuna', category: 'SPECIAL', section: 'objects', description: 'Renforce la constellation d’un personnage 5★', quantity: '2', firstObtainedAt: '2026-09-09T00:00:00Z', acquisitionHint: null },
    { id: 'owned', externalKey: 'souvenir-fontaine', displayName: 'Éclat de Fontaine', category: 'COLLECTION', section: 'collection', description: 'Souvenir.', quantity: '1', firstObtainedAt: '2026-09-09T00:00:00Z', acquisitionHint: 'Événement Fontaine.' },
    { id: 'unknown', externalKey: 'souvenir-sumeru', displayName: 'Branche de Sumeru', category: 'COLLECTION', section: 'collection', description: null, quantity: '0', firstObtainedAt: null, acquisitionHint: 'Exploration.' },
  ],
}
const furina: BoxCharacterDto = { id: 'furina', externalKey: 'furina', name: 'Furina', rarity: 5, elementKey: 'hydro', weaponType: null, region: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null, constellation: 1, copies: 2, firstObtainedAt: '2026-09-09T00:00:00Z', favorite: false, c6CompetitionStats: null }
const box: PlayerBoxDto = { characters: [furina, { ...furina, id: 'four', name: 'Collei', rarity: 4 }], summary: { totalOwned: 2, fiveStars: 1, fourStars: 1, c6: 0 }, preference: { sortKey: 'alphabetical', direction: 'asc' }, stella: { quantity: '2' } }
const roots: Root[] = []

afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()))
  document.body.replaceChildren()
  vi.useRealTimers()
})

async function mount(overrides: Partial<React.ComponentProps<typeof InventoryScreen>> = {}) {
  const props = {
    initialInventory: inventory,
    resources,
    onLoad: vi.fn(async () => inventory),
    onNavigateBank: vi.fn(),
    onLoadBox: vi.fn(async () => box),
    onSetBoxFavorite: vi.fn(async () => furina),
    onUseStella: vi.fn(async (): Promise<StellaUseDto> => ({ operation: { id: 'operation', alreadyProcessed: false }, character: { ...furina, constellation: 2, copies: 3 }, stella: { quantity: '1' }, c6Progression: null })),
    stellaRetryCharacterId: null,
    onLoadTeams: vi.fn(async () => ({ teams: [], availableCharacters: [], passiveReference: [] })),
    ...overrides,
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => { root.render(<InventoryScreen {...props} />); await Promise.resolve(); await Promise.resolve() })
  return { container, props }
}

describe('real inventory screen', () => {
  it('contains no mock inventory import and renders the four final categories', async () => {
    expect(inventorySource).not.toContain('mockData')
    const { container } = await mount()
    for (const label of ['Tout', 'Ressources', 'Objets', 'Collection']) expect(container.textContent).toContain(label)
    expect(container.querySelectorAll('.inventory-resource-card')).toHaveLength(9)
    expect(container.textContent).toContain('Masterless Stella Fortuna')
    expect(container.textContent).toContain('Renforce la constellation d’un personnage 5★')
    expect(container.querySelectorAll('.inventory-group')).toHaveLength(3)
    expect(container.querySelectorAll('.inventory-group-heading')).toHaveLength(3)
    expect(Array.from(container.querySelectorAll('.inventory-group-heading')).map((heading) => heading.textContent)).toEqual(['Ressources', 'Progression', 'Objets rares'])
    expect(container.querySelector('.inventory-resource-icon img')).not.toBeNull()
  })

  it('keeps navigation labels stable while every filtered category shows its final group label', async () => {
    const { container } = await mount()
    const tabs = () => Array.from(container.querySelectorAll<HTMLButtonElement>('.inventory-categories button'))
    expect(tabs().map((button) => button.querySelector('strong')?.textContent)).toEqual(['Tout', 'Ressources', 'Objets', 'Collection'])

    for (const [tabLabel, groupLabels] of [['Ressources', ['Monnaie', 'Particules']], ['Objets', ['Progression']], ['Collection', ['Objets rares']]] as const) {
      act(() => tabs().find((button) => button.querySelector('strong')?.textContent === tabLabel)!.click())
      expect(Array.from(container.querySelectorAll('.inventory-group-heading')).map((heading) => heading.textContent)).toEqual(groupLabels)
    }
  })

  it('separates currencies from all seven particles in the Resources category', async () => {
    const { container } = await mount()
    const tab = Array.from(container.querySelectorAll<HTMLButtonElement>('.inventory-categories button')).find((button) => button.textContent?.includes('Ressources'))!
    act(() => tab.click())
    expect(container.querySelectorAll('.inventory-group')).toHaveLength(2)
    expect(container.querySelector('.inventory-group:nth-child(1) .inventory-grid')?.children).toHaveLength(2)
    expect(container.querySelector('.inventory-group:nth-child(2) .inventory-grid')?.children).toHaveLength(7)
    expect(container.textContent).toContain('Particules')
  })

  it('uses the global wallet as the only displayed economy snapshot and derives wishes', async () => {
    const { container } = await mount()
    expect(container.textContent).toContain('2 480')
    expect(container.textContent).toContain('15 vœux possibles')
    expect(container.textContent).toContain('9 007 199 254 740 993')
    expect(container.textContent).not.toContain('× 999')
  })

  it('filters immediately with an accent-insensitive contiguous search', () => {
    expect(presentInventory(inventory.resources, inventory.items, resources, 'all', 'eclat').map((entry) => entry.type === 'item' ? entry.item.id : entry.resource.key)).toEqual(['owned'])
    expect(presentInventory(inventory.resources, inventory.items, resources, 'all', 'de fon').map((entry) => entry.type === 'item' ? entry.item.id : entry.resource.key)).toEqual(['owned'])
    expect(presentInventory(inventory.resources, inventory.items, resources, 'all', 'font aine')).toEqual([])
  })

  it('makes the whole Moras card navigate to the Bank', async () => {
    const onNavigateBank = vi.fn()
    const { container } = await mount({ onNavigateBank })
    const card = container.querySelector<HTMLButtonElement>('.inventory-resource-card.mora')!
    expect(card.textContent).toContain('Accéder à la Banque')
    act(() => card.click())
    expect(onNavigateBank).toHaveBeenCalledOnce()
  })

  it('orders Collection owned then unknown and opens real details', async () => {
    const { container } = await mount()
    const collectionTab = Array.from(container.querySelectorAll<HTMLButtonElement>('.inventory-categories button')).find((button) => button.textContent?.includes('Collection'))!
    act(() => collectionTab.click())
    const cards = Array.from(container.querySelectorAll<HTMLElement>('.inventory-object-card'))
    expect(cards.map((card) => card.textContent)).toEqual([expect.stringContaining('Éclat de Fontaine'), expect.stringContaining('Branche de Sumeru')])
    act(() => cards[0]!.querySelector<HTMLButtonElement>('.inventory-item-main')!.click())
    expect(container.querySelector('.inventory-item-detail')?.textContent).toContain('Événement Fontaine.')
  })

  it('opens a 5★-only Stella picker and keeps the final confirmation in the reused Box detail', async () => {
    vi.useFakeTimers()
    const { container, props } = await mount()
    const useButton = Array.from(container.querySelectorAll<HTMLButtonElement>('.inventory-use-button')).find((button) => button.textContent === 'Utiliser')!
    await act(async () => { useButton.click(); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector('.inventory-stella-picker')?.textContent).toContain('Furina')
    expect(container.querySelector('.inventory-stella-picker')?.textContent).not.toContain('Collei')
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Ouvrir la fiche de Furina"]')!.click())
    expect(container.querySelector('.box-detail-modal')?.textContent).toContain('Utiliser une Stella')
    await act(async () => { container.querySelector<HTMLButtonElement>('.box-detail-favorite-star')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(props.onSetBoxFavorite).toHaveBeenCalledWith('furina', true)
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('.box-detail-modal button')).find((button) => button.textContent === 'Utiliser une Stella')!.click())
    expect(container.querySelector('.box-stella-confirm')?.textContent).toContain('Utiliser 1 Masterless Stella Fortuna sur Furina ?')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('.box-stella-confirm button')).find((button) => button.textContent === 'Confirmer')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(props.onUseStella).toHaveBeenCalledWith('furina')
    expect(props.onLoadTeams).toHaveBeenCalledOnce()
    expect(container.querySelector('.box-detail-modal')?.textContent).toContain('Masterless Stella Fortuna × 1')
    expect(container.querySelector('[aria-label="Constellation augmentée de 1"]')?.textContent).toBe('+1')
    act(() => { vi.advanceTimersByTime(1_800) })
    expect(container.querySelector('[aria-label="Constellation augmentée de 1"]')).toBeNull()
    expect(container.querySelector('.box-stella-feedback')?.textContent).toBe('Stella utilisée avec succès.')
    expect(inventorySource).not.toContain('3_600')
  })
})
