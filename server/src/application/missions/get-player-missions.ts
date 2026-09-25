import type { PrismaClient } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { PrivacyService } from '../social/privacy-service.js';
import type { PermanentMissionProjection, PermanentMissionService } from './permanent-mission-service.js';

export type PlayerMissionsAccess =
  | Readonly<{ access: 'PRIVATE' }>
  | Readonly<{ access: 'ALLOWED'; data: PermanentMissionProjection }>;

/** Privacy-aware profile read. It projects persisted state and never reconciles or catches up the target. */
export class GetPlayerMissions {
  public constructor(
    private readonly getCurrentPlayer: GetCurrentPlayer,
    private readonly database: PrismaClient,
    private readonly missions: Pick<PermanentMissionService, 'project'>,
    private readonly privacy = new PrivacyService(database),
  ) {}

  public async execute(identity: AuthenticatedIdentity, targetPlayerId: string): Promise<PlayerMissionsAccess> {
    const viewer = await this.getCurrentPlayer.execute(identity);
    const target = await this.database.player.findFirst({
      where: { id: targetPlayerId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!target) throw new AppError('Joueur introuvable.', 404, 'PLAYER_NOT_FOUND');
    if (!(await this.privacy.permissions(target.id, viewer.id)).MISSIONS) return { access: 'PRIVATE' };
    const data = await this.database.$transaction(transaction => this.missions.project(transaction, target.id));
    return { access: 'ALLOWED', data };
  }
}
