import type { WheelRewardDto, WheelSpinDto, WheelTodayDto } from '../api/types'
import { currencyAssetPaths, getElementAssetPath } from '../utils/gameAssets'

export const wheelSegments = [
  { key: 'nothing', label: 'Rien', assetPath: null, fallback: '—' },
  { key: 'particles_pyro', label: 'Pyro', assetPath: getElementAssetPath('Pyro'), fallback: '✦' },
  { key: 'particles_hydro', label: 'Hydro', assetPath: getElementAssetPath('Hydro'), fallback: '✦' },
  { key: 'particles_cryo', label: 'Cryo', assetPath: getElementAssetPath('Cryo'), fallback: '✦' },
  { key: 'particles_electro', label: 'Électro', assetPath: getElementAssetPath('Électro'), fallback: '✦' },
  { key: 'particles_anemo', label: 'Anémo', assetPath: getElementAssetPath('Anémo'), fallback: '✦' },
  { key: 'particles_geo', label: 'Géo', assetPath: getElementAssetPath('Géo'), fallback: '✦' },
  { key: 'particles_dendro', label: 'Dendro', assetPath: getElementAssetPath('Dendro'), fallback: '✦' },
  { key: 'moras', label: 'Moras', assetPath: currencyAssetPaths.mora, fallback: '●' },
  { key: 'primogems', label: 'Primos', assetPath: currencyAssetPaths.primogem, fallback: '✦' },
] as const

const SEGMENT_ANGLE = 360 / wheelSegments.length

export function getWheelSegmentIndex(result: WheelRewardDto): number {
  const key = result.resultType === 'nothing' ? 'nothing' : result.resourceKey
  const index = wheelSegments.findIndex((segment) => segment.key === key)
  return index >= 0 ? index : 0
}

export function getWheelRestingRotation(result: WheelRewardDto): number {
  const segmentCenter = getWheelSegmentIndex(result) * SEGMENT_ANGLE + SEGMENT_ANGLE / 2
  return (360 - segmentCenter) % 360
}

export function getWheelAnimatedRotation(
  currentRotation: number,
  result: WheelRewardDto,
  turns = 5,
): number {
  const normalizedCurrent = ((currentRotation % 360) + 360) % 360
  const target = getWheelRestingRotation(result)
  const delta = (target - normalizedCurrent + 360) % 360
  return currentRotation + turns * 360 + delta
}

export function wheelTodayFromSpin(result: WheelSpinDto): WheelTodayDto {
  return {
    spun: true,
    businessDate: result.businessDate,
    result: {
      resultType: result.resultType,
      resourceKey: result.resourceKey,
      amount: result.amount,
    },
  }
}

export type WheelUiState = Readonly<{
  phase: 'idle' | 'requesting' | 'animating'
  displayedResult: WheelRewardDto | null
  pendingResult: WheelRewardDto | null
}>

export type WheelUiEvent =
  | Readonly<{ type: 'sync'; today: WheelTodayDto }>
  | Readonly<{ type: 'request' }>
  | Readonly<{ type: 'serverResult'; result: WheelRewardDto; animate: boolean }>
  | Readonly<{ type: 'animationFinished' }>
  | Readonly<{ type: 'failure' }>

export function createWheelUiState(today: WheelTodayDto): WheelUiState {
  return { phase: 'idle', displayedResult: today.result, pendingResult: null }
}

export function canRequestWheelSpin(today: WheelTodayDto, state: WheelUiState): boolean {
  return !today.spun && state.phase === 'idle'
}

export function reduceWheelUi(state: WheelUiState, event: WheelUiEvent): WheelUiState {
  switch (event.type) {
    case 'sync':
      return state.phase === 'idle'
        ? { ...state, displayedResult: event.today.result, pendingResult: null }
        : state
    case 'request':
      return { ...state, phase: 'requesting', pendingResult: null }
    case 'serverResult':
      return event.animate
        ? { phase: 'animating', displayedResult: null, pendingResult: event.result }
        : { phase: 'idle', displayedResult: event.result, pendingResult: null }
    case 'animationFinished':
      return {
        phase: 'idle',
        displayedResult: state.pendingResult ?? state.displayedResult,
        pendingResult: null,
      }
    case 'failure':
      return { ...state, phase: 'idle', pendingResult: null }
  }
}
