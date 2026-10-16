// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {AuthContext} from '../auth/auth-context'
import {TutorialPresentationContext} from '../tutorial/tutorial-presentation'
const mocks=vi.hoisted(()=>({signIn:vi.fn(),signOut:vi.fn(),remove:vi.fn()}))
vi.mock('../infrastructure/supabase/client',()=>({createReauthenticationClient:()=>({auth:{signInWithPassword:mocks.signIn}}),getSupabaseClient:()=>({auth:{signOut:mocks.signOut}})}))
vi.mock('../api/game-api',async original=>({...await original<typeof import('../api/game-api')>(),getGameApiClient:()=>({deleteAccount:mocks.remove})}))
import AccountDeletionPanel from './AccountDeletionPanel'
;(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true
const roots:ReturnType<typeof createRoot>[]=[]
beforeEach(()=>{mocks.signIn.mockResolvedValue({data:{user:{id:'subject'},session:{access_token:'fresh-proof'}},error:null});mocks.signOut.mockResolvedValue({error:null});mocks.remove.mockResolvedValue({status:'PENDING'})})
afterEach(()=>{act(()=>roots.splice(0).forEach(root=>root.unmount()));document.body.replaceChildren();localStorage.clear();sessionStorage.clear();vi.clearAllMocks();vi.restoreAllMocks();vi.useRealTimers()})
function mount(tutorial=false){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);roots.push(root)
 act(()=>root.render(<AuthContext.Provider value={{status:'signedIn',session:{user:{id:'subject',email:'synthetic@example.invalid'}},signOut:async()=>undefined} as never}>
   <TutorialPresentationContext.Provider value={{active:tutorial,step:null}}><AccountDeletionPanel/></TutorialPresentationContext.Provider></AuthContext.Provider>));return host}
function button(host:HTMLElement,name:string){return Array.from(host.querySelectorAll('button')).find(x=>x.textContent===name)!}
async function input(host:HTMLElement,id:string,value:string){await act(async()=>{const element=host.querySelector<HTMLInputElement>('#'+id)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}))})}
async function open(){const host=mount();act(()=>{button(host,'Supprimer mon compte').focus();button(host,'Supprimer mon compte').click()});return host}
async function ready(){const host=await open();await input(host,'account-deletion-password','SYNTHETIC_PASSWORD');await act(async()=>button(host,'Vérifier mon identité').click());await input(host,'account-deletion-confirmation','SUPPRIMER');return host}
describe('account deletion reauthentication and closure',()=>{
 it('requires both SUPPRIMER and verified identity, then clears the password',async()=>{
   const host=await open();await input(host,'account-deletion-confirmation','SUPPRIMER');expect(button(host,'Supprimer définitivement').disabled).toBe(true)
   await input(host,'account-deletion-password','SYNTHETIC_PASSWORD');await act(async()=>button(host,'Vérifier mon identité').click())
   expect(mocks.signIn).toHaveBeenCalledWith({email:'synthetic@example.invalid',password:'SYNTHETIC_PASSWORD'})
   expect(host.querySelector<HTMLInputElement>('#account-deletion-password')!.value).toBe('');expect(button(host,'Supprimer définitivement').disabled).toBe(false)
 });
 it('keeps confirmation disabled when the password is wrong',async()=>{
   mocks.signIn.mockResolvedValueOnce({data:{user:null,session:null},error:{code:'invalid_credentials'}})
   const host=await open();await input(host,'account-deletion-password','wrong');await act(async()=>button(host,'Vérifier mon identité').click());await input(host,'account-deletion-confirmation','SUPPRIMER')
   expect(button(host,'Supprimer définitivement').disabled).toBe(true);expect(host.querySelector('[role="alert"]')).not.toBeNull();expect(mocks.remove).not.toHaveBeenCalled()
 });
 it('prevents double requests and never signs out on partial completion',async()=>{
   const host=await ready();await act(async()=>{button(host,'Supprimer définitivement').click();button(host,'Supprimer définitivement').click()})
   expect(mocks.remove).toHaveBeenCalledTimes(1);expect(mocks.remove).toHaveBeenCalledWith('fresh-proof','fresh-proof',expect.any(AbortSignal));expect(mocks.signOut).not.toHaveBeenCalled()
   expect(host.querySelector('[role="status"]')?.textContent).toContain('clôture reste en cours');expect(button(host,'Vérifier la clôture').disabled).toBe(false)
 });
 it('clears local caches and signs out only after confirmed completion',async()=>{
   mocks.remove.mockResolvedValueOnce({status:'COMPLETED'});localStorage.setItem('synthetic-player-cache','private');sessionStorage.setItem('synthetic-player-state','private')
   const redirect=vi.spyOn(window.location,'replace').mockImplementation(()=>undefined),host=await ready();await act(async()=>button(host,'Supprimer définitivement').click())
   expect(mocks.signOut).toHaveBeenCalledWith({scope:'local'});expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(0);expect(redirect).toHaveBeenCalledWith('/')
 });
 it('keeps keyboard cancellation/focus and disables opening during tutorial',async()=>{
   const host=await open(),opener=button(host,'Supprimer mon compte');act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})))
   expect(host.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement).toBe(opener)
   const tutorial=mount(true);expect(button(tutorial,'Supprimer mon compte').disabled).toBe(true)
 });
});
