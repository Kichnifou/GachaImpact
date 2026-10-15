import { expect, it, vi } from 'vitest'
import { tutorialSteps, tutorialStepsForCatalog } from './tutorial-catalog'
import { TutorialController } from './tutorial-controller'

const removed = { 'catalog-filters': 'catalog-votes', 'contest-play': 'contest-history', 'history-bank': 'history-activity', 'history-shop': 'history-activity', 'history-event': 'history-activity', 'configuration-account': 'conclusion' } as const
it('retires exactly the six owner-selected steps while retaining chapters and screens', () => {
  expect(tutorialSteps).toHaveLength(115)
  expect(new Set(tutorialSteps.map(s => s.chapter)).size).toBe(24)
  expect(new Set(tutorialSteps.map(s => s.screen)).size).toBe(21)
  expect(tutorialSteps.filter(s => Object.hasOwn(removed, s.id))).toEqual([])
})
it.each(Object.entries(removed))('resumes retired %s on %s without a GET repair write', async (stepId, projected) => {
  const put = vi.fn()
  const prepare = vi.fn(async () => ({}))
  const controller = new TutorialController({ get: async () => ({ version: 1, status: 'IN_PROGRESS', stepId: stepId as never }), put }, prepare)
  await controller.launch()
  expect(controller.getSnapshot().stepId).toBe(projected)
  expect(prepare).toHaveBeenCalledWith(projected, expect.any(AbortSignal))
  expect(put).not.toHaveBeenCalled()
})
it('preserves 116 steps when negotiating the historical server fallback', () => {
  expect(tutorialStepsForCatalog(true)).toHaveLength(116)
})
it.each([['team-passives', 'catalog-votes'], ['contest-lobby', 'contest-history'], ['history-banners', 'history-activity'], ['configuration-privacy', 'conclusion']] as const)('moves directly both ways from %s to %s', async (before, after) => {
  const controller = new TutorialController({ get: async () => ({ version: 1, status: 'IN_PROGRESS', stepId: before }), put: async value => value })
  await controller.launch(); await controller.next(); expect(controller.getSnapshot().stepId).toBe(after)
  await controller.previous(); expect(controller.getSnapshot().stepId).toBe(before)
})
