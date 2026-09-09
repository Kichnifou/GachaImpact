import type { GachaPullDto, PlayerProgressionDto } from '../api/types'
import { elementLabels, formatResourceAmount } from '../utils/formatters'

export type LevelUpReward = Readonly<{ resourceKey: string; amount: string }>

export type LevelUpFeedbackEvent = Readonly<{
  id: string
  levelsGained: number
  rewards: readonly LevelUpReward[]
}>

export function buildLevelUpFeedback(
  previous: PlayerProgressionDto | null,
  next: PlayerProgressionDto,
  rewards: readonly LevelUpReward[],
  id: string,
): LevelUpFeedbackEvent | null {
  if (!previous || next.level <= previous.level) return null
  const totals = new Map<string, bigint>()
  for (const reward of rewards) {
    const amount = BigInt(reward.amount)
    if (amount > 0n) totals.set(reward.resourceKey, (totals.get(reward.resourceKey) ?? 0n) + amount)
  }
  return {
    id,
    levelsGained: next.level - previous.level,
    rewards: [...totals].map(([resourceKey, amount]) => ({ resourceKey, amount: amount.toString() })),
  }
}

export function gachaLevelRewards(pull: GachaPullDto): readonly LevelUpReward[] {
  return pull.results.flatMap(({ bonusRewards }) => bonusRewards
    .filter(({ causeKey }) => causeKey === 'player.xp.level-reward')
    .map(({ resourceKey, amount }) => ({ resourceKey, amount })))
}

export function levelUpTitle(levelsGained: number): string {
  return levelsGained === 1 ? 'Niveau supérieur !' : `${levelsGained} niveaux gagnés !`
}

export function levelUpRewardLabel(reward: LevelUpReward): string {
  const particle = /^particles_(pyro|hydro|cryo|electro|anemo|geo|dendro)$/.exec(reward.resourceKey)
  const label = reward.resourceKey === 'primogems'
    ? 'Primos'
    : reward.resourceKey === 'moras'
      ? 'Moras'
      : particle
        ? elementLabels[particle[1] as keyof typeof elementLabels]
        : reward.resourceKey
  return `+${formatResourceAmount(reward.amount)} ${label}`
}
