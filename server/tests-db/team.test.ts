import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/environment.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { PrismaTeamStore } from '../src/infrastructure/database/prisma-team-store.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Team database tests.');
const database = createDatabase(config.databaseUrl);
const playerIds = new Set<string>();
const characterIds = new Set<string>();
let activeCharacterIds: string[] = [];
let inactiveCharacterId = '';

beforeAll(async () => {
  const suffix = randomUUID();
  const records = await Promise.all([
    createCharacter(`hydro-a:${suffix}`, 'Team Hydro A', 'hydro', 5),
    createCharacter(`hydro-b:${suffix}`, 'Team Hydro B', 'hydro', 4),
    createCharacter(`pyro:${suffix}`, 'Team Pyro', 'pyro', 5),
    createCharacter(`electro:${suffix}`, 'Team Electro', 'electro', 4),
    createCharacter(`dendro:${suffix}`, 'Team Dendro', 'dendro', 4),
    createCharacter(`inactive:${suffix}`, 'Team Inactive', 'cryo', 5, false),
  ]);
  activeCharacterIds = records.slice(0, 5).map(({ id }) => id);
  inactiveCharacterId = records[5]!.id;
  records.forEach(({ id }) => characterIds.add(id));
});

afterEach(cleanupPlayers);
afterAll(async () => {
  await cleanupPlayers();
  await database.character.deleteMany({ where: { id: { in: [...characterIds] } } });
  await database.$disconnect();
});

describe('authoritative Team persistence', () => {
  it('lazily provisions exactly ten base Teams with Team 1 as the sole active Team', async () => {
    const player = await createPlayer('Provision');
    expect(await database.team.count({ where: { playerId: player.id } })).toBe(0);

    const store = new PrismaTeamStore(database);
    const first = await store.getOrProvision(player.id);
    const retry = await store.getOrProvision(player.id);

    expect(first.teams).toHaveLength(10);
    expect(first.teams.map(({ position }) => position)).toEqual([1,2,3,4,5,6,7,8,9,10]);
    expect(first.teams[0]).toMatchObject({ position: 1, active: true, slots: [{ position: 1, character: null }, { position: 2, character: null }, { position: 3, character: null }, { position: 4, character: null }] });
    expect(first.teams.slice(1).every(({ active }) => !active)).toBe(true);
    expect(first.teams.every(({ slots }) => slots.length === 4)).toBe(true);
    expect(retry.teams.map(({ id }) => id)).toEqual(first.teams.map(({ id }) => id));
    expect(await database.team.count({ where: { playerId: player.id } })).toBe(10);
  });

  it('supports empty activation, owned active additions, direct replacement, removal, clearing and ordered partial slots', async () => {
    const player = await createPlayer('Mutations');
    await possess(player.id, [...activeCharacterIds, inactiveCharacterId]);
    const store = new PrismaTeamStore(database);
    const initial = await store.getOrProvision(player.id);
    const team1 = initial.teams[0]!;
    const team2 = initial.teams[1]!;

    const activated = await store.activate(player.id, team2.id);
    expect(activated.teams.find(({ active }) => active)).toMatchObject({ id: team2.id, slots: expect.any(Array) });
    expect(activated.teams.filter(({ active }) => active)).toHaveLength(1);

    await expect(store.setSlot(player.id, team1.id, 1, randomUUID())).rejects.toMatchObject({ code: 'TEAM_CHARACTER_NOT_AVAILABLE' });
    await expect(store.setSlot(player.id, team1.id, 1, inactiveCharacterId)).rejects.toMatchObject({ code: 'TEAM_CHARACTER_NOT_AVAILABLE' });

    await store.setSlot(player.id, team1.id, 4, activeCharacterIds[0]!);
    const partial = await store.setSlot(player.id, team1.id, 2, activeCharacterIds[2]!);
    expect(partial.teams[0]!.slots.map(({ position, character }) => [position, character?.id ?? null])).toEqual([
      [1, null], [2, activeCharacterIds[2]], [3, null], [4, activeCharacterIds[0]],
    ]);
    await expect(store.setSlot(player.id, team1.id, 3, activeCharacterIds[0]!)).rejects.toMatchObject({ code: 'TEAM_CHARACTER_DUPLICATE' });

    const replaced = await store.setSlot(player.id, team1.id, 2, activeCharacterIds[1]!);
    expect(replaced.teams[0]!.slots[1]!.character?.id).toBe(activeCharacterIds[1]);
    const removed = await store.removeSlot(player.id, team1.id, 4);
    expect(removed.teams[0]!.slots[3]!.character).toBeNull();

    await store.activate(player.id, team1.id);
    const cleared = await store.clear(player.id, team1.id);
    expect(cleared.teams[0]).toMatchObject({ active: true });
    expect(cleared.teams[0]!.slots.every(({ character }) => character === null)).toBe(true);
  });

  it('isolates players, hides inactive memberships and derives exact capped multi-element passives', async () => {
    const [player, other] = await Promise.all([createPlayer('Isolation A'), createPlayer('Isolation B')]);
    await possess(player.id, [...activeCharacterIds, inactiveCharacterId]);
    await possess(other.id, [activeCharacterIds[4]!]);
    const store = new PrismaTeamStore(database);
    const playerTeams = await store.getOrProvision(player.id);
    const otherTeams = await store.getOrProvision(other.id);
    const team = playerTeams.teams[0]!;

    await store.setSlot(player.id, team.id, 1, activeCharacterIds[0]!);
    await store.setSlot(player.id, team.id, 2, activeCharacterIds[1]!);
    await store.setSlot(player.id, team.id, 3, activeCharacterIds[2]!);
    const withPassives = await store.setSlot(player.id, team.id, 4, activeCharacterIds[3]!);
    expect(withPassives.teams[0]!.passives.map(({ elementKey, stacks }) => [elementKey, stacks]))
      .toEqual([['pyro', 1], ['hydro', 2], ['electro', 1]]);
    expect(withPassives.teams[0]!.passives.find(({ elementKey }) => elementKey === 'hydro')?.description)
      .toContain('0,6');

    await expect(store.activate(other.id, team.id)).rejects.toMatchObject({ code: 'TEAM_NOT_FOUND' });
    expect((await store.getOrProvision(other.id)).teams.map(({ id }) => id)).toEqual(otherTeams.teams.map(({ id }) => id));
    expect((await store.getOrProvision(other.id)).teams.every(({ slots }) => slots.every(({ character }) => character === null))).toBe(true);

    await database.teamMember.update({ where: { teamId_position: { teamId: team.id, position: 4 } }, data: { characterId: inactiveCharacterId } });
    const hidden = await store.getOrProvision(player.id);
    expect(hidden.teams[0]!.slots[3]!.character).toBeNull();
    expect(hidden.availableCharacters.some(({ id }) => id === inactiveCharacterId)).toBe(false);
    expect(hidden.teams[0]!.passives.some(({ elementKey }) => elementKey === 'cryo')).toBe(false);
    expect(await database.teamMember.findUnique({ where: { teamId_position: { teamId: team.id, position: 4 } } })).toBeNull();

    await database.character.update({ where: { id: inactiveCharacterId }, data: { isActive: true } });
    expect((await store.getOrProvision(player.id)).teams[0]!.slots[3]!.character).toBeNull();
    await database.character.update({ where: { id: inactiveCharacterId }, data: { isActive: false } });
  });

  it('serializes concurrent activation and composition changes without multiple active Teams', async () => {
    const player = await createPlayer('Concurrency');
    await possess(player.id, activeCharacterIds.slice(0, 2));
    const store = new PrismaTeamStore(database);
    const initial = await store.getOrProvision(player.id);
    const [team1, team2, team3] = initial.teams;

    const activationResults = await Promise.all([
      store.activate(player.id, team2!.id),
      store.activate(player.id, team3!.id),
    ]);
    expect(activationResults).toHaveLength(2);
    expect(await database.team.count({ where: { playerId: player.id, isActive: true } })).toBe(1);

    await Promise.all([
      store.setSlot(player.id, team1!.id, 1, activeCharacterIds[0]!),
      store.setSlot(player.id, team1!.id, 2, activeCharacterIds[1]!),
    ]);
    const final = await store.getOrProvision(player.id);
    expect(final.teams[0]!.slots.slice(0, 2).map(({ character }) => character?.id)).toEqual(activeCharacterIds.slice(0, 2));
  }, 20_000);
});

async function createCharacter(externalKey: string, name: string, elementKey: string, rarity: 4 | 5, isActive = true) {
  return database.character.create({ data: { externalKey: `test:team:${externalKey}`, name, elementKey, rarity, isActive, classKey: 'test', iconPath: `/${externalKey}.png` } });
}

async function createPlayer(label: string) {
  const player = await database.player.create({ data: { displayName: `${label} ${randomUUID().slice(0, 8)}` } });
  playerIds.add(player.id);
  return player;
}

async function possess(playerId: string, ids: readonly string[]) {
  await database.playerCharacter.createMany({ data: ids.map((characterId, index) => ({ playerId, characterId, constellation: index % 7, copies: index + 1, firstObtainedAt: new Date('2026-09-08T12:00:00.000Z') })) });
}

async function cleanupPlayers() {
  if (playerIds.size === 0) return;
  await database.player.deleteMany({ where: { id: { in: [...playerIds] } } });
  playerIds.clear();
}
