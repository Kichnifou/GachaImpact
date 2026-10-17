// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { usePresence } from './use-presence'
import type { ConnectedPlayers, SocialActions } from './types'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT:boolean }).IS_REACT_ACT_ENVIRONMENT=true
const roots:Root[]=[]
let current:ReturnType<typeof usePresence>
const empty={players:[],total:0}
const data=(n:number)=>({players:Array.from({length:n},(_,i)=>({id:'player-'+i,displayName:'Player '+i,status:'ONLINE',level:1,elementKey:null})),total:n}) as ConnectedPlayers
const api=()=>({session:vi.fn(async()=>({})),heartbeat:vi.fn(async()=>({})),end:vi.fn(async()=>({})),connected:vi.fn(async()=>empty)}) as unknown as SocialActions
function View({actions,id='owner',onValue}:{actions:SocialActions;id?:string;onValue?:(value:ReturnType<typeof usePresence>)=>void}){current=usePresence(id,actions);onValue?.(current);return <output>{current.value?.total??'unknown'}</output>}
async function mount(actions:SocialActions,id='owner',onValue?:(value:ReturnType<typeof usePresence>)=>void){const root=createRoot(document.createElement('div'));roots.push(root);await act(async()=>{root.render(<View actions={actions} id={id} onValue={onValue}/>);await Promise.resolve()});return root}
const advance=(ms:number)=>act(async()=>{await vi.advanceTimersByTimeAsync(ms)})
beforeEach(()=>{vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0);Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'})})
afterEach(()=>{act(()=>roots.splice(0).forEach(root=>root.unmount()));vi.restoreAllMocks();vi.useRealTimers();Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'})})

it('updates an observer without navigation through connection, two tabs, close and reconnect',async()=>{
  const sessions=new Map<string,string>(),values=new Map<string,ReturnType<typeof usePresence>>()
  const client=(owner:string)=>({...api(),session:vi.fn(async(key:string)=>{sessions.set(key,owner)}),end:vi.fn(async(key:string)=>{sessions.delete(key)}),connected:vi.fn(async()=>data(new Set(sessions.values()).size))}) as SocialActions
  const a=client('a'),b=client('b'),bTab=client('b')
  await mount(a,'a',v=>values.set('a',v));expect(values.get('a')?.value?.total).toBe(1)
  await mount(b,'b',v=>values.set('b',v));await advance(12000);expect(values.get('a')?.value?.total).toBe(2)
  await mount(bTab,'b',v=>values.set('tab',v));await advance(12000);expect(values.get('a')?.value?.total).toBe(2)
  await act(async()=>{await values.get('b')!.close()});await advance(12000);expect(values.get('a')?.value?.total).toBe(2)
  await act(async()=>{await values.get('tab')!.close()});await advance(12000);expect(values.get('a')?.value?.total).toBe(1)
  await mount(client('b'),'b');await advance(12000);expect(values.get('a')?.value?.total).toBe(2)
  expect(a.session).toHaveBeenCalledWith(expect.any(String),false)
  expect(a.heartbeat).toHaveBeenCalledTimes(1)
})
it('shares the exact server snapshot, preserves AWAY/filtering and never turns a failure into zero',async()=>{
  const actions=api(),snapshot={...data(2),players:[{...data(2).players[0],status:'AWAY' as const},data(2).players[1]]}
  vi.mocked(actions.connected).mockResolvedValueOnce(snapshot).mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(empty)
  await mount(actions);expect(current.value).toBe(snapshot)
  await advance(12000);expect(current.value).toBeNull();expect(current.error).toBe(true)
  act(()=>window.dispatchEvent(new Event('online')));await advance(2000)
  expect(current.value).toBe(empty);expect(current.error).toBe(false)
})
it('coalesces focus, visible return and panel refresh behind one slow read',async()=>{
  const actions=api();let resolve!:(value:ConnectedPlayers)=>void
  vi.mocked(actions.connected).mockReturnValueOnce(new Promise(done=>resolve=done)).mockResolvedValue(data(3))
  await mount(actions)
  await act(async()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));current.refresh();await Promise.resolve()})
  expect(actions.connected).toHaveBeenCalledOnce()
  await act(async()=>{resolve(data(1));await Promise.resolve()});await advance(1999);expect(actions.connected).toHaveBeenCalledOnce()
  await advance(1);expect(actions.connected).toHaveBeenCalledTimes(2);expect(current.value?.total).toBe(3)
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});act(()=>document.dispatchEvent(new Event('visibilitychange')))
  await advance(120000);expect(actions.connected).toHaveBeenCalledTimes(2)
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});act(()=>document.dispatchEvent(new Event('visibilitychange')))
  await advance(0);expect(actions.connected).toHaveBeenCalledTimes(3)
})
it('rejects a read that began before local presence was confirmed and fences old accounts',async()=>{
  const actions=api();let start!:()=>void,oldRead!:(value:ConnectedPlayers)=>void
  vi.mocked(actions.session).mockReturnValueOnce(new Promise<void>(done=>start=done))
  vi.mocked(actions.connected).mockReturnValueOnce(new Promise(done=>oldRead=done)).mockResolvedValue(data(2))
  const root=await mount(actions)
  act(()=>current.refresh());expect(actions.connected).toHaveBeenCalledOnce()
  await act(async()=>{start();await Promise.resolve();oldRead(data(0));await Promise.resolve()})
  expect(current.value).toBeNull();await advance(2000);expect(current.value?.total).toBe(2)
  let late!:(value:ConnectedPlayers)=>void
  vi.mocked(actions.connected).mockReturnValueOnce(new Promise(done=>late=done));await advance(12000)
  await act(async()=>{root.render(<View actions={actions} id="new-owner"/>);await Promise.resolve()})
  expect(current.value?.total).toBe(2)
  await act(async()=>{late(data(99));await Promise.resolve()});expect(current.value?.total).toBe(2)
})

it('establishes a new tab session after BFCache even when the previous start returns late',async()=>{
 const actions=api();let finish!:()=>void
 vi.mocked(actions.session).mockReturnValueOnce(new Promise<void>(done=>finish=done))
 await mount(actions);const old=vi.mocked(actions.session).mock.calls[0][0]
 await act(async()=>{window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('pageshow'));await Promise.resolve()})
 await act(async()=>{finish();await Promise.resolve();await Promise.resolve()})
 expect(actions.end).toHaveBeenCalledWith(old);expect(actions.session).toHaveBeenCalledTimes(2)
 expect(vi.mocked(actions.session).mock.calls[1][0]).not.toBe(old)
 expect(actions.heartbeat).not.toHaveBeenCalled()
})
