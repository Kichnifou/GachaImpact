// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ElementChoiceScreen from '../components/ElementChoiceScreen'

const api = vi.hoisted(() => ({
  startTwitchGiftSupreme: vi.fn(), ensureTwitchGiftSupreme: vi.fn(), disableTwitchGiftSupreme: vi.fn(),
  startTwitchProfileRecovery: vi.fn(), armTwitchCommandPilot: vi.fn(), disarmTwitchCommandPilot: vi.fn(),
  getTwitchLinkResolution: vi.fn().mockResolvedValue(null), resolveTwitchLink: vi.fn(), getTwitchAccount: vi.fn(), startTwitchLink: vi.fn(), startTwitchFavor: vi.fn(), disableTwitchFavor: vi.fn(), startTwitchRuntime: vi.fn(), disableTwitchRuntime: vi.fn(), unlinkTwitch: vi.fn(), previewTwitchSnapshot: vi.fn(), applyTwitchSnapshot: vi.fn(),
}))
vi.mock('../api/game-api', () => ({ getGameApiClient: () => api }))
import AccountSettingsPanel from './AccountSettingsPanel'

const roots: ReturnType<typeof createRoot>[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren(); vi.clearAllMocks(); api.getTwitchLinkResolution.mockReset().mockResolvedValue(null); vi.restoreAllMocks(); vi.useRealTimers(); history.replaceState(null, '', '/') })
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
  it('opens recovery before element choice and restores focus on Escape', async () => {
    api.getTwitchAccount.mockResolvedValue({ ...linkedAccount, eligible: false, linked: null, profileRecoveryAvailable: true });
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container); roots.push(root);
    const choose = vi.fn();
    await act(async () => root.render(<ElementChoiceScreen onChoose={choose} onRefreshPlayerState={vi.fn()} />));
    const opener = button(container, 'Configuration › Compte'); opener.focus();
    await act(async () => opener.click());
    expect(button(container.querySelector('[role="dialog"]')!, 'Lier mon compte Twitch')).toBeDefined();
    expect(choose).not.toHaveBeenCalled();
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
  it('offers explicit recovery to non-pilot accounts without silently linking or merging', async () => {
    api.getTwitchAccount.mockResolvedValue({ ...linkedAccount, eligible: false, linked: null, profileRecoveryAvailable: true });
    const container = await mount();
    expect(button(container, 'Lier mon compte Twitch').disabled).toBe(false);
    expect(api.startTwitchProfileRecovery).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Récupérer mon profil Twitch');
  });
  it('reloads the entire authoritative Player after recovery without a logout', async () => {
    api.getTwitchAccount.mockResolvedValue(linkedAccount);
    history.replaceState(null, '', '/?twitch=profile-recovered');
    const refresh = vi.fn().mockResolvedValue(undefined);
    const container = await mount(refresh);
    expect(refresh).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(location.search).not.toContain('twitch=');
  });
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
    expect(Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Lier mon compte Twitch')?.disabled).toBe(true)
    expect(container.textContent).toContain('indisponible')
  })
  it('shows one linked progression without self-service unlink', async () => {
    api.getTwitchAccount.mockResolvedValue(linkedAccount)
    const container = await mount()
    expect(container.textContent).toContain('Kichnifou · Connecté')
    expect(container.textContent).toContain('même progression')
    expect(container.textContent).not.toContain('Un changement de pseudo Twitch conserve cette liaison.')
    expect(button(container, 'Délier Twitch')).toBeUndefined()
    expect(button(container, 'Lier mon compte Twitch')).toBeUndefined()
    expect(api.unlinkTwitch).not.toHaveBeenCalled()
  })

  it('shows an OAuth callback error and clears the query marker', async () => {
    api.getTwitchAccount.mockResolvedValue(linkedAccount)
    history.replaceState(null, '', '/?twitch=TWITCH_IDENTITY_CONFLICT')
    const container = await mount()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('identité web')
    expect(location.search).not.toContain('twitch=')
  })
  it('also hides unlink for an ordinary linked Player', async () => {
    api.getTwitchAccount.mockResolvedValue({ ...linkedAccount, eligible: false, snapshotAvailable: false })
    const container = await mount()
    expect(button(container, 'Délier Twitch')).toBeUndefined()
    expect(api.unlinkTwitch).not.toHaveBeenCalled()
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
    expect(button(container, 'Délier Twitch')).toBeUndefined();
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
    expect(favorBlock.previousElementSibling).toBe(chatBlock); expect(button(container, 'Délier Twitch')).toBeUndefined();
    expect(container.textContent).toContain('Snapshot Streamer.bot'); expect(favorBlock.textContent).not.toMatch(/EventSub|webhook|scope|token/i);
  });
  it('starts only Faveur once and locks buttons while redirect is pending', async () => {
    api.getTwitchAccount.mockResolvedValue(inactive); let release!: (value: { url: string }) => void;
    api.startTwitchFavor.mockReturnValue(new Promise(resolve => { release = resolve; }));
    const navigate = vi.spyOn(location, 'assign').mockImplementation(() => undefined), container = await mount();
    act(() => { button(block(container), 'Autoriser et activer').click(); button(block(container), 'Autoriser et activer').click(); });
    expect(api.startTwitchFavor).toHaveBeenCalledOnce(); expect(api.startTwitchRuntime).not.toHaveBeenCalled(); expect(button(container, 'Délier Twitch')).toBeUndefined();
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


describe('Gift Suprême account controls', () => {
  const giftAccount = { ...linkedAccount, giftSupremeAvailable: true, giftSupremeAuthorized: false, giftSupremeActive: false, giftSupremePending: false };
  it('rereads partial disable, displays a retryable error, and retries disable without ensure or OAuth', async () => {
    api.getTwitchAccount.mockResolvedValueOnce({ ...giftAccount, giftSupremeAuthorized: true, giftSupremeActive: true })
      .mockResolvedValueOnce({ ...giftAccount, giftSupremeAuthorized: true, giftSupremeDisabling: true }).mockResolvedValueOnce(giftAccount);
    api.disableTwitchGiftSupreme.mockRejectedValueOnce(Object.assign(Error('private upstream input'), { code: 'TWITCH_GIFT_PENDING_REDEMPTIONS' })).mockResolvedValueOnce({ giftSupremeActive: false });
    const container = await mount(); await act(async () => button(container, 'Désactiver').click());
    expect(container.textContent).toContain('Désactivation en cours'); expect(container.textContent).not.toContain('● Activé');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('encore en cours de traitement'); expect(container.textContent).not.toContain('private upstream input');
    await act(async () => button(container, 'Réessayer la désactivation').click());
    expect(api.disableTwitchGiftSupreme).toHaveBeenCalledTimes(2); expect(api.ensureTwitchGiftSupreme).not.toHaveBeenCalled(); expect(api.startTwitchGiftSupreme).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Non activé'); expect(container.querySelector('[role="alert"]')).toBeNull();
  });
  it('reactivates a partial disable only through an explicit owner action', async () => {
    api.getTwitchAccount.mockResolvedValueOnce({ ...giftAccount, giftSupremeAuthorized: true, giftSupremeDisabling: true })
      .mockResolvedValueOnce({ ...giftAccount, giftSupremeAuthorized: true, giftSupremeActive: true }); api.ensureTwitchGiftSupreme.mockResolvedValue({ giftSupremeActive: true });
    const container = await mount(); expect(api.ensureTwitchGiftSupreme).not.toHaveBeenCalled();
    await act(async () => button(container, 'Réactiver').click()); expect(api.ensureTwitchGiftSupreme).toHaveBeenCalledOnce(); expect(container.textContent).toContain('● Activé');
  });
  it('keeps Gift controls without exposing identity unlink', async () => {
    api.getTwitchAccount.mockResolvedValue({ ...giftAccount, giftSupremeAuthorized: true, giftSupremeActive: true })
    const container = await mount()
    expect(button(container, 'Délier Twitch')).toBeUndefined()
    expect(button(container, 'Désactiver')).toBeDefined()
    expect(api.unlinkTwitch).not.toHaveBeenCalled()
  });

  it('preserves the pending cleanup error if its authoritative status refresh fails', async () => {
    api.getTwitchAccount.mockResolvedValueOnce({ ...giftAccount, giftSupremeAuthorized: true, giftSupremeActive: true }).mockRejectedValueOnce(Error('read failed'));
    api.disableTwitchGiftSupreme.mockRejectedValueOnce(Object.assign(Error('pending'), { code: 'TWITCH_GIFT_PENDING_REDEMPTIONS' }));
    const container = await mount(); await act(async () => button(container, 'Désactiver').click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('encore en cours de traitement'); expect(api.ensureTwitchGiftSupreme).not.toHaveBeenCalled();
  });
  it.each([{ eligible: false }, { linked: null }, { giftSupremeAvailable: false }])('hides Gift outside eligible linked available pilots', async flags => {
    api.getTwitchAccount.mockResolvedValue({ ...giftAccount, ...flags }); expect((await mount()).textContent).not.toContain('Gift Suprême Twitch');
  });
  it('shows inactive Gift and refuses an untrusted OAuth URL without redirect', async () => {
    api.getTwitchAccount.mockResolvedValue(giftAccount); api.startTwitchGiftSupreme.mockResolvedValue({ url: 'https://evil.example/oauth2/authorize' });
    const container = await mount(); expect(container.textContent).toContain('gérer automatiquement'); await act(async () => button(container, 'Autoriser et activer').click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Une erreur inattendue'); expect(api.startTwitchFavor).not.toHaveBeenCalled();
  });
  it('validates a trusted OAuth URL before redirect', async () => {
    api.getTwitchAccount.mockResolvedValue(giftAccount); api.startTwitchGiftSupreme.mockResolvedValue({ url: 'https://id.twitch.tv/oauth2/authorize?state=gift_test' });
    const redirect = vi.spyOn(location, 'assign').mockImplementation(() => undefined); const container = await mount();
    await act(async () => button(container, 'Autoriser et activer').click()); expect(redirect).toHaveBeenCalledWith('https://id.twitch.tv/oauth2/authorize?state=gift_test');
  });
  it('clears activated OAuth return and disables Gift then rereads authoritative status', async () => {
    history.replaceState(null, '', '/?twitch=gift-supreme-activated');
    api.getTwitchAccount.mockResolvedValueOnce({ ...giftAccount, giftSupremeAuthorized: true, giftSupremeActive: true }).mockResolvedValueOnce(giftAccount);
    api.disableTwitchGiftSupreme.mockResolvedValue({ giftSupremeActive: false }); const container = await mount(); expect(container.textContent).toContain('● Activé'); expect(location.search).toBe('');
    await act(async () => button(container, 'Désactiver').click()); expect(api.disableTwitchGiftSupreme).toHaveBeenCalledOnce(); expect(container.textContent).toContain('Non activé'); expect(api.disableTwitchFavor).not.toHaveBeenCalled();
  });
  it('shows a dedicated OAuth failure and clears its outcome', async () => {
    history.replaceState(null, '', '/?twitch=gift-supreme-error'); api.getTwitchAccount.mockResolvedValue(giftAccount); const container = await mount();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Gift Suprême'); expect(location.search).toBe('');
  });
  it('reports old manual reward conflict and retries ensure without another authorization', async () => {
    api.getTwitchAccount.mockResolvedValueOnce({ ...giftAccount, giftSupremeAuthorized: true, giftSupremeError: 'MANUAL_REWARD_CONFLICT' }).mockResolvedValueOnce({ ...giftAccount, giftSupremeAuthorized: true, giftSupremeActive: true });
    api.ensureTwitchGiftSupreme.mockResolvedValue({ giftSupremeActive: true }); const container = await mount(); expect(container.querySelector('[role="alert"]')?.textContent).toContain('ancienne récompense');
    await act(async () => button(container, 'Réessayer').click()); expect(api.ensureTwitchGiftSupreme).toHaveBeenCalledOnce(); expect(api.startTwitchGiftSupreme).not.toHaveBeenCalled(); expect(container.textContent).toContain('● Activé');
  });
  it('keeps active on failed disable and pending never pretends active, polling stays bounded', async () => {
    api.getTwitchAccount.mockResolvedValue({ ...giftAccount, giftSupremeAuthorized: true, giftSupremeActive: true }); api.disableTwitchGiftSupreme.mockRejectedValue(Error('remote cleanup failed'));
    const container = await mount(); await act(async () => button(container, 'Désactiver').click()); expect(container.textContent).toContain('● Activé');
  });
  it('polls pending at most four times and never shows active without remote proof', async () => {
    vi.useFakeTimers(); api.getTwitchAccount.mockResolvedValue({ ...giftAccount, giftSupremeAuthorized: true, giftSupremePending: true });
    const container = await mount(); expect(container.textContent).toContain('Vérification en cours'); expect(container.textContent).not.toContain('● Activé');
    for (let i = 0; i < 4; i++) await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(api.getTwitchAccount).toHaveBeenCalledTimes(5); expect(container.querySelector('[role="alert"]')?.textContent).toContain('Gift Suprême n’a pas pu être confirmée');
  });
});

const commandAccount = { ...linkedAccount, commandPilotAvailable: true, commandPilotCapabilityEnabled: true, commandPilotArmed: false, commandPilotEnabled: false, runtimeChatActive: true }
describe('explicit Twitch command pilot controls', () => {
  const armLabel = 'Activer le pilote commandes'
  const disarmLabel = 'D\u00e9sactiver le pilote commandes'
  it.each([{}, { commandPilotCapabilityEnabled: false }, { eligible: false, commandPilotCapabilityEnabled: true, commandPilotAvailable: true }])('hides unavailable controls: %j', async flags => {
    api.getTwitchAccount.mockResolvedValue({ ...linkedAccount, ...flags })
    const container = await mount()
    expect(container.textContent).not.toContain('Pilote commandes Twitch')
    expect(api.armTwitchCommandPilot).not.toHaveBeenCalled()
  })
  it.each([{ runtimeChatActive: false }, { runtimeChatActive: false, runtimeChatPending: true, runtimeSubscriptionAvailable: true }])('requires active chat: %j', async flags => {
    api.getTwitchAccount.mockResolvedValue({ ...commandAccount, ...flags })
    const container = await mount()
    expect(container.textContent).toContain('Pr\u00e9paration requise')
    expect(button(container, armLabel).disabled).toBe(true)
    expect(api.armTwitchCommandPilot).not.toHaveBeenCalled()
  })
  it('arms once, locks unlink and refreshes authoritative status without OAuth', async () => {
    api.getTwitchAccount.mockResolvedValueOnce(commandAccount).mockResolvedValue({ ...commandAccount, commandPilotArmed: true, commandPilotEnabled: true })
    let release!: () => void
    api.armTwitchCommandPilot.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve }))
    const container = await mount()
    expect(container.textContent).toContain('Non activ\u00e9')
    await act(async () => container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
    await act(async () => { button(container, armLabel).click(); button(container, armLabel).click() })
    expect(api.armTwitchCommandPilot).toHaveBeenCalledExactlyOnceWith('STREAMERBOT_PATH_DISABLED')
    expect(button(container, 'Délier Twitch')).toBeUndefined()
    await act(async () => release())
    expect(api.getTwitchAccount).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('\u25cf Activ\u00e9')
    expect(button(container, disarmLabel).disabled).toBe(false)
    expect(api.startTwitchRuntime).not.toHaveBeenCalled()
    expect(api.startTwitchLink).not.toHaveBeenCalled()
  })
  it.each([{}, { runtimeChatActive: false, runtimeChatError: 'UNAVAILABLE' }, { linked: null, commandPilotCapabilityEnabled: false }])('disarms explicitly despite degraded status: %j', async flags => {
    api.getTwitchAccount.mockResolvedValueOnce({ ...commandAccount, commandPilotArmed: true, commandPilotEnabled: true, ...flags }).mockResolvedValue(commandAccount)
    let release!: () => void
    api.disarmTwitchCommandPilot.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve }))
    const container = await mount()
    await act(async () => { button(container, disarmLabel).click(); button(container, disarmLabel).click() })
    expect(api.disarmTwitchCommandPilot).toHaveBeenCalledExactlyOnceWith()
    await act(async () => release())
    expect(container.textContent).toContain('Non activ\u00e9')
    expect(api.getTwitchAccount).toHaveBeenCalledTimes(2)
  })
  it('does not arm after OAuth, polling or a fresh mount', async () => {
    vi.useFakeTimers()
    history.replaceState(null, '', '/?twitch=runtime-activated')
    api.getTwitchAccount.mockResolvedValueOnce({ ...commandAccount, runtimeChatActive: false, runtimeChatPending: true, runtimeSubscriptionAvailable: true }).mockResolvedValue(commandAccount)
    const container = await mount()
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(button(container, armLabel).disabled).toBe(true)
    await mount()
    expect(api.armTwitchCommandPilot).not.toHaveBeenCalled()
    expect(api.disarmTwitchCommandPilot).not.toHaveBeenCalled()
  })
  it('keeps disarm available during polling and ignores its stale result', async () => {
    vi.useFakeTimers()
    const armed = { ...commandAccount, commandPilotArmed: true, commandPilotEnabled: false, runtimeChatActive: false, runtimeChatPending: true, runtimeSubscriptionAvailable: true }
    let release!: (value: typeof armed) => void
    api.getTwitchAccount.mockResolvedValueOnce(armed).mockImplementationOnce(() => new Promise(resolve => { release = resolve })).mockResolvedValue(commandAccount)
    api.disarmTwitchCommandPilot.mockResolvedValue({})
    const container = await mount()
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(button(container, disarmLabel).disabled).toBe(false)
    await act(async () => button(container, disarmLabel).click())
    await act(async () => release(armed))
    expect(container.textContent).toContain('Non activ\u00e9')
    expect(button(container, disarmLabel)).toBeUndefined()
    expect(api.disarmTwitchCommandPilot).toHaveBeenCalledExactlyOnceWith()
  })
  it.each([
    ['TWITCH_COMMAND_PILOT_OFF', 'Le pilote de commandes Twitch n\u2019est pas disponible sur ce serveur.'],
    ['TWITCH_COMMAND_SUBSCRIPTION_INACTIVE', 'La r\u00e9ception du chat Twitch doit \u00eatre active avant d\u2019activer le pilote.'],
    ['TWITCH_COMMAND_TRANSPORT_UNAVAILABLE', 'La r\u00e9ception du chat Twitch est temporairement indisponible.'],
  ])('sanitizes %s without altering other controls', async (code, message) => {
    api.getTwitchAccount.mockResolvedValue({ ...commandAccount, favorSubscriptionAvailable: true, giftSupremeAvailable: true })
    api.armTwitchCommandPilot.mockRejectedValueOnce({ code, message: 'private upstream details' })
    const container = await mount()
    await act(async () => container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
    await act(async () => button(container, armLabel).click())
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(message)
    expect(container.textContent).not.toContain('private upstream details')
    expect(container.textContent).toContain('Faveur')
    expect(container.textContent).toContain('Gift Supr\u00eame')
    expect(api.startTwitchFavor).not.toHaveBeenCalled()
    expect(api.startTwitchGiftSupreme).not.toHaveBeenCalled()
  })
})

const safeChoices = { WEB: { status: 'SAFE', reason: null }, TWITCH: { status: 'SAFE', reason: null } } as const
const conflictRevision = '22222222-2222-4222-8222-222222222222'
const conflictSummary = { displayName: 'Private profile', level: 2, totalXp: '60', elementKey: null, resources: { primogems: '777', moras: '1000' }, characters: 3, totalMessages: '55', recentActivityAt: null }
it.each(['WEB','TWITCH','BOTH'] as const)('disables only unsafe %s choices and shows a private-data-free reason',async blocked=>{
  const safety={...safeChoices};
  const unsafe={status:'OPERATOR_REQUIRED',reason:'TWITCH_PROGRESSION_SHARED_STATE_REQUIRES_OPERATOR'} as const;
  const resolution={id:'unsafe',revision:conflictRevision,expiresAt:'2099-01-01T00:00:00Z',web:conflictSummary,twitch:conflictSummary,
    safety:{WEB:blocked==='TWITCH'?safety.WEB:unsafe,TWITCH:blocked==='WEB'?safety.TWITCH:unsafe}};
  api.getTwitchAccount.mockResolvedValue({...linkedAccount,linked:null,eligible:false});api.getTwitchLinkResolution.mockResolvedValueOnce(resolution);
  const container=await mount();const checkbox=container.querySelector<HTMLInputElement>('.twitch-progression-ack input')!;
  if(blocked==='BOTH') {expect(checkbox.disabled).toBe(true);expect(container.textContent).toContain('Ces deux progressions possèdent des données partagées. Une résolution opérateur est nécessaire.');}
  else await act(async()=>checkbox.click());
  expect(button(container,'Conserver ma progression de l’application Web').disabled).toBe(blocked!=='TWITCH');
  expect(button(container,'Utiliser ma progression Twitch').disabled).toBe(blocked!=='WEB');
  expect(container.textContent).toContain('relations partagées qui nécessitent une résolution opérateur');
  expect(api.resolveTwitchLink).not.toHaveBeenCalled();
});
it('clears acknowledgement when a new server revision has an identical visible summary',async()=>{
  const resolution={id:'invisible',revision:conflictRevision,safety:safeChoices,expiresAt:'2099-01-01T00:00:00Z',web:conflictSummary,twitch:conflictSummary};
  const fresh={...resolution,revision:'33333333-3333-4333-8333-333333333333'};
  api.getTwitchAccount.mockResolvedValue({...linkedAccount,linked:null,eligible:false});api.getTwitchLinkResolution.mockResolvedValueOnce(resolution);
  api.resolveTwitchLink.mockResolvedValueOnce({linked:false,resolutionRequired:true,resolution:fresh}).mockResolvedValueOnce({linked:true,resolutionRequired:false});
  const refresh=vi.fn(),container=await mount(refresh);
  await act(async()=>container.querySelector<HTMLInputElement>('.twitch-progression-ack input')!.click());
  await act(async()=>button(container,'Utiliser ma progression Twitch').click());
  expect(api.resolveTwitchLink).toHaveBeenLastCalledWith(resolution.id,'TWITCH',resolution.revision);
  expect(container.querySelector<HTMLInputElement>('.twitch-progression-ack input')!.checked).toBe(false);
  expect(button(container,'Utiliser ma progression Twitch').disabled).toBe(true);expect(refresh).not.toHaveBeenCalled();
  await act(async()=>container.querySelector<HTMLInputElement>('.twitch-progression-ack input')!.click());
  await act(async()=>button(container,'Utiliser ma progression Twitch').click());
  expect(api.resolveTwitchLink).toHaveBeenLastCalledWith(fresh.id,'TWITCH',fresh.revision);expect(refresh).toHaveBeenCalledOnce();
});
it.each(['WEB','TWITCH'] as const)('presents a verified comparison and confirms the final %s progression without unlink', async choice => {
  const resolution = { id: 'private-resolution', revision: conflictRevision, safety: safeChoices, expiresAt: '2099-01-01T00:00:00Z', web: { ...conflictSummary, level: 3, resources: { primogems: '100', moras: '50' } }, twitch: conflictSummary }
  api.getTwitchAccount.mockResolvedValueOnce({ ...linkedAccount, eligible: false, linked: null }).mockResolvedValueOnce(linkedAccount)
  api.getTwitchLinkResolution.mockResolvedValueOnce(resolution)
  api.resolveTwitchLink.mockResolvedValueOnce({ linked: true, resolutionRequired: false })
  const refresh = vi.fn(async () => undefined), container = await mount(refresh)
  expect(container.textContent).toContain('Choisis la progression à conserver')
  expect(container.textContent).toContain('Ce choix est définitif')
  expect(container.textContent).not.toContain('Standalone')
  const label = choice === 'WEB' ? 'Conserver ma progression de l’application Web' : 'Utiliser ma progression Twitch'
  expect(button(container,label).disabled).toBe(true)
  const checkbox = container.querySelector<HTMLInputElement>('.twitch-progression-ack input')!
  await act(async () => checkbox.click())
  await act(async () => button(container,label).click())
  expect(api.resolveTwitchLink).toHaveBeenCalledExactlyOnceWith(resolution.id, choice, resolution.revision)
  expect(refresh).toHaveBeenCalledOnce()
  expect(container.textContent).not.toContain('Choisis la progression à conserver')
  expect(button(container,'Délier Twitch')).toBeUndefined()
})
it('offers account access and sign-out before choosing an element, without showing account actions to visitors', async () => {
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
  const logout = vi.fn(async () => undefined), choose = vi.fn()
  await act(async () => root.render(<ElementChoiceScreen onChoose={choose} onRefreshPlayerState={vi.fn()} onSignOut={logout} />))
  expect(button(container,'Configuration › Compte')).toBeDefined()
  await act(async () => button(container,'Déconnexion').click())
  expect(logout).toHaveBeenCalledOnce(); expect(choose).not.toHaveBeenCalled()
  await act(async () => root.render(<ElementChoiceScreen onChoose={choose} />))
  expect(button(container,'Déconnexion')).toBeUndefined()
  expect(button(container,'Configuration › Compte')).toBeUndefined()
})

it('offers a new link after an expired verified choice without switching any Player', async () => {
  api.getTwitchAccount.mockResolvedValue({...linkedAccount,linked:null,eligible:false,identityLinkAvailable:true});
  api.getTwitchLinkResolution.mockResolvedValueOnce({id:'expired',revision:conflictRevision,safety:safeChoices,expiresAt:'2026-01-01T00:00:00Z',web:conflictSummary,twitch:conflictSummary});
  api.resolveTwitchLink.mockRejectedValueOnce({code:'TWITCH_RESOLUTION_EXPIRED',message:'Expired'});
  const refresh=vi.fn(),container=await mount(refresh);
  await act(async()=>container.querySelector<HTMLInputElement>('.twitch-progression-ack input')!.click());
  await act(async()=>button(container,'Utiliser ma progression Twitch').click());
  expect(button(container,'Lier mon compte Twitch')).toBeDefined();expect(refresh).not.toHaveBeenCalled();
  expect(container.querySelector('[role=alert]')?.textContent).toContain('expiré');
});
