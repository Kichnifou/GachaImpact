import { ApiError } from '../api/game-api'
import { isAmbiguousMutationError } from '../api/mutation-errors'

export type ModerationResourceInput = Readonly<{
  resourceKey: string
  amount: string
  direction: 'add' | 'remove'
}>

export type ModerationXpInput = Readonly<{
  totalXp?: string
  prepareNextLevel?: true
}>

export type ModerationGachaInput = Readonly<{
  pity5?: number
  pity4?: number
  guaranteedFeatured5?: boolean
  captureProgress?: number
}>

export type ModerationAction =
  | Readonly<{ type: 'resource'; payload: ModerationResourceInput }>
  | Readonly<{ type: 'xp'; payload: ModerationXpInput }>
  | Readonly<{ type: 'gacha'; payload: ModerationGachaInput }>
  | Readonly<{ type: 'stella'; payload: Readonly<{ quantity: string }> }>

export type ModerationIntent = Readonly<{
  actionFingerprint: string
  idempotencyKey: string
}>

const intentConflictMessage = 'Une opération de test précédente a un résultat incertain. Réessayez la même action pour vérifier son résultat avant d’en lancer une autre.'

function optionalNumber(value: number | undefined): string {
  return value === undefined ? 'absent' : `number:${value}`
}

function optionalBoolean(value: boolean | undefined): string {
  return value === undefined ? 'absent' : `boolean:${value}`
}

export function moderationActionFingerprint(targetPlayerId: string, action: ModerationAction): string {
  switch (action.type) {
    case 'resource':
      return [targetPlayerId, 'resource', action.payload.resourceKey, action.payload.direction, action.payload.amount].join('\u001f')
    case 'xp':
      return action.payload.prepareNextLevel
        ? `${targetPlayerId}\u001fxp\u001fprepare-next-level`
        : `${targetPlayerId}\u001fxp\u001ftotal:${action.payload.totalXp ?? 'absent'}`
    case 'gacha':
      return [
        targetPlayerId, 'gacha',
        optionalNumber(action.payload.pity5),
        optionalNumber(action.payload.pity4),
        optionalBoolean(action.payload.guaranteedFeatured5),
        optionalNumber(action.payload.captureProgress),
      ].join('\u001f')
    case 'stella':
      return `${targetPlayerId}\u001fstella\u001fquantity:${action.payload.quantity}`
  }
}

export class ModerationIntentCoordinator {
  private readonly intents = new Map<string, ModerationIntent>()
  private readonly activeRequests = new Map<string, ModerationIntent>()
  private readonly createKey: () => string

  public constructor(createKey: () => string = () => crypto.randomUUID()) {
    this.createKey = createKey
  }

  public getIntent(playerId: string): ModerationIntent | null {
    return this.intents.get(playerId) ?? null
  }

  public clear(): void {
    this.intents.clear()
    this.activeRequests.clear()
  }

  public async execute<Result>(
    playerId: string,
    action: ModerationAction,
    request: (idempotencyKey: string) => Promise<Result>,
  ): Promise<Result> {
    if (this.activeRequests.has(playerId)) {
      throw new ApiError('MODERATION_IN_PROGRESS', 'Une opération de test est déjà en cours.', null)
    }

    const actionFingerprint = moderationActionFingerprint(playerId, action)
    const pending = this.intents.entries().next().value as [string, ModerationIntent] | undefined
    const pendingTarget = pending?.[0]
    const pendingIntent = pending?.[1]
    if (pendingIntent && (pendingTarget !== playerId || pendingIntent.actionFingerprint !== actionFingerprint)) {
      throw new ApiError('MODERATION_INTENT_CONFLICT', intentConflictMessage, null)
    }

    const intent = pendingIntent ?? { actionFingerprint, idempotencyKey: this.createKey() }
    this.intents.set(playerId, intent)
    this.activeRequests.set(playerId, intent)

    try {
      const result = await request(intent.idempotencyKey)
      if (this.intents.get(playerId) === intent) this.intents.delete(playerId)
      return result
    } catch (error) {
      if (!isAmbiguousMutationError(error) && this.intents.get(playerId) === intent) {
        this.intents.delete(playerId)
      }
      throw error
    } finally {
      if (this.activeRequests.get(playerId) === intent) this.activeRequests.delete(playerId)
    }
  }
}
