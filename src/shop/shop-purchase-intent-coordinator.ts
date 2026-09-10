import { ApiError } from '../api/game-api'
import { isAmbiguousMutationError } from '../api/mutation-errors'

type Intent = Readonly<{ playerId: string; itemId: string; quantity: string; idempotencyKey: string }>

export class ShopPurchaseIntentCoordinator {
  private readonly intents = new Map<string, Intent>()
  private readonly active = new Set<string>()
  private readonly createKey: () => string
  public constructor(createKey: () => string = () => crypto.randomUUID()) { this.createKey = createKey }

  public getIntent(playerId: string): Intent | null { return this.intents.get(playerId) ?? null }

  public async execute<Result>(playerId: string, itemId: string, quantity: string, request: (idempotencyKey: string) => Promise<Result>): Promise<Result> {
    if (this.active.has(playerId)) throw new ApiError('SHOP_PURCHASE_IN_PROGRESS', 'Un achat Boutique est déjà en cours.', null)
    const previous = this.intents.get(playerId)
    if (previous && (previous.itemId !== itemId || previous.quantity !== quantity)) {
      throw new ApiError('SHOP_PURCHASE_INTENT_CONFLICT', 'Un achat précédent doit d’abord être vérifié ou réessayé avec le même article et la même quantité.', null)
    }
    const intent = previous ?? { playerId, itemId, quantity, idempotencyKey: this.createKey() }
    this.intents.set(playerId, intent)
    this.active.add(playerId)
    try {
      const result = await request(intent.idempotencyKey)
      if (this.intents.get(playerId) === intent) this.intents.delete(playerId)
      return result
    } catch (error) {
      if (!isAmbiguousMutationError(error) && this.intents.get(playerId) === intent) this.intents.delete(playerId)
      throw error
    } finally { this.active.delete(playerId) }
  }

  public clear(): void { this.intents.clear(); this.active.clear() }
}
