import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/environment.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { PrismaBoxStore } from '../src/infrastructure/database/prisma-box-store.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Box database tests.');
const database = createDatabase(config.databaseUrl);
const playerIds: string[] = [];
const characterIds: string[] = [];

afterAll(async () => {
  if (playerIds.length) await database.player.deleteMany({ where: { id: { in: playerIds } } });
  if (characterIds.length) await database.character.deleteMany({ where: { id: { in: characterIds } } });
  await database.$disconnect();
});

describe('personal Box persistence', () => {
  it('isolates players, hides inactive catalog rows and persists only favorite', async () => {
    const [player, otherPlayer] = await Promise.all([
      database.player.create({ data: { displayName: `Box ${randomUUID().slice(0, 8)}` } }),
      database.player.create({ data: { displayName: `Other ${randomUUID().slice(0, 8)}` } }),
    ]);
    playerIds.push(player.id, otherPlayer.id);
    const suffix = randomUUID();
    const [activeFive, activeFour, inactive] = await Promise.all([
      database.character.create({ data: { externalKey: `test:box:five:${suffix}`, name: 'Box Five', rarity: 5, elementKey: 'hydro', isActive: true, iconPath: '/five.png' } }),
      database.character.create({ data: { externalKey: `test:box:four:${suffix}`, name: 'Box Four', rarity: 4, elementKey: 'dendro', isActive: true } }),
      database.character.create({ data: { externalKey: `test:box:inactive:${suffix}`, name: 'Box Hidden', rarity: 5, elementKey: 'pyro', isActive: false } }),
    ]);
    characterIds.push(activeFive.id, activeFour.id, inactive.id);
    const obtainedAt = new Date('2026-08-01T09:15:00.000Z');
    await database.playerCharacter.createMany({ data: [
      { playerId: player.id, characterId: activeFive.id, constellation: 6, copies: 20, firstObtainedAt: obtainedAt, favorite: true },
      { playerId: player.id, characterId: inactive.id, constellation: 1, copies: 2, firstObtainedAt: obtainedAt, favorite: true },
      { playerId: otherPlayer.id, characterId: activeFour.id, constellation: 2, copies: 3, firstObtainedAt: obtainedAt, favorite: false },
    ] });
    await database.c6CompetitionProgress.create({ data: { playerId: player.id, characterId: activeFive.id, unlockedAt: obtainedAt } });

    const store = new PrismaBoxStore(database);
    const box = await store.listVisiblePossessions(player.id);
    expect(box).toEqual([expect.objectContaining({ id: activeFive.id, name: 'Box Five', rarity: 5, elementKey: 'hydro', iconPath: '/five.png', constellation: 6, copies: 20, firstObtainedAt: obtainedAt, favorite: true, c6CompetitionStats: { strength: 1, intelligence: 1, beauty: 1, charisma: 1, popularity: 1, max: 20 } })]);
    expect(box.some(({ id }) => id === inactive.id || id === activeFour.id)).toBe(false);
    expect(await store.listVisiblePossessions(otherPlayer.id)).toEqual([expect.objectContaining({ id: activeFour.id })]);

    const before = await database.playerCharacter.findUniqueOrThrow({ where: { playerId_characterId: { playerId: player.id, characterId: activeFive.id } } });
    expect(await store.setFavorite(player.id, activeFive.id, false)).toMatchObject({ favorite: false });
    const after = await database.playerCharacter.findUniqueOrThrow({ where: { playerId_characterId: { playerId: player.id, characterId: activeFive.id } } });
    expect(after).toMatchObject({ favorite: false, constellation: before.constellation, copies: before.copies, firstObtainedAt: before.firstObtainedAt });
    expect(await store.setFavorite(player.id, activeFour.id, true)).toBeNull();
    expect(await store.setFavorite(player.id, inactive.id, false)).toBeNull();
    expect((await database.playerCharacter.findUniqueOrThrow({ where: { playerId_characterId: { playerId: otherPlayer.id, characterId: activeFour.id } } })).favorite).toBe(false);
  });

  it('accepts a 4-star C6 without Concours progress, keeps 5-star C5 empty, and rejects a missing 5-star C6 progression', async () => {
    const [fourPlayer, fiveC5Player, fiveC6Player] = await Promise.all([
      database.player.create({ data: { displayName: `Box Four C6 ${randomUUID().slice(0, 8)}` } }),
      database.player.create({ data: { displayName: `Box Five C5 ${randomUUID().slice(0, 8)}` } }),
      database.player.create({ data: { displayName: `Box Five C6 ${randomUUID().slice(0, 8)}` } }),
    ]);
    playerIds.push(fourPlayer.id, fiveC5Player.id, fiveC6Player.id);
    const suffix = randomUUID();
    const [four, five] = await Promise.all([
      database.character.create({ data: { externalKey: `test:box:four-c6:${suffix}`, name: 'Four C6', rarity: 4, elementKey: 'pyro', isActive: true } }),
      database.character.create({ data: { externalKey: `test:box:five-c6:${suffix}`, name: 'Five C6', rarity: 5, elementKey: 'hydro', isActive: true } }),
    ]);
    characterIds.push(four.id, five.id);
    const obtainedAt = new Date('2026-09-10T12:00:00.000Z');
    await database.playerCharacter.createMany({ data: [
      { playerId: fourPlayer.id, characterId: four.id, constellation: 6, copies: 7, firstObtainedAt: obtainedAt },
      { playerId: fiveC5Player.id, characterId: five.id, constellation: 5, copies: 6, firstObtainedAt: obtainedAt },
      { playerId: fiveC6Player.id, characterId: five.id, constellation: 6, copies: 7, firstObtainedAt: obtainedAt },
    ] });

    const store = new PrismaBoxStore(database);
    await expect(store.listVisiblePossessions(fourPlayer.id)).resolves.toEqual([expect.objectContaining({ id: four.id, rarity: 4, constellation: 6, c6CompetitionStats: null })]);
    await expect(store.listVisiblePossessions(fiveC5Player.id)).resolves.toEqual([expect.objectContaining({ id: five.id, rarity: 5, constellation: 5, c6CompetitionStats: null })]);
    await expect(store.listVisiblePossessions(fiveC6Player.id)).rejects.toThrow(`C6 competition progression missing for possession ${fiveC6Player.id}/${five.id}.`);
  });
});
