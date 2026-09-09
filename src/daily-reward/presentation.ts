import type { DailyRewardTodayDto, ElementKey } from '../api/types'
import { elementLabels, formatResourceAmount } from '../utils/formatters'

export function formatDailyRewardDetails(today: DailyRewardTodayDto, elementKey: ElementKey) {
  return `+${formatResourceAmount(today.rewards.primogems)} Primos · +${formatResourceAmount(today.rewards.mainElementParticles)} particules ${elementLabels[elementKey]} · +${formatResourceAmount(today.rewards.moras)} Moras`
}
