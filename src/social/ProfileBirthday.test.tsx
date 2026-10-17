// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProfileBirthday from './ProfileBirthday'
import PrivacySettingsPanel from '../screens/PrivacySettingsPanel'
import type { Access, Birthday, SocialActions } from './types'
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const roots: Root[] = []
afterEach(() => { roots.splice(0).forEach(r => act(() => r.unmount())); document.body.replaceChildren() })
async function mount(value: Access<Birthday | null> = { access: 'ALLOWED', data: null }, own = true, onSave = vi.fn(async (day: number, month: number) => ({ day, month }))) {
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
  const onReload = vi.fn(async () => undefined)
  await act(async () => root.render(<ProfileBirthday value={value} own={own} onSave={onSave} onReload={onReload} />))
  const click = async (text: string) => act(async () => { Array.from(container.querySelectorAll('button')).find(b => b.textContent === text)!.click(); await Promise.resolve() })
  return { container, click, onSave, onReload }
}
describe('Profile birthday', () => {
  it('requires a separate definitive confirmation before submitting only day/month', async () => {
    const h = await mount(); await h.click('Définir mon anniversaire')
    expect(h.container.textContent).not.toContain('définitive'); expect(h.container.querySelector('[role=alertdialog]')).toBeNull()
    const select = h.container.querySelector<HTMLSelectElement>('[aria-label="Mois de l’anniversaire"]')!
    await act(async () => { select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    const day = h.container.querySelector<HTMLButtonElement>('[data-day="29"]')!
    expect(day).not.toBeNull(); await act(async () => day.click())
    await h.click('Confirmer');expect(h.onSave).not.toHaveBeenCalled();expect(h.container.textContent).toContain('29 février')
    await h.click('Confirmer définitivement');expect(h.onSave).toHaveBeenCalledExactlyOnceWith(29, 2)
  })
  it('renders the saved date read-only with no year or age and no editor', async () => {
    const h = await mount({ access: 'ALLOWED', data: { day: 29, month: 2 } });expect(h.container.textContent).toContain('29 février');expect(h.container.querySelector('select')).toBeNull();expect(h.container.querySelector('button')).toBeNull();expect(h.container.textContent).not.toContain('2000')
  })
  it('does not expose private or unset third-party dates and cannot edit a public peer', async () => {
    for (const value of [{ access: 'PRIVATE' }, { access: 'ALLOWED', data: null }] as Access<Birthday | null>[]) { const h = await mount(value, false);expect(h.container.textContent).toBe('') }
    const h = await mount({ access: 'ALLOWED', data: { day: 17, month: 10 } }, false);expect(h.container.textContent).toContain('17 octobre');expect(h.container.querySelector('button')).toBeNull()
  })
  it('keeps an ambiguous retry on the same confirmed date and exposes an accessible error', async () => {
    const save = vi.fn< (day: number, month: number) => Promise<Birthday> >().mockRejectedValueOnce(Error('Network unavailable')).mockResolvedValue({ day: 1, month: 1 })
    const h = await mount(undefined, true, save);await h.click('Définir mon anniversaire');await act(async()=>h.container.querySelector<HTMLButtonElement>('[data-day="1"]')!.click());await h.click('Confirmer');await h.click('Confirmer définitivement');expect(h.container.querySelector('[role="alert"]')).not.toBeNull();await h.click('Confirmer définitivement');expect(save.mock.calls).toEqual([[1, 1], [1, 1]])
  })
  it('offers only Public and Private for birthday privacy', async () => {
    const container = document.createElement('div');document.body.append(container);const root = createRoot(container);roots.push(root)
    const actions = { privacy: async () => ({ version: 4, settings: [{ categoryKey: 'BIRTHDAY', level: 'PRIVATE' }] }) } as SocialActions
    await act(async () => root.render(<PrivacySettingsPanel actions={actions} />))
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Anniversaire"]')!
    expect(Array.from(select.options).map(o => o.value)).toEqual(['PUBLIC', 'PRIVATE']);expect(select.value).toBe('PRIVATE')
  })
})

it('supports calendar keyboard navigation and Retour without saving prematurely',async()=>{
 const h=await mount();await h.click('Définir mon anniversaire')
 const day=h.container.querySelector<HTMLButtonElement>('[data-day="1"]')!;day.focus()
 await act(async()=>day.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})))
 expect(document.activeElement?.getAttribute('data-day')).toBe('2')
 await h.click('Confirmer');await h.click('Retour');expect(h.onSave).not.toHaveBeenCalled()
 expect(h.container.querySelector('[data-day="2"]')?.getAttribute('aria-selected')).toBe('true')
 await h.click('Annuler');expect(h.onSave).not.toHaveBeenCalled();expect(h.container.querySelector('[role="dialog"]')).toBeNull()
})
it('blocks double submit and Escape through the definitive request',async()=>{
 let resolve!:(value:Birthday)=>void;const save=vi.fn(()=>new Promise<Birthday>(done=>resolve=done))
 const h=await mount(undefined,true,save);await h.click('Définir mon anniversaire')
 await act(async()=>h.container.querySelector<HTMLButtonElement>('[data-day="1"]')!.click());await h.click('Confirmer')
 const yes=Array.from(h.container.querySelectorAll('button')).find(b=>b.textContent==='Confirmer définitivement')!
 await act(async()=>{yes.click();yes.click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))})
 expect(save).toHaveBeenCalledOnce();expect(h.container.querySelector('[role="alertdialog"]')).not.toBeNull()
 await act(async()=>{resolve({day:1,month:1});await Promise.resolve()});expect(h.container.querySelector('[role="alertdialog"]')).toBeNull()
})
