import type { PlayerProgressionDto } from '../api/types'
import { buildLevelUpFeedback, type LevelUpFeedbackEvent, type LevelUpReward } from './level-up-feedback'

/**
 * Shared client-side progression publication contract. Future XP producers must
 * publish their authoritative server snapshot through this primitive instead of
 * coupling level-up feedback to their current screen.
 */
export function publishProgressionUpdate(
  previous: PlayerProgressionDto | null,
  next: PlayerProgressionDto,
  options: Readonly<{ id: string; rewards?: readonly LevelUpReward[]; emitLevelUpFeedback?: boolean }>,
): Readonly<{ progression: PlayerProgressionDto; feedback: LevelUpFeedbackEvent | null }> {
  return {
    progression: next,
    feedback: options.emitLevelUpFeedback === false ? null : buildLevelUpFeedback(previous, next, options.rewards ?? [], options.id),
  }
}
