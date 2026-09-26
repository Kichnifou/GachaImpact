import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { AppearanceService, effectiveAvatar } from '../src/application/appearance/appearance-service.js';
import { unlockCharacterAvatars } from '../src/application/appearance/character-avatar-unlocks.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';

const fixture = isolatedBatchDatabase();
const { database } = fixture;
const now = new Date('2026-09-26T12:00:00.000Z');
let emptyPlayer: string, onePlayer: string, twentyPlayer: string;
const characterIds: string[] = [];

beforeAll(async () => {
  await fixture.setup();
  await database.element.create({ data: { key: 'hydro', displayName: 'Hydro', displayOrder: 1 } });
  emptyPlayer = (await database.player.create({ data: { displayName: 'No character', elementKey: 'hydro' } })).id;
  onePlayer = (await database.player.create({ data: { displayName: 'One character', elementKey: 'hydro' } })).id;
  twentyPlayer = (await database.player.create({ data: { displayName: 'Twenty characters', elementKey: 'hydro' } })).id;
  for (let index = 0; index < 22; index += 1) {
    const character = await database.character.create({ data: {
      externalKey: `appearance-fixture-${index}`, name: `Character ${String(index).padStart(2, '0')}`,
      rarity: index % 2 ? 5 : 4, elementKey: 'hydro', iconPath: index === 0 ? '/assets/genshin/characters/first.png' : null,
    } });
    characterIds.push(character.id);
  }
  await database.playerCharacter.create({ data: { playerId: onePlayer, characterId: characterIds[0]!, firstObtainedAt: now } });
  await database.playerCharacter.createMany({ data: characterIds.slice(1, 21).map(characterId => ({ playerId: twentyPlayer, characterId, firstObtainedAt: now })) });

  // Prisma's current schema generated the additive column already. Restore
  // its 047 shape, then execute the actual 048 SQL in this private schema.
  await fixture.admin.query('ALTER TABLE cosmetic_definitions DROP COLUMN source_character_id CASCADE');
  await fixture.installMigrationOnlySql(new URL('../prisma/migrations/20260926130000_048_unlock_owned_character_avatars/migration.sql', import.meta.url));
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);

describe('Owned character avatars and migration 048', () => {
  it('backfills only owned 4★/5★ characters and one notification per eligible Player', async () => {
    expect(await database.cosmeticDefinition.count()).toBe(21);
    expect(await database.cosmeticDefinition.findFirst({ where: { sourceCharacterId: characterIds[21] } })).toBeNull();
    expect(await database.playerCosmetic.count({ where: { playerId: emptyPlayer } })).toBe(0);
    expect(await database.playerCosmetic.count({ where: { playerId: onePlayer } })).toBe(1);
    expect(await database.playerCosmetic.count({ where: { playerId: twentyPlayer } })).toBe(20);
    const notifications = await database.notification.findMany({ where: { typeKey: 'CHARACTER_AVATARS_UNLOCKED' }, orderBy: { playerId: 'asc' } });
    expect(notifications).toHaveLength(2);
    expect(notifications.map(row => ({ playerId: row.playerId, payload: row.payload }))).toEqual([
      { playerId: onePlayer, payload: { count: 1 } }, { playerId: twentyPlayer, payload: { count: 20 } },
    ].sort((a, b) => a.playerId.localeCompare(b.playerId)));
    expect((await database.playerCosmetic.findFirstOrThrow({ where: { playerId: onePlayer } })).unlockSource).toBe('character-possession-backfill-048');

    const store = { findByIdentity: async (_provider: string, subject: string) => {
      const player = await database.player.findUnique({ where: { id: subject } });
      return player ? { id: player.id, displayName: player.displayName, status: player.status, elementKey: player.elementKey } : null;
    }, provision: async () => { throw Error('No provisioning in fixture.'); } };
    const service = new AppearanceService(database, new GetCurrentPlayer(store));
    const identity = (subject: string) => ({ provider: 'supabase' as const, subject });
    expect((await service.get(identity(emptyPlayer))).catalog.filter(item => item.sourceCharacterId)).toHaveLength(0);
    expect((await service.get(identity(onePlayer))).catalog.filter(item => item.sourceCharacterId)).toHaveLength(1);
    expect((await service.get(identity(twentyPlayer))).catalog.filter(item => item.sourceCharacterId)).toHaveLength(20);
    expect((await service.get(identity(onePlayer))).catalog.some(item => item.sourceCharacterId === characterIds[21])).toBe(false);
  });

  it('resolves the current icon and falls back to element when an icon is missing or invalid', async () => {
    const cosmetic = await database.cosmeticDefinition.findFirstOrThrow({ where: { sourceCharacterId: characterIds[0] } });
    await database.player.update({ where: { id: onePlayer }, data: { equippedAvatarCosmeticId: cosmetic.id } });
    const player = async () => database.player.findUniqueOrThrow({ where: { id: onePlayer }, select: { displayName: true, elementKey: true, equippedAvatarCosmetic: { select: { id: true, type: true, isActive: true, assetPath: true, sourceCharacterId: true, sourceCharacter: { select: { iconPath: true } } } } } });
    expect(effectiveAvatar(await player())).toEqual({ kind: 'CUSTOM', assetPath: '/assets/genshin/characters/first.png' });
    await database.character.update({ where: { id: characterIds[0] }, data: { iconPath: '/assets/genshin/characters/updated.png' } });
    expect(effectiveAvatar(await player())).toEqual({ kind: 'CUSTOM', assetPath: '/assets/genshin/characters/updated.png' });
    await database.character.update({ where: { id: characterIds[0] }, data: { iconPath: null } });
    expect(effectiveAvatar(await player()).kind).toBe('ELEMENT');
    expect(cosmetic.assetPath).toBeNull();
  });

  it('aggregates live unlocks across calls, replays nothing, and resets after archive', async () => {
    const addPossessions = async (start: number, count: number) => {
      const ids: string[] = [];
      for (let index = start; index < start + count; index += 1) {
        const character = await database.character.create({ data: { externalKey: `live-avatar-${index}`, name: `Live ${index}`, rarity: index % 2 ? 5 : 4, elementKey: 'hydro' } });
        await database.playerCharacter.create({ data: { playerId: emptyPlayer, characterId: character.id, firstObtainedAt: now } });
        ids.push(character.id);
      }
      return ids;
    };
    const first = await addPossessions(0, 2);
    const second = await addPossessions(2, 3);
    const unlock = (ids: string[]) => database.$transaction(tx => unlockCharacterAvatars(tx, { playerId: emptyPlayer, characterIds: ids, now }));
    expect(await unlock(first)).toEqual({ newlyUnlocked: 2 });
    const key = `appearance:character-avatars:${emptyPlayer}`;
    await database.notification.update({ where: { deduplicationKey: key }, data: { state: 'READ', readAt: now } });
    expect(await unlock(second)).toEqual({ newlyUnlocked: 3 });
    expect(await unlock(first)).toEqual({ newlyUnlocked: 0 });
    expect((await database.notification.findUniqueOrThrow({ where: { deduplicationKey: key } })).payload).toEqual({ count: 5 });
    expect((await database.notification.findUniqueOrThrow({ where: { deduplicationKey: key } })).state).toBe('UNREAD');
    expect(await database.notification.count({ where: { playerId: emptyPlayer, typeKey: 'CHARACTER_AVATARS_UNLOCKED' } })).toBe(1);
    await database.notification.update({ where: { deduplicationKey: key }, data: { state: 'ARCHIVED', archivedAt: now } });
    const afterArchive = await addPossessions(5, 1);
    expect(await unlock(afterArchive)).toEqual({ newlyUnlocked: 1 });
    expect(await database.notification.findUniqueOrThrow({ where: { deduplicationKey: key } })).toMatchObject({ payload: { count: 1 }, state: 'UNREAD', archivedAt: null });
    await database.notification.update({ where: { deduplicationKey: key }, data: { state: 'RESOLVED', resolvedAt: now } });
    const afterResolution = await addPossessions(6, 1);
    expect(await unlock(afterResolution)).toEqual({ newlyUnlocked: 1 });
    expect(await database.notification.findUniqueOrThrow({ where: { deduplicationKey: key } })).toMatchObject({ payload: { count: 1 }, state: 'UNREAD', resolvedAt: null });
  });

  it('rolls back possession, avatar and notification together', async () => {
    const character = await database.character.create({ data: { externalKey: 'rollback-avatar', name: 'Rollback', rarity: 4, elementKey: 'hydro' } });
    await expect(database.$transaction(async tx => {
      await tx.playerCharacter.create({ data: { playerId: emptyPlayer, characterId: character.id, firstObtainedAt: now } });
      await unlockCharacterAvatars(tx, { playerId: emptyPlayer, characterIds: [character.id], now });
      throw new Error('rollback probe');
    })).rejects.toThrow('rollback probe');
    expect(await database.playerCharacter.findUnique({ where: { playerId_characterId: { playerId: emptyPlayer, characterId: character.id } } })).toBeNull();
    expect(await database.cosmeticDefinition.findFirst({ where: { sourceCharacterId: character.id } })).toBeNull();
    expect(await database.playerCosmetic.count({ where: { playerId: emptyPlayer } })).toBe(7);
    expect((await database.notification.findUniqueOrThrow({ where: { deduplicationKey: `appearance:character-avatars:${emptyPlayer}` } })).payload).toEqual({ count: 1 });
  });

  it('hides a character avatar when its underlying Box possession is removed', async () => {
    const cosmetic = await database.cosmeticDefinition.findFirstOrThrow({ where: { sourceCharacterId: characterIds[0] } });
    await database.playerCharacter.delete({ where: { playerId_characterId: { playerId: onePlayer, characterId: characterIds[0]! } } });
    const store = { findByIdentity: async (_provider: string, subject: string) => {
      const player = await database.player.findUnique({ where: { id: subject } });
      return player ? { id: player.id, displayName: player.displayName, status: player.status, elementKey: player.elementKey } : null;
    }, provision: async () => { throw Error('No provisioning in fixture.'); } };
    const service = new AppearanceService(database, new GetCurrentPlayer(store));
    const identity = { provider: 'supabase' as const, subject: onePlayer };
    expect((await service.get(identity)).catalog.filter(item => item.sourceCharacterId)).toHaveLength(0);
    await expect(service.equip(identity, 'AVATAR', cosmetic.id)).rejects.toMatchObject({ statusCode: 403 });
  });
});
