import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getTutorialStep, tutorialStepsForCatalog, tutorialHistoricalSteps, tutorialStepIds, tutorialSteps } from './tutorial-catalog'

describe('player tutorial catalog contract', () => {
  it('keeps Boss mensuel at step 42 with its identity, anchor and approved participation explanation', () => {
    expect(tutorialSteps[41]).toMatchObject({ id:'boss-identity', title:'Boss mensuel', anchor:'boss-identity', text:"Le Boss affiche ses PV et sa résistance. Une attaque infligeant des dégâts suffit pour participer. S'il est vaincu, chaque participant reçoit automatiquement la même récompense, même hors ligne. Le coup final n'offre aucun bonus." })
  })
  it('keeps Codes disponibles at step 80 and changes only its requested copy', () => {
    expect(tutorialSteps[79]).toMatchObject({ id: 'codes-available', title: 'Codes disponibles', anchor: 'codes-list', text: "Échangez les codes actifs contre des récompenses. Il existe des codes mensuel, et d'autres qui peuvent être donnés en compensations ou comme cadeau." })
    expect(new Set(tutorialSteps.map(step => step.chapter)).size).toBe(24)
    expect(new Set(tutorialSteps.map(step => step.screen)).size).toBe(21)
  })
  it('preserves the historical 116 and 121 catalogs and resolves copy by catalog', () => {
    const historical = tutorialHistoricalSteps.find(step => step.id === 'codes-available')!
    expect(tutorialHistoricalSteps).toHaveLength(121)
    expect(tutorialStepsForCatalog(true)).toHaveLength(116)
    expect(historical.text).toBe("Les codes publiés indiquent période, récompenses directes et état de récupération. Certains offrent aussi des gains Event selon votre inscription. Vous pouvez réclamer un code sans le saisir.")
    expect(tutorialStepsForCatalog(true).find(step => step.id === 'codes-available')).toBe(historical)
    expect(getTutorialStep('codes-available', true)).toBe(historical)
    expect(getTutorialStep('codes-available')).toBe(tutorialSteps[79])
    expect(getTutorialStep('history-bank').id).toBe('history-bank')
    expect(tutorialSteps[79]).not.toBe(historical)
  })
  it('covers every player ScreenId exactly as a destination set, excluding moderation', () => {
    const source = readFileSync(new URL('../types.ts', import.meta.url), 'utf8').split('export type ElementTone')[0]!
    const screens = [...source.matchAll(/'([^']+)'/g)].map(match => match[1]).filter(id => id !== 'moderation')
    expect([...new Set(tutorialSteps.map(step => step.screen))].sort()).toEqual(screens.sort())
    expect(new Set(tutorialStepIds).size).toBe(tutorialSteps.length)
    expect(tutorialSteps).toHaveLength(115)
    expect(tutorialStepIds).not.toContain('menu-pagination')
    expect(tutorialStepIds).not.toContain('event-calendar')
    expect(tutorialStepIds.filter(id => !['display-settings', 'home-shortcuts'].includes(id)).slice(0, 8)).toEqual(['profile', 'resources', 'active-team', 'objective', 'daily-tracker', 'main-navigation', 'home', 'community'])
    expect(tutorialSteps.at(-1)).toMatchObject({ id: 'conclusion', screen: 'home' })
    expect(tutorialSteps.every(step => step.anchor && step.title && step.text && step.fallback && step.chapter)).toBe(true)
  })
  it('keeps the separately built backend whitelist identical, including order', () => {
    const source = readFileSync(new URL('../../server/src/application/tutorial/tutorial-preferences.ts', import.meta.url), 'utf8')
    const ids = JSON.parse(source.match(/export const tutorialStepIds = (\[[^\n]+\]) as const/)![1]!)
    expect(ids).toEqual(tutorialHistoricalSteps.map(step => step.id))
  })
  it('covers owned subviews and panels rather than just screen headings', () => {
    const views = (screen: string) => tutorialSteps.filter(step => step.screen === screen).map(step => step.view).filter(Boolean)
    expect(views('activities-dailies')).toEqual(['overview', 'wheel', 'challenge'])
    expect(views('activities-event')).toEqual(['registration', 'registration', 'registration', 'registration', 'games-a', 'games-b', 'games-c', 'shop', 'ranking'])
    expect(views('history')).toEqual(['invocations', 'banners', 'activity'])
    expect(views('inventory')).toContain('collection')
    expect(views('profile')).toContain('Personnalisation:titles')
    expect(views('configuration')).toEqual(['menu', 'privacy'])
    expect(tutorialSteps.filter(step => step.panel).map(step => step.panel)).toEqual(expect.arrayContaining(['menu', 'notifications', 'box-detail', 'conversion', 'players', 'arcade-records', 'boss-history', 'contest-history']))
  })
})
