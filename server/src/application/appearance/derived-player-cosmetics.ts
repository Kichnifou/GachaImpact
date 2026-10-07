import type { Prisma } from '../../../generated/prisma/client.js';
import { derivePlayerLevel } from '../../domain/player/player-progression.js';
import { unlockCharacterAvatars } from './character-avatar-unlocks.js';
import { unlockCosmeticInTransaction } from './appearance-service.js';
import { profileLevelTitleNames, profileLevelTitleThresholds } from './profile-level-titles.js';

type Definition = { externalKey: string; type: string; sourceCharacterId: string | null; unlockRule: unknown };
/** Only these two deterministic families have a legacy replacement contract. */
export function isDerivedPlayerCosmetic(definition: Definition) {
  if (definition.type === 'AVATAR') return definition.sourceCharacterId !== null && definition.externalKey.startsWith('character-avatar:');
  const level = profileLevelTitleThresholds.find(value => definition.externalKey === `title-level-${value}`);
  const rule = definition.unlockRule as { kind?: unknown; level?: unknown } | null;
  return definition.type === 'TITLE' && definition.sourceCharacterId === null && level !== undefined && rule?.kind === 'PLAYER_LEVEL' && rule.level === level;
}

export async function assertLegacyCosmeticsClassified(tx: Prisma.TransactionClient, playerIds: readonly string[]) {
  const owned = await tx.playerCosmetic.findMany({ where: { playerId: { in: [...playerIds] } }, include: { cosmetic: { include: { sourceCharacter: true } } } });
  if (owned.some(({ cosmetic }) => !isDerivedPlayerCosmetic(cosmetic) || cosmetic.sourceCharacter &&
    (cosmetic.externalKey !== `character-avatar:${cosmetic.sourceCharacter.externalKey}` || ![4, 5].includes(cosmetic.sourceCharacter.rarity)))) {
    throw new Error('LEGACY_COSMETIC_FAMILY_UNCLASSIFIED');
  }
}

export async function clearLegacyDerivedCosmetics(tx: Prisma.TransactionClient, playerId: string) {
  await assertLegacyCosmeticsClassified(tx, [playerId]);
  const classified = await tx.playerCosmetic.findMany({ where: { playerId }, select: { cosmeticId: true } });
  await tx.playerCosmetic.deleteMany({ where: { playerId, cosmeticId: { in: classified.map(row => row.cosmeticId) } } });
}

/** Reads final persisted XP and ownership, never the legacy input or display name. */
export async function planDerivedPlayerCosmetics(tx: Prisma.TransactionClient, playerId: string) {
  const progression = await tx.playerProgression.findUniqueOrThrow({ where: { playerId }, select: { xp: true } });
  const characters = await tx.playerCharacter.findMany({ where: { playerId, character: { rarity: { in: [4, 5] } } },
    select: { characterId: true, character: { select: { externalKey: true, rarity: true } } }, orderBy: { characterId: 'asc' } });
  const levels = profileLevelTitleThresholds.filter(level => level <= derivePlayerLevel(progression.xp));
  const expected = [...characters.map(row => `character-avatar:${row.character.externalKey}`), ...levels.map(level => `title-level-${level}`)].sort();
  const definitions = await tx.cosmeticDefinition.findMany({ where: { OR: [
    { externalKey: { in: [...expected, ...profileLevelTitleThresholds.map(level => `title-level-${level}`)] } },
    { sourceCharacterId: { in: characters.map(row => row.characterId) } },
  ] } });
  for (const definition of definitions) {
    const character = characters.find(row => definition.sourceCharacterId === row.characterId || definition.externalKey === `character-avatar:${row.character.externalKey}`);
    if (!definition.isActive || !isDerivedPlayerCosmetic(definition) || character && (definition.sourceCharacterId !== character.characterId || definition.externalKey !== `character-avatar:${character.character.externalKey}`)) {
      throw new Error('DERIVED_COSMETIC_DEFINITION_CONFLICT');
    }
  }
  const possessions = await tx.playerCosmetic.findMany({ where: { playerId }, include: { cosmetic: true }, orderBy: { cosmeticId: 'asc' } });
  const actual = possessions.filter(row => isDerivedPlayerCosmetic(row.cosmetic)).map(row => row.cosmetic.externalKey).sort();
  return { xp: progression.xp.toString(), characters, levels, expected, actual,
    missing: expected.filter(key => !actual.includes(key)), unexpected: actual.filter(key => !expected.includes(key)) };
}

/** Silent, idempotent backfill through the same owners used by runtime gameplay. */
export async function rebuildDerivedPlayerCosmetics(tx: Prisma.TransactionClient, input: {
  playerId: string; now: Date; source: string; provenance: Prisma.InputJsonValue;
}) {
  const plan = await planDerivedPlayerCosmetics(tx, input.playerId);
  const avatars = await unlockCharacterAvatars(tx, { playerId: input.playerId, characterIds: plan.characters.map(row => row.characterId),
    now: input.now, silent: true, unlockSource: input.source, provenance: input.provenance });
  // Definitions are catalog, not past unlock history. Import must also work if 059
  // ran before this Player existed, or the private fixture has no cosmetics yet.
  await tx.cosmeticDefinition.createMany({ data: profileLevelTitleThresholds.map((level, index) => ({
    externalKey: `title-level-${level}`, type: 'TITLE', displayName: profileLevelTitleNames[index]!,
    unlockRule: { kind: 'PLAYER_LEVEL', level }, conditionText: `Atteindre le niveau ${level}.`, visibility: 'VISIBLE', isActive: true,
  })), skipDuplicates: true });
  const definitions = await tx.cosmeticDefinition.findMany({ where: { externalKey: { in: profileLevelTitleThresholds.map(level => `title-level-${level}`) } } });
  if (definitions.length !== profileLevelTitleThresholds.length || definitions.some(definition => !isDerivedPlayerCosmetic(definition) || !definition.isActive)) {
    throw new Error('DERIVED_LEVEL_TITLE_DEFINITION_CONFLICT');
  }
  let titles = 0;
  for (const level of plan.levels) {
    const result = await unlockCosmeticInTransaction(tx, { playerId: input.playerId, externalKey: `title-level-${level}`,
      source: input.source, notificationMode: 'SILENT_BACKFILL', provenance: { kind: 'PLAYER_LEVEL', level, totalXp: plan.xp, backfill: input.provenance } });
    if (result.unlocked) titles++;
  }
  await assertDerivedPlayerCosmeticsExact(tx, input.playerId);
  return { avatars: avatars.newlyUnlocked, titles };
}

export async function assertDerivedPlayerCosmeticsExact(tx: Prisma.TransactionClient, playerId: string) {
  const plan = await planDerivedPlayerCosmetics(tx, playerId);
  if (plan.missing.length || plan.unexpected.length) throw new Error('DERIVED_COSMETIC_POSSESSIONS_MISMATCH');
  return plan;
}
