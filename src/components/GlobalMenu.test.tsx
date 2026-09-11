// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultNavigationPreference } from '../navigation/navigation'
import GlobalMenu from './GlobalMenu'

const roots: ReturnType<typeof createRoot>[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren() })
describe('GlobalMenu', () => {
  it('renders at most nine slots, pages without resizing its structure, navigates real destinations and closes on Escape', () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
    const onNavigate = vi.fn(); const onClose = vi.fn()
    act(() => root.render(<GlobalMenu preference={defaultNavigationPreference} onNavigate={onNavigate} onClose={onClose} />))
    expect(container.querySelectorAll('.global-menu-grid > button')).toHaveLength(9)
    expect(container.textContent).toContain('Page 1 / 2')
    act(() => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Suivant')!.click())
    expect(container.querySelectorAll('.global-menu-grid > button').length).toBeLessThanOrEqual(9)
    expect(container.textContent).toContain('Historique')
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.global-menu-grid > button')).find((button) => button.textContent?.includes('Historique'))?.disabled).toBe(true)
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(onClose).toHaveBeenCalled()
    act(() => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Précédent')!.click())
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('.global-menu-grid > button')).find((button) => button.textContent?.includes('Accueil'))!.click())
    expect(onNavigate).toHaveBeenCalledWith('home')
  })
})
