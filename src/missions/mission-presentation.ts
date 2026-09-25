import type { PermanentMissionDto, PermanentMissionProjectionDto, PermanentMissionRankDto } from '../api/types'

export const lockedZMessage = 'Le rang Z sera accessible après accomplissement de toutes les missions des rangs B, A et S.'

export function preferredMissionRank(view: PermanentMissionProjectionDto): PermanentMissionRankDto {
  for (const rank of ['B', 'A', 'S'] as const) {
    if (view.ranks[rank].some(mission => mission.status !== 'COMPLETED')) return rank
  }
  return 'Z'
}

export function orderMissionCards(missions: readonly PermanentMissionDto[]): readonly PermanentMissionDto[] {
  return [
    ...missions.filter(mission => mission.status !== 'COMPLETED'),
    ...missions.filter(mission => mission.status === 'COMPLETED'),
  ]
}

export function progressPercent(progress: string, target: string): number {
  try {
    const safeTarget = BigInt(target)
    if (safeTarget <= 0n) return 100
    const safeProgress = BigInt(progress)
    if (safeProgress <= 0n) return 0
    if (safeProgress >= safeTarget) return 100
    return Number((safeProgress * 10_000n) / safeTarget) / 100
  } catch {
    return 0
  }
}
