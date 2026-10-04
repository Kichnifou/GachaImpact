// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { BootstrapReaders } from './bootstrap/load-game-state'
import AppBootstrap from './AppBootstrap'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({ boss: vi.fn(), player: vi.fn(), signOut: vi.fn() }))
vi.mock('./auth/auth-context', () => ({ useAuth: () => ({ status: 'signedIn', session: { user: { id: 'bootstrap-player' } }, signOut: mocks.signOut }) }))
vi.mock('./api/game-api', async importOriginal => {
  const actual = await importOriginal<typeof import('./api/game-api')>()
  return { ...actual, getGameApiClient: () => ({ social: {}, getCurrentPlayer: mocks.player, getMonthlyBoss: mocks.boss }) }
})
vi.mock('./bootstrap/load-game-state', async importOriginal => {
  const actual = await importOriginal<typeof import('./bootstrap/load-game-state')>()
  return { ...actual, loadBootstrapGameState: (readers: BootstrapReaders) => actual.retryBootstrapRead(readers.monthlyBoss) }
})

describe('fatal bootstrap display', () => {
  it('replaces the loader with Connexion impossible after a required Boss read definitively fails', async () => {
    const { ApiError } = await import('./api/game-api')
    mocks.player.mockResolvedValue({ id: 'bootstrap-player', displayName: 'Fixture', elementKey: 'hydro', status: 'ACTIVE' })
    mocks.boss.mockRejectedValue(new ApiError('HTTP_500', 'Boss unavailable', 500))
    const container = document.createElement('div')
    const root = createRoot(container)
    try {
      await act(async () => root.render(<AppBootstrap />))
      expect(mocks.boss).toHaveBeenCalledTimes(2)
      expect(container.textContent).toContain('Connexion impossible')
      expect(container.textContent).not.toContain('Connexion aux astres')
      expect(mocks.signOut).not.toHaveBeenCalled()
    } finally {
      act(() => root.unmount())
      container.remove()
      vi.clearAllMocks()
    }
  })
})
