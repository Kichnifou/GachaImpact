import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SharedInvocationApi, SharedInvocationState, SharedSession } from '../api/shared-invocations-types';
import { establishSharedInvocationTab, sharedInvocationTabId, nextSharedPresenceRevision } from './shared-invocation-tab';
import { apiErrorMessage } from '../utils/formatters';
const empty: SharedInvocationState = { broadcasting: null, watching: null };
/** Ignore old snapshots (including cross-account results); equal seq is an unchanged snapshot. */
export function mergeSharedSession(previous: SharedSession | null, next: SharedSession | null) {
    return previous && next && previous.id === next.id && previous.seq > next.seq ? previous : next;
}
export function useSharedInvocations(api: SharedInvocationApi | undefined, invocationVisible: boolean, onPersonalRefresh?: () => Promise<void>, ownerKey?: string, presentation = false) {
    const presentationRef = useRef(presentation); presentationRef.current = presentation;
    const [state, setState] = useState(empty), [error, setError] = useState(''), [pending, setPending] = useState(false),[personalReady,setPersonalReady]=useState(true);
    const current = useRef(state), screen = useRef(invocationVisible), generation = useRef(0), locked = useRef(false), refresh = useRef(onPersonalRefresh), revision = useRef(0);
    const personalFlight=useRef<{epoch:number;promise:Promise<void>}|null>(null);
    const mutationFlight=useRef<{promise:Promise<void>;resolve:()=>void}|null>(null);
    const reschedulePoll=useRef<(()=>void)|null>(null);
    const [personalError,setPersonalError]=useState('');
    const reactionUntil=useRef(0);
    const [reactionCooling,setReactionCooling]=useState(false);
    const reactionTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
    useEffect(()=>{reactionUntil.current=0;setReactionCooling(false);return()=>{if(reactionTimer.current)clearTimeout(reactionTimer.current)}},[api,ownerKey]);
    useLayoutEffect(() => {
        screen.current = invocationVisible;
        refresh.current = onPersonalRefresh;
    }, [invocationVisible, onPersonalRefresh]);
    const refreshPersonal=useCallback(()=>{
        const epoch=generation.current;
        if(personalFlight.current?.epoch===epoch)return personalFlight.current.promise;
        setPersonalReady(false);setPersonalError('');
        const promise=(async()=>{
            for(let attempt=0;attempt<3&&epoch===generation.current;attempt++){
                try{await refresh.current?.();if(epoch===generation.current){setPersonalReady(true);setPersonalError('')}return;}
                catch(cause){if(epoch!==generation.current)return;if(attempt===2){setPersonalError(apiErrorMessage(cause));return}}
                await new Promise(resolve=>setTimeout(resolve,(attempt+1)*1000));
            }
        })().finally(()=>{if(personalFlight.current?.epoch===epoch)personalFlight.current=null});
        personalFlight.current={epoch,promise};return promise;
    },[]);
    const apply = useCallback((next: SharedInvocationState) => {
        if (next.unchanged)
            return;
        const stoppedWatching = current.current.watching && !next.watching;
        const merged = { broadcasting: mergeSharedSession(current.current.broadcasting, next.broadcasting), watching: mergeSharedSession(current.current.watching, next.watching), watchingToken:next.watchingToken, cursor: next.cursor };
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
        mutationFlight.current?.resolve();mutationFlight.current=null;
        setPending(false);
        setPersonalReady(true);
        setError('');
        setPersonalError('');personalFlight.current=null;
        // External transport/account ownership changed: discard the former server session.
        setState(empty);
        if (!api)
            return;
        let disposed = false, reading = false, ready = false, wakeAfterRead = false, timer: ReturnType<typeof setTimeout> | undefined, presenceAt = 0;
        const cadence = () => screen.current && (current.current.broadcasting || current.current.watching) ? 1000 : 15000;
        const schedule = (delay: number) => {
            if (timer) clearTimeout(timer);
            if (!disposed) timer = setTimeout(() => { timer = undefined; void tick(); }, delay);
        };
        const reschedule = () => {
            if (!ready || disposed) return;
            // A mode transition must replace the old idle deadline. If a read is
            // already running, let it settle before issuing the next one.
            if (reading) { wakeAfterRead = true; return; }
            schedule(cadence());
        };
        reschedulePoll.current = reschedule;
        const tick = async () => {
            if (disposed || epoch !== generation.current || reading)
                return;
            reading = true;
            const version = revision.current;
            try {
                if (!presentationRef.current && (document.visibilityState !== 'hidden' || current.current.broadcasting?.authoritative) && !locked.current) {
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
            if (!disposed) {
                schedule(wakeAfterRead ? 0 : cadence());
                wakeAfterRead = false;
            }
        };
        void establishSharedInvocationTab().then(() => {
            if (!disposed) {
                ready = true;
                void tick();
            }
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
            if (reschedulePoll.current === reschedule) reschedulePoll.current = null;
            generation.current++;
            mutationFlight.current?.resolve();mutationFlight.current=null;
            if (timer)
                clearTimeout(timer);
            document.removeEventListener('visibilitychange', visibility);
        };
    }, [api, apply, ownerKey]);
    const broadcasting = !!state.broadcasting, watching = !!state.watching;
    useEffect(() => { reschedulePoll.current?.(); }, [api, ownerKey, invocationVisible, broadcasting, watching]);
    useEffect(()=>{
        const sessionId=state.watching?.id,token=state.watchingToken;
        if(presentation||!api?.viewerPresence||!sessionId||!token)return;
        let disposed=false,reading=false,changedDuringRead=false,timer:ReturnType<typeof setTimeout>|undefined;
        const send=async()=>{
            if(disposed)return;
            if(reading){changedDuringRead=true;return}
            reading=true;if(timer)clearTimeout(timer);
            try{await api.viewerPresence!(sharedInvocationTabId(),sessionId,token,nextSharedPresenceRevision(),screen.current&&document.visibilityState!=='hidden')}catch{/* lease expires; polling owns the visible network error */}
            reading=false;
            if(!disposed){if(changedDuringRead){changedDuringRead=false;void send()}else timer=setTimeout(send,15000)}
        };
        const changed=()=>{if(timer)clearTimeout(timer);void send()};
        void send();document.addEventListener('visibilitychange',changed);
        return()=>{disposed=true;if(timer)clearTimeout(timer);document.removeEventListener('visibilitychange',changed)};
    },[api,state.watching?.id,state.watchingToken,invocationVisible,ownerKey,presentation]);
    useEffect(() => {
        const own = current.current.broadcasting;
        if (presentation || !api || !own?.authoritative || locked.current)
            return;
        const epoch = generation.current, version = ++revision.current;
        void api.control(sharedInvocationTabId(), 'presence', invocationVisible ? 'invocation' : 'other', undefined, own.id).then(next => {
            if (epoch === generation.current && version === revision.current)
                apply(next);
        }).catch(e => {
            if (epoch === generation.current && version === revision.current)
                setError(apiErrorMessage(e));
        });
    }, [api, invocationVisible, apply, ownerKey, presentation]);
    useEffect(() => {
        if (!api)
            return;
        let lastSent = 0;
        const gesture = (event: Event) => {
            if (presentationRef.current || !event.isTrusted || locked.current || !current.current.broadcasting?.authoritative || Date.now() - lastSent < 10000)
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
    const mutate = useCallback(async (action: (api: SharedInvocationApi, tabId: string) => Promise<SharedInvocationState>, reaction=false) => {
        if (presentationRef.current || !api || locked.current)
            return false;
        locked.current = true;
        let settle!:()=>void;
        const flight={promise:new Promise<void>(resolve=>{settle=resolve}),resolve:()=>settle()};
        mutationFlight.current=flight;
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
            // A second tab can win the Player-wide reaction slot. This expected
            // business refusal needs neither feedback nor a reconciliation GET.
            if(reaction && e && typeof e==='object' && 'code' in e && e.code==='SHARED_REACTION_COOLDOWN')return false;
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
            if(mutationFlight.current===flight)mutationFlight.current=null;
            flight.resolve();
            if (epoch === generation.current) {
                locked.current = false;
                setPending(false);
            }
        }
    }, [api, apply]);
    return { state, error:personalError||error, personalError, pending, reactionCooling, personalReady,refreshPersonal, enabled: !!api, api, mutate, apply,
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
        react: (emoji: Parameters<SharedInvocationApi['react']>[1]) => {
            if(!api||locked.current||Date.now()<reactionUntil.current)return Promise.resolve(false);
            reactionUntil.current=Date.now()+500;setReactionCooling(true);
            if(reactionTimer.current)clearTimeout(reactionTimer.current);
            reactionTimer.current=setTimeout(()=>setReactionCooling(false),500);
            return mutate((api, id) => api.react(id, emoji),true);
        },
        sync: async () => {
            if (api) {
                const epoch = generation.current;
                // A read started during stop can still describe the old session. Let the
                // confirmed mutation apply first, then read; never supersede its revision.
                while(mutationFlight.current){await mutationFlight.current.promise;if(epoch!==generation.current)return}
                if(epoch!==generation.current)return;
                const version = ++revision.current;
                const next = await api.state(sharedInvocationTabId());
                if (epoch === generation.current && version === revision.current)
                    apply(next);
            }
        },
    };
}
export type SharedInvocationController = ReturnType<typeof useSharedInvocations>;
