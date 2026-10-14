// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {afterEach,expect,it,vi} from 'vitest'
import AppearancePanel from './AppearancePanel'
import type {AppearanceDto} from '../api/types'
import type {SocialActions} from '../social/types'
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});let root:Root|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;document.body.replaceChildren()});
const cosmetic=(id:string,name:string,type:'AVATAR'|'TITLE',date:string|null,isNew=false):AppearanceDto['catalog'][number]=>({id,displayName:name,type,owned:true,isActive:true,visibility:'VISIBLE',assetPath:null,condition:null,unlockedAt:date,isNew,...(type==='AVATAR'?{sourceCharacterId:id}:{levelRequirement:10})});
async function setup(){
 let value:AppearanceDto={avatar:{kind:'ELEMENT',assetPath:null},title:null,equippedAvatarCosmeticId:'a',equippedTitleCosmeticId:null,catalog:[cosmetic('a','Alpha','AVATAR','2026-10-01T00:00:00Z'),cosmetic('z','Étoile','AVATAR','2026-10-12T00:00:00Z',true),cosmetic('b','Beta','AVATAR',null),cosmetic('n','Nouveau titre','TITLE','2026-10-12T00:00:00Z',true)]};
 const consultAppearance=vi.fn(async(_type,ids:string[])=>{value={...value,catalog:value.catalog.map(item=>ids.includes(item.id)?{...item,isNew:false}:item)};return{consulted:ids}});
 const equipAppearance=vi.fn(async()=>value);const actions={appearance:vi.fn(async()=>value),consultAppearance,equipAppearance} as unknown as SocialActions;
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const render=async(key='owner')=>act(async()=>root!.render(<AppearancePanel key={key} actions={actions} displayName="Owner" elementKey="pyro" onChanged={async()=>{}}/>));
 await render();await click(host,'Choisir');return {host,actions,consultAppearance,equipAppearance,render,acquire:(entry:AppearanceDto['catalog'][number])=>{value={...value,catalog:[...value.catalog,entry]}}};
}
const click=async(_host:HTMLElement,label:string)=>{await act(async()=>[...document.body.querySelectorAll('button')].find(button=>button.textContent===label)!.click());if(label==='Titres'||label==='Avatars')await act(async()=>document.body.querySelector<HTMLButtonElement>('.appearance-choose')!.click())};
const names=(_host:HTMLElement)=>[...document.body.querySelectorAll('.appearance-character-card strong')].map(node=>node.textContent);
async function search(_host:HTMLElement,value:string){await act(async()=>{const input=document.body.querySelector<HTMLInputElement>('.appearance-search input')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})}
async function select(_host:HTMLElement,label:string,value:string){await act(async()=>{const node=document.body.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}))})}
it('marks only the visited type, retains first-visit priority until departure and persists across reloads',async()=>{
 const {host,consultAppearance,equipAppearance,render,acquire}=await setup();
 expect(names(host)).toEqual(['Étoile','Alpha','Beta']);expect(document.body.querySelectorAll('.appearance-new')).toHaveLength(1);expect(consultAppearance).toHaveBeenCalledWith('AVATAR',['z']);
 await click(host,'Titres');expect(document.body.querySelectorAll('.appearance-new')).toHaveLength(1);expect(consultAppearance).toHaveBeenCalledWith('TITLE',['n']);
 await click(host,'Avatars');expect(document.body.querySelectorAll('.appearance-new')).toHaveLength(0);
 await select(host,'Tri des cosmétiques','name');await select(host,'Ordre des cosmétiques','asc');expect(names(host)).toEqual(['Alpha','Beta','Étoile']);
 await render('reload');await click(host,'Choisir');expect(document.body.querySelectorAll('.appearance-new')).toHaveLength(0);
 acquire(cosmetic('late','Zeta','AVATAR','2026-10-13T00:00:00Z',true));await render('later');await click(host,'Choisir');expect(names(host)[0]).toBe('Zeta');expect(consultAppearance).toHaveBeenLastCalledWith('AVATAR',['late']);
 expect(equipAppearance).not.toHaveBeenCalled();
});
it('combines both sort directions and accent-insensitive character search without consuming titles',async()=>{
 const {host,consultAppearance}=await setup();await click(host,'Titres');await click(host,'Avatars');
 await select(host,'Tri des cosmétiques','name');await select(host,'Ordre des cosmétiques','asc');expect(names(host)).toEqual(['Alpha','Beta','Étoile']);
 await select(host,'Ordre des cosmétiques','desc');expect(names(host)).toEqual(['Étoile','Beta','Alpha']);
 await select(host,'Tri des cosmétiques','date');expect(names(host)).toEqual(['Étoile','Alpha','Beta']);await select(host,'Ordre des cosmétiques','asc');expect(names(host)).toEqual(['Alpha','Étoile','Beta']);
 await act(async()=>{const input=document.body.querySelector<HTMLInputElement>('.appearance-search input')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'ETOILE');input.dispatchEvent(new Event('input',{bubbles:true}))});
 expect(names(host)).toEqual(['Étoile']);expect(consultAppearance).toHaveBeenCalledTimes(2);
});
it('opens titles with a reset search and does not consult again when filtering an empty result',async()=>{
 const {host,consultAppearance}=await setup();await search(host,'ETOILE');await click(host,'Titres');
 expect(document.body.querySelector<HTMLInputElement>('.appearance-search input')!.value).toBe('');expect(consultAppearance).toHaveBeenCalledTimes(2);
 expect(document.body.querySelectorAll('.appearance-new')).toHaveLength(1);expect(consultAppearance).toHaveBeenLastCalledWith('TITLE',['n']);
 await search(host,'absent');expect(document.body.querySelectorAll('article.appearance-card')).toHaveLength(0);expect(consultAppearance).toHaveBeenCalledTimes(2);
 await click(host,'Avatars');await click(host,'Titres');expect(document.body.querySelectorAll('.appearance-new')).toHaveLength(0);
});
