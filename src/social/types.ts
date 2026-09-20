import type { BoxCharacterDto, ElementKey, InventoryItemDto, PlayerTeamDto } from '../api/types'

export type Access<T> = { access: 'PRIVATE' } | { access: 'ALLOWED'; data: T }
export type PresenceStatus = 'ONLINE' | 'AWAY' | 'OFFLINE'
export type SocialIdentity = { id: string; displayName: string; level: number; elementKey: ElementKey | null }
export type DirectoryQuery = { q: string; element?: ElementKey; page: number }
export type DirectoryPage = { players: (SocialIdentity & { presence: Access<PresenceStatus> })[]; page: number; pageSize: number; total: number; totalPages: number }
export type ConnectedPlayers = { players: (SocialIdentity & { status: 'ONLINE' | 'AWAY' })[]; total: number }
export type Profile = {
  player: SocialIdentity; own: boolean; presence: Access<PresenceStatus>; lastActivity: Access<string | null>
  team: Access<PlayerTeamDto | null>; box: Access<Omit<BoxCharacterDto, 'favorite'>[]>; collection: Access<InventoryItemDto[]>
  statistics: Access<{ totalXp: string | null; totalPulls: string | null; totalFiveStars: string | null; totalFourStars: string | null; combatWins: string | null; expeditionsCompleted: string | null }>
}
export const privacyLabels = {
  ACTIVE_TEAM: 'Team active', BOX: 'Box', COLLECTION: 'Collection', GENERAL_STATISTICS: 'Statistiques générales',
  MISSIONS: 'Missions', LAST_ACTIVITY: 'Dernière activité', PITY_GUARANTEE: 'Pity / garantie', PRIVATE_MESSAGES: 'Autorisation MP', PRESENCE: 'Présence',
  FRIEND_LIST: 'Liste d’amis', CURRENCY_BALANCES: 'Soldes de monnaies', BANK: 'Banque', INVENTORY: 'Sac', SAVED_TEAMS: 'Saved Teams',
  ACTIVE_EXPEDITION: 'Expédition active', DAILY_COMBAT: 'Combat quotidien', BOSS_STATE: 'Slots / KO / Boss', DETAILED_HISTORY: 'Historiques détaillés',
} as const
export type PrivacyCategory = keyof typeof privacyLabels
export type PrivacyLevel = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
export type PrivacySettings = { version: number; settings: { categoryKey: PrivacyCategory; level: PrivacyLevel }[] }
export type SocialActions = {
  directory: (query: DirectoryQuery) => Promise<DirectoryPage>
  profile: (id: string) => Promise<Profile>
  connected: () => Promise<ConnectedPlayers>
  privacy: () => Promise<PrivacySettings>
  savePrivacy: (categoryKey: PrivacyCategory, level: PrivacyLevel) => Promise<PrivacySettings>
  session: (sessionKey: string, activity: boolean) => Promise<unknown>
  heartbeat: (sessionKey: string, activity: boolean) => Promise<unknown>
  end: (sessionKey: string) => Promise<unknown>
}
export const presenceLabels: Record<PresenceStatus, string> = { ONLINE: 'En ligne', AWAY: 'Absent', OFFLINE: 'Hors ligne' }
