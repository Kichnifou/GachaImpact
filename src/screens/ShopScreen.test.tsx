// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayerShopDto, ShopHistoryDto, ShopPurchaseDto } from '../api/types'
import shopSource from './ShopScreen.tsx?raw'
import ShopScreen, { ShopHistoryModal } from './ShopScreen'

const roots: Root[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren() })

const base: PlayerShopDto = {
  resources: { primogems: '100', moras: '120000', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } },
  gachaState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' },
  items: [
    { id: 'primos', externalKey: 'primogem-bundle', displayName: 'Lot de Primogemmes', description: 'Primos', visualKey: 'primogems', priceResourceKey: 'moras', priceAmount: '50000', effectType: 'resource_bundle', displayOrder: 2, available: true, unavailableReason: null, quantityMode: 'multiple', rewardPerUnit: { resourceKey: 'primogems', amount: '160' }, ticketRewards: [] },
    { id: 'ticket', externalKey: 'reward-ticket', displayName: 'Ticket', description: 'Ticket', visualKey: 'ticket', priceResourceKey: 'moras', priceAmount: '150000', effectType: 'random_ticket', displayOrder: 3, available: true, unavailableReason: null, quantityMode: 'unit', rewardPerUnit: null, ticketRewards: Array.from({ length: 5 }, (_, index) => ({ id: `${index}`, type: 'resource' as const, label: `Gain ${index}`, amount: '10', weight: 1, probabilityBasisPoints: 2000, resourceKey: 'moras' })) },
  ], recentPurchases: [],
}

const emptyHistory: ShopHistoryDto = { purchases: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 }
async function mount(onPurchase = vi.fn<(...args: [string, string]) => Promise<ShopPurchaseDto>>(), initialShop: PlayerShopDto | null = base, onLoad: () => Promise<PlayerShopDto> = async () => initialShop ?? base, onLoadHistory: (page: number) => Promise<ShopHistoryDto> = async () => emptyHistory) { const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root); const onNavigateBank = vi.fn(); await act(async () => { root.render(<ShopScreen initialShop={initialShop} onLoad={onLoad} onLoadHistory={onLoadHistory} onPurchase={onPurchase} onNavigateBank={onNavigateBank} />); await Promise.resolve() }); return { container, onPurchase, onNavigateBank } }
async function mountHistory(onLoad: (page: number) => Promise<ShopHistoryDto>) { const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root); const onClose = vi.fn(); await act(async () => { root.render(<ShopHistoryModal onLoad={onLoad} onClose={onClose} />); await Promise.resolve(); await Promise.resolve() }); return { container, onClose } }

describe('ShopScreen', () => {
  it('uses only the server catalog, omits Défi, and derives displayed Ticket odds', async () => { const { container } = await mount(); expect(shopSource).not.toContain('mockData'); expect(container.textContent).not.toContain('Mission quotidienne'); expect(container.textContent).not.toContain('Défi'); expect(container.textContent?.match(/20 %/g)).toHaveLength(5) })
  it('MAX fills the Primogem quantity without purchasing and zero capacity disables MAX', async () => { const { container, onPurchase } = await mount(); const max = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'MAX')!; act(() => max.click()); expect(container.querySelector<HTMLInputElement>('.shop-quantity input')!.value).toBe('2'); expect(container.textContent).toContain('+320 Primos'); expect(onPurchase).not.toHaveBeenCalled() })
  it('keeps MAX and purchase disabled when the wallet cannot fund one Primogem bundle', async () => { const poor = { ...base, resources: { ...base.resources, moras: '49999' } }; const { container, onPurchase } = await mount(undefined, poor); const max = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'MAX')!; const buy = container.querySelector<HTMLButtonElement>('.shop-item.primogems .shop-buy-button')!; expect(max.hasAttribute('disabled')).toBe(true); expect(buy.hasAttribute('disabled')).toBe(true); expect(container.querySelector<HTMLInputElement>('.shop-quantity input')!.value).toBe('1'); expect(onPurchase).not.toHaveBeenCalled() })
  it('submits a real Primogem purchase and shows authoritative feedback without replacing controls', async () => { const result = { ...base, resources: { ...base.resources, moras: '20000', primogems: '420' }, purchase: { id: 'purchase', itemId: 'primos', externalKey: 'primogem-bundle', displayName: 'Lot de Primogemmes', quantity: '2', unitPrice: '50000', totalPrice: '100000', effect: { type: 'resource_bundle' as const, resourceKey: 'primogems', amount: '320' }, operationId: 'operation', purchasedAt: '2026-09-10T12:00:00Z' }, operation: { id: 'operation', alreadyProcessed: false } } satisfies ShopPurchaseDto; const onPurchase = vi.fn(async () => result); const { container } = await mount(onPurchase); const input = container.querySelector<HTMLInputElement>('.shop-quantity input')!; act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2'); input.dispatchEvent(new Event('input', { bubbles: true })) }); await act(async () => { container.querySelector<HTMLButtonElement>('.shop-item.primogems .shop-buy-button')!.click(); await Promise.resolve(); await Promise.resolve() }); expect(onPurchase).toHaveBeenCalledWith('primos', '2'); expect(container.textContent).toContain('320 Primos'); expect(container.querySelector('.shop-feedback-slot')).not.toBeNull(); expect(container.querySelector('.shop-item.primogems .shop-buy-button')).not.toBeNull() })
  it('renders a structured Ticket result from the authoritative response', async () => { const rich = { ...base, resources: { ...base.resources, moras: '200000' } }; const result = { ...rich, resources: { ...rich.resources, moras: '50000' }, gachaState: { ...rich.gachaState, pity5: 90 }, purchase: { id: 'ticket-purchase', itemId: 'ticket', externalKey: 'reward-ticket', displayName: 'Ticket', quantity: '1', unitPrice: '150000', totalPrice: '150000', effect: { type: 'ticket_pity5' as const, rewardId: 'pity', label: '+10 Pity 5★', requestedAmount: 10, grantedAmount: 6, pity5Before: 84, pity5After: 90 }, operationId: 'ticket-operation', purchasedAt: '2026-09-10T12:00:00Z' }, operation: { id: 'ticket-operation', alreadyProcessed: false } } satisfies ShopPurchaseDto; const onPurchase = vi.fn(async () => result); const { container } = await mount(onPurchase, rich); await act(async () => { container.querySelector<HTMLButtonElement>('.shop-item.ticket .shop-buy-button')!.click(); await Promise.resolve(); await Promise.resolve() }); expect(onPurchase).toHaveBeenCalledWith('ticket', '1'); expect(container.querySelector('[role="dialog"]')?.textContent).toContain('+6 Pity 5★ · plafond 90 atteint') })
  it('shows a useful loading failure and retries without replacing the screen structure', async () => { const onLoad = vi.fn<() => Promise<PlayerShopDto>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(base); const { container } = await mount(undefined, null, onLoad); await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) }); expect(container.querySelector('[role="alert"]')).not.toBeNull(); const retry = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Réessayer')!; await act(async () => { retry.click(); await Promise.resolve(); await Promise.resolve() }); expect(onLoad).toHaveBeenCalledTimes(2); expect(container.querySelector('.shop-grid')).not.toBeNull() })
  it('opens the Bank from the accessible wallet and shows only the latest purchase before loading history on demand', async () => { const purchase = { id: 'one', itemId: 'primos', externalKey: 'primogem-bundle', displayName: 'Lot de Primogemmes', quantity: '2', unitPrice: '50000', totalPrice: '100000', effect: { type: 'resource_bundle' as const, resourceKey: 'primogems' as const, amount: '320' }, operationId: 'operation', purchasedAt: '2026-09-10T12:00:00Z' }; const older = { ...purchase, id: 'older', displayName: 'Ancien achat', purchasedAt: '2026-09-09T12:00:00Z' }; const populated = { ...base, recentPurchases: [purchase, older] }; const onLoadHistory = vi.fn(async () => ({ purchases: [purchase], page: 1, pageSize: 10 as const, totalCount: 1, totalPages: 1 })); const { container, onNavigateBank } = await mount(undefined, populated, undefined, onLoadHistory); expect(container.textContent).not.toContain('Ancien achat'); act(() => container.querySelector<HTMLButtonElement>('.shop-wallet')!.click()); expect(onNavigateBank).toHaveBeenCalledOnce(); await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Voir l’historique')!.click(); await Promise.resolve(); await Promise.resolve() }); expect(onLoadHistory).toHaveBeenCalledWith(1); expect(container.querySelector('.shop-history-table')?.textContent).toContain('Lot de Primogemmes'); expect(container.querySelectorAll('.shop-last-purchase > div')).toHaveLength(5) })

  it('paginates the Shop history at ten rows while keeping the transversal modal shell stable', async () => {
    const purchase = (index: number) => ({ id: `purchase-${index}`, itemId: 'primos', externalKey: 'primogem-bundle', displayName: `Achat ${index}`, quantity: String(index), unitPrice: '50000', totalPrice: String(index * 50000), effect: { type: 'resource_bundle' as const, resourceKey: 'primogems' as const, amount: String(index * 160) }, operationId: `operation-${index}`, purchasedAt: '2026-09-10T12:00:00Z' })
    const onLoad = vi.fn(async (page: number): Promise<ShopHistoryDto> => ({ purchases: page === 1 ? Array.from({ length: 10 }, (_, index) => purchase(index + 1)) : [purchase(11)], page, pageSize: 10, totalCount: 11, totalPages: 2 }))
    const { container } = await mountHistory(onLoad)
    expect(container.querySelector('.history-modal')?.textContent).toContain('Boutique / Achats')
    expect(container.querySelectorAll('.shop-history-table tbody tr')).toHaveLength(10)
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Suivant')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(onLoad).toHaveBeenLastCalledWith(2)
    expect(container.querySelectorAll('.shop-history-table tbody tr')).toHaveLength(10)
    expect(container.querySelectorAll('.shop-history-table tbody .history-empty-row')).toHaveLength(9)
    expect(container.textContent).toContain('Page 2 / 2')
  })

  it('renders history loading, empty and error states and closes with X, Escape and backdrop', async () => {
    let resolveHistory!: (value: ShopHistoryDto) => void
    const pending = new Promise<ShopHistoryDto>((resolve) => { resolveHistory = resolve })
    const { container, onClose } = await mountHistory(() => pending)
    expect(container.textContent).toContain('Chargement de l’historique')
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Fermer l’historique"]')!.click())
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    act(() => container.querySelector<HTMLElement>('.history-modal-overlay')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(onClose).toHaveBeenCalledTimes(3)
    await act(async () => { resolveHistory(emptyHistory); await pending })
    expect(container.textContent).toContain('Aucun achat enregistré')
    const failure = await mountHistory(async () => { throw new Error('offline') })
    expect(failure.container.querySelector('[role="alert"]')).not.toBeNull()
  })
})
