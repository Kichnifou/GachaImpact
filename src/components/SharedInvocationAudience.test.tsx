// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import SharedInvocationAudience from './SharedInvocationAudience';
import SharedInvocationControls from './SharedInvocationControls';
import type {SharedInvocationController} from '../gacha/use-shared-invocations';
import type {SharedSession,SharedSpectators} from '../api/shared-invocations-types';
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
const session={id:'scene',status:'ACTIVE',authoritative:true,snapshot:{displayName:'Diffuseur'},reactions:[]} as unknown as SharedSession;
const roots:ReturnType<typeof createRoot>[]=[];
function controller(total=7){const players=Array.from({length:total},(_,i)=>({playerId:'player-'+i,displayName:'Spectateur '+i,avatarPath:null}));const data:SharedSpectators={sessionId:'scene',total,page:1,totalPages:1,preview:players.slice(0,5),players};return {enabled:true,state:{broadcasting:session,watching:null},api:{spectators:vi.fn(async()=>data)},pending:false,error:'',start:vi.fn(async()=>true),stop:vi.fn(async()=>true),watch:vi.fn(async()=>true),react:vi.fn(),resume:vi.fn(),refreshPersonal:vi.fn()} as unknown as SharedInvocationController;}
async function mount(ui:React.ReactNode){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);roots.push(root);await act(async()=>root.render(ui));return {root,host};}
afterEach(()=>{act(()=>roots.splice(0).forEach(r=>r.unmount()));document.body.replaceChildren();vi.useRealTimers()});
it.each([0,1,7])('shows real %i viewer count and opens the exact public profile',async total=>{
 const shared=controller(total),profile=vi.fn();await mount(<SharedInvocationAudience shared={shared} session={session} onProfile={profile}/>);
 const button=document.querySelector<HTMLButtonElement>('.shared-spectator-count')!;expect(button.textContent).toContain(`${total} ${total===1?'spectateur':'spectateurs'}`);
 await act(async()=>button.click());expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Spectateurs');
 if(total){const row=document.querySelector<HTMLButtonElement>('.shared-invocation-session')!;await act(async()=>row.click());expect(profile).toHaveBeenCalledExactlyOnceWith('player-0');expect(document.querySelector('[role="dialog"]')).toBeNull()}
 else expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Aucun spectateur.');
});
it('offers five vertically listed preview identities and Voir plus only above five, with keyboard access',async()=>{
 const shared=controller();await mount(<SharedInvocationAudience shared={shared} session={session}/>);
 act(()=>document.querySelector<HTMLButtonElement>('.shared-spectator-count')!.focus());
 expect(document.querySelectorAll('.shared-spectator-preview > div')).toHaveLength(5);
 expect(document.querySelector('.shared-spectator-preview')?.textContent).not.toContain('Spectateur 5');
 const more=document.querySelector<HTMLButtonElement>('.shared-spectator-preview button')!;expect(more.textContent).toBe('Voir plus');await act(async()=>more.click());
 expect(document.querySelectorAll('.shared-invocation-session')).toHaveLength(7);
 act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.querySelector('[role="dialog"]')).toBeNull();
 expect(document.activeElement).toBe(document.querySelector('.shared-spectator-count'));
});
it('shows an error with retry and accepts a subsequent authoritative refresh',async()=>{
 const shared=controller(1);const value=await shared.api!.spectators!();vi.mocked(shared.api!.spectators!).mockRejectedValue(Error('Network unavailable'));
 await mount(<SharedInvocationAudience shared={shared} session={session}/>);await act(async()=>document.querySelector<HTMLButtonElement>('.shared-spectator-count')!.click());
 expect(document.querySelector('[role="alert"]')?.textContent).toContain('Une erreur inattendue est survenue.');
 vi.mocked(shared.api!.spectators!).mockResolvedValue(value);await act(async()=>document.querySelector<HTMLButtonElement>('[role="alert"] button')!.click());
 expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Spectateur 0');
});
it('hides idle sharing controls throughout a personal presentation but retains the broadcaster stop and viewer reactions',async()=>{
 const shared=controller(),{root,host}=await mount(<SharedInvocationControls shared={{...shared,state:{broadcasting:null,watching:null}}} presenting/>);expect(host.textContent).toBe('');
 await act(async()=>root.render(<SharedInvocationControls shared={shared} presenting/>));expect(host.textContent).toContain('En diffusion');expect(host.textContent).not.toContain('Voir');
 await act(async()=>root.render(<SharedInvocationControls shared={{...shared,state:{broadcasting:null,watching:session}}} presenting/>));expect(host.textContent).toContain('Arrêter');expect(host.textContent).not.toContain('Diffuser');expect(host.querySelectorAll('.shared-invocation-reactions button')).toHaveLength(5);
});
it('keeps quiet resynchronization buttonless and exposes only a small fallback after persistent failure',async()=>{
 const shared={...controller(),state:{broadcasting:null,watching:null},personalReady:false}, {root,host}=await mount(<SharedInvocationControls shared={shared}/>);
 expect(host.textContent).toContain('Diffusez vos invocations, ou visionnez celles des autres joueurs');expect(host.textContent).not.toContain('Actualiser mes Invocations');
 await act(async()=>root.render(<SharedInvocationControls shared={{...shared,personalError:'Read failed',error:'Read failed'}}/>));expect(host.querySelector('.shared-recovery-link')?.textContent).toBe('Réessayer l’actualisation');
});
