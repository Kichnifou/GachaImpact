// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDirectMessageDocumentTitle } from './use-direct-message-document-title'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Title({ count, playerId = 'alice' }: { count: number; playerId?: string }) {
  useDirectMessageDocumentTitle(count, playerId)
  return null
}

afterEach(() => { vi.useRealTimers(); document.title = 'GachaImpact'; document.body.replaceChildren() })

describe('direct message browser title', () => {
  it('uses total unread count, alternates slowly, and cleans up on read, player change and unmount', async () => {
    vi.useFakeTimers()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    try {
      await act(async () => { root.render(<Title count={0} />) })
      expect(document.title).toBe('GachaImpact')
      await act(async () => { root.render(<Title count={1} />) })
      expect(document.title).toBe('Vous avez 1 nouveau message !')
      await act(async () => { vi.advanceTimersByTime(1_350) })
      expect(document.title).toBe('GachaImpact')
      await act(async () => { vi.advanceTimersByTime(1_350) })
      expect(document.title).toBe('Vous avez 1 nouveau message !')
      await act(async () => { root.render(<Title count={2} />) })
      expect(document.title).toBe('Vous avez de nouveaux messages !')
      await act(async () => { root.render(<Title count={0} />) })
      expect(document.title).toBe('GachaImpact')
      expect(vi.getTimerCount()).toBe(0)
      await act(async () => { root.render(<Title count={1} playerId="bob" />) })
      expect(document.title).toBe('Vous avez 1 nouveau message !')
      await act(async () => { root.unmount() })
      expect(document.title).toBe('GachaImpact')
      expect(vi.getTimerCount()).toBe(0)
    } finally { if (container.isConnected) container.remove() }
  })
})
