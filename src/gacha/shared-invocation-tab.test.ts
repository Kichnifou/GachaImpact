// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    sessionStorage.clear();
});
it('assigns a fresh authority when BroadcastChannel cannot detect cloned storage and initializes only once', async () => {
    vi.resetModules();
    vi.stubGlobal('BroadcastChannel', undefined);
    sessionStorage.setItem('gachaimpact.shared-invocation-tab', 'cloned-page');
    const tab = await import('./shared-invocation-tab');
    const first = tab.establishSharedInvocationTab();
    expect(tab.establishSharedInvocationTab()).toBe(first);
    expect(await first).not.toBe('cloned-page');
    expect(tab.sharedInvocationTabId()).toBe(await first);
});
it('keeps its coordination channel across BFCache entry and closes it for a final page exit', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const close = vi.fn(), construct = vi.fn();
    class Channel {
        onmessage = null;
        constructor() {
            construct();
        }
        postMessage() {
        }
        close = close;
    }
    vi.stubGlobal('BroadcastChannel', Channel);
    const tab = await import('./shared-invocation-tab'), pending = tab.establishSharedInvocationTab();
    tab.establishSharedInvocationTab();
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(construct).toHaveBeenCalledOnce();
    const cached = new Event('pagehide');
    Object.defineProperty(cached, 'persisted', { value: true });
    window.dispatchEvent(cached);
    expect(close).not.toHaveBeenCalled();
    const exit = new Event('pagehide');
    Object.defineProperty(exit, 'persisted', { value: false });
    window.dispatchEvent(exit);
    expect(close).toHaveBeenCalledOnce();
});
it('keeps presence revisions strictly increasing through reload and equal browser timestamps', async () => {
    vi.resetModules();
    vi.spyOn(Date, 'now').mockReturnValue(100);
    let tab = await import('./shared-invocation-tab');
    expect(tab.nextSharedPresenceRevision()).toBe(100);
    expect(tab.nextSharedPresenceRevision()).toBe(101);
    vi.resetModules();
    tab = await import('./shared-invocation-tab');
    expect(tab.nextSharedPresenceRevision()).toBe(102);
    vi.restoreAllMocks();
});
