import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { DailyChallengeStore } from './daily-challenge-store.js';

abstract class DailyChallengePlayerService {
  protected constructor(protected readonly getPlayer: GetCurrentPlayer, protected readonly store: DailyChallengeStore, protected readonly clock: Clock) {}
  protected async context(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    if (!player.elementKey || !isElementKey(player.elementKey)) throw new BusinessError('PLAYER_ELEMENT_REQUIRED', 'Un élément permanent est requis.');
    const now = this.clock.now();
    return { player, playerElementKey: player.elementKey, now, businessDate: getBusinessDate(now) } as const;
  }
}

export class GetDailyChallenge extends DailyChallengePlayerService {
  public constructor(getPlayer: GetCurrentPlayer, store: DailyChallengeStore, clock: Clock) { super(getPlayer, store, clock); }
  public async execute(identity: AuthenticatedIdentity) {
    const { player, businessDate } = await this.context(identity);
    return this.store.getView(player.id, businessDate);
  }
}

export class PurchaseDailyChallenge extends DailyChallengePlayerService {
  public constructor(getPlayer: GetCurrentPlayer, store: DailyChallengeStore, clock: Clock, private readonly random: RandomSource) { super(getPlayer, store, clock); }
  public async execute(identity: AuthenticatedIdentity, idempotencyKey: string) {
    const { player, playerElementKey, now, businessDate } = await this.context(identity);
    return this.store.purchase({ playerId: player.id, playerElementKey, now, businessDate, idempotencyKey, random: this.random });
  }
}

export class SwitchDailyChallenge extends DailyChallengePlayerService {
  public constructor(getPlayer: GetCurrentPlayer, store: DailyChallengeStore, clock: Clock, private readonly random: RandomSource) { super(getPlayer, store, clock); }
  public async execute(identity: AuthenticatedIdentity, idempotencyKey: string) {
    const { player, playerElementKey, now, businessDate } = await this.context(identity);
    return this.store.switchChallenge({ playerId: player.id, playerElementKey, now, businessDate, idempotencyKey, random: this.random });
  }
}

export class ConvertPersonalParticles extends DailyChallengePlayerService {
  public constructor(getPlayer: GetCurrentPlayer, store: DailyChallengeStore, clock: Clock) { super(getPlayer, store, clock); }
  public async execute(identity: AuthenticatedIdentity, amount: bigint, idempotencyKey: string) {
    if (amount < 1n) throw new BusinessError('PARTICLE_CONVERSION_AMOUNT_INVALID', 'La quantité doit être un entier supérieur ou égal à 1.');
    const { player, playerElementKey, now, businessDate } = await this.context(identity);
    return this.store.convertParticles({ playerId: player.id, playerElementKey, now, businessDate, amount, idempotencyKey });
  }
}
