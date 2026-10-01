import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { ArcadeDifficulty, ArcadeGame } from '../../domain/arcade/types.js';
import { appearanceSelect, avatarAssetPath } from '../appearance/appearance-service.js';
import { privacyDefaults } from '../social/privacy-service.js';

export type ArcadeRankingQuery = { kind: 'GLOBAL' | 'SCORE'; game: ArcadeGame | 'TOTAL'; difficulty: ArcadeDifficulty; page?: number };
/** Records never select sessions, receipts or any Memory private state. */
export class ArcadeRecords {
  constructor(private readonly database: PrismaClient) {}
  async list(playerId: string, query: ArcadeRankingQuery) {
    const stats = await this.database.arcadeStat.findMany({ where: { ...(query.game === 'TOTAL' ? {} : { game: query.game }),
      ...(query.kind === 'GLOBAL' ? { difficulty: query.difficulty } : {}), player: { status: 'ACTIVE', elementKey: { not: null } } },
      include: { player: { select: { id: true, displayName: true, elementKey: true, equippedAvatarCosmetic: appearanceSelect.equippedAvatarCosmetic,
        privacySettings: { where: { categoryKey: 'GENERAL_STATISTICS' }, select: { level: true } } } } } });
    const values = new Map<string, { playerId: string; displayName: string; elementKey: string; avatarAssetPath: string | null; value: bigint; pairs: number | null }>();
    for (const stat of stats) {
      if ((stat.player.privacySettings[0]?.level ?? privacyDefaults.GENERAL_STATISTICS) !== 'PUBLIC') continue;
      const value = query.kind === 'GLOBAL' ? BigInt(stat.bestPoints) : stat.score;
      const old = values.get(stat.playerId);
      values.set(stat.playerId, { playerId: stat.playerId, displayName: stat.player.displayName, elementKey: stat.player.elementKey!,
        avatarAssetPath: avatarAssetPath(stat.player), value: (query.kind === 'SCORE' ? old?.value ?? 0n : 0n) + value, pairs: query.kind === 'GLOBAL' ? stat.bestPairs : null });
    }
    const rows = [...values.values()].filter(row => row.value > 0n).sort((a, b) => a.value === b.value ? (b.pairs ?? 0) - (a.pairs ?? 0) || a.playerId.localeCompare(b.playerId) : a.value > b.value ? -1 : 1);
    let rank = 0;
    const ranked = rows.map((row, index) => {
      if (!index || row.value !== rows[index - 1]!.value || row.pairs !== rows[index - 1]!.pairs) rank = index + 1;
      return { ...row, value: row.value.toString(), rank, position: index + 1, isSelf: row.playerId === playerId };
    });
    const selfIndex = ranked.findIndex(row => row.isSelf), selfPage = selfIndex < 0 ? null : Math.floor(selfIndex / 10) + 1;
    const totalPages = Math.max(1, Math.ceil(ranked.length / 10)), page = Math.min(query.page ?? selfPage ?? 1, totalPages);
    const ownPrivacy = await this.database.privacySetting.findUnique({ where: { playerId_categoryKey: { playerId, categoryKey: 'GENERAL_STATISTICS' } } });
    return { kind: query.kind, game: query.game, difficulty: query.difficulty, page, pageSize: 10, total: ranked.length, totalPages, selfPage,
      selfStatus: selfPage !== null ? 'RANKED' as const : (ownPrivacy?.level ?? privacyDefaults.GENERAL_STATISTICS) !== 'PUBLIC' ? 'NOT_PUBLIC' as const : 'NOT_ELIGIBLE' as const,
      entries: ranked.slice((page - 1) * 10, page * 10) };
  }
}
