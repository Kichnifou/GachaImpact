import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { RoleAdminService } from '../src/application/moderation/role-admin-service.js';
import { CharacterAdminService } from '../src/application/moderation/character-admin-service.js';
import { PossessionAdminService } from '../src/application/moderation/possession-admin-service.js';
import { EventAdminService } from '../src/application/moderation/event-admin-service.js';
import { BannerAdminService } from '../src/application/moderation/banner-admin-service.js';
import { GlobalChatModerationService } from '../src/application/moderation/global-chat-moderation-service.js';
import { AdminAuditQueryService, sanitizeAudit } from '../src/application/moderation/admin-audit-query-service.js';
import type { WeeklyBannerScheduler } from '../src/application/gacha/weekly-banner-scheduler.js';

const isolated = isolatedBatchDatabase();
const db = isolated.database;
const getPlayer = new GetCurrentPlayer(new PrismaCurrentPlayerStore(db));
const roles = new RoleAdminService(db, getPlayer);
const characters = new CharacterAdminService(db, getPlayer);
const possessions = new PossessionAdminService(db, getPlayer);
const events = new EventAdminService(db, getPlayer);
const banners = new BannerAdminService(db, getPlayer, { catchUp: async () => {} } as WeeklyBannerScheduler);
const chat = new GlobalChatModerationService(db, getPlayer);
const audit = new AdminAuditQueryService(db, getPlayer);
beforeAll(() => isolated.setup({ seedPublicCatalog: true }), 60_000);
afterAll(() => isolated.cleanup(), 60_000);

async function player(role?: 'ADMIN' | 'MODERATOR' | 'TESTER') {
  const subject = `administration-${randomUUID()}`;
  const row = await db.player.create({ data: { displayName: `Admin test ${randomUUID().slice(0, 8)}`, elementKey: 'hydro',
    webIdentity: { create: { provider: 'supabase', providerSubject: subject } },
    ...(role ? { rolesGranted: { create: { role, source: 'private-test' } } } : {}),
    gachaState: { create: {} },
  } });
  return { id: row.id, identity: { subject } };
}

describe('administration in a private schema', () => {
  it('protects the last ADMIN under two concurrent self revocations and keeps role retries exact', async () => {
    const first = await player('ADMIN');
    await expect(roles.setRole(first.identity, first.id, 'ADMIN', false, randomUUID())).rejects.toMatchObject({ code: 'MODERATION_LAST_ADMIN' });
    const second = await player('ADMIN');
    const results = await Promise.allSettled([
      roles.setRole(first.identity, first.id, 'ADMIN', false, randomUUID()),
      roles.setRole(second.identity, second.id, 'ADMIN', false, randomUUID()),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.playerRoleAssignment.count({ where: { role: 'ADMIN', revokedAt: null } })).toBe(1);
    const survivor = (await db.playerRoleAssignment.findFirstOrThrow({ where: { role: 'ADMIN', revokedAt: null } })).playerId;
    const actor = survivor === first.id ? first : second;
    const target = await player();
    for (const role of ['TESTER', 'MODERATOR', 'ADMIN'] as const) {
      const key = randomUUID();
      expect((await roles.setRole(actor.identity, target.id, role, true, key)).alreadyProcessed).toBe(false);
      expect((await roles.setRole(actor.identity, target.id, role, true, key)).alreadyProcessed).toBe(true);
      await expect(roles.setRole(actor.identity, target.id, role, false, key)).rejects.toMatchObject({ code: 'MODERATION_IDEMPOTENCY_CONFLICT' });
      expect(await db.playerRoleAssignment.count({ where: { playerId: target.id, role, revokedAt: null } })).toBe(1);
      await roles.setRole(actor.identity, target.id, role, false, randomUUID());
      expect(await db.playerRoleAssignment.count({ where: { playerId: target.id, role, revokedAt: null } })).toBe(0);
    }
    const mod = await player('MODERATOR');
    const tester = await player('TESTER');
    const normal = await player();
    for (const denied of [mod, tester, normal]) await expect(roles.setRole(denied.identity, target.id, 'TESTER', true, randomUUID())).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' });
    expect(await db.adminAuditEntry.count({ where: { domain: 'roles', targetPlayerId: target.id } })).toBe(6);
    await roles.setRole(actor.identity, target.id, 'ADMIN', true, randomUUID());
    const selfRevokeKey = randomUUID();
    expect((await roles.setRole(actor.identity, actor.id, 'ADMIN', false, selfRevokeKey)).alreadyProcessed).toBe(false);
    expect((await roles.setRole(actor.identity, actor.id, 'ADMIN', false, selfRevokeKey)).alreadyProcessed).toBe(true);
    await expect(roles.setRole(actor.identity, target.id, 'TESTER', true, randomUUID())).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' });
  }, 60_000);

  it('manages catalog metadata and possessions without synthetic pulls, stats or notifications', async () => {
    const admin = (await db.playerRoleAssignment.findFirstOrThrow({ where: { role: 'ADMIN', revokedAt: null }, select: { playerId: true, player: { select: { webIdentity: { select: { providerSubject: true } } } } } }));
    const identity = { subject: admin.player.webIdentity!.providerSubject };
    const target = await player();
    const key = `admin-${randomUUID()}`;
    await characters.create(identity, { externalKey: key, name: 'Test Administration', rarity: 5, elementKey: 'hydro', idempotencyKey: randomUUID() });
    const row = await db.character.findUniqueOrThrow({ where: { externalKey: key } });
    expect((await characters.list(identity, { page: 1, search: key, active: true })).entries).toHaveLength(1);
    await expect(characters.create(identity, { externalKey: key, name: 'Double', rarity: 5, elementKey: 'hydro', idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'CHARACTER_DUPLICATE' });
    await characters.update(identity, row.id, { name: 'Nom corrigé', idempotencyKey: randomUUID() });
    const addKey = randomUUID();
    await possessions.change(identity, target.id, row.id, { action: 'add', idempotencyKey: addKey });
    expect((await possessions.change(identity, target.id, row.id, { action: 'add', idempotencyKey: addKey })).alreadyProcessed).toBe(true);
    expect(await db.playerCosmetic.count({ where: { playerId: target.id } })).toBe(1);
    expect(await db.notification.count({ where: { playerId: target.id } })).toBe(0);
    expect(await db.pullOperation.count({ where: { playerId: target.id } })).toBe(0);
    expect(await db.playerGachaState.findUniqueOrThrow({ where: { playerId: target.id } })).toMatchObject({ totalPulls: 0n, totalFiveStars: 0n, totalFourStars: 0n });
    await possessions.change(identity, target.id, row.id, { action: 'constellation', constellation: 6, idempotencyKey: randomUUID() });
    expect(await db.c6CompetitionProgress.findUnique({ where: { playerId_characterId: { playerId: target.id, characterId: row.id } } })).not.toBeNull();
    await expect(possessions.change(identity, target.id, row.id, { action: 'constellation', constellation: 7, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'POSSESSION_INVALID' });
    await expect(characters.update(identity, row.id, { rarity: 4, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'CHARACTER_IDENTITY_LOCKED' });
    await characters.update(identity, row.id, { isActive: false, idempotencyKey: randomUUID() });
    expect(await db.playerCharacter.count({ where: { characterId: row.id, playerId: target.id } })).toBe(1);
    expect(await db.playerCosmetic.count({ where: { playerId: target.id } })).toBe(1);
    const four = await db.character.findFirstOrThrow({ where: { rarity: 4, isActive: true } });
    await possessions.change(identity, target.id, four.id, { action: 'add', idempotencyKey: randomUUID() });
    const team = await db.team.create({ data: { playerId: target.id, displayPosition: 1, members: { create: { position: 1, characterId: four.id } } } });
    await expect(possessions.change(identity, target.id, four.id, { action: 'remove', idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'POSSESSION_DEPENDENCY' });
    await db.team.delete({ where: { id: team.id } });
    await possessions.change(identity, target.id, four.id, { action: 'remove', idempotencyKey: randomUUID() });
    expect(await db.playerCharacter.count({ where: { playerId: target.id, characterId: four.id } })).toBe(0);
  }, 60_000);

  it('freezes Event editions and corrects an active banner while preserving player pity and vote snapshots', async () => {
    const admin = await player('ADMIN');
    const definition = await db.eventDefinition.findFirstOrThrow({ where: { calendarMonth: { not: new Date().getUTCMonth() + 1 } } });
    const config = definition.config as { emoji: string; currency: { label: string; emoji: string }; collection: { key: string; label: string } };
    const edited = { ...config, emoji: '🌟' };
    await events.update(admin.identity, definition.id, { config: edited, idempotencyKey: randomUUID() });
    expect((await db.eventDefinition.findUniqueOrThrow({ where: { id: definition.id } })).config).toMatchObject({ emoji: '🌟' });
    const now = new Date();
    await db.eventEdition.create({ data: { eventDefinitionId: definition.id, year: now.getUTCFullYear(), startsAt: new Date(now.getTime() - 1000), endsAt: new Date(now.getTime() + 86_400_000), status: 'ACTIVE', snapshot: { original: true } } });
    await expect(events.update(admin.identity, definition.id, { config, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'EVENT_ADMIN_SNAPSHOT_LOCKED' });
    await events.update(admin.identity, definition.id, { isActive: false, idempotencyKey: randomUUID() });
    expect(await db.eventEdition.count({ where: { eventDefinitionId: definition.id } })).toBe(1);
    const fives = await db.character.findMany({ where: { rarity: 5, isActive: true }, take: 5 });
    const fours = await db.character.findMany({ where: { rarity: 4, isActive: true }, take: 6 });
    expect(fives.length).toBeGreaterThanOrEqual(5);
    await db.bannerRotation.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'ENDED' } });
    const rotation = await db.bannerRotation.create({ data: { startsAt: new Date(now.getTime() - 60_000), endsAt: new Date(now.getTime() + 86_400_000), status: 'ACTIVE',
      generationVoteSnapshot: { fixture: true }, featuredCharacters: { create: [
        ...fives.slice(0, 4).map((row, index) => ({ characterId: row.id, rarity: 5, slot: index + 1, selectionSource: 'RANDOM' as const })),
        ...fours.map((row, index) => ({ characterId: row.id, rarity: 4, slot: index + 1, selectionSource: 'RANDOM' as const })),
      ] } } });
    const target = await player();
    await db.playerGachaState.update({ where: { playerId: target.id }, data: { selectedBannerCharacterId: fives[0]!.id, pity5: 42, pity4: 6, guaranteedFeatured5: true, captureProgress: 2 } });
    await expect(banners.correct(admin.identity, rotation.id, { fiveStarIds: fives.slice(1).map(row => row.id), fourStarIds: fours.map(row => row.id), idempotencyKey: randomUUID() })).resolves.toMatchObject({ alreadyProcessed: false });
    expect(await db.playerGachaState.findUniqueOrThrow({ where: { playerId: target.id } })).toMatchObject({ selectedBannerCharacterId: null, pity5: 42, pity4: 6, guaranteedFeatured5: true, captureProgress: 2 });
    expect((await db.bannerRotation.findUniqueOrThrow({ where: { id: rotation.id } })).generationVoteSnapshot).toEqual({ fixture: true });
    expect(await db.bannerFeaturedCharacter.count({ where: { bannerRotationId: rotation.id } })).toBe(10);
    await expect(banners.correct(admin.identity, rotation.id, { fiveStarIds: [fives[0]!.id, fives[0]!.id, fives[1]!.id, fives[2]!.id], fourStarIds: fours.map(row => row.id), idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'BANNER_ADMIN_INVALID' });
  }, 60_000);

  it('moderates a frozen global-chat report and sanitizes the ADMIN journal', async () => {
    const reporter = await player();
    const author = await player();
    const moderator = await player('MODERATOR');
    const admin = await player('ADMIN');
    const message = await db.globalChatMessage.create({ data: { authorPlayerId: author.id, sourceChannel: 'UI', messageType: 'PLAYER', content: 'Contenu signalé' } });
    const report = await db.globalChatReport.create({ data: { reporterPlayerId: reporter.id, reportedPlayerId: author.id, messageId: message.id,
      messageSnapshot: { id: message.id, content: 'Contenu signalé' }, contextSnapshot: [{ id: message.id, content: 'Contenu signalé' }] } });
    expect((await chat.list(moderator.identity, 1)).entries.some(row => row.id === report.id)).toBe(true);
    expect((await chat.detail(moderator.identity, report.id)).contextSnapshot).toEqual([{ id: message.id, content: 'Contenu signalé' }]);
    const key = randomUUID();
    await chat.moderate(moderator.identity, report.id, key);
    expect((await chat.moderate(moderator.identity, report.id, key)).alreadyProcessed).toBe(true);
    expect((await db.globalChatMessage.findUniqueOrThrow({ where: { id: message.id } })).deletionState).toBe('MODERATION');
    expect((await chat.detail(moderator.identity, report.id)).messageSnapshot).toEqual({ id: message.id, content: 'Contenu signalé' });
    await expect(audit.list(moderator.identity, { page: 1 })).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' });
    expect((await audit.list(admin.identity, { page: 1, domain: 'global-chat' })).entries.some(row => row.targetPlayerId === author.id)).toBe(true);
    expect(sanitizeAudit({ accessToken: 'sensitive', nested: { cookie: 'hidden' }, url: 'postgresql://secret' })).toEqual({ accessToken: '[masqué]', nested: { cookie: '[masqué]' }, url: '[masqué]' });
    await chat.deleteReport(moderator.identity, report.id, randomUUID());
    expect(await db.globalChatReport.count({ where: { id: report.id } })).toBe(0);
    expect(await db.globalChatMessage.count({ where: { id: message.id } })).toBe(1);
  }, 60_000);
});
