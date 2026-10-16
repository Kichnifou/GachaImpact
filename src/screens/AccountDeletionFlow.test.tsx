// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {AuthContext} from '../auth/auth-context'
import {ApiError} from '../api/game-api'
const mocks=vi.hoisted(()=>({remove:vi.fn(),signOut:vi.fn()}))
vi.mock('../api/game-api',async original=>({...await original<typeof import('../api/game-api')>(),getGameApiClient:()=>({deleteAccount:mocks.remove})}))
vi.mock('../infrastructure/supabase/client',()=>({getSupabaseClient:()=>({auth:{signOut:mocks.signOut}})}))
import {AccountDeletionFlowProvider,useAccountDeletionFlow} from './AccountDeletionFlow'
;(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
function Game(){const flow=useAccountDeletionFlow()!;return <><p>Game mounted</p><button onClick={()=>void flow.begin('owner-a','fresh-proof')}>Begin</button>{flow.refusal&&<p>{flow.refusal}</p>}</>}
function render(subject:string|null='owner-a'){
  act(()=>root.render(<AuthContext.Provider value={{status:subject?'signedIn':'signedOut',session:subject?{user:{id:subject},access_token:'session-'+subject}:null} as never}>
    <AccountDeletionFlowProvider><Game/></AccountDeletionFlowProvider></AuthContext.Provider>))
}
const button=(name:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent===name)!
async function click(name:string){await act(async()=>button(name).click())}
beforeEach(()=>{localStorage.clear();sessionStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);mocks.remove.mockReset().mockResolvedValue({status:'PENDING'});mocks.signOut.mockReset().mockResolvedValue({error:null})})
afterEach(()=>{act(()=>root.unmount());host.remove();localStorage.clear();sessionStorage.clear();vi.restoreAllMocks();vi.useRealTimers()})
describe('durable deletion followup outside the game',()=>{
 it('keeps202 usable, suspends the game and confirms success using the captured JWT even after Auth is deleted',async()=>{
   const redirect=vi.spyOn(window.location,'replace').mockImplementation(()=>undefined);render();localStorage.setItem('game-cache','private');sessionStorage.setItem('game-cache','private')
   await click('Begin');expect(host.textContent).not.toContain('Game mounted');expect(button('Vérifier la clôture').disabled).toBe(false)
   expect(localStorage.getItem('game-cache')).toBe('private');expect(mocks.signOut).not.toHaveBeenCalled()
   render(null);mocks.remove.mockResolvedValueOnce({status:'COMPLETED'});await click('Vérifier la clôture')
   expect(mocks.remove).toHaveBeenLastCalledWith('fresh-proof','fresh-proof',expect.any(AbortSignal))
   expect(mocks.signOut).toHaveBeenCalledWith({scope:'local'});expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(0);expect(redirect).toHaveBeenCalledWith('/')
 });
 it('reloads a lost initial response without persisting a JWT or password and retries with the same owner session',async()=>{
   mocks.remove.mockRejectedValueOnce(new ApiError('NETWORK_ERROR','lost',null));render();await click('Begin')
   expect(host.textContent).toContain('prise en charge');expect(host.textContent).toContain('Aucun succès');expect(mocks.signOut).not.toHaveBeenCalled()
   const saved=localStorage.getItem('gachaimpact.account-deletion-followup.v1')!;expect(saved).not.toContain('fresh-proof');expect(JSON.parse(saved)).toMatchObject({subject:'owner-a',accepted:false})
   act(()=>root.unmount());root=createRoot(host);render();expect(host.textContent).not.toContain('Game mounted');await click('Vérifier la clôture')
   expect(mocks.remove).toHaveBeenLastCalledWith('session-owner-a','session-owner-a',expect.any(AbortSignal));expect(host.textContent).toContain('suppression est engagée')
 });
 it('does not interpret an expiredJWT401 as completion or clear private caches',async()=>{
   render();await click('Begin');localStorage.setItem('game-cache','private');mocks.remove.mockRejectedValueOnce(new ApiError('SESSION_REQUIRED','expired',401));await click('Vérifier la clôture')
   expect(host.textContent).toContain('session ne permet plus');expect(host.textContent).toContain('Aucun succès');expect(mocks.signOut).not.toHaveBeenCalled();expect(localStorage.getItem('game-cache')).toBe('private')
   await click('Fermer le suivi');expect(localStorage.getItem('game-cache')).toBe('private');expect(mocks.signOut).not.toHaveBeenCalled()
 });
 it('retains accepted state on a temporary server error',async()=>{
   render();await click('Begin');mocks.remove.mockRejectedValueOnce(new ApiError('TEMPORARY','temporary',503));await click('Vérifier la clôture')
   expect(host.textContent).toContain('suppression est engagée');expect(button('Vérifier la clôture').disabled).toBe(false);expect(mocks.signOut).not.toHaveBeenCalled()
 });
 it('shows an unconfirmed followup after reload without any usable session and makes no unauthenticated lookup',()=>{
   localStorage.setItem('gachaimpact.account-deletion-followup.v1',JSON.stringify({subject:'owner-a',requestedAt:Date.now(),accepted:true}));render(null)
   expect(host.textContent).toContain('session de vérification n’est plus disponible');expect(button('Vérifier la clôture').disabled).toBe(true);expect(button('Fermer le suivi').disabled).toBe(false);expect(mocks.remove).not.toHaveBeenCalled()
 });
 it('never disconnects another account or clears its caches on a late completion for the old owner',async()=>{
   let finish!:(value:{status:string})=>void;mocks.remove.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));render();await click('Begin')
   render('owner-b');localStorage.setItem('owner-b-cache','private');sessionStorage.setItem('owner-b-cache','private')
   await act(async()=>finish({status:'COMPLETED'}));expect(host.textContent).toContain('Game mounted');expect(mocks.signOut).not.toHaveBeenCalled();expect(localStorage.getItem('owner-b-cache')).toBe('private');expect(sessionStorage.getItem('owner-b-cache')).toBe('private')
 });
 it('returns an authoritative pre-acceptance responsibility refusal without claiming acceptance',async()=>{
   mocks.remove.mockRejectedValueOnce(new ApiError('ACCOUNT_DELETION_RESPONSIBILITY','Transfer responsibility',409));render();await click('Begin')
   expect(host.textContent).toContain('Transfer responsibility');expect(host.textContent).toContain('Game mounted');expect(localStorage.getItem('gachaimpact.account-deletion-followup.v1')).toBeNull();expect(mocks.signOut).not.toHaveBeenCalled()
 });
});
