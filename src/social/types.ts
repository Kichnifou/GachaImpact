import type { BoxCharacterDto, ElementKey, InventoryItemDto, PermanentMissionProjectionDto, PlayerMissionsDto, PlayerTeamDto } from '../api/types'

export type Access<T> = { access: 'PRIVATE' } | { access: 'ALLOWED'; data: T }
export type PresenceStatus = 'ONLINE' | 'AWAY' | 'OFFLINE'
export type RelationshipState = 'SELF' | 'FRIEND' | 'SENT' | 'RECEIVED' | 'NONE'
export type RelationshipFilter = RelationshipState | 'ALL'
export type SocialIdentity = { id: string; displayName: string; level: number; elementKey: ElementKey | null }
export type DirectoryQuery = { q: string; element?: ElementKey; status?: PresenceStatus; relation?: Exclude<RelationshipFilter, 'ALL'>; page: number }
export type DirectoryPage = { players: (SocialIdentity & { presence: Access<PresenceStatus>; relation: RelationshipState; requestId: string | null })[]; page: number; pageSize: number; total: number; totalPages: number }
export type FriendSort = 'presence' | 'name' | 'level' | 'heart'
export type FriendAction = 'ADD' | 'ACCEPT' | 'REFUSE' | 'CANCEL' | 'REMOVE'
export type FriendsSnapshot = {
  businessDate: string; sort: FriendSort; totalFriendHeartsSent: string
  players: (SocialIdentity & { presence: Access<PresenceStatus> })[]
  friends: { id: string; playerId: string; level: number; tier: string; totalHearts: string; heartSent: boolean; canSend: boolean }[]
  requests: { id: string; playerId: string; direction: 'SENT' | 'RECEIVED'; createdAt: string }[]
  summary: { activeFriends: number; available: number; alreadySent: number }
}
export type HeartResult = { sent: number; alreadySent: number; unavailable: number; activeFriends: number; senderReward: string; recipientReward: string; status: 'SENT' | 'NO_FRIENDS' | 'ALL_SENT' | 'UNAVAILABLE'; level?: number; tier?: string; message?: string }
export type ConnectedPlayers = { players: (SocialIdentity & { status: 'ONLINE' | 'AWAY' })[]; total: number }
export type Profile = {
  player: SocialIdentity; own: boolean; presence: Access<PresenceStatus>; lastActivity: Access<string | null>
  team: Access<PlayerTeamDto | null>; box: Access<Omit<BoxCharacterDto, 'favorite' | 'c6CompetitionStats'>[]>; collection: Access<InventoryItemDto[]>
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
  friends: () => Promise<FriendsSnapshot>
  friendAction: (targetPlayerId: string, action: FriendAction, idempotencyKey: string, requestId?: string) => Promise<{ state: string }>
  sendHearts: (targetPlayerId: string, idempotencyKey: string) => Promise<HeartResult>
  saveFriendSort: (sort: FriendSort) => Promise<{ sort: FriendSort }>
  directory: (query: DirectoryQuery) => Promise<DirectoryPage>
  profile: (id: string) => Promise<Profile>
  ownMissions: () => Promise<PlayerMissionsDto>
  playerMissions: (id: string) => Promise<Access<PermanentMissionProjectionDto>>
  connected: () => Promise<ConnectedPlayers>
  privacy: () => Promise<PrivacySettings>
  savePrivacy: (categoryKey: PrivacyCategory, level: PrivacyLevel) => Promise<PrivacySettings>
  session: (sessionKey: string, activity: boolean) => Promise<unknown>
  heartbeat: (sessionKey: string, activity: boolean) => Promise<unknown>
  end: (sessionKey: string) => Promise<unknown>
}
export const presenceLabels: Record<PresenceStatus, string> = { ONLINE: 'En ligne', AWAY: 'Absent', OFFLINE: 'Hors ligne' }
