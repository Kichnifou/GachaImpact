import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { Clock } from '../../domain/time/business-date.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { PermanentMissionProjection, PermanentMissionService } from './permanent-mission-service.js';

export type CurrentPlayerMissions = PermanentMissionProjection & Readonly<{ catchUpApplied: boolean }>;

type MissionReader = Pick<PermanentMissionService, 'catchUpStandalone' | 'project'>;

/** Personal Missions query. Its transaction owns the exactly-once R301 catch-up and confirmed projection. */
export class GetCurrentPlayerMissions {
  public constructor(
    private readonly getCurrentPlayer: GetCurrentPlayer,
    private readonly database: PrismaClient,
    private readonly clock: Clock,
    private readonly missions: MissionReader,
  ) {}

  public async execute(identity: AuthenticatedIdentity): Promise<CurrentPlayerMissions> {
    const player = await this.getCurrentPlayer.execute(identity);
    const now = this.clock.now();
    return this.database.$transaction(async transaction => {
      const catchUp = await this.missions.catchUpStandalone(transaction, { playerId: player.id, now });
      const projection = await this.missions.project(transaction, player.id);
      return { catchUpApplied: !catchUp.alreadyProcessed, ...projection };
    }, { timeout: 15_000 });
  }
}
