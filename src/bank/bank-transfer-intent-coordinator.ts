import { ApiError } from '../api/game-api'
import { isAmbiguousMutationError } from '../api/mutation-errors'

export type BankTransferDirection = 'deposit' | 'withdraw'

export type BankTransferIntent = Readonly<{
  playerId: string
  direction: BankTransferDirection
  amountIntent: string
  idempotencyKey: string
}>

export class BankTransferIntentCoordinator {
  private readonly intents = new Map<string, BankTransferIntent>()
  private readonly activeRequests = new Map<string, BankTransferIntent>()
  private readonly createKey: () => string

  public constructor(createKey: () => string = () => crypto.randomUUID()) {
    this.createKey = createKey
  }

  public getIntent(playerId: string): BankTransferIntent | null {
    return this.intents.get(playerId) ?? null
  }

  public async execute<Result>(
    playerId: string,
    direction: BankTransferDirection,
    amountIntent: string,
    request: (idempotencyKey: string) => Promise<Result>,
  ): Promise<Result> {
    if (this.activeRequests.has(playerId)) {
      throw new ApiError('BANK_TRANSFER_IN_PROGRESS', 'Une opération Banque est déjà en cours.', null)
    }

    const previous = this.intents.get(playerId)
    if (previous && (previous.direction !== direction || previous.amountIntent !== amountIntent)) {
      throw new ApiError(
        'BANK_TRANSFER_INTENT_CONFLICT',
        'Une opération Banque précédente doit d’abord être vérifiée ou réessayée avec le même montant.',
        null,
      )
    }

    const intent = previous ?? {
      playerId,
      direction,
      amountIntent,
      idempotencyKey: this.createKey(),
    }
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
