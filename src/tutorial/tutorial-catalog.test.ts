import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { tutorialStepIds, tutorialSteps } from './tutorial-catalog'

describe('player tutorial catalog contract', () => {
  it('covers every player ScreenId exactly as a destination set, excluding moderation', () => {
    const source = readFileSync(new URL('../types.ts', import.meta.url), 'utf8').split('export type ElementTone')[0]!
    const screens = [...source.matchAll(/'([^']+)'/g)].map(match => match[1]).filter(id => id !== 'moderation')
    expect([...new Set(tutorialSteps.map(step => step.screen))].sort()).toEqual(screens.sort())
    expect(new Set(tutorialStepIds).size).toBe(tutorialSteps.length)
    expect(tutorialSteps).toHaveLength(116)
    expect(tutorialStepIds).not.toContain('menu-pagination')
    expect(tutorialStepIds).not.toContain('event-calendar')
    expect(tutorialStepIds.slice(0, 8)).toEqual(['profile', 'resources', 'active-team', 'objective', 'daily-tracker', 'main-navigation', 'home', 'community'])
    expect(tutorialSteps.at(-1)).toMatchObject({ id: 'conclusion', screen: 'home' })
    expect(tutorialSteps.every(step => step.anchor && step.title && step.text && step.fallback && step.chapter)).toBe(true)
  })
  it('keeps the separately built backend whitelist identical, including order', () => {
    const source = readFileSync(new URL('../../server/src/application/tutorial/tutorial-preferences.ts', import.meta.url), 'utf8')
    const ids = JSON.parse(source.match(/export const tutorialStepIds = (\[[^\n]+\]) as const/)![1]!)
    expect(ids).toEqual(tutorialStepIds)
  })
  it('covers owned subviews and panels rather than just screen headings', () => {
    const views = (screen: string) => tutorialSteps.filter(step => step.screen === screen).map(step => step.view).filter(Boolean)
    expect(views('activities-dailies')).toEqual(['overview', 'wheel', 'challenge'])
    expect(views('activities-event')).toEqual(['registration', 'registration', 'registration', 'registration', 'games-a', 'games-b', 'games-c', 'shop', 'ranking'])
    expect(views('history')).toEqual(['invocations', 'banners', 'bank', 'shop', 'event'])
    expect(views('inventory')).toContain('collection')
    expect(views('profile')).toContain('Personnalisation:titles')
    expect(views('configuration')).toEqual(['menu', 'privacy', 'account'])
    expect(tutorialSteps.filter(step => step.panel).map(step => step.panel)).toEqual(expect.arrayContaining(['menu', 'notifications', 'box-detail', 'conversion', 'players', 'arcade-records', 'boss-history', 'contest-history']))
  })
})
