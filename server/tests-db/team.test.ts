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

afterEach(async () => {
  await database.character.updateMany({ where: { id: { in: activeCharacterIds } }, data: { isActive: true } });
  await database.character.update({ where: { id: inactiveCharacterId }, data: { isActive: false } });
  await cleanupPlayers();
});
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

  it('renames, creates sequentially with retry safety, and keeps new Teams inactive', async () => {
    const player = await createPlayer('Management');
    const store = new PrismaTeamStore(database);
    const initial = await store.getOrProvision(player.id);
    const team1 = initial.teams[0]!;

    const renamed = await store.rename(player.id, team1.id, 'Équipe des étoiles');
    expect(renamed.teams[0]!.name).toBe('Équipe des étoiles');
    expect((await store.rename(player.id, team1.id, null)).teams[0]!.name).toBeNull();

    const eleven = await store.createNext(player.id, 11);
    const retry = await store.createNext(player.id, 11);
    expect(eleven.teams).toHaveLength(11);
    expect(retry.teams).toHaveLength(11);
    expect(retry.teams[10]).toMatchObject({ id: eleven.teams[10]!.id, position: 11, active: false });
    await expect(store.createNext(player.id, 13)).rejects.toMatchObject({ code: 'TEAM_CREATE_POSITION_INVALID' });
    const twelve = await store.createNext(player.id, 12);
    expect(twelve.teams).toHaveLength(12);
    expect(twelve.teams.filter(({ active }) => active)).toHaveLength(1);
    expect(twelve.teams.find(({ active }) => active)?.id).toBe(team1.id);
  });

  it('deletes only inactive positions above ten and compacts positions without changing identities', async () => {
    const player = await createPlayer('Delete');
    const store = new PrismaTeamStore(database);
    let state = await store.getOrProvision(player.id);
    state = await store.createNext(player.id, 11);
    state = await store.createNext(player.id, 12);
    state = await store.createNext(player.id, 13);
    const [base, extra11, extra12, extra13] = [state.teams[0]!, state.teams[10]!, state.teams[11]!, state.teams[12]!];

    await expect(store.deleteExtra(player.id, base.id)).rejects.toMatchObject({ code: 'TEAM_DELETE_PROTECTED' });
    await store.activate(player.id, extra13.id);
    await expect(store.deleteExtra(player.id, extra13.id)).rejects.toMatchObject({ code: 'TEAM_DELETE_ACTIVE' });
    const compacted = await store.deleteExtra(player.id, extra12.id);
    expect(compacted.teams).toHaveLength(12);
    expect(compacted.teams[10]).toMatchObject({ id: extra11.id, position: 11 });
    expect(compacted.teams[11]).toMatchObject({ id: extra13.id, position: 12, active: true });
  });

  it('persists complete Team and slot orders while preserving the active Team identity', async () => {
    const player = await createPlayer('Reorder');
    await possess(player.id, activeCharacterIds.slice(0, 3));
    const store = new PrismaTeamStore(database);
    let state = await store.getOrProvision(player.id);
    state = await store.createNext(player.id, 11);
    const active = state.teams[0]!;
    const moved = state.teams[10]!;
    await store.setSlot(player.id, active.id, 1, activeCharacterIds[0]!);
    await store.setSlot(player.id, active.id, 2, activeCharacterIds[1]!);
    const slots = await store.reorderSlots(player.id, active.id, [activeCharacterIds[1]!, null, activeCharacterIds[0]!, null]);
    expect(slots.teams.find(({ id }) => id === active.id)!.slots.map(({ character }) => character?.id ?? null))
      .toEqual([activeCharacterIds[1], null, activeCharacterIds[0], null]);
    await expect(store.reorderSlots(player.id, active.id, [activeCharacterIds[1]!, null, null, null]))
      .rejects.toMatchObject({ code: 'TEAM_SLOT_ORDER_INVALID' });

    const insertionOrder = [moved.id, ...state.teams.slice(0, 10).map(({ id }) => id)];
    const reordered = await store.reorderTeams(player.id, insertionOrder);
    expect(reordered.teams[0]).toMatchObject({ id: moved.id, position: 1, active: false });
    expect(reordered.teams[1]).toMatchObject({ id: active.id, position: 2, active: true });
    await expect(store.deleteExtra(player.id, moved.id)).rejects.toMatchObject({ code: 'TEAM_DELETE_PROTECTED' });
    expect((await database.team.findUnique({ where: { id: active.id } }))?.isActive).toBe(true);
    await expect(store.reorderTeams(player.id, insertionOrder.slice(1))).rejects.toMatchObject({ code: 'TEAM_ORDER_INVALID' });
    await expect(store.reorderTeams(player.id, [...insertionOrder.slice(0, -1), insertionOrder[0]!])).rejects.toMatchObject({ code: 'TEAM_ORDER_INVALID' });
    await expect(store.reorderTeams(player.id, [...insertionOrder.slice(0, -1), randomUUID()])).rejects.toMatchObject({ code: 'TEAM_ORDER_INVALID' });
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

  it('removes only disabled-character slots from the active Team', async () => {
    const player = await createPlayer('Disabled active');
    await possess(player.id, activeCharacterIds.slice(0, 4));
    const store = new PrismaTeamStore(database);
    const team = (await store.getOrProvision(player.id)).teams[0]!;
    await fillTeam(store, player.id, team.id, activeCharacterIds.slice(0, 4));

    await setCharacterActive(activeCharacterIds[1]!, false);
    const cleaned = await store.getOrProvision(player.id);
    const active = cleaned.teams.find(({ id }) => id === team.id)!;

    expect(active.active).toBe(true);
    expect(active.slots.map(({ character }) => character?.id ?? null)).toEqual([
      activeCharacterIds[0], null, activeCharacterIds[2], activeCharacterIds[3],
    ]);
  }, 20_000);

  it('clears the whole composition of a non-active Team in current positions 1..10', async () => {
    const player = await createPlayer('Disabled base');
    await possess(player.id, activeCharacterIds.slice(0, 4));
    const store = new PrismaTeamStore(database);
    const team = (await store.getOrProvision(player.id)).teams[4]!;
    await store.rename(player.id, team.id, 'Équipe préservée');
    await fillTeam(store, player.id, team.id, activeCharacterIds.slice(0, 4));

    await setCharacterActive(activeCharacterIds[1]!, false);
    const cleaned = await store.getOrProvision(player.id);
    const base = cleaned.teams.find(({ id }) => id === team.id)!;

    expect(base).toMatchObject({ position: 5, name: 'Équipe préservée', active: false });
    expect(base.slots.every(({ character }) => character === null)).toBe(true);
  }, 20_000);

  it('deletes an affected non-active extra Team and compacts surviving UUIDs', async () => {
    const player = await createPlayer('Disabled extra');
    await possess(player.id, activeCharacterIds.slice(0, 2));
    const store = new PrismaTeamStore(database);
    let state = await store.getOrProvision(player.id);
    state = await store.createNext(player.id, 11);
    state = await store.createNext(player.id, 12);
    state = await store.createNext(player.id, 13);
    const removed = state.teams[11]!;
    const survivor = state.teams[12]!;
    await fillTeam(store, player.id, removed.id, activeCharacterIds.slice(0, 2));

    await setCharacterActive(activeCharacterIds[1]!, false);
    const cleaned = await store.getOrProvision(player.id);

    expect(cleaned.teams.some(({ id }) => id === removed.id)).toBe(false);
    expect(cleaned.teams.find(({ id }) => id === survivor.id)).toMatchObject({ position: 12, active: false });
    expect(await database.team.findUnique({ where: { id: removed.id } })).toBeNull();
  }, 20_000);

  it('keeps an affected active extra Team and removes only its disabled-character slot', async () => {
    const player = await createPlayer('Disabled active extra');
    await possess(player.id, activeCharacterIds.slice(0, 2));
    const store = new PrismaTeamStore(database);
    let state = await store.getOrProvision(player.id);
    state = await store.createNext(player.id, 11);
    state = await store.createNext(player.id, 12);
    const team = state.teams[11]!;
    await fillTeam(store, player.id, team.id, activeCharacterIds.slice(0, 2));
    await store.activate(player.id, team.id);

    await setCharacterActive(activeCharacterIds[1]!, false);
    const cleaned = await store.getOrProvision(player.id);
    const active = cleaned.teams.find(({ id }) => id === team.id)!;

    expect(active).toMatchObject({ position: 12, active: true });
    expect(active.slots.map(({ character }) => character?.id ?? null)).toEqual([activeCharacterIds[0], null, null, null]);
  }, 20_000);

  it('applies all three disabled-character cleanup branches across multiple Teams at once', async () => {
    const player = await createPlayer('Disabled multi');
    await possess(player.id, activeCharacterIds.slice(0, 2));
    const store = new PrismaTeamStore(database);
    let state = await store.getOrProvision(player.id);
    state = await store.createNext(player.id, 11);
    state = await store.createNext(player.id, 12);
    state = await store.createNext(player.id, 13);
    const active = state.teams[0]!;
    const base = state.teams[4]!;
    const extra = state.teams[11]!;
    const survivor = state.teams[12]!;
    await fillTeam(store, player.id, active.id, activeCharacterIds.slice(0, 2));
    await fillTeam(store, player.id, base.id, activeCharacterIds.slice(0, 2));
    await fillTeam(store, player.id, extra.id, activeCharacterIds.slice(0, 2));

    await setCharacterActive(activeCharacterIds[1]!, false);
    const cleaned = await store.getOrProvision(player.id);

    expect(cleaned.teams.find(({ id }) => id === active.id)!.slots.map(({ character }) => character?.id ?? null))
      .toEqual([activeCharacterIds[0], null, null, null]);
    expect(cleaned.teams.find(({ id }) => id === base.id)!.slots.every(({ character }) => character === null)).toBe(true);
    expect(cleaned.teams.some(({ id }) => id === extra.id)).toBe(false);
    expect(cleaned.teams.find(({ id }) => id === survivor.id)).toMatchObject({ position: 12 });
  }, 20_000);

  it('never restores cleaned slots, cleared base Teams or deleted extra Teams after reactivation', async () => {
    const player = await createPlayer('Disabled reactivation');
    await possess(player.id, activeCharacterIds.slice(0, 2));
    const store = new PrismaTeamStore(database);
    let state = await store.getOrProvision(player.id);
    state = await store.createNext(player.id, 11);
    const active = state.teams[0]!;
    const base = state.teams[4]!;
    const extra = state.teams[10]!;
    await fillTeam(store, player.id, active.id, activeCharacterIds.slice(0, 2));
    await fillTeam(store, player.id, base.id, activeCharacterIds.slice(0, 2));
    await fillTeam(store, player.id, extra.id, activeCharacterIds.slice(0, 2));

    await setCharacterActive(activeCharacterIds[1]!, false);
    await store.getOrProvision(player.id);
    await setCharacterActive(activeCharacterIds[1]!, true);
    const reactivated = await store.getOrProvision(player.id);

    expect(reactivated.teams.find(({ id }) => id === active.id)!.slots.map(({ character }) => character?.id ?? null))
      .toEqual([activeCharacterIds[0], null, null, null]);
    expect(reactivated.teams.find(({ id }) => id === base.id)!.slots.every(({ character }) => character === null)).toBe(true);
    expect(reactivated.teams.some(({ id }) => id === extra.id)).toBe(false);
  }, 20_000);

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

async function fillTeam(store: PrismaTeamStore, playerId: string, teamId: string, characterIds: readonly string[]) {
  for (const [index, characterId] of characterIds.entries()) {
    await store.setSlot(playerId, teamId, index + 1, characterId);
  }
}

async function setCharacterActive(characterId: string, isActive: boolean) {
  await database.character.update({ where: { id: characterId }, data: { isActive } });
}

async function cleanupPlayers() {
  if (playerIds.size === 0) return;
  await database.player.deleteMany({ where: { id: { in: [...playerIds] } } });
  playerIds.clear();
}
