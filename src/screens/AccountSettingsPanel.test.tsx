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
const mount = async (onRefreshPlayerState?: () => Promise<void>) => { const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root); await act(async () => root.render(<AccountSettingsPanel onRefreshPlayerState={onRefreshPlayerState} />)); return container }
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
  it.each(['runtime-authorized', 'runtime-error', 'runtime-future'])('silently clears the %s outcome without reporting a failed identity link', async outcome => {
    api.getTwitchAccount.mockResolvedValue(linkedAccount);
    history.replaceState(null, '', `/?twitch=${outcome}`);
    const container = await mount();
    expect(location.search).not.toContain('twitch=');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain('Kichnifou · Connecté');
    expect(api.startTwitchLink).not.toHaveBeenCalled();
  });
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
  it('locks the confirmation and snapshot controls during apply, then refreshes the Player without a browser reload', async () => {
    api.getTwitchAccount.mockResolvedValue(linkedAccount)
    api.previewTwitchSnapshot.mockResolvedValue({ previewId: 'preview-a', snapshotHash: 'a'.repeat(64), viewerFound: true, files: 17,
      warning: 'Remplacement', domains: [{ name: 'Progression', category: 'PLAYER_LOCAL_PHYSICAL', action: 'REPLACE', current: 'A', snapshot: 'B', reason: null, anomalies: [] }] })
    let finish!: (value: unknown) => void
    api.applyTwitchSnapshot.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const refresh = vi.fn(async () => undefined)
    const container = await mount(refresh)
    await selectSnapshot(container)
    await act(async () => button(container, 'Prévisualiser le snapshot').click())
    await act(async () => button(container, 'Confirmer l’import').click())
    await act(async () => button(container.querySelector('[role="dialog"]')!, 'Confirmer').click())
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.getAttribute('aria-busy')).toBe('true')
    expect(button(dialog, 'Import en cours…').disabled).toBe(true)
    expect(button(dialog, 'Annuler').disabled).toBe(true)
    expect(Array.from(container.querySelectorAll<HTMLInputElement>('input[type="file"]')).every(input => input.disabled)).toBe(true)
    await act(async () => { button(dialog, 'Import en cours…').click(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(api.applyTwitchSnapshot).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    await act(async () => finish({ snapshotHash: 'a'.repeat(64), replayed: false, imported: ['Progression'], deferred: [] }))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(container.textContent).toContain('Import terminé.')
  })
  it('keeps the preview and unlocks confirmation after a failed apply', async () => {
    api.getTwitchAccount.mockResolvedValue(linkedAccount)
    api.previewTwitchSnapshot.mockResolvedValue({ previewId: 'preview-a', snapshotHash: 'a'.repeat(64), viewerFound: true, files: 17,
      warning: 'Remplacement', domains: [{ name: 'Progression', category: 'PLAYER_LOCAL_PHYSICAL', action: 'REPLACE', current: 'A', snapshot: 'B', reason: null, anomalies: [] }] })
    api.applyTwitchSnapshot.mockRejectedValue(new Error('Échec réseau'))
    const container = await mount()
    await selectSnapshot(container)
    await act(async () => button(container, 'Prévisualiser le snapshot').click())
    await act(async () => button(container, 'Confirmer l’import').click())
    await act(async () => button(container.querySelector('[role="dialog"]')!, 'Confirmer').click())
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('erreur')
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(button(container.querySelector('[role="dialog"]')!, 'Confirmer').disabled).toBe(false)
    expect(Array.from(container.querySelectorAll<HTMLInputElement>('input[type="file"]')).every(input => !input.disabled)).toBe(true)
    expect(container.textContent).toContain('Snapshot :')
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
