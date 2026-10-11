import type { WheelProbabilityDto, WheelRewardDto, WheelSpinDto, WheelTodayDto } from '../api/types'
import { currencyAssetPaths, getElementAssetPath } from '../utils/gameAssets'

const elements: Record<string, { label: string; color: string }> = {
  pyro: { label: 'Pyro', color: '#963e42' }, hydro: { label: 'Hydro', color: '#245b96' },
  cryo: { label: 'Cryo', color: '#367d8e' }, electro: { label: 'Électro', color: '#61418f' },
  anemo: { label: 'Anémo', color: '#277667' }, geo: { label: 'Géo', color: '#8a6b30' },
  dendro: { label: 'Dendro', color: '#4d7431' },
}

export type WheelSegment = WheelProbabilityDto & Readonly<{
  key: string; label: string; color: string; assetPath: string | null
  startAngle: number; endAngle: number; centerAngle: number
}>

export function createWheelSegments(probabilities: readonly WheelProbabilityDto[] | undefined): WheelSegment[] {
  if (!probabilities?.length || probabilities.some(entry => !Number.isFinite(entry.probabilityPercent) || entry.probabilityPercent <= 0)
    || Math.abs(probabilities.reduce((sum, entry) => sum + entry.probabilityPercent, 0) - 100) > .000001) return []
  if (probabilities.some(entry => entry.resultType === 'particles'
    ? !entry.resourceKey?.startsWith('particles_') || !elements[entry.resourceKey.replace('particles_', '')]
    : entry.resultType === 'nothing' ? entry.resourceKey !== null || entry.amount !== null : entry.resourceKey !== entry.resultType)) return []
  let angle = 0
  const segments = probabilities.map(entry => {
    const key = entry.resultType === 'nothing' ? 'nothing' : entry.resourceKey ?? ''
    const element = entry.resultType === 'particles' ? elements[key.replace('particles_', '')] : undefined
    const startAngle = angle
    angle += entry.probabilityPercent * 3.6
    return { ...entry, key, startAngle, endAngle: angle, centerAngle: (startAngle + angle) / 2,
      label: element?.label ?? (key === 'nothing' ? 'Aucun gain' : key === 'moras' ? 'Moras' : 'Primogemmes'),
      color: element?.color ?? (key === 'nothing' ? '#263449' : key === 'moras' ? '#967331' : '#406fa8'),
      assetPath: element ? getElementAssetPath(element.label) : key === 'moras' ? currencyAssetPaths.mora : key === 'primogems' ? currencyAssetPaths.primogem : null }
  })
  return new Set(segments.map(segment => segment.key)).size === segments.length ? segments : []
}

export function getWheelSegmentIndex(result: WheelRewardDto, segments: readonly WheelSegment[]): number {
  return segments.findIndex(segment => segment.resultType === result.resultType && segment.resourceKey === result.resourceKey && segment.amount === result.amount)
}

export function getWheelRestingRotation(result: WheelRewardDto, segments: readonly WheelSegment[]): number {
  const segment = segments[getWheelSegmentIndex(result, segments)]
  return segment ? (360 - segment.centerAngle) % 360 : 0
}

export function getWheelAnimatedRotation(currentRotation: number, result: WheelRewardDto, segments: readonly WheelSegment[], turns = 5): number {
  const normalizedCurrent = ((currentRotation % 360) + 360) % 360
  const delta = (getWheelRestingRotation(result, segments) - normalizedCurrent + 360) % 360
  return currentRotation + turns * 360 + delta
}

export function wheelTodayFromSpin(result: WheelSpinDto, probabilities?: readonly WheelProbabilityDto[]): WheelTodayDto {
  return { spun: true, businessDate: result.businessDate, result: { resultType: result.resultType, resourceKey: result.resourceKey, amount: result.amount }, ...(probabilities ? { probabilities } : {}) }
}

export type WheelUiState = Readonly<{ phase: 'idle' | 'requesting' | 'animating'; displayedResult: WheelRewardDto | null; pendingResult: WheelRewardDto | null }>
export type WheelUiEvent =
  | Readonly<{ type: 'sync'; today: WheelTodayDto }>
  | Readonly<{ type: 'request' }>
  | Readonly<{ type: 'serverResult'; result: WheelRewardDto; animate: boolean }>
  | Readonly<{ type: 'animationFinished' }>
  | Readonly<{ type: 'failure' }>
export function createWheelUiState(today: WheelTodayDto): WheelUiState {
  return { phase: 'idle', displayedResult: today.result, pendingResult: null }
}
export function canRequestWheelSpin(today: WheelTodayDto, state: WheelUiState): boolean { return !today.spun && state.phase === 'idle' }
export function reduceWheelUi(state: WheelUiState, event: WheelUiEvent): WheelUiState {
  switch (event.type) {
    case 'sync': return state.phase === 'idle' ? { ...state, displayedResult: event.today.result, pendingResult: null } : state
    case 'request': return { ...state, phase: 'requesting', pendingResult: null }
    case 'serverResult': return event.animate ? { phase: 'animating', displayedResult: null, pendingResult: event.result } : { phase: 'idle', displayedResult: event.result, pendingResult: null }
    case 'animationFinished': return { phase: 'idle', displayedResult: state.pendingResult ?? state.displayedResult, pendingResult: null }
    case 'failure': return { ...state, phase: 'idle', pendingResult: null }
  }
}

export function wheelPoint(angle: number, radius: number) {
  const radians = (angle - 90) * Math.PI / 180
  return { x: 200 + Math.cos(radians) * radius, y: 200 + Math.sin(radians) * radius }
}
export function wheelSectorPath(segment: WheelSegment): string {
  const start = wheelPoint(segment.startAngle, 178), end = wheelPoint(segment.endAngle, 178)
  return `M 200 200 L ${start.x} ${start.y} A 178 178 0 ${segment.endAngle - segment.startAngle > 180 ? 1 : 0} 1 ${end.x} ${end.y} Z`
}
