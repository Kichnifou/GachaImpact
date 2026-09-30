import type { PrismaClient, Prisma } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import { getParisWeekWindow, type FeaturedSelection } from '../../domain/gacha/gacha.js';
import { validateSelections } from '../../infrastructure/database/prisma-gacha-store.js';
import type { WeeklyBannerScheduler } from '../gacha/weekly-banner-scheduler.js';
import { AdminOperation } from './admin-operation.js';

const BANNER_LOCK = 70422401;

export class BannerAdminService {
  private readonly operation: AdminOperation;
  constructor(private readonly database: PrismaClient, getPlayer: GetCurrentPlayer, private readonly scheduler: WeeklyBannerScheduler) {
    this.operation = new AdminOperation(database, getPlayer);
  }

  async overview(identity: AuthenticatedIdentity) {
    await this.operation.actor(identity, 'ADMIN');
    const now = new Date();
    const [active, next] = await Promise.all([
      this.database.bannerRotation.findFirst({ where: { status: 'ACTIVE' }, orderBy: { startsAt: 'desc' },
        include: { featuredCharacters: { include: { character: { select: { name: true, isActive: true, rarity: true } } }, orderBy: [{ rarity: 'desc' }, { slot: 'asc' }] } } }),
      this.database.bannerRotation.findFirst({ where: { startsAt: { gt: now } }, orderBy: { startsAt: 'asc' },
        include: { featuredCharacters: { include: { character: { select: { name: true, isActive: true, rarity: true } } }, orderBy: [{ rarity: 'desc' }, { slot: 'asc' }] } } }),
    ]);
    const counts = active ? await this.database.bannerVote.groupBy({ by: ['characterId'], where: { bannerRotationId: active.id }, _count: { _all: true } }) : [];
    const excluded = new Set(active?.featuredCharacters.map(row => row.characterId) ?? []);
    const candidates = active ? await this.database.character.findMany({ where: { rarity: 5, isActive: true, id: { notIn: [...excluded] } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : [];
    const votes = new Map(counts.map(row => [row.characterId, row._count._all]));
    const diagnostics = active ? {
      validComposition: active.featuredCharacters.filter(row => row.rarity === 5).length === 4 && active.featuredCharacters.filter(row => row.rarity === 4).length === 6 && new Set(active.featuredCharacters.map(row => row.characterId)).size === 10,
      withinWindow: active.startsAt <= now && now < active.endsAt,
      inactiveFeatured: active.featuredCharacters.filter(row => !row.character.isActive).map(row => row.characterId),
    } : { validComposition: false, withinWindow: false, inactiveFeatured: [] };
    return { active, next, currentWeek: getParisWeekWindow(now), voteCycle: { candidates: candidates.map(row => ({ ...row, voteCount: votes.get(row.id) ?? 0 })), totalVotes: counts.reduce((sum, row) => sum + row._count._all, 0) }, diagnostics };
  }

  async correct(identity: AuthenticatedIdentity, rotationId: string, input: { fiveStarIds: string[]; fourStarIds: string[]; idempotencyKey: string }) {
    if (input.fiveStarIds.length !== 4 || input.fourStarIds.length !== 6 || new Set([...input.fiveStarIds, ...input.fourStarIds]).size !== 10) throw invalid();
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'banners', action: 'correct-active', idempotencyKey: input.idempotencyKey,
      request: { rotationId, fiveStarIds: input.fiveStarIds, fourStarIds: input.fourStarIds }, lockKey: BANNER_LOCK,
      change: async (tx, actorId, operationId) => {
        const now = new Date();
        const rotation = await tx.bannerRotation.findUnique({ where: { id: rotationId }, include: { featuredCharacters: true } });
        if (!rotation || rotation.status !== 'ACTIVE' || now < rotation.startsAt || now >= rotation.endsAt) throw new AppError('Seule la bannière active courante peut être corrigée.', 409, 'BANNER_ADMIN_NOT_ACTIVE');
        const ids = [...input.fiveStarIds, ...input.fourStarIds];
        const characters = await tx.character.findMany({ where: { id: { in: ids } } });
        if (characters.length !== 10 || characters.some(row => !row.isActive)) throw invalid();
        const byId = new Map(characters.map(row => [row.id, row]));
        const proposed: FeaturedSelection[] = ids.map((id, index) => {
          const row = byId.get(id)!;
          if (row.rarity !== 4 && row.rarity !== 5) throw invalid();
          return { character: { ...row, rarity: row.rarity }, slot: index < 4 ? index + 1 : index - 3, selectionSource: 'RANDOM' };
        });
        try { validateSelections(proposed); } catch { throw invalid(); }
        if (proposed.slice(0, 4).some(row => row.character.rarity !== 5) || proposed.slice(4).some(row => row.character.rarity !== 4)) throw invalid();
        const before = rotation.featuredCharacters.map(row => ({ characterId: row.characterId, rarity: row.rarity, slot: row.slot, selectionSource: row.selectionSource }));
        const after = proposed.map(row => ({ characterId: row.character.id, rarity: row.character.rarity, slot: row.slot,
          selectionSource: before.find(old => old.rarity === row.character.rarity && old.slot === row.slot && old.characterId === row.character.id)?.selectionSource ?? 'LEGACY_UNKNOWN' as const }));
        const oldProvenance = rotation.legacyProvenance && typeof rotation.legacyProvenance === 'object' && !Array.isArray(rotation.legacyProvenance) ? rotation.legacyProvenance : {};
        const previousCorrections = Array.isArray(oldProvenance.adminCorrections) ? oldProvenance.adminCorrections : [];
        await tx.bannerFeaturedCharacter.deleteMany({ where: { bannerRotationId: rotationId } });
        await tx.bannerFeaturedCharacter.createMany({ data: after.map(row => ({ bannerRotationId: rotationId, ...row })) });
        const removedFiveIds = before.filter(row => row.rarity === 5 && !input.fiveStarIds.includes(row.characterId)).map(row => row.characterId);
        const clearedTargetCount = removedFiveIds.length ? (await tx.playerGachaState.updateMany({ where: { selectedBannerCharacterId: { in: removedFiveIds } }, data: { selectedBannerCharacterId: null } })).count : 0;
        await tx.bannerRotation.update({ where: { id: rotationId }, data: { legacyProvenance: { ...oldProvenance,
          adminCorrections: [...previousCorrections, { operationId, actorPlayerId: actorId, correctedAt: now.toISOString(), before, after }] } as Prisma.InputJsonValue } });
        const context = { rotationId, startsAt: rotation.startsAt.toISOString(), endsAt: rotation.endsAt.toISOString(), status: rotation.status };
        return { before: { ...context, featured: before }, after: { ...context, featured: after, clearedTargetCount } };
      } });
  }

  async retryGeneration(identity: AuthenticatedIdentity, idempotencyKey: string) {
    const actorId = await this.operation.actor(identity, 'ADMIN');
    // The scheduler owns two serializable transactions: vote closure and rotation creation.
    // It is itself idempotent; record the authorized retry request, then invoke that owner.
    const operation = await this.operation.run(identity, { scope: 'ADMIN', domain: 'banners', action: 'retry-generation', idempotencyKey,
      request: { currentWeek: getParisWeekWindow(new Date()).startsAt.toISOString() },
      change: async tx => {
        const before = await tx.bannerRotation.findFirst({ where: { status: 'ACTIVE' }, select: { id: true } });
        return { before: { activeRotationId: before?.id ?? null }, after: { retryRequestedBy: actorId, activeRotationId: before?.id ?? null } };
      } });
    await this.scheduler.catchUp();
    return { ...operation, overview: await this.overview(identity) };
  }
}
function invalid() { return new AppError('Composition de bannière invalide : quatre 5★ et six 4★ actifs distincts sont requis.', 400, 'BANNER_ADMIN_INVALID'); }
