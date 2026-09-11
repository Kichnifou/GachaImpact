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

    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.getAttribute('aria-label') === 'Descendre Accueil')!.click())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ order: ['invocation', 'home', ...defaultNavigationPreference.order.slice(2)] }))

    const configurationRow = Array.from(container.querySelectorAll('li')).find((row) => row.textContent?.includes('Configuration'))!
    expect(Array.from(configurationRow.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Masquer')?.disabled).toBe(true)

    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Réinitialiser')!.click())
    expect(onReset).toHaveBeenCalledOnce()
  })
})
