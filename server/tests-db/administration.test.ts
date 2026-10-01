import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
import { PrismaModerationTools } from '../src/infrastructure/database/prisma-moderation-tools.js';
import { resolveCurrentEventPeriod } from '../src/application/event/event-service.js';
import type { WeeklyBannerScheduler } from '../src/application/gacha/weekly-banner-scheduler.js';
import { getParisWeekWindow } from '../src/domain/gacha/gacha.js';

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
const legacyTools = new PrismaModerationTools(db, getPlayer);
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
    expect((await legacyTools.getPermissions(actor.identity)).capabilities.superTools).toBe(false);
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
    const metadataKey = randomUUID();
    await characters.update(identity, row.id, { name: 'Nom corrigé', weaponType: 'sword', region: 'Région test', classKey: 'support', displayOrder: 17, idempotencyKey: metadataKey });
    expect((await characters.update(identity, row.id, { name: 'Nom corrigé', weaponType: 'sword', region: 'Région test', classKey: 'support', displayOrder: 17, idempotencyKey: metadataKey })).alreadyProcessed).toBe(true);
    const metadataAudit = await db.adminAuditEntry.findFirstOrThrow({ where: { operation: { idempotencyKey: metadataKey } } });
    expect(metadataAudit.before).toEqual({ characterId: row.id, externalKey: key, name: 'Test Administration', rarity: 5, elementKey: 'hydro', weaponType: null, region: null, classKey: null, displayOrder: null, isActive: true });
    expect(metadataAudit.after).toEqual({ characterId: row.id, externalKey: key, name: 'Nom corrigé', rarity: 5, elementKey: 'hydro', weaponType: 'sword', region: 'Région test', classKey: 'support', displayOrder: 17, isActive: true });
    const missionsBefore = await db.playerPermanentMissionProgress.count({ where: { playerId: target.id } });
    const addKey = randomUUID();
    await possessions.change(identity, target.id, row.id, { action: 'add', idempotencyKey: addKey });
    expect((await possessions.change(identity, target.id, row.id, { action: 'add', idempotencyKey: addKey })).alreadyProcessed).toBe(true);
    expect(await db.playerCosmetic.count({ where: { playerId: target.id } })).toBe(1);
    expect(await db.notification.count({ where: { playerId: target.id } })).toBe(0);
    expect(await db.pullOperation.count({ where: { playerId: target.id } })).toBe(0);
    expect(await db.playerPermanentMissionProgress.count({ where: { playerId: target.id } })).toBe(missionsBefore);
    expect(await db.playerGachaState.findUniqueOrThrow({ where: { playerId: target.id } })).toMatchObject({ totalPulls: 0n, totalFiveStars: 0n, totalFourStars: 0n });
    await possessions.change(identity, target.id, row.id, { action: 'constellation', constellation: 6, idempotencyKey: randomUUID() });
    expect(await db.c6CompetitionProgress.findUnique({ where: { playerId_characterId: { playerId: target.id, characterId: row.id } } })).not.toBeNull();
    await possessions.change(identity, target.id, row.id, { action: 'constellation', constellation: 5, idempotencyKey: randomUUID() });
    expect(await db.c6CompetitionProgress.findUnique({ where: { playerId_characterId: { playerId: target.id, characterId: row.id } } })).not.toBeNull();
    expect(await db.playerCharacter.count({ where: { playerId: target.id, characterId: row.id, constellation: 6 } })).toBe(0);
    await expect(possessions.change(identity, target.id, row.id, { action: 'constellation', constellation: 7, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'POSSESSION_INVALID' });
    await expect(characters.update(identity, row.id, { rarity: 4, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'CHARACTER_IDENTITY_LOCKED' });
    const deactivateKey = randomUUID();
    await characters.update(identity, row.id, { isActive: false, idempotencyKey: deactivateKey });
    expect((await db.adminAuditEntry.findFirstOrThrow({ where: { operation: { idempotencyKey: deactivateKey } } })).after).toMatchObject({ isActive: false, weaponType: 'sword', region: 'Région test', displayOrder: 17 });
    expect(await db.playerCharacter.count({ where: { characterId: row.id, playerId: target.id } })).toBe(1);
    expect(await db.playerCosmetic.count({ where: { playerId: target.id } })).toBe(1);
    const other = await player();
    await expect(possessions.change(identity, other.id, row.id, { action: 'add', idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'POSSESSION_INVALID' });
    expect(await db.playerCharacter.count({ where: { playerId: other.id } })).toBe(0);
    expect(await db.playerCosmetic.count({ where: { playerId: other.id } })).toBe(0);
    await characters.update(identity, row.id, { isActive: true, idempotencyKey: randomUUID() });
    expect((await db.character.findUniqueOrThrow({ where: { id: row.id } })).isActive).toBe(true);
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
    const currentMonth = resolveCurrentEventPeriod(new Date()).month;
    const definition = await db.eventDefinition.findFirstOrThrow({ where: { calendarMonth: { not: currentMonth } } });
    const config = definition.config as { emoji: string; currency: { label: string; emoji: string }; collection: { key: string; label: string } };
    const edited = { ...config, emoji: '🌟' };
    await expect(events.update(admin.identity, definition.id, { config: { ...config, emoji: '' }, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'EVENT_ADMIN_INVALID' });
    expect((await db.eventDefinition.findUniqueOrThrow({ where: { id: definition.id } })).config).toEqual(config);
    const configKey = randomUUID();
    await events.update(admin.identity, definition.id, { config: edited, idempotencyKey: configKey });
    expect((await events.update(admin.identity, definition.id, { config: edited, idempotencyKey: configKey })).alreadyProcessed).toBe(true);
    expect((await db.eventDefinition.findUniqueOrThrow({ where: { id: definition.id } })).config).toMatchObject({ emoji: '🌟' });
    const currentDefinition = await db.eventDefinition.findFirstOrThrow({ where: { calendarMonth: currentMonth } });
    await expect(events.update(admin.identity, currentDefinition.id, { config: edited, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'EVENT_ADMIN_SNAPSHOT_LOCKED' });
    const scheduledDefinition = await db.eventDefinition.findFirstOrThrow({ where: { id: { not: definition.id }, calendarMonth: { not: currentMonth } } });
    await db.eventEdition.create({ data: { eventDefinitionId: scheduledDefinition.id, year: 2099, startsAt: new Date('2099-01-01T00:00:00Z'), endsAt: new Date('2099-02-01T00:00:00Z'), status: 'SCHEDULED', snapshot: { scheduled: true } } });
    await expect(events.update(admin.identity, scheduledDefinition.id, { config: edited, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'EVENT_ADMIN_SNAPSHOT_LOCKED' });
    const now = new Date();
    const edition = await db.eventEdition.create({ data: { eventDefinitionId: definition.id, year: now.getUTCFullYear(), startsAt: new Date(now.getTime() - 1000), endsAt: new Date(now.getTime() + 86_400_000), status: 'ACTIVE', snapshot: { original: true } } });
    const eventPlayer = await player();
    await db.eventParticipant.create({ data: { eventEditionId: edition.id, playerId: eventPlayer.id, points: 42 } });
    await db.eventMilestoneClaim.create({ data: { eventEditionId: edition.id, playerId: eventPlayer.id, milestone: 10, origin: 'LEGACY', legacyProvenance: { fixture: true } } });
    await db.playerEventCurrencyBalance.create({ data: { playerId: eventPlayer.id, eventDefinitionId: definition.id, amount: 33n } });
    const eventBefore = { edition: await db.eventEdition.findUniqueOrThrow({ where: { id: edition.id } }),
      participant: await db.eventParticipant.findUniqueOrThrow({ where: { eventEditionId_playerId: { eventEditionId: edition.id, playerId: eventPlayer.id } } }),
      claim: await db.eventMilestoneClaim.findFirstOrThrow({ where: { eventEditionId: edition.id, playerId: eventPlayer.id } }),
      balance: await db.playerEventCurrencyBalance.findUniqueOrThrow({ where: { playerId_eventDefinitionId: { playerId: eventPlayer.id, eventDefinitionId: definition.id } } }) };
    await expect(events.update(admin.identity, definition.id, { config, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'EVENT_ADMIN_SNAPSHOT_LOCKED' });
    await events.update(admin.identity, definition.id, { isActive: false, idempotencyKey: randomUUID() });
    expect(await db.eventEdition.count({ where: { eventDefinitionId: definition.id } })).toBe(1);
    expect(await db.eventEdition.findUniqueOrThrow({ where: { id: edition.id } })).toEqual(eventBefore.edition);
    expect(await db.eventParticipant.findUniqueOrThrow({ where: { eventEditionId_playerId: { eventEditionId: edition.id, playerId: eventPlayer.id } } })).toEqual(eventBefore.participant);
    expect(await db.eventMilestoneClaim.findFirstOrThrow({ where: { eventEditionId: edition.id, playerId: eventPlayer.id } })).toEqual(eventBefore.claim);
    expect(await db.playerEventCurrencyBalance.findUniqueOrThrow({ where: { playerId_eventDefinitionId: { playerId: eventPlayer.id, eventDefinitionId: definition.id } } })).toEqual(eventBefore.balance);
    await db.eventDefinition.update({ where: { id: definition.id }, data: { config: { broken: true } } });
    await expect(events.update(admin.identity, definition.id, { isActive: true, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'EVENT_ADMIN_INVALID' });
    await db.eventDefinition.update({ where: { id: definition.id }, data: { config: edited } });
    await events.update(admin.identity, definition.id, { isActive: true, idempotencyKey: randomUUID() });
    expect((await db.eventDefinition.findUniqueOrThrow({ where: { id: definition.id } })).isActive).toBe(true);
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
    const keptTarget = await player();
    await db.playerGachaState.update({ where: { playerId: keptTarget.id }, data: { selectedBannerCharacterId: fives[1]!.id, pity5: 15, pity4: 4 } });
    const pullBusiness = await db.businessOperation.create({ data: { playerId: target.id, sourceChannel: 'UI', operationType: 'gacha.pull', idempotencyKey: randomUUID(), status: 'COMPLETED' } });
    const historicPull = await db.pullOperation.create({ data: { playerId: target.id, bannerRotationId: rotation.id, targetCharacterId: fives[0]!.id,
      pullCount: 1, primogemCost: 160n, sourceChannel: 'UI', businessOperationId: pullBusiness.id,
      results: { create: { resultIndex: 1, resultType: 'character', characterId: fives[0]!.id, rarity: 5,
        wasNewCharacter: true, constellationAfter: 0, copiesAfter: 1, snapshot: { historic: true } } } }, include: { results: true } });
    const beforeFeatured = await db.bannerFeaturedCharacter.findMany({ where: { bannerRotationId: rotation.id }, orderBy: [{ rarity: 'desc' }, { slot: 'asc' }] });
    await expect(banners.correct(admin.identity, rotation.id, { fiveStarIds: [fives[0]!.id, fives[0]!.id, fives[1]!.id, fives[2]!.id], fourStarIds: fours.map(row => row.id), idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'BANNER_ADMIN_INVALID' });
    expect(await db.bannerFeaturedCharacter.findMany({ where: { bannerRotationId: rotation.id }, orderBy: [{ rarity: 'desc' }, { slot: 'asc' }] })).toEqual(beforeFeatured);
    const correctedFives = fives.slice(1).map(row => row.id);
    const correctedFours = fours.map(row => row.id);
    const correctionKey = randomUUID();
    await expect(banners.correct(admin.identity, rotation.id, { fiveStarIds: correctedFives, fourStarIds: correctedFours, idempotencyKey: correctionKey })).resolves.toMatchObject({ alreadyProcessed: false });
    expect((await banners.correct(admin.identity, rotation.id, { fiveStarIds: correctedFives, fourStarIds: correctedFours, idempotencyKey: correctionKey })).alreadyProcessed).toBe(true);
    await expect(banners.correct(admin.identity, rotation.id, { fiveStarIds: fives.slice(0, 4).map(row => row.id), fourStarIds: correctedFours, idempotencyKey: correctionKey })).rejects.toMatchObject({ code: 'MODERATION_IDEMPOTENCY_CONFLICT' });
    expect(await db.playerGachaState.findUniqueOrThrow({ where: { playerId: target.id } })).toMatchObject({ selectedBannerCharacterId: null, pity5: 42, pity4: 6, guaranteedFeatured5: true, captureProgress: 2 });
    expect(await db.playerGachaState.findUniqueOrThrow({ where: { playerId: keptTarget.id } })).toMatchObject({ selectedBannerCharacterId: fives[1]!.id, pity5: 15, pity4: 4 });
    expect((await db.bannerRotation.findUniqueOrThrow({ where: { id: rotation.id } })).generationVoteSnapshot).toEqual({ fixture: true });
    expect(await db.bannerFeaturedCharacter.count({ where: { bannerRotationId: rotation.id } })).toBe(10);
    expect(await db.pullOperation.findUniqueOrThrow({ where: { id: historicPull.id }, include: { results: true } })).toEqual(historicPull);
    const correctedRows = await db.bannerFeaturedCharacter.findMany({ where: { bannerRotationId: rotation.id }, orderBy: [{ rarity: 'desc' }, { slot: 'asc' }] });
    const rollbackKey = randomUUID();
    // A private-schema trigger fails after the service has deleted the old slots.
    // SERIALIZABLE must roll back that deletion, target changes and the operation/audit.
    await db.$executeRawUnsafe(`CREATE FUNCTION admin_test_reject_banner_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private test insert failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER admin_test_reject_banner_insert BEFORE INSERT ON banner_featured_characters FOR EACH ROW EXECUTE FUNCTION admin_test_reject_banner_insert()`);
    try {
      await expect(banners.correct(admin.identity, rotation.id, { fiveStarIds: fives.slice(0, 4).map(row => row.id), fourStarIds: correctedFours, idempotencyKey: rollbackKey })).rejects.toThrow();
      expect(await db.bannerFeaturedCharacter.findMany({ where: { bannerRotationId: rotation.id }, orderBy: [{ rarity: 'desc' }, { slot: 'asc' }] })).toEqual(correctedRows);
      expect((await db.playerGachaState.findUniqueOrThrow({ where: { playerId: keptTarget.id } })).selectedBannerCharacterId).toBe(fives[1]!.id);
      expect(await db.businessOperation.count({ where: { sourceChannel: 'ADMIN', idempotencyKey: rollbackKey } })).toBe(0);
      expect(await db.adminAuditEntry.count({ where: { operation: { idempotencyKey: rollbackKey } } })).toBe(0);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER admin_test_reject_banner_insert ON banner_featured_characters`);
      await db.$executeRawUnsafe(`DROP FUNCTION admin_test_reject_banner_insert()`);
    }
  }, 60_000);

  it('retries the scheduler after a recorded generation request without duplicating the audit', async () => {
    const admin = await player('ADMIN');
    const catchUp = vi.fn().mockRejectedValueOnce(new Error('scheduler temporarily unavailable')).mockResolvedValue(undefined);
    const service = new BannerAdminService(db, getPlayer, { catchUp } as unknown as WeeklyBannerScheduler);
    const key = randomUUID();
    const week = getParisWeekWindow(new Date()).startsAt.toISOString();
    const staleKey = randomUUID();
    await expect(service.retryGeneration(admin.identity, staleKey, new Date(Date.parse(week) - 7 * 86400000).toISOString()))
      .rejects.toMatchObject({ statusCode: 409, code: 'BANNER_ADMIN_WEEK_CHANGED' });
    expect(await db.adminAuditEntry.count({ where: { operation: { idempotencyKey: staleKey } } })).toBe(0);
    await expect(service.retryGeneration(admin.identity, key, week)).rejects.toThrow('scheduler temporarily unavailable');
    expect(await db.adminAuditEntry.count({ where: { operation: { idempotencyKey: key } } })).toBe(1);
    expect((await service.retryGeneration(admin.identity, key, week)).alreadyProcessed).toBe(true);
    expect(catchUp).toHaveBeenCalledTimes(2);
    expect(await db.adminAuditEntry.count({ where: { operation: { idempotencyKey: key } } })).toBe(1);
  }, 60_000);

  it('moderates a frozen global-chat report and sanitizes the ADMIN journal', async () => {
    const reporter = await player();
    const author = await player();
    const moderator = await player('MODERATOR');
    const tester = await player('TESTER');
    const admin = await player('ADMIN');
    const message = await db.globalChatMessage.create({ data: { authorPlayerId: author.id, sourceChannel: 'UI', messageType: 'PLAYER', content: 'Contenu signalé' } });
    const report = await db.globalChatReport.create({ data: { reporterPlayerId: reporter.id, reportedPlayerId: author.id, messageId: message.id,
      messageSnapshot: { id: message.id, content: 'Contenu signalé' }, contextSnapshot: [{ id: message.id, content: 'Contenu signalé' }] } });
    expect((await chat.list(moderator.identity, 1)).entries.some(row => row.id === report.id)).toBe(true);
    expect((await chat.list(admin.identity, 1)).entries.some(row => row.id === report.id)).toBe(true);
    await expect(chat.list(tester.identity, 1)).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' });
    await expect(chat.list(reporter.identity, 1)).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' });
    expect((await chat.detail(moderator.identity, report.id)).contextSnapshot).toEqual([{ id: message.id, content: 'Contenu signalé' }]);
    const key = randomUUID();
    await chat.moderate(moderator.identity, report.id, key);
    expect((await chat.moderate(moderator.identity, report.id, key)).alreadyProcessed).toBe(true);
    expect((await db.globalChatMessage.findUniqueOrThrow({ where: { id: message.id } })).deletionState).toBe('MODERATION');
    expect(await db.globalChatReport.count({ where: { id: report.id } })).toBe(1);
    expect((await chat.detail(moderator.identity, report.id)).messageSnapshot).toEqual({ id: message.id, content: 'Contenu signalé' });
    await expect(audit.list(moderator.identity, { page: 1 })).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' });
    expect((await audit.list(admin.identity, { page: 1, domain: 'global-chat' })).entries.some(row => row.targetPlayerId === author.id)).toBe(true);
    expect(sanitizeAudit({ accessToken: 'sensitive', nested: { cookie: 'hidden' }, url: 'postgresql://secret' })).toEqual({ accessToken: '[masqué]', nested: { cookie: '[masqué]' }, url: '[masqué]' });
    const deleteKey = randomUUID();
    await chat.deleteReport(moderator.identity, report.id, deleteKey);
    expect((await chat.deleteReport(moderator.identity, report.id, deleteKey)).alreadyProcessed).toBe(true);
    expect((await chat.moderate(moderator.identity, report.id, key)).alreadyProcessed).toBe(true);
    expect(await db.globalChatReport.count({ where: { id: report.id } })).toBe(0);
    expect(await db.globalChatMessage.count({ where: { id: message.id } })).toBe(1);
  }, 60_000);

  it('pages and filters a stable read-only Journal while masking old secrets in list and detail', async () => {
    const admin = await player('ADMIN');
    const target = await player();
    const tester = await player('TESTER');
    const createdAt = new Date('2026-09-30T12:00:00Z');
    const fixtures = Array.from({ length: 21 }, (_, index) => ({ id: randomUUID(), operationId: randomUUID(), index }));
    await db.businessOperation.createMany({ data: fixtures.map(row => ({ id: row.operationId, playerId: target.id,
      operationType: 'moderation.audit-review-fixture.inspect', sourceChannel: 'ADMIN', idempotencyKey: randomUUID(), status: 'COMPLETED' })) });
    await db.adminAuditEntry.createMany({ data: fixtures.map(row => ({ id: row.id, operationId: row.operationId, actorPlayerId: admin.id,
      targetPlayerId: row.index % 2 ? admin.id : target.id, domain: 'audit-review-fixture', action: row.index % 2 ? 'change' : 'inspect',
      createdAt, before: { accessToken: 'secret', cookie: 'session', note: 'postgresql://private' },
      after: { jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature', safe: row.index } })) });
    await expect(audit.list(tester.identity, { page: 1 })).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' });
    const first = await audit.list(admin.identity, { page: 1, domain: 'audit-review-fixture' });
    const second = await audit.list(admin.identity, { page: 2, domain: 'audit-review-fixture' });
    const third = await audit.list(admin.identity, { page: 3, domain: 'audit-review-fixture' });
    expect(first).toMatchObject({ pageSize: 10, totalPages: 3, total: 21 });
    expect(first.entries).toHaveLength(10);
    expect(second.entries).toHaveLength(10);
    expect(third.entries).toHaveLength(1);
    expect([...first.entries, ...second.entries, ...third.entries].map(row => row.id)).toEqual(fixtures.map(row => row.id).sort().reverse());
    expect((await audit.list(admin.identity, { page: 99, domain: 'audit-review-fixture' })).page).toBe(3);
    const filtered = await audit.list(admin.identity, { page: 1, domain: 'audit-review-fixture', action: 'inspect', actorId: admin.id, targetId: target.id });
    expect(filtered.total).toBe(11);
    expect(filtered.entries.every(row => row.actorPlayerId === admin.id && row.targetPlayerId === target.id && row.action === 'inspect')).toBe(true);
    const detail = await audit.detail(admin.identity, filtered.entries[0]!.id);
    expect(detail.before).toEqual({ accessToken: '[masqué]', cookie: '[masqué]', note: '[masqué]' });
    expect(detail.after).toEqual({ jwt: '[masqué]', safe: expect.any(Number) });
    expect(await db.adminAuditEntry.count({ where: { domain: 'audit-review-fixture' } })).toBe(21);
  }, 60_000);
});
