import { ApiError } from '../api/game-api'
import type { GachaPullDto } from '../api/types'
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

type Dependencies = Readonly<{
  execute: (count: 1 | 10, idempotencyKey: string) => Promise<GachaPullRefreshResult>
  publish: (update: GachaPullRefreshResult) => void
  createIdempotencyKey: () => string
  onPendingCountChange?: (count: 1 | 10 | null) => void
}>

export type GachaPresentationCoordinator = Readonly<{
  requestPull: (count: 1 | 10) => Promise<GachaPullDto>
  disclose: (operationId: string) => boolean
  abandon: () => boolean
  getSnapshot: () => GachaPresentationSnapshot
}>

export function createGachaPresentationCoordinator(dependencies: Dependencies): GachaPresentationCoordinator {
  let presentation: GachaPresentationSnapshot = { phase: 'idle' }
  let retryIntent: GachaPullIntent | null = null
  let activeRequest: Promise<GachaPullDto> | null = null

  const publishReadyUpdate = (ready: ReadyPresentation) => {
    presentation = { phase: 'idle' }
    dependencies.publish(ready.update)
  }

  const requestPull = (count: 1 | 10): Promise<GachaPullDto> => {
    if (activeRequest || presentation.phase !== 'idle') {
      throw new ApiError('GACHA_PULL_IN_PROGRESS', 'Une Invocation est déjà en cours.', null)
    }

    const selection = selectGachaPullIntent(retryIntent, count, dependencies.createIdempotencyKey)
    if (selection.status === 'blocked') {
      throw new ApiError(
        'GACHA_PULL_INTENT_CONFLICT',
        `Une Invocation x${selection.intent.count} précédente doit d’abord être confirmée.`,
        null,
      )
    }

    const intent = selection.intent
    retryIntent = intent
    presentation = { phase: 'pending', intent, abandoned: false }
    dependencies.onPendingCountChange?.(count)

    const request = dependencies.execute(count, intent.key)
      .then((update) => {
        retryIntent = settleGachaPullIntent(intent, { status: 'success' })
        const current = presentation
        if (current.phase !== 'pending' || current.intent.key !== intent.key) return update.result

        if (current.abandoned) {
          presentation = { phase: 'idle' }
          dependencies.publish(update)
        } else {
          presentation = { phase: 'ready', intent, update }
        }
        return update.result
      })
      .catch((error: unknown) => {
        retryIntent = settleGachaPullIntent(intent, { status: 'failure', error })
        if (presentation.phase === 'pending' && presentation.intent.key === intent.key) {
          presentation = { phase: 'idle' }
        }
        throw error
      })
      .finally(() => {
        if (activeRequest === request) activeRequest = null
        dependencies.onPendingCountChange?.(null)
      })

    activeRequest = request
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
        presentation = { ...presentation, abandoned: true }
        return true
      }
      if (presentation.phase === 'ready') {
        publishReadyUpdate(presentation)
        return true
      }
      return false
    },
    getSnapshot: () => presentation,
  }
}
