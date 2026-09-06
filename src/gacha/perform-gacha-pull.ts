import { ApiError, type GameApiClient } from '../api/game-api'
import type { CurrentGachaDto, GachaPullDto, PlayerResourcesDto } from '../api/types'

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

export type GachaPullRefreshResult = Readonly<{
  result: GachaPullDto
  resources: PlayerResourcesDto | null
  gacha: CurrentGachaDto | null
  failedRefreshes: readonly ('resources' | 'gacha')[]
}>

export async function performGachaPullAndRefresh(api: GameApiClient, count: 1 | 10, idempotencyKey: string): Promise<GachaPullRefreshResult> {
  const result = await api.pullGacha(count, idempotencyKey)
  const [resourcesRefresh, gachaRefresh] = await Promise.allSettled([api.getResources(), api.getCurrentGacha()])
  const failedRefreshes: ('resources' | 'gacha')[] = []
  if (resourcesRefresh.status === 'rejected') failedRefreshes.push('resources')
  if (gachaRefresh.status === 'rejected') failedRefreshes.push('gacha')
  return {
    result,
    resources: resourcesRefresh.status === 'fulfilled' ? resourcesRefresh.value : null,
    gacha: gachaRefresh.status === 'fulfilled' ? gachaRefresh.value : null,
    failedRefreshes,
  }
}
