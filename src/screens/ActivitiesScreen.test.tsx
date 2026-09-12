// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DailyChallengeDto, DailyChallengeMutationDto, DailyCombatDto, DailyRewardClaimDto, DailyRewardTodayDto, ElementKey, WheelSpinDto, WheelTodayDto } from '../api/types'
import type { ScreenId } from '../types'
import ActivitiesScreen from './ActivitiesScreen'

const roots: Root[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren() })

type SharedProps = { wheelToday: WheelTodayDto; onSpinWheel: () => Promise<WheelSpinDto>; dailyRewardToday: DailyRewardTodayDto; dailyChallenge: DailyChallengeDto; elementKey: ElementKey; onClaimDailyReward: () => Promise<DailyRewardClaimDto>; onPurchaseDailyChallenge: (key: string) => Promise<DailyChallengeMutationDto>; onSwitchDailyChallenge: (key: string) => Promise<DailyChallengeMutationDto>; onOpenParticleConversion: () => void; onNavigate: (screen: ScreenId) => void }
const availableChallenge: DailyChallengeDto = { businessDate: '2026-09-11', status: 'AVAILABLE', assigned: false, purchaseCost: '10000', challenge: null, switchCount: 0, nextSwitchCost: null, canSwitch: false, completedAt: null }
const activeChallenge: DailyChallengeDto = { ...availableChallenge, status: 'ACTIVE', assigned: true, challenge: { externalKey: 'daily_pulls_5', type: 'pulls', displayName: 'Vœux du jour', description: 'Effectuez 5 Invocations.', progressLabel: 'Invocations effectuées', progress: '0', target: '5', rewardPrimogems: '800' }, nextSwitchCost: '20000', canSwitch: true }
const shared: SharedProps = { wheelToday: { spun: false, businessDate: '2026-09-11', result: null }, onSpinWheel: vi.fn(), dailyRewardToday: { claimed: false, businessDate: '2026-09-11', rewards: { primogems: '800', moras: '50000', mainElementParticles: '500' } }, dailyChallenge: availableChallenge, elementKey: 'hydro', onClaimDailyReward: vi.fn(), onPurchaseDailyChallenge: vi.fn(), onSwitchDailyChallenge: vi.fn(), onOpenParticleConversion: vi.fn(), onNavigate: vi.fn() }
function mount(overrides: Partial<typeof shared> & Partial<React.ComponentProps<typeof ActivitiesScreen>> = {}, screen: ScreenId = 'activities-dailies') { const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root); const props = { ...shared, ...overrides }; act(() => root.render(<ActivitiesScreen screen={screen} {...props} />)); return { container, props, root } }
function activity(container: HTMLElement, title: string) { return container.querySelector<HTMLElement>(`[data-daily-activity="${title}"]`)! }
const combat = (status: DailyCombatDto['status'], koCharacterIds: readonly string[] = []): DailyCombatDto => ({ businessDate: '2026-09-11', status, encounter: { id: 'encounter', enemies: [] }, loadout: { nextAttemptMode: 'MANUAL', slots: [1, 2, 3, 4].map((position) => ({ position: position as 1 | 2 | 3 | 4, character: null, ko: false })) }, availableCharacters: [], koCharacterIds, availableCharacterCount: status === 'BLOCKED' ? 3 : 8, preview: null, canFight: false, reward: { primogems: '800', moras: '20000' }, lastAttempt: status === 'IN_PROGRESS' ? { id: 'attempt', mode: 'MANUAL', won: false, chanceHalfPoints: 148, createdAt: '2026-09-11T10:00:00.000Z' } : null, playerStats: { totalFights: '0', totalWins: '0', totalLosses: '0', totalManualWins: '0' } })

describe('Activities shells', () => {
  it('keeps daily tabs outside the framed scroll body for overview, Wheel and Challenge', () => { const { container } = mount(); const frame = container.querySelector('.dailies-frame')!; expect(frame.querySelector('.scrollable-screen-panel-controls .activity-inner-tabs')).not.toBeNull(); expect(frame.querySelector('.scrollable-screen-panel-body .dailies-overview')).not.toBeNull(); act(() => Array.from(frame.querySelectorAll('button')).find((button) => button.textContent === 'Roue')!.click()); expect(frame.querySelector('.scrollable-screen-panel-body .wheel-card')).not.toBeNull(); act(() => Array.from(frame.querySelectorAll('button')).find((button) => button.textContent === 'Défi')!.click()); expect(frame.querySelector('.scrollable-screen-panel-body .daily-challenge-card')).not.toBeNull() })
  it('lists the seven decided daily activities in order without fake progress', () => { const { container } = mount(); expect(Array.from(container.querySelectorAll<HTMLElement>('[data-daily-activity]'), (entry) => entry.dataset.dailyActivity)).toEqual(['Récompense quotidienne', 'Roue', 'Défi', 'Combat', 'Expédition', 'Amitié', 'Événement']); expect(container.textContent).toContain('Disponible aujourd’hui.'); expect(container.textContent).not.toContain('Mission quotidienne'); expect(container.textContent).not.toMatch(/\d+\s*\/\s*\d+/); expect(container.querySelector('.dailies-overview')).not.toBeNull() })
  it('uses the shared overview card and action geometry for available and claimed Daily Reward states', () => {
    const available = mount()
    const reward = activity(available.container, 'Récompense quotidienne')
    const wheel = activity(available.container, 'Roue')
    expect(reward.querySelector('.daily-icon')).toBeNull()
    expect(reward.querySelector('.daily-reward-overview-card')).not.toBeNull()
    expect(reward.querySelector('.daily-overview-action-slot .small-primary-button')?.textContent).toBe('Récupérer')
    expect(wheel.querySelector('.daily-overview-action-slot .small-primary-button')?.textContent).toBe('Accéder')
    const claimed = mount({ dailyRewardToday: { ...shared.dailyRewardToday, claimed: true } })
    const claimedReward = activity(claimed.container, 'Récompense quotidienne')
    expect(claimedReward.textContent).toContain('✅ Terminé')
    expect(claimedReward.textContent).toContain('Récompense récupérée aujourd’hui.')
    expect(claimedReward.textContent).toContain('Obtenu : +800 Primos · +500 particules Hydro · +50 000 Moras')
    expect(claimedReward.querySelector('button')).toBeNull()
    expect(claimedReward.querySelector('.daily-overview-action-slot')).toBeNull()
  })
  it('shows the real available Wheel state and opens the Wheel subview from Accéder', () => { const { container } = mount(); const wheel = activity(container, 'Roue'); expect(wheel.textContent).toContain('Une tentative disponible aujourd’hui'); expect(wheel.textContent).not.toContain('À faire'); expect(wheel.querySelector('button')?.textContent).toBe('Accéder'); act(() => wheel.querySelector('button')!.click()); expect(container.textContent).toContain('Roue astrale'); expect(container.textContent).toContain('Votre tentative du jour est disponible') })
  it('forces Aperçu again when an explicit sidebar request arrives from Roue or Défi', () => { const mounted = mount({ dailiesOverviewRequestToken: 0 }); const render = (token: number) => mounted.root.render(<ActivitiesScreen screen="activities-dailies" {...mounted.props} dailiesOverviewRequestToken={token} />); act(() => Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.activity-inner-tabs button')).find((button) => button.textContent === 'Roue')!.click()); expect(mounted.container.querySelector('.wheel-card')).not.toBeNull(); act(() => render(1)); expect(mounted.container.querySelector('.dailies-overview')).not.toBeNull(); act(() => Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.activity-inner-tabs button')).find((button) => button.textContent === 'Défi')!.click()); expect(mounted.container.querySelector('.daily-challenge-card')).not.toBeNull(); act(() => render(2)); expect(mounted.container.querySelector('.dailies-overview')).not.toBeNull() })
  it.each([
    ['TODO', [], 'Prêt à combattre', null, true],
    ['IN_PROGRESS', ['a', 'b', 'c', 'd'], 'En cours', '4 personnages KO.', true],
    ['BLOCKED', ['a', 'b', 'c', 'd'], 'Bloqué', 'Moins de 4 personnages disponibles.', true],
    ['COMPLETED', [], '✅ Terminé', 'Victoire obtenue aujourd’hui.', false],
  ] as const)('projects Combat %s honestly in Quotidiennes', (status, kos, label, detail, hasAccess) => { const { container } = mount({ dailyCombat: combat(status, kos) }); const card = activity(container, 'Combat'); expect(card.textContent).toContain(label); if (detail) expect(card.textContent).toContain(detail); expect(Boolean(card.querySelector('button'))).toBe(hasAccess); if (status === 'TODO') { expect(card.textContent).not.toContain('À faire'); expect(card.textContent).not.toContain('Aucune tentative aujourd’hui.') } if (status === 'COMPLETED') expect(card.textContent).toContain('Obtenu : +800 Primogemmes · +20 000 Moras') })
  it.each([
    [{ resultType: 'nothing', resourceKey: null, amount: null }, 'Obtenu : Rien'],
    [{ resultType: 'particles', resourceKey: 'particles_hydro', amount: '500' }, 'Obtenu : +500 particules Hydro'],
    [{ resultType: 'moras', resourceKey: 'moras', amount: '50000' }, 'Obtenu : +50 000 Moras'],
    [{ resultType: 'primogems', resourceKey: 'primogems', amount: '1600' }, 'Obtenu : +1 600 Primos'],
  ] as const)('shows a compact completed Wheel overview without an action', (result, expected) => {
    const { container } = mount({ wheelToday: { spun: true, businessDate: '2026-09-11', result } })
    const wheel = activity(container, 'Roue')
    expect(wheel.textContent).toContain('✅ Terminé')
    expect(wheel.textContent).toContain('Roue utilisée aujourd’hui.')
    expect(wheel.textContent).toContain(expected)
    expect(wheel.textContent).not.toMatch(/JACKPOT|Félicitations/)
    expect(wheel.querySelector('button')).toBeNull()
    expect(wheel.querySelector('.daily-overview-action-slot')).toBeNull()
  })
  it('hides the objective before purchase and exposes the authoritative price, reward and reset', () => { const { container } = mount(); const challenge = activity(container, 'Défi'); expect(challenge.textContent).toContain('Disponible'); act(() => challenge.querySelector('button')!.click()); expect(container.textContent).toContain('Défi du jour'); expect(container.textContent).toMatch(/10\D000 Moras/); expect(container.textContent).toContain('800 Primogemmes'); expect(container.textContent).toContain('reset journalier'); expect(container.textContent).not.toContain('Invocations effectuées') })
  it('switches directly at zero progress and asks for confirmation only after progress exists', async () => {
    const direct = vi.fn(async () => ({ ...activeChallenge, operation: { id: 'direct', alreadyProcessed: false }, resources: { primogems: '0', moras: '0', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } } }))
    const first = mount({ dailyChallenge: activeChallenge, onSwitchDailyChallenge: direct })
    act(() => activity(first.container, 'Défi').querySelector('button')!.click())
    await act(async () => { Array.from(first.container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.startsWith('Changer de Défi'))!.click(); await Promise.resolve() })
    expect(direct).toHaveBeenCalledOnce()
    expect(first.container.querySelector('[role="dialog"]')).toBeNull()

    const confirmed = vi.fn(async () => ({ ...activeChallenge, operation: { id: 'confirmed', alreadyProcessed: false }, resources: { primogems: '0', moras: '0', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } } }))
    const second = mount({ dailyChallenge: { ...activeChallenge, challenge: { ...activeChallenge.challenge!, progress: '2' } }, onSwitchDailyChallenge: confirmed })
    act(() => activity(second.container, 'Défi').querySelector('button')!.click())
    act(() => Array.from(second.container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.startsWith('Changer de Défi'))!.click())
    expect(confirmed).not.toHaveBeenCalled()
    expect(second.container.querySelector('[role="dialog"]')?.textContent).toMatch(/20\D000 Moras/)
    await act(async () => { Array.from(second.container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find((button) => button.textContent?.startsWith('Confirmer'))!.click(); await Promise.resolve() })
    expect(confirmed).toHaveBeenCalledOnce()
  })
  it('shows a completed challenge with its received reward and no switch or claim action', () => {
    const completed = { ...activeChallenge, status: 'COMPLETED' as const, canSwitch: false, nextSwitchCost: null, completedAt: '2026-09-11T12:00:00.000Z', challenge: { ...activeChallenge.challenge!, progress: '5' } }
    const { container } = mount({ dailyChallenge: completed })
    const overview = activity(container, 'Défi')
    expect(overview.textContent).toContain('Terminé')
    expect(overview.textContent).toContain('5 / 5 Invocations effectuées.')
    expect(overview.textContent).toContain('Obtenu : +800 Primogemmes')
    expect(overview.querySelector('button')).toBeNull()
    expect(overview.querySelector('.daily-overview-action-slot')).toBeNull()
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('.activity-inner-tabs button')).find((button) => button.textContent === 'Défi')!.click())
    expect(container.textContent).toContain('5 / 5 Invocations effectuées.')
    expect(container.textContent).toContain('+800 Primogemmes')
    expect(container.textContent).toContain('Récompense reçue')
    expect(container.textContent).not.toContain('Changer de Défi')
    expect(container.textContent).not.toContain('Réclamer')
  })
  it('shows an explicit insufficient-wallet error when purchasing a challenge', async () => {
    const onPurchaseDailyChallenge = vi.fn(async () => { throw { code: 'DAILY_CHALLENGE_WALLET_INSUFFICIENT' } })
    const { container } = mount({ onPurchaseDailyChallenge })
    act(() => activity(container, 'Défi').querySelector('button')!.click())
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.startsWith('Acheter le Défi'))!.click(); await Promise.resolve() })
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Vous n’avez pas assez de Moras pour acheter le Défi.')
  })

  it('shows an explicit insufficient-wallet error when switching a challenge', async () => {
    const onSwitchDailyChallenge = vi.fn(async () => { throw { code: 'DAILY_CHALLENGE_WALLET_INSUFFICIENT' } })
    const { container } = mount({ dailyChallenge: activeChallenge, onSwitchDailyChallenge })
    act(() => activity(container, 'Défi').querySelector('button')!.click())
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.startsWith('Changer de Défi'))!.click(); await Promise.resolve() })
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Vous n’avez pas assez de Moras pour changer de Défi.')
  })
  it('opens the shared conversion overlay without navigation and routes Pulls to Invocation', () => {
    const conversion = { ...activeChallenge, challenge: { ...activeChallenge.challenge!, externalKey: 'daily_convert_particles_320', type: 'conversion' as const, displayName: 'Alchimie élémentaire', description: 'Convertissez 320 particules.', progressLabel: 'Particules converties', target: '320' } }
    const onOpenParticleConversion = vi.fn(); const onNavigate = vi.fn()
    const first = mount({ dailyChallenge: conversion, onOpenParticleConversion, onNavigate })
    act(() => activity(first.container, 'Défi').querySelector('button')!.click())
    act(() => Array.from(first.container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Convertir')!.click())
    expect(onOpenParticleConversion).toHaveBeenCalledOnce()
    expect(onNavigate).not.toHaveBeenCalled()

    const second = mount({ dailyChallenge: activeChallenge, onNavigate })
    act(() => activity(second.container, 'Défi').querySelector('button')!.click())
    act(() => Array.from(second.container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Aller à l’Invocation')!.click())
    expect(onNavigate).toHaveBeenCalledWith('invocation')
  })
  it.each([['Combat', 'activities-combat'], ['Expédition', 'characters-box'], ['Événement', 'activities-event']] as const)('routes %s to its existing owner', (title, destination) => { const onNavigate = vi.fn(); const { container } = mount({ onNavigate }); act(() => activity(container, title).querySelector('button')!.click()); expect(onNavigate).toHaveBeenCalledWith(destination) })
  it('keeps Amitié unavailable without inventing a Social route', () => { const onNavigate = vi.fn(); const { container } = mount({ onNavigate }); const friendship = activity(container, 'Amitié'); const button = friendship.querySelector<HTMLButtonElement>('button')!; expect(friendship.textContent).toContain('Bientôt disponible'); expect(button.disabled).toBe(true); expect(button.getAttribute('aria-label')).toContain('Social et Amis bientôt disponibles'); expect(onNavigate).not.toHaveBeenCalled() })
  it.each([['activities-missions', ['B', 'A', 'S', 'Z']], ['activities-event', ['Jeux', 'Shop', 'Classement']]] as const)('exposes the reserved labels for %s without fake gameplay', (screen, labels) => { const { container } = mount({}, screen); labels.forEach((label) => expect(container.textContent).toContain(label)); expect(container.textContent).toContain('Bientôt disponible') })
  it('renders real Entraînement while keeping only Boss honestly unavailable', () => { const { container } = mount({}, 'activities-combat'); expect(container.textContent).toContain('Entraînement'); expect(container.textContent).toContain('Rencontre du jour'); expect(container.textContent).toContain('Ennemis'); expect(container.textContent).not.toContain('Le Boss n’est pas encore implémenté.'); act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('.combat-tabs button')).find((button) => button.textContent === 'Boss')!.click()); expect(container.textContent).toContain('Bientôt disponible'); expect(container.textContent).toContain('Le Boss n’est pas encore implémenté.'); expect(container.textContent).not.toContain('PV') })
})
