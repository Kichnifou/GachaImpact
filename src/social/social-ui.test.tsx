// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConfigurationScreen from '../screens/ConfigurationScreen'
import ProfileScreen from '../screens/ProfileScreen'
import OnlinePlayersPanel from '../components/OnlinePlayersPanel'
import { defaultNavigationPreference } from '../navigation/navigation'
import type { GeneralStatistics, Profile, SocialActions } from './types'
import type { PermanentMissionDto, PermanentMissionProjectionDto } from '../api/types'
import type { FriendshipController } from './use-friendships'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const roots: ReturnType<typeof createRoot>[] = []
afterEach(() => { act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren() })
async function mount(node: ReactNode) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  await act(async () => { root.render(node) })
  return container
}
const player = { id: 'owner', displayName: 'Test Player', level: 3, elementKey: 'pyro' as const }
const button = (container: HTMLElement, text: string) => Array.from(container.querySelectorAll('button')).find(b => b.textContent === text)!
const controller = { value: { businessDate: '2026-09-20', sort: 'presence', totalFriendHeartsSent: '0', players: [], friends: [], requests: [], summary: { activeFriends: 0, available: 0, alreadySent: 0 } }, error: '', feedback: '', feedbackScope: '', pending: false, refresh: vi.fn(), mutate: vi.fn(), saveSort: vi.fn(), clearFeedback: vi.fn() } as unknown as FriendshipController
const permanent = (rank: 'B' | 'A' | 'S', index: number, status: PermanentMissionDto['status']): PermanentMissionDto => ({ externalKey: `${rank}${index}`, rank, displayName: `Mission ${rank}${index}`, description: 'Objectif', progressLabel: 'Actions', progress: String(index), target: '9', status, rewardPrimogems: '160', completedAt: null })
const missions: PermanentMissionProjectionDto = {
  ranks: {
    B: Array.from({ length: 9 }, (_, index) => permanent('B', index, 'COMPLETED')),
    A: [permanent('A', 0, 'COMPLETED'), permanent('A', 1, 'ACTIVE'), permanent('A', 2, 'LOCKED')],
    S: [permanent('S', 0, 'LOCKED')],
  },
  z: { status: 'LOCKED' },
}

describe('Social screens', () => {
  it('groups general statistics and renders exact large values, zero, unavailable values and the five-star rate', async () => {
    const keys: (keyof GeneralStatistics)[] = ['totalXp', 'totalMessages', 'countedMessages', 'totalPulls', 'totalFiveStars', 'totalFourStars', 'fiftyFiftyWon', 'fiftyFiftyLost', 'capturesTriggered', 'fiveStarRate', 'totalPrimosEarned', 'totalPrimosSpent', 'totalMorasEarned', 'totalMorasSpent', 'totalMainElementParticlesEarned', 'totalFights', 'combatWins', 'totalLosses', 'totalManualWins', 'expeditionsCompleted', 'totalFriendHeartsSent', 'totalSpins', 'totalJackpots']
    const statistics = Object.fromEntries(keys.map(key => [key, '0'])) as GeneralStatistics
    statistics.totalXp = '9007199254740993'; statistics.totalSpins = null; statistics.fiveStarRate = '5.00'
    const value: Profile = { player, own: false, presence: { access: 'PRIVATE' }, lastActivity: { access: 'PRIVATE' }, team: { access: 'PRIVATE' }, box: { access: 'PRIVATE' }, collection: { access: 'PRIVATE' }, statistics: { access: 'ALLOWED', data: statistics } }
    const actions = { profile: vi.fn().mockResolvedValue(value) } as unknown as SocialActions
    const onDirectory = vi.fn(), onRankings = vi.fn()
    const container = await mount(<ProfileScreen playerId={player.id} ownerPlayerId="other" actions={actions} controller={controller} onDirectory={onDirectory} onRankings={onRankings} onPrivacy={vi.fn()} />)
    expect(container.querySelector('.profile-navigation')?.textContent).not.toContain('Classements')
    await act(async () => { button(container, 'Statistiques').click() })
    expect(container.querySelector('.profile-navigation')?.textContent).toContain('JoueursClassements')
    await act(async () => { button(container, 'Classements').click(); button(container, 'Joueurs').click() })
    expect(onRankings).toHaveBeenCalledOnce(); expect(onDirectory).toHaveBeenCalledOnce()
    expect(Array.from(container.querySelectorAll('.profile-statistics-group h2')).map(element => element.textContent)).toEqual(['Progression', 'Gacha', 'Économie', 'Activités'])
    expect(container.textContent).toContain(BigInt(statistics.totalXp).toLocaleString('fr-FR'))
    expect(container.textContent).toContain('Taux de 5★5,00 %')
    expect(container.textContent).toContain('Tours de RoueNon disponible')
    expect(container.textContent).toContain('50/50 perdus0')
    expect(container.querySelectorAll('.profile-statistics-group dt')).toHaveLength(keys.length)
    expect(container.textContent).not.toContain('Cette rubrique est privée.')
  })
  it('keeps confirmed privacy after a failed save, then accepts server confirmation without touching Menu', async () => {
    const settings = { version: 1, settings: [{ categoryKey: 'BOX' as const, level: 'PUBLIC' as const }] }
    const savePrivacy = vi.fn().mockRejectedValueOnce(new Error('save failed')).mockResolvedValueOnce({ version: 1, settings: [{ categoryKey: 'BOX', level: 'PRIVATE' }] })
    const onSave = vi.fn(), onReset = vi.fn()
    const actions = { privacy: vi.fn().mockResolvedValue(settings), savePrivacy } as unknown as SocialActions
    const container = await mount(<ConfigurationScreen socialActions={actions} preference={defaultNavigationPreference} onSave={onSave} onReset={onReset} />)
    expect(actions.privacy).not.toHaveBeenCalled()
    expect(button(container, 'Apparence').disabled).toBe(true)
    await act(async () => { button(container, 'Confidentialité').click() })
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Box"]')!
    expect(select.value).toBe('PUBLIC')
    await act(async () => { select.value = 'PRIVATE'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(select.value).toBe('PUBLIC')
    expect(select.disabled).toBe(false)
    await act(async () => { select.value = 'PRIVATE'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(savePrivacy).toHaveBeenLastCalledWith('BOX', 'PRIVATE')
    expect(select.value).toBe('PRIVATE')
    expect(container.textContent).toContain('Préférences enregistrées.')
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(onSave).not.toHaveBeenCalled(); expect(onReset).not.toHaveBeenCalled()
  })

  it('distinguishes a private section from an empty public section and exposes no mutation controls', async () => {
    const value: Profile = { player, own: false, presence: { access: 'PRIVATE' }, lastActivity: { access: 'PRIVATE' }, team: { access: 'ALLOWED', data: null }, box: { access: 'ALLOWED', data: [] }, collection: { access: 'PRIVATE' }, statistics: { access: 'PRIVATE' } }
    const actions = { profile: vi.fn().mockResolvedValue(value) } as unknown as SocialActions
    const container = await mount(<ProfileScreen playerId={player.id} ownerPlayerId={player.id} actions={actions} controller={controller} onDirectory={vi.fn()} onPrivacy={vi.fn()} />)
    expect(container.textContent).toContain('Présence privée')
    expect(container.textContent).toContain('Dernière activité privée')
    expect(container.textContent).not.toContain('Aucune Team active.')
    await act(async () => { button(container, 'Team active').click() })
    expect(container.textContent).toContain('Aucune Team active.')
    await act(async () => { button(container, 'Collection').click() })
    expect(container.textContent).toContain('Cette rubrique est privée.')
    expect(container.textContent).not.toContain('Collection encore vide.')
    await act(async () => { button(container, 'Box').click() })
    expect(container.textContent).toContain('Aucun personnage possédé.')
    expect(container.textContent).not.toContain('Cette rubrique est privée.')
    expect(container.textContent).not.toMatch(/Stella|Favori|Acheter|Confidentialité|Ajouter/)
    await act(async () => { button(container, 'Statistiques').click() })
    expect(container.textContent).toContain('Cette rubrique est privée.')
    expect(container.querySelector('.profile-navigation')?.textContent).toContain('JoueursClassements')
    expect(container.querySelector('.profile-statistics')).toBeNull()
  })

  it('renders the real connected projection and opens Profile or Social without a fake friendship action', async () => {
    const onProfile = vi.fn(), onDirectory = vi.fn()
    const container = await mount(<OnlinePlayersPanel value={{ total: 2, players: [{ ...player, status: 'ONLINE' }, { ...player, id: 'away', displayName: 'Away Player', status: 'AWAY' }] }} error={false} ownerPlayerId={player.id} controller={controller} onClose={vi.fn()} onProfile={onProfile} onDirectory={onDirectory} />)
    expect(container.textContent).toContain('2 joueurs connectés')
    expect(container.textContent).toContain('En ligne'); expect(container.textContent).toContain('Absent')
    expect(container.textContent).not.toContain('Hors ligne'); expect(container.textContent).toContain('Ajouter')
    await act(async () => { Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Test Player'))!.click() })
    expect(onProfile).toHaveBeenCalledWith(player.id)
    await act(async () => { button(container, 'Voir tous les joueurs →').click() })
    expect(onDirectory).toHaveBeenCalledOnce()
    await act(async () => { roots.at(-1)!.render(<OnlinePlayersPanel value={null} error ownerPlayerId={player.id} controller={controller} onClose={vi.fn()} onProfile={onProfile} onDirectory={onDirectory} />) })
    expect(container.textContent).toContain('Présence indisponible.')
    expect(container.textContent).not.toContain('Aucun joueur connecté visible.')
    await act(async () => { roots.at(-1)!.render(<OnlinePlayersPanel value={{ total: 0, players: [] }} error={false} ownerPlayerId={player.id} controller={controller} onClose={vi.fn()} onProfile={onProfile} onDirectory={onDirectory} />) })
    expect(container.textContent).toContain('Aucun joueur connecté visible.')
    expect(container.textContent).not.toContain('Présence indisponible.')
  })

  it('loads owner Missions lazily, selects A, partitions unfinished cards and refreshes on re-entry', async () => {
    const value: Profile = { player, own: true, presence: { access: 'PRIVATE' }, lastActivity: { access: 'PRIVATE' }, team: { access: 'PRIVATE' }, box: { access: 'PRIVATE' }, collection: { access: 'PRIVATE' }, statistics: { access: 'PRIVATE' } }
    const ownMissions = vi.fn(async () => ({ ...missions, catchUpApplied: false }))
    const actions = { profile: vi.fn(async () => value), ownMissions, playerMissions: vi.fn() } as unknown as SocialActions
    const container = await mount(<ProfileScreen playerId={player.id} ownerPlayerId={player.id} actions={actions} controller={controller} onDirectory={vi.fn()} onPrivacy={vi.fn()} />)
    expect(ownMissions).not.toHaveBeenCalled()
    await act(async () => { button(container, 'Missions').click(); await Promise.resolve(); await Promise.resolve() })
    expect(ownMissions).toHaveBeenCalledOnce()
    expect(actions.playerMissions).not.toHaveBeenCalled()
    expect(container.querySelector('[data-mission-rank="A"]')).not.toBeNull()
    expect(Array.from(container.querySelectorAll('[data-mission-key]')).map(node => node.getAttribute('data-mission-key'))).toEqual(['A1', 'A2', 'A0'])
    await act(async () => { button(container, 'Aperçu').click(); await Promise.resolve() })
    await act(async () => { button(container, 'Missions').click(); await Promise.resolve(); await Promise.resolve() })
    expect(ownMissions).toHaveBeenCalledTimes(2)
  })

  it('uses the privacy-aware third-party route and renders no Mission detail when private', async () => {
    const value: Profile = { player, own: false, presence: { access: 'PRIVATE' }, lastActivity: { access: 'PRIVATE' }, team: { access: 'PRIVATE' }, box: { access: 'PRIVATE' }, collection: { access: 'PRIVATE' }, statistics: { access: 'PRIVATE' } }
    const playerMissions = vi.fn(async () => ({ access: 'PRIVATE' as const }))
    const actions = { profile: vi.fn(async () => value), ownMissions: vi.fn(), playerMissions } as unknown as SocialActions
    const container = await mount(<ProfileScreen playerId={player.id} ownerPlayerId="another-owner" actions={actions} controller={controller} onDirectory={vi.fn()} onPrivacy={vi.fn()} />)
    await act(async () => { button(container, 'Missions').click(); await Promise.resolve(); await Promise.resolve() })
    expect(playerMissions).toHaveBeenCalledWith(player.id)
    expect(actions.ownMissions).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Cette rubrique est privée.')
    expect(container.textContent).not.toMatch(/Mission A|Rang Z|Primogemmes/)
  })

  it('offers retry after a lazy Mission failure', async () => {
    const value: Profile = { player, own: false, presence: { access: 'PRIVATE' }, lastActivity: { access: 'PRIVATE' }, team: { access: 'PRIVATE' }, box: { access: 'PRIVATE' }, collection: { access: 'PRIVATE' }, statistics: { access: 'PRIVATE' } }
    const playerMissions = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ access: 'ALLOWED', data: missions })
    const actions = { profile: vi.fn(async () => value), ownMissions: vi.fn(), playerMissions } as unknown as SocialActions
    const container = await mount(<ProfileScreen playerId={player.id} ownerPlayerId="another-owner" actions={actions} controller={controller} onDirectory={vi.fn()} onPrivacy={vi.fn()} />)
    await act(async () => { button(container, 'Missions').click(); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Missions indisponibles')
    await act(async () => { button(container, 'Réessayer').click(); await Promise.resolve(); await Promise.resolve() })
    expect(playerMissions).toHaveBeenCalledTimes(2)
    expect(container.querySelector('[data-mission-rank="A"]')).not.toBeNull()
  })

  it('invalidates a stale Mission response when the Profile target changes', async () => {
    let resolveOld!: (value: { access: 'PRIVATE' }) => void
    const value: Profile = { player, own: false, presence: { access: 'PRIVATE' }, lastActivity: { access: 'PRIVATE' }, team: { access: 'PRIVATE' }, box: { access: 'PRIVATE' }, collection: { access: 'PRIVATE' }, statistics: { access: 'PRIVATE' } }
    const playerMissions = vi.fn((id: string) => id === 'old-target'
      ? new Promise<{ access: 'PRIVATE' }>(resolve => { resolveOld = resolve })
      : Promise.resolve({ access: 'ALLOWED' as const, data: missions }))
    const actions = { profile: vi.fn(async () => value), ownMissions: vi.fn(), playerMissions } as unknown as SocialActions
    const props = { ownerPlayerId: 'owner', actions, controller, onDirectory: vi.fn(), onPrivacy: vi.fn() }
    const container = await mount(<ProfileScreen playerId="old-target" {...props} />)
    await act(async () => { button(container, 'Missions').click(); await Promise.resolve() })
    await act(async () => { roots.at(-1)!.render(<ProfileScreen playerId="new-target" {...props} />); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector('[data-mission-rank="A"]')).not.toBeNull()
    await act(async () => { resolveOld({ access: 'PRIVATE' }); await Promise.resolve() })
    expect(container.querySelector('[data-mission-rank="A"]')).not.toBeNull()
    expect(container.textContent).not.toContain('Cette rubrique est privée.')
  })
})
