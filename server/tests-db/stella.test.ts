import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/environment.js';
import { MASTERLESS_STELLA_FORTUNA_KEY } from '../src/application/box/box-store.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { PrismaBoxStore } from '../src/infrastructure/database/prisma-box-store.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Stella database tests.');
const database = createDatabase(config.databaseUrl);
const players = new Set<string>();
const characters = new Set<string>();
const now = new Date('2026-09-07T18:00:00.000Z');
const firstObtainedAt = new Date('2026-05-03T10:00:00.000Z');
const random = { nextInt: () => 0 };

afterEach(cleanup);
afterAll(async () => { await cleanup(); await database.$disconnect(); });

describe('Box preferences and Masterless Stella Fortuna on the development database', () => {
  it('uses the safe default, persists every canonical sort and isolates preferences by Player', async () => {
    const first = await createPlayer();
    const second = await createPlayer();
    const store = new PrismaBoxStore(database);
    expect(await store.getSortPreference(first.id)).toEqual({ sortKey: 'alphabetical', direction: 'asc' });
    for (const sortKey of ['alphabetical', 'obtainedAt', 'constellation', 'element'] as const) {
      expect(await store.setSortPreference(first.id, { sortKey, direction: 'desc' })).toEqual({ sortKey, direction: 'desc' });
      expect(await store.getSortPreference(first.id)).toEqual({ sortKey, direction: 'desc' });
    }
    expect(await store.getSortPreference(second.id)).toEqual({ sortKey: 'alphabetical', direction: 'asc' });
    expect(await database.playerPreference.count({ where: { playerId: first.id } })).toBe(1);
  });

  it('defines Stella once, treats missing balances as zero, and refuses invalid targets without consumption', async () => {
    const player = await createPlayer();
    const store = new PrismaBoxStore(database);
    const definition = await database.itemDefinition.findUniqueOrThrow({ where: { externalKey: MASTERLESS_STELLA_FORTUNA_KEY } });
    expect(definition).toMatchObject({ displayName: 'Masterless Stella Fortuna', category: 'SPECIAL', isActive: true });
    expect(await store.getStellaQuantity(player.id)).toBe(0n);
    const five = await createCharacter(5, true);
    await expect(use(store, player.id, five.id)).rejects.toMatchObject({ code: 'STELLA_UNAVAILABLE' });

    await credit(player.id, 3n);
    await expect(use(store, player.id, five.id)).rejects.toMatchObject({ code: 'BOX_CHARACTER_NOT_OWNED' });
    const four = await createCharacter(4, true);
    const inactive = await createCharacter(5, false);
    await possess(player.id, four.id, 0, 1);
    await possess(player.id, inactive.id, 0, 1);
    await expect(use(store, player.id, four.id)).rejects.toMatchObject({ code: 'STELLA_CHARACTER_RARITY_INVALID' });
    await expect(use(store, player.id, inactive.id)).rejects.toMatchObject({ code: 'STELLA_CHARACTER_INACTIVE' });
    expect(await store.getStellaQuantity(player.id)).toBe(3n);
    expect(await database.businessOperation.count({ where: { playerId: player.id } })).toBe(0);
  });

  it('advances C0 to C1 while preserving first obtain and favorite, then initializes the shared C6 state on C5 to C6', async () => {
    const player = await createPlayer();
    const [c0, c5] = await Promise.all([createCharacter(5, true), createCharacter(5, true)]);
    await credit(player.id, 2n);
    await possess(player.id, c0.id, 0, 1, true);
    await possess(player.id, c5.id, 5, 6, false);
    const store = new PrismaBoxStore(database);

    const first = await use(store, player.id, c0.id);
    expect(first).toMatchObject({ character: { constellation: 1, copies: 2, favorite: true, firstObtainedAt }, stellaRemaining: 1n, c6Progression: null });
    const reachingC6 = await use(store, player.id, c5.id);
    expect(reachingC6).toMatchObject({ character: { constellation: 6, copies: 7, favorite: false, firstObtainedAt }, stellaRemaining: 0n, c6Progression: { type: 'unlocked' } });
    expect(await database.c6CompetitionProgress.findUnique({ where: { playerId_characterId: { playerId: player.id, characterId: c5.id } } })).toMatchObject({ strength: 1, intelligence: 1, beauty: 1, charisma: 1, popularity: 1 });
  });

  it('progresses an eligible C6 without Gacha refunds and refuses a fully maxed C6 atomically', async () => {
    const player = await createPlayer();
    const [eligible, maxed] = await Promise.all([createCharacter(5, true), createCharacter(5, true)]);
    await credit(player.id, 2n);
    await possess(player.id, eligible.id, 6, 7);
    await possess(player.id, maxed.id, 6, 12);
    await createC6(player.id, eligible.id, 1);
    await createC6(player.id, maxed.id, 20);
    const store = new PrismaBoxStore(database);

    const result = await use(store, player.id, eligible.id);
    expect(result).toMatchObject({ character: { constellation: 6, copies: 8 }, stellaRemaining: 1n, c6Progression: { type: 'stat', stat: 'strength', valueAfter: 2 } });
    await expect(use(store, player.id, maxed.id)).rejects.toMatchObject({ code: 'STELLA_C6_MAXED' });
    expect(await database.playerCharacter.findUniqueOrThrow({ where: { playerId_characterId: { playerId: player.id, characterId: maxed.id } } })).toMatchObject({ copies: 12, constellation: 6 });
    expect(await store.getStellaQuantity(player.id)).toBe(1n);
    expect(await database.resourceMovement.count({ where: { playerId: player.id } })).toBe(0);
    expect(await database.playerResourceBalance.count({ where: { playerId: player.id } })).toBe(0);
  });

  it('is idempotent, isolated, and allows only one concurrent success for one Stella', async () => {
    const player = await createPlayer();
    const other = await createPlayer();
    const target = await createCharacter(5, true);
    await credit(player.id, 2n);
    await possess(player.id, target.id, 0, 1);
    await possess(other.id, target.id, 0, 1);
    const store = new PrismaBoxStore(database);
    const key = randomUUID();
    const first = await store.useStella({ playerId: player.id, characterId: target.id, idempotencyKey: key, now, random });
    const retry = await store.useStella({ playerId: player.id, characterId: target.id, idempotencyKey: key, now, random: { nextInt: () => { throw new Error('must not reroll'); } } });
    expect(retry.operation).toEqual({ id: first.operation.id, alreadyProcessed: true });
    expect(retry.stellaRemaining).toBe(1n);
    expect((await database.playerCharacter.findUniqueOrThrow({ where: { playerId_characterId: { playerId: player.id, characterId: target.id } } })).copies).toBe(2);
    expect(await store.getStellaQuantity(other.id)).toBe(0n);

    const outcomes = await Promise.allSettled([use(store, player.id, target.id), use(store, player.id, target.id)]);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(await store.getStellaQuantity(player.id)).toBe(0n);
    expect((await database.playerCharacter.findUniqueOrThrow({ where: { playerId_characterId: { playerId: player.id, characterId: target.id } } })).copies).toBe(3);
  }, 20_000);

  it('rolls back progression, possession, item and operation when C6 resolution fails', async () => {
    const player = await createPlayer();
    const target = await createCharacter(5, true);
    await credit(player.id, 1n);
    await possess(player.id, target.id, 6, 7, true);
    await createC6(player.id, target.id, 1);
    const store = new PrismaBoxStore(database);
    await expect(store.useStella({ playerId: player.id, characterId: target.id, idempotencyKey: randomUUID(), now, random: { nextInt: () => { throw new Error('forced rollback'); } } })).rejects.toThrow('forced rollback');
    expect(await store.getStellaQuantity(player.id)).toBe(1n);
    expect(await database.playerCharacter.findUniqueOrThrow({ where: { playerId_characterId: { playerId: player.id, characterId: target.id } } })).toMatchObject({ copies: 7, constellation: 6, favorite: true, firstObtainedAt });
    expect(await database.c6CompetitionProgress.findUniqueOrThrow({ where: { playerId_characterId: { playerId: player.id, characterId: target.id } } })).toMatchObject({ strength: 1, intelligence: 1, beauty: 1, charisma: 1, popularity: 1 });
    expect(await database.businessOperation.count({ where: { playerId: player.id } })).toBe(0);
  });
});

async function createPlayer() {
  const player = await database.player.create({ data: { displayName: `Stella ${randomUUID().slice(0, 8)}` } });
  players.add(player.id);
  return player;
}

async function createCharacter(rarity: 4 | 5, isActive: boolean) {
  const suffix = randomUUID();
  const character = await database.character.create({ data: { externalKey: `test:stella:${suffix}`, name: `Stella ${suffix.slice(0, 6)}`, rarity, elementKey: 'hydro', isActive } });
  characters.add(character.id);
  return character;
}

async function credit(playerId: string, quantity: bigint) {
  const item = await database.itemDefinition.findUniqueOrThrow({ where: { externalKey: MASTERLESS_STELLA_FORTUNA_KEY } });
  return database.playerItem.create({ data: { playerId, itemId: item.id, quantity, firstObtainedAt: now } });
}

async function possess(playerId: string, characterId: string, constellation: number, copies: number, favorite = false) {
  return database.playerCharacter.create({ data: { playerId, characterId, constellation, copies, favorite, firstObtainedAt } });
}

async function createC6(playerId: string, characterId: string, value: number) {
  return database.c6CompetitionProgress.create({ data: { playerId, characterId, unlockedAt: now, strength: value, intelligence: value, beauty: value, charisma: value, popularity: value } });
}

function use(store: PrismaBoxStore, playerId: string, characterId: string) {
  return store.useStella({ playerId, characterId, idempotencyKey: randomUUID(), now, random });
}

async function cleanup() {
  if (players.size) {
    await database.businessOperation.deleteMany({ where: { playerId: { in: [...players] }, operationType: 'box.stella.use' } });
    await database.player.deleteMany({ where: { id: { in: [...players] } } });
  }
  if (characters.size) await database.character.deleteMany({ where: { id: { in: [...characters] } } });
  players.clear();
  characters.clear();
}
