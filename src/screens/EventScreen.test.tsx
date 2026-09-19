// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/game-api'
import type { EventDto, EventDailyBonusClaimDto, EventGameAAttemptDto, EventGameBAttemptDto, EventGameCRecipientQuery, EventGameCRecipientsDto, EventGameCSendDto, EventJoinDto } from '../api/types'
import EventScreen from './EventScreen'

const roots: Root[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren(); vi.useRealTimers() })

const beforeJoin: EventDto = {
  businessDate: '2026-09-15', refreshAfterMs: 3600000,
  festival: { key: 'harvest', month: 9, title: 'Festival des Récoltes', emoji: '\u{1F33E}', currency: { key: 'harvest-tokens', label: 'Jetons de Récolte', unit: 'Jeton de Récolte', emoji: '\u{1F33E}' }, collection: { key: 'harvest-sheaf', label: 'Gerbe de Récolte' } },
  edition: { id: 'edition-2026', year: 2026, startsAt: '2026-08-31T22:00:00.000Z', endsAt: '2026-09-30T22:00:00.000Z' },
  participation: { joined: false, joinedAt: null, points: 0 }, currency: { amount: '0' }, shop: { available: false, balance: '0', rates: { primogems: '160', moras: '20000' }, collection: { itemExternalKey: 'gerbe_de_recolte', label: 'Gerbe de Récolte', cost: '80', obtainedThisEdition: false, available: true } }, canJoin: true,
  dailyBonus: { claimedToday: false, canClaim: false }, milestones: { currentPoints: 0, thresholds: [] },
  gameA: { available: false, theme: { key: 'recolte', label: 'Récolte' }, completedToday: false, attemptsToday: 0, windows: [], activeWindowIndex: null, canAttempt: false, cooldownRemainingMs: 0 },
  gameB: { available: false, theme: { key: 'harvest', label: 'Festival des Récoltes' }, solvedToday: false, resolvedCode: null, discoveredBy: null, attemptsUsed: 0, attemptsRemaining: 0, testedCodes: [], remainingCodes: Array.from({ length: 32 }, (_, index) => index.toString(2).padStart(5, '0')), canAttempt: false },
  gameC: { available: false, theme: { key: 'harvest', label: 'Panier' }, sentToday: false, canSend: false, receivedMessages: [], unviewedCount: 0 },
}
const joinedGameA = { available: true, theme: { key: 'recolte', label: 'Récolte' }, completedToday: false, attemptsToday: 0, windows: [
  { startAt: '2026-09-15T07:00:00.000Z', endAt: '2026-09-15T08:00:00.000Z', state: 'PAST' as const },
  { startAt: '2026-09-15T12:00:00.000Z', endAt: '2026-09-15T13:00:00.000Z', state: 'ACTIVE' as const },
  { startAt: '2026-09-15T18:00:00.000Z', endAt: '2026-09-15T19:00:00.000Z', state: 'FUTURE' as const },
], activeWindowIndex: 1, canAttempt: true, cooldownRemainingMs: 0 }
const afterJoin: EventJoinDto = { ...beforeJoin, participation: { joined: true, joinedAt: '2026-09-15T12:00:00.000Z', points: 0 }, currency: { amount: '1' }, canJoin: false, dailyBonus: { claimedToday: false, canClaim: true }, gameA: joinedGameA, gameB: { ...beforeJoin.gameB, available: true, attemptsRemaining: 3, canAttempt: true }, gameC: { ...beforeJoin.gameC, available: true, canSend: true }, operation: { id: 'operation-1', alreadyProcessed: false } }

function mount(options: { sessionUserId?: string; value?: EventDto; onLoad?: () => Promise<EventDto>; onLoadRanking?: () => Promise<{ editionId: string; entries: { rank: number; playerId: string; displayName: string; points: number }[] }>; onJoin?: (key: string) => Promise<EventJoinDto>; onClaimDailyBonus?: (key: string) => Promise<EventDailyBonusClaimDto>; onConvertShop?: (target: 'PRIMOGEMS' | 'MORAS', quantity: number, key: string) => Promise<EventDto>; onPurchaseCollection?: (key: string) => Promise<EventDto>; onAttempt?: (key: string) => Promise<EventGameAAttemptDto>; onAttemptB?: (code: string, key: string) => Promise<EventGameBAttemptDto>; onSearchRecipients?: (query: EventGameCRecipientQuery) => Promise<EventGameCRecipientsDto>; onSendGameC?: (recipientId: string, message: string, key: string) => Promise<EventGameCSendDto>; onConsultMessages?: () => Promise<EventDto>; openMessagesToken?: number } = {}) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  const props = { sessionUserId: options.sessionUserId ?? 'player-1', value: options.value ?? beforeJoin, onLoad: options.onLoad ?? vi.fn(async () => beforeJoin), onLoadRanking: options.onLoadRanking, onJoin: options.onJoin ?? vi.fn(async () => afterJoin), onClaimDailyBonus: options.onClaimDailyBonus, onConvertShop: options.onConvertShop, onPurchaseCollection: options.onPurchaseCollection, onAttempt: options.onAttempt ?? vi.fn(async () => ({ ...afterJoin, attempt: { succeeded: false } })), onAttemptB: options.onAttemptB ?? vi.fn(async () => ({ ...afterJoin, attempt: { kind: 'INCORRECT' as const } })), onSearchRecipients: options.onSearchRecipients, onSendGameC: options.onSendGameC, onConsultMessages: options.onConsultMessages, openMessagesToken: options.openMessagesToken }
  act(() => root.render(<EventScreen {...props} />))
  return { container, root, props }
}

function selectGames(container: HTMLElement) {
  act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('.event-tabs button')).find(({ textContent }) => textContent === 'Jeux')!.click())
}

describe('EventScreen presentation', () => {
  it('exposes only a Codes navigation action and honors the Shop notification intent', () => {
    const mounted = mount({ value: { ...afterJoin, giftCode: { available: true } } })
    const onOpenCodes = vi.fn()
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={{ ...afterJoin, giftCode: { available: true } }} onOpenCodes={onOpenCodes} />))
    const link = Array.from(mounted.container.querySelectorAll('button')).find(button => button.textContent === 'Voir les Codes')!
    act(() => link.click())
    expect(onOpenCodes).toHaveBeenCalledOnce()
    act(() => mounted.root.render(<EventScreen {...mounted.props} openShopToken={1} />))
    expect(mounted.container.querySelector('.event-shop')).not.toBeNull()
    expect(mounted.container.textContent).not.toContain('Voir les Codes')
  })
  it('claims the daily bonus once and shows the next-day reset without a fake claim action', async () => {
    const claimed: EventDailyBonusClaimDto = { ...afterJoin, dailyBonus: { claimedToday: true, canClaim: false }, currency: { amount: '2' }, operation: { id: 'bonus-operation', alreadyProcessed: false } }
    const onClaimDailyBonus = vi.fn(async () => claimed)
    const mounted = mount({ value: afterJoin, onClaimDailyBonus })
    expect(mounted.container.textContent).toContain('+1 Jeton de Récolte')
    const bonus = mounted.container.querySelector('.event-daily-bonus')!
    const participation = mounted.container.querySelector('.event-foundation-card')!
    expect(bonus.compareDocumentPosition(participation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await act(async () => { Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-daily-bonus button')).find((button) => button.textContent === 'Réclamer')!.click(); await Promise.resolve() })
    expect(onClaimDailyBonus).toHaveBeenCalledWith(expect.any(String))
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={claimed} />))
    expect(mounted.container.querySelector('.event-daily-bonus')?.textContent).toContain('Réclamé aujourd’hui')
    expect(mounted.container.querySelector('.event-daily-bonus button')).toBeNull()
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={{ ...afterJoin, businessDate: '2026-09-16' }} />))
    expect(mounted.container.querySelector('.event-daily-bonus button')?.textContent).toBe('Réclamer')
  })

  it.each([0, 9, 10, 79, 80, 87])('keeps the milestone bar visible at %i points across Event sections', (points) => {
    const thresholds = [10, 20, 30, 40, 50, 60, 70, 80].map((threshold) => ({ points: threshold, reached: points >= threshold, rewarded: points >= threshold, rewardLabel: `${threshold} points : récompense` }))
    const value: EventDto = { ...afterJoin, participation: { ...afterJoin.participation, points }, milestones: { currentPoints: points, thresholds } }
    const { container } = mount({ value })
    const progress = container.querySelector<HTMLElement>('[role="progressbar"]')!
    expect(progress.getAttribute('aria-valuenow')).toBe(String(Math.min(points, 80)))
    expect(container.querySelector('.event-milestone-summary')?.textContent).toContain(`${points} points`)
    expect(container.querySelector('.event-milestone-summary')?.textContent).toContain('Votre progression')
    expect(container.querySelector('.event-milestone-summary')?.textContent).not.toContain('Progression vers 80 points')
    expect(container.querySelectorAll('.event-milestone-marker')).toHaveLength(8)
    expect(container.querySelectorAll('.event-milestone-marker.rewarded')).toHaveLength(thresholds.filter((threshold) => threshold.rewarded).length)
    selectGames(container)
    expect(container.querySelector('[role="progressbar"]')).toBe(progress)
    expect(container.querySelector('.event-milestone-summary')?.textContent).toContain(`${points} points`)
  })
  it('keeps horizontal milestone scrolling without a vertical scrollbar', () => {
    const css = readFileSync('src/App.css', 'utf8')
    expect(css).toMatch(/\.event-milestone-track-scroll\s*\{[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*hidden;/s)
  })
  it('refreshes on entry and opens the registration summary first', async () => {
    const mounted = mount()
    await act(async () => { await Promise.resolve() })
    expect(mounted.props.onLoad).toHaveBeenCalledOnce()
    expect(mounted.container.textContent).toContain('Festival des Récoltes')
    expect(mounted.container.textContent).toContain('Jetons de Récolte')
    expect(mounted.container.textContent).toContain('Gerbe de Récolte')
    expect(mounted.container.textContent).toContain('Recevez 1 Jeton de Récolte')
    expect(mounted.container.textContent).toContain('du 1 septembre 2026 au 30 septembre 2026')
    expect(mounted.container.textContent).toContain('Non inscrit')
    expect(mounted.container.querySelector<HTMLButtonElement>('.event-foundation-card button')?.disabled).toBe(false)
    const tabs = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button'))
    expect(tabs.map(({ textContent }) => textContent)).toEqual(['Inscription', 'Jeux', 'Shop', 'Classement'])
    expect(tabs.map(({ disabled }) => disabled)).toEqual([false, true, false, false])
    act(() => tabs[1].click())
    expect(mounted.container.querySelector('.event-tabs .active')?.textContent).toBe('Inscription')
    expect(mounted.container.querySelector('.event-stat-grid')).not.toBeNull()
    expect(mounted.container.textContent).not.toMatch(/À venir|Bientôt disponible|prochains lots/)
  })

  it('enables Games after the server join snapshot without leaving registration', () => {
    const mounted = mount()
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={afterJoin} />))
    const tabs = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button'))
    expect(tabs.map(({ disabled }) => disabled)).toEqual([false, false, false, false])
    expect(mounted.container.querySelector('.event-tabs .active')?.textContent).toBe('Inscription')
    expect(mounted.container.textContent).toContain('Événement rejoint')
    expect(mounted.container.querySelector('.event-game-a')).toBeNull()
  })

  it('opens Shop and Classement publicly without joining or refreshing the full Event for ranking', async () => {
    const onLoad = vi.fn(async () => beforeJoin)
    const onLoadRanking = vi.fn(async () => ({ editionId: beforeJoin.edition.id, entries: [{ rank: 1, playerId: 'another-player', displayName: 'Festivaliste', points: 12 }] }))
    const mounted = mount({ onLoad, onLoadRanking })
    const tabs = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button'))
    act(() => tabs[2].click())
    expect(mounted.container.querySelector('.event-shop')).not.toBeNull()
    expect(mounted.container.textContent).toContain('Gerbe de Récolte')
    await act(async () => { tabs[3].click(); await Promise.resolve() })
    expect(mounted.container.querySelector('.event-ranking-list')?.textContent).toContain('Festivaliste')
    expect(onLoadRanking).toHaveBeenCalledTimes(1)
    expect(onLoad).toHaveBeenCalledTimes(1)
  })

  it('keeps one Shop request in flight across tabs and issues a new key after confirmed success', async () => {
    let completeFirst!: (value: EventDto) => void
    const first = new Promise<EventDto>((resolve) => { completeFirst = resolve })
    const onConvertShop = vi.fn().mockReturnValueOnce(first).mockResolvedValue(afterJoin)
    const shopValue = { ...afterJoin, shop: { ...afterJoin.shop, available: true, balance: '80', rates: { primogems: '9007199254740993', moras: '20000' } } }
    const mounted = mount({ value: shopValue, onConvertShop })
    const tab = (name: string) => Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button')).find((button) => button.textContent === name)!
    act(() => tab('Shop').click())
    const convert = () => mounted.container.querySelector<HTMLButtonElement>('.event-shop-card button.small-primary-button')!
    act(() => { convert().click(); convert().click() })
    expect(onConvertShop).toHaveBeenCalledTimes(1)
    expect(onConvertShop).toHaveBeenCalledWith('PRIMOGEMS', 1, expect.any(String))
    act(() => { tab('Inscription').click(); tab('Shop').click() })
    expect(convert().disabled).toBe(true)
    expect(convert().textContent).toBe('Échange…')
    await act(async () => { completeFirst(shopValue); await first })
    expect(mounted.container.querySelector('.event-shop-feedback')?.textContent).toContain('9 007 199 254 740 993 Primogemmes')
    await act(async () => { convert().click(); await Promise.resolve() })
    expect(onConvertShop).toHaveBeenCalledTimes(2)
    expect(onConvertShop.mock.calls[1][2]).not.toBe(onConvertShop.mock.calls[0][2])
  })

  it.each([
    { target: 'PRIMOGEMS' as const, quantity: 1, expected: 'Échange effectué ! Vous obtenez 160 Primogemmes contre 1 Jeton de Récolte.' },
    { target: 'PRIMOGEMS' as const, quantity: 2, expected: 'Échange effectué ! Vous obtenez 320 Primogemmes contre 2 Jetons de Récolte.' },
    { target: 'MORAS' as const, quantity: 1, expected: 'Échange effectué ! Vous obtenez 20 000 Moras contre 1 Jeton de Récolte.' },
    { target: 'MORAS' as const, quantity: 5, expected: 'Échange effectué ! Vous obtenez 100 000 Moras contre 5 Jetons de Récolte.' },
  ])('shows exact green conversion feedback for $quantity $target', async ({ target, quantity, expected }) => {
    const shopValue = { ...afterJoin, shop: { ...afterJoin.shop, available: true, balance: String(quantity) } }
    const mounted = mount({ value: shopValue, onConvertShop: vi.fn(async () => shopValue) })
    act(() => Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button')).find((button) => button.textContent === 'Shop')!.click())
    const card = Array.from(mounted.container.querySelectorAll<HTMLElement>('.event-shop-card')).find((item) => item.querySelector('h2')?.textContent === (target === 'MORAS' ? 'Moras' : 'Primogemmes'))!
    if (quantity > 1) act(() => card.querySelector<HTMLButtonElement>('.event-shop-max')!.click())
    await act(async () => { card.querySelector<HTMLButtonElement>('button.small-primary-button')!.click(); await Promise.resolve() })
    const feedback = mounted.container.querySelector('.event-shop-feedback')!
    expect(feedback.textContent).toBe(expected)
    expect(feedback.classList.contains('success')).toBe(true)
    expect(feedback.getAttribute('role')).toBe('status')
  })

  it('uses the active Festival currency labels and replaces success with an alert on a failed next exchange', async () => {
    const currency = { key: 'star-coins', unit: 'Pièce d’Étoile', label: 'Pièces d’Étoile', emoji: '✦' }
    const shopValue = { ...afterJoin, festival: { ...afterJoin.festival, currency }, shop: { ...afterJoin.shop, available: true, balance: '2' } }
    const onConvertShop = vi.fn().mockResolvedValueOnce(shopValue).mockRejectedValueOnce(new ApiError('SHOP_ERROR', 'Échange refusé.', null))
    const mounted = mount({ value: shopValue, onConvertShop })
    act(() => Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button')).find((button) => button.textContent === 'Shop')!.click())
    const convert = () => mounted.container.querySelector<HTMLButtonElement>('.event-shop-card button.small-primary-button')!
    await act(async () => { convert().click(); await Promise.resolve() })
    expect(mounted.container.querySelector('.event-shop-feedback')?.textContent).toBe('Échange effectué ! Vous obtenez 160 Primogemmes contre 1 Pièce d’Étoile.')
    await act(async () => { convert().click(); await Promise.resolve() })
    const feedback = mounted.container.querySelector('.event-shop-feedback')!
    expect(feedback.textContent).toBe('La demande n’a pas pu être traitée.')
    expect(feedback.classList.contains('success')).toBe(false)
    expect(feedback.getAttribute('role')).toBe('alert')
  })

  it('retries an ambiguous Shop conversion with the exact intent after tab and business-date changes', async () => {
    const onConvertShop = vi.fn()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Réseau indisponible.', null))
      .mockResolvedValue(afterJoin)
    const shopValue = { ...afterJoin, shop: { ...afterJoin.shop, available: true, balance: '80' } }
    const mounted = mount({ value: shopValue, onConvertShop })
    const tab = (name: string) => Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button')).find((button) => button.textContent === name)!
    act(() => tab('Shop').click())
    act(() => mounted.container.querySelector<HTMLButtonElement>('.event-shop-max')!.click())
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-shop-card button.small-primary-button')!.click(); await Promise.resolve() })
    const original = onConvertShop.mock.calls[0]
    expect(original).toEqual(['PRIMOGEMS', 80, expect.any(String)])
    act(() => { tab('Classement').click(); tab('Shop').click() })
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={{ ...shopValue, businessDate: '2026-09-16' }} />))
    expect((mounted.container.querySelector('#event-shop-PRIMOGEMS') as HTMLInputElement).value).toBe('80')
    await act(async () => { Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-shop-card button')).find((button) => button.textContent === 'Réessayer')!.click(); await Promise.resolve() })
    expect(onConvertShop.mock.calls[1]).toEqual(original)
  })

  it('drops a Shop intent at player and edition boundaries and uses neutral Collection feedback', async () => {
    const onConvertShop = vi.fn().mockRejectedValue(new ApiError('NETWORK_ERROR', 'Réseau indisponible.', null))
    const onPurchaseCollection = vi.fn(async () => afterJoin)
    const shopValue = { ...afterJoin, shop: { ...afterJoin.shop, available: true, balance: '80' } }
    const mounted = mount({ value: shopValue, onConvertShop, onPurchaseCollection })
    const shopTab = () => Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button')).find((button) => button.textContent === 'Shop')!
    act(() => shopTab().click())
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-shop-card button.small-primary-button')!.click(); await Promise.resolve() })
    act(() => mounted.root.render(<EventScreen {...mounted.props} sessionUserId="player-2" />))
    expect(mounted.container.querySelector<HTMLButtonElement>('.event-shop-card button.small-primary-button')?.textContent).toBe('Convertir')
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-shop-card button.small-primary-button')!.click(); await Promise.resolve() })
    expect(onConvertShop.mock.calls[1][2]).not.toBe(onConvertShop.mock.calls[0][2])
    act(() => mounted.root.render(<EventScreen {...mounted.props} sessionUserId="player-2" value={{ ...shopValue, edition: { ...shopValue.edition, id: 'edition-2027', year: 2027 } }} />))
    act(() => shopTab().click())
    expect(mounted.container.querySelector<HTMLButtonElement>('.event-shop-card button.small-primary-button')?.textContent).toBe('Convertir')
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-shop-collection button')!.click(); await Promise.resolve() })
    expect(mounted.container.querySelector('.event-shop-feedback')?.textContent).toBe('Objet obtenu : Gerbe de Récolte')
    expect(mounted.container.querySelector('.event-shop-feedback')?.classList.contains('success')).toBe(true)
  })

  it('does not restore a prior player’s pending Shop operation when its response arrives late', async () => {
    let complete!: (value: EventDto) => void
    const inFlight = new Promise<EventDto>((resolve) => { complete = resolve })
    const onConvertShop = vi.fn().mockReturnValueOnce(inFlight).mockResolvedValue(afterJoin)
    const shopValue = { ...afterJoin, shop: { ...afterJoin.shop, available: true, balance: '80' } }
    const mounted = mount({ value: shopValue, onConvertShop })
    const shopTab = () => Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button')).find((button) => button.textContent === 'Shop')!
    act(() => shopTab().click())
    act(() => mounted.container.querySelector<HTMLButtonElement>('.event-shop-card button.small-primary-button')!.click())
    act(() => mounted.root.render(<EventScreen {...mounted.props} sessionUserId="player-2" />))
    await act(async () => { complete(shopValue); await inFlight })
    expect(mounted.container.querySelector<HTMLButtonElement>('.event-shop-card button.small-primary-button')?.textContent).toBe('Convertir')
    expect(mounted.container.querySelector('.event-shop-feedback')?.textContent).toBe('')
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-shop-card button.small-primary-button')!.click(); await Promise.resolve() })
    expect(onConvertShop).toHaveBeenCalledTimes(2)
    expect(onConvertShop.mock.calls[1][2]).not.toBe(onConvertShop.mock.calls[0][2])
  })

  it('returns to registration when a new snapshot removes event participation', () => {
    const mounted = mount({ value: afterJoin })
    selectGames(mounted.container)
    expect(mounted.container.querySelector('.event-tabs .active')?.textContent).toBe('Jeux')

    act(() => mounted.root.render(<EventScreen {...mounted.props} value={{ ...beforeJoin, edition: { ...beforeJoin.edition, id: 'edition-2027', year: 2027 } }} />))

    const tabs = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button'))
    expect(tabs.map(({ disabled }) => disabled)).toEqual([false, true, false, false])
    expect(mounted.container.querySelector('.event-tabs .active')?.textContent).toBe('Inscription')
    expect(mounted.container.textContent).toContain('Recevez 1 Jeton de Récolte')
    expect(mounted.container.querySelector('.event-stat-grid')).not.toBeNull()
  })

  it('presents the exclusive December boundary as the last included calendar day', () => {
    const december = { ...beforeJoin, businessDate: '2026-12-15', festival: { ...beforeJoin.festival, key: 'christmas', month: 12, title: 'Festival de Noël' }, edition: { ...beforeJoin.edition, startsAt: '2026-11-30T23:00:00.000Z', endsAt: '2026-12-31T23:00:00.000Z' } }
    const { container } = mount({ value: december })
    expect(container.textContent).toContain('du 1 décembre 2026 au 31 décembre 2026')
    expect(container.textContent).not.toContain('au 1 janvier 2027')
  })

  it('separates the registration summary from the themed game tabs', () => {
    const { container } = mount({ value: afterJoin })
    expect(container.textContent).toContain('Événement rejoint')
    expect(container.querySelector('.event-game-a')).toBeNull()
    selectGames(container)
    expect(container.querySelector('.event-stat-grid')).toBeNull()
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button'), ({ textContent }) => textContent)).toEqual(['Récolte', 'Grenier', 'Panier'])
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button'), ({ disabled }) => disabled)).toEqual([false, false, false])
    expect(container.querySelectorAll('.event-game-a-window')).toHaveLength(3)
    expect(container.querySelector('[data-window-state="ACTIVE"]')?.textContent).toContain('Active')
    expect(container.querySelector<HTMLButtonElement>('.event-game-a-action button')?.textContent).toBe('Tenter ma chance')
    expect(container.textContent).not.toMatch(/À venir|Bientôt disponible/)
  })

  it('uses themed failure and singular success feedback with explicit visual states', async () => {
    const failed: EventGameAAttemptDto = { ...afterJoin, gameA: { ...joinedGameA, attemptsToday: 1, canAttempt: false, cooldownRemainingMs: 3000 }, operation: { id: 'attempt-1', alreadyProcessed: false }, attempt: { succeeded: false } }
    const failedMount = mount({ value: afterJoin, onAttempt: vi.fn(async () => failed) }); selectGames(failedMount.container)
    await act(async () => { failedMount.container.querySelector<HTMLButtonElement>('.event-game-a-action button')!.click(); await Promise.resolve() })
    expect(failedMount.container.querySelector('.event-game-a-feedback.failure')?.textContent).toBe('Pas cette fois ! Rien n’est encore prêt à être récolté... réessaie bientôt !')

    const success: EventGameAAttemptDto = { ...failed, participation: { ...failed.participation, points: 1 }, currency: { amount: '2' }, gameA: { ...failed.gameA, completedToday: true, cooldownRemainingMs: 0 }, operation: { id: 'attempt-2', alreadyProcessed: false }, attempt: { succeeded: true } }
    const successMount = mount({ value: afterJoin, onAttempt: vi.fn(async () => success) }); selectGames(successMount.container)
    await act(async () => { successMount.container.querySelector<HTMLButtonElement>('.event-game-a-action button')!.click(); await Promise.resolve() })
    expect(successMount.container.querySelector('.event-game-a-feedback.success')?.textContent).toBe('Réussite ! +1 point et +1 Jeton de Récolte.')
    expect(successMount.container.textContent).not.toContain('+1 Jetons de Récolte')
  })

  it('counts down 3/2/1 while the server-owned action stays disabled', async () => {
    vi.useFakeTimers()
    const onAttempt = vi.fn(async () => ({ ...afterJoin, attempt: { succeeded: false } }))
    const failed: EventDto = { ...afterJoin, gameA: { ...joinedGameA, attemptsToday: 1, canAttempt: false, cooldownRemainingMs: 3000 } }
    const { container } = mount({ value: failed, onAttempt }); selectGames(container)
    const button = () => container.querySelector<HTMLButtonElement>('.event-cooldown-button')!
    expect(button().textContent).toBe('Patientez 3 secondes...')
    act(() => button().click())
    expect(onAttempt).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(button().textContent).toBe('Patientez 2 secondes...')
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(button().textContent).toBe('Patientez 1 seconde...')
    expect(button().disabled).toBe(true)
    expect(onAttempt).not.toHaveBeenCalled()
  })

  it('shows a neutral expired state without an attempt button', () => {
    const expired: EventDto = { ...afterJoin, gameA: { ...joinedGameA, activeWindowIndex: null, canAttempt: false, windows: joinedGameA.windows.map((window) => ({ ...window, state: 'PAST' as const })) } }
    const { container } = mount({ value: expired }); selectGames(container)
    expect(container.querySelector('.event-game-a-day-state.expired')?.textContent).toBe('Délai dépassé...')
    expect(container.querySelector('.event-game-a-action button')).toBeNull()
    expect(container.textContent).not.toContain('À réussir aujourd’hui')
  })

  it('shows 32 distinct Game B codes, marks tested codes, and consumes a wrong guess', async () => {
    const value: EventDto = { ...afterJoin, gameB: { ...afterJoin.gameB, testedCodes: ['00000'], remainingCodes: afterJoin.gameB.remainingCodes.filter((code) => code !== '00000') } }
    const onAttemptB = vi.fn(async (code: string): Promise<EventGameBAttemptDto> => ({ ...value, gameB: { ...value.gameB, attemptsUsed: 1, attemptsRemaining: 2, testedCodes: ['00000', code], remainingCodes: value.gameB.remainingCodes.filter((entry) => entry !== code) }, operation: { id: 'attempt-b', alreadyProcessed: false }, attempt: { kind: 'INCORRECT' } }))
    const { container } = mount({ value, onAttemptB }); selectGames(container)
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')).find(({ textContent }) => textContent === 'Grenier')!.click())
    const codes = Array.from(container.querySelectorAll<HTMLButtonElement>('.event-game-b-code'))
    expect(codes).toHaveLength(32)
    expect(new Set(codes.map(({ textContent }) => textContent)).size).toBe(32)
    expect(codes[0].classList.contains('tested')).toBe(true)
    expect(codes[0].disabled).toBe(true)
    expect(codes[1].disabled).toBe(false)
    expect(container.textContent).toContain('3 essais personnels restants')
    act(() => codes[1].click())
    await act(async () => { container.querySelector<HTMLButtonElement>('.event-game-b-action button')!.click(); await Promise.resolve() })
    expect(onAttemptB).toHaveBeenCalledWith('00001', expect.any(String))
    expect(container.querySelector('.event-game-b-feedback')?.textContent).toBe('Code incorrect : un essai consommé.')
  })

  it('shows the discoverer and removes the action after collective resolution', () => {
    const value: EventDto = { ...afterJoin, gameB: { ...afterJoin.gameB, solvedToday: true, resolvedCode: '11111', discoveredBy: { id: 'discoverer', displayName: 'Kyo' }, testedCodes: ['11111'], remainingCodes: afterJoin.gameB.remainingCodes.filter((code) => code !== '11111'), canAttempt: false } }
    const { container } = mount({ value }); selectGames(container)
    act(() => container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')[1].click())
    expect(container.querySelector('.event-game-b')?.textContent).toContain('Découvert par Kyo')
    const winningCode = Array.from(container.querySelectorAll<HTMLButtonElement>('.event-game-b-code')).find(({ textContent }) => textContent?.includes('11111'))
    expect(winningCode?.textContent).toBe('✓ 11111')
    expect(winningCode?.classList.contains('resolved')).toBe(true)
    expect(winningCode?.classList.contains('tested')).toBe(false)
    expect(container.querySelector('.event-game-b-feedback.success')?.textContent).toContain('Combinaison découverte')
    expect(container.querySelector('.event-game-b-action button')).toBeNull()
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.event-game-b-code')).every(({ disabled }) => disabled)).toBe(true)
  })

  it('replays an ambiguous Game B response with the same key after the snapshot exhausts attempts', async () => {
    const onAttemptB = vi.fn()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Réseau indisponible.', null))
      .mockResolvedValueOnce({ ...afterJoin, operation: { id: 'attempt-b', alreadyProcessed: true }, attempt: { kind: 'INCORRECT' } })
    const mounted = mount({ value: afterJoin, onAttemptB }); selectGames(mounted.container)
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')[1].click())
    act(() => mounted.container.querySelector<HTMLButtonElement>('.event-game-b-code')!.click())
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-game-b-action button')!.click(); await Promise.resolve() })
    const firstKey = onAttemptB.mock.calls[0][1]
    const exhausted: EventDto = { ...afterJoin, gameB: { ...afterJoin.gameB, attemptsUsed: 3, attemptsRemaining: 0, canAttempt: false } }
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={exhausted} />))
    expect(mounted.container.querySelector<HTMLButtonElement>('.event-game-b-action button')?.textContent).toBe('Réessayer 00000')
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-game-b-action button')!.click(); await Promise.resolve() })
    expect(onAttemptB.mock.calls.map((call) => call[1])).toEqual([firstKey, firstKey])
  })

  it('discards an ambiguous Game B intent at the next business date and creates a new UUID', async () => {
    const onAttemptB = vi.fn()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Réseau indisponible.', null))
      .mockResolvedValueOnce({ ...afterJoin, operation: { id: 'new-day-attempt', alreadyProcessed: false }, attempt: { kind: 'INCORRECT' } })
    const mounted = mount({ value: afterJoin, onAttemptB }); selectGames(mounted.container)
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')[1].click())
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-b-code')[0].click())
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-game-b-action button')!.click(); await Promise.resolve() })
    const oldKey = onAttemptB.mock.calls[0][1]
    expect(mounted.container.querySelector('.event-game-b-action')?.textContent).toContain('Réessayer 00000')

    const nextDay: EventDto = { ...afterJoin, businessDate: '2026-09-16' }
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={nextDay} />))
    expect(mounted.container.querySelector('.event-game-tabs .active')?.textContent).toBe('Grenier')
    expect(mounted.container.querySelector('.event-game-b-action')?.textContent).toContain('Choisissez une combinaison')
    expect(mounted.container.querySelectorAll('.event-game-b-code.selected')).toHaveLength(0)
    expect(mounted.container.querySelector('.event-game-b-feedback')?.textContent).toBe('')
    expect(mounted.container.querySelector('.event-feedback')?.textContent).toBe('')
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-b-code')[1].click())
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-game-b-action button')!.click(); await Promise.resolve() })
    expect(onAttemptB.mock.calls[1][0]).toBe('00001')
    expect(onAttemptB.mock.calls[1][1]).not.toBe(oldKey)
    expect(onAttemptB.mock.calls[1][1]).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('returns to registration and discards Game B state when the edition changes', async () => {
    const onAttemptB = vi.fn()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Réseau indisponible.', null))
      .mockResolvedValueOnce({ ...afterJoin, operation: { id: 'new-edition-attempt', alreadyProcessed: false }, attempt: { kind: 'INCORRECT' } })
    const mounted = mount({ value: afterJoin, onAttemptB }); selectGames(mounted.container)
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')[1].click())
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-b-code')[0].click())
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-game-b-action button')!.click(); await Promise.resolve() })
    const oldKey = onAttemptB.mock.calls[0][1]
    const nextEdition: EventDto = { ...afterJoin, edition: { ...afterJoin.edition, id: 'edition-2027', year: 2027 }, businessDate: '2027-09-15' }
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={nextEdition} />))
    expect(mounted.container.querySelector('.event-tabs .active')?.textContent).toBe('Inscription')
    expect(mounted.container.querySelector('.event-game-b')).toBeNull()
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button')[1].click())
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')[1].click())
    expect(mounted.container.querySelector('.event-game-b-action')?.textContent).toContain('Choisissez une combinaison')
    expect(mounted.container.querySelectorAll('.event-game-b-code.selected')).toHaveLength(0)
    expect(mounted.container.querySelector('.event-game-b-feedback')?.textContent).toBe('')
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-b-code')[1].click())
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-game-b-action button')!.click(); await Promise.resolve() })
    expect(onAttemptB.mock.calls[1][1]).not.toBe(oldKey)
  })

  it('visually completes every window after a success during an active window', () => {
    const complete: EventDto = { ...afterJoin, gameA: { ...joinedGameA, completedToday: true, canAttempt: false } }
    const { container } = mount({ value: complete }); selectGames(container)
    expect(container.querySelectorAll('.event-game-a-window.completed')).toHaveLength(3)
    expect(container.querySelectorAll('.event-game-a-window.active')).toHaveLength(0)
    expect(Array.from(container.querySelectorAll('.event-game-a-window'), (window) => window.getAttribute('data-window-state'))).toEqual(['COMPLETED', 'COMPLETED', 'COMPLETED'])
    expect(Array.from(container.querySelectorAll('.event-game-a-window small'), (label) => label.textContent)).toEqual(['Terminée', 'Terminée', 'Terminée'])
    expect(container.querySelector('.event-game-a-windows')?.textContent).not.toContain('Active')
    expect(container.querySelector('.event-game-a-windows')?.textContent).toContain('14:00')
  })

  it('keeps one pending join stable under a double click', async () => {
    let resolve!: (value: EventJoinDto) => void
    const onJoin = vi.fn(() => new Promise<EventJoinDto>((done) => { resolve = done }))
    const { container } = mount({ onJoin }); const button = container.querySelector<HTMLButtonElement>('.event-foundation-card button')!
    act(() => { button.click(); button.click() })
    expect(onJoin).toHaveBeenCalledOnce(); expect(button.disabled).toBe(true); expect(button.textContent).toBe('Inscription…')
    await act(async () => { resolve(afterJoin); await Promise.resolve() })
  })

  it('reports API errors and leaves only implemented tabs interactive', async () => {
    const onJoin = vi.fn(async () => { throw new ApiError('NETWORK_ERROR', 'Impossible de joindre le serveur GachaImpact.', null) })
    const { container } = mount({ onJoin })
    await act(async () => { container.querySelector<HTMLButtonElement>('.event-foundation-card button')!.click(); await Promise.resolve() })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('momentanément inaccessible')
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('.event-tabs button'))
    expect(tabs.map(({ disabled }) => disabled)).toEqual([false, true, false, false])
    expect(tabs.every((tab) => !tab.hasAttribute('title') && tab.querySelector('small') === null)).toBe(true)
  })

  it('lets an unregistered recipient consult only Panier and marks the inbox on opening it', async () => {
    const incoming: EventDto = { ...beforeJoin, gameC: { ...beforeJoin.gameC, available: true, receivedMessages: [{ id: 'message-1', sender: { id: 'sender-1', displayName: 'Ami' }, message: 'Belle récolte !', createdAt: '2026-09-15T12:00:00.000Z', viewed: false }], unviewedCount: 1 } }
    const onConsultMessages = vi.fn(async () => ({ ...incoming, gameC: { ...incoming.gameC, receivedMessages: incoming.gameC.receivedMessages.map((entry) => ({ ...entry, viewed: true })), unviewedCount: 0 } }))
    const { container } = mount({ value: incoming, onLoad: vi.fn(async () => incoming), onConsultMessages })
    const games = container.querySelectorAll<HTMLButtonElement>('.event-tabs button')[1]!
    expect(games.disabled).toBe(false)
    await act(async () => { games.click(); await Promise.resolve() })
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button'), ({ disabled }) => disabled)).toEqual([true, true, false])
    expect(container.querySelector('.event-game-c-inbox')?.textContent).toContain('Belle récolte !')
    expect(container.querySelector('.event-game-c-send')).toBeNull()
    expect(onConsultMessages).toHaveBeenCalledOnce()
  })

  it('opens the Game C sender surface only for a participant and keeps its personal inbox empty without fixtures', () => {
    const { container } = mount({ value: afterJoin })
    selectGames(container)
    act(() => container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')[2]!.click())
    expect(container.querySelector('.event-game-c-send input[type="search"]')).toBeNull()
    expect(container.textContent).toContain('Choisir un joueur')
    expect(container.querySelector('.event-game-c-send textarea')).not.toBeNull()
    expect(container.querySelector('.event-game-c-inbox')?.textContent).toContain('Aucun message reçu aujourd’hui')
  })

  it('uses the explicit notification intent to open Panier for a nonparticipant', async () => {
    const incoming: EventDto = { ...beforeJoin, gameC: { ...beforeJoin.gameC, available: true, receivedMessages: [{ id: 'message-1', sender: { id: 'sender-1', displayName: 'Ami' }, message: 'Bon Festival !', createdAt: '2026-09-15T12:00:00.000Z', viewed: false }], unviewedCount: 1 } }
    const onConsultMessages = vi.fn(async () => ({ ...incoming, gameC: { ...incoming.gameC, unviewedCount: 0 } }))
    const { container } = mount({ value: incoming, onLoad: vi.fn(async () => incoming), onConsultMessages, openMessagesToken: 1 })
    await act(async () => { await Promise.resolve() })
    expect(container.querySelector('.event-tabs .active')?.textContent).toBe('Jeux')
    expect(container.querySelector('.event-game-tabs .active')?.textContent).toBe('Panier')
    expect(container.querySelector('.event-game-c-inbox')?.textContent).toContain('Bon Festival !')
    expect(onConsultMessages).toHaveBeenCalledOnce()
  })

  it('returns to registration if a stale message notification has no current-day inbox', async () => {
    const mounted = mount({ value: beforeJoin, onLoad: vi.fn(async () => beforeJoin), openMessagesToken: 1 })
    await act(async () => { await Promise.resolve() })
    expect(mounted.container.querySelector('.event-tabs .active')?.textContent).toBe('Inscription')
    expect(mounted.container.querySelector('.event-game-c')).toBeNull()
  })

  it('searches an eligible recipient, selects their ID and sends one trimmed daily message', async () => {
    const onSearchRecipients = vi.fn(async () => ({ page: 1, pageSize: 10 as const, total: 1, totalPages: 1, recipients: [{ playerId: 'player-2', displayName: 'Ami Panier', level: 5, elementKey: 'hydro' as const }] }))
    const onSendGameC = vi.fn(async () => ({ ...afterJoin, gameC: { ...afterJoin.gameC, sentToday: true, canSend: false }, participation: { ...afterJoin.participation, points: 1 }, currency: { amount: '2' }, operation: { id: 'operation-c', alreadyProcessed: false } }))
    const mounted = mount({ value: afterJoin, onSearchRecipients, onSendGameC })
    selectGames(mounted.container)
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')[2]!.click())
    act(() => Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-c-send button')).find((button) => button.textContent === 'Choisir un joueur')!.click())
    const input = mounted.container.querySelector<HTMLInputElement>('.event-player-browser input[type="search"]')!
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Ami'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(onSearchRecipients).toHaveBeenLastCalledWith({ query: 'Ami', elementKey: null, sort: 'name', direction: 'asc', page: 1 })
    act(() => mounted.container.querySelector<HTMLButtonElement>('.event-player-browser .moderation-browser-results button')!.click())
    act(() => Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-player-browser button')).find((button) => button.textContent === 'Choisir ce joueur')!.click())
    const textarea = mounted.container.querySelector<HTMLTextAreaElement>('.event-game-c-send textarea')!
    act(() => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, ' Bon Festival ! '); textarea.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => { Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-c-send .small-primary-button')).find((button) => button.textContent === 'Envoyer')!.click(); await Promise.resolve() })
    expect(onSendGameC).toHaveBeenCalledWith('player-2', 'Bon Festival !', expect.any(String))
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={{ ...afterJoin, gameC: { ...afterJoin.gameC, sentToday: true, canSend: false } }} />))
    expect(mounted.container.querySelector('.event-game-c-sent')?.textContent).toContain('Envoyé aujourd’hui')
  })

  it('uses the shared browser with only safe Event filters and pages of ten', async () => {
    const onSearchRecipients = vi.fn(async (query: EventGameCRecipientQuery): Promise<EventGameCRecipientsDto> => ({
      page: query.page, pageSize: 10, total: 11, totalPages: 2,
      recipients: [{ playerId: `recipient-${query.page}`, displayName: 'Destinataire', level: 9, elementKey: 'geo' }],
    }))
    const { container } = mount({ value: afterJoin, onSearchRecipients })
    selectGames(container)
    act(() => container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')[2]!.click())
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('.event-game-c-send button')).find((button) => button.textContent === 'Choisir un joueur')!.click())
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(onSearchRecipients).toHaveBeenLastCalledWith({ query: '', elementKey: null, sort: 'name', direction: 'asc', page: 1 })
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(container.textContent).not.toContain('Rôle Testeur')
    expect(container.textContent).not.toContain('Testeur')
    const search = container.querySelector<HTMLInputElement>('.event-player-browser input[type="search"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'D'); search.dispatchEvent(new Event('input', { bubbles: true })); await Promise.resolve(); await Promise.resolve() })
    expect(onSearchRecipients).toHaveBeenLastCalledWith({ query: 'D', elementKey: null, sort: 'name', direction: 'asc', page: 1 })
    const selects = container.querySelectorAll<HTMLSelectElement>('.event-player-browser select')
    expect(selects).toHaveLength(2)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(selects[0], 'geo'); selects[0]!.dispatchEvent(new Event('change', { bubbles: true }))
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(selects[1], 'level'); selects[1]!.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve(); await Promise.resolve()
    })
    act(() => container.querySelector<HTMLButtonElement>('.event-player-browser .sort-direction-button')!.click())
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(onSearchRecipients).toHaveBeenLastCalledWith({ query: 'D', elementKey: 'geo', sort: 'level', direction: 'desc', page: 1 })
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('.event-player-browser button')).find((button) => button.textContent === 'Suivant')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(onSearchRecipients).toHaveBeenLastCalledWith({ query: 'D', elementKey: 'geo', sort: 'level', direction: 'desc', page: 2 })
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it.each([[1920, 1080], [1774, 864], [1366, 768], [390, 844]])('keeps one bounded scroll owner at %d×%d', (width, height) => {
    Object.defineProperties(window, { innerWidth: { value: width, configurable: true }, innerHeight: { value: height, configurable: true } })
    const { container } = mount()
    expect(container.querySelectorAll('.scrollable-screen-panel-body')).toHaveLength(1)
    expect(container.querySelector('.event-stat-grid')).not.toBeNull()
  })
})
