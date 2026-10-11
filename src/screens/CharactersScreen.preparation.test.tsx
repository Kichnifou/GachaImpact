// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi } from 'vitest'
import CharactersScreen from './CharactersScreen'

describe('public preparation cards',()=>{
  it('sorts preparations separately and keeps unknown rarity last in both directions',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({characters:[]}))))
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
    try{
      const preparations=[{candidateId:'unknown',name:'A unknown',rarity:null},{candidateId:'four',name:'B four',rarity:4 as const},{candidateId:'five',name:'C five',rarity:5 as const}].map(row=>({...row,status:'PREPARATION' as const,elementKey:null,releaseDate:null,iconPath:null,provisional:true}))
      await act(async()=>root.render(<CharactersScreen characters={[]} preparations={preparations}/>))
      const select=host.querySelector<HTMLSelectElement>('[aria-label="Critère de tri"]')!
      await act(async()=>{select.value='rarity';select.dispatchEvent(new Event('change',{bubbles:true}))})
      const names=()=>[...host.querySelectorAll('.catalog-preparation-card h3')].map(row=>row.textContent)
      expect(names()).toEqual(['B four','C five','A unknown'])
      await act(async()=>host.querySelector<HTMLButtonElement>('.sort-direction-button')!.click())
      expect(names()).toEqual(['C five','B four','A unknown'])
    }finally{act(()=>root.unmount());host.remove();vi.unstubAllGlobals()}
  })
  it('shows unknown fields honestly and gives preparations no vote action or fake stars',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({characters:[]}))))
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
    try {
      await act(async()=>root.render(<CharactersScreen characters={[]} preparations={[{candidateId:'private',name:'Préparation',status:'PREPARATION',rarity:null,elementKey:null,releaseDate:null,iconPath:null,provisional:true}]} />))
      const section=host.querySelector('[aria-label="Personnages en préparation"]')!
      expect(section.textContent).toContain('Rareté à confirmer')
      expect(section.textContent).toContain('Élément à confirmer')
      expect(section.textContent).toContain('Informations provisoires')
      expect(section.textContent).not.toContain('★')
      expect(section.querySelector('button')).toBeNull()
      expect(section.querySelector('img')).toBeNull()
      expect(host.querySelector('.collection-summary')?.textContent).toContain('0 personnages actifs')
    } finally {act(()=>root.unmount());host.remove();vi.unstubAllGlobals()}
  })
})
