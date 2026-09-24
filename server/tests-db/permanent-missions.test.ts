import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { PermanentMissionProgressStatus, Prisma, SourceChannel } from '../generated/prisma/client.js';
import { PermanentMissionService } from '../src/application/missions/permanent-mission-service.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { loadConfig } from '../src/config/environment.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Permanent Mission database tests.');
const database = createDatabase(config.databaseUrl);
const service = new PermanentMissionService();
const players = new Set<string>();
const now = new Date('2026-09-24T17:00:00.000Z');

afterEach(cleanup);
afterAll(async () => { try { await cleanup(); } finally { await database.$disconnect(); } });

async function provision(label: string) {
  const identity = { subject: `mission-${label}-${randomUUID()}` };
  const result = await new GetOrProvisionCurrentPlayer(new PrismaCurrentPlayerStore(database)).execute(identity, `Mission ${label} ${randomUUID().slice(0, 8)}`);
  players.add(result.player.id);
  return result.player.id;
}

async function cleanup() {
  const ids = [...players];
  if (!ids.length) return;
  await database.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM players WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`);
    await tx.friendship.deleteMany({ where: { OR: [{ playerAId: { in: ids } }, { playerBId: { in: ids } }] } });
    await tx.playerSocialStats.deleteMany({ where: { playerId: { in: ids } } });
    await tx.resourceMovement.deleteMany({ where: { playerId: { in: ids } } });
    await tx.playerPermanentMissionProgress.deleteMany({ where: { playerId: { in: ids } } });
    await tx.businessOperation.deleteMany({ where: { playerId: { in: ids } } });
    await tx.webIdentity.deleteMany({ where: { playerId: { in: ids } } });
    await tx.player.deleteMany({ where: { id: { in: ids } } });
  });
  players.clear();
}

const reconcile = (playerId: string) => database.$transaction(
  tx => service.reconcile(tx, { playerId, sourceChannel: SourceChannel.SYSTEM, now }),
  { timeout: 15_000 },
);
const view = (playerId: string) => database.$transaction(tx => service.project(tx, playerId));
const primogems = async (playerId: string) => (await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'primogems' } } })).amount;

describe('Permanent Mission persistence', () => {
  it('applies migration 041 with 31 protected definitions and no direct economic backfill', async () => {
    expect(await database.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM _prisma_migrations WHERE migration_name = '20260924170000_041_add_permanent_missions' AND finished_at IS NOT NULL`)).toEqual([{ count: 1n }]);
    const definitions = await database.permanentMissionDefinition.findMany({ orderBy: [{ rank: 'asc' }, { displayOrder: 'asc' }] });
    expect(definitions).toHaveLength(31);
    expect(definitions.filter(definition => definition.rank === 'Z')).toHaveLength(4);
    expect(new Set(definitions.map(definition => definition.externalKey)).size).toBe(31);
    const security = await database.$queryRawUnsafe<{ relname: string; relrowsecurity: boolean }[]>(`SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND relname IN ('permanent_mission_definitions','player_permanent_mission_states','player_permanent_mission_progress') ORDER BY relname`);
    expect(security).toEqual([
      { relname: 'permanent_mission_definitions', relrowsecurity: true },
      { relname: 'player_permanent_mission_progress', relrowsecurity: true },
      { relname: 'player_permanent_mission_states', relrowsecurity: true },
    ]);
    const constraints = await database.$queryRawUnsafe<{ contype: string; count: bigint }[]>(`SELECT contype::text, count(*)::bigint AS count FROM pg_constraint WHERE conrelid IN ('permanent_mission_definitions'::regclass, 'player_permanent_mission_states'::regclass, 'player_permanent_mission_progress'::regclass) GROUP BY contype`);
    expect(Object.fromEntries(constraints.map(row => [row.contype, row.count]))).toMatchObject({ p: 3n, u: 4n, f: 5n, c: 9n });
    const indexes = await database.$queryRawUnsafe<{ indexname: string }[]>(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('permanent_mission_definitions_catalog_idx', 'player_permanent_mission_states_z_unlocked_idx', 'player_permanent_mission_progress_player_status_idx', 'player_permanent_mission_progress_definition_status_idx', 'player_permanent_mission_progress_trigger_operation_idx') ORDER BY indexname`);
    expect(indexes.map(row => row.indexname)).toEqual([
      'permanent_mission_definitions_catalog_idx',
      'player_permanent_mission_progress_definition_status_idx',
      'player_permanent_mission_progress_player_status_idx',
      'player_permanent_mission_progress_trigger_operation_idx',
      'player_permanent_mission_states_z_unlocked_idx',
    ]);
    const grants = await database.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name IN ('permanent_mission_definitions','player_permanent_mission_states','player_permanent_mission_progress') AND grantee IN ('PUBLIC','anon','authenticated')`);
    expect(grants).toEqual([{ count: 0n }]);
    const sql = await readFile(new URL('../prisma/migrations/20260924170000_041_add_permanent_missions/migration.sql', import.meta.url), 'utf8');
    expect(sql).not.toMatch(/(?:UPDATE|INSERT INTO)\s+"?(?:player_resource_balances|resource_movements|player_economy_stats)"?/iu);
    expect(sql).not.toContain('legacy');
    expect(sql).not.toContain('daily_challenge');
  });

  it('initializes a new Player with B active, A/S locked, Z secret and no reward', async () => {
    const playerId = await provision('Provision');
    const projection = await view(playerId);
    expect(projection.ranks.B).toHaveLength(9);
    expect(projection.ranks.B.every(mission => mission.status === PermanentMissionProgressStatus.ACTIVE && mission.progress === 0n)).toBe(true);
    expect(projection.ranks.A.every(mission => mission.status === PermanentMissionProgressStatus.LOCKED)).toBe(true);
    expect(projection.ranks.S.every(mission => mission.status === PermanentMissionProgressStatus.LOCKED)).toBe(true);
    expect(projection.z).toEqual({ status: 'LOCKED' });
    expect(JSON.stringify(projection.z)).not.toMatch(/Couronne|Amitié|160000|C6/u);
    expect(await primogems(playerId)).toBe(0n);
    expect(await database.businessOperation.count({ where: { playerId, operationType: 'permanent-mission.reward' } })).toBe(0);
  });

  it('cascades cumulative ranks and independent categories, then replays without a second reward', async () => {
    const playerId = await provision('Cumulative');
    await database.playerProgression.update({ where: { playerId }, data: { totalMessages: 50n, countedMessages: 50n } });
    await database.playerGachaState.update({ where: { playerId }, data: { totalPulls: 250n } });
    const first = await reconcile(playerId);
    expect(first.completions.map(completion => completion.externalKey)).toEqual(['messages_b', 'pulls_b', 'pulls_a']);
    expect(first.view.ranks.A.find(mission => mission.externalKey === 'messages_a')).toMatchObject({ status: PermanentMissionProgressStatus.ACTIVE, progress: 50n });
    expect(first.view.ranks.S.find(mission => mission.externalKey === 'pulls_s')).toMatchObject({ status: PermanentMissionProgressStatus.ACTIVE, progress: 250n });
    expect(first.view.ranks.B.find(mission => mission.externalKey === 'characters4_b')).toMatchObject({ status: PermanentMissionProgressStatus.ACTIVE, progress: 0n });
    expect(await primogems(playerId)).toBe(1_920n);
    await database.playerProgression.update({ where: { playerId }, data: { totalMessages: 250n, countedMessages: 250n } });
    const second = await reconcile(playerId);
    expect(second.completions.map(completion => completion.externalKey)).toEqual(['messages_a']);
    expect(second.view.ranks.S.find(mission => mission.externalKey === 'messages_s')).toMatchObject({ status: PermanentMissionProgressStatus.ACTIVE, progress: 250n });
    expect(await primogems(playerId)).toBe(3_520n);
    const retry = await reconcile(playerId);
    expect(retry.completions).toEqual([]);
    expect(await primogems(playerId)).toBe(3_520n);
    expect(await database.businessOperation.count({ where: { playerId, operationType: 'permanent-mission.reward' } })).toBe(4);
  });

  it('rolls back completion and reward together when the outer transaction fails', async () => {
    const playerId = await provision('Rollback');
    await database.playerProgression.update({ where: { playerId }, data: { totalMessages: 50n, countedMessages: 50n } });
    await expect(database.$transaction(async tx => {
      await service.reconcile(tx, { playerId, sourceChannel: SourceChannel.SYSTEM, now });
      throw new Error('forced outer rollback');
    })).rejects.toThrow('forced outer rollback');
    expect(await primogems(playerId)).toBe(0n);
    expect(await database.businessOperation.count({ where: { playerId, operationType: 'permanent-mission.reward' } })).toBe(0);
    expect((await view(playerId)).ranks.B.find(mission => mission.externalKey === 'messages_b')).toMatchObject({ status: PermanentMissionProgressStatus.ACTIVE, progress: 0n });
  });

  it('serializes concurrent reconciliation and rewards a completed rank exactly once', async () => {
    const playerId = await provision('Concurrency');
    await database.playerProgression.update({ where: { playerId }, data: { totalMessages: 50n, countedMessages: 50n } });
    const results = await Promise.all([reconcile(playerId), reconcile(playerId)]);
    expect(results.flatMap(result => result.completions).map(completion => completion.externalKey)).toEqual(['messages_b']);
    expect(await primogems(playerId)).toBe(160n);
    expect(await database.businessOperation.count({ where: { playerId, operationType: 'permanent-mission.reward' } })).toBe(1);
  });

  it('unlocks only after all 27 B/A/S and immediately completes all already-acquired Z conditions', async () => {
    const playerId = await provision('ZOwner');
    const friendId = await provision('ZFriend');
    await database.playerProgression.update({ where: { playerId }, data: { totalMessages: 1_000n, countedMessages: 1_000n, xp: 3_000n } });
    await database.playerGachaState.update({ where: { playerId }, data: { totalPulls: 1_000n } });
    await database.playerEconomyStats.update({ where: { playerId }, data: { totalMorasEarned: 1_000_000n, totalMainElementParticlesEarned: 10_000n } });
    await database.playerExpedition.create({ data: { playerId, totalCompleted: 30n } });
    await database.playerCombatStats.create({ data: { playerId, totalFights: 100n, totalWins: 100n, totalManualWins: 50n } });
    await database.playerSocialStats.create({ data: { playerId, totalFriendHeartsSent: 199n } });
    const [playerAId, playerBId] = [playerId, friendId].sort() as [string, string];
    await database.friendship.create({ data: { playerAId, playerBId, state: 'ACTIVE', level: 1000, totalHearts: 999n, becameFriendsAt: now } });
    const [fourStars, fiveStars] = await Promise.all([
      database.character.findMany({ where: { rarity: 4 }, orderBy: { id: 'asc' }, take: 30, select: { id: true } }),
      database.character.findMany({ where: { rarity: 5 }, orderBy: { id: 'asc' }, take: 20, select: { id: true } }),
    ]);
    expect(fourStars).toHaveLength(30);
    expect(fiveStars).toHaveLength(20);
    const characters = [...fourStars, ...fiveStars];
    await database.playerCharacter.createMany({ data: characters.map((character, index) => ({ playerId, characterId: character.id, constellation: index < 5 ? 6 : 0, copies: index < 5 ? 7 : 1, firstObtainedAt: now })) });

    const beforeFinalHeart = await reconcile(playerId);
    expect(beforeFinalHeart.completions).toHaveLength(26);
    expect(beforeFinalHeart.zUnlocked).toBe(false);
    expect(beforeFinalHeart.view.z).toEqual({ status: 'LOCKED' });
    await database.playerSocialStats.update({ where: { playerId }, data: { totalFriendHeartsSent: 200n } });
    const unlocked = await reconcile(playerId);
    expect(unlocked.zUnlocked).toBe(true);
    expect(unlocked.completions.map(completion => completion.externalKey)).toEqual([
      'friend_hearts_s', 'c6_5_characters_z', 'perfect_friendship_z', 'level_100_z', 'manual_combat_wins_z',
    ]);
    expect(unlocked.view.z.status).toBe('COMPLETED');
    if (unlocked.view.z.status === 'LOCKED') throw new Error('Z should be unlocked.');
    expect(unlocked.view.z.missions).toHaveLength(4);
    expect(unlocked.view.z.missions.every(mission => mission.status === PermanentMissionProgressStatus.COMPLETED)).toBe(true);
    expect(await primogems(playerId)).toBe(799_840n);
    const replay = await reconcile(playerId);
    expect(replay).toMatchObject({ completions: [], zUnlocked: false });
    expect(await primogems(playerId)).toBe(799_840n);
    expect(await database.businessOperation.count({ where: { playerId, operationType: 'permanent-mission.reward' } })).toBe(31);
  }, 15_000);
});
