import type { WheelProbabilityDto } from '../api/types'
/** Test data only; production uses wheel/today. */
export const testWheelProbabilities: readonly WheelProbabilityDto[] = [
  { resultType: 'nothing', resourceKey: null, amount: null, probabilityPercent: 2 },
  ...['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].map(element => ({ resultType: 'particles' as const, resourceKey: `particles_${element}`, amount: '500', probabilityPercent: 10 })),
  { resultType: 'moras', resourceKey: 'moras', amount: '50000', probabilityPercent: 20 },
  { resultType: 'primogems', resourceKey: 'primogems', amount: '1600', probabilityPercent: 8 },
]
