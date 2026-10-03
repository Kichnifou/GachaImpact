import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js'
import type { GetCurrentPlayer } from '../player/get-current-player.js'
import { AppError } from '../../api/errors.js'

export const tutorialPreferenceKey = 'tutorial_v1'
export const tutorialAutostartKey = 'tutorial_v1_autostart'
export const tutorialStepIds = ["profile","resources","active-team","objective","daily-tracker","main-navigation","home","community","menu-entry","menu-destinations","notifications-entry","notifications-panel","invocation-banner","invocation-target","invocation-characters","invocation-progress","invocation-actions","invocation-detail","box-filters","box-possessions","box-character","box-stella","box-expedition","team-selection","team-management","team-composition","team-passives","catalog-filters","catalog-votes","dailies-overview","dailies-wheel","dailies-challenge","missions-ranks","missions-progress","missions-secret-z","combat-enemies","combat-formation","combat-preview","combat-action","boss-identity","boss-formation","boss-action","boss-bilan","boss-stats","boss-history","event-general","event-bonuses","event-daily-bonus","event-milestones","event-game-a","event-game-b","event-game-c","event-shop","event-ranking","arcade-memory","arcade-connect-four","arcade-tic-tac-toe","arcade-board","arcade-rules","arcade-scores","arcade-records","contest-legends","contest-lobby","contest-play","contest-history","inventory-all","inventory-resources","inventory-objects","inventory-detail","inventory-collection","inventory-conversion","bank-balances","bank-interest","bank-transfer","bank-history","shop-catalog","shop-tickets","shop-wallet","codes-available","codes-claimed","social-friends","social-requests","social-players","social-profiles","trades-stocks","trades-partners","trades-received","trades-sent","trades-history","profile-overview","profile-team","profile-box","profile-collection","profile-statistics","profile-missions","profile-avatars","profile-titles","rankings-categories","rankings-list","history-invocations","history-banners","history-bank","history-shop","history-event","chat-thread","chat-composer","community-players","dm-conversations","dm-archives","dm-new","dm-thread","dm-history","configuration-menu","configuration-privacy","configuration-account","conclusion"] as const
export type TutorialStepId = typeof tutorialStepIds[number]
// Retired presentation steps remain readable during rolling frontend deployments.
export const tutorialStepAliases = { 'menu-pagination': 'notifications-entry', 'event-calendar': 'arcade-memory' } as const satisfies Record<string, TutorialStepId>
export type TutorialPreferenceDto = Readonly<{ version: 1; status: 'NOT_STARTED' | 'COMPLETED'; stepId: null } | { version: 1; status: 'IN_PROGRESS'; stepId: TutorialStepId }>
export const defaultTutorialPreference: TutorialPreferenceDto = { version: 1, status: 'NOT_STARTED', stepId: null }

export function isTutorialPreference(value: unknown): value is TutorialPreferenceDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== 3 || record.version !== 1) return false
  if (record.status === 'IN_PROGRESS') return tutorialStepIds.includes(record.stepId as TutorialStepId)
  return (record.status === 'NOT_STARTED' || record.status === 'COMPLETED') && record.stepId === null
}
export function normalizeTutorialPreference(value: unknown): TutorialPreferenceDto | null {
  if (isTutorialPreference(value)) return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== 3 || record.version !== 1 || record.status !== 'IN_PROGRESS' || typeof record.stepId !== 'string') return null
  const stepId = Object.hasOwn(tutorialStepAliases, record.stepId) ? tutorialStepAliases[record.stepId as keyof typeof tutorialStepAliases] : null
  return stepId ? { version: 1, status: 'IN_PROGRESS', stepId } : null
}
export interface TutorialPreferenceStore {
  read(playerId: string): Promise<unknown>
  write(playerId: string, value: TutorialPreferenceDto): Promise<void>
  claimAutostart(playerId: string): Promise<TutorialAutostartDto>
}
export type TutorialAutostartDto = { shouldLaunch: false } | { shouldLaunch: true; preference: TutorialPreferenceDto & { status: 'IN_PROGRESS' } }
export function autostartPreference(value: unknown): TutorialPreferenceDto & { status: 'IN_PROGRESS' } {
  const saved = normalizeTutorialPreference(value)
  return saved?.status === 'IN_PROGRESS' ? saved : { version: 1, status: 'IN_PROGRESS', stepId: 'profile' }
}
export class TutorialPreferencesService {
  constructor(private readonly getCurrentPlayer: GetCurrentPlayer, private readonly store: TutorialPreferenceStore) {}
  async claimAutostart(identity: AuthenticatedIdentity): Promise<TutorialAutostartDto> {
    const player = await this.getCurrentPlayer.execute(identity)
    return this.store.claimAutostart(player.id)
  }
  async get(identity: AuthenticatedIdentity): Promise<TutorialPreferenceDto> {
    const player = await this.getCurrentPlayer.execute(identity)
    const value = await this.store.read(player.id)
    return normalizeTutorialPreference(value) ?? defaultTutorialPreference
  }
  async put(identity: AuthenticatedIdentity, value: unknown): Promise<TutorialPreferenceDto> {
    const canonical = normalizeTutorialPreference(value)
    if (!canonical) throw new AppError('L’état du Tutoriel est invalide.', 400, 'VALIDATION_ERROR')
    const player = await this.getCurrentPlayer.execute(identity)
    await this.store.write(player.id, canonical)
    return canonical
  }
}
