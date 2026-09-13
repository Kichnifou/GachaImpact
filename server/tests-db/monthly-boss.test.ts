import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MonthlyBossService } from '../src/application/combat/monthly-boss-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { loadConfig } from '../src/config/environment.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';

const config = loadConfig(); if (!config.databaseUrl) throw new Error('DATABASE_URL is required for monthly Boss database tests.');
const database = createDatabase(config.databaseUrl);
const playerIds = new Set<string>();
const characterIds = new Set<string>();
const months = ['2098-01-01', '2098-02-01', '2098-03-01', '2098-04-01', '2098-05-01'] as const;
let now = new Date('2098-01-10T12:00:00.000Z');
let randomCalls = 0;
const clock = { now: () => now };
const random = { nextInt: (maximum: number) => { randomCalls += 1; return maximum === 31 ? 15 : 0; } };
const identity = { subject: 'monthly-boss-fixture' } as const;

beforeAll(cleanup);
afterAll(async () => { try { await cleanup(); } finally { await database.$disconnect(); } });

async function fixture(characterCount = 4) {
  const id = randomUUID(); playerIds.add(id);
  const characters = await database.character.findMany({ where: { isActive: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }], take: characterCount });
  if (characters.length < characterCount) throw new Error('Monthly Boss tests require four active characters.');
  await database.player.create({ data: {
    id, displayName: `Boss Fixture ${id.slice(0, 8)}`, elementKey: 'hydro',
    resourceBalances: { create: resourceKeys.map((resourceKey) => ({ resourceKey, amount: 0n })) }, economyStats: { create: {} },
    characters: { create: characters.map((character, index) => ({ characterId: character.id, constellation: index, copies: index + 1, firstObtainedAt: now })) },
  } });
  const current = new GetCurrentPlayer({ findByIdentity: async () => ({ id, displayName: `Boss Fixture ${id.slice(0, 8)}`, elementKey: 'hydro', status: 'ACTIVE' as const }), provision: async () => { throw new Error('not used'); } });
  return { id, characters, service: new MonthlyBossService(current, database, clock, random) };
}

async function fill(service: MonthlyBossService, characters: readonly { id: string }[]) {
  for (let index = 0; index < 4; index += 1) await service.setSlot(identity, index + 1, characters[index]!.id);
}

async function cleanup() {
  const ids = [...playerIds];
  const monthDates = months.map((month) => new Date(`${month}T00:00:00.000Z`));
  const bosses = await database.monthlyBoss.findMany({ where: { monthStart: { in: monthDates } }, select: { id: true } });
  const bossIds = bosses.map(({ id }) => id);
  if (bossIds.length) {
    await database.notification.deleteMany({ where: { actionTargetId: { in: bossIds } } });
    await database.bossReward.deleteMany({ where: { bossId: { in: bossIds } } });
    await database.bossAttack.deleteMany({ where: { bossId: { in: bossIds } } });
    await database.playerBossParticipation.deleteMany({ where: { bossId: { in: bossIds } } });
  }
  if (ids.length) {
    await database.resourceMovement.deleteMany({ where: { playerId: { in: ids } } });
    await database.businessOperation.deleteMany({ where: { playerId: { in: ids } } });
  }
  if (bossIds.length) await database.monthlyBoss.deleteMany({ where: { id: { in: bossIds } } });
  if (ids.length) await database.player.deleteMany({ where: { id: { in: ids } } });
  const dedicated = [...characterIds]; if (dedicated.length) await database.character.deleteMany({ where: { id: { in: dedicated } } });
  playerIds.clear(); characterIds.clear();
}

describe('monthly Boss persistence', () => {
  it('protects every Boss table from browser roles', async () => {
    const tables = ['monthly_bosses','player_boss_loadouts','player_boss_loadout_slots','boss_attacks','boss_attack_members','player_boss_participations','player_boss_stats','boss_rewards'];
    const rls = await database.$queryRawUnsafe<{ relname: string; relrowsecurity: boolean }[]>(`SELECT relname, relrowsecurity FROM pg_class WHERE relname = ANY($1::text[]) ORDER BY relname`, tables);
    expect(rls).toHaveLength(tables.length); expect(rls.every(({ relrowsecurity }) => relrowsecurity)).toBe(true);
    const grants = await database.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM information_schema.role_table_grants WHERE table_name = ANY($1::text[]) AND grantee IN ('anon','authenticated')`, tables);
    expect(grants[0]?.count).toBe(0n);
  });

  it('creates one stable persisted instance under concurrent first access without static SQL data', async () => {
    now = new Date('2098-01-10T12:00:00Z'); randomCalls = 0;
    const left = await fixture(); const right = await fixture();
    const [a, b] = await Promise.all([left.service.getCurrent(identity), right.service.getCurrent(identity)]);
    expect(a.boss.id).toBe(b.boss.id); expect(a.boss).toMatchObject({ monthStart: months[0], baseHp: 1_500_000n, maxHp: 1_500_000n, hpVariationPercent: 0, resistanceElementKey: 'pyro' });
    expect(await database.monthlyBoss.count({ where: { monthStart: new Date(`${months[0]}T00:00:00Z`) } })).toBe(1);
    expect(randomCalls).toBe(2);
  });

  it('persists partial manual loadouts, copies only the active Team, and never changes Team', async () => {
    now = new Date('2098-02-10T12:00:00Z'); const player = await fixture();
    await player.service.setSlot(identity, 1, player.characters[0]!.id);
    await expect(player.service.setSlot(identity, 2, player.characters[0]!.id)).rejects.toMatchObject({ code: 'BOSS_CHARACTER_DUPLICATE' });
    const team = await database.team.create({ data: { playerId: player.id, displayPosition: 1, isActive: true, isBaseSlot: true, members: { create: player.characters.slice(0, 3).map((character, index) => ({ position: index + 1, characterId: character.id })) } }, include: { members: true } });
    const copied = await player.service.copyActiveTeam(identity);
    expect(copied.loadout.slots.filter(({ character }) => character)).toHaveLength(3);
    expect((await database.team.findUniqueOrThrow({ where: { id: team.id }, include: { members: true } })).members).toEqual(team.members);
    await expect(player.service.attack(identity, copied.boss.id, randomUUID())).rejects.toMatchObject({ code: 'BOSS_LOADOUT_INCOMPLETE' });
  });

  it('snapshots damage, enforces one attack per Paris day, and replays one key without duplicate stats', async () => {
    now = new Date('2098-03-10T12:00:00Z'); const player = await fixture(); await fill(player.service, player.characters);
    const before = await player.service.getCurrent(identity); const key = randomUUID();
    const first = await player.service.attack(identity, before.boss.id, key); const retry = await player.service.attack(identity, before.boss.id, key);
    expect(first.result.damage).toBe(first.view.preview!.totalDamage); expect(retry.operation).toEqual({ id: first.operation.id, alreadyProcessed: true });
    expect(await database.bossAttack.count({ where: { playerId: player.id } })).toBe(1);
    expect(await database.bossAttackMember.count({ where: { attack: { playerId: player.id } } })).toBe(4);
    expect((await database.playerBossStats.findUniqueOrThrow({ where: { playerId: player.id } })).totalAttacks).toBe(1n);
    const upgradedCharacter = player.characters[2]!;
    const firstAttack = await database.bossAttack.findFirstOrThrow({ where: { playerId: player.id }, include: { members: true } });
    expect(firstAttack.members.find(({ characterId }) => characterId === upgradedCharacter.id)?.constellationSnapshot).toBe(2);
    await database.playerCharacter.update({
      where: { playerId_characterId: { playerId: player.id, characterId: upgradedCharacter.id } },
      data: { constellation: 3, copies: 4 },
    });
    expect((await database.bossAttack.findUniqueOrThrow({ where: { id: firstAttack.id }, include: { members: true } })).members.find(({ characterId }) => characterId === upgradedCharacter.id)?.constellationSnapshot).toBe(2);
    await expect(player.service.attack(identity, before.boss.id, randomUUID())).rejects.toMatchObject({ code: 'BOSS_ATTACK_ALREADY_USED' });
    now = new Date('2098-03-11T00:30:00Z');
    const nextDay = await player.service.getCurrent(identity);
    expect(nextDay.attackState).toBe('AVAILABLE');
    expect(nextDay.preview?.contributions.find(({ characterId }) => characterId === upgradedCharacter.id)?.constellation).toBe(3);
    await player.service.attack(identity, before.boss.id, randomUUID());
    expect(await database.bossAttack.count({ where: { playerId: player.id } })).toBe(2);
  }, 30_000);

  it('serializes a concurrent lethal race, preserves the loser daily attempt, and rewards every prior participant once', async () => {
    now = new Date('2098-04-10T12:00:00Z'); const left = await fixture(); const right = await fixture(); await fill(left.service, left.characters); await fill(right.service, right.characters);
    const boss = await left.service.getCurrent(identity);
    await left.service.attack(identity, boss.boss.id, randomUUID()); await right.service.attack(identity, boss.boss.id, randomUUID());
    now = new Date('2098-04-11T12:00:00Z'); await database.monthlyBoss.update({ where: { id: boss.boss.id }, data: { currentHp: 1n } });
    const results = await Promise.allSettled([left.service.attack(identity, boss.boss.id, randomUUID()), right.service.attack(identity, boss.boss.id, randomUUID())]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.find(({ status }) => status === 'rejected')).toMatchObject({ status: 'rejected', reason: { code: 'BOSS_DEFEATED' } });
    expect(await database.bossAttack.count({ where: { bossId: boss.boss.id, businessDate: new Date('2098-04-11T00:00:00Z') } })).toBe(1);
    expect(await database.bossReward.count({ where: { bossId: boss.boss.id } })).toBe(2);
    expect(await database.businessOperation.count({ where: { playerId: { in: [left.id, right.id] }, operationType: 'monthly-boss.reward', sourceChannel: 'SYSTEM', status: 'COMPLETED' } })).toBe(2);
    expect(await database.resourceMovement.count({ where: { playerId: { in: [left.id, right.id] }, domainKey: 'monthly-boss', sourceChannel: 'SYSTEM' } })).toBe(4);
    expect(await database.notification.count({ where: { actionTargetId: boss.boss.id, typeKey: 'MONTHLY_BOSS_DEFEATED', state: 'UNREAD' } })).toBe(2);
    for (const player of [left, right]) {
      expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: 'primogems' } } })).amount).toBe(16_000n);
      expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: 'moras' } } })).amount).toBe(500_000n);
    }
    const finalBlows = await database.playerBossStats.aggregate({ where: { playerId: { in: [left.id, right.id] } }, _sum: { finalBlows: true, totalRewarded: true } });
    expect(finalBlows._sum).toMatchObject({ finalBlows: 1n, totalRewarded: 2n });
  }, 30_000);

  it('clears only an inactive selected slot and refuses the attack without consuming the day', async () => {
    now = new Date('2098-05-10T12:00:00Z'); const player = await fixture(3); const template = player.characters[0]!; const id = randomUUID(); characterIds.add(id);
    const character = await database.character.create({ data: { id, externalKey: `boss-fixture-${id}`, name: 'Boss Disabled Fixture', rarity: 4, elementKey: template.elementKey, isActive: true } });
    await database.playerCharacter.create({ data: { playerId: player.id, characterId: id, constellation: 0, copies: 1, firstObtainedAt: now } });
    await fill(player.service, [...player.characters, character]); const boss = await player.service.getCurrent(identity);
    await database.character.update({ where: { id }, data: { isActive: false } });
    await expect(player.service.attack(identity, boss.boss.id, randomUUID())).rejects.toMatchObject({ code: 'BOSS_CHARACTER_INACTIVE' });
    expect(await database.playerBossLoadoutSlot.count({ where: { playerId: player.id } })).toBe(3);
    expect(await database.bossAttack.count({ where: { playerId: player.id } })).toBe(0);
    await database.character.update({ where: { id }, data: { isActive: true } });
  });
});
