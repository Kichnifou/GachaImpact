import { ApiError } from '../api/game-api'
import type { GachaPullDto, PlayerResourcesDto } from '../api/types'
import {
  selectGachaPullIntent,
  settleGachaPullIntent,
  type GachaPullIntent,
  type GachaPullRefreshResult,
} from './perform-gacha-pull'

type PendingPresentation = Readonly<{
  phase: 'pending'
  intent: GachaPullIntent
  abandoned: boolean
}>

type ReadyPresentation = Readonly<{
  phase: 'ready'
  intent: GachaPullIntent
  update: GachaPullRefreshResult
}>

export type GachaPresentationSnapshot =
  | Readonly<{ phase: 'idle' }>
  | PendingPresentation
  | ReadyPresentation

export type GachaPrimogemCostPreview = Readonly<{
  sessionId: string | null
  primogemsBefore: string
  primogemCost: string
  visiblePrimogems: string
}>

type PullSucceeded = (result: GachaPullDto) => void

type Dependencies = Readonly<{
  execute: (count: 1 | 10, idempotencyKey: string, onPullSucceeded: PullSucceeded) => Promise<GachaPullRefreshResult>
  publish: (update: GachaPullRefreshResult) => void
  createIdempotencyKey: () => string
  onPendingCountChange?: (count: 1 | 10 | null, sessionId: string | null) => void
  onPrimogemCostPreview?: (preview: GachaPrimogemCostPreview) => void
  onPrimogemCostPreviewCleared?: (sessionId: string | null) => void
}>

type ActiveNetworkPull = {
  sessionId: string | null
  intent: GachaPullIntent
  primogemsBefore: string
  confirmedPrimogemCost: string | null
  presentationAbandoned: boolean
}

export type GachaPresentationCoordinator = Readonly<{
  requestPull: (count: 1 | 10, primogemsBefore: string) => Promise<GachaPullDto>
  disclose: (operationId: string) => boolean
  abandon: () => boolean
  invalidate: () => boolean
  setSession: (sessionId: string | null) => boolean
  getSessionId: () => string | null
  getSnapshot: () => GachaPresentationSnapshot
}>

export function visiblePrimogemsAfterCost(primogemsBefore: string, primogemCost: string): string {
  return (BigInt(primogemsBefore) - BigInt(primogemCost)).toString()
}

export function applyGachaPrimogemCostPreview(
  resources: PlayerResourcesDto,
  preview: GachaPrimogemCostPreview | null,
  activeSessionId: string | undefined,
): PlayerResourcesDto {
  if (!preview || preview.sessionId !== activeSessionId) return resources
  return { ...resources, primogems: preview.visiblePrimogems }
}

export function createGachaPresentationCoordinator(dependencies: Dependencies): GachaPresentationCoordinator {
  let presentation: GachaPresentationSnapshot = { phase: 'idle' }
  let sessionId: string | null = null
  const activePulls = new Map<string | null, ActiveNetworkPull>()
  const retryIntents = new Map<string | null, GachaPullIntent>()

  const clearCostPreview = (ownerSessionId: string | null) => {
    dependencies.onPrimogemCostPreviewCleared?.(ownerSessionId)
  }

  const showConfirmedCost = (pull: ActiveNetworkPull) => {
    if (pull.confirmedPrimogemCost === null || sessionId !== pull.sessionId) return
    dependencies.onPrimogemCostPreview?.({
      sessionId: pull.sessionId,
      primogemsBefore: pull.primogemsBefore,
      primogemCost: pull.confirmedPrimogemCost,
      visiblePrimogems: visiblePrimogemsAfterCost(pull.primogemsBefore, pull.confirmedPrimogemCost),
    })
  }

  const publishReadyUpdate = (ready: ReadyPresentation) => {
    presentation = { phase: 'idle' }
    clearCostPreview(sessionId)
    dependencies.publish(ready.update)
  }

  const detachVisiblePresentation = () => {
    const previousSessionId = sessionId
    if (presentation.phase === 'pending') {
      const activePull = activePulls.get(previousSessionId)
      if (activePull?.intent.key === presentation.intent.key) activePull.presentationAbandoned = true
    }
    presentation = { phase: 'idle' }
    dependencies.onPendingCountChange?.(null, previousSessionId)
    clearCostPreview(previousSessionId)
  }

  const requestPull = (count: 1 | 10, primogemsBefore: string): Promise<GachaPullDto> => {
    if (activePulls.has(sessionId) || presentation.phase !== 'idle') {
      throw new ApiError('GACHA_PULL_IN_PROGRESS', 'Une Invocation est déjà en cours.', null)
    }

    const activeRetryIntent = retryIntents.get(sessionId) ?? null
    const selection = selectGachaPullIntent(activeRetryIntent, count, dependencies.createIdempotencyKey)
    if (selection.status === 'blocked') {
      throw new ApiError(
        'GACHA_PULL_INTENT_CONFLICT',
        `Une Invocation x${selection.intent.count} précédente doit d’abord être confirmée.`,
        null,
      )
    }

    const intent = selection.intent
    const ownerSessionId = sessionId
    const activePull: ActiveNetworkPull = {
      sessionId: ownerSessionId,
      intent,
      primogemsBefore,
      confirmedPrimogemCost: null,
      presentationAbandoned: false,
    }
    retryIntents.set(ownerSessionId, intent)
    activePulls.set(ownerSessionId, activePull)
    presentation = { phase: 'pending', intent, abandoned: false }
    dependencies.onPendingCountChange?.(count, ownerSessionId)

    const request = dependencies.execute(count, intent.key, (result) => {
      if (activePulls.get(ownerSessionId) !== activePull) return
      activePull.confirmedPrimogemCost = result.operation.primogemCost
      showConfirmedCost(activePull)
    })
      .then((update) => {
        if (activePulls.get(ownerSessionId) !== activePull) return update.result

        activePulls.delete(ownerSessionId)
        retryIntents.delete(ownerSessionId)
        if (sessionId !== ownerSessionId) return update.result

        const current = presentation
        if (current.phase !== 'pending' || current.intent.key !== intent.key) return update.result

        if (current.abandoned || activePull.presentationAbandoned) {
          presentation = { phase: 'idle' }
          clearCostPreview(ownerSessionId)
          dependencies.publish(update)
        } else {
          presentation = { phase: 'ready', intent, update }
        }
        return update.result
      })
      .catch((error: unknown) => {
        if (activePulls.get(ownerSessionId) !== activePull) throw error

        activePulls.delete(ownerSessionId)
        const retryIntent = settleGachaPullIntent(intent, { status: 'failure', error })
        if (retryIntent) retryIntents.set(ownerSessionId, retryIntent)
        else retryIntents.delete(ownerSessionId)

        if (sessionId === ownerSessionId && presentation.phase === 'pending' && presentation.intent.key === intent.key) {
          presentation = { phase: 'idle' }
          clearCostPreview(ownerSessionId)
        }
        throw error
      })
      .finally(() => {
        dependencies.onPendingCountChange?.(null, ownerSessionId)
      })

    return request
  }

  return {
    requestPull,
    disclose(operationId) {
      if (presentation.phase !== 'ready' || presentation.update.result.operation.id !== operationId) return false
      publishReadyUpdate(presentation)
      return true
    },
    abandon() {
      if (presentation.phase === 'pending') {
        const activePull = activePulls.get(sessionId)
        if (activePull?.intent.key === presentation.intent.key) activePull.presentationAbandoned = true
        presentation = { ...presentation, abandoned: true }
        return true
      }
      if (presentation.phase === 'ready') {
        publishReadyUpdate(presentation)
        return true
      }
      return false
    },
    invalidate() {
      const hadState = presentation.phase !== 'idle' || activePulls.size > 0 || retryIntents.size > 0
      detachVisiblePresentation()
      activePulls.clear()
      retryIntents.clear()
      return hadState
    },
    setSession(nextSessionId) {
      if (sessionId === nextSessionId) return false

      detachVisiblePresentation()
      sessionId = nextSessionId
      const activePull = activePulls.get(nextSessionId)
      if (activePull) {
        activePull.presentationAbandoned = true
        presentation = { phase: 'pending', intent: activePull.intent, abandoned: true }
        dependencies.onPendingCountChange?.(activePull.intent.count, nextSessionId)
        showConfirmedCost(activePull)
      }
      return true
    },
    getSessionId: () => sessionId,
    getSnapshot: () => presentation,
  }
}

export async function abandonGachaPresentationBeforeSignOut(
  coordinator: GachaPresentationCoordinator,
  signOut: () => Promise<void>,
) {
  const previousSessionId = coordinator.getSessionId()
  coordinator.abandon()
  coordinator.setSession(null)
  try {
    await signOut()
  } catch (error) {
    coordinator.setSession(previousSessionId)
    throw error
  }
}
