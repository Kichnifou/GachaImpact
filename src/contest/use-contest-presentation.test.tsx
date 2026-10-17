// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ContestSnapshotDto, ContestLatestScoreChangeDto } from '../api/types'
import { contestActionAvailability, useContestPresentation } from './use-contest-presentation'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root
let container: HTMLDivElement
beforeEach(() => { vi.useFakeTimers(); container = document.createElement('div'); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }) })
const event = (id: number, slot = 1): ContestLatestScoreChangeDto => ({ eventId: `event-${id}`, slot, points: id, kind: 'BOT_TURN_PLAYED', createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, id)).toISOString() })
const snapshot = (events: readonly ContestLatestScoreChangeDto[] = [], changes: Partial<ContestSnapshotDto> = {}) => ({ id: 'contest', status: 'RUNNING', phase: 'TURNS', turnDeadlineAt: '2099-01-01T00:00:00Z', recentScoreChanges: events, ...changes }) as ContestSnapshotDto
function View({ value }: { value: ContestSnapshotDto | null }) {
  const { presentedScores, feedback, awaitingProjection } = useContestPresentation(value, Date.now())
  return <output data-scores={JSON.stringify(presentedScores)} data-waiting={awaitingProjection} data-id={feedback?.eventId} data-duration={feedback?.durationMs}>{feedback?.points}</output>
}
const render = (value: ContestSnapshotDto | null) => act(() => root.render(<View value={value} />))
const id = () => container.querySelector('output')?.dataset.id
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

it('presents three prior bots chronologically, exactly once, before draining', async () => {
  render(snapshot()); render(snapshot([event(3, 3), event(1, 1), event(2, 2)]))
  expect(id()).toBe('event-1'); await advance(1200)
  expect(id()).toBe('event-2'); await advance(1200)
  expect(id()).toBe('event-3'); await advance(1200)
  expect(id()).toBeUndefined()
  render(snapshot([event(1), event(2), event(3)])); expect(id()).toBeUndefined()
})
it('does not restart the active event when a second gain for the same participant arrives', async () => {
  render(snapshot()); render(snapshot([event(1)])); await advance(900)
  render(snapshot([event(1), event(2)])); expect(id()).toBe('event-1')
  await advance(300); expect(id()).toBe('event-2')
  await advance(1200); expect(id()).toBeUndefined()
})
it('retains seen IDs even if a later projection temporarily omits them', async () => {
  render(snapshot()); render(snapshot([event(1)])); await advance(1200)
  render(snapshot([])); render(snapshot([event(1)])); expect(id()).toBeUndefined()
})
it('drains an eight-event backlog within 3.6 seconds', async () => {
  render(snapshot()); render(snapshot(Array.from({ length: 8 }, (_, i) => event(i + 1))))
  expect(Number(container.querySelector('output')?.dataset.duration)).toBeLessThan(1200)
  for (let index = 0; index < 8; index += 1) await advance(450)
  expect(id()).toBeUndefined()
})
it('does not replay initial historical events or events on a different contest', () => {
  render(snapshot([event(1)])); expect(id()).toBeUndefined()
  render(snapshot([event(1), event(2)])); expect(id()).toBe('event-2')
  render(snapshot([event(3)], { id: 'another' })); expect(id()).toBeUndefined()
})
it('presents the first bot actions when an already open lobby starts', () => {
  render(snapshot([], { status: 'LOBBY', phase: 'LOBBY' }))
  render(snapshot([event(1), event(2)]))
  expect(id()).toBe('event-1')
})
it('preserves pending events over a new round but terminates them on victory', () => {
  render(snapshot()); render(snapshot([event(1)])); expect(id()).toBe('event-1')
  render(snapshot([event(1), event(2)], { currentRound: 2 })); expect(id()).toBe('event-1')
  render(null); expect(id()).toBeUndefined()
})
it('discards visual backlog near the authoritative deadline without extending it', () => {
  render(snapshot()); render(snapshot([event(1)])); expect(id()).toBe('event-1')
  render(snapshot([event(1), event(2)], { turnDeadlineAt: new Date(Date.now() + 4000).toISOString() }))
  expect(id()).toBeUndefined()
})
it('skips floating gains for reduced motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  render(snapshot()); render(snapshot([event(1), event(2)])); expect(id()).toBeUndefined()
})
it('drops a hidden backlog and baselines only the first projection on return', () => {
  render(snapshot()); render(snapshot([event(1)]))
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  act(() => document.dispatchEvent(new Event('visibilitychange'))); expect(id()).toBeUndefined()
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(container.querySelector('output')?.dataset.waiting).toBe('true')
  render(snapshot([event(1), event(2)])); expect(id()).toBeUndefined()
  expect(container.querySelector('output')?.dataset.waiting).toBe('false')
  render(snapshot([event(2), event(3)])); expect(id()).toBe('event-3')
})
it('shares permission, phase, transition and exact deadline gates for play and support', () => {
  const now = Date.now(), permissions = { canPlay: true, canSupport: true }
  expect(contestActionAvailability(snapshot(), permissions, false, now)).toEqual({ current: true, canPlay: true, canSupport: false })
  expect(contestActionAvailability(snapshot(), permissions, true, now).canPlay).toBe(false)
  expect(contestActionAvailability(snapshot([], { turnDeadlineAt: new Date(now).toISOString() }), permissions, false, now).canPlay).toBe(false)
  expect(contestActionAvailability(snapshot([], { phase: 'SUPPORT', supportDeadlineAt: '2099-01-01T00:00:00Z' }), permissions, false, now)).toEqual({ current: true, canPlay: false, canSupport: true })
  expect(contestActionAvailability(snapshot(), { canPlay: false, canSupport: false }, false, now).canPlay).toBe(false)
})

const scored = (scores: number[], events: readonly ContestLatestScoreChangeDto[] = []) => snapshot(events, { participants: scores.map((score, i) => ({ slot: i + 1, score })) as unknown as ContestSnapshotDto['participants'] })
const scores = () => JSON.parse(container.querySelector('output')!.dataset.scores!)
it('holds every future bot score until its own impact, then converges exactly once', async () => {
  render(scored([10,20,30])); render(scored([11,22,33], [event(1,1),event(2,2),event(3,3)]))
  expect(scores()).toEqual({1:10,2:20,3:30})
  await advance(215); expect(scores()).toEqual({1:10,2:20,3:30})
  await advance(1); expect(scores()).toEqual({1:11,2:20,3:30})
  await advance(984); expect(scores()).toEqual({1:11,2:20,3:30}); await advance(216); expect(scores()).toEqual({1:11,2:22,3:30})
  await advance(984); expect(scores()).toEqual({1:11,2:22,3:30}); await advance(216); expect(scores()).toEqual({1:11,2:22,3:33})
  await advance(984); render(scored([11,22,33],[event(1,1),event(2,2),event(3,3)]))
  expect(id()).toBeUndefined(); expect(scores()).toEqual({1:11,2:22,3:33})
})
it('keeps an impacted gain when another arrives on the same participant', async () => {
  render(scored([5])); render(scored([6],[event(1)])); await advance(216)
  render(scored([8],[event(1),event(2)])); expect(scores()).toEqual({1:6})
  await advance(984); await advance(216); expect(scores()).toEqual({1:8})
})
it('converges to the authoritative score instead of inventing a missing delta', () => {
  render(scored([5])); render(scored([6],[event(1)]));
  render(scored([40],[event(1),event(2)])); expect(scores()).toEqual({1:40}); expect(id()).toBeUndefined()
})
it('converges immediately on hidden tabs and ignores history after returning', () => {
  render(scored([5])); render(scored([6],[event(1)]));
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'}); act(()=>document.dispatchEvent(new Event('visibilitychange')))
  expect(scores()).toEqual({1:6}); expect(id()).toBeUndefined()
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'}); act(()=>document.dispatchEvent(new Event('visibilitychange')))
  render(scored([8],[event(1),event(2)])); expect(scores()).toEqual({1:8}); expect(id()).toBeUndefined()
})
