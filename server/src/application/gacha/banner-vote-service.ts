import { Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { Clock } from '../../domain/time/business-date.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';

export class BannerVoteService {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly database: PrismaClient, private readonly clock: Clock) {}

  public async getCurrent(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    return this.database.$transaction(tx => this.snapshot(tx, player.id), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  public async vote(identity: AuthenticatedIdentity, characterId: string, bannerRotationId: string, sourceChannel: SourceChannel = SourceChannel.UI) {
    const player = await this.getPlayer.execute(identity);
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await this.database.$transaction(async tx => {
          // Same lock/order as PrismaGachaStore.ensureRotation: votes freeze before selection.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(70422401)`;
          const existing = await tx.bannerVote.findUnique({ where: { bannerRotationId_playerId: { bannerRotationId, playerId: player.id } } });
          if (existing) {
            if (existing.characterId !== characterId) throw new BusinessError('BANNER_VOTE_USED', 'Votre vote est déjà utilisé pour cette semaine.');
            return { ...await this.snapshot(tx, player.id), alreadyProcessed: true };
          }
          const banner = await tx.bannerRotation.findFirst({ where: { status: 'ACTIVE' } });
          if (!banner || banner.id !== bannerRotationId) throw new BusinessError('BANNER_VOTE_CLOSED', 'Ce cycle de vote est terminé.');
          const now = this.clock.now();
          if (now < banner.startsAt || now >= banner.endsAt) throw new BusinessError('BANNER_VOTE_CLOSED', 'Ce cycle de vote est terminé.');
          const character = await tx.character.findFirst({ where: { id: characterId, isActive: true, rarity: 5, bannerAppearances: { none: { bannerRotationId: banner.id } } }, select: { id: true } });
          if (!character) throw new BusinessError('BANNER_VOTE_INELIGIBLE', 'Ce personnage ne peut pas recevoir de vote pour cette rotation.');
          await tx.bannerVote.create({ data: { bannerRotationId: banner.id, playerId: player.id, characterId, sourceChannel, votedAt: now } });
          return { ...await this.snapshot(tx, player.id), alreadyProcessed: false };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) { if (attempt === 3 || !isPrismaConcurrencyCollision(error)) throw error; }
    }
    throw new Error('Vote retry exhausted.');
  }

  private async snapshot(tx: Prisma.TransactionClient, playerId: string) {
    const banner = await tx.bannerRotation.findFirst({ where: { status: 'ACTIVE' } });
    if (!banner) throw new BusinessError('GACHA_BANNER_UNAVAILABLE', 'Aucune bannière active.');
    const candidates = await tx.character.findMany({ where: { isActive: true, rarity: 5, bannerAppearances: { none: { bannerRotationId: banner.id } } }, select: { id: true }, orderBy: { id: 'asc' } });
    const counts = await tx.bannerVote.groupBy({ by: ['characterId'], where: { bannerRotationId: banner.id }, _count: { _all: true } });
    const own = await tx.bannerVote.findUnique({ where: { bannerRotationId_playerId: { bannerRotationId: banner.id, playerId } }, select: { characterId: true, votedAt: true } });
    const catalog = await tx.character.aggregate({ where: { isActive: true }, _count: true, _max: { updatedAt: true } });
    const weights = new Map(counts.map(row => [row.characterId, row._count._all]));
    const now = this.clock.now();
    return { bannerRotationId: banner.id, startsAt: banner.startsAt.toISOString(), endsAt: banner.endsAt.toISOString(), canVote: !own && now >= banner.startsAt && now < banner.endsAt, ownVote: own ? { characterId: own.characterId, votedAt: own.votedAt.toISOString() } : null, candidates: candidates.map(c => ({ characterId: c.id, voteCount: weights.get(c.id) ?? 0 })), catalogVersion: `${catalog._count}:${catalog._max.updatedAt?.toISOString() ?? ''}` };
  }
}
