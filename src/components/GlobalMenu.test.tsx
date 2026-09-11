// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultNavigationPreference, navigationDestinations } from '../navigation/navigation'
import GlobalMenu from './GlobalMenu'

const roots: ReturnType<typeof createRoot>[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren() })
describe('GlobalMenu', () => {
  it('renders at most nine slots, pages without resizing its structure, navigates real destinations and closes on Escape', () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
    const onNavigate = vi.fn(); const onClose = vi.fn()
    let page = 1; const onPageChange = vi.fn((next: number) => { page = next; act(() => root.render(<GlobalMenu preference={defaultNavigationPreference} page={page} onPageChange={onPageChange} onNavigate={onNavigate} onClose={onClose} />)) })
    act(() => root.render(<GlobalMenu preference={defaultNavigationPreference} page={page} onPageChange={onPageChange} onNavigate={onNavigate} onClose={onClose} />))
    expect(container.querySelectorAll('.global-menu-grid > button')).toHaveLength(9)
    expect(container.textContent).toContain('Page 1 / 2')
    const renderedIds = Array.from(container.querySelectorAll<HTMLElement>('[data-destination-id]'), ({ dataset }) => dataset.destinationId)
    act(() => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Suivant')!.click())
    renderedIds.push(...Array.from(container.querySelectorAll<HTMLElement>('[data-destination-id]'), ({ dataset }) => dataset.destinationId))
    expect(renderedIds).toEqual(navigationDestinations.map(({ id }) => id))
    expect(new Set(renderedIds).size).toBe(renderedIds.length)
    expect(renderedIds).toContain('catalog')
    expect(container.querySelectorAll('.global-menu-grid > button').length).toBeLessThanOrEqual(9)
    expect(container.textContent).toContain('Historique')
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.global-menu-grid > button')).find((button) => button.textContent?.includes('Historique'))?.disabled).toBe(true)
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(onClose).toHaveBeenCalled()
    act(() => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Précédent')!.click())
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('.global-menu-grid > button')).find((button) => button.textContent?.includes('Accueil'))!.click())
    expect(onNavigate).toHaveBeenCalledWith('home')
  })
  it('is controlled, excludes every hidden id, and clamps an obsolete page', async () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
    const hidden = defaultNavigationPreference.order.slice(0, 10)
    const onPageChange = vi.fn()
    await act(async () => { root.render(<GlobalMenu preference={{ ...defaultNavigationPreference, hidden }} page={2} onPageChange={onPageChange} onNavigate={vi.fn()} onClose={vi.fn()} />); await Promise.resolve() })
    expect(onPageChange).toHaveBeenCalledWith(1)
    hidden.forEach((id) => expect(container.querySelector(`[data-destination-id="${id}"]`)).toBeNull())
    expect(Array.from(container.querySelectorAll<HTMLElement>('[data-destination-id]'), ({ dataset }) => dataset.destinationId)).toEqual(defaultNavigationPreference.order.filter((id) => !hidden.includes(id)))
    expect(container.textContent).toContain('Page 1 / 1')
  })
})
