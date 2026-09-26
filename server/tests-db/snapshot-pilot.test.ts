import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { SnapshotPilotService } from '../src/application/migration/snapshot-pilot-service.js';
import { snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';
import type { TwitchPilotService } from '../src/application/twitch/twitch-pilot-service.js';
import type { AuthenticatedIdentity } from '../src/domain/identity/authenticated-identity.js';

const isolated = isolatedBatchDatabase();
const db = isolated.database;
const playerId = randomUUID();
const identity = { subject: 'private-snapshot-fixture' } as AuthenticatedIdentity;
let characterKey: string;
const twitch = { requirePilot: async () => ({ id: playerId }) } as unknown as TwitchPilotService;
const service = new SnapshotPilotService(db, twitch, 'private-test-preview-secret');
const categories = ['messages', 'pulls', 'characters4', 'characters5', 'morasEarned', 'mainParticlesEarned', 'expeditions', 'combatWins', 'friendHeartsSent'];
const zKeys = ['c6_5_characters_z', 'perfect_friendship_z', 'level_100_z', 'manual_combat_wins_z'];

function bundle(options: { xp?: number; moras?: number; bank?: number; box?: boolean; stella?: number } = {}) {
  const id = Number(characterKey.slice(7));
  const viewer = {
    xp: options.xp ?? 300, primogems: 120, moras: options.moras ?? 80,
    particles: Object.fromEntries(['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].map(key => [key, 0])),
    bank: { moras: options.bank ?? 40, lastInterestDate: '2026-09-25' },
    pity: { pity5: 3, pity4: 2 }, guarantee: { guaranteedFeatured5: false },
    box: options.box === false ? {} : { [id]: { characterId: id, constellation: 0, copies: 1, firstObtainedAt: '2026-09-25 12:00:00' } },
    boxFavorites: [], team: [], savedTeams: {},
    dates: { lastWheelDate: null, lastDailyFirstMessageReward: null },
    missions: { daily: null },
    longMissions: { unlockedZ: false, categories: Object.fromEntries(categories.map(key => [key, {
      progress: 0, active: false, activeRank: '', completedRanks: [], acceptedRanks: [], startedAt: '', baselineValue: 0,
    }])), z: Object.fromEntries(zKeys.map(key => [key, { active: false, completed: false, progress: 0, acceptedAt: '' }])) },
    combat: { characterWins: {}, characterLosses: {}, lostCharacters: {} },
    expedition: { active: false, lastStartedDate: null },
    coffre: {}, specialItems: { masterlessStellaFortuna: options.stella ?? 0 }, usedCodes: [],
    stats: { totalMessages: 10, countedMessages: 9, level100OverflowRewardsClaimed: 0,
      totalPulls: 4, totalFiveStars: 0, totalFourStars: 0, fiftyFiftyLostStreak: 0, fiftyFiftyWon: 0, fiftyFiftyLost: 0,
      totalPrimosEarned: 120, totalPrimosSpent: 0, totalMorasEarned: 80, totalMorasSpent: 0, totalMainElementParticlesEarned: 0,
      totalFriendHeartsSent: 0, totalWheelSpins: 0, totalWheelJackpots: 0,
      totalExpeditionsCompleted: 0, totalCombatFights: 0, totalCombatWins: 0, totalCombatLosses: 0, totalManualCombatWins: 0 },
  };
  return Object.fromEntries(snapshotFileNames.map(name => [name, JSON.stringify(name === 'viewers_data.json' ? { Kichnifou: viewer }
    : name === 'c6_characters.json' ? { Kichnifou: { characters: {} } } : {})]));
}

beforeAll(async () => {
  await isolated.setup({ seedPublicCatalog: true });
  const migration = readFileSync(new URL('../prisma/migrations/20260926150000_049_add_twitch_pilot_identity_snapshot/migration.sql', import.meta.url), 'utf8');
  const missionSql = migration.split('-- BEGIN LEGACY MISSION PROVENANCE')[1]?.split('-- END LEGACY MISSION PROVENANCE')[0];
  if (!missionSql) throw new Error('Missing migration 049 mission provenance DDL');
  // The private schema is generated from the candidate Prisma schema, so its new column already exists.
  await isolated.admin.query(missionSql.replace('ALTER TABLE "player_permanent_mission_progress" ADD COLUMN "legacy_provenance" jsonb;', ''));
  const character = await db.character.findFirstOrThrow({ where: { rarity: 4, externalKey: { startsWith: 'legacy:' } } });
  characterKey = character.externalKey;
  await db.player.create({ data: { id: playerId, displayName: 'Private Snapshot Fixture', elementKey: 'hydro' } });
  await db.twitchIdentity.create({ data: { playerId, twitchUserId: '123456789', login: 'kichnifou' } });
}, 60_000);
afterAll(() => isolated.cleanup(), 60_000);

describe('private snapshot pilot transaction', () => {
  it('replaces personal rows, is idempotent, and accepts a later snapshot with lower values and vanished possessions', async () => {
    const first = bundle();
    const preview = await service.preview(identity, first);
    expect(await db.migrationPreview.count({ where: { playerId } })).toBe(0);
    expect(preview.domains.filter(domain => domain.category === 'PLAYER_LOCAL_PHYSICAL')).toHaveLength(14);
    expect(preview.domains.filter(domain => domain.category === 'DEFERRED_CROSS_PLAYER_OR_GLOBAL')).toHaveLength(9);
    expect(preview.domains.some(domain => domain.category === 'BLOCKED_AMBIGUOUS' || domain.action === 'PENDING_MAPPING')).toBe(false);
    const applied = await service.apply(identity, first, preview.previewId);
    expect(applied.replayed).toBe(false);
    expect((await db.playerProgression.findUniqueOrThrow({ where: { playerId } })).xp).toBe(300n);
    expect((await db.playerBankAccount.findUniqueOrThrow({ where: { playerId } })).balance).toBe(40n);
    expect(await db.playerCharacter.count({ where: { playerId } })).toBe(1);
    expect(await db.team.count({ where: { playerId } })).toBe(10);
    expect(await db.playerPermanentMissionProgress.count({ where: { playerId } })).toBe(31);
    expect(await db.notification.count({ where: { playerId } })).toBe(0);
    expect(await db.businessOperation.count({ where: { playerId, operationType: 'permanent-mission.reward' } })).toBe(0);
    expect(await db.player.count()).toBe(1);
    expect(await db.playerCosmetic.count({ where: { playerId } })).toBe(1);
    const movements = await db.resourceMovement.count({ where: { playerId } });
    const replayPreview = await service.preview(identity, first);
    expect((await service.apply(identity, first, replayPreview.previewId)).replayed).toBe(true);
    expect(await db.resourceMovement.count({ where: { playerId } })).toBe(movements);
    const newer = bundle({ xp: 100, moras: 7, bank: 3, box: false, stella: 0 });
    const newerPreview = await service.preview(identity, newer);
    await service.apply(identity, newer, newerPreview.previewId);
    expect((await db.playerProgression.findUniqueOrThrow({ where: { playerId } })).xp).toBe(100n);
    expect((await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'moras' } } })).amount).toBe(7n);
    expect((await db.playerBankAccount.findUniqueOrThrow({ where: { playerId } })).balance).toBe(3n);
    expect(await db.playerCharacter.count({ where: { playerId } })).toBe(0);
    expect(await db.playerCosmetic.count({ where: { playerId } })).toBe(0);
    expect(await db.notification.count({ where: { playerId } })).toBe(0);
  }, 60_000);

  it('rejects a different bundle than the preview and consumes one confirmation once', async () => {
    const source = bundle({ xp: 500 });
    const preview = await service.preview(identity, source);
    await expect(service.apply(identity, bundle({ xp: 501 }), preview.previewId)).rejects.toMatchObject({ code: 'SNAPSHOT_PREVIEW_REQUIRED' });
    const signatureStart = preview.previewId.lastIndexOf('.') + 1;
    const first = preview.previewId[signatureStart]!;
    const forged = preview.previewId.slice(0, signatureStart) + (first === 'A' ? 'B' : 'A') + preview.previewId.slice(signatureStart + 1);
    await expect(service.apply(identity, source, forged)).rejects.toMatchObject({ code: 'SNAPSHOT_PREVIEW_REQUIRED' });
    const outcomes = await Promise.allSettled([service.apply(identity, source, preview.previewId), service.apply(identity, source, preview.previewId)]);
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(await db.migrationRun.count({ where: { playerId } })).toBe(3);
  }, 60_000);

  it('rolls back earlier domain replacements after a later insert fails', async () => {
    const before = await db.playerProgression.findUniqueOrThrow({ where: { playerId } });
    const runs = await db.migrationRun.count({ where: { playerId } });
    const preview = await service.preview(identity, bundle({ xp: 999, moras: 1 }));
    await isolated.admin.query(`CREATE FUNCTION snapshot_fixture_reject_mission() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private fixture rejection'; END $$`);
    await isolated.admin.query(`CREATE TRIGGER snapshot_fixture_reject_mission BEFORE INSERT ON player_permanent_mission_progress FOR EACH ROW EXECUTE FUNCTION snapshot_fixture_reject_mission()`);
    try {
      await expect(service.apply(identity, bundle({ xp: 999, moras: 1 }), preview.previewId)).rejects.toThrow();
    } finally {
      await isolated.admin.query('DROP TRIGGER snapshot_fixture_reject_mission ON player_permanent_mission_progress');
      await isolated.admin.query('DROP FUNCTION snapshot_fixture_reject_mission()');
    }
    expect((await db.playerProgression.findUniqueOrThrow({ where: { playerId } })).xp).toBe(before.xp);
    expect(await db.migrationRun.count({ where: { playerId } })).toBe(runs);
    expect(await db.migrationPreview.count({ where: { playerId } })).toBe(4);
  }, 60_000);

  it('reports cross-player facts without creating players and blocks an ambiguous personal source', async () => {
    const source = bundle();
    source['friendships_data.json'] = JSON.stringify({ friendships: {
      pair: { users: ['Kichnifou', 'unmigrated-viewer'], status: 'friends', level: 1 },
    }, requests: { pending: { from: 'unmigrated-viewer', to: 'Kichnifou' } } });
    const report = await service.preview(identity, source);
    const friends = report.domains.find(domain => domain.name === 'Amitié');
    expect(friends?.category).toBe('DEFERRED_CROSS_PLAYER_OR_GLOBAL');
    expect(friends?.snapshot).toContain('1 relation(s), 1 demande(s)');
    expect(await db.player.count()).toBe(1);

    const viewerIndex = JSON.parse(source['viewers_data.json']!) as Record<string, Record<string, unknown>>;
    viewerIndex.Kichnifou!.box = { 9999999: { characterId: 9999999, copies: 1, constellation: 0 } };
    source['viewers_data.json'] = JSON.stringify(viewerIndex);
    const blocked = await service.preview(identity, source);
    expect(blocked.domains.find(domain => domain.name === 'Personnages / constellations')?.category).toBe('BLOCKED_AMBIGUOUS');
    await expect(service.apply(identity, source, blocked.previewId)).rejects.toMatchObject({ code: 'SNAPSHOT_MAPPING_INCOMPLETE' });
    expect(await db.player.count()).toBe(1);
  }, 60_000);
});
