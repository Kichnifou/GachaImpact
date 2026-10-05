import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { ApiError, getGameApiClient } from './api/game-api'
import type { ArcadeMutation } from './api/arcade-types'
import type { BankTransferDto, ContestDto, CurrentGachaDto, DailyChallengeDto, DailyChallengeMutationDto, DailyCombatDto, DailyRewardTodayDto, ElementKey, EventDto, EventRankingDto, ExpeditionDto, GachaCharacterDto, GachaPullDto, ModerationPermissionsDto, ModerationStateDto, MonthlyBossDto, NotificationsDto, PlayerDto, PlayerProgressionDto, PlayerResourcesDto, PlayerTeamsDto, ShopPurchaseDto, WheelTodayDto } from './api/types'
import { useAuth } from './auth/auth-context'
import { resolveBootstrapStage } from './auth/bootstrap-state'
import AuthScreen from './components/AuthScreen'
import ElementChoiceScreen from './components/ElementChoiceScreen'
import GameShell from './components/GameShell'
import OnboardingScreen from './components/OnboardingScreen'
import { apiErrorMessage } from './utils/formatters'
import { wheelTodayFromSpin } from './wheel/wheel-presentation'
import { claimDailyRewardAndRefresh } from './daily-reward/claim-daily-reward'
import { performGachaPullAndRefresh } from './gacha/perform-gacha-pull'
import { abandonGachaPresentationBeforeSignOut, applyGachaPrimogemCostPreview, createGachaPresentationCoordinator, type GachaPresentationCoordinator, type GachaPrimogemCostPreview } from './gacha/gacha-presentation-coordinator'
import { applyBankWalletToResources } from './bank/bank-presentation'
import { gachaLevelRewards, type LevelUpFeedbackEvent } from './progression/level-up-feedback'
import { publishProgressionUpdate } from './progression/publish-progression-update'
import { createExpeditionClientSnapshot, type ExpeditionClientSnapshot } from './expedition/expedition-client-snapshot'
import { createContestRequestCoordinator, type ContestRequestCoordinator } from './contest/contest-request-coordinator'
import { createEventRequestCoordinator, type EventRequestCoordinator } from './event/event-request-coordinator'
import { useEventTemporalRefresh } from './event/use-event-temporal-refresh'
import type { EventMilestoneFeedback } from './event/event-request-coordinator'
import LevelUpFeedback from './components/LevelUpFeedback'
import { confirmedMutation } from './api/confirmed-mutation'
import type { ChatRefreshScope } from './api/types'
import { runChatRefreshScopes } from './chat/refresh-scopes'
import { loadBootstrapGameState, retryBootstrapRead } from './bootstrap/load-game-state'
import { createMissionLoader } from './missions/load-missions'
import { createDailyReadCoordinator } from './dailies/daily-read-coordinator'
import type { DailyId } from './dailies/daily-summary'
import type { FavorDto } from './api/types'

function AppBootstrap() {
  const { status: authStatus, session, configurationMessage, signOut } = useAuth()
  const sessionUserId = session?.user.id
  const notificationSessionRef = useRef(sessionUserId)
  useLayoutEffect(() => { notificationSessionRef.current = sessionUserId }, [sessionUserId])
  const playerReadOwner = useRef({ active: false })
  useLayoutEffect(() => {
    const owner = { active: true }
    playerReadOwner.current = owner
    return () => { owner.active = false }
  }, [sessionUserId, authStatus])
  const [playerStateReadRevision, setPlayerStateReadRevision] = useState(0)
  const [player, setPlayer] = useState<PlayerDto | null>(null)
  const [resources, setResources] = useState<PlayerResourcesDto | null>(null)
  const [progression, setProgression] = useState<PlayerProgressionDto | null>(null)
  const [wheelToday, setWheelToday] = useState<WheelTodayDto | null>(null)
  const [dailyRewardToday, setDailyRewardToday] = useState<DailyRewardTodayDto | null>(null)
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallengeDto | null>(null)
  const [dailyCombat, setDailyCombat] = useState<DailyCombatDto | null>(null)
  const [monthlyBoss, setMonthlyBoss] = useState<MonthlyBossDto | null>(null)
  const [dailyReads] = useState(createDailyReadCoordinator)
  const [dailyErrors, setDailyErrors] = useState<Partial<Record<DailyId, boolean>>>({})
  const [dailyRefreshing, setDailyRefreshing] = useState(false)
  const [dailyFavor, setDailyFavor] = useState<FavorDto | null>(null)
  useLayoutEffect(() => { dailyReads.reset(); setDailyErrors({}); setDailyFavor(null); setDailyRefreshing(false) }, [dailyReads, sessionUserId])
  const readDaily = useCallback(<T,>(key: DailyId, load: () => Promise<T>, publish: (value: T) => void) => dailyReads.read(key, load, value => {
    publish(value); setDailyErrors(current => ({ ...current, [key]: false }))
  }, () => setDailyErrors(current => ({ ...current, [key]: true }))), [dailyReads])
  const acceptDaily = useCallback(<T,>(key: DailyId, value: T, publish: (value: T) => void) => dailyReads.accept(key, value, next => {
    publish(next); setDailyErrors(current => ({ ...current, [key]: false }))
  }), [dailyReads])
  const [contest, setContest] = useState<ContestDto | null>(null)
  const [event, setEvent] = useState<EventDto | null>(null)
  const rankingFlightRef = useRef<{ userId: string | undefined; promise: Promise<EventRankingDto> } | null>(null)
  const [expedition, setExpedition] = useState<ExpeditionClientSnapshot | null>(null)
  const [expeditionMonotonicNow, setExpeditionMonotonicNow] = useState(0)
  const [notifications, setNotifications] = useState<NotificationsDto | null>(null)
  const [gacha, setGacha] = useState<CurrentGachaDto | null>(null)
  const [characters, setCharacters] = useState<readonly GachaCharacterDto[] | null>(null)
  const [teams, setTeams] = useState<PlayerTeamsDto | null>(null)
  const [permissions, setPermissions] = useState<ModerationPermissionsDto | null>(null)
  const [pendingGachaPull, setPendingGachaPull] = useState<{ sessionId: string | null; count: 1 | 10 } | null>(null)
  const [gachaPrimogemPreview, setGachaPrimogemPreview] = useState<GachaPrimogemCostPreview | null>(null)
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null)
  const [fatalError, setFatalError] = useState<{ userId: string; message: string } | null>(null)
  const [levelUpFeedbacks, setLevelUpFeedbacks] = useState<readonly LevelUpFeedbackEvent[]>([])
  const progressionRef = useRef<PlayerProgressionDto | null>(null)
  const arcadeAwardIds = useRef(new Set<string>())
  useEffect(() => { arcadeAwardIds.current.clear() }, [sessionUserId])
  const [contestRequests] = useState<ContestRequestCoordinator<ContestDto>>(
    () => createContestRequestCoordinator<ContestDto>((value) => setContest(value)),
  )
  const [milestoneFeedbacks, setMilestoneFeedbacks] = useState<EventMilestoneFeedback[]>([])
  const [eventRequests] = useState<EventRequestCoordinator>(() => createEventRequestCoordinator((value) => { acceptDaily('event', value, setEvent); if (value.resources) setResources(value.resources) }, values => setMilestoneFeedbacks(current => [...current, ...values.filter(value => !current.some(item => item.id === value.id))])))
  const finishMilestoneFeedback = useCallback((id: string) => setMilestoneFeedbacks(current => current.filter(value => value.id !== id)), [])
  const dismissLevelUpFeedback = useCallback((id: string) => {
    setLevelUpFeedbacks((current) => current.filter((event) => event.id !== id))
  }, [])

  const loadResources = useCallback(async () => {
    const nextResources = await getGameApiClient().getResources()
    setResources(nextResources)
    return nextResources
  }, [])

  const refreshFavorResources = useCallback(async () => {
    const owner = notificationSessionRef.current
    const nextResources = await getGameApiClient().getResources()
    if (notificationSessionRef.current === owner) setResources(nextResources)
    return nextResources
  }, [])

  const loadMissions = useMemo(() => createMissionLoader(
    () => getGameApiClient().getMissions(),
    loadResources,
  ), [loadResources])

  const socialActions = useMemo(() => ({ ...getGameApiClient().social,
    ownMissions: loadMissions,
    sendHearts: (target: string, key: string) => confirmedMutation(() => getGameApiClient().social.sendHearts(target, key), loadResources),
  }), [loadMissions, loadResources])

  const tradeActions = useMemo(() => getGameApiClient().trades, [])

  const loadContest = useCallback(() => contestRequests.read(() => getGameApiClient().getContest()), [contestRequests])
  const refreshContest = useCallback(() => contestRequests.refresh(() => getGameApiClient().getContest()), [contestRequests])
  const loadBox = useCallback(() => getGameApiClient().getBox(), [])
  const setBoxFavorite = useCallback(async (characterId: string, favorite: boolean) =>
    (await getGameApiClient().setBoxFavorite(characterId, favorite)).character, [])
  const setBoxSortPreference = useCallback(async (preference: Parameters<ReturnType<typeof getGameApiClient>['setBoxSortPreference']>[0]) =>
    (await getGameApiClient().setBoxSortPreference(preference)).preference, [])
  const useStella = useCallback(async (characterId: string, idempotencyKey: string) => {
    const result = await getGameApiClient().useStella(characterId, idempotencyKey)
    await refreshContest()
    return result
  }, [refreshContest])
  const loadTeams = useCallback(async () => {
    const nextTeams = await getGameApiClient().getTeams()
    setTeams(nextTeams)
    return nextTeams
  }, [])
  const loadDailyCombat = useCallback(() => readDaily('combat', () => getGameApiClient().getDailyCombat(), setDailyCombat), [readDaily])
  const loadMonthlyBoss = useCallback(() => readDaily('boss', () => getGameApiClient().getMonthlyBoss(), setMonthlyBoss), [readDaily])
  const loadDailyReward = useCallback(() => readDaily('reward', () => getGameApiClient().getDailyRewardToday(), setDailyRewardToday), [readDaily])
  const loadDailyChallenge = useCallback(() => readDaily('challenge', () => getGameApiClient().getDailyChallenge(), setDailyChallenge), [readDaily])
  const loadWheel = useCallback(() => readDaily('wheel', () => getGameApiClient().getWheelToday(), setWheelToday), [readDaily])
  const loadFavor = useCallback(() => readDaily('favor', () => getGameApiClient().getFavor(), setDailyFavor), [readDaily])
  const publishContest = useCallback(async (request: () => Promise<ContestDto>) => {
    const next = await contestRequests.mutate(request)
    if (!next.active && next.lastResult) void loadResources().catch(() => undefined)
    return next
  }, [contestRequests, loadResources])
  const loadContestHistory = useCallback((page: number) => getGameApiClient().getContestHistory(page), [])
  const loadContestHistoryDetail = useCallback((contestId: string) => getGameApiClient().getContestHistoryDetail(contestId), [])
  const loadEvent = useCallback(() => readDaily('event', () => eventRequests.read(() => getGameApiClient().getEvent()), () => undefined), [eventRequests, readDaily])
  const loadEventRanking = useCallback(() => {
    const current = rankingFlightRef.current
    if (current && current.userId === sessionUserId) return current.promise
    const promise = getGameApiClient().getEventRanking()
    rankingFlightRef.current = { userId: sessionUserId, promise }
    const clear = () => { if (rankingFlightRef.current?.promise === promise) rankingFlightRef.current = null }
    void promise.then(clear, clear)
    return promise
  }, [sessionUserId])
  const joinEvent = useCallback((idempotencyKey: string) => eventRequests.mutate(() => getGameApiClient().joinEvent(idempotencyKey)), [eventRequests])
  const claimEventCalendar = useCallback((idempotencyKey: string) => eventRequests.mutate(() => getGameApiClient().claimEventCalendar(idempotencyKey)), [eventRequests])
  const claimEventDailyBonus = useCallback((idempotencyKey: string) => eventRequests.mutate(() => getGameApiClient().claimEventDailyBonus(idempotencyKey)), [eventRequests])
  const convertEventShop = useCallback((target: 'PRIMOGEMS' | 'MORAS', quantity: number, idempotencyKey: string) => eventRequests.mutate(() => getGameApiClient().convertEventShop(target, quantity, idempotencyKey)), [eventRequests])
  const purchaseEventCollection = useCallback((idempotencyKey: string) => eventRequests.mutate(() => getGameApiClient().purchaseEventCollection(idempotencyKey)), [eventRequests])
  const attemptEventGameA = useCallback((idempotencyKey: string) => eventRequests.mutate(() => getGameApiClient().attemptEventGameA(idempotencyKey)), [eventRequests])
  const attemptEventGameB = useCallback((code: string, idempotencyKey: string) => eventRequests.mutate(() => getGameApiClient().attemptEventGameB(code, idempotencyKey)), [eventRequests])
  const searchEventGameCRecipients = useCallback((input: Parameters<ReturnType<typeof getGameApiClient>['searchEventGameCRecipients']>[0]) => getGameApiClient().searchEventGameCRecipients(input), [])
  const sendEventGameC = useCallback((recipientPlayerId: string, message: string, idempotencyKey: string) => eventRequests.mutate(() => getGameApiClient().sendEventGameC(recipientPlayerId, message, idempotencyKey)), [eventRequests])
  useLayoutEffect(() => { eventRequests.reset() }, [eventRequests, sessionUserId])
  useEventTemporalRefresh(event, sessionUserId, loadEvent)
  const loadNavigationPreferences = useCallback(() => getGameApiClient().getNavigationPreferences(), [])
  const loadRanking = useCallback((metric: string, page: number) => getGameApiClient().getRanking(metric, page), [])
  const loadHistory = useCallback((category: 'banners' | 'event', page: number) => getGameApiClient().getHistory(category, page), [])
  const saveNavigationPreferences = useCallback((value: Parameters<ReturnType<typeof getGameApiClient>['putNavigationPreferences']>[0]) => getGameApiClient().putNavigationPreferences(value), [])
  useEffect(() => { contestRequests.reset() }, [contestRequests, sessionUserId])
  const publishExpedition = useCallback((next: ExpeditionDto) => {
    const observedAt = performance.now()
    setExpedition(createExpeditionClientSnapshot(next, observedAt))
    setExpeditionMonotonicNow(observedAt)
    return next
  }, [])
  const loadExpedition = useCallback(() => readDaily('expedition', () => getGameApiClient().getExpedition(), publishExpedition), [publishExpedition, readDaily])
  const refreshDailyFlight = useRef<Promise<void> | null>(null)
  const refreshDailies = useCallback(() => {
    if (refreshDailyFlight.current) return refreshDailyFlight.current
    const owner = notificationSessionRef.current
    setDailyRefreshing(true)
    const request = Promise.allSettled([loadDailyReward(), loadWheel(), loadDailyChallenge(), loadDailyCombat(), loadMonthlyBoss(), loadExpedition(), loadEvent(), loadFavor()]).then(() => undefined)
      .finally(() => { if (refreshDailyFlight.current === request) refreshDailyFlight.current = null; if (owner === notificationSessionRef.current) setDailyRefreshing(false) })
    refreshDailyFlight.current = request
    return request
  }, [loadDailyReward, loadWheel, loadDailyChallenge, loadDailyCombat, loadMonthlyBoss, loadExpedition, loadEvent, loadFavor])
  useLayoutEffect(() => { refreshDailyFlight.current = null }, [sessionUserId])
  const notificationFlight = useRef<{ userId: string | undefined; promise: Promise<NotificationsDto> } | null>(null)
  const loadNotifications = useCallback(() => {
    if (notificationFlight.current && notificationFlight.current.userId === sessionUserId) return notificationFlight.current.promise
    const requestedFor = sessionUserId
    const promise = getGameApiClient().getNotifications().then(next => { if (notificationSessionRef.current === requestedFor) { setNotifications(next); if (next.expedition) acceptDaily('expedition', next.expedition, publishExpedition) } return next }).finally(() => { if (notificationFlight.current?.promise === promise) notificationFlight.current = null })
    notificationFlight.current = { userId: sessionUserId, promise }
    return promise
  }, [acceptDaily, publishExpedition, sessionUserId])
  const consultEventGameCMessages = useCallback(async () => { const result = await eventRequests.mutate(() => getGameApiClient().consultEventGameCMessages()); await loadNotifications(); return result }, [eventRequests, loadNotifications])
  const expeditionDeadlineRead = useRef<string | null>(null)
  useEffect(() => {
    if (expedition?.value.operationalStatus !== 'RUNNING' || !expedition.value.readyAt) return
    const deadlineKey = `${sessionUserId}:${expedition.value.readyAt}`
    if (expeditionDeadlineRead.current === deadlineKey) return
    const delay = Math.max(0, expedition.value.remainingSeconds * 1000 - (performance.now() - expedition.observedAt)) + 100
    const timer = window.setTimeout(() => { expeditionDeadlineRead.current = deadlineKey; void Promise.allSettled([loadExpedition(), loadNotifications()]) }, delay)
    return () => window.clearTimeout(timer)
  }, [expedition, sessionUserId, loadExpedition, loadNotifications])
  useEffect(() => {
    if (expedition?.value.operationalStatus !== 'RUNNING') return
    const timer = window.setInterval(() => setExpeditionMonotonicNow(performance.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [expedition?.observedAt, expedition?.value.operationalStatus])
  const publishBankTransfer = useCallback((result: BankTransferDto) => {
    setResources((current) => current ? applyBankWalletToResources(current, result) : current)
    return result
  }, [])
  const loadBank = useCallback(() => getGameApiClient().getBank(), [])
  const depositBank = useCallback(async (amount: string, idempotencyKey: string) =>
    publishBankTransfer(await getGameApiClient().depositBank(amount, idempotencyKey)), [publishBankTransfer])
  const withdrawBank = useCallback(async (amount: string, idempotencyKey: string) =>
    publishBankTransfer(await getGameApiClient().withdrawBank(amount, idempotencyKey)), [publishBankTransfer])
  const loadShop = useCallback(() => getGameApiClient().getShop(), [])
  const loadShopHistory = useCallback((page: number) => getGameApiClient().getShopHistory(page), [])
  const loadBankHistory = useCallback((page: number, type?: 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST') => getGameApiClient().getBankHistory(page, type), [])
  const loadGachaHistory = useCallback((page: number) => getGameApiClient().getGachaHistory(page), [])
  const loadInventory = useCallback(() => getGameApiClient().getInventory(), [])
  const loadInventoryItemDetail = useCallback((itemId: string, page?: number) => getGameApiClient().getInventoryItemDetail(itemId, page), [])
  const loadMonthlyBossHistory = useCallback((page: number) => getGameApiClient().getMonthlyBossHistory(page), [])
  const purchaseShop = useCallback(async (itemId: string, quantity: string, idempotencyKey: string) => {
    const result: ShopPurchaseDto = await getGameApiClient().purchaseShopItem(itemId, quantity, idempotencyKey)
    setResources(result.resources)
    setGacha((current) => current ? { ...current, playerState: result.gachaState } : current)
    return result
  }, [])
  const loadGiftCodes = useCallback(() => getGameApiClient().getGiftCodes(), [])
  const loadBannerVotes = useCallback(() => getGameApiClient().getBannerVotes(), [])
  const voteForBanner = useCallback((characterId: string, rotationId: string) => getGameApiClient().voteForBanner(characterId, rotationId), [])
  const reloadCatalog = useCallback(async () => { setCharacters((await getGameApiClient().getCharacters()).characters) }, [])
  const claimGiftCode = useCallback(async (editionId: string, idempotencyKey: string) => {
    const result = await getGameApiClient().claimGiftCode(editionId, idempotencyKey)
    setResources(result.resources)
    await Promise.all([loadNotifications(), loadEvent()])
    return result
  }, [loadNotifications, loadEvent])
  const loadAdminGiftCodes = useCallback((query: Parameters<ReturnType<typeof getGameApiClient>['getAdminGiftCodes']>[0]) => getGameApiClient().getAdminGiftCodes(query), [])
  const createGiftCode = useCallback((input: Parameters<ReturnType<typeof getGameApiClient>['createGiftCode']>[0]) => getGameApiClient().createGiftCode(input), [])
  const publishGiftCode = useCallback((codeId: string, key: string) => getGameApiClient().publishGiftCode(codeId, key), [])
  const updateGiftCode = useCallback((codeId: string, input: Parameters<ReturnType<typeof getGameApiClient>['updateGiftCode']>[1]) => getGameApiClient().updateGiftCode(codeId, input), [])
  const loadGiftCodeClaimants = useCallback((codeId: string, query: Parameters<ReturnType<typeof getGameApiClient>['getGiftCodeClaimants']>[1]) => getGameApiClient().getGiftCodeClaimants(codeId, query), [])

  const loadGameState = useCallback(async () => {
    const owner = playerReadOwner.current
    const api = getGameApiClient()
    const next = await loadBootstrapGameState({
      resources: api.getResources,
      progression: api.getProgression,
      wheel: api.getWheelToday,
      dailyReward: api.getDailyRewardToday,
      dailyChallenge: api.getDailyChallenge,
      dailyCombat: api.getDailyCombat,
      monthlyBoss: api.getMonthlyBoss,
      contest: loadContest,
      event: () => eventRequests.read(() => api.getEvent()),
      expedition: api.getExpedition,
      notifications: api.getNotifications,
      gacha: api.getCurrentGacha,
      catalog: api.getCharacters,
      teams: api.getTeams,
      permissions: api.getPermissions,
    })
    if (!owner.active || owner !== playerReadOwner.current) return
    setResources(next.resources)
    progressionRef.current = next.progression
    setProgression(next.progression)
    acceptDaily('wheel', next.wheel, setWheelToday)
    acceptDaily('reward', next.dailyReward, setDailyRewardToday)
    acceptDaily('challenge', next.dailyChallenge, setDailyChallenge)
    acceptDaily('combat', next.dailyCombat, setDailyCombat)
    acceptDaily('boss', next.monthlyBoss, setMonthlyBoss)
    setContest(next.contest)
    setEvent(next.event)
    publishExpedition(next.expedition)
    setNotifications(next.notifications)
    setGacha(next.gacha)
    setCharacters(next.catalog.characters)
    setTeams(next.teams)
    setPermissions(next.permissions)
    setPlayerStateReadRevision(value => value + 1)
  }, [acceptDaily, eventRequests, loadContest, publishExpedition])

  const playerRefreshFlight = useRef<{ owner: { active: boolean }; promise: Promise<void> } | null>(null)
  const refreshPlayerState = useCallback(() => {
    const owner = playerReadOwner.current
    if (playerRefreshFlight.current?.owner === owner) return playerRefreshFlight.current.promise
    const promise = (async () => {
      const nextPlayer = await getGameApiClient().getCurrentPlayer()
      if (!owner.active || owner !== playerReadOwner.current) return
      await Promise.all([loadGameState(), loadFavor().catch(() => undefined)])
      if (owner.active && owner === playerReadOwner.current) setPlayer(nextPlayer)
    })().finally(() => { if (playerRefreshFlight.current?.promise === promise) playerRefreshFlight.current = null })
    playerRefreshFlight.current = { owner, promise }
    return promise
  }, [loadGameState, loadFavor])

  const publishProgression = useCallback((next: PlayerProgressionDto, options: { id: string; rewards?: readonly { resourceKey: string; amount: string }[]; emitLevelUpFeedback?: boolean }) => {
    const published = publishProgressionUpdate(progressionRef.current, next, options)
    progressionRef.current = published.progression
    setProgression(published.progression)
    if (published.feedback) setLevelUpFeedbacks((current) => [...current, published.feedback!])
  }, [])

  const publishArcadeMutation = useCallback((result: ArcadeMutation, ownerPlayerId: string) => {
    const award = result.award
    if (!award || ownerPlayerId !== player?.id || notificationSessionRef.current !== sessionUserId || arcadeAwardIds.current.has(award.operationId)) return
    arcadeAwardIds.current.add(award.operationId)
    if (result.alreadyProcessed || progressionRef.current && BigInt(progressionRef.current.totalXp) > BigInt(award.progression.totalXp)) {
      // A receipt is immutable; refresh current balances instead of restoring its older snapshot.
      void Promise.all([getGameApiClient().getResources(), getGameApiClient().getProgression()]).then(([nextResources, nextProgression]) => {
        if (notificationSessionRef.current !== sessionUserId) return
        setResources(nextResources); publishProgression(nextProgression, { id: `arcade:${award.operationId}`, emitLevelUpFeedback: false })
      }).catch(() => { arcadeAwardIds.current.delete(award.operationId) })
      return
    }
    setResources(award.resources)
    publishProgression(award.progression, { id: `arcade:${award.operationId}`, rewards: award.rewards })
  }, [player?.id, publishProgression, sessionUserId])

  const refreshChatScopes = useCallback(async (scopes: readonly ChatRefreshScope[]) => {
    const api = getGameApiClient()
    await runChatRefreshScopes(scopes, {
      player: () => api.getCurrentPlayer().then(setPlayer),
      resources: loadResources,
      progression: () => api.getProgression().then(next => { progressionRef.current = next; setProgression(next) }),
      gacha: () => api.getCurrentGacha().then(setGacha),
      teams: loadTeams,
      dailyChallenge: loadDailyChallenge,
      wheel: loadWheel,
      dailyCombat: loadDailyCombat,
      monthlyBoss: loadMonthlyBoss,
      contest: refreshContest,
      expedition: loadExpedition,
      event: loadEvent,
      notifications: loadNotifications,
    })
  }, [loadDailyChallenge, loadWheel, loadDailyCombat, loadEvent, loadExpedition, loadMonthlyBoss, loadNotifications, loadResources, loadTeams, refreshContest])

  const applyModerationState = useCallback((next: ModerationStateDto) => {
    setPermissions(next.permissions)
    setResources(next.resources)
    publishProgression(next.progression, { id: `moderation:${next.player.id}:${next.progression.totalXp}`, emitLevelUpFeedback: false })
    setGacha((current) => current ? { ...current, playerState: next.gachaState } : current)
  }, [publishProgression])
  const loadModeration = useCallback((targetPlayerId?: string) => targetPlayerId
    ? getGameApiClient().getModerationPlayerState(targetPlayerId)
    : getGameApiClient().getModerationState(), [])
  const listModerationPlayers = useCallback((query: Parameters<ReturnType<typeof getGameApiClient>['listModerationPlayers']>[0]) => getGameApiClient().listModerationPlayers(query), [])
  const moderateResource = useCallback((targetPlayerId: string, input: Parameters<ReturnType<typeof getGameApiClient>['adjustModerationResource']>[0]) => targetPlayerId === player?.id
    ? getGameApiClient().adjustModerationResource(input)
    : getGameApiClient().adjustModerationPlayerResource(targetPlayerId, input), [player?.id])
  const moderateXp = useCallback((targetPlayerId: string, input: Parameters<ReturnType<typeof getGameApiClient>['setModerationPlayerXp']>[1]) => getGameApiClient().setModerationPlayerXp(targetPlayerId, input), [])
  const moderateGacha = useCallback((targetPlayerId: string, input: Parameters<ReturnType<typeof getGameApiClient>['setModerationPlayerGacha']>[1]) => getGameApiClient().setModerationPlayerGacha(targetPlayerId, input), [])
  const moderateStella = useCallback((targetPlayerId: string, quantity: string, idempotencyKey: string) => getGameApiClient().setModerationPlayerStella(targetPlayerId, quantity, idempotencyKey), [])
  const handleModerationApplied = useCallback((state: ModerationStateDto, targetIsSelf: boolean) => {
    if (targetIsSelf) applyModerationState(state)
  }, [applyModerationState])

  const publishGachaUpdate = useCallback((refreshed: Awaited<ReturnType<typeof performGachaPullAndRefresh>>) => {
    if (refreshed.resources) setResources(refreshed.resources)
    if (refreshed.progression) {
      publishProgression(refreshed.progression, { id: `${refreshed.result.operation.id}:${refreshed.progression.level}`, rewards: gachaLevelRewards(refreshed.result) })
    }
    setGacha((current) => refreshed.gacha ?? (current ? { ...current, playerState: refreshed.result.playerState } : current))
  }, [publishProgression])

  const gachaPresentation = useRef<GachaPresentationCoordinator | null>(null)

  useLayoutEffect(() => {
    if (gachaPresentation.current === null) gachaPresentation.current = createGachaPresentationCoordinator({
      execute: async (count, idempotencyKey, onPullSucceeded) => {
        const result = await performGachaPullAndRefresh(getGameApiClient(), count, idempotencyKey, onPullSucceeded)
        const [nextDailyChallenge] = await Promise.all([getGameApiClient().getDailyChallenge(), loadMonthlyBoss(), refreshContest()])
        acceptDaily('challenge', nextDailyChallenge, setDailyChallenge)
        return result
      },
      publish: publishGachaUpdate,
      createIdempotencyKey: () => crypto.randomUUID(),
      onPendingCountChange: (count, pendingSessionId) => {
        setPendingGachaPull((current) => {
          if (count !== null) return { sessionId: pendingSessionId, count }
          return current?.sessionId === pendingSessionId ? null : current
        })
      },
      onPrimogemCostPreview: setGachaPrimogemPreview,
      onPrimogemCostPreviewCleared: (previewSessionId) => {
        setGachaPrimogemPreview((current) => current?.sessionId === previewSessionId ? null : current)
      },
    })
    gachaPresentation.current.setSession(sessionUserId ?? null)
  }, [acceptDaily, loadMonthlyBoss, publishGachaUpdate, refreshContest, sessionUserId])

  const pendingGachaPullCount = pendingGachaPull && pendingGachaPull.sessionId === sessionUserId
    ? pendingGachaPull.count
    : null
  const visibleResources = resources
    ? applyGachaPrimogemCostPreview(resources, gachaPrimogemPreview, sessionUserId)
    : null

  useEffect(() => {
    if (authStatus !== 'signedIn' || !sessionUserId) return

    let active = true

    void retryBootstrapRead(() => getGameApiClient().getCurrentPlayer())
      .then(async (nextPlayer) => {
        if (!active) return
        setMilestoneFeedbacks([])
        setPlayer(nextPlayer)
        if (nextPlayer.elementKey) await loadGameState()
        if (active) {
          setFatalError(null)
          setResolvedUserId(sessionUserId)
        }
      })
      .catch(async (error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && error.code === 'ONBOARDING_DISPLAY_NAME_REQUIRED') {
          setPlayer(null)
          setResources(null)
          setProgression(null)
          progressionRef.current = null
          setLevelUpFeedbacks([])
          setMilestoneFeedbacks([])
          setWheelToday(null)
          setDailyRewardToday(null)
          setDailyChallenge(null)
          setDailyCombat(null)
          setMonthlyBoss(null)
          setContest(null)
          setExpedition(null)
          setExpeditionMonotonicNow(0)
          setNotifications(null)
          setGacha(null)
          setCharacters(null)
          setTeams(null)
          setPermissions(null)
          setFatalError(null)
          setResolvedUserId(sessionUserId)
          return
        }
        if (error instanceof ApiError && error.status === 401) {
          await signOut()
          return
        }
        setFatalError({ userId: sessionUserId, message: apiErrorMessage(error) })
        setResolvedUserId(sessionUserId)
      })

    return () => {
      active = false
    }
  }, [authStatus, loadGameState, sessionUserId, signOut])

  const playerResolved = Boolean(sessionUserId && resolvedUserId === sessionUserId)
  const canRefreshPlayerState = useCallback(() => gachaPresentation.current?.getSnapshot().phase === 'idle', [])
  const stage = resolveBootstrapStage(
    authStatus,
    player,
    playerResolved,
    resources !== null && progression !== null && wheelToday !== null && dailyRewardToday !== null && dailyChallenge !== null && dailyCombat !== null && monthlyBoss !== null && contest !== null && expedition !== null && notifications !== null && gacha !== null && characters !== null && teams !== null && permissions !== null,
  )
  const currentFatalError =
    fatalError && fatalError.userId === sessionUserId ? fatalError.message : null

  if (stage === 'configurationError') {
    return <StatusScreen title="Configuration requise" message={configurationMessage ?? 'La configuration frontend est incomplète.'} />
  }

  if (stage === 'signedOut') return <AuthScreen />
  if (authStatus === 'signedIn' && currentFatalError) return <StatusScreen title="Connexion impossible" message={currentFatalError} />
  if (stage === 'loading') return <StatusScreen title="Connexion aux astres…" message="Restauration de votre session et de votre profil." loading />

  if (stage === 'onboarding') {
    return (
      <OnboardingScreen
        onSubmit={async (displayName) => {
          try {
            const nextPlayer = await getGameApiClient().onboardPlayer(displayName)
            setPlayer(nextPlayer)
          } catch (error) {
            throw new Error(apiErrorMessage(error))
          }
        }}
      />
    )
  }

  if (stage === 'elementRequired' && player) {
    return (
      <ElementChoiceScreen
        onChoose={async (elementKey: ElementKey) => {
          try {
            await getGameApiClient().chooseElement(elementKey)
            const nextPlayer = { ...player, elementKey }
            setPlayer(nextPlayer)
            await loadGameState()
          } catch (error) {
            throw new Error(apiErrorMessage(error))
          }
        }}
      />
    )
  }

  if (!player || !resources || !visibleResources || !progression || !wheelToday || !dailyRewardToday || !dailyChallenge || !dailyCombat || !monthlyBoss || !contest || !event || !expedition || !notifications || !gacha || !characters || !teams || !permissions) {
    return <StatusScreen title="Chargement du profil…" message="Synchronisation de vos ressources." loading />
  }

  return (
    <><GameShell
      dailyRefresh={{ refresh: refreshDailies, refreshing: dailyRefreshing, errors: dailyErrors, favor: dailyFavor }}
      onRefreshResources={refreshFavorResources}
      externalFeedbackPending={milestoneFeedbacks.length > 0}
      onRefreshChatScopes={refreshChatScopes}
      onRefreshPlayerState={refreshPlayerState}
      canRefreshPlayerState={canRefreshPlayerState}
      playerStateReadRevision={playerStateReadRevision}
      onRefreshPlayer={async () => setPlayer(await getGameApiClient().getCurrentPlayer())}
      key={player.id}
      socialActions={socialActions}
      tradeActions={tradeActions}
      onTradeSnapshot={snapshot => setResources(current => {
        if (!current) return current
        const particles = { ...current.particles }
        for (const stock of snapshot.stocks) {
          const element = stock.resourceKey.replace('particles_', '') as keyof typeof particles
          if (element in particles) particles[element] = stock.total
        }
        return { ...current, particles }
      })}
      bannerVoteActions={{ onLoadVotes: loadBannerVotes, onVote: voteForBanner, onReloadCatalog: reloadCatalog }}
      player={player}
      resources={visibleResources}
      progression={progression}
      wheelToday={wheelToday}
      dailyRewardToday={dailyRewardToday}
      dailyChallenge={dailyChallenge}
      dailyCombat={dailyCombat}
      onLoadMissions={loadMissions}
      monthlyBoss={monthlyBoss}
      contest={contest}
      event={event}
      onLoadEvent={loadEvent}
      onJoinEvent={joinEvent}
      onClaimEventCalendar={claimEventCalendar}
      onClaimEventDailyBonus={claimEventDailyBonus}
      onLoadEventRanking={loadEventRanking}
      onConvertEventShop={convertEventShop}
      onPurchaseEventCollection={purchaseEventCollection}
      onAttemptEventGameA={attemptEventGameA}
      onAttemptEventGameB={attemptEventGameB}
      onSearchEventGameCRecipients={searchEventGameCRecipients}
      onSendEventGameC={sendEventGameC}
      onConsultEventGameCMessages={consultEventGameCMessages}
      onRefreshContest={loadContest}
      onLoadContestHistory={loadContestHistory}
      onLoadContestHistoryDetail={loadContestHistoryDetail}
      onOpenContest={(characterId, key) => publishContest(() => getGameApiClient().openContest(characterId, key))}
      onJoinContest={(characterId, key) => publishContest(() => getGameApiClient().joinContest(characterId, key))}
      onSelectContestLegend={(characterId, key) => publishContest(() => getGameApiClient().selectContestLegend(characterId, key))}
      onSetContestReady={(ready, key) => publishContest(() => getGameApiClient().setContestReady(ready, key))}
      onStartContest={(key) => publishContest(() => getGameApiClient().startContest(key))}
      onSpectateContest={(key) => publishContest(() => getGameApiClient().spectateContest(key))}
      onLeaveContest={(key) => publishContest(() => getGameApiClient().leaveContest(key))}
      onCancelContest={(key) => publishContest(() => getGameApiClient().cancelContest(key))}
      onPlayContest={(action, key) => publishContest(() => getGameApiClient().playContest(action, key))}
      onSupportContest={(slot, key) => publishContest(() => getGameApiClient().supportContest(slot, key))}
      onRemoveContestParticipant={(playerId, key) => publishContest(() => getGameApiClient().removeContestParticipant(playerId, key))}
      onRemoveContestSpectator={(playerId, key) => publishContest(() => getGameApiClient().removeContestSpectator(playerId, key))}
      onLoadMonthlyBoss={loadMonthlyBoss}
      expedition={expedition}
      expeditionMonotonicNow={expeditionMonotonicNow}
      notifications={notifications}
      onLoadExpedition={loadExpedition}
      onStartExpedition={async (characterId, idempotencyKey) => { return dailyReads.mutate('expedition', () => getGameApiClient().startExpedition(characterId, idempotencyKey), result => { acceptDaily('expedition', result.view, publishExpedition); }) }}
      onClaimExpedition={async (idempotencyKey) => { return dailyReads.mutate('expedition', () => getGameApiClient().claimExpedition(idempotencyKey), result => { acceptDaily('expedition', result.view, publishExpedition); setResources(result.resources); void loadNotifications().catch(() => undefined); }) }}
      onLoadNotifications={loadNotifications}
      onReadNotification={async (id) => { const next = await getGameApiClient().readNotification(id); setNotifications(next); return next }}
      onArchiveNotification={async (id) => { const next = await getGameApiClient().archiveNotification(id); setNotifications(next); return next }}
      onReadAllNotifications={async () => { const next = await getGameApiClient().readAllNotifications(); setNotifications(next); return next }}
      onArchiveReadNotifications={async () => { const next = await getGameApiClient().archiveReadNotifications(); setNotifications(next); return next }}
      onLoadDailyCombat={loadDailyCombat}
      onSetDailyCombatSlot={async (position, characterId) => { return dailyReads.mutate('combat', () => getGameApiClient().setDailyCombatSlot(position, characterId), next => acceptDaily('combat', next, setDailyCombat)) }}
      onRemoveDailyCombatSlot={async (position) => { return dailyReads.mutate('combat', () => getGameApiClient().removeDailyCombatSlot(position), next => acceptDaily('combat', next, setDailyCombat)) }}
      onCopyActiveTeamToDailyCombat={async () => { return dailyReads.mutate('combat', () => getGameApiClient().copyActiveTeamToDailyCombat(), next => acceptDaily('combat', next, setDailyCombat)) }}
      onAutoSelectDailyCombat={async () => { return dailyReads.mutate('combat', () => getGameApiClient().autoSelectDailyCombat(), next => acceptDaily('combat', next, setDailyCombat)) }}
      onClearDailyCombatLoadout={async () => { return dailyReads.mutate('combat', () => getGameApiClient().clearDailyCombatLoadout(), next => acceptDaily('combat', next, setDailyCombat)) }}
      onFightDailyCombat={async (idempotencyKey) => { return dailyReads.mutate('combat', () => getGameApiClient().fightDailyCombat(idempotencyKey), result => { acceptDaily('combat', result.view, setDailyCombat); setResources(result.resources); }) }}
      onSetMonthlyBossSlot={async (position, characterId) => { return dailyReads.mutate('boss', () => getGameApiClient().setMonthlyBossSlot(position, characterId), next => acceptDaily('boss', next, setMonthlyBoss)) }}
      onRemoveMonthlyBossSlot={async (position) => { return dailyReads.mutate('boss', () => getGameApiClient().removeMonthlyBossSlot(position), next => acceptDaily('boss', next, setMonthlyBoss)) }}
      onCopyActiveTeamToMonthlyBoss={async () => { return dailyReads.mutate('boss', () => getGameApiClient().copyActiveTeamToMonthlyBoss(), next => acceptDaily('boss', next, setMonthlyBoss)) }}
      onClearMonthlyBossLoadout={async () => { return dailyReads.mutate('boss', () => getGameApiClient().clearMonthlyBossLoadout(), next => acceptDaily('boss', next, setMonthlyBoss)) }}
      onAttackMonthlyBoss={async (bossId, idempotencyKey) => { return dailyReads.mutate('boss', () => getGameApiClient().attackMonthlyBoss(bossId, idempotencyKey), result => { acceptDaily('boss', result.view, setMonthlyBoss); setResources(result.resources); void loadNotifications().catch(() => undefined); }) }}
      onLoadMonthlyBossHistory={loadMonthlyBossHistory}
      onPurchaseDailyChallenge={async (idempotencyKey) => {
        return dailyReads.mutate('challenge', () => getGameApiClient().purchaseDailyChallenge(idempotencyKey), result => { acceptDaily('challenge', result, setDailyChallenge); setResources(result.resources) })
      }}
      onSwitchDailyChallenge={async (idempotencyKey) => {
        return dailyReads.mutate('challenge', () => getGameApiClient().switchDailyChallenge(idempotencyKey), result => { acceptDaily('challenge', result, setDailyChallenge); setResources(result.resources) })
      }}
      gacha={gacha}
      characters={characters}
      teams={teams}
      permissions={permissions}
      onLoadModeration={loadModeration}
      onListModerationPlayers={listModerationPlayers}
      onModerationResource={moderateResource}
      onModerationXp={moderateXp}
      onModerationGacha={moderateGacha}
      onModerationStella={moderateStella}
      onModerationApplied={handleModerationApplied}
      levelUpFeedbacks={levelUpFeedbacks}
      onArcadeMutation={publishArcadeMutation}
      onLevelUpFeedbackFinished={dismissLevelUpFeedback}
      onLoadTeams={loadTeams}
      onActivateTeam={async (teamId) => { const next = await getGameApiClient().activateTeam(teamId); setTeams(next); return next }}
      onRenameTeam={async (teamId, name) => { const next = await getGameApiClient().renameTeam(teamId, name); setTeams(next); return next }}
      onCreateNextTeam={async (expectedPosition) => { const next = await getGameApiClient().createNextTeam(expectedPosition); setTeams(next); return next }}
      onDeleteTeam={async (teamId) => { const next = await getGameApiClient().deleteTeam(teamId); setTeams(next); return next }}
      onReorderTeams={async (teamIds) => { const next = await getGameApiClient().reorderTeams(teamIds); setTeams(next); return next }}
      onSetTeamSlot={async (teamId, position, characterId) => { const next = await getGameApiClient().setTeamSlot(teamId, position, characterId); setTeams(next); return next }}
      onReorderTeamSlots={async (teamId, characterIds) => { const next = await getGameApiClient().reorderTeamSlots(teamId, characterIds); setTeams(next); return next }}
      onRemoveTeamSlot={async (teamId, position) => { const next = await getGameApiClient().removeTeamSlot(teamId, position); setTeams(next); return next }}
      onClearTeam={async (teamId) => { const next = await getGameApiClient().clearTeam(teamId); setTeams(next); return next }}
      onSetGachaTarget={async (characterId) => {
        const { playerState } = await getGameApiClient().setGachaTarget(characterId)
        setGacha((current) => current ? { ...current, playerState } : current)
      }}
      onPullGacha={(count): Promise<GachaPullDto> => gachaPresentation.current!.requestPull(count, resources.primogems)}
      pendingGachaPullCount={pendingGachaPullCount}
      onGachaPresentationDisclosed={(operationId) => { gachaPresentation.current?.disclose(operationId) }}
      onGachaPresentationAbandoned={() => { gachaPresentation.current?.abandon() }}
      onGetGachaHistory={loadGachaHistory}
      onLoadBox={loadBox}
      onSetBoxFavorite={setBoxFavorite}
      onSetBoxSortPreference={setBoxSortPreference}
      onUseStella={useStella}
      onLoadBank={loadBank}
      onLoadInventory={loadInventory}
      onLoadInventoryItemDetail={loadInventoryItemDetail}
      onConvertParticles={async (amount, idempotencyKey): Promise<DailyChallengeMutationDto> => {
        return dailyReads.mutate('challenge', () => getGameApiClient().convertPersonalParticles(amount, idempotencyKey), result => { acceptDaily('challenge', result, setDailyChallenge); setResources(result.resources) })
      }}
      onLoadBankHistory={loadBankHistory}
      onDepositBank={depositBank}
      onWithdrawBank={withdrawBank}
      onLoadShop={loadShop}
      onLoadShopHistory={loadShopHistory}
      onPurchaseShop={purchaseShop}
      onLoadGiftCodes={loadGiftCodes}
      onClaimGiftCode={claimGiftCode}
      onLoadAdminGiftCodes={loadAdminGiftCodes}
      onCreateGiftCode={createGiftCode}
      onPublishGiftCode={publishGiftCode}
      onUpdateGiftCode={updateGiftCode}
      onGiftCodeClaimants={loadGiftCodeClaimants}
      onLoadNavigationPreferences={loadNavigationPreferences}
      onLoadRanking={loadRanking}
      onLoadHistory={loadHistory}
      onSaveNavigationPreferences={saveNavigationPreferences}
      onClaimDailyReward={async () => {
        const response = await dailyReads.mutate('reward', () => claimDailyRewardAndRefresh(getGameApiClient()), ({ result, resources: nextResources }) => {
          setResources(nextResources)
          acceptDaily('reward', { claimed: true, businessDate: result.businessDate, rewards: result.rewards }, setDailyRewardToday)
        })
        return response.result
      }}
      onSpinWheel={async () => {
        const owner = notificationSessionRef.current
        const result = await dailyReads.mutate('wheel', () => getGameApiClient().spinWheel(), value => acceptDaily('wheel', wheelTodayFromSpin(value), setWheelToday))
        if (owner === notificationSessionRef.current) await refreshFavorResources()
        return result
      }}
      onSignOut={async () => {
        contestRequests.reset()
        setPendingGachaPull(null)
        setGachaPrimogemPreview(null)
        setTeams(null)
        setDailyCombat(null)
        setMonthlyBoss(null)
        setPermissions(null)
        progressionRef.current = null
        setLevelUpFeedbacks([])
        setMilestoneFeedbacks([])
        await abandonGachaPresentationBeforeSignOut(gachaPresentation.current!, signOut)
      }}
    />
    {!levelUpFeedbacks.length && milestoneFeedbacks[0] && <LevelUpFeedback key={milestoneFeedbacks[0].id} event={{ id: milestoneFeedbacks[0].id, levelsGained: 0, rewards: [] }} title={`Palier ${milestoneFeedbacks[0].points} atteint`} rewardLabel={milestoneFeedbacks[0].rewardLabel} onFinished={finishMilestoneFeedback} />}
    </>
  )
}

function StatusScreen({ title, message, loading = false }: { title: string; message: string; loading?: boolean }) {
  return (
    <main className="entry-shell">
      <section className="entry-panel compact panel" role={loading ? 'status' : 'alert'}>
        <div className={`entry-brand${loading ? ' loading' : ''}`} aria-hidden="true"><span>✦</span></div>
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  )
}

export default AppBootstrap
