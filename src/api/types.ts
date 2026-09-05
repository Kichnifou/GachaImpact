export const elementKeys = ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'] as const

export type ElementKey = (typeof elementKeys)[number]

export type PlayerDto = Readonly<{
  id: string
  displayName: string
  elementKey: ElementKey | null
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'
}>

export type PlayerResourcesDto = Readonly<{
  primogems: string
  moras: string
  particles: Readonly<Record<ElementKey, string>>
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

export type BackendErrorDto = Readonly<{
  error: Readonly<{
    code: string
    message: string
    requestId?: string
  }>
}>
