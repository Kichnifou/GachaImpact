// @vitest-environment happy-dom
import { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SocialScreen from '../screens/SocialScreen'
import ProfileScreen from '../screens/ProfileScreen'
import ConfigurationScreen from '../screens/ConfigurationScreen'
import OnlinePlayersPanel from '../components/OnlinePlayersPanel'
import { defaultNavigationPreference } from '../navigation/navigation'
import { usePresence } from './use-presence'
import { useFriendships } from './use-friendships'
import { privacyLabels, type Profile, type SocialActions } from './types'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root | undefined
afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks() })
const player = { id: 'owner', displayName: 'Éloïse', level: 3, elementKey: 'pyro' as const }
const profile: Profile = { player, own: false, presence: { access: 'PRIVATE' }, lastActivity: { access: 'PRIVATE' }, team: { access: 'PRIVATE' }, box: { access: 'ALLOWED', data: [] }, collection: { access: 'PRIVATE' }, statistics: { access: 'PRIVATE' } }
function actions(): SocialActions {
  return { directory: vi.fn(async () => ({ players: [{ ...player, presence: { access: 'PRIVATE' as const }, relation: 'SELF' as const, requestId: null }], page: 1, pageSize: 20, total: 21, totalPages: 2 })), profile: vi.fn(async () => profile), connected: vi.fn(async () => ({ players: [{ ...player, status: 'AWAY' as const }], total: 1 })),
    friends: vi.fn(async () => ({ businessDate: '2026-09-20', sort: 'presence' as const, totalFriendHeartsSent: '0', players: [], friends: [], requests: [], summary: { activeFriends: 0, available: 0, alreadySent: 0 } })),
    friendAction: vi.fn(async () => ({ state: 'PENDING' })), sendHearts: vi.fn(async () => ({ sent: 0, alreadySent: 0, unavailable: 0, activeFriends: 0, senderReward: '0', recipientReward: '5', status: 'NO_FRIENDS' as const })), saveFriendSort: vi.fn(async sort => ({ sort })),
    privacy: vi.fn(async () => ({ version: 1, settings: [{ categoryKey: 'BOX' as const, level: 'PUBLIC' as const }] })),
    savePrivacy: vi.fn(async (categoryKey, level) => ({ version: 1, settings: [{ categoryKey, level }] })),
    session: vi.fn(async () => ({})), heartbeat: vi.fn(async () => ({})), end: vi.fn(async () => ({})),
  }
}
async function mount(element: React.ReactNode) { const container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => root!.render(element)); return container }
const click = async (container: HTMLElement, label: string) => act(async () => { Array.from(container.querySelectorAll('button')).find(b => b.textContent === label)!.click() })
function Directory({ api, open }: { api: SocialActions; open: (id: string) => void }) { const controller = useFriendships(api); return <SocialScreen actions={api} onProfile={open} initialTab="players" controller={controller} /> }
function ProfileSurface({ api }: { api: SocialActions }) { const controller = useFriendships(api); return <ProfileScreen playerId="owner" ownerPlayerId="owner" actions={api} controller={controller} onDirectory={vi.fn()} onPrivacy={vi.fn()} /> }
function PlayersSurface({ api, onProfile, onDirectory, onClose }: { api: SocialActions; onProfile: (id: string) => void; onDirectory: () => void; onClose: () => void }) { const controller = useFriendships(api); const [value, setValue] = useState<Awaited<ReturnType<SocialActions['connected']>> | null>(null); useEffect(() => { void api.connected().then(setValue) }, [api]); return <OnlinePlayersPanel value={value} error={false} ownerPlayerId="owner" controller={controller} onProfile={onProfile} onDirectory={onDirectory} onClose={onClose} /> }
describe('Social UI', () => {
  it('searches and filters on the server, paginates and opens identity without a fake offline status', async () => {
    const api = actions(), open = vi.fn(), container = await mount(<Directory api={api} open={open} />)
    expect(container.querySelector('.social-player-list')?.textContent).not.toContain('Hors ligne')
    await act(async () => (container.querySelector('.social-player-identity') as HTMLButtonElement).click())
    expect(open).toHaveBeenCalledWith('owner')
    const search = container.querySelector('input')!
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; setter.call(search, 'elo'); search.dispatchEvent(new Event('input', { bubbles: true })) })
    // Element and page interactions use the same query contract.
    const select = container.querySelector('select')!
    await act(async () => { select.value = 'pyro'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(api.directory).toHaveBeenLastCalledWith(expect.objectContaining({ element: 'pyro', page: 1 }))
    await click(container, 'Suivant')
    expect(api.directory).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
  })
  it('distinguishes private sections from empty possessions and exposes no mutation controls', async () => {
    const container = await mount(<ProfileSurface api={actions()} />)
    expect(container.textContent).toContain('Dernière activité privée')
    await click(container, 'Team active')
    expect(container.textContent).toContain('Cette rubrique est privée.')
    expect(container.textContent).not.toContain('Aucune Team active.')
    await click(container, 'Box')
    expect(container.textContent).toContain('Aucun personnage possédé.')
    for (const label of ['Stella', 'Favori', 'Bloquer', 'Ajouter', 'Messages']) expect(container.textContent).not.toContain(label)
  })
  it('activates privacy, keeps Appearance disabled, persists confirmed values and reports errors', async () => {
    const api = actions(), container = await mount(<ConfigurationScreen preference={defaultNavigationPreference} onSave={vi.fn()} onReset={vi.fn()} socialActions={api} />)
    expect(container.querySelector('.configuration-tabs button')?.textContent).toBe('Menu')
    await click(container, 'Confidentialité')
    expect((Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Apparence'))!.disabled).toBe(true)
    const select = container.querySelector('select')!
    await act(async () => { select.value = 'PRIVATE'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(api.savePrivacy).toHaveBeenCalledWith('BOX', 'PRIVATE')
    expect(container.textContent).toContain('Préférences enregistrées.')
    vi.mocked(api.savePrivacy).mockRejectedValueOnce(Error('offline'))
    await act(async () => { select.value = 'PUBLIC'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(select.value).toBe('PRIVATE')
    expect(Object.keys(privacyLabels)).toHaveLength(18)
  })
  it('renders the real connected count and accessible profile/directory links without friendship mocks', async () => {
    const api = actions(), onProfile = vi.fn(), onDirectory = vi.fn(), onClose = vi.fn()
    const container = await mount(<PlayersSurface api={api} onProfile={onProfile} onDirectory={onDirectory} onClose={onClose} />)
    expect(container.textContent).toContain('1 joueur connecté')
    expect(container.textContent).toContain('Absent')
    expect(container.textContent).not.toContain('Ajouter')
    await act(async () => (container.querySelector('.social-player-identity') as HTMLButtonElement).click())
    expect(onProfile).toHaveBeenCalledWith('owner')
    await click(container, 'Voir tous les joueurs →'); expect(onDirectory).toHaveBeenCalled()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onClose).toHaveBeenCalled()
  })
  it('sends technical heartbeats without activity and isolates tab identity on account changes', async () => {
    vi.useFakeTimers(); vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const api = actions()
    function Probe({ id }: { id: string }) { usePresence(id, api); return null }
    await mount(<Probe id="one" />)
    const key = vi.mocked(api.session).mock.calls[0]![0]
    await act(async () => { await vi.advanceTimersByTimeAsync(45_000) })
    expect(api.heartbeat).toHaveBeenCalledWith(key, false)
    await act(async () => root!.render(<Probe id="two" />))
    expect(api.end).toHaveBeenCalledWith(key)
    expect(vi.mocked(api.session).mock.calls.at(-1)![0]).not.toBe(key)
    act(() => root!.unmount()); root = undefined
    const calls = vi.mocked(api.heartbeat).mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000) })
    expect(api.heartbeat).toHaveBeenCalledTimes(calls)
  })
})
