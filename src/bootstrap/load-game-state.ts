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
    // Notifications owns the first Player-lock lane and returns the Expedition projection
    // it just reconciled. The fallback keeps rolling frontend/backend deploys compatible.
    const notifications = await retryBootstrapRead(readers.notifications)
    const playerLockReads = (async () => {
      const expedition = notifications.expedition ?? await retryBootstrapRead(readers.expedition)
      const teams = await retryBootstrapRead(readers.teams)
      const event = await retryBootstrapRead(readers.event)
      return { expedition, teams, event }
    })()
    const [dailyChallenge, dailyCombat, monthlyBoss, contest] = await Promise.all([
      retryBootstrapRead(readers.dailyChallenge),
      retryBootstrapRead(readers.dailyCombat),
      retryBootstrapRead(readers.monthlyBoss),
      retryBootstrapRead(readers.contest),
    ])
    const { expedition, teams, event } = await playerLockReads
    return { notifications, expedition, teams, dailyChallenge, dailyCombat, monthlyBoss, contest, event }
  })()

  const [independent, reconciling] = await Promise.all([independentReads, reconcilingReads])
  return { ...independent, ...reconciling }
}
