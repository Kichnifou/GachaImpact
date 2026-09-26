import { CosmeticType, CosmeticVisibility, NotificationState, Prisma } from '../../../generated/prisma/client.js';

/** Grants owned character avatars inside the caller's authoritative transaction. */
export async function unlockCharacterAvatars(
  transaction: Prisma.TransactionClient,
  input: { playerId: string; characterIds: readonly string[]; now: Date },
) {
  const characterIds = [...new Set(input.characterIds)];
  if (!characterIds.length) return { newlyUnlocked: 0 };

  // Pulls already hold this row. The same lock also serializes standalone
  // callers, so one Player's notification count cannot lose an increment.
  const locked = await transaction.$queryRaw<{ id: string }[]>`
    SELECT id FROM players WHERE id = ${input.playerId}::uuid FOR UPDATE
  `;
  if (locked.length !== 1) throw new Error('Character avatar Player is missing.');

  const possessions = await transaction.playerCharacter.findMany({
    where: { playerId: input.playerId, characterId: { in: characterIds } },
    include: { character: { select: { id: true, externalKey: true, name: true, rarity: true } } },
  });
  if (possessions.length !== characterIds.length || possessions.some(row => row.character.rarity !== 4 && row.character.rarity !== 5)) {
    throw new Error('A character avatar requires an owned 4★ or 5★ character.');
  }

  await transaction.cosmeticDefinition.createMany({
    data: possessions.map(({ character }) => ({
      externalKey: `character-avatar:${character.externalKey}`,
      sourceCharacterId: character.id,
      type: CosmeticType.AVATAR,
      displayName: character.name,
      assetPath: null,
      visibility: CosmeticVisibility.SECRET,
    })),
    skipDuplicates: true,
  });
  const definitions = await transaction.cosmeticDefinition.findMany({
    where: { sourceCharacterId: { in: characterIds } },
    select: { id: true, sourceCharacterId: true, externalKey: true, type: true },
  });
  const byCharacter = new Map(definitions.map(row => [row.sourceCharacterId, row]));
  for (const { character } of possessions) {
    const definition = byCharacter.get(character.id);
    if (!definition || definition.externalKey !== `character-avatar:${character.externalKey}` || definition.type !== CosmeticType.AVATAR) {
      throw new Error(`Conflicting avatar definition for character ${character.id}.`);
    }
  }

  const inserted = await transaction.playerCosmetic.createMany({
    data: possessions.map(({ character }) => ({
      playerId: input.playerId,
      cosmeticId: byCharacter.get(character.id)!.id,
      unlockedAt: input.now,
      unlockSource: 'gacha-first-ownership',
      provenance: { characterId: character.id },
    })),
    skipDuplicates: true,
  });
  if (!inserted.count) return { newlyUnlocked: 0 };

  const deduplicationKey = `appearance:character-avatars:${input.playerId}`;
  const existing = await transaction.notification.findUnique({ where: { deduplicationKey }, select: { id: true, state: true, payload: true } });
  const waiting = existing && (existing.state === NotificationState.UNREAD || existing.state === NotificationState.READ)
    && existing.payload && typeof existing.payload === 'object' && !Array.isArray(existing.payload)
    && typeof existing.payload['count'] === 'number' && Number.isSafeInteger(existing.payload['count']) && existing.payload['count'] > 0
    ? existing.payload['count'] : 0;
  const payload = { count: waiting + inserted.count };
  if (existing) {
    await transaction.notification.update({ where: { id: existing.id }, data: {
      payload, state: NotificationState.UNREAD, readAt: null, archivedAt: null, resolvedAt: null, createdAt: input.now,
    } });
  } else {
    await transaction.notification.create({ data: {
      playerId: input.playerId, domainKey: 'appearance', typeKey: 'CHARACTER_AVATARS_UNLOCKED', payload,
      actionKey: 'OPEN_PROFILE_PERSONALIZATION', deduplicationKey, state: NotificationState.UNREAD, createdAt: input.now,
    } });
  }
  return { newlyUnlocked: inserted.count };
}
