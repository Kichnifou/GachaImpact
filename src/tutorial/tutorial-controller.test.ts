import { describe, expect, it, vi } from 'vitest'
import type { TutorialPreferenceDto } from '../api/types'
import { TutorialController, tutorialSteps } from './tutorial-controller'
const initial: TutorialPreferenceDto = { version: 1, status: 'NOT_STARTED', stepId: null }
const complete: TutorialPreferenceDto = { version: 1, status: 'COMPLETED', stepId: null }
const progress = (stepId: 'profile' | 'resources' | 'community'): TutorialPreferenceDto => ({ version: 1, status: 'IN_PROGRESS', stepId })
function harness(saved = initial) {
  const api = { get: vi.fn(async () => saved), put: vi.fn(async (value: TutorialPreferenceDto) => value) }
  return { api, controller: new TutorialController(api) }
}
describe('tutorial confirmed progression', () => {
  it.each([initial, complete])('manually starts/replays %j at profile after confirmation', async saved => {
    const { api, controller } = harness(saved); expect(controller.getSnapshot().active).toBe(false)
    let resolve!: (value: TutorialPreferenceDto) => void
    api.put.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const starting = controller.launch(); await Promise.resolve()
    expect(controller.getSnapshot().stepId).toBeNull()
    resolve(progress('profile')); await starting
    expect(controller.getSnapshot()).toMatchObject({ active: true, stepId: 'profile', pending: false })
    expect(api.put).toHaveBeenCalledWith(progress('profile'))
  })
  it('resumes exact saved step without an extra write', async () => {
    const { api, controller } = harness(progress('resources')); await controller.launch()
    expect(controller.getSnapshot().stepId).toBe('resources'); expect(api.put).not.toHaveBeenCalled()
  })
  it('persists all seven transitions and completes only after final confirmation', async () => {
    const { api, controller } = harness(); await controller.launch()
    for (const step of tutorialSteps.slice(1)) { await controller.next(); expect(controller.getSnapshot().stepId).toBe(step.id) }
    await controller.next(); expect(api.put).toHaveBeenLastCalledWith(complete); expect(controller.getSnapshot().active).toBe(false)
  })
  it('finishes early and replay starts profile', async () => {
    const { api, controller } = harness(progress('resources')); await controller.launch(); await controller.finish()
    expect(api.put).toHaveBeenCalledWith(complete); expect(controller.getSnapshot().active).toBe(false)
    api.get.mockResolvedValue(complete); await controller.launch(); expect(controller.getSnapshot().stepId).toBe('profile')
  })
  it('pauses without a write and reload resumes the confirmed step', async () => {
    const { api, controller } = harness(progress('resources')); await controller.launch(); controller.pause()
    expect(api.put).not.toHaveBeenCalled(); expect(controller.getSnapshot().active).toBe(false)
    await controller.launch(); expect(controller.getSnapshot().stepId).toBe('resources')
  })
  it('does not advance on failure and retries the same intent with a synchronous double-send guard', async () => {
    const { api, controller } = harness(progress('profile')); await controller.launch()
    api.put.mockRejectedValueOnce(Error('offline'))
    const request = controller.next(); controller.next(); controller.finish(); await request
    expect(api.put).toHaveBeenCalledOnce(); expect(controller.getSnapshot()).toMatchObject({ stepId: 'profile', pending: false })
    expect(controller.getSnapshot().error).toBeTruthy(); controller.finish(); expect(api.put).toHaveBeenCalledOnce()
    await controller.next(); expect(api.put).toHaveBeenLastCalledWith(progress('resources')); expect(controller.getSnapshot().stepId).toBe('resources')
  })
  it('retries a failed completion instead of advancing to another step', async () => {
    const { api, controller } = harness(progress('profile')); await controller.launch(); api.put.mockRejectedValueOnce(Error())
    await controller.finish(); await controller.next(); expect(api.put.mock.calls.map(([value]) => value)).toEqual([complete, complete])
  })
  it('allows Pause/Escape during a write, closing once its outcome is confirmed', async () => {
    const { api, controller } = harness(progress('profile')); await controller.launch()
    let resolve!: (value: TutorialPreferenceDto) => void; api.put.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const request = controller.next(); controller.pause(); resolve(progress('resources')); await request
    expect(controller.getSnapshot()).toMatchObject({ active: false, stepId: 'resources', pending: false })
  })
  it('ignores old session responses and does not write after a disposed GET', async () => {
    const { api, controller } = harness(); let resolve!: (value: TutorialPreferenceDto) => void
    api.get.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const request = controller.launch(); controller.dispose(); resolve(initial); await request; expect(api.put).not.toHaveBeenCalled()
  })
  it('retries a failed initial GET and never autostarts on construction', async () => {
    const { api, controller } = harness(); api.get.mockRejectedValueOnce(Error('offline'))
    await controller.launch(); expect(controller.getSnapshot()).toMatchObject({ active: true, stepId: null, pending: false })
    expect(api.put).not.toHaveBeenCalled(); await controller.next(); expect(controller.getSnapshot().stepId).toBe('profile')
  })
})
