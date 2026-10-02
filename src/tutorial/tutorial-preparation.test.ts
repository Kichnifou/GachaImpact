import { expect, it, vi } from 'vitest'
import type { TutorialPreferenceDto } from '../api/types'
import { tutorialSteps } from './tutorial-catalog'
import { TutorialController } from './tutorial-controller'

const progress = (stepId: typeof tutorialSteps[number]['id']): TutorialPreferenceDto => ({ version: 1, status: 'IN_PROGRESS', stepId })
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
it('confirms every boundary only after its presentation is prepared, including community extension', async () => {
  const api = { get: vi.fn(async () => progress('community')), put: vi.fn(async (value: TutorialPreferenceDto) => value) }
  const gate = deferred<{ anchor: string }>()
  const prepare = vi.fn().mockResolvedValueOnce({ anchor: 'community' }).mockReturnValueOnce(gate.promise)
  const controller = new TutorialController(api, prepare)
  await controller.launch(); const next = controller.next(); await Promise.resolve()
  expect(controller.getSnapshot()).toMatchObject({ pending: true, phase: 'preparing', stepId: null, confirmedStepId: 'menu-entry' })
  controller.next(); controller.previous(); controller.finish(); expect(api.put).toHaveBeenCalledOnce()
  gate.resolve({ anchor: 'menu-entry' }); await next
  expect(controller.getSnapshot()).toMatchObject({ pending: false, stepId: 'menu-entry', anchor: 'menu-entry' })
})
it('retries preparation without repeating a successful PUT, while a failed PUT never prepares', async () => {
  const api = { get: vi.fn(async () => progress('profile')), put: vi.fn(async (value: TutorialPreferenceDto) => value) }
  const prepare = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(Error('mount')).mockResolvedValue({ anchor: 'resources' })
  const controller = new TutorialController(api, prepare); await controller.launch(); await controller.next()
  expect(controller.getSnapshot()).toMatchObject({ stepId: null, confirmedStepId: 'resources', retryAction: 'next' })
  await controller.next(); expect(api.put).toHaveBeenCalledOnce(); expect(controller.getSnapshot().stepId).toBe('resources')
  api.put.mockRejectedValueOnce(Error('offline')); const prepared = prepare.mock.calls.length; await controller.next()
  expect(prepare).toHaveBeenCalledTimes(prepared); expect(controller.getSnapshot().stepId).toBe('resources')
})
it('Pause cancels a DOM wait immediately and ignores the late preparation response', async () => {
  const gate = deferred<{ anchor: string }>(); let signal!: AbortSignal
  const api = { get: async () => progress('box-expedition'), put: vi.fn(async (value: TutorialPreferenceDto) => value) }
  const controller = new TutorialController(api, async (_, abort) => { signal = abort; return gate.promise })
  const request = controller.launch(); await Promise.resolve(); controller.pause()
  expect(signal.aborted).toBe(true); expect(controller.getSnapshot()).toMatchObject({ active: false, pending: false })
  gate.resolve({ anchor: 'old' }); await request; expect(controller.getSnapshot().anchor).not.toBe('old'); expect(api.put).not.toHaveBeenCalled()
})
it('a Pause deferred during PUT closes as soon as it is confirmed, without starting a DOM wait', async () => {
  const gate = deferred<TutorialPreferenceDto>(); const prepare = vi.fn(async () => ({}))
  const api = { get: async () => progress('profile'), put: vi.fn(() => gate.promise) }
  const controller = new TutorialController(api, prepare); await controller.launch(); const request = controller.next(); controller.pause()
  gate.resolve(progress('resources')); await request
  expect(controller.getSnapshot()).toMatchObject({ active: false, stepId: 'resources' }); expect(prepare).toHaveBeenCalledOnce()
})
it('ignores a late GET across dispose/reactivation, retaining no stale presentation', async () => {
  const get = deferred<TutorialPreferenceDto>(); const prepare = vi.fn(async () => ({})); const put = vi.fn(async (value: TutorialPreferenceDto) => value)
  const controller = new TutorialController({ get: () => get.promise, put }, prepare)
  const request = controller.launch(); controller.dispose(); controller.activate(); get.resolve(progress('dm-thread')); await request
  expect(prepare).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled()
})
it.each(['box-expedition', 'history-event', 'dm-history', 'profile-titles', 'configuration-account'] as const)('resumes %s without rewriting or storing its view/panel', async stepId => {
  const api = { get: async () => progress(stepId), put: vi.fn(async (value: TutorialPreferenceDto) => value) }; const prepare = vi.fn(async () => ({}))
  const controller = new TutorialController(api, prepare); await controller.launch()
  expect(prepare).toHaveBeenCalledWith(stepId, expect.any(AbortSignal)); expect(api.put).not.toHaveBeenCalled()
})
it('ignores a confirmed late PUT after the Player controller is disposed', async () => {
  const write = deferred<TutorialPreferenceDto>(); const prepare = vi.fn(async () => ({}))
  const controller = new TutorialController({ get: async () => progress('profile'), put: () => write.promise }, prepare)
  await controller.launch(); const request = controller.next(); controller.dispose(); controller.activate()
  write.resolve(progress('resources')); await request
  expect(prepare).toHaveBeenCalledOnce(); expect(controller.getSnapshot().stepId).toBe('profile')
})
