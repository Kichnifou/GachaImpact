import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { GenerationVoteSnapshot } from '../../domain/gacha/gacha.js';

const PAGE_SIZE = 10;
const pageResult = (page: number, total: number) => ({ page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });

function voteSnapshot(value: unknown): GenerationVoteSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.candidates) || typeof row.capturedAt !== 'string' || typeof row.selectedCharacterId !== 'string' ||
    typeof row.selectedCharacterName !== 'string' || !['COMMUNITY_VOTE', 'RANDOM_FALLBACK'].includes(String(row.selectionSource))) return null;
  if (!row.candidates.every((candidate: unknown) => candidate && typeof candidate === 'object' &&
    typeof (candidate as Record<string, unknown>).characterId === 'string' && typeof (candidate as Record<string, unknown>).characterName === 'string' &&
    Number.isInteger((candidate as Record<string, unknown>).voteCount) && Number((candidate as Record<string, unknown>).voteCount) >= 0)) return null;
  return value as GenerationVoteSnapshot;
}

export class HistoryService {
  constructor(private readonly database: PrismaClient, private readonly now: () => Date = () => new Date()) {}

  async banners(page: number) {
    const [total, rotations] = await Promise.all([
      this.database.bannerRotation.count(),
      this.database.bannerRotation.findMany({
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
        select: { id: true, startsAt: true, endsAt: true, status: true, generationVoteSnapshot: true,
          featuredCharacters: { orderBy: [{ rarity: 'desc' }, { slot: 'asc' }], select: { rarity: true, slot: true, selectionSource: true, characterId: true, character: { select: { name: true } } } } },
      }),
    ]);
    return { category: 'banners' as const, ...pageResult(page, total), entries: rotations.map(rotation => ({
      id: rotation.id, startsAt: rotation.startsAt.toISOString(), endsAt: rotation.endsAt.toISOString(), status: rotation.status,
      featured: rotation.featuredCharacters.map(row => ({ characterId: row.characterId, name: row.character.name, rarity: row.rarity, slot: row.slot, source: row.selectionSource })),
      generationVoteSnapshot: voteSnapshot(rotation.generationVoteSnapshot),
    })) };
  }

  async events(playerId: string, page: number) {
    const where = { endsAt: { lte: this.now() }, status: { in: ['ACTIVE', 'FINISHED'] as ('ACTIVE' | 'FINISHED')[] } };
    const [total, editions] = await Promise.all([
      this.database.eventEdition.count({ where }),
      this.database.eventEdition.findMany({ where, orderBy: [{ endsAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
        select: { id: true, year: true, startsAt: true, endsAt: true, snapshot: true } }),
    ]);
    const ids = editions.map(edition => edition.id);
    const [participants, claims, acquisitions] = ids.length ? await Promise.all([
      this.database.eventParticipant.findMany({ where: { eventEditionId: { in: ids } }, select: { eventEditionId: true, playerId: true, points: true, joinedAt: true, player: { select: { displayName: true } } } }),
      this.database.eventMilestoneClaim.findMany({ where: { eventEditionId: { in: ids }, playerId }, select: { eventEditionId: true, milestone: true } }),
      this.database.eventCollectionAcquisition.findMany({ where: { eventEditionId: { in: ids }, playerId }, select: { eventEditionId: true, item: { select: { displayName: true } } } }),
    ]) : [[], [], []];
    return { category: 'event' as const, ...pageResult(page, total), entries: editions.map(edition => {
      const snapshot = edition.snapshot && typeof edition.snapshot === 'object' && !Array.isArray(edition.snapshot) ? edition.snapshot as Record<string, unknown> : {};
      const sorted = participants.filter(row => row.eventEditionId === edition.id)
        .sort((a, b) => b.points - a.points || a.joinedAt.getTime() - b.joinedAt.getTime() || a.playerId.localeCompare(b.playerId));
      const ranked = sorted.map((row, index) => ({ rank: index + 1, playerId: row.playerId, displayName: row.player.displayName, points: row.points }));
      const own = ranked.find(row => row.playerId === playerId);
      const acquired = acquisitions.find(row => row.eventEditionId === edition.id);
      return {
        id: edition.id, festival: typeof snapshot.displayName === 'string' ? snapshot.displayName : 'Festival',
        month: typeof snapshot.calendarMonth === 'number' ? snapshot.calendarMonth : edition.startsAt.getUTCMonth() + 1,
        year: edition.year, startsAt: edition.startsAt.toISOString(), endsAt: edition.endsAt.toISOString(), participantCount: ranked.length,
        top: ranked.slice(0, 10),
        personal: own ? { rank: own.rank, points: own.points, milestones: claims.filter(row => row.eventEditionId === edition.id).map(row => row.milestone).sort((a, b) => a - b), collectionAcquired: Boolean(acquired), collectionItemName: acquired?.item.displayName ?? null } : null,
      };
    }) };
  }
}
