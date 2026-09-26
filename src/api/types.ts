export const elementKeys = ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'] as const

export type ElementKey = (typeof elementKeys)[number]

export type PlayerDto = Readonly<{
  id: string
  displayName: string
  elementKey: ElementKey | null
  avatarAssetPath?: string | null
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'
}>

export type ModerationPermissionsDto = Readonly<{
  roles: readonly ('MODERATOR' | 'TESTER' | 'ADMIN')[]
  capabilities: Readonly<{ moderationAccess: boolean; communityModeration: boolean; selfResourceTools: boolean; selfGameplayTools: boolean; superTools: boolean; canSelectPlayers: boolean; canManageTesters: boolean }>
}>
export type ModerationPlayerDto = Readonly<{ id: string; displayName: string; elementKey: ElementKey | null; avatarAssetPath: string | null; level: number; tester: boolean; rank: 'SUPER' | 'MODERATOR' | 'TESTER' | 'PLAYER' }>

export const navigationMenuDestinationIds = ['home', 'invocation', 'box', 'team', 'catalog', 'activities', 'dailies', 'missions', 'combat', 'event', 'contest', 'inventory', 'shop', 'bank', 'codes', 'friends', 'trades', 'rankings', 'history', 'tutorial', 'configuration'] as const
export type RankingCategory = 'PROGRESSION' | 'GACHA' | 'RESSOURCES' | 'COLLECTION' | 'ACTIVITE'
export type RankingMetricDto = Readonly<{ id: string; label: string; category: RankingCategory; aliases: readonly string[]; source: string; format: 'INTEGER' | 'PERCENT' | 'PITY5'; privacy: readonly string[]; eligibility: string }>
export type RankingEntryDto = Readonly<{ playerId: string; displayName: string; elementKey: string; avatarAssetPath?: string | null; rank: number; value: string; isSelf: boolean }>
export type RankingPageDto = Readonly<{ metric: RankingMetricDto; categories: readonly RankingCategory[]; metrics: readonly RankingMetricDto[]; page: number; pageSize: number; total: number; totalPages: number; entries: readonly RankingEntryDto[]; self: RankingEntryDto | null; selfStatus: 'RANKED' | 'NOT_PUBLIC' | 'NOT_ELIGIBLE' }>
export type NavigationMenuDestinationId = (typeof navigationMenuDestinationIds)[number]
export type NavigationMenuPreferenceDto = Readonly<{ version: 1; order: readonly NavigationMenuDestinationId[]; hidden: readonly NavigationMenuDestinationId[] }>
export type ModerationPlayerListQuery = Readonly<{
  query?: string
  elementKey?: ElementKey | null
  tester?: 'all' | 'tester' | 'non-tester'
  sort?: 'name' | 'level'
  direction?: 'asc' | 'desc'
  page?: number
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
  resources: PlayerResourcesDto
  progression: PlayerProgressionDto
  gachaState: PlayerGachaStateDto
  stella: Readonly<{ quantity: string }>
}>

export type PlayerResourcesDto = Readonly<{
  primogems: string
  moras: string
  particles: Readonly<Record<ElementKey, string>>
}>

export type PermanentMissionRankDto = 'B' | 'A' | 'S' | 'Z'
export type PermanentMissionStatusDto = 'LOCKED' | 'ACTIVE' | 'COMPLETED'

export type PermanentMissionDto = Readonly<{
  externalKey: string
  rank: PermanentMissionRankDto
  displayName: string
  description: string
  progressLabel: string
  progress: string
  target: string
  status: PermanentMissionStatusDto
  rewardPrimogems: string
  completedAt: string | null
}>

export type PermanentMissionProjectionDto = Readonly<{
  ranks: Readonly<{
    B: readonly PermanentMissionDto[]
    A: readonly PermanentMissionDto[]
    S: readonly PermanentMissionDto[]
  }>
  z:
    | Readonly<{ status: 'LOCKED' }>
    | Readonly<{
        status: 'ACTIVE' | 'COMPLETED'
        unlockedAt: string
        missions: readonly PermanentMissionDto[]
      }>
}>

export type PlayerMissionsDto = PermanentMissionProjectionDto & Readonly<{ catchUpApplied: boolean }>

export type InventoryResourceDto = Readonly<{
  key: 'primogems' | 'moras' | `particles_${ElementKey}`
  displayName: string
  category: string
  elementKey: ElementKey | null
  amount: string
}>

export type InventoryItemDto = Readonly<{
  id: string
  externalKey: string
  displayName: string
  category: string
  section: 'objects' | 'collection'
  description: string | null
  quantity: string
  firstObtainedAt: string | null
  acquisitionHint: string | null
  originFestival?: string | null
  originMonth?: string | null
  visualKey?: string | null
}>

export type InventoryItemDetailDto = Readonly<{
  item: InventoryItemDto
  history: readonly Readonly<{ id: string; quantity: string; sourceKey: string; provenance: unknown; acquiredAt: string }>[]
  page: number
  pageSize: number
  total: number
  pageCount: number
}>

export type PlayerInventoryDto = Readonly<{
  resources: readonly InventoryResourceDto[]
  items: readonly InventoryItemDto[]
}>

export type DailyChallengeDto = Readonly<{
  businessDate: string
  status: 'AVAILABLE' | 'ACTIVE' | 'COMPLETED'
  assigned: boolean
  purchaseCost: string
  challenge: Readonly<{
    externalKey: string
    type: 'messages' | 'pulls' | 'conversion'
    displayName: string
    description: string
    progressLabel: string
    progress: string
    target: string
    rewardPrimogems: string
  }> | null
  switchCount: number
  nextSwitchCost: string | null
  canSwitch: boolean
  completedAt: string | null
}>

export type DailyChallengeMutationDto = DailyChallengeDto & Readonly<{
  operation: Readonly<{ id: string; alreadyProcessed: boolean }>
  resources: PlayerResourcesDto
}>

export type BankOperationDto = Readonly<{
  id: string
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST'
  amount: string
  bankBalanceAfter: string
  walletBalanceAfter: string | null
  businessDate: string | null
  createdAt: string
}>

export type PlayerBankDto = Readonly<{
  walletMoras: string
  bankMoras: string
  totalWealth: string
  estimatedInterest: string
  interestRatePercent: 3
  nextInterestAt: string
  recentOperations: readonly BankOperationDto[]
}>

export type BankTransferDto = PlayerBankDto & Readonly<{
  operation: Readonly<{ id: string; alreadyProcessed: boolean }>
}>

export type BankHistoryDto = Readonly<{
  page: number
  totalPages: number
  totalCount: number
  operations: readonly BankOperationDto[]
}>

export type ShopTicketRewardDto = Readonly<{
  id: string
  type: 'resource' | 'main_element_particles' | 'other_element_particles' | 'pity5'
  label: string
  amount: string
  weight: number
  probabilityBasisPoints: number
  resourceKey?: string
}>

export type ShopItemDto = Readonly<{
  id: string
  externalKey: string
  displayName: string
  description: string
  visualKey: string
  priceResourceKey: string
  priceAmount: string
  effectType: 'daily_mission' | 'resource_bundle' | 'random_ticket'
  displayOrder: number
  available: boolean
  unavailableReason: string | null
  quantityMode: 'unit' | 'multiple'
  rewardPerUnit: Readonly<{ resourceKey: string; amount: string }> | null
  ticketRewards: readonly ShopTicketRewardDto[]
}>

export type ShopEffectDto =
  | Readonly<{ type: 'resource_bundle'; resourceKey: string; amount: string }>
  | Readonly<{ type: 'ticket_resource'; rewardId: string; label: string; resourceKey: string; amount: string }>
  | Readonly<{ type: 'ticket_main_element_particles' | 'ticket_other_element_particles'; rewardId: string; label: string; elementKey: ElementKey; resourceKey: string; amount: string }>
  | Readonly<{ type: 'ticket_pity5'; rewardId: string; label: string; requestedAmount: number; grantedAmount: number; pity5Before: number; pity5After: number }>

export type ShopPurchaseRecordDto = Readonly<{
  id: string
  itemId: string
  externalKey: string
  displayName: string
  quantity: string
  unitPrice: string
  totalPrice: string
  effect: ShopEffectDto
  operationId: string
  purchasedAt: string
}>

export type PlayerShopDto = Readonly<{
  resources: PlayerResourcesDto
  gachaState: PlayerGachaStateDto
  items: readonly ShopItemDto[]
  recentPurchases: readonly ShopPurchaseRecordDto[]
}>

export type ShopPurchaseDto = PlayerShopDto & Readonly<{
  purchase: ShopPurchaseRecordDto
  operation: Readonly<{ id: string; alreadyProcessed: boolean }>
}>

export type ShopHistoryDto = Readonly<{
  purchases: readonly ShopPurchaseRecordDto[]
  page: number
  pageSize: 10
  totalCount: number
  totalPages: number
}>

export type PlayerProgressionDto = Readonly<{
  totalXp: string
  level: number
  xpIntoCurrentStep: string
  xpPerStep: string
  isMaxLevel: boolean
  level100OverflowRewardsClaimed: number
  totalMessages: string
  countedMessages: string
}>

export type WheelRewardDto = Readonly<{
  resultType: 'nothing' | 'particles' | 'moras' | 'primogems'
  resourceKey: string | null
  amount: string | null
}>

export type WheelSpinDto = WheelRewardDto & Readonly<{
  businessDate: string
  alreadySpun: boolean
}>

export type WheelTodayDto = Readonly<{
  spun: boolean
  businessDate: string
  result: WheelRewardDto | null
}>

export type DailyRewardAmountsDto = Readonly<{
  primogems: string
  mainElementParticles: string
  moras: string
}>

export type DailyRewardTodayDto = Readonly<{
  claimed: boolean
  businessDate: string
  rewards: DailyRewardAmountsDto
}>

export type DailyRewardClaimDto = DailyRewardTodayDto & Readonly<{
  alreadyClaimed: boolean
}>

export type ElementChoiceDto = Readonly<{
  elementKey: ElementKey
  alreadySelected: boolean
}>

export type GachaCharacterDto = Readonly<{
  id: string
  externalKey: string
  name: string
  rarity: 4 | 5
  elementKey: ElementKey
  weaponType: string | null
  region: string | null
  classKey: string | null
  iconPath: string | null
  splashPath: string | null
  wishPath: string | null
  fullbodyPath: string | null
}>

export type PlayerGachaStateDto = Readonly<{
  pity5: number
  pity4: number
  guaranteedFeatured5: boolean
  captureProgress: number
  fiftyFiftyLostStreak: number
  selectedBannerCharacterId: string | null
  totalPulls: string
  totalFiveStars: string
  totalFourStars: string
  fiftyFiftyWon: string
  fiftyFiftyLost: string
  capturesTriggered: string
}>

export type CurrentGachaDto = Readonly<{
  banner: Readonly<{ id: string; startsAt: string; endsAt: string; featuredFiveStars: readonly GachaCharacterDto[]; featuredFourStars: readonly GachaCharacterDto[] }>
  playerState: PlayerGachaStateDto
}>

export type CharacterCatalogDto = Readonly<{ characters: readonly GachaCharacterDto[] }>

export type BoxCharacterDto = Omit<GachaCharacterDto, 'classKey'> & Readonly<{
  constellation: number
  copies: number
  firstObtainedAt: string
  favorite: boolean
  c6CompetitionStats: Readonly<Record<'strength' | 'intelligence' | 'beauty' | 'charisma' | 'popularity', number> & { max: number }> | null
}>

export type PlayerBoxDto = Readonly<{
  characters: readonly BoxCharacterDto[]
  summary: Readonly<{
    totalOwned: number
    fiveStars: number
    fourStars: number
    c6: number
  }>
  preference: BoxSortPreferenceDto
  stella: Readonly<{ quantity: string }>
}>

export type BoxSortPreferenceDto = Readonly<{
  sortKey: 'alphabetical' | 'obtainedAt' | 'constellation' | 'element'
  direction: 'asc' | 'desc'
}>

export type StellaUseDto = Readonly<{
  operation: Readonly<{ id: string; alreadyProcessed: boolean }>
  character: BoxCharacterDto
  stella: Readonly<{ quantity: string }>
  c6Progression: Readonly<{ type: 'unlocked'; stats: Readonly<Record<'strength' | 'intelligence' | 'beauty' | 'charisma' | 'popularity', number>> }>
    | Readonly<{ type: 'stat'; stat: 'strength' | 'intelligence' | 'beauty' | 'charisma' | 'popularity'; valueAfter: number }>
    | null
}>

export type TeamCharacterDto = GachaCharacterDto & Readonly<{
  constellation: number
}>

export type TeamPassiveDefinitionDto = Readonly<{
  elementKey: ElementKey
  displayName: string
  levelOne: string
  levelTwo: string
}>

export type TeamPassiveDto = TeamPassiveDefinitionDto & Readonly<{
  stacks: 1 | 2
  description: string
}>

export type PlayerTeamDto = Readonly<{
  id: string
  position: number
  name: string | null
  active: boolean
  slots: readonly Readonly<{ position: 1 | 2 | 3 | 4; character: TeamCharacterDto | null }>[]
  passives: readonly TeamPassiveDto[]
}>

export type PlayerTeamsDto = Readonly<{
  teams: readonly PlayerTeamDto[]
  availableCharacters: readonly TeamCharacterDto[]
  passiveReference: readonly TeamPassiveDefinitionDto[]
}>

export type DailyCombatCharacterDto = Omit<BoxCharacterDto, 'c6CompetitionStats'> & Readonly<{
  displayOrder: number | null
  combatStats: Readonly<{ fights: string; wins: string; losses: string; winRatePercent: number }>
}>

export type DailyCombatPreviewDto = Readonly<{
  baseHalfPoints: 100
  rarityBonusHalfPoints: number
  constellationBonusHalfPoints: number
  favorableMatchups: number
  favorableBonusHalfPoints: number
  unfavorableMatchups: number
  unfavorableMalusHalfPoints: number
  rawHalfPoints: number
  clamp: 'MINIMUM' | 'MAXIMUM' | null
  finalHalfPoints: number
  memberContributions: readonly Readonly<{ characterId: string; halfPoints: number }>[]
}>

export type DailyCombatDto = Readonly<{
  businessDate: string
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'
  encounter: Readonly<{ id: string; enemies: readonly Readonly<{
    position: 1 | 2 | 3 | 4
    character: Omit<GachaCharacterDto, 'classKey'> & Readonly<{ displayOrder: number | null }>
    weakAgainstElements: readonly ElementKey[]
    resistantAgainstElements: readonly ElementKey[]
  }>[] }>
  loadout: Readonly<{ nextAttemptMode: 'MANUAL' | 'AUTO'; slots: readonly Readonly<{ position: 1 | 2 | 3 | 4; character: DailyCombatCharacterDto | null; ko: boolean }>[] }>
  availableCharacters: readonly DailyCombatCharacterDto[]
  koCharacterIds: readonly string[]
  availableCharacterCount: number
  preview: DailyCombatPreviewDto | null
  canFight: boolean
  reward: Readonly<{ primogems: string; moras: string }>
  lastAttempt: Readonly<{ id: string; mode: 'MANUAL' | 'AUTO'; won: boolean; chanceHalfPoints: number; createdAt: string }> | null
  playerStats: Readonly<{ totalFights: string; totalWins: string; totalLosses: string; totalManualWins: string }>
}>

export type DailyCombatFightDto = Readonly<{
  operation: Readonly<{ id: string; alreadyProcessed: boolean }>
  result: Readonly<{ won: boolean; mode: 'MANUAL' | 'AUTO'; chanceHalfPoints: number }>
  view: DailyCombatDto
  resources: PlayerResourcesDto
}>

export type MonthlyBossCharacterDto = Omit<BoxCharacterDto, 'c6CompetitionStats'> & Readonly<{ displayOrder: number | null }>
export type MonthlyBossRankingEntryDto = Readonly<{ rank: number; playerId: string; displayName: string; totalDamage: string; attackCount: string; bestHit: string }>
export type MonthlyBossCommunitySummaryDto = Readonly<{ participantCount: number; attackCount: string; totalDamage: string; averageDamage: string }>
export type MonthlyBossRecordsDto = Readonly<{
  topContributor: MonthlyBossRankingEntryDto | null
  biggestHit: Readonly<{ playerId: string; displayName: string; damage: string; createdAt: string }> | null
  mostAttacks: MonthlyBossRankingEntryDto | null
  finalBlow: Readonly<{ id: string; displayName: string }> | null
  topThree: readonly MonthlyBossRankingEntryDto[]
}>
export type MonthlyBossSummaryDto = Readonly<{ victoryDayCount: number | null; daysRemainingAfterVictory: number | null; community: MonthlyBossCommunitySummaryDto; records: MonthlyBossRecordsDto }>
export type MonthlyBossDto = Readonly<{
  businessDate: string
  boss: Readonly<{ id: string; monthStart: string; name: string; baseHp: string; hpVariationPercent: number; maxHp: string; currentHp: string; resistanceElementKey: ElementKey; defeatedAt: string | null; finalBlowPlayer: Readonly<{ id: string; displayName: string }> | null; nextBaseAdjustment: string | null }>
  status: 'ALIVE' | 'DEFEATED'
  attackState: 'AVAILABLE' | 'USED' | 'DEFEATED'
  canAttack: boolean
  loadout: Readonly<{ slots: readonly Readonly<{ position: 1 | 2 | 3 | 4; character: MonthlyBossCharacterDto | null }>[] }>
  availableCharacters: readonly MonthlyBossCharacterDto[]
  preview: Readonly<{ totalDamage: string; contributions: readonly Readonly<{ characterId: string; characterName: string; rarity: 4 | 5; constellation: number; elementKey: ElementKey; damageBeforeResistance: string; resistanceApplied: boolean; damage: string }>[] }> | null
  reward: Readonly<{ primogems: string; moras: string }>
  participation: Readonly<{ rank: number; totalDamage: string; attackCount: string; bestHit: string; contributionBasisPoints: string }> | null
  ranking: readonly MonthlyBossRankingEntryDto[]
  defeatedSummary: MonthlyBossSummaryDto | null
  playerStats: Readonly<{ totalDamage: string; totalAttacks: string; totalParticipated: string; totalRewarded: string; finalBlows: string; bestHit: string }>
}>
export type MonthlyBossAttackDto = Readonly<{ operation: Readonly<{ id: string; alreadyProcessed: boolean }>; result: Readonly<{ damage: string; defeated: boolean }>; view: MonthlyBossDto; resources: PlayerResourcesDto }>
export type MonthlyBossHistoryEntryDto = Readonly<{ id: string; monthStart: string; name: string; baseHp: string; maxHp: string; currentHp: string; resistanceElementKey: ElementKey; status: 'DEFEATED' | 'FAILED'; defeatedAt: string | null; finalBlowPlayer: Readonly<{ id: string; displayName: string }> | null; victoryDayCount: number | null; daysRemainingAfterVictory: number | null; nextBaseAdjustment: string; community: MonthlyBossCommunitySummaryDto; records: MonthlyBossRecordsDto }>
export type MonthlyBossHistoryDto = Readonly<{ page: number; pageSize: number; total: number; totalPages: number; bosses: readonly MonthlyBossHistoryEntryDto[] }>

export type ContestThemeDto = Readonly<{ key: 'STRENGTH' | 'INTELLIGENCE' | 'BEAUTY' | 'CHARISMA' | 'POPULARITY'; label: string; title: string; statKey: 'strength' | 'intelligence' | 'beauty' | 'charisma' | 'popularity' }>
export type ContestParticipantDto = Readonly<{
  slot: number
  kind: 'HUMAN' | 'BOT'
  playerId: string | null
  displayName: string
  characterName: string | null
  avatar: string | null
  basePoints: number | null
  titleRank: number
  title: string | null
  score: number
  turnOrder: number | null
  ready: boolean
  activeTurn: boolean
  replaced: boolean
  replacementReason?: 'LEFT' | 'INACTIVE' | 'ADMIN_REMOVAL' | null
  liveRank: number | null
  finalRank: number | null
  rewardPrimogems: string | null
}>
export type ContestLatestScoreChangeDto = Readonly<{
  eventId: string
  slot: number
  points: number
  kind: 'TURN_PLAYED' | 'BOT_TURN_PLAYED' | 'TURN_AUTO_BASIC' | 'SUPPORT_PLAYED'
  createdAt: string
}>
export type ContestSnapshotDto = Readonly<{
  id: string
  businessDate: string
  theme: ContestThemeDto
  status: 'LOBBY' | 'RUNNING' | 'FINISHED'
  phase: 'LOBBY' | 'TURNS' | 'SUPPORT' | 'FINISHED'
  organizerPlayerId: string | null
  lobbyDeadlineAt: string | null
  turnDeadlineAt: string | null
  supportDeadlineAt: string | null
  currentTurnOrder: number | null
  currentRound: number
  winnerSlot: number | null
  startedAt: string | null
  finishedAt: string | null
  viewer: Readonly<{ participantSlot: number | null; selectedCharacterId: string | null; spectator: boolean; organizer: boolean; selectedForSupport: boolean }>
  participants: readonly ContestParticipantDto[]
  spectators: readonly Readonly<{ playerId: string; displayName: string; selected: boolean }>[]
  recentScoreChanges: readonly ContestLatestScoreChangeDto[]
  promotions: readonly Readonly<{ playerId: string; slot: number; characterName: string | null; fromRank: number; toRank: number; title: string }>[]
  historyEvents: readonly (
    | Readonly<{ kind: 'PARTICIPANT_LEFT'; occurredAt: string; slot: number | null; playerName: string | null }>
    | Readonly<{ kind: 'PARTICIPANT_REPLACED'; occurredAt: string; slot: number | null; playerName: string | null; characterName: string | null; botName: string | null; score: number | null; reason: string | null }>
    | Readonly<{ kind: 'SPECTATOR_REMOVED'; occurredAt: string; playerName: string | null; selectedForSupport: boolean }>
    | Readonly<{ kind: 'SUPPORT_SELECTED'; occurredAt: string; round: number | null; playerName: string | null }>
    | Readonly<{ kind: 'SUPPORT_PLAYED'; occurredAt: string; slot: number | null; playerName: string | null; targetName: string | null; points: number | null }>
    | Readonly<{ kind: 'SUPPORT_SKIPPED'; occurredAt: string; round: number | null }>
    | Readonly<{ kind: 'TITLE_PROMOTED'; occurredAt: string; slot: number; playerName: string | null; characterName: string | null; fromRank: number; toRank: number; title: string }>
  )[]
}>
export type ContestLegendDto = Readonly<{
  character: Readonly<{ id: string; externalKey: string; name: string; iconPath: string | null; elementKey: ElementKey }>
  stats: Readonly<Record<'strength' | 'intelligence' | 'beauty' | 'charisma' | 'popularity', number>>
  totals: Readonly<{ contests: string; wins: string }>
  themes: Readonly<Record<ContestThemeDto['key'], Readonly<{ participations: string; wins: string; titleRank: number; title: string | null }>>>
}>
export type ContestDto = Readonly<{
  businessDate: string
  theme: ContestThemeDto
  dailyUsed: boolean
  permissions: Readonly<Record<'canOpen' | 'canJoin' | 'canSpectate' | 'canLeave' | 'canReady' | 'canStart' | 'canCancel' | 'canPlay' | 'canSupport', boolean>>
  active: ContestSnapshotDto | null
  lastResult: ContestSnapshotDto | null
  legends: readonly ContestLegendDto[]
}>
export type ContestHistorySummaryDto = Readonly<{
  id: string
  businessDate: string
  theme: ContestThemeDto
  currentRound: number
  winner: Readonly<{ slot: number; displayName: string; kind: 'HUMAN' | 'BOT' }> | null
  startedAt: string | null
  finishedAt: string | null
}>
export type ContestHistoryDto = Readonly<{ page: number; pageSize: number; total: number; pageCount: number; contests: readonly ContestHistorySummaryDto[] }>

export type ExpeditionDto = Readonly<{
  businessDate: string
  operationalStatus: 'IDLE' | 'RUNNING' | 'READY'
  departureUsedToday: boolean
  canStartToday: boolean
  activeCharacter: Omit<GachaCharacterDto, 'classKey'> | null
  departedAt: string | null
  readyAt: string | null
  remainingSeconds: number
  startedOnCurrentBusinessDate: boolean
  totalCompleted: string
}>

export type ExpeditionStartDto = Readonly<{ operation: Readonly<{ id: string; alreadyProcessed: boolean }>; view: ExpeditionDto }>
export type ExpeditionClaimDto = Readonly<{
  operation: Readonly<{ id: string; alreadyProcessed: boolean }>
  reward: Readonly<{ roll: number; kind: 'primogems' | 'particles' | 'moras'; resourceKey: string; amount: string }>
  view: ExpeditionDto
  resources: PlayerResourcesDto
}>

export type NotificationDto = Readonly<{
  id: string
  domainKey: string
  typeKey: string
  payload: Readonly<Record<string, unknown>>
  state: 'UNREAD' | 'READ'
  actionKey: string | null
  actionTargetId: string | null
  createdAt: string
  readAt: string | null
}>
export type NotificationsDto = Readonly<{ unreadCount: number; notifications: readonly NotificationDto[]; expedition?: ExpeditionDto }>

export type GiftCodeRewardDto = Readonly<{ resourceKey: 'primogems' | 'moras' | `particles_${ElementKey}`; displayName: string; amount: string }>
export type GiftCodeDto = Readonly<{ id: string; editionId: string; token: string; title: string; description: string; type: 'ONE_OFF' | 'ANNUAL'; editionKey: string; startsAt: string; endsAt: string; available: boolean; claimed: boolean; claimedAt: string | null; rewards: readonly GiftCodeRewardDto[] }>
export type PlayerGiftCodesDto = Readonly<{ available: readonly GiftCodeDto[]; claimed: readonly GiftCodeDto[] }>
export type GiftCodeClaimDto = PlayerGiftCodesDto & Readonly<{ resources: PlayerResourcesDto; operation: Readonly<{ id: string; alreadyProcessed: boolean }> }>
export type AdminGiftCodeDto = Readonly<{ id: string; token: string; title: string; description: string; type: 'ONE_OFF' | 'ANNUAL'; status: 'DRAFT' | 'PUBLISHED' | 'DISABLED'; recurringMonth: number | null; startsAt: string | null; endsAt: string | null; createdAt: string; publishedAt: string | null; claimCount: number; locked: boolean; rewards: readonly GiftCodeRewardDto[]; editions: readonly Readonly<{ id: string; editionKey: string; startsAt: string; endsAt: string; claimCount: number }>[] }>
export type GiftCodeAdminQuery = Readonly<{ page: number; search?: string; status?: AdminGiftCodeDto['status']; type?: AdminGiftCodeDto['type']; availability?: 'CURRENT' | 'FUTURE' | 'OUTSIDE'; sort: 'createdAt' | 'publishedAt' | 'title' | 'claims'; direction: 'asc' | 'desc' }>
export type AdminGiftCodesDto = Readonly<{ actorPlayerId: string; page: number; pageSize: 20; total: number; totalPages: number; codes: readonly AdminGiftCodeDto[] }>
export type AdminGiftCodeMutationDto = Readonly<{ code: AdminGiftCodeDto }>
export type GiftCodeClaimantQuery = Readonly<{ page: number; search?: string; editionKey?: string }>
export type GiftCodeClaimantsDto = Readonly<{ code: Readonly<{ id: string; token: string; title: string }>; page: number; pageSize: 20; total: number; totalPages: number; claimants: readonly Readonly<{ playerId: string; displayName: string; editionKey: string; claimedAt: string }>[] }>

export type EventDto = Readonly<{
  giftCode?: Readonly<{ available: boolean }>
  calendar?: Readonly<{
    startsOn: string
    endsOn: string
    currentDay: number | null
    recap: boolean
    canClaimToday: boolean
    days: readonly Readonly<{ day: number; state: 'OPENED' | 'AVAILABLE' | 'MISSED' | 'FUTURE'; reward: number | null }>[]
  }> | null
  businessDate: string
  refreshAfterMs: number
  festival: Readonly<{
    key: string
    month: number
    title: string
    emoji: string
    currency: Readonly<{ key: string; label: string; unit: string; emoji: string }>
    collection: Readonly<{ key: string; label: string }>
  }>
  edition: Readonly<{ id: string; year: number; startsAt: string; endsAt: string }>
  participation: Readonly<{ joined: boolean; joinedAt: string | null; points: number }>
  currency: Readonly<{ amount: string }>
  shop: Readonly<{
    available: boolean
    balance: string
    rates: Readonly<{ primogems: string; moras: string }>
    collection: Readonly<{ itemExternalKey: string; label: string; cost: string; obtainedThisEdition: boolean; available: boolean }>
  }>
  resources?: PlayerResourcesDto
  dailyBonus: Readonly<{ claimedToday: boolean; canClaim: boolean }>
  milestones: Readonly<{ currentPoints: number; thresholds: readonly Readonly<{ points: number; reached: boolean; rewarded: boolean; rewardLabel: string }>[] }>
  canJoin: boolean
  gameA: Readonly<{
    available: boolean
    theme: Readonly<{ key: string; label: string }>
    completedToday: boolean
    attemptsToday: number
    windows: readonly Readonly<{ startAt: string; endAt: string; state: 'PAST' | 'ACTIVE' | 'FUTURE' }>[]
    activeWindowIndex: number | null
    canAttempt: boolean
    cooldownRemainingMs: number
  }>
  gameB: Readonly<{
    available: boolean
    theme: Readonly<{ key: string; label: string }>
    solvedToday: boolean
    resolvedCode: string | null
    discoveredBy: Readonly<{ id: string; displayName: string }> | null
    attemptsUsed: number
    attemptsRemaining: number
    testedCodes: readonly string[]
    remainingCodes: readonly string[]
    canAttempt: boolean
  }>
  gameC: Readonly<{
    available: boolean
    theme: Readonly<{ key: string; label: string }>
    sentToday: boolean
    canSend: boolean
    receivedMessages: readonly Readonly<{ id: string; sender: Readonly<{ id: string; displayName: string }>; message: string; createdAt: string; viewed: boolean }>[]
    unviewedCount: number
  }>
}>

export type EventJoinDto = EventDto & Readonly<{ operation: Readonly<{ id: string; alreadyProcessed: boolean }> }>
export type EventDailyBonusClaimDto = EventDto & Readonly<{ operation: Readonly<{ id: string; alreadyProcessed: boolean }> }>
export type EventCalendarClaimDto = EventDto & Readonly<{ operation: Readonly<{ id: string; alreadyProcessed: boolean }>; calendarClaim: Readonly<{ day: number; reward: number }> }>
export type EventShopMutationDto = EventDto & Readonly<{ operation: Readonly<{ id: string; alreadyProcessed: boolean }> }>
export type EventRankingDto = Readonly<{ editionId: string; entries: readonly Readonly<{ rank: number; playerId: string; displayName: string; points: number }>[] }>
export type EventGameAAttemptDto = EventDto & Readonly<{ operation: Readonly<{ id: string; alreadyProcessed: boolean }>; attempt: Readonly<{ succeeded: boolean }> }>
export type EventGameBAttemptDto = EventDto & Readonly<{ operation: Readonly<{ id: string; alreadyProcessed: boolean }>; attempt: Readonly<{ kind: 'ALREADY_TESTED' | 'INCORRECT' | 'CORRECT' }> }>
export type EventGameCRecipientQuery = Readonly<{ query: string; elementKey: ElementKey | null; sort: 'name' | 'level'; direction: 'asc' | 'desc'; page: number }>
export type EventGameCRecipientDto = Readonly<{ playerId: string; displayName: string; level: number; elementKey: ElementKey | null; avatarAssetPath: string | null }>
export type EventGameCRecipientsDto = Readonly<{ page: number; pageSize: 10; total: number; totalPages: number; recipients: readonly EventGameCRecipientDto[] }>
export type EventGameCSendDto = EventDto & Readonly<{ operation: Readonly<{ id: string; alreadyProcessed: boolean }> }>

export type GachaPullResultItemDto = Readonly<{
  index: number
  resultType: 'character' | 'resource'
  character: GachaCharacterDto | null
  rarity: 4 | 5 | null
  resourceKey: string | null
  resourceAmount: string | null
  wasNewCharacter: boolean | null
  constellationAfter: number | null
  copiesAfter: number | null
  wasFiftyFifty: boolean
  wonFiftyFifty: boolean | null
  guaranteeConsumed: boolean
  captureTriggered: boolean
  bonusRewards: readonly Readonly<{ resourceKey: string; amount: string; causeKey: string }>[]
  c6Progression: Readonly<{ type: 'stat'; stat: 'strength' | 'intelligence' | 'beauty' | 'charisma' | 'popularity'; valueAfter: number }> | Readonly<{ type: 'maxed' }> | null
  passiveEffects?: readonly GachaPassiveEffectDto[]
}>

export type GachaPassiveEffectDto =
  | Readonly<{ elementKey: 'hydro'; type: 'five_star_chance_bonus'; basisPoints: number }>
  | Readonly<{ elementKey: 'pyro' | 'geo'; type: 'secondary_reward_multiplier'; numerator: number; denominator: number; amountBefore: string; amountAfter: string }>
  | Readonly<{ elementKey: 'cryo'; type: 'xp'; amount: string; xpAfter: string; levelsReached: readonly number[]; overflowRewardsGranted: number }>
  | Readonly<{ elementKey: 'electro'; type: 'pity5'; amount: number; requestedAmount: 2 }>
  | Readonly<{ elementKey: 'anemo'; type: 'primogem_recovery'; amount: string }>
  | Readonly<{ elementKey: 'dendro'; type: 'resource_bundle'; rewards: readonly Readonly<{ resourceKey: string; amount: string }>[] }>

export type GachaPullDto = Readonly<{
  operation: Readonly<{ id: string; pullCount: 1 | 10; primogemCost: string; createdAt: string; alreadyProcessed: boolean }>
  results: readonly GachaPullResultItemDto[]
  playerState: PlayerGachaStateDto
}>

export type GachaHistoryResultDto = GachaPullResultItemDto & Readonly<{
  operationId: string
  operationPullCount: 1 | 10
  occurredAt: string
  pity5AtPull: number | null
  pity4AtPull: number | null
}>

export type GachaHistoryDto = Readonly<{
  page: number
  pageSize: 10
  totalResults: number
  totalPages: number
  hasPrevious: boolean
  hasNext: boolean
  results: readonly GachaHistoryResultDto[]
}>

export type BannerHistoryDto = Readonly<{
  category: 'banners'; page: number; pageSize: 10; total: number; totalPages: number
  entries: readonly Readonly<{
    id: string; startsAt: string; endsAt: string; status: string
    featured: readonly Readonly<{ characterId: string; name: string; rarity: number; slot: number; source: string }>[]
    generationVoteSnapshot: Readonly<{
      sourceRotationId: string | null; capturedAt: string
      candidates: readonly Readonly<{ characterId: string; characterName: string; voteCount: number }>[]
      selectedCharacterId: string; selectedCharacterName: string; selectionSource: 'COMMUNITY_VOTE' | 'RANDOM_FALLBACK'
    }> | null
  }>[]
}>

export type EventHistoryDto = Readonly<{
  category: 'event'; page: number; pageSize: 10; total: number; totalPages: number
  entries: readonly Readonly<{
    id: string; festival: string; month: number; year: number; startsAt: string; endsAt: string; participantCount: number
    top: readonly Readonly<{ rank: number; playerId: string; displayName: string; points: number }>[]
    personal: Readonly<{ rank: number; points: number; milestones: readonly number[]; collectionAcquired: boolean; collectionItemName: string | null }> | null
  }>[]
}>

export type BackendErrorDto = Readonly<{
  error: Readonly<{
    code: string
    message: string
    requestId?: string
  }>
}>
export type BannerVoteDto = Readonly<{
  bannerRotationId: string; startsAt: string; endsAt: string; canVote: boolean
  ownVote: Readonly<{ characterId: string; votedAt: string }> | null
  candidates: readonly Readonly<{ characterId: string; voteCount: number }>[]
  catalogVersion: string
}>
export type ChatRefreshScope = 'player' | 'resources' | 'progression' | 'gacha' | 'bannerVotes' | 'box' | 'teams' | 'inventory' | 'bank' | 'shop' | 'dailyChallenge' | 'wheel' | 'social' | 'trades' | 'expedition' | 'dailyCombat' | 'monthlyBoss' | 'contest' | 'event' | 'giftCodes' | 'notifications'
export type ChatMentionDto = { playerId: string; displayName: string }
export type ChatMessageDto = {
  id: string
  author: { id: string; displayName: string; elementKey: string | null; avatarAssetPath?: string | null } | null
  authorLabel: string | null
  sourceChannel: string
  messageType: 'PLAYER' | 'COMMAND' | 'GAME_RESULT' | 'SYSTEM'
  content: string | null
  createdAt: string
  submissionOrder: string | null
  deletedAt: string | null
  deletionState: 'ACTIVE' | 'AUTHOR' | 'MODERATION'
  replyToMessageId: string | null
  replyPreview: string | null
  mentionedMe: boolean
  repliedToMe: boolean
  resolvedMentions?: ChatMentionDto[]
  clientIntentKey?: string | null
}
export type ChatPageDto = { messages: ChatMessageDto[]; nextCursor: { createdAt: string; id: string } | null; generation: number; visibleMessageIds?: string[] }
export type ChatUpdatesDto = { generation: number; reset: boolean; messages: ChatMessageDto[]; changes: ChatMessageDto[]; visibleMessageIds?: string[] }
export type ChatSendDto = { cleared: true; generation: number; replayed: boolean } | { cleared?: false; message: ChatMessageDto; generation: number; xpGranted: number; refreshScopes: ChatRefreshScope[]; dailyChallengeCompleted: boolean; replayed: boolean; result: ChatMessageDto | null; results: ChatMessageDto[] }

export type DirectMessagePlayerDto = Readonly<{ id: string; displayName: string; elementKey: ElementKey | null; avatarAssetPath?: string | null }>

export type AppearanceDto = Readonly<{
  avatar: Readonly<{ kind: 'CUSTOM' | 'ELEMENT' | 'INITIAL'; assetPath: string | null }>
  title: string | null
  equippedAvatarCosmeticId: string | null
  equippedTitleCosmeticId: string | null
  catalog: readonly Readonly<{ id: string; type: 'AVATAR' | 'TITLE'; sourceCharacterId?: string | null; displayName: string; assetPath: string | null; condition: string | null; visibility: 'VISIBLE' | 'MYSTERY' | 'SECRET'; owned: boolean; isActive: boolean }>[]
}>
export type DirectMessageRequestDto = Readonly<{ id: string; state: 'PENDING' | 'ACCEPTED' | 'REFUSED'; senderPlayerId: string; retryAfter: string | null }>
export type DirectMessageDto = Readonly<{
  id: string
  conversationId: string
  authorPlayerId: string
  own: boolean
  clientIntentKey: string | null
  content: string | null
  createdAt: string
  submissionOrder: string | null
  editedAt: string | null
  deletedAt: string | null
  restoredAt: string | null
  replyToMessageId: string | null
  replyPreview: string | null
  readByOther: boolean
  readByOtherAt: string | null
}>
export type DirectConversationDto = Readonly<{
  id: string
  other: DirectMessagePlayerDto
  archived: boolean
  lastMessageAt: string | null
  lastMessage: DirectMessageDto | null
  request: DirectMessageRequestDto | null
  unreadCount: number
  readReceiptsEnabled: boolean
  canSend: boolean
  blockedByMe: boolean
}>
export type DirectConversationListDto = Readonly<{ conversations: readonly DirectConversationDto[] }>
export type DirectMessagePageDto = Readonly<{ messages: readonly DirectMessageDto[]; nextCursor: Readonly<{ createdAt: string; id: string }> | null; windowSize: number }>
export type DirectMessageHistoryMessageDto = DirectMessageDto & Readonly<{ canRestore: boolean }>
export type DirectMessageHistoryPageDto = Readonly<{ messages: readonly DirectMessageHistoryMessageDto[]; olderCursor: string | null; newerCursor: string | null }>
export type DirectMessageHistorySearchDto = Readonly<{ results: readonly DirectMessageHistoryMessageDto[]; nextCursor: string | null }>
export type DirectMessageHistoryAnchorDto = Readonly<{ anchor: Readonly<{ messageId: string; submissionOrder: string; createdAt: string }> | null }>
export type DirectMessageUnreadDto = Readonly<{ unreadCount: number; conversations: readonly Readonly<{ conversationId: string; unreadCount: number }>[] }>
export type DirectMessageSendDto = Readonly<{ conversationId: string; messageId: string; replayed: boolean }>
export type DirectMessageMutationDto = Readonly<{
  conversationId: string
  messageId: string
  replayed: boolean
  message: Readonly<Pick<DirectMessageDto, 'id' | 'content' | 'editedAt' | 'deletedAt' | 'restoredAt'>>
}>
export type DirectMessageInitiateDto = DirectMessageSendDto & Readonly<{ requestId: string | null; state: 'PENDING' | 'ACCEPTED' }>
export type DirectMessageResolveDto = Readonly<{ conversationId: string; requestId: string; state: 'ACCEPTED' | 'REFUSED'; replayed: boolean }>
export type DirectMessageBlockDto = Readonly<{ conversationId: string; blocked: boolean; changed: boolean; replayed: boolean }>
export type DirectMessageArchiveDto = Readonly<{ conversationId: string; archived: boolean; changed: boolean }>
export type DirectMessageReceiptDto = Readonly<{ conversationId: string; readReceiptsEnabled: boolean; changed: boolean }>
export type DirectMessageReportSnapshotLineDto = Readonly<{ id: string; authorPlayerId: string; authorDisplayName: string; content: string | null; createdAt: string; submissionOrder: string; editedAt: string | null; deletedAt: string | null; replyToMessageId: string | null; replyPreview: string | null }>
export type DirectMessageReportPreviewDto = Readonly<{ message: DirectMessageReportSnapshotLineDto; context: readonly DirectMessageReportSnapshotLineDto[]; snapshotFingerprint: string; alreadyReported: boolean }>
export type DirectMessageReportSummaryDto = Readonly<{ id: string; createdAt: string; source: 'MP'; reporter: Readonly<{ id: string; displayName: string }>; reported: Readonly<{ id: string; displayName: string }>; message: DirectMessageReportSnapshotLineDto }>
export type DirectMessageReportPageDto = Readonly<{ reports: readonly DirectMessageReportSummaryDto[]; page: number; pageSize: 20; total: number; totalPages: number }>
export type DirectMessageReportDetailDto = DirectMessageReportSummaryDto & Readonly<{ context: readonly DirectMessageReportSnapshotLineDto[]; snapshotFingerprint: string }>
