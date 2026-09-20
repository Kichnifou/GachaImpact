// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import SocialScreen from '../screens/SocialScreen'
import ProfileScreen from '../screens/ProfileScreen'
import { useFriendships } from './use-friendships'
import type { FriendsSnapshot, Profile, SocialActions } from './types'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root | undefined
afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks() })
const person = { id: 'friend', displayName: 'Éloïse', level: 5, elementKey: 'pyro' as const, presence: { access: 'PRIVATE' as const } }
const initial: FriendsSnapshot = { businessDate: '2026-09-20', sort: 'presence', totalFriendHeartsSent: '0', players: [person], friends: [{ id: 'relation', playerId: person.id, level: 1, tier: 'Amitié Sincère', totalHearts: '0', heartSent: false, canSend: true }], requests: [], summary: { activeFriends: 1, available: 1, alreadySent: 0 } }
function makeApi() {
  let value = structuredClone(initial)
  const api = {
    friends: vi.fn(async () => structuredClone(value)),
    directory: vi.fn(async () => ({ players: [{ ...person, relation: 'NONE' as const, requestId: null }], page: 1, pageSize: 20, totalPages: 1, total: 1 })),
    sendHearts: vi.fn(async () => { value = { ...value, friends: value.friends.map(f => ({ ...f, canSend: false, heartSent: true })), summary: { activeFriends: 1, available: 0, alreadySent: 1 } }; return { sent: 1, alreadySent: 0, unavailable: 0, activeFriends: 1, senderReward: '5', recipientReward: '5', status: 'SENT' as const } }),
    friendAction: vi.fn(async () => ({ state: 'PENDING' })),
    saveFriendSort: vi.fn(async (sort: FriendsSnapshot['sort']) => { value.sort = sort; return { sort } }),
  } as unknown as SocialActions
  return { api, replace: (next: FriendsSnapshot) => { value = next } }
}
function Surface({ api }: { api: SocialActions }) { const controller = useFriendships(api); return <><output data-available>{controller.value?.summary.available}</output><SocialScreen actions={api} onProfile={() => {}} controller={controller} /></> }
function ProfileSurface({ api }: { api: SocialActions }) { const controller = useFriendships(api); return <ProfileScreen actions={api} controller={controller} ownerPlayerId="owner" playerId={person.id} onDirectory={() => {}} onPrivacy={() => {}} /> }
async function mount(node: React.ReactNode) { const container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => root!.render(node)); return container }
const button = (c: HTMLElement, text: string) => Array.from(c.querySelectorAll('button')).find(b => b.textContent === text)!
const click = (c: HTMLElement, text: string) => act(async () => button(c, text).click())

describe('Friendship UI and shared projection', () => {
  it('opens Amis by default, has exactly three tabs and never infers private presence', async () => {
    const { api } = makeApi(), c = await mount(<Surface api={api} />)
    expect(Array.from(c.querySelectorAll('.social-tabs button')).map(b => b.textContent)).toEqual(['Amis', 'Demandes', 'Joueurs'])
    expect(c.querySelector('.social-tabs .active')?.textContent).toBe('Amis')
    expect(c.querySelector('.social-player-list')?.textContent).not.toMatch(/Hors ligne|En ligne|Absent/)
    expect(c.textContent).toContain('Amitié Sincère'); expect(c.textContent).not.toContain('Messages')
  })
  it('sends individual and all hearts and refreshes the same summary used by Quotidiennes without remounting', async () => {
    for (const target of ['Envoyer un cœur', 'Envoyer un cœur à tous']) {
      const { api } = makeApi(), c = await mount(<Surface api={api} />)
      await click(c, target)
      expect(api.sendHearts).toHaveBeenCalledWith(target === 'Envoyer un cœur à tous' ? 'all' : person.id, expect.any(String))
      expect(c.querySelector('[data-available]')?.textContent).toBe('0')
      expect(c.textContent).toContain('Cœur envoyé ✓'); expect(c.textContent).toContain('+5 Primos')
      expect(button(c, 'Envoyer un cœur à tous').disabled).toBe(true)
      act(() => root!.unmount()); root = undefined
    }
  })
  it('guards double clicks, preserves confirmed rows on failure and retries the same intention key', async () => {
    const { api } = makeApi(); let reject!: (reason: Error) => void
    vi.mocked(api.sendHearts).mockImplementationOnce(() => new Promise((_resolve, no) => { reject = no }))
    const c = await mount(<Surface api={api} />)
    act(() => { button(c, 'Envoyer un cœur').click(); button(c, 'Envoyer un cœur').click() })
    expect(api.sendHearts).toHaveBeenCalledTimes(1); expect(c.textContent).toContain('Enregistrement…')
    const key = vi.mocked(api.sendHearts).mock.calls[0]![1]
    await act(async () => reject(Error('Serveur indisponible')))
    expect(c.querySelector('[role="alert"]')?.textContent).toBe('Une erreur inattendue est survenue.'); expect(c.textContent).not.toContain('Cœur envoyé ✓')
    await click(c, 'Envoyer un cœur'); expect(api.sendHearts).toHaveBeenLastCalledWith(person.id, key)
  })
  it('shows received/sent requests with separate controls and preserves them on refused mutations', async () => {
    const { api, replace } = makeApi(); replace({ ...initial, requests: [{ id: 'received', playerId: person.id, direction: 'RECEIVED', createdAt: '' }, { id: 'sent', playerId: person.id, direction: 'SENT', createdAt: '' }] })
    vi.mocked(api.friendAction).mockRejectedValue(Error('Refus serveur'))
    const c = await mount(<Surface api={api} />); await click(c, 'Demandes')
    for (const [label, action, id] of [['Accepter', 'ACCEPT', 'received'], ['Refuser', 'REFUSE', 'received'], ['Annuler', 'CANCEL', 'sent']]) {
      await click(c, label!); expect(api.friendAction).toHaveBeenLastCalledWith(person.id, action, expect.any(String), id)
      expect(c.querySelectorAll('.social-row')).toHaveLength(2)
    }
  })
  it('shows an accepted request in Amis from the mutation refresh without waiting for polling', async () => {
    const { api, replace } = makeApi()
    replace({ ...initial, friends: [], requests: [{ id: 'received', playerId: person.id, direction: 'RECEIVED', createdAt: '' }], summary: { activeFriends: 0, available: 0, alreadySent: 0 } })
    vi.mocked(api.friendAction).mockImplementation(async (_target, action) => {
      if (action === 'ACCEPT') replace(initial)
      return { state: 'ACCEPTED' }
    })
    const c = await mount(<Surface api={api} />); await click(c, 'Demandes'); await click(c, 'Accepter'); await click(c, 'Amis')
    expect(c.textContent).toContain('Amitié Sincère')
    expect(api.friends).toHaveBeenCalledTimes(2)
  })
  it('adds from Joueurs, sends the status filter to the server, saves sort and removes a friend', async () => {
    const { api } = makeApi(), c = await mount(<Surface api={api} />)
    const sort = c.querySelector('select')!
    await act(async () => { sort.value = 'level'; sort.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(api.saveFriendSort).toHaveBeenCalledWith('level')
    await click(c, 'Retirer'); expect(api.friendAction).toHaveBeenLastCalledWith(person.id, 'REMOVE', expect.any(String), undefined)
    await click(c, 'Joueurs'); await click(c, 'Ajouter')
    expect(api.friendAction).toHaveBeenLastCalledWith(person.id, 'ADD', expect.any(String), undefined)
    const select = Array.from(c.querySelectorAll('label')).find(l => l.textContent?.startsWith('Statut'))!.querySelector('select')!
    await act(async () => { select.value = 'AWAY'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(api.directory).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'AWAY', page: 1 }))
  })
  it('renders every directory relationship in the same fixed structure and prioritizes received requests', async () => {
    const { api } = makeApi()
    vi.mocked(api.directory).mockResolvedValue({ players: [
      { ...person, id: 'received', displayName: 'À accepter', relation: 'RECEIVED', requestId: 'request', presence: { access: 'PRIVATE' } },
      { ...person, id: 'self', displayName: 'Moi', relation: 'SELF', requestId: null, presence: { access: 'PRIVATE' } },
      { ...person, id: 'sent', displayName: 'Envoyé', relation: 'SENT', requestId: 'sent-request', presence: { access: 'PRIVATE' } },
      { ...person, id: 'friend', displayName: 'Ami', relation: 'FRIEND', requestId: null, presence: { access: 'PRIVATE' } },
    ], page: 1, pageSize: 20, totalPages: 1, total: 4 })
    const c = await mount(<Surface api={api} />); await click(c, 'Joueurs')
    expect(Array.from(c.querySelectorAll('.social-row')).every(row => row.children.length === 2)).toBe(true)
    expect(c.querySelector('.social-row')?.classList.contains('social-row-attention')).toBe(true)
    for (const label of ['Toi', 'Envoyée', 'Ami']) expect(button(c, label).disabled).toBe(true)
    expect(button(c, 'Accepter').disabled).toBe(false)
    const relation = Array.from(c.querySelectorAll('label')).find(label => label.textContent?.startsWith('Relation'))!.querySelector('select')!
    await act(async () => { relation.value = 'RECEIVED'; relation.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(api.directory).toHaveBeenLastCalledWith(expect.objectContaining({ relation: 'RECEIVED', page: 1 }))
    const css = readFileSync('src/App.css', 'utf8')
    expect(css).toMatch(/\.social-row \{[^}]*grid-template-columns: minmax\(0, 1fr\) 132px/)
  })
  it('scopes success feedback to its surface, clears it on navigation and expires it', async () => {
    vi.useFakeTimers()
    const { api } = makeApi(), c = await mount(<Surface api={api} />)
    await click(c, 'Joueurs'); await click(c, 'Ajouter')
    expect(c.textContent).toContain('Demande envoyée.')
    await click(c, 'Amis'); expect(c.textContent).not.toContain('Demande envoyée.')
    await click(c, 'Joueurs'); await click(c, 'Ajouter')
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000) })
    expect(c.textContent).not.toContain('Demande envoyée.')
  })
  it('shows profile status under the avatar and the exact empty activity without duplicating Team', async () => {
    const profile: Profile = { player: person, own: false, presence: { access: 'ALLOWED', data: 'ONLINE' }, lastActivity: { access: 'ALLOWED', data: null }, team: { access: 'ALLOWED', data: null }, box: { access: 'PRIVATE' }, collection: { access: 'PRIVATE' }, statistics: { access: 'PRIVATE' } }
    const { api } = makeApi(); api.profile = vi.fn(async () => profile)
    const c = await mount(<ProfileSurface api={api} />)
    expect(c.querySelector('.profile-presence .presence-online')).not.toBeNull()
    expect(c.querySelector('.profile-identity-copy')?.children[1]?.classList.contains('profile-presence')).toBe(true)
    expect(c.querySelector('.profile-element img')).not.toBeNull()
    expect(c.textContent).toContain('Envoyer un cœur'); expect(c.textContent).toContain('Retirer')
    expect(c.textContent).toContain('Aucune activité récente.'); expect(c.querySelector('.profile-overview')?.textContent).not.toContain('Team active')
    await click(c, 'Team active'); expect(c.textContent).toContain('Aucune Team active.')
  })
});
