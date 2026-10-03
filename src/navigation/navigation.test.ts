import { describe, expect, it } from 'vitest'
import { activityTabs, characterTabs, hashForScreen, mainNavigation, navigationDestinations, parseNavigationHash } from './navigation'

describe('navigation shell registry', () => {
  it('keeps exactly seven ordered main destinations and grouped secondary tabs', () => {
    expect(mainNavigation.map(({ label }) => label)).toEqual(['Accueil', 'Invocation', 'Personnages', 'Activités', 'Sac', 'Boutique', 'Configuration'])
    expect(characterTabs.map(({ label }) => label)).toEqual(['Box', 'Équipe', 'Catalogue'])
    expect(activityTabs.map(({ label }) => label)).toEqual(['Quotidiennes', 'Missions', 'Combat', 'Événement', 'Arcade', 'Concours'])
  })
  it.each([
    ['#box', 'characters-box'], ['#team', 'characters-team'], ['#characters', 'characters-catalog'], ['#inventory', 'inventory'], ['#shop', 'shop'], ['#bank', 'bank'], ['#codes', 'codes'], ['#rankings', 'rankings'], ['#history', 'history'], ['#moderation', 'moderation'],
    ['#characters/box', 'characters-box'], ['#activities/dailies', 'activities-dailies'], ['#social', 'social'],
  ] as const)('maps %s to %s', (hash, screen) => expect(parseNavigationHash(hash)).toBe(screen))
  it('emits canonical deep links and enables Tutorial as an action without a screen', () => {
    expect(hashForScreen('characters-team')).toBe('characters/team')
    expect(hashForScreen('activities-event')).toBe('activities/event')
    expect(navigationDestinations.find(({ id }) => id === 'tutorial')).toMatchObject({ available: true, screen: null, action: 'tutorial' })
  })
  it('adds Rankings to the global menu without changing the seven main tiles', () => {
    expect(navigationDestinations.map(({ id }) => id)).toEqual(['home', 'profile', 'invocation', 'box', 'team', 'catalog', 'dailies', 'missions', 'combat', 'event', 'arcade', 'contest', 'inventory', 'shop', 'bank', 'codes', 'friends', 'trades', 'rankings', 'history', 'tutorial', 'configuration'])
    expect(new Set(navigationDestinations.map(({ id }) => id)).size).toBe(22)
  })
})
