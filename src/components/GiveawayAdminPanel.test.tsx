// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GiveawayStateDto } from '../api/types'

const api = vi.hoisted(() => ({ getGiveawayState: vi.fn(), openGiveaway: vi.fn(), closeGiveaway: vi.fn(),
  retryGiveawayAnnouncement: vi.fn(), startTwitchGiveaway: vi.fn(), enableTwitchGiveaway: vi.fn(), disableTwitchGiveaway: vi.fn() }))
vi.mock('../api/game-api', () => ({ getGameApiClient: () => api }))
import GiveawayAdminPanel from './GiveawayAdminPanel'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const roots: ReturnType<typeof createRoot>[] = []
afterEach(() => { act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren(); vi.clearAllMocks() })
const base: GiveawayStateDto = { bridge: { available: true, authorized: true, active: false, pending: false }, session: null }
const button = (container: HTMLElement, label: string) => Array.from(container.querySelectorAll('button')).find(row => row.textContent === label)!
async function mount(state: GiveawayStateDto, admin = true) {
  api.getGiveawayState.mockResolvedValue(state)
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  await act(async () => root.render(<GiveawayAdminPanel admin={admin} />))
  return container
}

describe('Giveaway private moderation panel', () => {
  it('shows empty and pending bridges, blocks opening without active proof, and hides lifecycle from moderators', async () => {
    const container = await mount({ ...base, bridge: { ...base.bridge, pending: true, error: 'REMOTE_UNAVAILABLE' } }, false)
    expect(container.textContent).toContain('Vérification Twitch en cours')
    expect(container.textContent).toContain('Aucune session native')
    expect(container.textContent).toContain('REMOTE_UNAVAILABLE')
    expect(button(container, 'Ouvrir').disabled).toBe(true)
    expect(button(container, 'Fermer').disabled).toBe(true)
    expect(container.textContent).not.toContain('Activer le bridge')
    expect(container.textContent).not.toContain('Reroll')
  })

  it('opens immediately when active, confirms Close, shows Top 3 and retries only the failed announcement', async () => {
    const state: GiveawayStateDto = { bridge: { ...base.bridge, active: true }, session: { id: 'session', status: 'OPEN',
      openedAt: '2026-09-30T10:00:00Z', closedAt: null, openedBy: 'Admin', winner: null, participantCount: 2,
      chatterCount: 3, top: [{ playerId: '1', displayName: 'Alice', rank: 1, messageCount: '8' }],
      announcements: [{ id: 'failed', kind: 'OPEN', state: 'FAILED', errorCode: 'HTTP_403', attempts: 1 },
        { id: 'ambiguous', kind: 'RANKING', state: 'AMBIGUOUS', errorCode: 'NETWORK', attempts: 1 }] } }
    api.openGiveaway.mockResolvedValue({}); api.closeGiveaway.mockResolvedValue({}); api.retryGiveawayAnnouncement.mockResolvedValue({})
    const container = await mount(state)
    expect(container.textContent).toContain('Alice')
    expect(container.textContent).toContain('8 messages')
    expect(container.textContent).toContain('2')
    expect(button(container, 'Ouvrir').disabled).toBe(true)
    expect(container.querySelectorAll('button')).toHaveLength(5)
    await act(async () => button(container, 'Fermer').click())
    expect(api.closeGiveaway).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alertdialog"]')?.textContent).toContain('distribue immédiatement')
    await act(async () => button(container, 'Confirmer la fermeture').click())
    expect(api.closeGiveaway).toHaveBeenCalledWith('session', expect.any(String))
    await act(async () => button(container, 'Réessayer cet envoi').click())
    expect(api.retryGiveawayAnnouncement).toHaveBeenCalledWith('failed')
    expect(api.retryGiveawayAnnouncement).toHaveBeenCalledTimes(1)
  })
})
