export const elementKeys = ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'] as const

export type ElementKey = (typeof elementKeys)[number]

export type PlayerDto = Readonly<{
  id: string
  displayName: string
  elementKey: ElementKey | null
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'
}>

export type ModerationPermissionsDto = Readonly<{
  roles: readonly ('MODERATOR' | 'TESTER' | 'ADMIN')[]
  capabilities: Readonly<{ moderationAccess: boolean; selfResourceTools: boolean; selfGameplayTools: boolean; superTools: boolean; canSelectPlayers: boolean; canManageTesters: boolean }>
}>
export type ModerationPlayerDto = Readonly<{ id: string; displayName: string; elementKey: ElementKey | null; level: number; tester: boolean; rank: 'SUPER' | 'MODERATOR' | 'TESTER' | 'PLAYER' }>

export const navigationMenuDestinationIds = ['home', 'invocation', 'box', 'team', 'catalog', 'dailies', 'missions', 'combat', 'event', 'contest', 'inventory', 'shop', 'bank', 'history', 'tutorial', 'configuration'] as const
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
  encounter: Readonly<{ id: string; enemies: readonly Readonly<{ position: 1 | 2 | 3 | 4; character: Omit<GachaCharacterDto, 'classKey'> & Readonly<{ displayOrder: number | null }> }>[] }>
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

export type BackendErrorDto = Readonly<{
  error: Readonly<{
    code: string
    message: string
    requestId?: string
  }>
}>
