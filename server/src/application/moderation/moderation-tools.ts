import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js'
import type { ResourceKey } from '../../domain/economy/resources.js'

export type ModerationRole = 'MODERATOR' | 'TESTER' | 'ADMIN'
export type ModerationPermissionsDto = Readonly<{
  roles: readonly ModerationRole[]
  capabilities: Readonly<{ moderationAccess: boolean; selfTestTools: boolean }>
}>
export type ModerationStateDto = Readonly<{
  permissions: ModerationPermissionsDto
  resources: Readonly<{ primogems: string; moras: string; particles: Readonly<Record<string, string>> }>
  progression: Readonly<{ totalXp: string; level: number; xpIntoCurrentStep: string; xpPerStep: string; isMaxLevel: boolean; level100OverflowRewardsClaimed: number; totalMessages: string; countedMessages: string }>
  gachaState: Readonly<{ pity5: number; pity4: number; guaranteedFeatured5: boolean; captureProgress: number; fiftyFiftyLostStreak: number; selectedBannerCharacterId: string | null; totalPulls: string; totalFiveStars: string; totalFourStars: string; fiftyFiftyWon: string; fiftyFiftyLost: string; capturesTriggered: string }>
  stella: Readonly<{ quantity: string }>
}>

export interface ModerationTools {
  getPermissions(identity: AuthenticatedIdentity): Promise<ModerationPermissionsDto>
  getState(identity: AuthenticatedIdentity): Promise<ModerationStateDto>
  adjustResource(identity: AuthenticatedIdentity, input: { resourceKey: ResourceKey; amount: bigint; direction: 'add' | 'remove'; idempotencyKey: string }): Promise<ModerationStateDto>
  setXp(identity: AuthenticatedIdentity, input: { totalXp?: bigint; prepareNextLevel?: boolean; idempotencyKey: string }): Promise<ModerationStateDto>
  setGacha(identity: AuthenticatedIdentity, input: { pity5?: number; pity4?: number; guaranteedFeatured5?: boolean; captureProgress?: number; idempotencyKey: string }): Promise<ModerationStateDto>
  setStella(identity: AuthenticatedIdentity, input: { quantity: bigint; idempotencyKey: string }): Promise<ModerationStateDto>
}
