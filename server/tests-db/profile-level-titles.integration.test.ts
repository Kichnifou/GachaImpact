import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { AppearanceService } from '../src/application/appearance/appearance-service.js';
import { unlockProfileLevelTitles } from '../src/application/appearance/profile-level-titles.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaPlayerXpService } from '../src/infrastructure/database/prisma-player-xp-service.js';
import type { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';
import type { PermanentMissionService } from '../src/application/missions/permanent-mission-service.js';
import { derivePlayerLevel } from '../src/domain/player/player-progression.js';
import { SocialService } from '../src/application/social/social-service.js';
import { RankingService } from '../src/application/ranking/ranking-service.js';
import { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import { DirectMessageService } from '../src/application/direct-messages/direct-message-service.js';

const migration = new URL('../prisma/migrations/20261003160000_059_add_profile_level_titles/migration.sql', import.meta.url);
const thresholds = [10, 25, 50, 75, 100];
const fixture = isolatedBatchDatabase(), { database } = fixture;
const owners = new Map<number, string>();
beforeAll(async () => {
  await fixture.setup();
  await database.element.create({ data: { key: 'pyro', displayName: 'Pyro', displayOrder: 1 } });
  for (const level of [9, ...thresholds]) owners.set(level, (await database.player.create({ data: { displayName: 'Level ' + level, elementKey: 'pyro', progression: { create: { xp: BigInt(level * 30) } } } })).id);
  await fixture.installMigrationOnlySql(migration);
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);

describe('Profile level titles 059 — isolated schema', () => {
  it('creates exactly five titles and silently backfills current XP boundaries once', async () => {
    const definitions = await database.cosmeticDefinition.findMany({ orderBy: { externalKey: 'asc' } });
    expect(definitions).toHaveLength(5);
    expect(new Set(definitions.map(d => d.displayName))).toEqual(new Set(['Éclat naissant', 'Voyageur astral', 'Étoile montante', 'Maître des Astres', 'Légende astrale']));
    for (const d of definitions) {
      const level = Number(d.externalKey.replace('title-level-', ''));
      expect(thresholds).toContain(level);
      expect(d).toMatchObject({ type: 'TITLE', visibility: 'VISIBLE', isActive: true, assetPath: null, conditionText: `Atteindre le niveau ${level}.`, unlockRule: { kind: 'PLAYER_LEVEL', level } });
    }
    for (const [level, id] of owners) {
      expect(derivePlayerLevel(BigInt(level * 30))).toBe(level);
      expect(derivePlayerLevel(BigInt(level * 30 - 1))).toBe(level - 1);
      const owned = await database.playerCosmetic.findMany({ where: { playerId: id }, include: { cosmetic: true } });
      expect(owned).toHaveLength(thresholds.filter(t => t <= level).length);
      for (const item of owned) expect(item).toMatchObject({ unlockSource: 'PROFILE_LEVEL_BACKFILL_059', provenance: { kind: 'PLAYER_LEVEL', totalXp: String(level * 30) } });
      expect((await database.player.findUniqueOrThrow({ where: { id } })).equippedTitleCosmeticId).toBeNull();
    }
    expect(await database.notification.count()).toBe(0);
    const before = await database.playerCosmetic.findMany({ orderBy: [{ playerId: 'asc' }, { cosmeticId: 'asc' }] });
    await fixture.installMigrationOnlySql(migration);
    expect(await database.playerCosmetic.findMany({ orderBy: [{ playerId: 'asc' }, { cosmeticId: 'asc' }] })).toEqual(before);
    expect(await database.notification.count()).toBe(0);
  });
  it('shares the XP transaction for crossed thresholds, notification, replay and rollback', async () => {
    const playerId = owners.get(9)!;
    const economy = { credit: vi.fn(async () => undefined) } as unknown as PrismaEconomyService;
    const missions = { catchUpStandalone: vi.fn(async () => undefined), reconcileMetrics: vi.fn(async () => undefined) } as unknown as PermanentMissionService;
    const xp = new PrismaPlayerXpService(economy, missions);
    const input = { playerId, playerElementKey: 'pyro' as const, amount: 2730n, source: 'TEST', now: new Date(), operationId: crypto.randomUUID(), sourceChannel: 'UI' as const, random: { nextInt: () => 0 } };
    await expect(database.$transaction(async tx => { await xp.grant(tx, input); throw Error('rollback'); })).rejects.toThrow('rollback');
    expect((await database.playerProgression.findUniqueOrThrow({ where: { playerId } })).xp).toBe(270n);
    expect(await database.playerCosmetic.count({ where: { playerId } })).toBe(0);
    expect(await database.notification.count({ where: { playerId } })).toBe(0);
    await database.$transaction(tx => xp.grant(tx, input));
    expect((await database.playerProgression.findUniqueOrThrow({ where: { playerId } })).xp).toBe(3000n);
    expect(await database.playerCosmetic.count({ where: { playerId } })).toBe(5);
    expect(await database.notification.count({ where: { playerId, typeKey: 'COSMETIC_UNLOCKED' } })).toBe(5);
    await database.$transaction(tx => unlockProfileLevelTitles(tx, { playerId, levelsReached: thresholds, operationId: input.operationId }));
    expect(await database.notification.count({ where: { playerId } })).toBe(5);
    expect((await database.player.findUniqueOrThrow({ where: { id: playerId } })).equippedTitleCosmeticId).toBeNull();
  });
  it('keeps reads mutation-free, displays locked conditions and equips only owned titles', async () => {
    const playerId = owners.get(25)!;
    const player = await database.player.findUniqueOrThrow({ where: { id: playerId } });
    const store = { findByIdentity: async () => ({ id: player.id, displayName: player.displayName, status: player.status, elementKey: 'pyro' as const }), provision: async () => { throw Error('not allowed'); } };
    const service = new AppearanceService(database, new GetCurrentPlayer(store)), identity = { subject: 'fixture' };
    const before = await database.playerCosmetic.count();
    const view = await service.get(identity);
    expect(view.catalog).toHaveLength(5);
    expect(view.catalog.filter(d => d.owned)).toHaveLength(2);
    expect(view.catalog.find(d => d.displayName === 'Étoile montante')).toMatchObject({ owned: false, condition: 'Atteindre le niveau 50.' });
    expect(await database.playerCosmetic.count()).toBe(before);
    const own = view.catalog.find(d => d.displayName === 'Voyageur astral')!;
    const first = view.catalog.find(d => d.displayName === 'Éclat naissant')!;
    const locked = view.catalog.find(d => d.displayName === 'Légende astrale')!;
    await expect(service.equip(identity, 'TITLE', locked.id)).rejects.toMatchObject({ code: 'COSMETIC_NOT_OWNED' });
    expect((await service.equip(identity, 'TITLE', first.id)).title).toBe('Éclat naissant');
    expect((await service.equip(identity, 'TITLE', own.id)).title).toBe('Voyageur astral');
    const clock = { now: () => new Date() };
    const viewer = await database.player.findUniqueOrThrow({ where: { id: owners.get(10)! } });
    const viewerStore = { ...store, findByIdentity: async () => ({ id: viewer.id, displayName: viewer.displayName, status: viewer.status, elementKey: 'pyro' as const }) };
    const viewerPlayer = new GetCurrentPlayer(viewerStore);
    const social = new SocialService(viewerPlayer, database, clock);
    expect((await social.profile(identity, playerId)).player.title).toBe('Voyageur astral');
    const directory = await social.directory(identity, { q: 'Level 25', page: 1 });
    const ranking = await new RankingService(database).list('level', viewer.id, 1, 20);
    const mentions = await new GlobalChatService(database, viewerPlayer, clock, { nextInt: () => 0 }).searchMentions(identity, 'Level 25');
    const recipients = await new DirectMessageService(database, viewerPlayer, clock).searchPlayers(identity, 'Level 25');
    for (const projection of [directory.players, ranking!.entries, mentions.players, recipients.players]) {
      expect(projection.length).toBeGreaterThan(0);
      expect(JSON.stringify(projection)).not.toContain('Voyageur astral');
      for (const item of projection) expect(item).not.toHaveProperty('title');
    }
    expect((await service.equip(identity, 'TITLE', null)).title).toBeNull();
    await database.playerProgression.update({ where: { playerId }, data: { xp: 0n } });
    expect((await service.get(identity)).catalog.filter(d => d.owned)).toHaveLength(2);
  });
});

it('rehearses all 62 current migrations with Prisma deploy/status in a separate private schema', async () => {
  const rehearsal = isolatedBatchDatabase();
  try {
    await rehearsal.setup({ prismaMigrations: true });
    expect(rehearsal.migrationStatus).toContain('62 migrations found');
    expect(rehearsal.migrationStatus).toContain('Database schema is up to date');
    expect(await rehearsal.database.cosmeticDefinition.count({ where: { type: 'TITLE' } })).toBe(5);
    const rows = await rehearsal.admin.query('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name');
    expect(rows.rows).toHaveLength(62);
    expect(rows.rows.at(-1).migration_name).toContain('_062_');
    expect(rows.rows.some(row => row.migration_name.includes('_059_'))).toBe(true);
  } finally { await rehearsal.cleanup(); }
}, 180_000);
