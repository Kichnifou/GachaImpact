import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js'
import type { ResourceKey } from '../../domain/economy/resources.js'

export type ModerationRole = 'MODERATOR' | 'TESTER' | 'ADMIN'
export type ModerationPlayerSort = 'name' | 'level'
export type ModerationPlayerDirection = 'asc' | 'desc'
export type ModerationTesterFilter = 'all' | 'tester' | 'non-tester'
export type ModerationPermissionsDto = Readonly<{
  roles: readonly ModerationRole[]
  capabilities: Readonly<{ moderationAccess: boolean; selfResourceTools: boolean; selfGameplayTools: boolean; superTools: boolean; canSelectPlayers: boolean; canManageTesters: boolean }>
}>
export type ModerationPlayerDto = Readonly<{ id: string; displayName: string; elementKey: string | null; level: number; tester: boolean }>
export type ModerationPlayerListQuery = Readonly<{
  query: string
  elementKey: string | null
  tester: ModerationTesterFilter
  sort: ModerationPlayerSort
  direction: ModerationPlayerDirection
  page: number
}>
export type ModerationPlayerPageDto = Readonly<{
  players: readonly ModerationPlayerDto[]
  page: number
  pageSize: 10
  total: number
  totalPages: number
}>
export type ModerationStateDto = Readonly<{
  player: ModerationPlayerDto
  permissions: ModerationPermissionsDto
  resources: Readonly<{ primogems: string; moras: string; particles: Readonly<Record<string, string>> }>
  progression: Readonly<{ totalXp: string; level: number; xpIntoCurrentStep: string; xpPerStep: string; isMaxLevel: boolean; level100OverflowRewardsClaimed: number; totalMessages: string; countedMessages: string }>
  gachaState: Readonly<{ pity5: number; pity4: number; guaranteedFeatured5: boolean; captureProgress: number; fiftyFiftyLostStreak: number; selectedBannerCharacterId: string | null; totalPulls: string; totalFiveStars: string; totalFourStars: string; fiftyFiftyWon: string; fiftyFiftyLost: string; capturesTriggered: string }>
  stella: Readonly<{ quantity: string }>
}>

export interface ModerationTools {
  getPermissions(identity: AuthenticatedIdentity): Promise<ModerationPermissionsDto>
  getState(identity: AuthenticatedIdentity, targetPlayerId?: string): Promise<ModerationStateDto>
  listPlayers(identity: AuthenticatedIdentity, query: ModerationPlayerListQuery): Promise<ModerationPlayerPageDto>
  adjustResource(identity: AuthenticatedIdentity, targetPlayerId: string, input: { resourceKey: ResourceKey; amount: bigint; direction: 'add' | 'remove'; idempotencyKey: string }): Promise<ModerationStateDto>
  setXp(identity: AuthenticatedIdentity, targetPlayerId: string, input: { totalXp?: bigint; prepareNextLevel?: boolean; idempotencyKey: string }): Promise<ModerationStateDto>
  setGacha(identity: AuthenticatedIdentity, targetPlayerId: string, input: { pity5?: number; pity4?: number; guaranteedFeatured5?: boolean; captureProgress?: number; idempotencyKey: string }): Promise<ModerationStateDto>
  setStella(identity: AuthenticatedIdentity, targetPlayerId: string, input: { quantity: bigint; idempotencyKey: string }): Promise<ModerationStateDto>
  setTester(identity: AuthenticatedIdentity, targetPlayerId: string, enabled: boolean, idempotencyKey: string): Promise<ModerationStateDto>
}
