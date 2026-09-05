import type { PlayerProgressionDto } from '../api/types'

export function getProgressionPercent(progression: PlayerProgressionDto): number {
  const current = Number(progression.xpIntoCurrentStep)
  const required = Number(progression.xpPerStep)

  if (!Number.isFinite(current) || !Number.isFinite(required) || required <= 0) return 0
  return Math.min(100, Math.max(0, (current / required) * 100))
}
