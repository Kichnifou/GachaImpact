// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DailyChallengeDto, DailyChallengeMutationDto, DailyRewardClaimDto, DailyRewardTodayDto, ElementKey, WheelSpinDto, WheelTodayDto } from '../api/types'
import type { ScreenId } from '../types'
import ActivitiesScreen from './ActivitiesScreen'

const roots: Root[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren() })

type SharedProps = { wheelToday: WheelTodayDto; onSpinWheel: () => Promise<WheelSpinDto>; dailyRewardToday: DailyRewardTodayDto; dailyChallenge: DailyChallengeDto; elementKey: ElementKey; onClaimDailyReward: () => Promise<DailyRewardClaimDto>; onPurchaseDailyChallenge: (key: string) => Promise<DailyChallengeMutationDto>; onSwitchDailyChallenge: (key: string) => Promise<DailyChallengeMutationDto>; onNavigate: (screen: ScreenId) => void }
const availableChallenge: DailyChallengeDto = { businessDate: '2026-09-11', status: 'AVAILABLE', assigned: false, purchaseCost: '10000', challenge: null, switchCount: 0, nextSwitchCost: null, canSwitch: false, completedAt: null }
const activeChallenge: DailyChallengeDto = { ...availableChallenge, status: 'ACTIVE', assigned: true, challenge: { externalKey: 'daily_pulls_5', type: 'pulls', displayName: 'Vœux du jour', description: 'Effectuez 5 Invocations.', progressLabel: 'Invocations effectuées', progress: '0', target: '5', rewardPrimogems: '800' }, nextSwitchCost: '20000', canSwitch: true }
const shared: SharedProps = { wheelToday: { spun: false, businessDate: '2026-09-11', result: null }, onSpinWheel: vi.fn(), dailyRewardToday: { claimed: false, businessDate: '2026-09-11', rewards: { primogems: '800', moras: '50000', mainElementParticles: '500' } }, dailyChallenge: availableChallenge, elementKey: 'hydro', onClaimDailyReward: vi.fn(), onPurchaseDailyChallenge: vi.fn(), onSwitchDailyChallenge: vi.fn(), onNavigate: vi.fn() }
function mount(overrides: Partial<typeof shared> = {}, screen: ScreenId = 'activities-dailies') { const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root); const props = { ...shared, ...overrides }; act(() => root.render(<ActivitiesScreen screen={screen} {...props} />)); return { container, props } }
function activity(container: HTMLElement, title: string) { return container.querySelector<HTMLElement>(`[data-daily-activity="${title}"]`)! }

describe('Activities shells', () => {
  it('keeps daily tabs outside the framed scroll body for overview, Wheel and Challenge', () => { const { container } = mount(); const frame = container.querySelector('.dailies-frame')!; expect(frame.querySelector('.scrollable-screen-panel-controls .activity-inner-tabs')).not.toBeNull(); expect(frame.querySelector('.scrollable-screen-panel-body .dailies-overview')).not.toBeNull(); act(() => Array.from(frame.querySelectorAll('button')).find((button) => button.textContent === 'Roue')!.click()); expect(frame.querySelector('.scrollable-screen-panel-body .wheel-card')).not.toBeNull(); act(() => Array.from(frame.querySelectorAll('button')).find((button) => button.textContent === 'Défi')!.click()); expect(frame.querySelector('.scrollable-screen-panel-body .daily-challenge-card')).not.toBeNull() })
  it('lists the seven decided daily activities in order without fake progress', () => { const { container } = mount(); expect(Array.from(container.querySelectorAll<HTMLElement>('[data-daily-activity]'), (entry) => entry.dataset.dailyActivity)).toEqual(['Récompense quotidienne', 'Roue', 'Défi', 'Combat', 'Expédition', 'Amitié', 'Événement']); expect(container.textContent).toContain('Votre cadeau du jour est prêt'); expect(container.textContent).not.toContain('Mission quotidienne'); expect(container.textContent).not.toMatch(/\d+\s*\/\s*\d+/); expect(container.querySelector('.dailies-overview')).not.toBeNull() })
  it('shows the real available Wheel state and opens the Wheel subview from Accéder', () => { const { container } = mount(); const wheel = activity(container, 'Roue'); expect(wheel.textContent).toContain('Une tentative disponible aujourd’hui'); expect(wheel.textContent).not.toContain('À faire'); expect(wheel.querySelector('button')?.textContent).toBe('Accéder'); act(() => wheel.querySelector('button')!.click()); expect(container.textContent).toContain('Roue astrale'); expect(container.textContent).toContain('Votre tentative du jour est disponible') })
  it('shows the authoritative used Wheel state while keeping Accéder', () => { const { container } = mount({ wheelToday: { spun: true, businessDate: '2026-09-11', result: { resultType: 'moras', resourceKey: 'moras', amount: '50000' } } }); const wheel = activity(container, 'Roue'); expect(wheel.textContent).toContain('✅ Terminé'); expect(wheel.textContent).toContain('Roue utilisée aujourd’hui.'); expect(wheel.querySelector('button')?.textContent).toBe('Accéder') })
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
    await act(async () => { Array.from(second.container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find((button) => button.textContent === 'Confirmer')!.click(); await Promise.resolve() })
    expect(confirmed).toHaveBeenCalledOnce()
  })
  it('shows a completed challenge with its received reward and no switch or claim action', () => {
    const completed = { ...activeChallenge, status: 'COMPLETED' as const, canSwitch: false, nextSwitchCost: null, completedAt: '2026-09-11T12:00:00.000Z', challenge: { ...activeChallenge.challenge!, progress: '5' } }
    const { container } = mount({ dailyChallenge: completed })
    expect(activity(container, 'Défi').textContent).toContain('Terminé')
    act(() => activity(container, 'Défi').querySelector('button')!.click())
    expect(container.textContent).toContain('5 / 5 Invocations effectuées.')
    expect(container.textContent).toContain('800 Primos reçus.')
    expect(container.textContent).not.toContain('Changer de Défi')
    expect(container.textContent).not.toContain('Réclamer')
  })
  it.each([['Combat', 'activities-combat'], ['Expédition', 'characters-box'], ['Événement', 'activities-event']] as const)('routes %s to its existing owner', (title, destination) => { const onNavigate = vi.fn(); const { container } = mount({ onNavigate }); act(() => activity(container, title).querySelector('button')!.click()); expect(onNavigate).toHaveBeenCalledWith(destination) })
  it('keeps Amitié unavailable without inventing a Social route', () => { const onNavigate = vi.fn(); const { container } = mount({ onNavigate }); const friendship = activity(container, 'Amitié'); const button = friendship.querySelector<HTMLButtonElement>('button')!; expect(friendship.textContent).toContain('Bientôt disponible'); expect(button.disabled).toBe(true); expect(button.getAttribute('aria-label')).toContain('Social et Amis bientôt disponibles'); expect(onNavigate).not.toHaveBeenCalled() })
  it.each([['activities-missions', ['B', 'A', 'S', 'Z']], ['activities-combat', ['Entraînement', 'Boss']], ['activities-event', ['Jeux', 'Shop', 'Classement']]] as const)('exposes the reserved labels for %s without fake gameplay', (screen, labels) => { const { container } = mount({}, screen); labels.forEach((label) => expect(container.textContent).toContain(label)); expect(container.textContent).toContain('Bientôt disponible') })
})
