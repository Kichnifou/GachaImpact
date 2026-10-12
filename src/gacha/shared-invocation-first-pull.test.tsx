// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {SharedInvocationApi,SharedInvocationState,SharedSession} from '../api/shared-invocations-types';
import {useSharedInvocations,type SharedInvocationController} from './use-shared-invocations';
import {sharedSequenceView} from './shared-invocation-presentation';
const idle:SharedInvocationState={broadcasting:null,watching:null};
const hero={id:'hero',name:'Private fixture',rarity:5 as const,elementKey:'hydro' as const,iconPath:null,splashPath:null,wishPath:null,fullbodyPath:null};
const session:SharedSession={id:'private-broadcast',seq:1,status:'ACTIVE',authoritative:true,expiresAt:'2026-10-13T00:00:00Z',snapshot:{displayName:'Private owner',avatarPath:null,gacha:{banner:{id:'banner',startsAt:'2026-10-05T00:00:00Z',endsAt:'2026-10-12T00:00:00Z',featuredFiveStars:[hero],featuredFourStars:[]},playerState:{selectedBannerCharacterId:'hero',pity5:0,pity4:0,captureProgress:0,guaranteedFeatured5:false}},presentation:{phase:'idle',index:0,pull:null}},reactions:[]};
const result={index:1,resultType:'resource' as const,character:null,rarity:null,resourceKey:'moras',resourceAmount:'5000',wasNewCharacter:null,constellationAfter:null,wasFiftyFifty:false,wonFiftyFifty:null,guaranteeConsumed:false,captureTriggered:false,bonusRewards:[],c6Progression:null};
const roots:ReturnType<typeof createRoot>[]=[];
function mount(transport:SharedInvocationApi,owner:string){let current!:SharedInvocationController;const host=document.createElement('div'),root=createRoot(host);document.body.append(host);roots.push(root);function Harness(){current=useSharedInvocations(transport,true,undefined,owner);return null}act(()=>root.render(<Harness/>));return {get current(){return current},root};}
async function flush(){await act(async()=>{await Promise.resolve();await Promise.resolve()})}
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('BroadcastChannel',undefined);(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;});
afterEach(()=>{act(()=>roots.splice(0).forEach(r=>r.unmount()));document.body.replaceChildren();vi.unstubAllGlobals();vi.useRealTimers()});
function twoClients(){
    let live:SharedSession|null=null,watching=false;
    const view=(viewer:boolean):SharedInvocationState=>({broadcasting:!viewer&&live?structuredClone(live):null,watching:viewer&&watching&&live?{...structuredClone(live),authoritative:false}:null});
    const make=(viewer:boolean):SharedInvocationApi=>({state:vi.fn(async()=>view(viewer)),list:vi.fn(async()=>({sessions:[]})),start:vi.fn(async()=>{live=structuredClone(session);return view(viewer)}),watch:vi.fn(async(_tab,id)=>{watching=!!id;return view(viewer)}),control:vi.fn(async()=>view(viewer)),resume:vi.fn(async()=>view(viewer)),react:vi.fn(async()=>view(viewer))});
    const ownerApi=make(false),viewerApi=make(true),owner=mount(ownerApi,'owner'),viewer=mount(viewerApi,'viewer');
    const present=(phase:'intro'|'reveal'|'summary'|'idle',index=0,id='receipt-first',count:1|10=10)=>{
        if(!live)throw Error('start first');
        live={...live,seq:live.seq+1,snapshot:{...live.snapshot,presentation:{phase,index,pull:phase==='idle'?null:{
            operation:{id,pullCount:count,createdAt:'2026-10-12T00:00:00Z'},
            results:Array.from({length:count},(_,i)=>({...result,index:i+1,resourceAmount:String(5000+i)})),
        }}}};
    };
    const pause=(paused:boolean)=>{if(live)live={...live,seq:live.seq+1,status:paused?'PAUSED':'ACTIVE'}};
    return {ownerApi,viewerApi,owner,viewer,present,view,pause};
}
it('two clients receive the first and second committed pull at active cadence after an already scheduled idle timer',async()=>{
    const c=twoClients();await flush();await act(async()=>{await c.owner.current.start();await c.viewer.current.watch(session.id)});
    expect(c.viewer.current.state.watching?.snapshot.presentation.phase).toBe('idle');c.present('intro');
    await act(async()=>{await vi.advanceTimersByTimeAsync(1000)});expect(c.viewer.current.state.watching?.snapshot.presentation.phase).toBe('intro');
    for(let index=0;index<10;index++){c.present('reveal',index);await act(async()=>{await vi.advanceTimersByTimeAsync(1000)});const s=sharedSequenceView(c.viewer.current.state.watching!);expect(s.phase).toBe('reveal');if(s.phase==='reveal')expect(s.resultIndex).toBe(index)}
    c.present('summary');await act(async()=>{await vi.advanceTimersByTimeAsync(1000)});const summary=sharedSequenceView(c.viewer.current.state.watching!);expect(summary.phase).toBe('summary');if(summary.phase==='summary')expect(summary.pull.results.map(x=>x.resourceAmount)).toEqual(Array.from({length:10},(_,i)=>String(5000+i)));
    c.present('idle');await act(async()=>{await vi.advanceTimersByTimeAsync(1000)});c.present('intro',0,'receipt-second',1);await act(async()=>{await vi.advanceTimersByTimeAsync(1000)});expect(c.viewer.current.state.watching?.snapshot.presentation.pull?.operation.id).toBe('receipt-second');
    expect(c.viewerApi.start).not.toHaveBeenCalled();expect(c.viewerApi.control).not.toHaveBeenCalled();expect(c.viewerApi.resume).not.toHaveBeenCalled();
});
it('does not retain idle cadence when a pull starts while the watch response is in flight',async()=>{
    const c=twoClients();await flush();await act(async()=>{await c.owner.current.start()});let resolve!:(s:SharedInvocationState)=>void;
    const watch=vi.mocked(c.viewerApi.watch).getMockImplementation()!;
    vi.mocked(c.viewerApi.watch).mockImplementationOnce(async(tab,id)=>{await watch(tab,id);return new Promise(r=>{resolve=r})});let joining!:Promise<boolean>;act(()=>{joining=c.viewer.current.watch(session.id)});await flush();const captured=c.view(false).broadcasting!;
    c.present('intro');await act(async()=>{resolve({broadcasting:null,watching:{...captured,authoritative:false}});await joining});
    await act(async()=>{await vi.advanceTimersByTimeAsync(1000)});expect(c.viewer.current.state.watching?.snapshot.presentation.phase).toBe('intro');
    expect(c.viewerApi.watch).toHaveBeenCalledOnce();
});
it('applies a mid-x10 join immediately, restores it on reconnect and follows the exact remaining indexes',async()=>{
    const c=twoClients();await flush();await act(async()=>{await c.owner.current.start()});c.present('reveal',4);await act(async()=>{await c.viewer.current.watch(session.id)});expect(c.viewer.current.state.watching?.snapshot.presentation.index).toBe(4);
    act(()=>c.viewer.root.unmount());roots.splice(roots.indexOf(c.viewer.root),1);const reconnected=mount(c.viewerApi,'viewer');await flush();expect(reconnected.current.state.watching?.snapshot.presentation.index).toBe(4);
    c.present('reveal',5);await act(async()=>{await vi.advanceTimersByTimeAsync(1000)});expect(reconnected.current.state.watching?.snapshot.presentation.index).toBe(5);
});
it('keeps inactive readers at fifteen seconds rather than polling permanently at active cadence',async()=>{
    const c=twoClients();await flush();expect(c.viewerApi.state).toHaveBeenCalledTimes(1);await act(async()=>{await vi.advanceTimersByTimeAsync(14999)});expect(c.viewerApi.state).toHaveBeenCalledTimes(1);await act(async()=>{await vi.advanceTimersByTimeAsync(1)});expect(c.viewerApi.state).toHaveBeenCalledTimes(2);expect(c.viewer.current.state).toEqual(expect.objectContaining(idle));
});

it('follows pause/resume and serializes a slow old read across the watch cadence transition',async()=>{
    const c=twoClients();await flush();await act(async()=>{await c.owner.current.start()});
    let resolve!:(state:SharedInvocationState)=>void;vi.mocked(c.viewerApi.state).mockImplementationOnce(async()=>new Promise(r=>{resolve=r}));
    await act(async()=>{await vi.advanceTimersByTimeAsync(15000)});const reads=vi.mocked(c.viewerApi.state).mock.calls.length;
    await act(async()=>{await c.viewer.current.watch(session.id)});c.present('reveal',2);c.pause(true);
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000)});expect(c.viewerApi.state).toHaveBeenCalledTimes(reads);
    await act(async()=>{resolve(idle);await Promise.resolve();await vi.advanceTimersByTimeAsync(1)});
    expect(c.viewer.current.state.watching?.snapshot.presentation.index).toBe(2);expect(c.viewer.current.state.watching?.status).toBe('PAUSED');
    c.pause(false);c.present('reveal',3);await act(async()=>{await vi.advanceTimersByTimeAsync(1000)});expect(c.viewer.current.state.watching?.status).toBe('ACTIVE');expect(c.viewer.current.state.watching?.snapshot.presentation.index).toBe(3);
});
