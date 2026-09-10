import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { ApiError, getGameApiClient } from './api/game-api'
import type { BankTransferDto, CurrentGachaDto, DailyRewardTodayDto, ElementKey, GachaCharacterDto, GachaPullDto, ModerationPermissionsDto, ModerationStateDto, PlayerDto, PlayerProgressionDto, PlayerResourcesDto, PlayerTeamsDto, WheelTodayDto } from './api/types'
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
import { buildLevelUpFeedback, gachaLevelRewards, type LevelUpFeedbackEvent } from './progression/level-up-feedback'

function AppBootstrap() {
  const { status: authStatus, session, configurationMessage, signOut } = useAuth()
  const sessionUserId = session?.user.id
  const [player, setPlayer] = useState<PlayerDto | null>(null)
  const [resources, setResources] = useState<PlayerResourcesDto | null>(null)
  const [progression, setProgression] = useState<PlayerProgressionDto | null>(null)
  const [wheelToday, setWheelToday] = useState<WheelTodayDto | null>(null)
  const [dailyRewardToday, setDailyRewardToday] = useState<DailyRewardTodayDto | null>(null)
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
  const dismissLevelUpFeedback = useCallback((id: string) => {
    setLevelUpFeedbacks((current) => current.filter((event) => event.id !== id))
  }, [])

  const loadResources = useCallback(async () => {
    const nextResources = await getGameApiClient().getResources()
    setResources(nextResources)
    return nextResources
  }, [])

  const loadBox = useCallback(() => getGameApiClient().getBox(), [])
  const setBoxFavorite = useCallback(async (characterId: string, favorite: boolean) =>
    (await getGameApiClient().setBoxFavorite(characterId, favorite)).character, [])
  const setBoxSortPreference = useCallback(async (preference: Parameters<ReturnType<typeof getGameApiClient>['setBoxSortPreference']>[0]) =>
    (await getGameApiClient().setBoxSortPreference(preference)).preference, [])
  const useStella = useCallback((characterId: string, idempotencyKey: string) =>
    getGameApiClient().useStella(characterId, idempotencyKey), [])
  const loadTeams = useCallback(async () => {
    const nextTeams = await getGameApiClient().getTeams()
    setTeams(nextTeams)
    return nextTeams
  }, [])
  const publishBankTransfer = useCallback((result: BankTransferDto) => {
    setResources((current) => current ? applyBankWalletToResources(current, result) : current)
    return result
  }, [])
  const loadBank = useCallback(() => getGameApiClient().getBank(), [])
  const depositBank = useCallback(async (amount: string, idempotencyKey: string) =>
    publishBankTransfer(await getGameApiClient().depositBank(amount, idempotencyKey)), [publishBankTransfer])
  const withdrawBank = useCallback(async (amount: string, idempotencyKey: string) =>
    publishBankTransfer(await getGameApiClient().withdrawBank(amount, idempotencyKey)), [publishBankTransfer])

  const loadGameState = useCallback(async () => {
    const api = getGameApiClient()
    const [nextResources, nextProgression, nextWheelToday, nextDailyRewardToday, nextGacha, nextCatalog, nextTeams, nextPermissions] = await Promise.all([
      api.getResources(),
      api.getProgression(),
      api.getWheelToday(),
      api.getDailyRewardToday(),
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
    setGacha(nextGacha)
    setCharacters(nextCatalog.characters)
    setTeams(nextTeams)
    setPermissions(nextPermissions)
  }, [])

  const applyModerationState = useCallback((next: ModerationStateDto) => {
    setPermissions(next.permissions)
    setResources(next.resources)
    progressionRef.current = next.progression
    setProgression(next.progression)
    setGacha((current) => current ? { ...current, playerState: next.gachaState } : current)
  }, [])

  const publishGachaUpdate = useCallback((refreshed: Awaited<ReturnType<typeof performGachaPullAndRefresh>>) => {
    if (refreshed.resources) setResources(refreshed.resources)
    if (refreshed.progression) {
      const feedback = buildLevelUpFeedback(
        progressionRef.current,
        refreshed.progression,
        gachaLevelRewards(refreshed.result),
        `${refreshed.result.operation.id}:${refreshed.progression.level}`,
      )
      progressionRef.current = refreshed.progression
      setProgression(refreshed.progression)
      if (feedback) setLevelUpFeedbacks((current) => [...current, feedback])
    }
    setGacha((current) => refreshed.gacha ?? (current ? { ...current, playerState: refreshed.result.playerState } : current))
  }, [])

  const gachaPresentation = useRef<GachaPresentationCoordinator | null>(null)

  useLayoutEffect(() => {
    if (gachaPresentation.current === null) gachaPresentation.current = createGachaPresentationCoordinator({
      execute: (count, idempotencyKey, onPullSucceeded) => performGachaPullAndRefresh(getGameApiClient(), count, idempotencyKey, onPullSucceeded),
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
  }, [publishGachaUpdate, sessionUserId])

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
    resources !== null && progression !== null && wheelToday !== null && dailyRewardToday !== null && gacha !== null && characters !== null && teams !== null && permissions !== null,
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

  if (!player || !resources || !visibleResources || !progression || !wheelToday || !dailyRewardToday || !gacha || !characters || !teams || !permissions) {
    return <StatusScreen title="Chargement du profil…" message="Synchronisation de vos ressources." loading />
  }

  return (
    <GameShell
      player={player}
      resources={visibleResources}
      progression={progression}
      wheelToday={wheelToday}
      dailyRewardToday={dailyRewardToday}
      gacha={gacha}
      characters={characters}
      teams={teams}
      permissions={permissions}
      onLoadModeration={() => getGameApiClient().getModerationState()}
      onModerationResource={(input) => getGameApiClient().adjustModerationResource(input)}
      onModerationXp={(input) => getGameApiClient().setModerationXp(input)}
      onModerationGacha={(input) => getGameApiClient().setModerationGacha(input)}
      onModerationStella={(quantity, idempotencyKey) => getGameApiClient().setModerationStella(quantity, idempotencyKey)}
      onModerationApplied={applyModerationState}
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
      onLoadBankHistory={(page) => getGameApiClient().getBankHistory(page)}
      onDepositBank={depositBank}
      onWithdrawBank={withdrawBank}
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
        setPendingGachaPull(null)
        setGachaPrimogemPreview(null)
        setTeams(null)
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
