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
  it.each([['menu-destinations', 'notifications-entry'], ['event-ranking', 'arcade-memory']] as const)('moves both ways across the retired step between %s and %s', async (before, after) => {
    const saved: TutorialPreferenceDto = { version: 1, status: 'IN_PROGRESS', stepId: before }
    const { api, controller } = harness(saved)
    await controller.launch(); expect(api.put).not.toHaveBeenCalled()
    await controller.next(); expect(controller.getSnapshot().stepId).toBe(after)
    await controller.previous(); expect(controller.getSnapshot().stepId).toBe(before)
    expect(api.put.mock.calls.map(([value]) => value.stepId)).toEqual([after, before])
  })
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
    await controller.finish(); await controller.next(); await controller.previous(); expect(api.put).toHaveBeenCalledOnce()
    await controller.finish(); expect(api.put.mock.calls.map(([value]) => value)).toEqual([complete, complete])
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
  it('does not wrap before profile and waits for confirmation when returning from resources', async () => {
    const { api, controller } = harness(progress('resources')); await controller.launch()
    let resolve!: (value: TutorialPreferenceDto) => void
    api.put.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const request = controller.previous(); controller.previous(); controller.next()
    expect(api.put).toHaveBeenCalledWith(progress('profile')); expect(controller.getSnapshot().stepId).toBe('resources')
    resolve(progress('profile')); await request; await controller.previous()
    expect(controller.getSnapshot().stepId).toBe('profile'); expect(api.put).toHaveBeenCalledOnce()
  })
  it('returns from community to home without changing step identifiers', async () => {
    const { api, controller } = harness(progress('community')); await controller.launch(); await controller.previous()
    expect(api.put).toHaveBeenCalledWith({ version: 1, status: 'IN_PROGRESS', stepId: 'home' }); expect(controller.getSnapshot().stepId).toBe('home')
  })
  it('retries only Previous after a backward failure, never via Next or Finish', async () => {
    const { api, controller } = harness(progress('resources')); await controller.launch(); api.put.mockRejectedValueOnce(Error('offline'))
    await controller.previous(); expect(controller.getSnapshot()).toMatchObject({ stepId: 'resources', retryAction: 'previous' })
    expect(controller.getSnapshot().error).toContain('Précédent'); await controller.next(); await controller.finish(); expect(api.put).toHaveBeenCalledOnce()
    await controller.previous(); expect(api.put.mock.calls.map(([value]) => value)).toEqual([progress('profile'), progress('profile')]); expect(controller.getSnapshot().stepId).toBe('profile')
  })
  it.each([initial, complete])('retries a failed start/replay write from %j using its launch intention', async saved => {
    const { api, controller } = harness(saved); api.put.mockRejectedValueOnce(Error('offline'))
    await controller.launch(); expect(controller.getSnapshot()).toMatchObject({ stepId: null, retryAction: 'launch' })
    await controller.previous(); await controller.finish(); expect(api.put).toHaveBeenCalledOnce()
    await controller.next(); expect(api.put.mock.calls.map(([value]) => value)).toEqual([progress('profile'), progress('profile')]); expect(controller.getSnapshot().stepId).toBe('profile')
  })
})

it('presents confirmed autostart without GET/PUT and retries preparation without rewriting state', async () => {
  const api = { get: vi.fn(), put: vi.fn() }, prepare = vi.fn().mockRejectedValueOnce(new Error('DOM')).mockResolvedValue({})
  const controller = new TutorialController(api, prepare)
  await controller.startConfirmed({ version: 1, status: 'IN_PROGRESS', stepId: 'arcade-memory' })
  expect(controller.getSnapshot().retryAction).toBe('launch')
  await controller.next()
  expect(controller.getSnapshot().stepId).toBe('arcade-memory')
  expect(api.get).not.toHaveBeenCalled(); expect(api.put).not.toHaveBeenCalled()
  controller.pause(); expect(controller.getSnapshot().active).toBe(false)
})
