// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConfigurationScreen from '../screens/ConfigurationScreen'
import ProfileScreen from '../screens/ProfileScreen'
import OnlinePlayersPanel from '../components/OnlinePlayersPanel'
import { defaultNavigationPreference } from '../navigation/navigation'
import type { Profile, SocialActions } from './types'
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

describe('Social screens', () => {
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
})
