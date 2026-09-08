import { ApiError } from './game-api'

export function isAmbiguousMutationError(error: unknown): boolean {
  return error instanceof ApiError && (
    error.code === 'NETWORK_ERROR'
    || error.code === 'INTERNAL_ERROR'
    || (error.status !== null && error.status >= 500)
  )
}
