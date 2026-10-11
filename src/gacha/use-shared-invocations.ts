import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SharedInvocationApi, SharedInvocationState, SharedSession } from '../api/shared-invocations-types';
import { establishSharedInvocationTab, sharedInvocationTabId } from './shared-invocation-tab';
import { apiErrorMessage } from '../utils/formatters';
const empty: SharedInvocationState = { broadcasting: null, watching: null };
/** Ignore old snapshots (including cross-account results); equal seq is an unchanged snapshot. */
export function mergeSharedSession(previous: SharedSession | null, next: SharedSession | null) {
    return previous && next && previous.id === next.id && previous.seq > next.seq ? previous : next;
}
export function useSharedInvocations(api: SharedInvocationApi | undefined, invocationVisible: boolean, onPersonalRefresh?: () => Promise<void>, ownerKey?: string) {
    const [state, setState] = useState(empty), [error, setError] = useState(''), [pending, setPending] = useState(false),[personalReady,setPersonalReady]=useState(true);
    const current = useRef(state), screen = useRef(invocationVisible), generation = useRef(0), locked = useRef(false), refresh = useRef(onPersonalRefresh), revision = useRef(0);
    useLayoutEffect(() => {
        screen.current = invocationVisible;
        refresh.current = onPersonalRefresh;
    }, [invocationVisible, onPersonalRefresh]);
    const refreshPersonal=useCallback(async()=>{const epoch=generation.current;setPersonalReady(false);try{await refresh.current?.();if(epoch===generation.current)setPersonalReady(true)}catch(error){if(epoch===generation.current)setError(apiErrorMessage(error))}},[]);
    const apply = useCallback((next: SharedInvocationState) => {
        if (next.unchanged)
            return;
        const stoppedWatching = current.current.watching && !next.watching;
        const merged = { broadcasting: mergeSharedSession(current.current.broadcasting, next.broadcasting), watching: mergeSharedSession(current.current.watching, next.watching), cursor: next.cursor };
        current.current = merged;
        setState(merged);
        if (stoppedWatching)
            void refreshPersonal();
    }, [refreshPersonal]);
    useEffect(() => {
        const epoch = ++generation.current;
        revision.current++;
        current.current = empty;
        locked.current = false;
        setPending(false);
        setPersonalReady(true);
        setError('');
        // External transport/account ownership changed: discard the former server session.
        setState(empty);
        if (!api)
            return;
        let disposed = false, reading = false, timer: ReturnType<typeof setTimeout> | undefined, presenceAt = 0;
        const tick = async () => {
            if (disposed || epoch !== generation.current || reading)
                return;
            reading = true;
            const version = revision.current;
            try {
                if ((document.visibilityState !== 'hidden' || current.current.broadcasting?.authoritative) && !locked.current) {
                    const own = current.current.broadcasting, now = Date.now();
                    const next = own?.authoritative && now - presenceAt >= 15000
                        ? await api.control(sharedInvocationTabId(), 'presence', screen.current ? 'invocation' : 'other', undefined, own.id)
                        : await api.state(sharedInvocationTabId(), current.current.cursor);
                    if (own?.authoritative && now - presenceAt >= 15000)
                        presenceAt = now;
                    if (!disposed && epoch === generation.current && version === revision.current) {
                        apply(next);
                        setError('');
                    }
                }
            }
            catch (error) {
                if (!disposed && epoch === generation.current && version === revision.current)
                    setError(apiErrorMessage(error));
            }
            reading = false;
            if (!disposed)
                timer = setTimeout(tick, screen.current && (current.current.broadcasting || current.current.watching) ? 1000 : 15000);
        };
        void establishSharedInvocationTab().then(() => {
            if (!disposed)
                void tick();
        });
        const visibility = () => {
            if (document.visibilityState === 'visible') {
                if (timer)
                    clearTimeout(timer);
                void tick();
            }
        };
        document.addEventListener('visibilitychange', visibility);
        return () => {
            disposed = true;
            generation.current++;
            if (timer)
                clearTimeout(timer);
            document.removeEventListener('visibilitychange', visibility);
        };
    }, [api, apply, ownerKey]);
    useEffect(() => {
        const own = current.current.broadcasting;
        if (!api || !own?.authoritative || locked.current)
            return;
        const epoch = generation.current, version = ++revision.current;
        void api.control(sharedInvocationTabId(), 'presence', invocationVisible ? 'invocation' : 'other', undefined, own.id).then(next => {
            if (epoch === generation.current && version === revision.current)
                apply(next);
        }).catch(e => {
            if (epoch === generation.current && version === revision.current)
                setError(apiErrorMessage(e));
        });
    }, [api, invocationVisible, apply, ownerKey]);
    useEffect(() => {
        if (!api)
            return;
        let lastSent = 0;
        const gesture = (event: Event) => {
            if (!event.isTrusted || locked.current || !current.current.broadcasting?.authoritative || Date.now() - lastSent < 10000)
                return;
            lastSent = Date.now();
            const epoch = generation.current, version = ++revision.current;
            void api.control(sharedInvocationTabId(), 'gesture', screen.current ? 'invocation' : 'other', undefined, current.current.broadcasting!.id).then(next => {
                if (epoch === generation.current && version === revision.current)
                    apply(next);
            }).catch(() => {
            });
        };
        document.addEventListener('pointerdown', gesture, true);
        document.addEventListener('keydown', gesture, true);
        return () => {
            document.removeEventListener('pointerdown', gesture, true);
            document.removeEventListener('keydown', gesture, true);
        };
    }, [api, apply, ownerKey]);
    const mutate = useCallback(async (action: (api: SharedInvocationApi, tabId: string) => Promise<SharedInvocationState>) => {
        if (!api || locked.current)
            return false;
        locked.current = true;
        setPending(true);
        setError('');
        const epoch = generation.current, version = ++revision.current;
        try {
            const next = await action(api, sharedInvocationTabId());
            if (epoch === generation.current && version === revision.current) {
                apply(next);
                return true;
            }
            return false;
        }
        catch (e) {
            if (epoch === generation.current && version === revision.current)
                setError(apiErrorMessage(e));
            try {
                const next = await api.state(sharedInvocationTabId());
                if (epoch === generation.current && version === revision.current)
                    apply(next);
            }
            catch { /* retain last confirmed state until reconnect */
            }
            return false;
        }
        finally {
            if (epoch === generation.current) {
                locked.current = false;
                setPending(false);
            }
        }
    }, [api, apply]);
    return { state, error, pending, personalReady,refreshPersonal, enabled: !!api, api, mutate, apply,
        start: () => mutate((api, id) => api.start(id)), stop: () => mutate((api, id) => api.control(id, 'stop', screen.current ? 'invocation' : 'other')),
        watch: (id: string | null) => mutate((api, tab) => api.watch(tab, id)),
        advance: (action: 'advance' | 'skip' | 'close') => mutate(async (api, id) => {
            const next = await api.control(id, action, 'invocation', current.current.broadcasting?.seq);
            if (action === 'close') await refreshPersonal();
            return next;
        }),
        resume: () => mutate(async (api, id) => {
            const intent = current.current.broadcasting?.pendingPull;
            if (!intent)
                return api.state(id);
            const next = await api.resume(id, intent.count, intent.key);
            await refresh.current?.();
            return next;
        }),
        react: (emoji: Parameters<SharedInvocationApi['react']>[1]) => mutate((api, id) => api.react(id, emoji)),
        sync: async () => {
            if (api) {
                const epoch = generation.current, version = ++revision.current;
                const next = await api.state(sharedInvocationTabId());
                if (epoch === generation.current && version === revision.current)
                    apply(next);
            }
        },
    };
}
export type SharedInvocationController = ReturnType<typeof useSharedInvocations>;
