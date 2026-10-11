const key = 'gachaimpact.shared-invocation-tab';
let tabId: string | undefined;
let establishment: Promise<string> | undefined;
export function establishedSharedInvocationTabId() {
    return tabId;
}
/** Per-tab identity survives F5. A live original tab rejects a cloned sessionStorage identity. */
export function sharedInvocationTabId() {
    if (tabId)
        return tabId;
    tabId = sessionStorage.getItem(key) ?? crypto.randomUUID();
    sessionStorage.setItem(key, tabId);
    return tabId;
}
export function establishSharedInvocationTab(): Promise<string> {
    if (establishment)
        return establishment;
    sharedInvocationTabId();
    if (typeof BroadcastChannel === 'undefined') {
        // Without clone detection, prefer a fresh page authority; F5 waits for the old 60s lease.
        tabId = crypto.randomUUID();
        sessionStorage.setItem(key, tabId);
        return establishment = Promise.resolve(tabId);
    }
    const channel = new BroadcastChannel('gachaimpact.shared-invocation-authority');
    const instance = crypto.randomUUID();
    return establishment = new Promise(resolve => {
        let resolved = false;
        channel.onmessage = event => {
            const message = event.data as {
                type?: string;
                tabId?: string;
                instance?: string;
            };
            if (message.tabId !== tabId || message.instance === instance)
                return;
            if (message.type === 'probe' && (resolved || instance < message.instance!))
                channel.postMessage({ type: 'occupied', tabId, instance });
            if (message.type === 'occupied' && !resolved) {
                tabId = crypto.randomUUID();
                sessionStorage.setItem(key, tabId);
            }
        };
        channel.postMessage({ type: 'probe', tabId, instance });
        setTimeout(() => {
            resolved = true;
            resolve(tabId!);
        }, 100);
        window.addEventListener('pagehide', event => {
            if (!event.persisted)
                channel.close();
        });
    });
}
export function nextSharedPresenceRevision() {
    const key = 'gachaimpact.shared-presence-revision';
    const next = Math.max(Date.now(), Number(sessionStorage.getItem(key) ?? 0) + 1);
    sessionStorage.setItem(key, String(next));
    return next;
}
