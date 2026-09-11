// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultNavigationPreference } from '../navigation/navigation'
import ConfigurationScreen from './ConfigurationScreen'

const roots: ReturnType<typeof createRoot>[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren() })

describe('ConfigurationScreen', () => {
  it('offers accessible ordering, visibility and reset controls without allowing Configuration to be hidden', async () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
    const onSave = vi.fn().mockResolvedValue(undefined); const onReset = vi.fn().mockResolvedValue(undefined)
    await act(async () => root.render(<ConfigurationScreen preference={defaultNavigationPreference} onSave={onSave} onReset={onReset} />))

    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('.configuration-tabs button'))
    expect(tabs.map(({ textContent }) => textContent)).toEqual(['Menu', 'Confidentialité', 'Apparence'])
    expect(tabs.map(({ disabled }) => disabled)).toEqual([false, true, true])
    expect(container.querySelector('.configuration-frame .scrollable-screen-panel-body .screen-header')).toBeNull()
    expect(container.querySelector('.configuration-frame .scrollable-screen-panel-body .configuration-tabs')).toBeNull()
    expect(container.querySelector('.menu-visibility-button')).not.toBeNull()

    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.getAttribute('aria-label') === 'Descendre Accueil')!.click())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ order: ['invocation', 'home', ...defaultNavigationPreference.order.slice(2)] }))

    const configurationRow = Array.from(container.querySelectorAll('li')).find((row) => row.textContent?.includes('Configuration'))!
    expect(Array.from(configurationRow.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Masquer')?.disabled).toBe(true)

    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Réinitialiser')!.click())
    expect(onReset).toHaveBeenCalledOnce()
  })
  it('previews drag ordering, saves exactly once on drop, and preserves hidden ids', async () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
    const preference = { ...defaultNavigationPreference, hidden: ['bank' as const] }
    const onSave = vi.fn().mockResolvedValue(undefined)
    await act(async () => root.render(<ConfigurationScreen preference={preference} onSave={onSave} onReset={vi.fn()} />))
    const rows = container.querySelectorAll('li')
    const event = (type: string, clientY = 0) => { const value = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(value, 'dataTransfer', { value: { effectAllowed: '' } }); Object.defineProperty(value, 'clientY', { value: clientY }); return value }
    Object.defineProperty(rows[2]!, 'getBoundingClientRect', { value: () => ({ top: 0, height: 100 }) })
    act(() => rows[0]!.dispatchEvent(event('dragstart')))
    act(() => rows[2]!.dispatchEvent(event('dragover', 100)))
    expect(onSave).not.toHaveBeenCalled()
    expect(rows[2]!.classList.contains('drop-after')).toBe(true)
    await act(async () => { rows[2]!.dispatchEvent(event('drop', 100)); await Promise.resolve(); await Promise.resolve() })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ order: ['invocation', 'box', 'home', ...defaultNavigationPreference.order.slice(3)], hidden: ['bank'] }))
  })

  it('distinguishes a centered swap and restores the confirmed order when dragging is abandoned', async () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
    const onSave = vi.fn().mockResolvedValue(undefined)
    await act(async () => root.render(<ConfigurationScreen preference={defaultNavigationPreference} onSave={onSave} onReset={vi.fn()} />))
    const event = (type: string, clientY = 0) => { const value = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(value, 'dataTransfer', { value: { effectAllowed: '' } }); Object.defineProperty(value, 'clientY', { value: clientY }); return value }
    let rows = container.querySelectorAll('li')
    Object.defineProperty(rows[2]!, 'getBoundingClientRect', { value: () => ({ top: 0, height: 100 }) })
    act(() => rows[0]!.dispatchEvent(event('dragstart')))
    act(() => rows[2]!.dispatchEvent(event('dragover', 50)))
    expect(rows[2]!.classList.contains('drop-swap')).toBe(true)
    expect(Array.from(container.querySelectorAll('li strong'), (node) => node.textContent).slice(0, 3)).toEqual(['Box', 'Invocation', 'Accueil'])
    await act(async () => { rows[0]!.dispatchEvent(event('dragend')); await Promise.resolve() })
    expect(onSave).not.toHaveBeenCalled()
    expect(Array.from(container.querySelectorAll('li strong'), (node) => node.textContent).slice(0, 3)).toEqual(['Accueil', 'Invocation', 'Box'])

    rows = container.querySelectorAll('li')
    act(() => rows[0]!.dispatchEvent(event('dragstart')))
    act(() => rows[2]!.dispatchEvent(event('dragover', 50)))
    await act(async () => { rows[2]!.dispatchEvent(event('drop', 50)); await Promise.resolve(); await Promise.resolve() })
    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ order: ['box', 'invocation', 'home', ...defaultNavigationPreference.order.slice(3)] }))
  })

  it('rolls an optimistic arrow change back when persistence fails', async () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
    const onSave = vi.fn().mockRejectedValue(new Error('offline'))
    await act(async () => root.render(<ConfigurationScreen preference={defaultNavigationPreference} onSave={onSave} onReset={vi.fn()} />))
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.getAttribute('aria-label') === 'Descendre Accueil')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(Array.from(container.querySelectorAll('li strong'), (node) => node.textContent).slice(0, 2)).toEqual(['Accueil', 'Invocation'])
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
  })
})
