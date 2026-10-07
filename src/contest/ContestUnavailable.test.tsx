// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import ContestUnavailable from './ContestUnavailable'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it('shows a retry after failure, suppresses duplicate pending requests and displays no invented result', async () => {
  const container = document.createElement('div'), root = createRoot(container)
  const retry = vi.fn(async () => { throw new Error('still unavailable') })
  try {
    await act(async () => root.render(<ContestUnavailable availability={{ phase: 'unavailable', pending: false }} onRetry={retry} />))
    expect(container.textContent).toContain('Concours indisponible')
    const button = container.querySelector('button')!
    expect(button.className).toContain('app-button')
    await act(async () => button.click())
    expect(retry).toHaveBeenCalledOnce()
    await act(async () => root.render(<ContestUnavailable availability={{ phase: 'unavailable', pending: true }} onRetry={retry} />))
    expect(container.querySelector('button')?.disabled).toBe(true)
    expect(container.textContent).toContain('continuer à jouer')
    expect(container.textContent).not.toContain('Titan')
    expect(container.textContent).not.toContain('Force')
  } finally { act(() => root.unmount()) }
})
