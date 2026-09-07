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

    const store = new PrismaBoxStore(database);
    const box = await store.listVisiblePossessions(player.id);
    expect(box).toEqual([expect.objectContaining({ id: activeFive.id, name: 'Box Five', rarity: 5, elementKey: 'hydro', iconPath: '/five.png', constellation: 6, copies: 20, firstObtainedAt: obtainedAt, favorite: true })]);
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
});
