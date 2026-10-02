import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js'
import type { GetCurrentPlayer } from '../player/get-current-player.js'
import { AppError } from '../../api/errors.js'

export const tutorialPreferenceKey = 'tutorial_v1'
export const tutorialStepIds = ['profile', 'resources', 'active-team', 'objective', 'daily-tracker', 'main-navigation', 'home', 'community'] as const
export type TutorialStepId = typeof tutorialStepIds[number]
export type TutorialPreferenceDto = Readonly<{ version: 1; status: 'NOT_STARTED' | 'COMPLETED'; stepId: null } | { version: 1; status: 'IN_PROGRESS'; stepId: TutorialStepId }>
export const defaultTutorialPreference: TutorialPreferenceDto = { version: 1, status: 'NOT_STARTED', stepId: null }

export function isTutorialPreference(value: unknown): value is TutorialPreferenceDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== 3 || record.version !== 1) return false
  if (record.status === 'IN_PROGRESS') return tutorialStepIds.includes(record.stepId as TutorialStepId)
  return (record.status === 'NOT_STARTED' || record.status === 'COMPLETED') && record.stepId === null
}
export interface TutorialPreferenceStore {
  read(playerId: string): Promise<unknown>
  write(playerId: string, value: TutorialPreferenceDto): Promise<void>
}
export class TutorialPreferencesService {
  constructor(private readonly getCurrentPlayer: GetCurrentPlayer, private readonly store: TutorialPreferenceStore) {}
  async get(identity: AuthenticatedIdentity): Promise<TutorialPreferenceDto> {
    const player = await this.getCurrentPlayer.execute(identity)
    const value = await this.store.read(player.id)
    return isTutorialPreference(value) ? value : defaultTutorialPreference
  }
  async put(identity: AuthenticatedIdentity, value: unknown): Promise<TutorialPreferenceDto> {
    if (!isTutorialPreference(value)) throw new AppError('L’état du Tutoriel est invalide.', 400, 'VALIDATION_ERROR')
    const player = await this.getCurrentPlayer.execute(identity)
    await this.store.write(player.id, value)
    return value
  }
}
