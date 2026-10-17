// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { SharedInvocationController } from '../gacha/use-shared-invocations'
import SharedInvocationControls from './SharedInvocationControls'
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
it('shows confirmed zero, one or several broadcasters accessibly, and omits unknown/watching counts', () => {
  const container = document.createElement('div'), root = createRoot(container)
  const shared = { enabled: true, pending: false, error: '', availableCount: null, state: { broadcasting: null, watching: null }, watch: vi.fn() } as unknown as SharedInvocationController
  const render = () => act(() => root.render(<SharedInvocationControls shared={shared} />))
  render(); expect(container.querySelector('.shared-available-count')).toBeNull()
  for (const count of [0, 1, 3]) {
    shared.availableCount = count; render()
    expect(container.querySelector('.shared-available-count')?.textContent).toBe(String(count))
    expect(container.querySelector('[aria-label^="Voir"]')?.getAttribute('aria-label')).toContain(`${count} diffusion`)
  }
  shared.state.watching = { id: 'session' } as NonNullable<typeof shared.state.watching>; render()
  expect(container.querySelector('.shared-available-count')).toBeNull()
  expect(container.textContent).toContain('Arrêter')
  act(() => root.unmount())
})
