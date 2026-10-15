import { presentedName, presentationNameSchema } from '../player/presentation-name.js';
import { CosmeticType, CosmeticVisibility, Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import { officialCharacterAsset } from '../character-catalog/catalog-asset-url.js';
import { freeBadgeSymbol } from './badges.js';

type Database = PrismaClient | Prisma.TransactionClient;
type AppearancePlayer = {
  displayName: string;
  elementKey: string | null;
  equippedAvatarCosmetic: { id: string; type: CosmeticType; isActive: boolean; assetPath: string | null; sourceCharacterId?: string | null; sourceCharacter?: { iconPath: string | null } | null } | null;
  equippedTitleCosmetic: { id: string; type: CosmeticType; displayName: string } | null;
};

const officialAsset = officialCharacterAsset;
export const appearanceSelect = {
  equippedAvatarCosmetic: { select: { id: true, type: true, isActive: true, assetPath: true, sourceCharacterId: true, sourceCharacter: { select: { iconPath: true } } } },
  equippedTitleCosmetic: { select: { id: true, type: true, displayName: true } },
  equippedBadgeCosmetic: { select: { id: true, type: true, externalKey: true, displayName: true, isActive: true } },
} as const;

export function effectiveAvatar(player: Pick<AppearancePlayer, 'displayName' | 'elementKey' | 'equippedAvatarCosmetic'>) {
  const custom = player.equippedAvatarCosmetic;
  const assetPath = custom?.sourceCharacterId ? officialAsset(custom.sourceCharacter?.iconPath ?? null) : officialAsset(custom?.assetPath ?? null);
  if (custom?.type === CosmeticType.AVATAR && custom.isActive && assetPath) return { kind: 'CUSTOM' as const, assetPath };
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

  async renamePresentation(identity: AuthenticatedIdentity, input: unknown, expectedRevision: number) {
    const parsed = presentationNameSchema.safeParse(input);
    if (!parsed.success) throw new AppError('Le pseudo doit contenir de 1 à 40 caractères, sans caractères de contrôle.', 400, 'PRESENTATION_NAME_INVALID');
    const actor = await this.actor(identity);
    return this.database.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ status: string }[]>`SELECT status::text FROM players WHERE id = ${actor.id}::uuid FOR UPDATE`;
      if (locked[0]?.status !== 'ACTIVE') throw new AppError('Compte indisponible.', 403, 'PLAYER_INACTIVE');
      const player = await tx.player.findUniqueOrThrow({ where: { id: actor.id }, select: { id: true, displayName: true, presentationName: true, presentationNameRevision: true } });
      if (presentedName(player) === parsed.data) return { id: player.id, displayName: presentedName(player), revision: player.presentationNameRevision };
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || player.presentationNameRevision !== expectedRevision) throw new AppError('Le pseudo a changé. Rechargez le profil avant de confirmer.', 409, 'PRESENTATION_NAME_CONFLICT');
      await tx.player.update({ where: { id: actor.id }, data: { presentationName: parsed.data, presentationNameRevision: { increment: 1 } } });
      return { id: player.id, displayName: parsed.data, revision: player.presentationNameRevision + 1 };
    });
  }

  async playerAvatarAssetPath(playerId: string) {
    const player = await this.database.player.findUnique({ where: { id: playerId }, select: { displayName: true, presentationName: true, presentationNameRevision: true, elementKey: true, equippedAvatarCosmetic: appearanceSelect.equippedAvatarCosmetic } });
    return player ? avatarAssetPath(player) : null;
  }

  async playerIdentityAppearance(playerId: string) {
    const player = await this.database.player.findUnique({ where: { id: playerId }, select: { displayName: true, presentationName: true, presentationNameRevision: true, elementKey: true, equippedAvatarCosmetic: appearanceSelect.equippedAvatarCosmetic, equippedBadgeCosmetic: appearanceSelect.equippedBadgeCosmetic } });
    return { ...(player ? { displayName: presentedName(player), presentationNameRevision: player.presentationNameRevision } : {}), avatarAssetPath: player ? avatarAssetPath(player) : null, badgeSymbol: freeBadgeSymbol(player?.equippedBadgeCosmetic) };
  }

  private async actor(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    if (player.status !== 'ACTIVE') throw new AppError('Compte indisponible.', 403, 'PLAYER_INACTIVE');
    return player;
  }

  async get(identity: AuthenticatedIdentity) {
    const actor = await this.actor(identity);
    const [player, definitions, possessions, characters] = await Promise.all([
      this.database.player.findUniqueOrThrow({ where: { id: actor.id }, select: { displayName: true, presentationName: true, presentationNameRevision: true, elementKey: true, ...appearanceSelect } }),
      this.database.cosmeticDefinition.findMany({ where: { OR: [{ isActive: true }, { owners: { some: { playerId: actor.id } } }] }, orderBy: [{ type: 'asc' }, { displayName: 'asc' }], select: { id: true, externalKey: true, type: true, displayName: true, assetPath: true, sourceCharacterId: true, sourceCharacter: { select: { name: true, iconPath: true } }, conditionText: true, unlockRule: true, visibility: true, isActive: true } }),
      this.database.playerCosmetic.findMany({ where: { playerId: actor.id }, select: { cosmeticId: true, unlockedAt: true, consultedAt: true, acquisitionDateKnown: true } }),
      this.database.playerCharacter.findMany({ where: { playerId: actor.id }, select: { characterId: true } }),
    ]);
    const owned = new Set(possessions.map(item => item.cosmeticId));
    const ownedCharacters = new Set(characters.map(item => item.characterId));
    return {
      avatar: effectiveAvatar(player), title: equippedTitle(player),
      equippedAvatarCosmeticId: player.equippedAvatarCosmetic?.id ?? null,
      equippedTitleCosmeticId: player.equippedTitleCosmetic?.id ?? null,
      equippedBadgeCosmeticId: freeBadgeSymbol(player.equippedBadgeCosmetic) ? player.equippedBadgeCosmetic!.id : null,
      badgeSymbol: freeBadgeSymbol(player.equippedBadgeCosmetic),
      catalog: definitions.flatMap(item => {
        if (item.type === 'BADGE' && !freeBadgeSymbol(item)) return [];
        const isOwned = item.type === 'BADGE' || owned.has(item.id);
        const possession=possessions.find(row=>row.cosmeticId===item.id);
        if (item.sourceCharacterId && (!isOwned || !ownedCharacters.has(item.sourceCharacterId))) return [];
        if (!isOwned && item.visibility === CosmeticVisibility.SECRET) return [];
        const rule = item.unlockRule as { kind?: string; level?: number } | null;
        const levelRequirement = item.type === 'TITLE' && (isOwned || item.visibility === 'VISIBLE') && rule?.kind === 'PLAYER_LEVEL' && Number.isInteger(rule.level) ? rule.level! : null;
        return [{ id: item.id, type: item.type, sourceCharacterId: item.sourceCharacterId, displayName: isOwned || item.visibility === CosmeticVisibility.VISIBLE ? item.sourceCharacter?.name ?? item.displayName : 'Cosmétique mystérieux',
          assetPath: isOwned || item.visibility === CosmeticVisibility.VISIBLE ? officialAsset(item.sourceCharacterId ? item.sourceCharacter?.iconPath ?? null : item.assetPath) : null,
          condition: !isOwned && item.visibility === CosmeticVisibility.VISIBLE ? item.conditionText : null,
          unlockedAt: possession?.acquisitionDateKnown ? possession.unlockedAt.toISOString() : null,
          isNew: !!possession && possession.consultedAt===null,
          levelRequirement, visibility: item.visibility, owned: isOwned, isActive: item.isActive }];
      }),
    };
  }

  async consult(identity: AuthenticatedIdentity, type: CosmeticType, cosmeticIds: readonly string[]) {
    const actor=await this.actor(identity);
    const ids=[...new Set(cosmeticIds)];
    await this.database.$transaction(async tx=>{
      const possessions=await tx.playerCosmetic.findMany({where:{playerId:actor.id,cosmeticId:{in:ids},cosmetic:{type}},select:{cosmeticId:true}});
      if(possessions.length!==ids.length)throw new AppError('Cosmétique non possédé.',403,'COSMETIC_NOT_OWNED');
      await tx.playerCosmetic.updateMany({where:{playerId:actor.id,cosmeticId:{in:ids},consultedAt:null,cosmetic:{type}},data:{consultedAt:new Date()}});
    });
    return { consulted: ids };
  }

  async equip(identity: AuthenticatedIdentity, type: CosmeticType, cosmeticId: string | null) {
    const actor = await this.actor(identity);
    await this.database.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ status: string }[]>`SELECT status::text FROM players WHERE id = ${actor.id}::uuid FOR UPDATE`;
      if (locked[0]?.status !== 'ACTIVE') throw new AppError('Compte indisponible.', 403, 'PLAYER_INACTIVE');
      if (cosmeticId !== null) {
        const cosmetic = await tx.cosmeticDefinition.findUnique({ where: { id: cosmeticId }, select: { type: true, isActive: true, sourceCharacterId: true, externalKey: true, displayName: true } });
        if (!cosmetic || !cosmetic.isActive) throw new AppError('Cosmétique indisponible.', 404, 'COSMETIC_UNAVAILABLE');
        if (cosmetic.type !== type) throw new AppError('Type de cosmétique incorrect.', 400, 'COSMETIC_TYPE_MISMATCH');
        if (type === CosmeticType.BADGE && !freeBadgeSymbol(cosmetic)) throw new AppError('Badge indisponible.', 403, 'COSMETIC_NOT_OWNED');
        const possession = await tx.playerCosmetic.findUnique({ where: { playerId_cosmeticId: { playerId: actor.id, cosmeticId } }, select: { cosmeticId: true } });
        if (!possession && !freeBadgeSymbol(cosmetic)) throw new AppError('Cosmétique non possédé.', 403, 'COSMETIC_NOT_OWNED');
        if (cosmetic.sourceCharacterId && !(await tx.playerCharacter.findUnique({ where: { playerId_characterId: { playerId: actor.id, characterId: cosmetic.sourceCharacterId } }, select: { characterId: true } }))) {
          throw new AppError('Personnage non possédé.', 403, 'COSMETIC_NOT_OWNED');
        }
      }
      await tx.player.update({ where: { id: actor.id }, data: type === CosmeticType.AVATAR ? { equippedAvatarCosmeticId: cosmeticId } : type === CosmeticType.TITLE ? { equippedTitleCosmeticId: cosmeticId } : { equippedBadgeCosmeticId: cosmeticId } });
    });
    return this.get(identity);
  }

  /** Transaction-aware; each caller must declare whether this is a player-facing unlock or a silent technical import. */
  async unlockCosmetic(input: { playerId: string; externalKey: string; source: string; provenance?: Prisma.InputJsonValue; notificationMode: 'PLAYER_FACING' | 'SILENT_BACKFILL' }, transaction?: Prisma.TransactionClient) {
    return transaction ? unlockCosmeticInTransaction(transaction, input) : this.database.$transaction(tx => unlockCosmeticInTransaction(tx, input));
  }
}

export async function unlockCosmeticInTransaction(db: Database, input: { playerId: string; externalKey: string; source: string; provenance?: Prisma.InputJsonValue; notificationMode: 'PLAYER_FACING' | 'SILENT_BACKFILL' }) {
  const definition = await db.cosmeticDefinition.findUnique({ where: { externalKey: input.externalKey }, select: { id: true, displayName: true, type: true, isActive: true } });
  if (!definition || !definition.isActive) throw new AppError('Cosmétique indisponible.', 404, 'COSMETIC_UNAVAILABLE');
  const inserted = await db.playerCosmetic.createMany({ data: [{ playerId: input.playerId, cosmeticId: definition.id, unlockSource: input.source, ...(input.notificationMode==='PLAYER_FACING'?{consultedAt:null,acquisitionDateKnown:true}:{}), ...(input.provenance ? { provenance: input.provenance } : {}) }], skipDuplicates: true });
  if (inserted.count && input.notificationMode === 'PLAYER_FACING') await db.notification.create({ data: { playerId: input.playerId, domainKey: 'appearance', typeKey: 'COSMETIC_UNLOCKED', payload: { cosmeticId: definition.id, type: definition.type, displayName: definition.displayName }, actionKey: 'OPEN_PROFILE_PERSONALIZATION', deduplicationKey: `cosmetic-unlock:${input.playerId}:${definition.id}` } });
  return { unlocked: inserted.count === 1, cosmeticId: definition.id };
}
