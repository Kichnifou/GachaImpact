import { CosmeticType, CosmeticVisibility, Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';

type Database = PrismaClient | Prisma.TransactionClient;
type AppearancePlayer = {
  displayName: string;
  elementKey: string | null;
  equippedAvatarCosmetic: { id: string; type: CosmeticType; isActive: boolean; assetPath: string | null } | null;
  equippedTitleCosmetic: { id: string; type: CosmeticType; displayName: string } | null;
};

const officialAsset = (path: string | null) => path && /^\/assets\/[A-Za-z0-9/_-]+\.(?:png|webp|svg)$/.test(path) ? path : null;
export const appearanceSelect = {
  equippedAvatarCosmetic: { select: { id: true, type: true, isActive: true, assetPath: true } },
  equippedTitleCosmetic: { select: { id: true, type: true, displayName: true } },
} as const;

export function effectiveAvatar(player: Pick<AppearancePlayer, 'displayName' | 'elementKey' | 'equippedAvatarCosmetic'>) {
  const custom = player.equippedAvatarCosmetic;
  if (custom?.type === CosmeticType.AVATAR && custom.isActive && officialAsset(custom.assetPath)) return { kind: 'CUSTOM' as const, assetPath: custom.assetPath };
  if (player.elementKey && ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].includes(player.elementKey)) return { kind: 'ELEMENT' as const, assetPath: null };
  return { kind: 'INITIAL' as const, assetPath: null };
}

export function equippedTitle(player: Pick<AppearancePlayer, 'equippedTitleCosmetic'>) {
  return player.equippedTitleCosmetic?.type === CosmeticType.TITLE ? player.equippedTitleCosmetic.displayName : null;
}
export function avatarAssetPath(player: Pick<AppearancePlayer, 'displayName' | 'elementKey' | 'equippedAvatarCosmetic'>) {
  const avatar = effectiveAvatar(player);
  return avatar.kind === 'CUSTOM' ? avatar.assetPath : null;
}

export class AppearanceService {
  constructor(private readonly database: PrismaClient, private readonly getPlayer: GetCurrentPlayer) {}

  async playerAvatarAssetPath(playerId: string) {
    const player = await this.database.player.findUnique({ where: { id: playerId }, select: { displayName: true, elementKey: true, equippedAvatarCosmetic: appearanceSelect.equippedAvatarCosmetic } });
    return player ? avatarAssetPath(player) : null;
  }

  private async actor(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    if (player.status !== 'ACTIVE') throw new AppError('Compte indisponible.', 403, 'PLAYER_INACTIVE');
    return player;
  }

  async get(identity: AuthenticatedIdentity) {
    const actor = await this.actor(identity);
    const [player, definitions, possessions] = await Promise.all([
      this.database.player.findUniqueOrThrow({ where: { id: actor.id }, select: { displayName: true, elementKey: true, ...appearanceSelect } }),
      this.database.cosmeticDefinition.findMany({ where: { OR: [{ isActive: true }, { owners: { some: { playerId: actor.id } } }] }, orderBy: [{ type: 'asc' }, { displayName: 'asc' }], select: { id: true, type: true, displayName: true, assetPath: true, conditionText: true, visibility: true, isActive: true } }),
      this.database.playerCosmetic.findMany({ where: { playerId: actor.id }, select: { cosmeticId: true } }),
    ]);
    const owned = new Set(possessions.map(item => item.cosmeticId));
    return {
      avatar: effectiveAvatar(player), title: equippedTitle(player),
      equippedAvatarCosmeticId: player.equippedAvatarCosmetic?.id ?? null,
      equippedTitleCosmeticId: player.equippedTitleCosmetic?.id ?? null,
      catalog: definitions.flatMap(item => {
        const isOwned = owned.has(item.id);
        if (!isOwned && item.visibility === CosmeticVisibility.SECRET) return [];
        return [{ id: item.id, type: item.type, displayName: isOwned || item.visibility === CosmeticVisibility.VISIBLE ? item.displayName : 'Cosmétique mystérieux',
          assetPath: isOwned || item.visibility === CosmeticVisibility.VISIBLE ? officialAsset(item.assetPath) : null,
          condition: !isOwned && item.visibility === CosmeticVisibility.VISIBLE ? item.conditionText : null,
          visibility: item.visibility, owned: isOwned, isActive: item.isActive }];
      }),
    };
  }

  async equip(identity: AuthenticatedIdentity, type: CosmeticType, cosmeticId: string | null) {
    const actor = await this.actor(identity);
    await this.database.$transaction(async tx => {
      if (cosmeticId !== null) {
        const cosmetic = await tx.cosmeticDefinition.findUnique({ where: { id: cosmeticId }, select: { type: true, isActive: true } });
        if (!cosmetic || !cosmetic.isActive) throw new AppError('Cosmétique indisponible.', 404, 'COSMETIC_UNAVAILABLE');
        if (cosmetic.type !== type) throw new AppError('Type de cosmétique incorrect.', 400, 'COSMETIC_TYPE_MISMATCH');
        const possession = await tx.playerCosmetic.findUnique({ where: { playerId_cosmeticId: { playerId: actor.id, cosmeticId } }, select: { cosmeticId: true } });
        if (!possession) throw new AppError('Cosmétique non possédé.', 403, 'COSMETIC_NOT_OWNED');
      }
      await tx.player.update({ where: { id: actor.id }, data: type === CosmeticType.AVATAR ? { equippedAvatarCosmeticId: cosmeticId } : { equippedTitleCosmeticId: cosmeticId } });
    });
    return this.get(identity);
  }

  /** Transaction-aware; each caller must declare whether this is a player-facing unlock or a silent technical import. */
  async unlockCosmetic(input: { playerId: string; externalKey: string; source: string; provenance?: Prisma.InputJsonValue; notificationMode: 'PLAYER_FACING' | 'SILENT_BACKFILL' }, transaction?: Prisma.TransactionClient) {
    const run = async (db: Database) => {
      const definition = await db.cosmeticDefinition.findUnique({ where: { externalKey: input.externalKey }, select: { id: true, displayName: true, type: true, isActive: true } });
      if (!definition || !definition.isActive) throw new AppError('Cosmétique indisponible.', 404, 'COSMETIC_UNAVAILABLE');
      const inserted = await db.playerCosmetic.createMany({ data: [{ playerId: input.playerId, cosmeticId: definition.id, unlockSource: input.source, ...(input.provenance ? { provenance: input.provenance } : {}) }], skipDuplicates: true });
      if (inserted.count && input.notificationMode === 'PLAYER_FACING') await db.notification.create({ data: { playerId: input.playerId, domainKey: 'appearance', typeKey: 'COSMETIC_UNLOCKED', payload: { cosmeticId: definition.id, type: definition.type, displayName: definition.displayName }, actionKey: 'OPEN_PROFILE_PERSONALIZATION', deduplicationKey: `cosmetic-unlock:${input.playerId}:${definition.id}` } });
      return { unlocked: inserted.count === 1, cosmeticId: definition.id };
    };
    return transaction ? run(transaction) : this.database.$transaction(run);
  }
}
