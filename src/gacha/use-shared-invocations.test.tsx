// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SharedInvocationApi, SharedInvocationState, SharedSession } from '../api/shared-invocations-types';
import { useSharedInvocations, type SharedInvocationController } from './use-shared-invocations';
const idle: SharedInvocationState = { broadcasting: null, watching: null };
const own = { id: 'owned', seq: 1, authoritative: true, status: 'ACTIVE', reactions: [], expiresAt: '2026-10-11T23:00:00Z', snapshot: { displayName: 'Synthetic owner' } } as unknown as SharedSession;
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => {
        resolve = r;
    });
    return { promise, resolve };
}
function api(): SharedInvocationApi {
    return { state: vi.fn(async () => idle), list: vi.fn(async () => ({ sessions: [] })), start: vi.fn(async () => ({ broadcasting: own, watching: null })), watch: vi.fn(async () => idle), control: vi.fn(async () => idle), react: vi.fn(async () => idle), resume: vi.fn(async () => idle) };
}
let current!: SharedInvocationController;
const roots: ReturnType<typeof createRoot>[] = [];
function Harness({ transport, visible = true, owner = 'first', refresh }: {
    transport?: SharedInvocationApi;
    visible?: boolean;
    owner?: string;
    refresh?:()=>Promise<void>;
}) {
    current = useSharedInvocations(transport, visible, refresh, owner);
    return <span>{current.state.broadcasting?.id ?? current.state.watching?.id ?? 'idle'}</span>;
}
function mount(transport: SharedInvocationApi) {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    act(() => root.render(<Harness transport={transport}/>));
    return { host, root };
}
async function flush() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}
beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('BroadcastChannel', undefined);
    (globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
    act(() => roots.splice(0).forEach(r => r.unmount()));
    document.body.replaceChildren();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});
it('ignores a slow old null poll after a successful start', async () => {
    const transport = api(), old = deferred<SharedInvocationState>();
    vi.mocked(transport.state).mockReturnValueOnce(old.promise);
    mount(transport);
    await flush();
    await act(async () => {
        await current.start();
    });
    expect(current.state.broadcasting?.id).toBe('owned');
    await act(async () => old.resolve(idle));
    expect(current.state.broadcasting?.id).toBe('owned');
});
it('ignores out-of-order sync null responses even when session sequence cannot compare them', async () => {
    const transport = api();
    mount(transport);
    await flush();
    const first = deferred<SharedInvocationState>(), second = deferred<SharedInvocationState>();
    vi.mocked(transport.state).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    let a!: Promise<void>, b!: Promise<void>;
    act(() => {
        a = current.sync();
        b = current.sync();
    });
    await act(async () => {
        second.resolve({ broadcasting: own, watching: null });
        await b;
    });
    await act(async () => {
        first.resolve(idle);
        await a;
    });
    expect(current.state.broadcasting?.id).toBe('owned');
});
it('ignores old screen-presence responses after stop', async () => {
    const transport = api(), { root } = mount(transport);
    await flush();
    await act(async () => {
        await current.start();
    });
    const presence = deferred<SharedInvocationState>();
    vi.mocked(transport.control).mockImplementationOnce(() => presence.promise);
    act(() => root.render(<Harness transport={transport} visible={false}/>));
    await act(async () => {
        await current.stop();
    });
    await act(async () => presence.resolve({ broadcasting: { ...own, status: 'PAUSED', seq: 2 }, watching: null }));
    expect(current.state.broadcasting).toBeNull();
});
it('discards an old identity mutation and releases its pending lock for the new identity', async () => {
    const first = api(), second = api(), start = deferred<SharedInvocationState>();
    vi.mocked(first.start).mockReturnValue(start.promise);
    const { root } = mount(first);
    await flush();
    let pending!: Promise<boolean>;
    act(() => {
        pending = current.start();
    });
    expect(current.pending).toBe(true);
    act(() => root.render(<Harness transport={second}/>));
    await flush();
    expect(current.pending).toBe(false);
    expect(current.state.broadcasting).toBeNull();
    await act(async () => {
        start.resolve({ broadcasting: own, watching: null });
        await pending;
    });
    expect(current.state.broadcasting).toBeNull();
    await act(async () => {
        await current.start();
    });
    expect(second.start).toHaveBeenCalledOnce();
    expect(current.state.broadcasting?.id).toBe('owned');
});
it('ignores a read resolved after transport disconnection and after unmount', async () => {
    const transport = api(), read = deferred<SharedInvocationState>();
    vi.mocked(transport.state).mockReturnValue(read.promise);
    const { root, host } = mount(transport);
    await flush();
    act(() => root.render(<Harness />));
    await act(async () => read.resolve({ broadcasting: own, watching: null }));
    expect(host.textContent).toBe('idle');
    act(() => root.unmount());
    roots.splice(roots.indexOf(root), 1);
    expect(current.state.broadcasting).toBeNull();
});
it('fences identity changes even when the API singleton remains the same', async () => {
    const transport = api(), old = deferred<SharedInvocationState>();
    vi.mocked(transport.state).mockReturnValueOnce(old.promise);
    const { root } = mount(transport);
    await flush();
    act(() => root.render(<Harness transport={transport} owner="second"/>));
    await flush();
    await act(async () => old.resolve({ broadcasting: own, watching: null }));
    expect(current.state.broadcasting).toBeNull();
    await act(async () => {
        await current.start();
    });
    expect(current.state.broadcasting?.id).toBe('owned');
});

it('keeps personal invocation controls unavailable until the exit refresh succeeds, with retry after failure',async()=>{
 const transport=api(),read=deferred<void>(),refresh=vi.fn(()=>read.promise),{root}=mount(transport);await flush();act(()=>root.render(<Harness transport={transport} refresh={refresh}/>));
 act(()=>current.apply({broadcasting:null,watching:{...own,authoritative:false}}));await act(async()=>{await current.watch(null)});expect(current.personalReady).toBe(false);expect(refresh).toHaveBeenCalledOnce()
 await act(async()=>{read.resolve();await read.promise});expect(current.personalReady).toBe(true)
 refresh.mockRejectedValueOnce(new Error('Refresh unavailable'));await act(async()=>{await current.refreshPersonal()});expect(current.personalReady).toBe(false)
 refresh.mockResolvedValueOnce();await act(async()=>{await current.refreshPersonal()});expect(current.personalReady).toBe(true)
})

it('waits for a fresh personal banner before applying the broadcaster close response', async () => {
    const transport = api(), read = deferred<void>(), refresh = vi.fn(() => read.promise), { root } = mount(transport);
    await flush();
    act(() => root.render(<Harness transport={transport} refresh={refresh}/>));
    await act(async () => { await current.start(); });
    let closing!: Promise<boolean>;
    act(() => { closing = current.advance('close'); });
    await flush();
    expect(refresh).toHaveBeenCalledOnce();
    expect(current.personalReady).toBe(false);
    expect(current.pending).toBe(true);
    expect(current.state.broadcasting?.id).toBe('owned');
    await act(async () => { read.resolve(); await closing; });
    expect(current.personalReady).toBe(true);
    expect(current.pending).toBe(false);
    expect(current.state.broadcasting).toBeNull();
});

it('keeps personal controls fenced when a broadcaster close refresh fails', async () => {
    const transport = api(), refresh = vi.fn(async () => { throw Error('Current banner unavailable'); }), { root } = mount(transport);
    await flush();
    act(() => root.render(<Harness transport={transport} refresh={refresh}/>));
    await act(async () => { await current.start(); await current.advance('close'); });
    expect(current.personalReady).toBe(false);
    expect(current.error).toBeTruthy();
    expect(current.pending).toBe(false);
});
