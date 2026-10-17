// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import type { BannerVoteDto, GachaCharacterDto, PlayerBoxDto } from '../api/types'
import { BoxMemoryCache } from '../box/box-memory-cache'
import CharactersScreen from './CharactersScreen'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT:boolean }).IS_REACT_ACT_ENVIRONMENT = true
const roots:Root[]=[]
afterEach(() => { act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren(); vi.restoreAllMocks() })
const characters:GachaCharacterDto[]=['Amber','Furina','Kaeya','Keqing'].map((name,i) => ({ id:String(i),externalKey:String(i),name,rarity:i%2?4:5,elementKey:i===1?'hydro':'pyro',region:null,weaponType:null,classKey:null,iconPath:null,splashPath:null,wishPath:null,fullbodyPath:null }))
const box=(ids:string[]):PlayerBoxDto => ({ characters:characters.filter(row => ids.includes(row.id)).map(row => ({ ...row,constellation:0,copies:1,firstObtainedAt:'2026-10-17T00:00:00Z',favorite:false,c6CompetitionStats:null })),summary:{totalOwned:ids.length,fiveStars:0,fourStars:0,c6:0},preference:{sortKey:'alphabetical',direction:'asc'},stella:{quantity:'0'} })
const names=(container:HTMLElement) => Array.from(container.querySelectorAll('.character-card h3'), row => row.textContent)
const selectOwned=async(container:HTMLElement) => act(async() => { const select=container.querySelector<HTMLSelectElement>('[aria-label="Critère de tri"]')!;select.value='owned';select.dispatchEvent(new Event('change',{bubbles:true})) })
async function mount(props:Partial<Parameters<typeof CharactersScreen>[0]>={}) {
  const container=document.createElement('div');document.body.append(container);const root=createRoot(container);roots.push(root)
  const render=async(next=props) => act(async() => root.render(<CharactersScreen characters={characters} {...next}/>))
  await render();return {container,render}
}
it('keeps ownership unknown during loading/error and retries without disabling cards',async() => {
  let resolve!:(value:PlayerBoxDto)=>void
  const load=vi.fn<()=>Promise<PlayerBoxDto>>().mockRejectedValueOnce(Error('offline')).mockImplementationOnce(() => new Promise(done => {resolve=done}))
  const h=await mount({onLoadBox:load})
  expect(h.container.querySelectorAll('.catalog-unowned')).toHaveLength(0)
  expect(h.container.textContent).toContain('Possession indisponible')
  await act(async() => Array.from(h.container.querySelectorAll('button')).find(row => row.textContent==='Réessayer')!.click())
  expect(h.container.querySelectorAll('.catalog-unowned')).toHaveLength(0)
  await act(async() => resolve(box([])))
  expect(h.container.querySelectorAll('.catalog-unowned')).toHaveLength(4)
  expect(h.container.querySelectorAll('.character-card.disabled, .character-card[disabled]')).toHaveLength(0)
  expect(load).toHaveBeenCalledTimes(2)
})
it('sorts both ownership groups alphabetically, reverses only groups and preserves every character',async() => {
  const h=await mount({initialBox:box(['1','3'])})
  expect(h.container.querySelector('select')?.value).toBe('name')
  await selectOwned(h.container);expect(names(h.container)).toEqual(['Furina','Keqing','Amber','Kaeya'])
  await act(async() => h.container.querySelector<HTMLButtonElement>('[aria-label="Possédés en premier"]')!.click())
  expect(names(h.container)).toEqual(['Amber','Kaeya','Furina','Keqing'])
  await act(async() => h.container.querySelector<HTMLButtonElement>('[aria-label="Non possédés en premier"]')!.click())
  expect(names(h.container)).toEqual(['Furina','Keqing','Amber','Kaeya'])
  expect(h.container.querySelectorAll('.catalog-unowned')).toHaveLength(2)
})
it('combines owned sorting with search, element and rarity filters',async() => {
  const h=await mount({initialBox:box(['2'])});await selectOwned(h.container)
  await act(async() => h.container.querySelector<HTMLButtonElement>('[aria-label="Pyro"]')!.click())
  await act(async() => h.container.querySelector<HTMLButtonElement>('[aria-label="Filtrer les personnages 5 étoiles"]')!.click())
  expect(names(h.container)).toEqual(['Kaeya','Amber'])
  await act(async() => { const input=h.container.querySelector<HTMLInputElement>('input[type="search"]')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'AM');input.dispatchEvent(new Event('input',{bubbles:true})) })
  expect(names(h.container)).toEqual(['Amber'])
})
it('reuses an already refreshed shared cache without a redundant Box request and sees recent acquisitions',async() => {
  const cache=new BoxMemoryCache();cache.write('player',box(['0']))
  const request=vi.fn(async() => box(['0'])),load=vi.fn(() => cache.revalidate('player',request))
  const h=await mount({initialBox:cache.read('player'),onLoadBox:load})
  expect(request).toHaveBeenCalledTimes(1)
  cache.write('player',box(['0','1','2']))
  await h.render({initialBox:cache.read('player'),onLoadBox:load,refreshToken:1})
  expect(h.container.querySelectorAll('.catalog-unowned')).toHaveLength(1)
  expect(request).toHaveBeenCalledTimes(1)
  await h.render({initialBox:cache.read('player'),onLoadBox:load,refreshToken:2})
  expect(request).toHaveBeenCalledTimes(1)
})
it('revalidates once on normal re-entry even with an older cache',async() => {
  const load=vi.fn(async() => box(['0','1','2','3']))
  const h=await mount({initialBox:box([]),onLoadBox:load})
  expect(load).toHaveBeenCalledTimes(1);expect(h.container.querySelectorAll('.catalog-unowned')).toHaveLength(0)
})
it('allows a vote on a known unowned character',async() => {
  vi.spyOn(document,'visibilityState','get').mockReturnValue('visible')
  const votes:BannerVoteDto={bannerRotationId:'rotation',startsAt:'2026-10-12T00:00:00Z',endsAt:'2026-10-19T00:00:00Z',canVote:true,ownVote:null,catalogVersion:'v1',candidates:[{characterId:'1',voteCount:0}]}
  const vote=vi.fn(async() => ({...votes,canVote:false,ownVote:{characterId:'1',votedAt:null}}))
  const h=await mount({initialBox:box([]),onLoadVotes:async() => votes,onVote:vote})
  const button=h.container.querySelector<HTMLButtonElement>('.catalog-unowned .catalog-character-vote button')!
  expect(button.disabled).toBe(false)
  await act(async() => button.click());expect(vote).toHaveBeenCalledExactlyOnceWith('1','rotation')
})
