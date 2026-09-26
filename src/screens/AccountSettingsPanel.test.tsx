// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getTwitchAccount: vi.fn(), startTwitchLink: vi.fn(), unlinkTwitch: vi.fn(), previewTwitchSnapshot: vi.fn(), applyTwitchSnapshot: vi.fn(),
}))
vi.mock('../api/game-api', () => ({ getGameApiClient: () => api }))
import AccountSettingsPanel from './AccountSettingsPanel'

const roots: ReturnType<typeof createRoot>[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren(); vi.clearAllMocks() })
const mount = async () => { const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root); await act(async () => root.render(<AccountSettingsPanel />)); return container }
const linkedAccount = { pilotAvailable: true, eligible: true, linked: { login: 'kichnifou', displayName: 'Kichnifou', linkedAt: '2026-09-26T00:00:00Z' }, snapshotAvailable: true, lastImport: null }
const button = (container: HTMLElement, label: string) => Array.from(container.querySelectorAll('button')).find(element => element.textContent === label)!
async function selectSnapshot(container: HTMLElement) {
  const input = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[1]!
  const files = [...new Set(['banner_votes', 'c6_characters', 'combat_config', 'combat_data', 'contests_data', 'element_passives', 'friendships_data', 'genshin_characters', 'gift_codes', 'giveaway', 'long_missions', 'missions_pool', 'monthly_boss', 'monthly_events', 'monthly_events_data', 'shop_items', 'viewers_data'])].map(name => new File(['{}'], `${name}.json`, { type: 'application/json' }))
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
  expect(button(container, 'Prévisualiser le snapshot')).toBeDefined()
}

describe('Configuration > Compte', () => {
  it('shows an unavailable pilot without an active link action', async () => {
    api.getTwitchAccount.mockResolvedValue({ pilotAvailable: false, eligible: false, linked: null, snapshotAvailable: false, lastImport: null })
    const container = await mount()
    expect(container.textContent).toContain('Compte Twitch')
    expect(Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Connecter Twitch')?.disabled).toBe(true)
    expect(container.textContent).toContain('indisponible')
  })
  it('shows a linked pilot and asks confirmation before unlinking', async () => {
    api.getTwitchAccount.mockResolvedValue(linkedAccount)
    const container = await mount()
    expect(container.textContent).toContain('Kichnifou · Connecté')
    const unlink = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Délier Twitch')!
    await act(async () => unlink.click())
    expect(api.unlinkTwitch).not.toHaveBeenCalled()
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Votre Player')
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
  it('shows an OAuth callback error and clears the query marker', async () => {
    api.getTwitchAccount.mockResolvedValue(linkedAccount)
    history.replaceState(null, '', '/?twitch=TWITCH_IDENTITY_CONFLICT')
    const container = await mount()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('déjà lié')
    expect(location.search).not.toContain('twitch=')
  })
  it('unlinks after confirmation and shows the updated account state', async () => {
    api.getTwitchAccount.mockResolvedValueOnce(linkedAccount).mockResolvedValueOnce({ ...linkedAccount, linked: null, snapshotAvailable: false })
    api.unlinkTwitch.mockResolvedValue({ linked: false })
    const container = await mount()
    await act(async () => button(container, 'Délier Twitch').click())
    await act(async () => button(container.querySelector('[role="dialog"]')!, 'Confirmer').click())
    expect(api.unlinkTwitch).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Non connecté')
    expect(container.textContent).not.toContain('Snapshot Streamer.bot')
  })
  it('allows confirmation when only documented cross-player domains are deferred', async () => {
    api.getTwitchAccount.mockResolvedValue(linkedAccount)
    api.previewTwitchSnapshot.mockResolvedValue({ previewId: 'preview-a', snapshotHash: 'a'.repeat(64), viewerFound: true, files: 17,
      warning: 'Les domaines personnels seront remplacés.', domains: [
        { name: 'Progression', category: 'PLAYER_LOCAL_PHYSICAL', action: 'REPLACE', current: 'XP 1', snapshot: 'XP 2', reason: null, anomalies: [] },
        { name: 'Amitié', category: 'DEFERRED_CROSS_PLAYER_OR_GLOBAL', action: 'DEFERRED', current: '0 relation', snapshot: '15 relations', reason: 'Identités tierces non liées', anomalies: [] },
        { name: 'Faveur', category: 'DEFERRED_NOT_PHYSICAL', action: 'DEFERRED', current: 'Absente', snapshot: 'Valeur legacy', reason: 'Aucune table', anomalies: [] },
      ] })
    api.applyTwitchSnapshot.mockResolvedValue({ snapshotHash: 'a'.repeat(64), replayed: false, imported: ['Progression'], deferred: ['Amitié', 'Faveur'] })
    const container = await mount()
    await selectSnapshot(container)
    await act(async () => button(container, 'Prévisualiser le snapshot').click())
    expect(container.textContent).toContain('15 relations')
    expect(container.textContent).toContain('DEFERRED_CROSS_PLAYER_OR_GLOBAL')
    const apply = button(container, 'Confirmer l’import')
    expect(apply.disabled).toBe(false)
    await act(async () => apply.click())
    expect(api.applyTwitchSnapshot).not.toHaveBeenCalled()
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('remplacés')
    await act(async () => button(container.querySelector('[role="dialog"]')!, 'Confirmer').click())
    expect(api.applyTwitchSnapshot).toHaveBeenCalledWith(expect.any(Object), 'preview-a')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Import terminé')
  })
  it.each(['PENDING_MAPPING', 'BLOCKED'] as const)('keeps confirmation disabled for %s', async action => {
    api.getTwitchAccount.mockResolvedValue(linkedAccount)
    api.previewTwitchSnapshot.mockResolvedValue({ previewId: 'preview-b', snapshotHash: 'b'.repeat(64), viewerFound: true, files: 17, warning: 'Blocage', domains: [
      { name: 'Box', category: action === 'BLOCKED' ? 'BLOCKED_AMBIGUOUS' : 'PLAYER_LOCAL_PHYSICAL', action, current: '0', snapshot: '1', reason: 'Correspondance à résoudre', anomalies: ['Ambiguïté'] },
    ] })
    const container = await mount()
    await selectSnapshot(container)
    await act(async () => button(container, 'Prévisualiser le snapshot').click())
    expect(button(container, 'Confirmer l’import').disabled).toBe(true)
    expect(container.textContent).toContain('Ambiguïté')
  })
})
