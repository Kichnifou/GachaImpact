// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import ProfileCharacterDetail from './ProfileCharacterDetail'
import type { Profile } from './types'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
it('opens only authorized Profile data, never requests private Box data or exposes mutations', () => {
  const fetch = vi.spyOn(globalThis, 'fetch'), close = vi.fn()
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  const character = { id:'durin', externalKey:'durin', name:'Durin', rarity:5, elementKey:'pyro', constellation:6, copies:64, firstObtainedAt:'2026-01-01T00:00:00Z', iconPath:null, fullbodyPath:null, wishPath:null, splashPath:null, weaponType:'Épée', region:'Mondstadt' }
  const legend = { character, stats:{strength:16,intelligence:8,beauty:17,charisma:5,popularity:18}, totals:{contests:'17',wins:'9'}, themes:Object.fromEntries(['STRENGTH','INTELLIGENCE','BEAUTY','CHARISMA','POPULARITY'].map(theme => [theme,{participations:'17',wins:'9',titleRank:theme==='CHARISMA'?2:0,title:theme==='CHARISMA'?'Icône d’Argent':null}])) }
  const profile = {box:{access:'ALLOWED',data:[character]}, statistics:{access:'ALLOWED',data:{}}, legends:{access:'ALLOWED',data:{characters:[character],legends:[legend]}}} as unknown as Profile
  const render = (value: Profile) => act(() => root.render(<ProfileCharacterDetail profile={value} characterId="durin" onClose={close}/>))
  try {
    render(profile)
    expect(container.querySelector('.box-c6-competition-stats')?.textContent).toContain('Icône d’Argent')
    expect(container.querySelector('.box-stella-zone, .box-expedition-zone, .box-detail-favorite-star')).toBeNull()
    const stats = [...container.querySelectorAll('.box-c6-competition-stats dl > div')]
    expect(stats[3].textContent).toContain('Icône d’Argent');expect(stats[0].querySelector('.contest-title-badge')).toBeNull()
    render({...profile,statistics:{access:'PRIVATE'}})
    expect(container.querySelector('.box-c6-competition-stats')).toBeNull()
    expect(container.textContent).toContain('statistiques de ce personnage sont privées')
    act(() => document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})))
    expect(close).toHaveBeenCalledOnce()
    render({...profile,box:{access:'PRIVATE'}});expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/api/'))).toEqual([])
  } finally { act(() => root.unmount());container.remove();fetch.mockRestore() }
})
