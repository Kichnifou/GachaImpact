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

export type BackendErrorDto = Readonly<{
  error: Readonly<{
    code: string
    message: string
    requestId?: string
  }>
}>
