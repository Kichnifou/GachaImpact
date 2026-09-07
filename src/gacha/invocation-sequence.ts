import type { GachaPullDto } from '../api/types'
import { bestPullRarity, type PullDisplayRarity } from './pull-result-presentation'

type SequenceData = Readonly<{
  count: 1 | 10
  idempotencyKey: string
}>

export type InvocationSequenceState =
  | Readonly<{ phase: 'idle' }>
  | (SequenceData & Readonly<{ phase: 'submitting' }>)
  | (SequenceData & Readonly<{ phase: 'intro'; pull: GachaPullDto; bestRarity: PullDisplayRarity }>)
  | (SequenceData & Readonly<{ phase: 'reveal'; pull: GachaPullDto; bestRarity: PullDisplayRarity; resultIndex: number }>)
  | (SequenceData & Readonly<{ phase: 'summary'; pull: GachaPullDto; bestRarity: PullDisplayRarity }>)

export type InvocationSequenceEvent =
  | Readonly<{ type: 'submit'; count: 1 | 10; idempotencyKey: string }>
  | Readonly<{ type: 'resolved'; pull: GachaPullDto }>
  | Readonly<{ type: 'failed' }>
  | Readonly<{ type: 'advance' }>
  | Readonly<{ type: 'skip' }>
  | Readonly<{ type: 'close' }>

export const idleInvocationSequence: InvocationSequenceState = { phase: 'idle' }
export const revealTransitionDurationMs = 500

export function revealResultKey(operationId: string, resultIndex: number): string {
  return `${operationId}-${resultIndex}`
}

export function shouldAdvanceSequenceWithKeyboard(key: string, fromControl: boolean): boolean {
  return !fromControl && (key === 'Enter' || key === ' ')
}

export function invocationSequenceReducer(
  state: InvocationSequenceState,
  event: InvocationSequenceEvent,
): InvocationSequenceState {
  if (event.type === 'submit') {
    return state.phase === 'idle'
      ? { phase: 'submitting', count: event.count, idempotencyKey: event.idempotencyKey }
      : state
  }
  if (event.type === 'resolved') {
    if (state.phase !== 'submitting') return state
    return {
      ...state,
      phase: 'intro',
      pull: event.pull,
      bestRarity: bestPullRarity(event.pull.results),
    }
  }
  if (event.type === 'failed') {
    return state.phase === 'submitting' ? idleInvocationSequence : state
  }
  if (event.type === 'close') {
    return state.phase === 'reveal' || state.phase === 'summary'
      ? idleInvocationSequence
      : state
  }
  if (event.type === 'skip') {
    if (state.phase !== 'intro' && state.phase !== 'reveal') return state
    if (state.count === 1) return { ...state, phase: 'reveal', resultIndex: 0 }
    return { ...state, phase: 'summary' }
  }
  if (event.type !== 'advance') return state
  if (state.phase === 'intro') return { ...state, phase: 'reveal', resultIndex: 0 }
  if (state.phase !== 'reveal' || state.count === 1) return state
  if (state.resultIndex + 1 < state.pull.results.length) {
    return { ...state, resultIndex: state.resultIndex + 1 }
  }
  return { ...state, phase: 'summary' }
}

export function acquirePullLock(lock: { current: boolean }): boolean {
  if (lock.current) return false
  lock.current = true
  return true
}

export function acquireRevealLock(lock: { current: boolean }): boolean {
  if (lock.current) return false
  lock.current = true
  return true
}

export function releaseRevealLock(lock: { current: boolean }): void {
  lock.current = false
}
