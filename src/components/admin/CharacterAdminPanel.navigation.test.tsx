// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const api=vi.hoisted(()=>({getAdminCharacters:vi.fn(),getCatalogCandidates:vi.fn(),getCatalogCandidate:vi.fn(),getAdminCharacter:vi.fn(),getAdminCharacterOptions:vi.fn()}))
vi.mock('../../api/game-api',()=>({getGameApiClient:()=>api}))
import CharacterAdminPanel from './CharacterAdminPanel'
;(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true
let root:Root,container:HTMLDivElement
const id='00000000-0000-4000-8000-000000000001'
const candidate={id,name:'Mitya',status:'INCOMPLETE',fields:{},assets:[],missing:[],revision:0,identities:[],trackingState:'ACTIVE',trackingElements:[],nextCheckAt:'2026-10-12T00:00:00Z'}
beforeEach(()=>{vi.resetAllMocks();api.getAdminCharacters.mockResolvedValue({entries:[],page:1,totalPages:1});api.getCatalogCandidates.mockResolvedValue({entries:[candidate],runs:[],enabled:true});api.getCatalogCandidate.mockResolvedValue(candidate);api.getAdminCharacterOptions.mockResolvedValue({regions:['Horizon']})})
afterEach(async()=>{if(root)await act(async()=>root.unmount());container?.remove();window.history.replaceState(null,'','#moderation')})
async function mount(){container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<CharacterAdminPanel playerId="private" playerName="Local"/>))}
async function click(name:string){await act(async()=>[...document.body.querySelectorAll<HTMLButtonElement>('button')].find(button=>(button.getAttribute('aria-label')??button.textContent)===name)!.click())}
it('consumes a candidate deep link after close and does not reopen on returning to Imports',async()=>{
  window.history.replaceState(null,'',`#moderation/candidates/${id}`);await mount();expect(document.body.querySelector('[role=dialog]')?.textContent).toContain('Mitya');
  await click('Fermer la fiche');expect(window.location.hash).toBe('#moderation');await click('Catalogue');await click('Imports et candidats');
  expect(document.body.querySelector('[role=dialog]')).toBeNull();expect(api.getCatalogCandidate).toHaveBeenCalledTimes(1);
  await click('Consulter');expect(document.body.querySelector('[role=dialog]')).not.toBeNull();
})
it('consumes an unclosed deep link when leaving the Personnages owner and accepts a new hash afterwards',async()=>{
  window.history.replaceState(null,'',`#moderation/candidates/${id}`);await mount();await act(async()=>root.unmount());expect(window.location.hash).toBe('#moderation');
  root=createRoot(container);await act(async()=>root.render(<CharacterAdminPanel playerId="private" playerName="Local"/>));expect(document.body.querySelector('[role=dialog]')).toBeNull();
  const next='00000000-0000-4000-8000-000000000002';api.getCatalogCandidate.mockResolvedValue({...candidate,id:next,name:'Valeriy'});
  await act(async()=>{window.history.replaceState(null,'',`#moderation/candidates/${next}`);window.dispatchEvent(new HashChangeEvent('hashchange'))});
  expect(api.getCatalogCandidate).toHaveBeenLastCalledWith(next);expect(document.body.querySelector('[role=dialog]')?.textContent).toContain('Valeriy');
})
