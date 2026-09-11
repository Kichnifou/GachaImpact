// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DailyRewardClaimDto, DailyRewardTodayDto, ElementKey, WheelSpinDto, WheelTodayDto } from '../api/types'
import type { ScreenId } from '../types'
import ActivitiesScreen from './ActivitiesScreen'

const roots: Root[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren() })

type SharedProps = { wheelToday: WheelTodayDto; onSpinWheel: () => Promise<WheelSpinDto>; dailyRewardToday: DailyRewardTodayDto; elementKey: ElementKey; onClaimDailyReward: () => Promise<DailyRewardClaimDto>; onNavigate: (screen: ScreenId) => void }
const shared: SharedProps = { wheelToday: { spun: false, businessDate: '2026-09-11', result: null }, onSpinWheel: vi.fn(), dailyRewardToday: { claimed: false, businessDate: '2026-09-11', rewards: { primogems: '800', moras: '50000', mainElementParticles: '500' } }, elementKey: 'hydro', onClaimDailyReward: vi.fn(), onNavigate: vi.fn() }
function mount(overrides: Partial<typeof shared> = {}, screen: ScreenId = 'activities-dailies') { const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root); const props = { ...shared, ...overrides }; act(() => root.render(<ActivitiesScreen screen={screen} {...props} />)); return { container, props } }
function activity(container: HTMLElement, title: string) { return container.querySelector<HTMLElement>(`[data-daily-activity="${title}"]`)! }

describe('Activities shells', () => {
  it('lists the seven decided daily activities in order without fake progress', () => { const { container } = mount(); expect(Array.from(container.querySelectorAll<HTMLElement>('[data-daily-activity]'), (entry) => entry.dataset.dailyActivity)).toEqual(['Récompense quotidienne', 'Roue', 'Défi', 'Combat', 'Expédition', 'Amitié', 'Événement']); expect(container.textContent).toContain('Votre cadeau du jour est prêt'); expect(container.textContent).not.toContain('Mission quotidienne'); expect(container.textContent).not.toMatch(/\d+\s*\/\s*\d+/); expect(container.querySelector('.dailies-overview')).not.toBeNull() })
  it('shows the real available Wheel state and opens the Wheel subview from Accéder', () => { const { container } = mount(); const wheel = activity(container, 'Roue'); expect(wheel.textContent).toContain('Une tentative disponible aujourd’hui'); expect(wheel.textContent).not.toContain('À faire'); expect(wheel.querySelector('button')?.textContent).toBe('Accéder'); act(() => wheel.querySelector('button')!.click()); expect(container.textContent).toContain('Roue astrale'); expect(container.textContent).toContain('Votre tentative du jour est disponible') })
  it('shows the authoritative used Wheel state while keeping Accéder', () => { const { container } = mount({ wheelToday: { spun: true, businessDate: '2026-09-11', result: { resultType: 'moras', resourceKey: 'moras', amount: '50000' } } }); const wheel = activity(container, 'Roue'); expect(wheel.textContent).toContain('Déjà utilisée aujourd’hui'); expect(wheel.querySelector('button')?.textContent).toBe('Accéder') })
  it('keeps Défi honest and opens its unavailable subview', () => { const { container } = mount(); const challenge = activity(container, 'Défi'); expect(challenge.textContent).toContain('Bientôt disponible'); act(() => challenge.querySelector('button')!.click()); expect(container.textContent).toContain('Défi indisponible'); expect(container.textContent).toContain('Aucune progression n’est simulée') })
  it.each([['Combat', 'activities-combat'], ['Expédition', 'characters-box'], ['Événement', 'activities-event']] as const)('routes %s to its existing owner', (title, destination) => { const onNavigate = vi.fn(); const { container } = mount({ onNavigate }); act(() => activity(container, title).querySelector('button')!.click()); expect(onNavigate).toHaveBeenCalledWith(destination) })
  it('keeps Amitié unavailable without inventing a Social route', () => { const onNavigate = vi.fn(); const { container } = mount({ onNavigate }); const friendship = activity(container, 'Amitié'); const button = friendship.querySelector<HTMLButtonElement>('button')!; expect(friendship.textContent).toContain('Bientôt disponible'); expect(button.disabled).toBe(true); expect(button.getAttribute('aria-label')).toContain('Social et Amis bientôt disponibles'); expect(onNavigate).not.toHaveBeenCalled() })
  it.each([['activities-missions', ['B', 'A', 'S', 'Z']], ['activities-combat', ['Entraînement', 'Boss']], ['activities-event', ['Jeux', 'Shop', 'Classement']]] as const)('exposes the reserved labels for %s without fake gameplay', (screen, labels) => { const { container } = mount({}, screen); labels.forEach((label) => expect(container.textContent).toContain(label)); expect(container.textContent).toContain('Bientôt disponible') })
})
