// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getTwitchAccount: vi.fn(), startTwitchLink: vi.fn(), startTwitchFavor: vi.fn(), disableTwitchFavor: vi.fn(), startTwitchRuntime: vi.fn(), disableTwitchRuntime: vi.fn(), unlinkTwitch: vi.fn(), previewTwitchSnapshot: vi.fn(), applyTwitchSnapshot: vi.fn(),
}))
vi.mock('../api/game-api', () => ({ getGameApiClient: () => api }))
import AccountSettingsPanel from './AccountSettingsPanel'

const roots: ReturnType<typeof createRoot>[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.useRealTimers(); history.replaceState(null, '', '/') })
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
  it.each(['runtime-activated', 'runtime-authorized', 'runtime-future'])('clears the %s outcome without reporting a failed identity link', async outcome => {
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

describe('pilot chat reception', () => {
  const inactive = { ...linkedAccount, runtimeSubscriptionAvailable: true, runtimeChatActive: false, runtimeChatPending: false };
  it.each([
    { ...inactive, eligible: false },
    { ...inactive, linked: null },
    { ...inactive, runtimeSubscriptionAvailable: false },
  ])('hides pilot controls unless eligible, linked and configured', async value => {
    api.getTwitchAccount.mockResolvedValue(value);
    expect((await mount()).textContent).not.toContain('Réception du chat Twitch');
  });
  it.each([false, true])('shows only the approved active=%s presentation between link info and unlink', async active => {
    api.getTwitchAccount.mockResolvedValue({ ...inactive, runtimeChatActive: active });
    const container = await mount();
    const block = container.querySelector('.account-twitch-runtime')!;
    expect(block.textContent).toContain('Réception du chat Twitch');
    expect(block.textContent).toContain(active ? '● Activée' : 'Non activée');
    expect(block.textContent).toContain(active ? 'GachaImpact reçoit les messages du chat Twitch.' : 'Permet à GachaImpact de recevoir les messages du chat Twitch pendant le pilote.');
    expect(button(block as HTMLElement, active ? 'Désactiver' : 'Autoriser et activer')).toBeDefined();
    expect(block.nextElementSibling?.textContent).toBe('Délier Twitch');
    expect(block.previousElementSibling?.textContent).toContain('Lié le');
    expect(block.textContent).not.toMatch(/EventSub|webhook|scope|token/i);
    expect(container.textContent).toContain('Snapshot Streamer.bot');
  });
  it('starts runtime once under a synchronous double click and accepts only Twitch authorize navigation', async () => {
    api.getTwitchAccount.mockResolvedValue(inactive);
    let release!: (value: { url: string }) => void;
    api.startTwitchRuntime.mockReturnValue(new Promise(resolve => { release = resolve; }));
    const navigate = vi.spyOn(location, 'assign').mockImplementation(() => undefined);
    const container = await mount(), start = button(container, 'Autoriser et activer');
    act(() => { start.click(); start.click(); });
    expect(api.startTwitchRuntime).toHaveBeenCalledOnce();
    expect(start.disabled).toBe(true);
    expect(start.textContent).toBe('Autoriser et activer');
    expect(start.getAttribute('aria-busy')).toBe('true');
    await act(async () => release({ url: 'https://id.twitch.tv/oauth2/authorize?state=private-fixture' }));
    expect(navigate).toHaveBeenCalledWith('https://id.twitch.tv/oauth2/authorize?state=private-fixture');
    expect(api.startTwitchLink).not.toHaveBeenCalled();
  });
  it.each(['https://evil.example/oauth2/authorize', 'javascript:alert(1)', 'https://id.twitch.tv/other', 'https://user:password@id.twitch.tv/oauth2/authorize'])('rejects redirect %s without navigating', async url => {
    api.getTwitchAccount.mockResolvedValue(inactive);
    api.startTwitchRuntime.mockResolvedValue({ url });
    const navigate = vi.spyOn(location, 'assign').mockImplementation(() => undefined);
    const container = await mount();
    await act(async () => button(container, 'Autoriser et activer').click());
    expect(navigate).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('disables once and reloads status without unlinking or changing the snapshot', async () => {
    api.getTwitchAccount.mockResolvedValueOnce({ ...inactive, runtimeChatActive: true }).mockResolvedValue(inactive);
    let finish!: () => void;
    api.disableTwitchRuntime.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    const container = await mount(), disable = button(container, 'Désactiver');
    act(() => { disable.click(); disable.click(); });
    expect(disable.disabled).toBe(true);
    expect(disable.textContent).toBe('Désactiver');
    expect(api.disableTwitchRuntime).toHaveBeenCalledOnce();
    await act(async () => finish());
    expect(api.getTwitchAccount).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Non activée');
    expect(button(container, 'Autoriser et activer')).toBeDefined();
    expect(api.unlinkTwitch).not.toHaveBeenCalled();
  });
  it('cleans runtime callback and waits for real enabled status with bounded reads', async () => {
    vi.useFakeTimers();
    history.replaceState(null, '', '/?twitch=runtime-activated#configuration');
    api.getTwitchAccount.mockResolvedValueOnce({ ...inactive, runtimeChatPending: true }).mockResolvedValue({ ...inactive, runtimeChatActive: true });
    const container = await mount();
    expect(location.search).not.toContain('twitch=');
    expect(container.textContent).toContain('Chargement du compte…');
    expect(container.textContent).not.toContain('● Activée');
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(api.getTwitchAccount).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('● Activée');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(api.getTwitchAccount).toHaveBeenCalledTimes(2);
  });
  it('times out pending without presenting a false activation or an infinite polling loop', async () => {
    vi.useFakeTimers();
    history.replaceState(null, '', '/?twitch=runtime-activated');
    api.getTwitchAccount.mockResolvedValue({ ...inactive, runtimeChatPending: true });
    const container = await mount();
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(api.getTwitchAccount).toHaveBeenCalledTimes(5);
    expect(container.textContent).not.toContain('● Activée');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('n’a pas pu être confirmée');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels pending polling on unmount', async () => {
    vi.useFakeTimers(); api.getTwitchAccount.mockResolvedValue({ ...inactive, runtimeChatPending: true });
    await mount(); act(() => roots.pop()!.unmount());
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(api.getTwitchAccount).toHaveBeenCalledOnce();
  });
  it('bounds the entire confirmation even when a status request stalls', async () => {
    vi.useFakeTimers();
    api.getTwitchAccount.mockResolvedValueOnce({ ...inactive, runtimeChatPending: true })
      .mockImplementationOnce((signal: AbortSignal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })));
    const container = await mount();
    await act(async () => vi.advanceTimersByTimeAsync(8_000));
    expect(api.getTwitchAccount).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain('● Activée');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('n’a pas pu être confirmé');
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['CONFLICT', 'UNAVAILABLE'])('preserves identity and displays %s in the existing error zone', async runtimeChatError => {
    api.getTwitchAccount.mockResolvedValue({ ...inactive, runtimeSubscriptionAvailable: false, runtimeChatError });
    const container = await mount();
    expect(container.textContent).toContain('Kichnifou · Connecté');
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Non activée');
  });
  it('reports runtime OAuth failure separately from identity-link failure', async () => {
    history.replaceState(null, '', '/?twitch=runtime-error'); api.getTwitchAccount.mockResolvedValue(inactive);
    const container = await mount();
    expect(location.search).not.toContain('twitch=');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('chat Twitch');
    expect(container.textContent).toContain('Kichnifou · Connecté');
  });
});


describe('independent Faveur subscription controls', () => {
  const inactive = { ...linkedAccount, runtimeSubscriptionAvailable: true, runtimeChatActive: false, favorSubscriptionAvailable: true, favorSubscriptionActive: false, favorSubscriptionPending: false };
  const block = (container: HTMLElement) => container.querySelector<HTMLElement>('.account-twitch-favor')!;
  it.each([{ ...inactive, linked: null }, { ...inactive, eligible: false }, { ...inactive, favorSubscriptionAvailable: false }])('hides Faveur outside its availability', async value => {
    api.getTwitchAccount.mockResolvedValue(value); expect((await mount()).querySelector('.account-twitch-favor')).toBeNull();
  });
  it.each([[false, false], [true, false], [false, true], [true, true]])('shows independent Chat=%s / Faveur=%s and keeps unlink after both', async (chat, favor) => {
    api.getTwitchAccount.mockResolvedValue({ ...inactive, runtimeChatActive: chat, favorSubscriptionActive: favor });
    const container = await mount(), favorBlock = block(container), chatBlock = container.querySelector('.account-twitch-runtime')!;
    expect(favorBlock.textContent).toContain(favor ? '● Activée' : 'Non activée');
    expect(chatBlock.textContent).toContain(chat ? '● Activée' : 'Non activée');
    expect(favorBlock.previousElementSibling).toBe(chatBlock); expect(favorBlock.nextElementSibling?.textContent).toBe('Délier Twitch');
    expect(container.textContent).toContain('Snapshot Streamer.bot'); expect(favorBlock.textContent).not.toMatch(/EventSub|webhook|scope|token/i);
  });
  it('starts only Faveur once and locks buttons while redirect is pending', async () => {
    api.getTwitchAccount.mockResolvedValue(inactive); let release!: (value: { url: string }) => void;
    api.startTwitchFavor.mockReturnValue(new Promise(resolve => { release = resolve; }));
    const navigate = vi.spyOn(location, 'assign').mockImplementation(() => undefined), container = await mount();
    act(() => { button(block(container), 'Autoriser et activer').click(); button(block(container), 'Autoriser et activer').click(); });
    expect(api.startTwitchFavor).toHaveBeenCalledOnce(); expect(api.startTwitchRuntime).not.toHaveBeenCalled(); expect(button(container, 'Délier Twitch').disabled).toBe(true);
    await act(async () => release({ url: 'https://id.twitch.tv/oauth2/authorize?state=private-favor' }));
    expect(navigate).toHaveBeenCalledWith('https://id.twitch.tv/oauth2/authorize?state=private-favor');
  });
  it.each(['https://evil.example/oauth2/authorize', 'javascript:alert(1)', 'https://id.twitch.tv/other', 'https://user:password@id.twitch.tv/oauth2/authorize', 'http://id.twitch.tv/oauth2/authorize'])('rejects Faveur redirect %s', async url => {
    api.getTwitchAccount.mockResolvedValue(inactive); api.startTwitchFavor.mockResolvedValue({ url });
    const navigate = vi.spyOn(location, 'assign').mockImplementation(() => undefined), container = await mount();
    await act(async () => button(block(container), 'Autoriser et activer').click()); expect(navigate).not.toHaveBeenCalled(); expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('disables Faveur only, reloads its proof and preserves Chat and snapshot', async () => {
    api.getTwitchAccount.mockResolvedValueOnce({ ...inactive, runtimeChatActive: true, favorSubscriptionActive: true }).mockResolvedValue({ ...inactive, runtimeChatActive: true });
    let finish!: () => void; api.disableTwitchFavor.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    const container = await mount(), disable = button(block(container), 'Désactiver'); act(() => { disable.click(); disable.click(); });
    expect(disable.disabled).toBe(true); expect(api.disableTwitchFavor).toHaveBeenCalledOnce(); expect(api.disableTwitchRuntime).not.toHaveBeenCalled();
    await act(async () => finish()); expect(block(container).textContent).toContain('Non activée'); expect(container.querySelector('.account-twitch-runtime')?.textContent).toContain('● Activée');
    expect(api.unlinkTwitch).not.toHaveBeenCalled(); expect(container.textContent).toContain('Snapshot Streamer.bot');
  });
  it('clears Faveur callback and shares bounded polling without confusing Chat activation', async () => {
    vi.useFakeTimers(); history.replaceState(null, '', '/?twitch=favor-runtime-activated#configuration');
    api.getTwitchAccount.mockResolvedValueOnce({ ...inactive, runtimeChatActive: true, favorSubscriptionPending: true }).mockResolvedValue({ ...inactive, runtimeChatActive: true, favorSubscriptionActive: true });
    const container = await mount(); expect(location.search).not.toContain('twitch='); expect(block(container).textContent).toContain('Vérification en cours'); expect(block(container).textContent).not.toContain('● Activée');
    expect(container.querySelector('.account-twitch-runtime')?.textContent).toContain('● Activée');
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(block(container).textContent).toContain('● Activée'); expect(container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(10000)); expect(api.getTwitchAccount).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0);
  });
  it('stops both pending checks after four shared retries and cleans timers', async () => {
    vi.useFakeTimers(); api.getTwitchAccount.mockResolvedValue({ ...inactive, runtimeChatPending: true, favorSubscriptionPending: true });
    const container = await mount(); await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(api.getTwitchAccount).toHaveBeenCalledTimes(5); expect(container.textContent).not.toContain('● Activée'); expect(container.querySelector('[role="alert"]')?.textContent).toContain('abonnements Twitch'); expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels Faveur polling on unmount', async () => {
    vi.useFakeTimers(); api.getTwitchAccount.mockResolvedValue({ ...inactive, favorSubscriptionPending: true });
    await mount(); act(() => roots.pop()!.unmount()); await act(async () => vi.advanceTimersByTimeAsync(10000)); expect(api.getTwitchAccount).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['CONFLICT', 'UNAVAILABLE'])('shows Faveur %s without confusing the identity link', async favorSubscriptionError => {
    api.getTwitchAccount.mockResolvedValue({ ...inactive, favorSubscriptionAvailable: false, favorSubscriptionError });
    const container = await mount(); expect(container.querySelector('[role="alert"]')?.textContent).toContain('abonnements Twitch'); expect(container.textContent).toContain('Connecté');
  });
  it('reports Faveur OAuth error separately and preserves other URL parameters', async () => {
    history.replaceState(null, '', '/?keep=1&twitch=favor-runtime-error#configuration'); api.getTwitchAccount.mockResolvedValue(inactive);
    const container = await mount(); expect(location.search).toBe('?keep=1'); expect(container.querySelector('[role="alert"]')?.textContent).toContain('abonnements Twitch'); expect(container.querySelector('[role="alert"]')?.textContent).not.toContain('liaison Twitch');
  });
});

it('disabling Chat preserves an active Faveur', async () => {
  const value={...linkedAccount,runtimeSubscriptionAvailable:true,runtimeChatActive:true,favorSubscriptionAvailable:true,favorSubscriptionActive:true};
  api.getTwitchAccount.mockResolvedValueOnce(value).mockResolvedValue({...value,runtimeChatActive:false}); api.disableTwitchRuntime.mockResolvedValue({});
  const container=await mount(); await act(async()=>button(container.querySelector<HTMLElement>('.account-twitch-runtime')!,'Désactiver').click());
  expect(container.querySelector('.account-twitch-favor')?.textContent).toContain('● Activée'); expect(api.disableTwitchFavor).not.toHaveBeenCalled();
});
it('bounds stalled Faveur confirmation and cleans the deadline', async () => {
  vi.useFakeTimers(); api.getTwitchAccount.mockResolvedValueOnce({...linkedAccount,favorSubscriptionAvailable:true,favorSubscriptionPending:true})
    .mockImplementationOnce((signal:AbortSignal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true})));
  const container=await mount(); await act(async()=>vi.advanceTimersByTimeAsync(8000));
  expect(api.getTwitchAccount).toHaveBeenCalledTimes(2); expect(container.querySelector('[role="alert"]')?.textContent).toContain('abonnements Twitch'); expect(vi.getTimerCount()).toBe(0);
});
