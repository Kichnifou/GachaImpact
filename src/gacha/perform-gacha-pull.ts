import { ApiError, type GameApiClient } from '../api/game-api'

const definitivePullErrorCodes = new Set([
  'INSUFFICIENT_PRIMOGEMS',
  'GACHA_TARGET_REQUIRED',
  'GACHA_TARGET_INVALID',
  'GACHA_BANNER_UNAVAILABLE',
  'GACHA_BANNER_INVALID',
  'GACHA_PULL_COUNT_INVALID',
  'GACHA_IDEMPOTENCY_CONFLICT',
])

export function shouldPreserveGachaPullIntent(error: unknown): boolean {
  if (!(error instanceof ApiError) || definitivePullErrorCodes.has(error.code)) return false
  return error.code === 'NETWORK_ERROR' || error.code === 'INTERNAL_ERROR' || (error.code.startsWith('HTTP_') && (error.status ?? 0) >= 500)
}

export async function performGachaPullAndRefresh(api: GameApiClient, count: 1 | 10, idempotencyKey: string) {
  const result = await api.pullGacha(count, idempotencyKey)
  const [resources, gacha] = await Promise.all([api.getResources(), api.getCurrentGacha()])
  return { result, resources, gacha }
}
