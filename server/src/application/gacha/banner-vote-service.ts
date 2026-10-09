import { commandNow } from '../player/player-command-execution.js';
import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
import { Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { bannerVoteContributions, reconcileExternalBannerVotes } from './banner-vote-contributions.js';

export class BannerVoteService {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly database: PrismaClient, private readonly clock: Clock) {}

  public async getCurrent(identity: PlayerExecutionActor) {
    const player = await this.getPlayer.execute(identity);
    return this.database.$transaction(tx => this.snapshot(tx, player.id), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  public async vote(identity: PlayerExecutionActor, characterId: string, bannerRotationId: string, sourceChannel: SourceChannel = SourceChannel.UI) {
    const player = await this.getPlayer.execute(identity);
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await this.database.$transaction(async tx => {
          // Same lock/order as PrismaGachaStore.ensureRotation: votes freeze before selection.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(70422401)`;
          const currentPlayer = await tx.player.findUnique({ where: { id: player.id } });
          if (currentPlayer?.status !== 'ACTIVE') throw new BusinessError('PLAYER_NOT_FOUND', 'Compte indisponible.');
          const identity = await tx.twitchIdentity.findUnique({ where: { playerId: player.id } });
          if (identity) await reconcileExternalBannerVotes(tx, identity.twitchUserId);
          const contribution = (await bannerVoteContributions(tx, bannerRotationId)).own(player.id);
          if (contribution) {
            if (contribution.characterId !== characterId) throw new BusinessError('BANNER_VOTE_USED', 'Votre vote est déjà utilisé pour cette semaine.');
            return { ...await this.snapshot(tx, player.id, bannerRotationId), alreadyProcessed: true };
          }
          const banner = await tx.bannerRotation.findFirst({ where: { status: 'ACTIVE' } });
          if (!banner || banner.id !== bannerRotationId) throw new BusinessError('BANNER_VOTE_CLOSED', 'Ce cycle de vote est terminé.');
          if (banner.generationVoteSnapshot && typeof banner.generationVoteSnapshot === 'object' && !Array.isArray(banner.generationVoteSnapshot)
            && Object.hasOwn(banner.generationVoteSnapshot, 'closedVoteSnapshot')) throw new BusinessError('BANNER_VOTE_CLOSED', 'Ce cycle de vote est terminé.');
          const now = commandNow(this.clock);
          if (now < banner.startsAt || now >= banner.endsAt) throw new BusinessError('BANNER_VOTE_CLOSED', 'Ce cycle de vote est terminé.');
          const character = await tx.character.findFirst({ where: { id: characterId, isActive: true, rarity: 5, bannerAppearances: { none: { bannerRotationId: banner.id } } }, select: { id: true } });
          if (!character) throw new BusinessError('BANNER_VOTE_INELIGIBLE', 'Ce personnage ne peut pas recevoir de vote pour cette rotation.');
          await tx.bannerVote.create({ data: { bannerRotationId: banner.id, playerId: player.id, characterId, sourceChannel, votedAt: now } });
          return { ...await this.snapshot(tx, player.id, bannerRotationId), alreadyProcessed: false };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        // A newly committed replacement can be invisible to the snapshot taken
        // while waiting for the cycle lock. Retry with a fresh MVCC snapshot.
        const staleCycle = error instanceof BusinessError && error.code === 'BANNER_VOTE_CLOSED';
        if (attempt === 3 || !staleCycle && !isPrismaConcurrencyCollision(error)) throw error;
      }
    }
    throw new Error('Vote retry exhausted.');
  }

  private async snapshot(tx: Prisma.TransactionClient, playerId: string, rotationId?: string) {
    const banner = await tx.bannerRotation.findFirst({ where: rotationId ? { id: rotationId } : { status: 'ACTIVE' } });
    if (!banner) throw new BusinessError('GACHA_BANNER_UNAVAILABLE', 'Aucune bannière active.');
    const candidates = await tx.character.findMany({ where: { isActive: true, rarity: 5, bannerAppearances: { none: { bannerRotationId: banner.id } } }, select: { id: true }, orderBy: { id: 'asc' } });
    const tally = await bannerVoteContributions(tx, banner.id);
    const own = tally.own(playerId);
    const catalog = await tx.character.aggregate({ where: { isActive: true }, _count: true, _max: { updatedAt: true } });
    const weights = tally.counts;
    const now = commandNow(this.clock);
    const closed = banner.generationVoteSnapshot && typeof banner.generationVoteSnapshot === 'object' && !Array.isArray(banner.generationVoteSnapshot)
      && Object.hasOwn(banner.generationVoteSnapshot, 'closedVoteSnapshot');
    return { bannerRotationId: banner.id, startsAt: banner.startsAt.toISOString(), endsAt: banner.endsAt.toISOString(), canVote: !own && !closed && now >= banner.startsAt && now < banner.endsAt, ownVote: own ? { characterId: own.characterId, votedAt: own.votedAt?.toISOString() ?? null } : null, candidates: candidates.map(c => ({ characterId: c.id, voteCount: weights.get(c.id) ?? 0 })), catalogVersion: `${catalog._count}:${catalog._max.updatedAt?.toISOString() ?? ''}` };
  }
}
