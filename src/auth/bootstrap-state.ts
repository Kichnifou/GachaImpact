import type { AuthStatus } from './auth-context'
import type { PlayerDto } from '../api/types'

export type BootstrapStage =
  | 'loading'
  | 'configurationError'
  | 'signedOut'
  | 'onboarding'
  | 'elementRequired'
  | 'ready'

export function resolveBootstrapStage(
  authStatus: AuthStatus,
  player: PlayerDto | null,
  playerResolved: boolean,
  gameStateResolved = true,
): BootstrapStage {
  if (authStatus === 'loading') return 'loading'
  if (authStatus === 'configurationError') return 'configurationError'
  if (authStatus === 'signedOut') return 'signedOut'
  if (!playerResolved) return 'loading'
  if (!player) return 'onboarding'
  if (!player.elementKey) return 'elementRequired'
  if (!gameStateResolved) return 'loading'
  return 'ready'
}
