import { describe, expect, it } from 'vitest'
import { activityTabs, characterTabs, hashForScreen, mainNavigation, navigationDestinations, parseNavigationHash } from './navigation'

describe('navigation shell registry', () => {
  it('keeps exactly seven ordered main destinations and grouped secondary tabs', () => {
    expect(mainNavigation.map(({ label }) => label)).toEqual(['Accueil', 'Invocation', 'Personnages', 'Activités', 'Sac', 'Boutique', 'Configuration'])
    expect(characterTabs.map(({ label }) => label)).toEqual(['Box', 'Équipe', 'Catalogue'])
    expect(activityTabs.map(({ label }) => label)).toEqual(['Quotidiennes', 'Missions', 'Combat', 'Événement', 'Concours'])
  })
  it.each([
    ['#box', 'characters-box'], ['#team', 'characters-team'], ['#characters', 'characters-catalog'], ['#inventory', 'inventory'], ['#shop', 'shop'], ['#bank', 'bank'], ['#moderation', 'moderation'],
    ['#characters/box', 'characters-box'], ['#activities/dailies', 'activities-dailies'],
  ] as const)('maps %s to %s', (hash, screen) => expect(parseNavigationHash(hash)).toBe(screen))
  it('emits canonical deep links and marks future destinations unavailable', () => {
    expect(hashForScreen('characters-team')).toBe('characters/team')
    expect(hashForScreen('activities-event')).toBe('activities/event')
    expect(navigationDestinations.filter(({ available }) => !available).map(({ id }) => id)).toEqual(['history', 'tutorial'])
  })
  it('keeps the exhaustive sixteen-entry global registry without Social or Stats', () => {
    expect(navigationDestinations.map(({ id }) => id)).toEqual(['home', 'invocation', 'box', 'team', 'catalog', 'dailies', 'missions', 'combat', 'event', 'contest', 'inventory', 'shop', 'bank', 'history', 'tutorial', 'configuration'])
    expect(new Set(navigationDestinations.map(({ id }) => id)).size).toBe(16)
  })
})
