import { useCallback, useEffect, useState } from 'react'

import { ApiError, getGameApiClient } from './api/game-api'
import type { DailyRewardTodayDto, ElementKey, PlayerDto, PlayerProgressionDto, PlayerResourcesDto, WheelTodayDto } from './api/types'
import { useAuth } from './auth/auth-context'
import { resolveBootstrapStage } from './auth/bootstrap-state'
import AuthScreen from './components/AuthScreen'
import ElementChoiceScreen from './components/ElementChoiceScreen'
import GameShell from './components/GameShell'
import OnboardingScreen from './components/OnboardingScreen'
import { apiErrorMessage } from './utils/formatters'
import { wheelTodayFromSpin } from './wheel/wheel-presentation'
import { claimDailyRewardAndRefresh } from './daily-reward/claim-daily-reward'

function AppBootstrap() {
  const { status: authStatus, session, configurationMessage, signOut } = useAuth()
  const sessionUserId = session?.user.id
  const [player, setPlayer] = useState<PlayerDto | null>(null)
  const [resources, setResources] = useState<PlayerResourcesDto | null>(null)
  const [progression, setProgression] = useState<PlayerProgressionDto | null>(null)
  const [wheelToday, setWheelToday] = useState<WheelTodayDto | null>(null)
  const [dailyRewardToday, setDailyRewardToday] = useState<DailyRewardTodayDto | null>(null)
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null)
  const [fatalError, setFatalError] = useState<{ userId: string; message: string } | null>(null)

  const loadResources = useCallback(async () => {
    const nextResources = await getGameApiClient().getResources()
    setResources(nextResources)
    return nextResources
  }, [])

  const loadGameState = useCallback(async () => {
    const api = getGameApiClient()
    const [nextResources, nextProgression, nextWheelToday, nextDailyRewardToday] = await Promise.all([
      api.getResources(),
      api.getProgression(),
      api.getWheelToday(),
      api.getDailyRewardToday(),
    ])
    setResources(nextResources)
    setProgression(nextProgression)
    setWheelToday(nextWheelToday)
    setDailyRewardToday(nextDailyRewardToday)
  }, [])

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
          setWheelToday(null)
          setDailyRewardToday(null)
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
    resources !== null && progression !== null && wheelToday !== null && dailyRewardToday !== null,
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

  if (!player || !resources || !progression || !wheelToday || !dailyRewardToday) {
    return <StatusScreen title="Chargement du profil…" message="Synchronisation de vos ressources." loading />
  }

  return (
    <GameShell
      player={player}
      resources={resources}
      progression={progression}
      wheelToday={wheelToday}
      dailyRewardToday={dailyRewardToday}
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
      onSignOut={signOut}
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
