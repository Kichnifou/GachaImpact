// @vitest-environment happy-dom
import { act } from 'react'
import { readFileSync } from 'node:fs'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultNavigationPreference } from '../navigation/navigation'
import ConfigurationScreen from './ConfigurationScreen'
import configurationSource from './ConfigurationScreen.tsx?raw'

const appCssSource = readFileSync('src/App.css', 'utf8')
const globalCssSource = readFileSync('src/index.css', 'utf8')

const roots: ReturnType<typeof createRoot>[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren(); document.head.replaceChildren() })

describe('ConfigurationScreen', () => {
  it.each([['Profil', 'profile'], ['Arcade', 'arcade']] as const)('allows ordering and hiding/showing %s with the existing preference', async (label, id) => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
    const onSave = vi.fn().mockResolvedValue(undefined)
    const render = (hidden: typeof defaultNavigationPreference.hidden) => root.render(<ConfigurationScreen preference={{ ...defaultNavigationPreference, hidden }} onSave={onSave} onReset={vi.fn()} />)
    await act(async () => render([]))
    expect(Array.from(container.querySelectorAll('li strong'), node => node.textContent)).not.toContain('Activités')
    const row = () => Array.from(container.querySelectorAll('li')).find(node => node.querySelector('strong')?.textContent === label)!
    await act(async () => row().querySelector<HTMLButtonElement>('.menu-visibility-button')!.click())
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ hidden: [id] }))
    await act(async () => render([id]))
    expect(row().querySelector('.menu-visibility-button')?.textContent).toBe('Afficher')
    await act(async () => row().querySelector<HTMLButtonElement>('.menu-visibility-button')!.click())
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ hidden: [] }))
    await act(async () => row().querySelector<HTMLButtonElement>(`[aria-label="Monter ${label}"]`)!.click())
    const order = onSave.mock.calls.at(-1)![0].order
    expect(order.indexOf(id)).toBe(defaultNavigationPreference.order.indexOf(id) - 1)
  })
  it('reserves three desktop grid tracks with specificity above the generic two-track screen', () => {
    expect(appCssSource).toMatch(/\.configuration-screen\.long-screen-layout:has\(> \.screen-header\)\s*\{\s*grid-template-rows:\s*auto auto minmax\(0, 1fr\);/)
  })
  it('offers accessible ordering, visibility and reset controls without allowing Configuration to be hidden', async () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
    const onSave = vi.fn().mockResolvedValue(undefined); const onReset = vi.fn().mockResolvedValue(undefined)
    await act(async () => root.render(<ConfigurationScreen preference={defaultNavigationPreference} onSave={onSave} onReset={onReset} />))

    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('.configuration-tabs button'))
    expect(tabs.map(({ textContent }) => textContent)).toEqual(['Menu', 'Confidentialité', 'Compte'])
    expect(tabs.map(({ disabled }) => disabled)).toEqual([false, true, false])
    const style = document.createElement('style'); style.textContent = globalCssSource; document.head.append(style)
    expect(tabs.map((tab) => window.getComputedStyle(tab).cursor)).toEqual(['pointer', 'not-allowed', 'pointer'])
    expect(container.querySelector('.configuration-frame .scrollable-screen-panel-body .screen-header')).toBeNull()
    expect(container.querySelector('.configuration-frame .scrollable-screen-panel-body .configuration-tabs')).toBeNull()
    expect(container.querySelector('.menu-scroll-frame .menu-configuration-list')).not.toBeNull()
    expect(container.querySelector('.scrollable-screen-panel-controls .menu-configuration-heading')).not.toBeNull()
    expect(container.querySelector('.menu-visibility-button')).not.toBeNull()
    expect(Array.from(container.querySelectorAll('li')).every((row) => row.getAttribute('draggable') === null)).toBe(true)

    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.getAttribute('aria-label') === 'Descendre Accueil')!.click())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ order: ['profile', 'home', ...defaultNavigationPreference.order.slice(2)] }))

    const configurationRow = Array.from(container.querySelectorAll('li')).find((row) => row.textContent?.includes('Configuration'))!
    expect(Array.from(configurationRow.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Masquer')?.disabled).toBe(true)

    const bankVisibility = Array.from(container.querySelectorAll<HTMLButtonElement>('.menu-visibility-button')).find((button) => button.closest('li')?.textContent?.includes('Banque'))!
    await act(async () => { bankVisibility.click(); await Promise.resolve() })
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ hidden: expect.arrayContaining(['bank']) }))
    await act(async () => root.render(<ConfigurationScreen preference={{ ...defaultNavigationPreference, hidden: ['bank'] }} onSave={onSave} onReset={onReset} />))
    const showBank = Array.from(container.querySelectorAll<HTMLButtonElement>('.menu-visibility-button')).find((button) => button.closest('li')?.textContent?.includes('Banque'))!
    expect(showBank.textContent).toBe('Afficher')
    await act(async () => { showBank.click(); await Promise.resolve() })
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ hidden: expect.not.arrayContaining(['bank']) }))

    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Réinitialiser')!.click())
    expect(onReset).toHaveBeenCalledOnce()
  })
  it('contains no Configuration drag-and-drop implementation or styling', () => {
    for (const fragment of ['draggable', 'DragEvent', 'dropIntent', 'onDragStart', 'onDragOver', 'onDrop', 'onDragEnd', 'dropEffect']) expect(configurationSource).not.toContain(fragment)
    expect(appCssSource).not.toContain('menu-drop-zone')
    expect(appCssSource).not.toContain('drop-swap')
    expect(appCssSource).not.toContain('cursor: grab')
    expect(appCssSource).not.toContain('cursor: grabbing')
  })

  it('rolls an optimistic arrow change back when persistence fails', async () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
    const onSave = vi.fn().mockRejectedValue(new Error('offline'))
    await act(async () => root.render(<ConfigurationScreen preference={defaultNavigationPreference} onSave={onSave} onReset={vi.fn()} />))
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.getAttribute('aria-label') === 'Descendre Accueil')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(Array.from(container.querySelectorAll('li strong'), (node) => node.textContent).slice(0, 2)).toEqual(['Accueil', 'Profil'])
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
  })
})
