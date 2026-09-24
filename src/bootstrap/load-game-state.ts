import { ApiError } from '../api/game-api'
import type {
  CharacterCatalogDto,
  ContestDto,
  CurrentGachaDto,
  DailyChallengeDto,
  DailyCombatDto,
  DailyRewardTodayDto,
  EventDto,
  ExpeditionDto,
  ModerationPermissionsDto,
  MonthlyBossDto,
  NotificationsDto,
  PlayerProgressionDto,
  PlayerResourcesDto,
  PlayerTeamsDto,
  WheelTodayDto,
} from '../api/types'

export type BootstrapReaders = Readonly<{
  resources: () => Promise<PlayerResourcesDto>
  progression: () => Promise<PlayerProgressionDto>
  wheel: () => Promise<WheelTodayDto>
  dailyReward: () => Promise<DailyRewardTodayDto>
  dailyChallenge: () => Promise<DailyChallengeDto>
  dailyCombat: () => Promise<DailyCombatDto>
  monthlyBoss: () => Promise<MonthlyBossDto>
  contest: () => Promise<ContestDto>
  event: () => Promise<EventDto>
  expedition: () => Promise<ExpeditionDto>
  notifications: () => Promise<NotificationsDto>
  gacha: () => Promise<CurrentGachaDto>
  catalog: () => Promise<CharacterCatalogDto>
  teams: () => Promise<PlayerTeamsDto>
  permissions: () => Promise<ModerationPermissionsDto>
}>

export type BootstrapGameState = Readonly<{
  resources: PlayerResourcesDto
  progression: PlayerProgressionDto
  wheel: WheelTodayDto
  dailyReward: DailyRewardTodayDto
  dailyChallenge: DailyChallengeDto
  dailyCombat: DailyCombatDto
  monthlyBoss: MonthlyBossDto
  contest: ContestDto
  event: EventDto
  expedition: ExpeditionDto
  notifications: NotificationsDto
  gacha: CurrentGachaDto
  catalog: CharacterCatalogDto
  teams: PlayerTeamsDto
  permissions: ModerationPermissionsDto
}>

export async function retryBootstrapRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read()
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== null && error.status < 500)) throw error
    return read()
  }
}

export async function loadBootstrapGameState(readers: BootstrapReaders): Promise<BootstrapGameState> {
  const independentReads = Promise.all([
    retryBootstrapRead(readers.resources),
    retryBootstrapRead(readers.progression),
    retryBootstrapRead(readers.wheel),
    retryBootstrapRead(readers.dailyReward),
    retryBootstrapRead(readers.gacha),
    retryBootstrapRead(readers.catalog),
    retryBootstrapRead(readers.permissions),
  ]).then(([resources, progression, wheel, dailyReward, gacha, catalog, permissions]) => ({
    resources, progression, wheel, dailyReward, gacha, catalog, permissions,
  }))

  const reconcilingReads = (async () => {
    // These GETs may provision, reconcile, mutate, or lock the same Player. In particular,
    // Notifications reconciles Expedition internally, so its standalone Expedition read
    // must happen afterwards rather than concurrently.
    const notifications = await retryBootstrapRead(readers.notifications)
    const expedition = await retryBootstrapRead(readers.expedition)
    const teams = await retryBootstrapRead(readers.teams)
    const dailyChallenge = await retryBootstrapRead(readers.dailyChallenge)
    const dailyCombat = await retryBootstrapRead(readers.dailyCombat)
    const monthlyBoss = await retryBootstrapRead(readers.monthlyBoss)
    const contest = await retryBootstrapRead(readers.contest)
    const event = await retryBootstrapRead(readers.event)
    return { notifications, expedition, teams, dailyChallenge, dailyCombat, monthlyBoss, contest, event }
  })()

  const [independent, reconciling] = await Promise.all([independentReads, reconcilingReads])
  return { ...independent, ...reconciling }
}
