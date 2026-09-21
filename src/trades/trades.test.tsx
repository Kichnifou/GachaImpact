// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TradesScreen from '../screens/TradesScreen'
import type { TradeActions, TradeRequest, TradeSnapshot } from './types'
import { ApiError } from '../api/game-api'
import { resolveNotificationPresentation } from '../notifications/notification-presentation'
import { hashForScreen, parseNavigationHash, mainNavigation, navigationDestinations } from '../navigation/navigation'

const a = { id: 'a', displayName: 'Alice', elementKey: 'cryo' as const }, b = { id: 'b', displayName: 'Bob', elementKey: 'pyro' as const }
const request: TradeRequest = { id: 'offer', sender: a, recipient: b, senderResourceKey: 'particles_pyro', recipientResourceKey: 'particles_cryo', currentAmount: '200', originalAmount: '500', createdAt: '2026-09-21T12:00:00Z', expiresAt: '2026-09-21T22:00:00Z' }
const empty: TradeSnapshot = { stocks: [{ resourceKey: 'particles_pyro', total: '500', reserved: '200', available: '300' }], received: [], sent: [], history: [] }
const roots: Root[] = []
afterEach(() => { act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren(); Reflect.deleteProperty(document, 'visibilityState'); vi.useRealTimers() })
function api(snapshot = empty) {
  return {
    snapshot: vi.fn(async () => snapshot),
    partners: vi.fn<TradeActions['partners']>(async () => ({ partners: [{ ...b, maximum: '300' }], page: 1, total: 1, pageSize: 10, totalPages: 1 })),
    create: vi.fn<TradeActions['create']>(async () => ({ requestId: 'new', state: 'PENDING', amount: '300' })),
    mutate: vi.fn(async (_id: string, action: string) => ({ requestId: 'offer', state: action === 'accept' ? 'ACCEPTED' : action === 'refuse' ? 'REFUSED' : 'CANCELLED', amount: '200' })),
    all: vi.fn(async () => ({ results: [{ requestId: 'offer', state: 'ACCEPTED', amount: '200' }] })),
  }
}
async function mount(actions: TradeActions) {
  const onSnapshot = vi.fn(), node = document.createElement('div'); document.body.append(node)
  const root = createRoot(node); roots.push(root)
  await act(async () => root.render(<TradesScreen actions={actions} onSnapshot={onSnapshot} playerId="a" />))
  return { node, onSnapshot }
}
async function click(node: HTMLElement, text: string) { const button = Array.from(node.querySelectorAll('button')).find(b => b.textContent === text)!; expect(button).toBeTruthy(); await act(async () => button.click()) }
async function choose(node: HTMLElement) { await act(async () => node.querySelector<HTMLButtonElement>('.trade-partner')!.click()) }
describe('Particle trades UI', () => {
  it('coalesces quick typing at 120ms and fills the field from either selection source', async () => {
    vi.useFakeTimers()
    const actions = api(), { node } = await mount(actions)
    const input = node.querySelector<HTMLInputElement>('[role="combobox"]')!
    const type = async (text: string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })) })
    actions.partners.mockClear()
    for (const value of ['B', 'Bo', 'Bob']) { await type(value); await act(async () => vi.advanceTimersByTimeAsync(30)) }
    expect(actions.partners).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(90))
    expect(actions.partners).toHaveBeenCalledExactlyOnceWith('Bob', 1, expect.any(AbortSignal))
    await act(async () => node.querySelector<HTMLButtonElement>('[role="option"]')!.click())
    expect(input.value).toBe('Bob')
    expect(node.querySelector('[role="listbox"]')?.hasAttribute('hidden')).toBe(true)
    await type('B')
    expect(node.querySelector('.trade-partner[aria-pressed="true"]')).toBeNull()
    await choose(node)
    expect(input.value).toBe('Bob')
    expect(node.textContent).not.toContain('Partenaire :')
    expect(node.textContent).not.toContain('Seules vos particules')
    const amount = node.querySelector<HTMLInputElement>('[aria-label="Quantité"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(amount, '1234567890123'); amount.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(amount.value).toBe('1234567890123')
    expect(amount.maxLength).toBe(-1)
  })

  it('resolves a profile intent from actual partners with one initial snapshot and no fabricated eligibility', async () => {
    vi.useFakeTimers()
    const actions = api(), node = document.createElement('div'); document.body.append(node)
    const root = createRoot(node); roots.push(root)
    await act(async () => root.render(<TradesScreen actions={actions} onSnapshot={vi.fn()} playerId="a" intent={{ token: 'profile', partner: b }} />))
    await act(async () => vi.advanceTimersByTimeAsync(250))
    expect(actions.snapshot).toHaveBeenCalledTimes(1)
    expect(node.querySelector('.trade-partner[aria-pressed="true"]')?.textContent).toContain('Bob')
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
    await act(async () => vi.advanceTimersByTimeAsync(250))
    expect(actions.partners).toHaveBeenCalledTimes(2)
    actions.partners.mockResolvedValue({ partners: [], page: 1, total: 0, pageSize: 10, totalPages: 1 })
    await act(async () => root.render(<TradesScreen actions={actions} onSnapshot={vi.fn()} playerId="a" intent={{ token: 'other', partner: { id: 'missing', displayName: 'Absent' } }} />))
    await act(async () => vi.advanceTimersByTimeAsync(250))
    expect(node.textContent).toContain('Aucun échange disponible avec ce joueur pour le moment.')
    expect(node.querySelector('.trade-partner[aria-pressed="true"]')).toBeNull()
  })
  it('confirms acceptance before secondary refresh, preserves success on refresh failure and never offers replay', async () => {
    const actions = api({ ...empty, received: [request] }), { node } = await mount(actions)
    await click(node, 'Reçues (1)')
    let reject!: (error: unknown) => void
    actions.snapshot.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
    await click(node, 'Accepter')
    expect(node.textContent).toContain('Échange effectué')
    expect(node.textContent).not.toContain('Traitement en cours')
    await act(async () => reject(new Error('Resources unavailable')))
    expect(node.textContent).toContain('Échange effectué')
    expect(node.textContent).toContain('Actualisation indisponible')
    expect(node.textContent).not.toContain('Réessayer l’action')
    expect(actions.mutate).toHaveBeenCalledTimes(1)
  })
  it('does not search partners outside their tab and retains feedback until another tab is selected', async () => {
    vi.useFakeTimers()
    const actions = api({ ...empty, received: [request] }), { node } = await mount(actions)
    expect(actions.snapshot).toHaveBeenCalledTimes(1)
    expect(actions.partners).toHaveBeenCalledTimes(1)
    expect(node.querySelector('details')?.open).toBe(false)
    await click(node, 'Reçues (1)'); await click(node, 'Accepter')
    await act(async () => vi.advanceTimersByTimeAsync(18_000))
    expect(node.textContent).toContain('Échange effectué')
    expect(actions.partners).toHaveBeenCalledTimes(1)
    await click(node, 'Historique')
    expect(node.textContent).not.toContain('Échange effectué')
  })
  it('refreshes and switches to received for a new navigation intent even while already open', async () => {
    const actions = api(), { node, onSnapshot } = await mount(actions)
    const reads = actions.snapshot.mock.calls.length
    await act(async () => roots[0]!.render(<TradesScreen actions={actions} onSnapshot={onSnapshot} playerId="a" intent={{ token: 'notification-1', tab: 'received' }} />))
    expect(node.querySelector('[aria-current="page"]')?.textContent).toBe('Reçues')
    expect(actions.snapshot.mock.calls.length).toBeGreaterThan(reads)
    await act(async () => roots[0]!.render(<TradesScreen actions={actions} onSnapshot={onSnapshot} playerId="a" intent={{ token: 'accepted', tab: 'history' }} />))
    expect(node.querySelector('[aria-current="page"]')?.textContent).toBe('Historique')
  })
  it('starts the latest search after its debounce without waiting for an obsolete request', async () => {
    vi.useFakeTimers()
    const actions = api(), { node } = await mount(actions)
    const input = node.querySelector<HTMLInputElement>('[aria-label="Rechercher un partenaire"]')!
    actions.partners.mockClear()
    let releaseA!: (value: Awaited<ReturnType<TradeActions['partners']>>) => void, signalA: AbortSignal | undefined, signalC: AbortSignal | undefined
    actions.partners.mockImplementation((query, _page, signal) => {
      if (query === 'A') return new Promise(resolve => { releaseA = resolve; signalA = signal })
      if (query === 'C') return new Promise(() => { signalC = signal })
      return Promise.resolve({ partners: [{ ...b, maximum: '300' }], page: 1, total: 1, pageSize: 10, totalPages: 1 })
    })
    const type = async (value: string) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await type('A')
    await act(async () => vi.advanceTimersByTimeAsync(250))
    expect(actions.partners).toHaveBeenCalledTimes(1)
    expect(actions.partners.mock.calls[0]?.slice(0, 2)).toEqual(['A', 1])
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
    expect(actions.partners).toHaveBeenCalledTimes(1)
    await type('B')
    expect(signalA?.aborted).toBe(true)
    await act(async () => releaseA({ partners: [{ ...a, maximum: '200' }], page: 1, total: 1, pageSize: 10, totalPages: 1 }))
    expect(node.querySelector('.trade-partner')?.textContent).not.toContain('Alice')
    await act(async () => vi.advanceTimersByTimeAsync(120))
    expect(signalA?.aborted).toBe(true)
    expect(actions.partners).toHaveBeenCalledTimes(2)
    expect(actions.partners.mock.calls[1]?.slice(0, 2)).toEqual(['B', 1])
    expect(node.querySelector('.trade-partner')?.textContent).toContain('Bob')
    await act(async () => releaseA({ partners: [{ ...a, maximum: '200' }], page: 1, total: 1, pageSize: 10, totalPages: 1 }))
    expect(node.querySelector('.trade-partner')?.textContent).toContain('Bob')
    expect(node.textContent).not.toContain('Recherche indisponible')
    await type('C')
    await act(async () => vi.advanceTimersByTimeAsync(250))
    await click(node, 'Reçues')
    expect(signalC?.aborted).toBe(true)
  })
  it('shows stocks, MAX fills without sending, creation refreshes authoritatively and publishes shell stocks', async () => {
    const actions = api(), { node, onSnapshot } = await mount(actions)
    expect(node.textContent).toContain('Total / Réservé / Disponible')
    expect(node.querySelector('[title="Réservé"]')?.textContent).toBe('200')
    expect(node.querySelector('[title="Disponible"]')?.textContent).toBe('300')
    await choose(node); await click(node, 'MAX')
    expect(node.querySelector<HTMLInputElement>('[aria-label="Quantité"]')?.value).toBe('300'); expect(actions.create).not.toHaveBeenCalled()
    const reads = actions.snapshot.mock.calls.length
    await click(node, 'Envoyer'); expect(actions.create).toHaveBeenCalledWith('b', '300', expect.any(String))
    expect(node.textContent).toContain('Demande envoyée.'); expect(actions.snapshot.mock.calls.length).toBeGreaterThan(reads)
    expect(onSnapshot).toHaveBeenLastCalledWith(empty)
  })
  it('shows received/sent reduced offers, contextual actions and recent history', async () => {
    const actions = api({ ...empty, received: [request], sent: [request], history: [{ ...request, amount: '200', executedAt: request.createdAt }] }), { node } = await mount(actions)
    await click(node, 'Reçues (1)'); expect(node.textContent).toContain('Montant initial : 500')
    await click(node, 'Accepter'); expect(actions.mutate).toHaveBeenLastCalledWith('offer', 'accept', expect.any(String))
    await click(node, 'Refuser'); expect(actions.mutate).toHaveBeenLastCalledWith('offer', 'refuse', expect.any(String))
    await click(node, 'Accepter tout'); expect(actions.all).toHaveBeenLastCalledWith('accept', expect.any(String))
    await click(node, 'Refuser tout'); expect(actions.all).toHaveBeenLastCalledWith('refuse', expect.any(String))
    await click(node, 'Envoyées (1)'); await click(node, 'Annuler'); expect(actions.mutate).toHaveBeenLastCalledWith('offer', 'cancel', expect.any(String))
    await click(node, 'Historique'); expect(node.querySelectorAll('.trade-history article')).toHaveLength(1)
  })
  it('guards double clicks and retries the exact ambiguous intent even when polling removes the partner', async () => {
    const actions = api(); let reject!: (error: unknown) => void
    actions.create.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
    const { node } = await mount(actions); await choose(node); await click(node, 'MAX')
    const send = Array.from(node.querySelectorAll('button')).find(b => b.textContent === 'Envoyer')!
    await act(async () => { send.click(); send.click() }); expect(actions.create).toHaveBeenCalledTimes(1)
    const key = actions.create.mock.calls[0]![2]
    await act(async () => reject(new ApiError('NETWORK_ERROR', 'Connexion interrompue.', null)))
    actions.partners.mockResolvedValue({ partners: [], page: 1, total: 0, pageSize: 10, totalPages: 1 })
    await act(async () => window.dispatchEvent(new Event('focus')))
    await click(node, 'Réessayer l’action'); expect(actions.create).toHaveBeenLastCalledWith('b', '300', key)
  })
  it('polls only while visible, queues focus without overlapping, synchronizes remote stocks and stops on unmount', async () => {
    vi.useFakeTimers(); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    const actions = api(), { onSnapshot } = await mount(actions)
    const initial = actions.snapshot.mock.calls.length
    let release!: (value: TradeSnapshot) => void
    actions.snapshot.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(6000) })
    expect(actions.snapshot).toHaveBeenCalledTimes(initial + 1)
    const remote = { ...empty, stocks: [{ resourceKey: 'particles_pyro', total: '700', reserved: '0', available: '700' }] }
    actions.snapshot.mockResolvedValue(remote)
    await act(async () => release(remote)); expect(onSnapshot).toHaveBeenLastCalledWith(remote)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); const count = actions.snapshot.mock.calls.length
    await act(async () => vi.advanceTimersByTimeAsync(9000)); expect(actions.snapshot).toHaveBeenCalledTimes(count)
    act(() => roots.splice(0).forEach(root => root.unmount()))
    await act(async () => vi.advanceTimersByTimeAsync(9000)); expect(actions.snapshot).toHaveBeenCalledTimes(count)
  })
  it('registers a Menu destination and notification deep-link without adding a main tile', () => {
    expect(parseNavigationHash('#trades')).toBe('trades'); expect(hashForScreen('trades')).toBe('trades')
    expect(mainNavigation).toHaveLength(7); expect(navigationDestinations.find(d => d.id === 'trades')?.screen).toBe('trades')
    const presentation = resolveNotificationPresentation({ id: 'n', domainKey: 'trades', typeKey: 'TRADES_PENDING', payload: { count: 3 }, actionKey: 'OPEN_TRADES', actionTargetId: null, state: 'UNREAD', createdAt: '', readAt: null })
    expect(presentation.destination).toBe('trades'); expect(presentation.message).toContain('3')
  })
})
