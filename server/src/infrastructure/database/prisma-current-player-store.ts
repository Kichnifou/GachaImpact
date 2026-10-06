import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type {
  CurrentPlayerResult,
  CurrentPlayerStore,
  ProvisionCurrentPlayerInput,
} from '../../application/player/current-player-store.js';
import { PermanentMissionService } from '../../application/missions/permanent-mission-service.js';
import { isPrismaConcurrencyCollision } from './prisma-concurrency.js';
import { bootstrapPlayer, currentPlayerSelection } from './player-bootstrap.js';

const MAX_PROVISION_ATTEMPTS = 2;

export class PrismaCurrentPlayerStore implements CurrentPlayerStore {
  public constructor(private readonly database: PrismaClient, private readonly permanentMissions = new PermanentMissionService()) {}

  public async findByIdentity(provider: string, providerSubject: string) {
    const identity = await this.database.webIdentity.findUnique({
      where: {
        provider_providerSubject: { provider, providerSubject },
      },
      select: {
        player: { select: currentPlayerSelection },
      },
    });

    return identity?.player ?? null;
  }

  public async provision(input: ProvisionCurrentPlayerInput): Promise<CurrentPlayerResult> {
    for (let attempt = 1; attempt <= MAX_PROVISION_ATTEMPTS; attempt += 1) {
      try {
        return await this.provisionInTransaction(input);
      } catch (error) {
        if (!isPrismaConcurrencyCollision(error)) {
          throw error;
        }

        const existingPlayer = await this.findByIdentity(input.provider, input.providerSubject);

        if (existingPlayer) {
          return { player: existingPlayer, created: false };
        }

        if (attempt === MAX_PROVISION_ATTEMPTS) {
          throw error;
        }
      }
    }

    throw new Error('Player provisioning exhausted all retry attempts.');
  }

  private async provisionInTransaction(
    input: ProvisionCurrentPlayerInput,
  ): Promise<CurrentPlayerResult> {
    return this.database.$transaction(
      async (transaction) => {
        const existingIdentity = await transaction.webIdentity.findUnique({
          where: {
            provider_providerSubject: {
              provider: input.provider,
              providerSubject: input.providerSubject,
            },
          },
          select: {
            player: { select: currentPlayerSelection },
          },
        });

        if (existingIdentity) {
          return { player: existingIdentity.player, created: false };
        }

        const player = await bootstrapPlayer(transaction, { displayName: input.displayName,
          webIdentity: { provider: input.provider, providerSubject: input.providerSubject } }, new Date(), this.permanentMissions);

        return { player, created: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

}
