import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/environment.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { PrismaDailyCombatStore } from '../src/infrastructure/database/prisma-daily-combat-store.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Daily Combat database tests.');
const database = createDatabase(config.databaseUrl);
const players = new Set<string>();
const dates = ['2099-06-01', '2099-06-02', '2099-06-03', '2099-06-04'] as const;
const now = new Date('2099-06-01T12:00:00.000Z');
const zero = { nextInt: () => 0 };
const lossRoll = { nextInt: () => 199 };

beforeAll(cleanup);
afterAll(async () => { try { await cleanup(); } finally { await database.$disconnect(); } });

async function activeCharacters(count: number) {
  const rows = await database.character.findMany({ where: { isActive: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }], take: count });
  if (rows.length < count) throw new Error(`Daily Combat tests require ${count} active catalog characters.`);
  return rows;
}

async function createPlayer(characterCount: number) {
  const id = randomUUID(); players.add(id); const characters = await activeCharacters(characterCount);
  await database.player.create({ data: {
    id, displayName: `Combat Fixture ${id.slice(0, 8)}`, elementKey: 'hydro',
    resourceBalances: { create: resourceKeys.map((resourceKey) => ({ resourceKey, amount: 0n })) }, economyStats: { create: {} },
    characters: { create: characters.map((character, index) => ({ characterId: character.id, constellation: index % 7, copies: index % 7 + 1, firstObtainedAt: now })) },
  } });
  return { id, characters };
}

function context(playerId: string, businessDate: string = dates[0]) { return { playerId, playerElementKey: 'hydro' as const, businessDate, now }; }

async function cleanup() {
  const ids = [...players];
  const encounters = await database.dailyCombatEncounter.findMany({ where: { businessDate: { in: dates.map((date) => new Date(`${date}T00:00:00.000Z`)) } }, select: { id: true } });
  const encounterIds = encounters.map(({ id }) => id);
  if (ids.length) {
    await database.dailyCombatAttempt.deleteMany({ where: { playerId: { in: ids } } });
    await database.resourceMovement.deleteMany({ where: { playerId: { in: ids } } });
    await database.businessOperation.deleteMany({ where: { playerId: { in: ids } } });
    await database.player.deleteMany({ where: { id: { in: ids } } });
  }
  if (encounterIds.length) await database.dailyCombatEncounter.deleteMany({ where: { id: { in: encounterIds } } });
  players.clear();
}

describe('Daily Combat persistence', () => {
  it('seeds the exact normalized matrix and protects every Combat table from browser roles', async () => {
    expect(await database.elementCombatMatchup.count()).toBe(28);
    const pyro = await database.elementCombatMatchup.findMany({ where: { attackerElementKey: 'pyro' }, orderBy: { defenderElementKey: 'asc' } });
    expect(pyro.map(({ defenderElementKey, relation }) => [defenderElementKey, relation])).toEqual([['cryo', 1], ['dendro', 1], ['geo', -1], ['hydro', -1]]);
    const tables = ['element_combat_matchups','daily_combat_encounters','daily_combat_enemies','player_daily_combat_loadouts','player_daily_combat_loadout_slots','player_daily_combat_states','player_daily_combat_kos','daily_combat_attempts','daily_combat_attempt_members','player_combat_stats','player_character_combat_stats'];
    const rls = await database.$queryRawUnsafe<{ relname: string; relrowsecurity: boolean }[]>(`SELECT relname, relrowsecurity FROM pg_class WHERE relname = ANY($1::text[]) ORDER BY relname`, tables);
    expect(rls).toHaveLength(tables.length); expect(rls.every(({ relrowsecurity }) => relrowsecurity)).toBe(true);
    const grants = await database.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM information_schema.role_table_grants WHERE table_name = ANY($1::text[]) AND grantee IN ('anon','authenticated')`, tables);
    expect(grants[0]?.count).toBe(0n);
  });

  it('creates one stable global encounter under concurrent first reads', async () => {
    const first = await createPlayer(4); const second = await createPlayer(4);
    const store = new PrismaDailyCombatStore(database, { encounter: zero, fight: zero });
    const [left, right] = await Promise.all([store.getView(context(first.id)), store.getView(context(second.id))]);
    expect(left.encounter.id).toBe(right.encounter.id); expect(left.encounter.enemies).toHaveLength(4);
    expect(new Set(left.encounter.enemies.map(({ character }) => character.id)).size).toBe(4);
    const selectedCatalogRows = await database.character.findMany({ where: { id: { in: left.encounter.enemies.map(({ character }) => character.id) } }, select: { isActive: true } });
    expect(selectedCatalogRows).toHaveLength(4); expect(selectedCatalogRows.every(({ isActive }) => isActive)).toBe(true);
    expect((await store.getView(context(first.id))).encounter.id).toBe(left.encounter.id);
    expect((await store.getView(context(first.id, dates[1]))).encounter.id).not.toBe(left.encounter.id);
    expect(await database.dailyCombatEncounter.count({ where: { businessDate: new Date(`${dates[0]}T00:00:00.000Z`) } })).toBe(1);
  });

  it('persists a partial manual loadout and rejects incomplete, duplicate and unowned selections', async () => {
    const player = await createPlayer(4); const outsider = (await activeCharacters(5))[4]!;
    const store = new PrismaDailyCombatStore(database, { encounter: zero, fight: zero });
    await expect(store.fight({ ...context(player.id, dates[3]), idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'DAILY_COMBAT_LOADOUT_INCOMPLETE' });
    await store.setSlot({ ...context(player.id, dates[3]), position: 1, characterId: player.characters[0]!.id });
    const partial = await store.setSlot({ ...context(player.id, dates[3]), position: 2, characterId: player.characters[1]!.id });
    expect(partial.loadout.slots.filter(({ character }) => character).map(({ character }) => character!.id)).toEqual(player.characters.slice(0, 2).map(({ id }) => id));
    expect((await store.getView(context(player.id, dates[3]))).loadout.slots[1]!.character?.id).toBe(player.characters[1]!.id);
    await expect(store.setSlot({ ...context(player.id, dates[3]), position: 3, characterId: player.characters[0]!.id })).rejects.toMatchObject({ code: 'DAILY_COMBAT_CHARACTER_DUPLICATE' });
    await expect(store.setSlot({ ...context(player.id, dates[3]), position: 3, characterId: outsider.id })).rejects.toMatchObject({ code: 'DAILY_COMBAT_CHARACTER_NOT_OWNED' });
    const removed = await store.removeSlot({ ...context(player.id, dates[3]), position: 1 });
    expect(removed.loadout.slots[0]!.character).toBeNull(); expect(removed.loadout.slots[1]!.character?.id).toBe(player.characters[1]!.id);
    expect((await store.clearLoadout(context(player.id, dates[3]))).loadout.slots.every(({ character }) => character === null)).toBe(true);
  });

  it('persists Auto for the next attempt, records a loss and KO, then rewards one idempotent manual win', async () => {
    const player = await createPlayer(9);
    const losing = new PrismaDailyCombatStore(database, { encounter: zero, fight: lossRoll });
    expect((await losing.getView(context(player.id))).loadout.slots.every(({ character }) => character === null)).toBe(true);
    const auto = await losing.autoSelect(context(player.id));
    expect(auto.loadout.nextAttemptMode).toBe('AUTO'); expect(auto.loadout.slots.filter(({ character }) => character).length).toBe(4); expect(auto.preview).not.toBeNull();
    const loss = await losing.fight({ ...context(player.id), idempotencyKey: randomUUID() });
    expect(loss.result).toMatchObject({ won: false, mode: 'AUTO' }); expect(loss.view.status).toBe('IN_PROGRESS'); expect(loss.view.koCharacterIds).toHaveLength(4);
    expect(loss.view.loadout.nextAttemptMode).toBe('MANUAL'); expect(loss.resources).toMatchObject({ primogems: 0n, moras: 0n });
    await expect(losing.fight({ ...context(player.id), idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'DAILY_COMBAT_CHARACTER_KO' });

    const replacement = await losing.autoSelect(context(player.id));
    expect(replacement.loadout.nextAttemptMode).toBe('AUTO'); expect(replacement.loadout.slots.every(({ ko }) => !ko)).toBe(true);
    const firstCharacter = replacement.loadout.slots[0]!.character!;
    const manual = await losing.setSlot({ ...context(player.id), position: 1, characterId: firstCharacter.id });
    expect(manual.loadout.nextAttemptMode).toBe('MANUAL');
    const winning = new PrismaDailyCombatStore(database, { encounter: zero, fight: zero });
    const key = randomUUID(); const win = await winning.fight({ ...context(player.id), idempotencyKey: key }); const retry = await winning.fight({ ...context(player.id), idempotencyKey: key });
    expect(win.result).toMatchObject({ won: true, mode: 'MANUAL' }); expect(retry.operation).toEqual({ id: win.operation.id, alreadyProcessed: true });
    expect(retry.resources).toMatchObject({ primogems: 800n, moras: 20_000n }); expect(retry.view.status).toBe('COMPLETED'); expect(retry.view.canFight).toBe(false);
    expect(await database.dailyCombatAttempt.count({ where: { playerId: player.id } })).toBe(2);
    expect(await database.dailyCombatAttemptMember.count({ where: { attempt: { playerId: player.id } } })).toBe(8);
    expect(await database.resourceMovement.count({ where: { playerId: player.id, causeKey: 'daily-combat.victory' } })).toBe(2);
    expect(await database.playerCombatStats.findUniqueOrThrow({ where: { playerId: player.id } })).toMatchObject({ totalFights: 2n, totalWins: 1n, totalLosses: 1n, totalManualWins: 1n });
    const attempts = await database.dailyCombatAttempt.findMany({ where: { playerId: player.id }, include: { members: true } });
    expect(attempts.map(({ mode, rngRoll, members }) => ({ mode, rngRoll, members: members.length }))).toEqual(expect.arrayContaining([{ mode: 'AUTO', rngRoll: 200, members: 4 }, { mode: 'MANUAL', rngRoll: 1, members: 4 }]));
    const usedIds = new Set(attempts.flatMap(({ members }) => members.map(({ characterId }) => characterId)));
    const unused = player.characters.find(({ id }) => !usedIds.has(id))!;
    expect(await database.playerCharacterCombatStats.findUnique({ where: { playerId_characterId: { playerId: player.id, characterId: unused.id } } })).toBeNull();
    expect(await database.playerCharacterCombatStats.count({ where: { playerId: player.id } })).toBe(8);
  }, 20_000);

  it('copies only the authoritative active Team and dynamically leaves BLOCKED after a new possession', async () => {
    const player = await createPlayer(3); const store = new PrismaDailyCombatStore(database, { encounter: zero, fight: zero });
    await database.team.create({ data: { playerId: player.id, displayPosition: 1, isActive: true, isBaseSlot: true, members: { create: player.characters.slice(0, 2).map((character, index) => ({ position: index + 1, characterId: character.id })) } } });
    const copied = await store.copyActiveTeam(context(player.id, dates[1]));
    expect(copied.loadout.slots.filter(({ character }) => character).map(({ character }) => character!.id)).toEqual(player.characters.slice(0, 2).map(({ id }) => id));
    expect(copied.loadout.nextAttemptMode).toBe('MANUAL'); expect(copied.status).toBe('BLOCKED');
    expect((await database.team.findFirstOrThrow({ where: { playerId: player.id, isActive: true }, include: { members: { orderBy: { position: 'asc' } } } })).members.map(({ characterId }) => characterId)).toEqual(player.characters.slice(0, 2).map(({ id }) => id));
    const fourth = (await activeCharacters(4))[3]!;
    await database.playerCharacter.create({ data: { playerId: player.id, characterId: fourth.id, constellation: 0, copies: 1, firstObtainedAt: now } });
    expect((await store.getView(context(player.id, dates[1]))).status).toBe('TODO');
  });

  it('serializes different concurrent intentions so only one victory can complete the day', async () => {
    const player = await createPlayer(4); const store = new PrismaDailyCombatStore(database, { encounter: zero, fight: zero });
    await store.autoSelect(context(player.id, dates[2]));
    const results = await Promise.allSettled([
      store.fight({ ...context(player.id, dates[2]), idempotencyKey: randomUUID() }),
      store.fight({ ...context(player.id, dates[2]), idempotencyKey: randomUUID() }),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find(({ status }) => status === 'rejected');
    expect(rejection).toMatchObject({ status: 'rejected', reason: { code: 'DAILY_COMBAT_ALREADY_COMPLETED' } });
    expect(await database.dailyCombatAttempt.count({ where: { playerId: player.id } })).toBe(1);
    expect(await database.resourceMovement.count({ where: { playerId: player.id, causeKey: 'daily-combat.victory' } })).toBe(2);
  });
});
