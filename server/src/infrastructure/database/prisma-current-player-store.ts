import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type {
  CurrentPlayerResult,
  CurrentPlayerStore,
  ProvisionCurrentPlayerInput,
} from '../../application/player/current-player-store.js';
import { isPrismaConcurrencyCollision } from './prisma-concurrency.js';

const currentPlayerSelection = {
  id: true,
  displayName: true,
  elementKey: true,
  status: true,
} satisfies Prisma.PlayerSelect;

const EXPECTED_INITIAL_RESOURCE_COUNT = 9;
const MAX_PROVISION_ATTEMPTS = 2;

export class PrismaCurrentPlayerStore implements CurrentPlayerStore {
  public constructor(private readonly database: PrismaClient) {}

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

        const resources = await transaction.resourceDefinition.findMany({
          where: { isActive: true },
          select: { key: true },
          orderBy: { key: 'asc' },
        });

        if (resources.length !== EXPECTED_INITIAL_RESOURCE_COUNT) {
          throw new Error(
            `Player provisioning requires exactly ${EXPECTED_INITIAL_RESOURCE_COUNT} active resource definitions.`,
          );
        }

        const player = await transaction.player.create({
          data: {
            displayName: input.displayName,
            webIdentity: {
              create: {
                provider: input.provider,
                providerSubject: input.providerSubject,
              },
            },
            economyStats: { create: {} },
            wheelStats: { create: {} },
            dailyRewardState: { create: {} },
            resourceBalances: {
              create: resources.map(({ key }) => ({
                resourceKey: key,
                amount: 0n,
              })),
            },
          },
          select: currentPlayerSelection,
        });

        return { player, created: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

}
