import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { FavorService } from './favor-service.js';

type FavorProjection = Awaited<ReturnType<FavorService['getCurrent']>>;
function project(favor: FavorProjection): FavorProjection {
  return { businessDate: favor.businessDate, active: favor.active, daysRemaining: favor.daysRemaining,
    maxDays: favor.maxDays, dailyPrimogems: favor.dailyPrimogems, claimedToday: favor.claimedToday, claimStatus: favor.claimStatus };
}

/** Personal standalone boundary: identity owns the Player; the core owns date and economy. */
export class CurrentPlayerFavorService {
  constructor(private readonly getCurrentPlayer: GetCurrentPlayer, private readonly favor: FavorService) {}

  async get(identity: AuthenticatedIdentity) {
    const player = await this.getCurrentPlayer.execute(identity);
    return project(await this.favor.getCurrent(player.id));
  }

  async presence(identity: AuthenticatedIdentity) {
    const player = await this.getCurrentPlayer.execute(identity);
    const result = await this.favor.claimToday(player.id, 'UI');
    return { status: result.status, businessDate: result.businessDate, creditedPrimogems: result.creditedPrimogems,
      favor: project(await this.favor.getCurrent(player.id)) };
  }
}
