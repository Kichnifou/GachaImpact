import { ApiError } from '../api/game-api'
import { isAmbiguousMutationError } from '../api/mutation-errors'

export type StellaIntent = Readonly<{
  characterId: string
  key: string
}>

export class StellaIntentCoordinator {
  private readonly intents = new Map<string, StellaIntent>()
  private readonly activeRequests = new Map<string, StellaIntent>()
  private readonly createKey: () => string

  public constructor(createKey: () => string = () => crypto.randomUUID()) {
    this.createKey = createKey
  }

  public getIntent(playerId: string): StellaIntent | null {
    return this.intents.get(playerId) ?? null
  }

  public async execute<Result>(
    playerId: string,
    characterId: string,
    request: (idempotencyKey: string) => Promise<Result>,
  ): Promise<Result> {
    if (this.activeRequests.has(playerId)) {
      throw new ApiError('STELLA_IN_PROGRESS', 'Une utilisation de Stella est déjà en cours.', null)
    }

    const previous = this.intents.get(playerId)
    if (previous && previous.characterId !== characterId) {
      throw new ApiError(
        'STELLA_INTENT_CONFLICT',
        'Une utilisation de Stella précédente doit d’abord être vérifiée sur le personnage concerné.',
        null,
      )
    }

    const intent = previous ?? { characterId, key: this.createKey() }
    this.intents.set(playerId, intent)
    this.activeRequests.set(playerId, intent)

    try {
      const result = await request(intent.key)
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
