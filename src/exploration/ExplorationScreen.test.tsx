// @vitest-environment happy-dom
import {StrictMode,act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
import ExplorationScreen,{type ExplorationApi} from './ExplorationScreen'
import {createExplorationMaze} from '../../server/src/domain/exploration/maze'
import type {ExplorationSnapshot,ExplorationAction} from '../../server/src/domain/exploration/types'

let host:HTMLDivElement,root:Root
const snapshot:ExplorationSnapshot={regions:[{key:'mondstadt',name:'Mondstadt',progress:{primogems:0,moras:0,own:0,other:0}}],session:null,serverNow:new Date().toISOString()}
const active:ExplorationSnapshot={...snapshot,session:{id:crypto.randomUUID(),regionKey:'mondstadt',regionName:'Mondstadt',progress:snapshot.regions[0]!.progress,maze:createExplorationMaze(42),state:'ACTIVE',infinite:false,backgroundPath:null,backgroundCredit:null,openedChest:null,reward:null,expiresAt:null}}
beforeEach(()=>{(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks()})
const button=(label:string)=>[...host.querySelectorAll('button')].find(node=>node.textContent===label)!
describe('Exploration action recovery and lifecycle',()=>{
 it('retains the identical frozen action after an ambiguous response and after remount',async()=>{
  const actions:ExplorationAction[]=[];
  const api:ExplorationApi={overview:vi.fn(async()=>snapshot),presence:vi.fn(),act:vi.fn(async input=>{actions.push(structuredClone(input));if(actions.length===1)throw Error('network interrupted');return {...active,operationId:'receipt',alreadyProcessed:true}})}
  await act(async()=>root.render(<ExplorationScreen ownerKey="synthetic" elementKey="cryo" api={api}/>));
  await act(async()=>button('Démarrer').click());expect(actions).toHaveLength(1);
  expect(button('Démarrer').disabled).toBe(true);
  await act(async()=>{root.unmount();root=createRoot(host);root.render(<ExplorationScreen ownerKey="synthetic" elementKey="cryo" api={api}/>)});
  await act(async()=>button('Réessayer la même action').click());
  expect(actions).toHaveLength(2);expect(actions[1]).toEqual(actions[0]);expect(sessionStorage.getItem('gacha:exploration:intent:synthetic')).toBeNull();
 });
 it('does not abandon during StrictMode effect replay and sends departure only on actual unmount',async()=>{
  const presence=vi.fn<ExplorationApi['presence']>(async()=>({active:true,expiresAt:null,serverNow:snapshot.serverNow}));
  const api:ExplorationApi={overview:vi.fn(async()=>active),act:vi.fn(),presence};
  await act(async()=>root.render(<StrictMode><ExplorationScreen ownerKey="synthetic" api={api}/></StrictMode>));
  expect(presence.mock.calls.length).toBeGreaterThan(0);
  expect(presence.mock.calls.every(call=>(call as unknown as [string,{visible:boolean}])[1].visible)).toBe(true);
  await act(async()=>{root.unmount();root=createRoot(host)});
  expect(presence).toHaveBeenLastCalledWith(active.session!.id,expect.objectContaining({visible:false}));
 });
});
