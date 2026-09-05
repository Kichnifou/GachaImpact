import type { DailyRewardClaimDto, PlayerResourcesDto } from '../api/types'

type DailyRewardApi = Readonly<{
  claimDailyReward: () => Promise<DailyRewardClaimDto>
  getResources: () => Promise<PlayerResourcesDto>
}>

export async function claimDailyRewardAndRefresh(api: DailyRewardApi) {
  const result = await api.claimDailyReward()
  const resources = await api.getResources()
  return { result, resources }
}
