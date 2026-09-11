import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import ActivitiesScreen from './ActivitiesScreen'

const shared = { wheelToday: { spun: false, businessDate: '2026-09-11', result: null } as const, onSpinWheel: vi.fn(), dailyRewardToday: { claimed: false, businessDate: '2026-09-11', rewards: { primogems: '800', moras: '50000', mainElementParticles: '500' } } as const, elementKey: 'hydro' as const, onClaimDailyReward: vi.fn() }
describe('Activities shells', () => {
  it('uses real Daily/Wheel data and presents Défi honestly', () => { const html = renderToStaticMarkup(<ActivitiesScreen screen="activities-dailies" {...shared} />); expect(html).toContain('Aperçu'); expect(html).toContain('Roue'); expect(html).toContain('Défi'); expect(html).toContain('Votre cadeau du jour est prêt'); expect(html).not.toMatch(/\d+\s*\/\s*\d+/) })
  it.each([['activities-missions', ['B', 'A', 'S', 'Z']], ['activities-combat', ['Entraînement', 'Boss']], ['activities-event', ['Jeux', 'Shop', 'Classement']]] as const)('exposes the reserved labels for %s without fake gameplay', (screen, labels) => { const html = renderToStaticMarkup(<ActivitiesScreen screen={screen} {...shared} />); labels.forEach((label) => expect(html).toContain(label)); expect(html).toContain('Bientôt disponible') })
})
