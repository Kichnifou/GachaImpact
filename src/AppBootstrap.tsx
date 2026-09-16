import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { ApiError, getGameApiClient } from './api/game-api'
import type { BankTransferDto, ContestDto, CurrentGachaDto, DailyChallengeDto, DailyChallengeMutationDto, DailyCombatDto, DailyRewardTodayDto, ElementKey, EventDto, ExpeditionDto, GachaCharacterDto, GachaPullDto, ModerationPermissionsDto, ModerationStateDto, MonthlyBossDto, NotificationsDto, PlayerDto, PlayerProgressionDto, PlayerResourcesDto, PlayerTeamsDto, ShopPurchaseDto, WheelTodayDto } from './api/types'
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

function AppBootstrap() {
  const { status: authStatus, session, configurationMessage, signOut } = useAuth()
  const sessionUserId = session?.user.id
  const [player, setPlayer] = useState<PlayerDto | null>(null)
  const [resources, setResources] = useState<PlayerResourcesDto | null>(null)
  const [progression, setProgression] = useState<PlayerProgressionDto | null>(null)
  const [wheelToday, setWheelToday] = useState<WheelTodayDto | null>(null)
  const [dailyRewardToday, setDailyRewardToday] = useState<DailyRewardTodayDto | null>(null)
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallengeDto | null>(null)
  const [dailyCombat, setDailyCombat] = useState<DailyCombatDto | null>(null)
  const [monthlyBoss, setMonthlyBoss] = useState<MonthlyBossDto | null>(null)
  const [contest, setContest] = useState<ContestDto | null>(null)
  const [event, setEvent] = useState<EventDto | null>(null)
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
  const [contestRequests] = useState<ContestRequestCoordinator<ContestDto>>(
    () => createContestRequestCoordinator<ContestDto>((value) => setContest(value)),
  )
  const [eventRequests] = useState<EventRequestCoordinator>(() => createEventRequestCoordinator((value) => setEvent(value)))
  const dismissLevelUpFeedback = useCallback((id: string) => {
    setLevelUpFeedbacks((current) => current.filter((event) => event.id !== id))
  }, [])

  const loadResources = useCallback(async () => {
    const nextResources = await getGameApiClient().getResources()
    setResources(nextResources)
    return nextResources
  }, [])

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
  const loadDailyCombat = useCallback(async () => {
    const nextDailyCombat = await getGameApiClient().getDailyCombat()
    setDailyCombat(nextDailyCombat)
    return nextDailyCombat
  }, [])
  const loadMonthlyBoss = useCallback(async () => { const next = await getGameApiClient().getMonthlyBoss(); setMonthlyBoss(next); return next }, [])
  const publishContest = useCallback(async (request: () => Promise<ContestDto>) => {
    const next = await contestRequests.mutate(request)
    if (!next.active && next.lastResult) void loadResources().catch(() => undefined)
    return next
  }, [contestRequests, loadResources])
  const loadContestHistory = useCallback((page: number) => getGameApiClient().getContestHistory(page), [])
  const loadContestHistoryDetail = useCallback((contestId: string) => getGameApiClient().getContestHistoryDetail(contestId), [])
  const loadEvent = useCallback(() => eventRequests.refresh(() => getGameApiClient().getEvent()), [eventRequests])
  const joinEvent = useCallback((idempotencyKey: string) => eventRequests.mutate(() => getGameApiClient().joinEvent(idempotencyKey)), [eventRequests])
  const attemptEventGameA = useCallback((idempotencyKey: string) => eventRequests.mutate(() => getGameApiClient().attemptEventGameA(idempotencyKey)), [eventRequests])
  const attemptEventGameB = useCallback((code: string, idempotencyKey: string) => eventRequests.mutate(() => getGameApiClient().attemptEventGameB(code, idempotencyKey)), [eventRequests])
  useLayoutEffect(() => { eventRequests.reset() }, [eventRequests, sessionUserId])
  useEventTemporalRefresh(event, sessionUserId, loadEvent)
  const loadNavigationPreferences = useCallback(() => getGameApiClient().getNavigationPreferences(), [])
  const saveNavigationPreferences = useCallback((value: Parameters<ReturnType<typeof getGameApiClient>['putNavigationPreferences']>[0]) => getGameApiClient().putNavigationPreferences(value), [])
  useEffect(() => { contestRequests.reset() }, [contestRequests, sessionUserId])
  const publishExpedition = useCallback((next: ExpeditionDto) => {
    const observedAt = performance.now()
    setExpedition(createExpeditionClientSnapshot(next, observedAt))
    setExpeditionMonotonicNow(observedAt)
    return next
  }, [])
  const loadExpedition = useCallback(async () => publishExpedition(await getGameApiClient().getExpedition()), [publishExpedition])
  const loadNotifications = useCallback(async () => { const next = await getGameApiClient().getNotifications(); setNotifications(next); return next }, [])
  useEffect(() => {
    if (expedition?.value.operationalStatus !== 'RUNNING' || !expedition.value.readyAt) return
    const delay = Math.max(0, Date.parse(expedition.value.readyAt) - Date.now()) + 100
    const timer = window.setTimeout(() => { void Promise.all([loadExpedition(), loadNotifications()]).catch(() => undefined) }, delay)
    return () => window.clearTimeout(timer)
  }, [expedition?.value.operationalStatus, expedition?.value.readyAt, loadExpedition, loadNotifications])
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
  const purchaseShop = useCallback(async (itemId: string, quantity: string, idempotencyKey: string) => {
    const result: ShopPurchaseDto = await getGameApiClient().purchaseShopItem(itemId, quantity, idempotencyKey)
    setResources(result.resources)
    setGacha((current) => current ? { ...current, playerState: result.gachaState } : current)
    return result
  }, [])
  const loadGiftCodes = useCallback(() => getGameApiClient().getGiftCodes(), [])
  const claimGiftCode = useCallback(async (editionId: string, idempotencyKey: string) => {
    const result = await getGameApiClient().claimGiftCode(editionId, idempotencyKey)
    setResources(result.resources)
    await loadNotifications()
    return result
  }, [loadNotifications])
  const loadAdminGiftCodes = useCallback((query: Parameters<ReturnType<typeof getGameApiClient>['getAdminGiftCodes']>[0]) => getGameApiClient().getAdminGiftCodes(query), [])
  const createGiftCode = useCallback((input: Parameters<ReturnType<typeof getGameApiClient>['createGiftCode']>[0]) => getGameApiClient().createGiftCode(input), [])
  const publishGiftCode = useCallback((codeId: string, key: string) => getGameApiClient().publishGiftCode(codeId, key), [])
  const updateGiftCode = useCallback((codeId: string, input: Parameters<ReturnType<typeof getGameApiClient>['updateGiftCode']>[1]) => getGameApiClient().updateGiftCode(codeId, input), [])
  const loadGiftCodeClaimants = useCallback((codeId: string, query: Parameters<ReturnType<typeof getGameApiClient>['getGiftCodeClaimants']>[1]) => getGameApiClient().getGiftCodeClaimants(codeId, query), [])

  const loadGameState = useCallback(async () => {
    const api = getGameApiClient()
    const [nextResources, nextProgression, nextWheelToday, nextDailyRewardToday, nextDailyChallenge, nextDailyCombat, nextMonthlyBoss, nextContest, nextEvent, nextExpedition, nextNotifications, nextGacha, nextCatalog, nextTeams, nextPermissions] = await Promise.all([
      api.getResources(),
      api.getProgression(),
      api.getWheelToday(),
      api.getDailyRewardToday(),
      api.getDailyChallenge(),
      api.getDailyCombat(),
      api.getMonthlyBoss(),
      loadContest(),
      eventRequests.read(() => api.getEvent()),
      api.getExpedition(),
      api.getNotifications(),
      api.getCurrentGacha(),
      api.getCharacters(),
      api.getTeams(),
      api.getPermissions(),
    ])
    setResources(nextResources)
    progressionRef.current = nextProgression
    setProgression(nextProgression)
    setWheelToday(nextWheelToday)
    setDailyRewardToday(nextDailyRewardToday)
    setDailyChallenge(nextDailyChallenge)
    setDailyCombat(nextDailyCombat)
    setMonthlyBoss(nextMonthlyBoss)
    void nextContest
    void nextEvent
    publishExpedition(nextExpedition)
    setNotifications(nextNotifications)
    setGacha(nextGacha)
    setCharacters(nextCatalog.characters)
    setTeams(nextTeams)
    setPermissions(nextPermissions)
  }, [eventRequests, loadContest, publishExpedition])

  const publishProgression = useCallback((next: PlayerProgressionDto, options: { id: string; rewards?: readonly { resourceKey: string; amount: string }[]; emitLevelUpFeedback?: boolean }) => {
    const published = publishProgressionUpdate(progressionRef.current, next, options)
    progressionRef.current = published.progression
    setProgression(published.progression)
    if (published.feedback) setLevelUpFeedbacks((current) => [...current, published.feedback!])
  }, [])

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
  const moderateTester = useCallback((targetPlayerId: string, enabled: boolean, idempotencyKey: string) => getGameApiClient().setModerationPlayerTester(targetPlayerId, enabled, idempotencyKey), [])
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
        setDailyChallenge(nextDailyChallenge)
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
  }, [loadMonthlyBoss, publishGachaUpdate, refreshContest, sessionUserId])

  const pendingGachaPullCount = pendingGachaPull && pendingGachaPull.sessionId === sessionUserId
    ? pendingGachaPull.count
    : null
  const visibleResources = resources
    ? applyGachaPrimogemCostPreview(resources, gachaPrimogemPreview, sessionUserId)
    : null

  useEffect(() => {
    if (authStatus !== 'signedIn' || !sessionUserId) return

    let active = true

    void getGameApiClient()
      .getCurrentPlayer()
      .then(async (nextPlayer) => {
        if (!active) return
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

  if (stage === 'loading') return <StatusScreen title="Connexion aux astres…" message="Restauration de votre session et de votre profil." loading />
  if (stage === 'signedOut') return <AuthScreen />
  if (currentFatalError) return <StatusScreen title="Connexion impossible" message={currentFatalError} />

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
    <GameShell
      player={player}
      resources={visibleResources}
      progression={progression}
      wheelToday={wheelToday}
      dailyRewardToday={dailyRewardToday}
      dailyChallenge={dailyChallenge}
      dailyCombat={dailyCombat}
      monthlyBoss={monthlyBoss}
      contest={contest}
      event={event}
      onLoadEvent={loadEvent}
      onJoinEvent={joinEvent}
      onAttemptEventGameA={attemptEventGameA}
      onAttemptEventGameB={attemptEventGameB}
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
      onStartExpedition={async (characterId, idempotencyKey) => { const result = await getGameApiClient().startExpedition(characterId, idempotencyKey); publishExpedition(result.view); return result }}
      onClaimExpedition={async (idempotencyKey) => { const result = await getGameApiClient().claimExpedition(idempotencyKey); publishExpedition(result.view); setResources(result.resources); await loadNotifications(); return result }}
      onLoadNotifications={loadNotifications}
      onReadNotification={async (id) => { const next = await getGameApiClient().readNotification(id); setNotifications(next); return next }}
      onArchiveNotification={async (id) => { const next = await getGameApiClient().archiveNotification(id); setNotifications(next); return next }}
      onReadAllNotifications={async () => { const next = await getGameApiClient().readAllNotifications(); setNotifications(next); return next }}
      onArchiveReadNotifications={async () => { const next = await getGameApiClient().archiveReadNotifications(); setNotifications(next); return next }}
      onLoadDailyCombat={loadDailyCombat}
      onSetDailyCombatSlot={async (position, characterId) => { const next = await getGameApiClient().setDailyCombatSlot(position, characterId); setDailyCombat(next); return next }}
      onRemoveDailyCombatSlot={async (position) => { const next = await getGameApiClient().removeDailyCombatSlot(position); setDailyCombat(next); return next }}
      onCopyActiveTeamToDailyCombat={async () => { const next = await getGameApiClient().copyActiveTeamToDailyCombat(); setDailyCombat(next); return next }}
      onAutoSelectDailyCombat={async () => { const next = await getGameApiClient().autoSelectDailyCombat(); setDailyCombat(next); return next }}
      onClearDailyCombatLoadout={async () => { const next = await getGameApiClient().clearDailyCombatLoadout(); setDailyCombat(next); return next }}
      onFightDailyCombat={async (idempotencyKey) => { const result = await getGameApiClient().fightDailyCombat(idempotencyKey); setDailyCombat(result.view); setResources(result.resources); return result }}
      onSetMonthlyBossSlot={async (position, characterId) => { const next = await getGameApiClient().setMonthlyBossSlot(position, characterId); setMonthlyBoss(next); return next }}
      onRemoveMonthlyBossSlot={async (position) => { const next = await getGameApiClient().removeMonthlyBossSlot(position); setMonthlyBoss(next); return next }}
      onCopyActiveTeamToMonthlyBoss={async () => { const next = await getGameApiClient().copyActiveTeamToMonthlyBoss(); setMonthlyBoss(next); return next }}
      onClearMonthlyBossLoadout={async () => { const next = await getGameApiClient().clearMonthlyBossLoadout(); setMonthlyBoss(next); return next }}
      onAttackMonthlyBoss={async (bossId, idempotencyKey) => { const result = await getGameApiClient().attackMonthlyBoss(bossId, idempotencyKey); setMonthlyBoss(result.view); setResources(result.resources); await loadNotifications(); return result }}
      onLoadMonthlyBossHistory={(page) => getGameApiClient().getMonthlyBossHistory(page)}
      onPurchaseDailyChallenge={async (idempotencyKey) => {
        const result = await getGameApiClient().purchaseDailyChallenge(idempotencyKey)
        setDailyChallenge(result)
        setResources(result.resources)
        return result
      }}
      onSwitchDailyChallenge={async (idempotencyKey) => {
        const result = await getGameApiClient().switchDailyChallenge(idempotencyKey)
        setDailyChallenge(result)
        setResources(result.resources)
        return result
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
      onModerationTester={moderateTester}
      onModerationApplied={handleModerationApplied}
      levelUpFeedbacks={levelUpFeedbacks}
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
      onGetGachaHistory={(page) => getGameApiClient().getGachaHistory(page)}
      onLoadBox={loadBox}
      onSetBoxFavorite={setBoxFavorite}
      onSetBoxSortPreference={setBoxSortPreference}
      onUseStella={useStella}
      onLoadBank={loadBank}
      onLoadInventory={() => getGameApiClient().getInventory()}
      onLoadInventoryItemDetail={(itemId, page) => getGameApiClient().getInventoryItemDetail(itemId, page)}
      onConvertParticles={async (amount, idempotencyKey): Promise<DailyChallengeMutationDto> => {
        const result = await getGameApiClient().convertPersonalParticles(amount, idempotencyKey)
        setResources(result.resources)
        setDailyChallenge(result)
        return result
      }}
      onLoadBankHistory={(page) => getGameApiClient().getBankHistory(page)}
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
      onSaveNavigationPreferences={saveNavigationPreferences}
      onClaimDailyReward={async () => {
        const { result, resources: nextResources } = await claimDailyRewardAndRefresh(getGameApiClient())
        setResources(nextResources)
        setDailyRewardToday({ claimed: true, businessDate: result.businessDate, rewards: result.rewards })
        return result
      }}
      onSpinWheel={async () => {
        const result = await getGameApiClient().spinWheel()
        setWheelToday(wheelTodayFromSpin(result))
        await loadResources()
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
        await abandonGachaPresentationBeforeSignOut(gachaPresentation.current!, signOut)
      }}
    />
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
