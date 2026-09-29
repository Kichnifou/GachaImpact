// @vitest-environment happy-dom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FavorDto, FavorPresenceDto } from '../api/types'
import { createFavorPresence, type FavorPresenceState } from './favor-presence'
import { useFavorPresence } from './use-favor-presence'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const favor: FavorDto = { businessDate: '2026-09-29', active: true, daysRemaining: 30, maxDays: 180, dailyPrimogems: '800', claimedToday: true, claimStatus: 'CLAIMED' }
const response = (status: FavorPresenceDto['status'] = 'CLAIMED', creditedPrimogems = status === 'CLAIMED' ? '800' : '0'): FavorPresenceDto => ({ status, creditedPrimogems, businessDate: favor.businessDate, favor })
let root: Root | undefined
afterEach(() => { if (root) act(() => root!.unmount()); root = undefined; document.body.replaceChildren(); vi.restoreAllMocks() })

describe('authoritative Favor presence', () => {
  it.each(['ALREADY_CLAIMED', 'INACTIVE'] as const)('updates the projection without gain for %s', async status => {
    const refresh = vi.fn(), coordinator = createFavorPresence(async () => response(status), refresh)
    let value: FavorPresenceState | undefined; coordinator.subscribe(state => { value = state })
    await coordinator.wake(); expect(value?.favor).toEqual(favor); expect(value?.feedbacks).toEqual([]); expect(refresh).not.toHaveBeenCalled()
  })
  it('requires both CLAIMED and the exact 800 credit, and retains exactly one feedback per paid date', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined), record = vi.fn().mockResolvedValue(response()), coordinator = createFavorPresence(record, refresh)
    let value: FavorPresenceState | undefined; coordinator.subscribe(state => { value = state })
    await coordinator.wake(); await coordinator.wake(); expect(value?.feedbacks).toHaveLength(1); expect(refresh).toHaveBeenCalledOnce()
    coordinator.finish(favor.businessDate); expect(value?.feedbacks).toEqual([])
    await coordinator.wake(); expect(value?.feedbacks).toEqual([])
    record.mockResolvedValue({ ...response('CLAIMED', '0'), businessDate: '2026-09-30' }); await coordinator.wake(); expect(value?.feedbacks).toEqual([])
  })
  it('coalesces concurrent wake calls and errors do not infer payment', async () => {
    let reject!: (reason: Error) => void
    const record = vi.fn(() => new Promise<FavorPresenceDto>((_resolve, fail) => { reject = fail })), refresh = vi.fn()
    const coordinator = createFavorPresence(record, refresh); let value: FavorPresenceState | undefined; coordinator.subscribe(state => { value = state })
    const first = coordinator.wake(), second = coordinator.wake(); expect(second).toBe(first)
    await Promise.resolve(); reject(new Error('ambiguous network loss')); await first
    expect(record).toHaveBeenCalledOnce(); expect(value).toMatchObject({ favor: null, error: true, feedbacks: [] }); expect(refresh).not.toHaveBeenCalled()
  })
  it('does not refresh an unmounted account when a late CLAIMED response arrives', async () => {
    const refresh = vi.fn(), coordinator = createFavorPresence(async () => response(), refresh)
    const unsubscribe = coordinator.subscribe(() => undefined); const pending = coordinator.wake(); unsubscribe(); await pending
    expect(refresh).not.toHaveBeenCalled()
  })
  it('starts once under StrictMode; real hidden/visible and pagehide/pageshow transitions retry, navigation does not', async () => {
    const record = vi.fn().mockResolvedValue(response('ALREADY_CLAIMED')), refresh = vi.fn().mockResolvedValue(undefined)
    let hidden = false; vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => hidden ? 'hidden' : 'visible')
    function Harness({ screen }: { screen: string }) { const state = useFavorPresence('player', record, refresh); return <div>{screen}{state.favor?.businessDate}</div> }
    const container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(async () => root!.render(<StrictMode><Harness screen="Quotidiennes" /></StrictMode>)); expect(record).toHaveBeenCalledOnce()
    await act(async () => root!.render(<StrictMode><Harness screen="Profil" /></StrictMode>)); expect(record).toHaveBeenCalledOnce()
    await act(async () => { hidden = true; document.dispatchEvent(new Event('visibilitychange')); hidden = false; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pageshow')); document.dispatchEvent(new Event('visibilitychange')) })
    expect(record).toHaveBeenCalledTimes(2)
    await act(async () => { window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new Event('pageshow')); document.dispatchEvent(new Event('visibilitychange')) })
    expect(record).toHaveBeenCalledTimes(3)
  })
  it('does not start while hidden, then records the first visible presence', async () => {
    let hidden = true; vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => hidden ? 'hidden' : 'visible')
    const record = vi.fn().mockResolvedValue(response('INACTIVE')), refresh = vi.fn()
    function Harness() { useFavorPresence('player', record, refresh); return null }
    root = createRoot(document.createElement('div')); await act(async () => root!.render(<Harness />)); expect(record).not.toHaveBeenCalled()
    await act(async () => { hidden = false; document.dispatchEvent(new Event('visibilitychange')) }); expect(record).toHaveBeenCalledOnce()
  })
})
