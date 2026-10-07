import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { planLegacyCanary, applyLegacyCanary } from '../src/application/migration/legacy-canary.js';
import { canarySnapshot } from '../tests/helpers/legacy-canary-snapshot.js';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';
import { createVerifiedTwitchReport } from '../src/application/migration/verified-twitch-report.js';
import { captureTargetedPlayerRows, rowGraphHash } from '../src/application/migration/targeted-player-rows.js';
import { planImportedCanaryCosmeticRepair, applyImportedCanaryCosmeticRepair, type CosmeticRepairScope } from '../src/application/migration/repair-imported-canary-cosmetics.js';
import { STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: true, globalEnabled: false }, twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
let actor: string;
const scopes: CosmeticRepairScope[] = [];
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  actor = (await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private repair operator', twitchIdentity: { twitchUserId: '900000000000', login: 'kichnifou', displayName: 'Fixture', firstSeenAt: new Date() } }))).id;
  config.twitch.pilotPlayerIds.push(actor);
  await db.playerRoleAssignment.create({ data: { playerId: actor, role: 'ADMIN', source: 'private-fixture' } });
  const characters = await db.character.findMany({ where: { rarity: { in: [4, 5] } }, orderBy: { externalKey: 'asc' }, take: 96 });
  for (const [index, count, xp] of [[0, 96, 5189], [1, 2, 301], [2, 0, 32]]) {
    const box = Object.fromEntries(characters.slice(0, count).map(c => [c.externalKey.slice(7), { characterId: Number(c.externalKey.slice(7)), constellation: 0, copies: 1 }]));
    const original = canarySnapshot({ xp, box, team: [], savedTeams: {}, boxFavorites: [], combat: {} });
    const snapshot = parseStreamerbotSnapshot(Object.fromEntries(snapshotFileNames.map(name => [name, JSON.stringify(name === 'c6_characters.json' ? {} : original.snapshot.sources[name])])));
    const report = createVerifiedTwitchReport(snapshot, { users: [{ ...original.report.users[0]!, twitchUserId: String(900000001000 + index!) }], missing: [], conflicts: [], duplicates: 0 }, new Date(), { kind: 'CANARY', legacyLogin: 'fixture_canary' });
    const plan = await planLegacyCanary(db, snapshot, report, report.users[0]!.twitchUserId, null, new Date());
    expect(plan.blockers).toEqual([]);
    const result = await applyLegacyCanary(db, config, actor, plan, STREAMERBOT_PATH_DISABLED, async () => {});
    // Simulate the exact pre-fix omissions, solely in this private schema.
    await db.playerCosmetic.deleteMany({ where: { playerId: result.playerId, cosmetic: { type: 'TITLE' } } });
    if (index === 0) {
      const avatars = await db.playerCosmetic.findMany({ where: { playerId: result.playerId, cosmetic: { sourceCharacterId: { in: characters.slice(-2).map(c => c.id) } } } });
      await db.playerCosmetic.deleteMany({ where: { playerId: result.playerId, cosmeticId: { in: avatars.map(a => a.cosmeticId) } } });
      await db.cosmeticDefinition.deleteMany({ where: { id: { in: avatars.map(a => a.cosmeticId) } } });
    }
    await db.twitchNativeTarget.update({ where: { twitchUserId: report.users[0]!.twitchUserId }, data: { canary: true, dataAuthority: 'NATIVE', acknowledgement: STREAMERBOT_PATH_DISABLED, transferredAt: new Date() } });
    scopes.push({ actorPlayerId: actor, playerId: result.playerId, twitchUserId: report.users[0]!.twitchUserId, backupHash: result.backupHash, expectedRevision: 9, acknowledgement: STREAMERBOT_PATH_DISABLED });
  }
  await db.twitchNativeAuthority.upsert({ where: { id: 'twitch-commands' }, create: { id: 'twitch-commands', desiredMode: 'OFF', revision: 9 }, update: { desiredMode: 'OFF', revision: 9 } });
}, 180_000);
afterAll(() => fixture.cleanup(), 60_000);
const confirmation = (plan: Awaited<ReturnType<typeof planImportedCanaryCosmeticRepair>>) => ({ planHash: plan.planHash, avatars: plan.missingAvatars, titles: plan.missingTitles });
describe('canonical repair of exactly three imported canaries', () => {
  it('dry-run is byte-exact read-only and derives exact +2/+5, +0/+1, +0/+0 from current PostgreSQL', async () => {
    const before = await captureTargetedPlayerRows(db, scopes.map(s => s.playerId));
    const audits = await db.twitchNativeAudit.findMany();
    for (const [index, scope] of scopes.entries()) {
      const plan = await planImportedCanaryCosmeticRepair(db, config, scope);
      expect([plan.missingAvatars, plan.missingTitles]).toEqual([[2, 5], [0, 1], [0, 0]][index]);
    }
    expect((await captureTargetedPlayerRows(db, scopes.map(s => s.playerId))).hash).toBe(before.hash);
    expect(await db.twitchNativeAudit.findMany()).toEqual(audits);
  }, 180_000);
  it('durable backup failure aborts without definitions, possessions or audit', async () => {
    const scope = scopes[0]!, plan = await planImportedCanaryCosmeticRepair(db, config, scope);
    const definitions = await db.cosmeticDefinition.findMany();
    const audits = await db.twitchNativeAudit.findMany();
    await expect(applyImportedCanaryCosmeticRepair(db, config, scope, confirmation(plan), async () => { throw new Error('PRIVATE_BACKUP_FAILURE'); })).rejects.toThrow('PRIVATE_BACKUP_FAILURE');
    expect((await captureTargetedPlayerRows(db, [scope.playerId])).hash).toBe(plan.graph.hash);
    expect(await db.cosmeticDefinition.findMany()).toEqual(definitions);
    expect(await db.twitchNativeAudit.findMany()).toEqual(audits);
  }, 180_000);
  it.each(['playerId', 'twitchUserId', 'backupHash', 'expectedRevision', 'acknowledgement', 'actorPlayerId'] as const)('fails closed on wrong immutable scope / operator: %s', async key => {
    const scope = { ...scopes[0]!, [key]: key === 'expectedRevision' ? 10 : key.endsWith('PlayerId') || key === 'playerId' ? '10000000-0000-4000-8000-000000000001' : 'invalid' };
    await expect(planImportedCanaryCosmeticRepair(db, config, scope)).rejects.toThrow();
  }, 60_000);
  it('requires OFF, refuses a fourth target and blocks nonterminal operations', async () => {
    const scope = scopes[0]!;
    await db.twitchNativeAuthority.update({ where: { id: 'twitch-commands' }, data: { desiredMode: 'CANARY', operatorPlayerId: actor, acknowledgement: STREAMERBOT_PATH_DISABLED, acknowledgedAt: new Date() } });
    await expect(planImportedCanaryCosmeticRepair(db, config, scope)).rejects.toThrow('COSMETIC_REPAIR_OFF_REVISION_ACK_REQUIRED');
    await db.twitchNativeAuthority.update({ where: { id: 'twitch-commands' }, data: { desiredMode: 'OFF' } });
    await db.twitchNativeTarget.create({ data: { twitchUserId: '900000009999' } });
    await expect(planImportedCanaryCosmeticRepair(db, config, scope)).rejects.toThrow('COSMETIC_REPAIR_THREE_IMPORTED_CANARIES_REQUIRED');
    await db.twitchNativeTarget.delete({ where: { twitchUserId: '900000009999' } });
    const operation = await db.businessOperation.create({ data: { playerId: scope.playerId, operationType: 'private-fixture', sourceChannel: 'UI', idempotencyKey: 'private-repair-blocker', status: 'PENDING' } });
    await expect(planImportedCanaryCosmeticRepair(db, config, scope)).rejects.toThrow('COSMETIC_REPAIR_OPERATIONS_IN_FLIGHT');
    await db.businessOperation.delete({ where: { id: operation.id } });
  }, 120_000);
  it('refuses stale plans and incorrect expected counts before calling backup', async () => {
    const scope = scopes[0]!, plan = await planImportedCanaryCosmeticRepair(db, config, scope);
    await expect(applyImportedCanaryCosmeticRepair(db, config, scope, { ...confirmation(plan), avatars: 3 }, async () => { throw new Error('MUST_NOT_WRITE'); })).rejects.toThrow('COSMETIC_REPAIR_PLAN_CHANGED');
    await db.playerProgression.update({ where: { playerId: scope.playerId }, data: { xp: { increment: 1n } } });
    await expect(applyImportedCanaryCosmeticRepair(db, config, scope, confirmation(plan), async () => { throw new Error('MUST_NOT_WRITE'); })).rejects.toThrow('COSMETIC_REPAIR_PLAN_CHANGED');
    await db.playerProgression.update({ where: { playerId: scope.playerId }, data: { xp: { decrement: 1n } } });
  }, 180_000);
  it('refuses a conflicting catalog definition and an unclassified possession without clearing anything', async () => {
    const scope = scopes[0]!;
    const title = await db.cosmeticDefinition.findUniqueOrThrow({ where: { externalKey: 'title-level-100' } });
    await db.cosmeticDefinition.update({ where: { id: title.id }, data: { isActive: false } });
    await expect(planImportedCanaryCosmeticRepair(db, config, scope)).rejects.toThrow('DERIVED_COSMETIC_DEFINITION_CONFLICT');
    await db.cosmeticDefinition.update({ where: { id: title.id }, data: { isActive: true } });
    const unknown = await db.cosmeticDefinition.create({ data: { externalKey: 'future-repair-fixture', type: 'TITLE', displayName: 'Future fixture' } });
    await db.playerCosmetic.create({ data: { playerId: scope.playerId, cosmeticId: unknown.id, unlockSource: 'private-fixture' } });
    const before = await captureTargetedPlayerRows(db, [scope.playerId]);
    await expect(planImportedCanaryCosmeticRepair(db, config, scope)).rejects.toThrow('LEGACY_COSMETIC_FAMILY_UNCLASSIFIED');
    expect((await captureTargetedPlayerRows(db, [scope.playerId])).hash).toBe(before.hash);
    await db.playerCosmetic.delete({ where: { playerId_cosmeticId: { playerId: scope.playerId, cosmeticId: unknown.id } } });
  }, 180_000);
  it('repairs only missing possessions, silently; one audit on change; fresh replay is a no-op', async () => {
    const before = await captureTargetedPlayerRows(db, scopes.map(s => s.playerId));
    const imports = await db.twitchCanaryImport.findMany(), targets = await db.twitchNativeTarget.findMany(), control = await db.twitchNativeAuthority.findMany();
    for (const [index, scope] of scopes.entries()) {
      const plan = await planImportedCanaryCosmeticRepair(db, config, scope);
      let backups = 0;
      const result = await applyImportedCanaryCosmeticRepair(db, config, scope, confirmation(plan), async preimage => { expect(preimage.graph.hash).toBe(plan.graph.hash); backups++; });
      expect([result.avatars, result.titles]).toEqual([[2, 5], [0, 1], [0, 0]][index]);
      expect(backups).toBe(index === 2 ? 0 : 1);
      const exact = await planImportedCanaryCosmeticRepair(db, config, scope);
      expect(exact.derived.actual).toEqual(exact.derived.expected);
      const audit = await db.twitchNativeAudit.findMany({ where: { action: 'DERIVED_COSMETICS_REPAIRED', twitchUserId: scope.twitchUserId } });
      expect(audit).toHaveLength(index === 2 ? 0 : 1);
      expect(await applyImportedCanaryCosmeticRepair(db, config, scope, confirmation(exact), async () => { throw new Error('NOOP_MUST_NOT_WRITE'); })).toMatchObject({ status: 'ALREADY_EXACT' });
      expect(await db.twitchNativeAudit.findMany({ where: { action: 'DERIVED_COSMETICS_REPAIRED', twitchUserId: scope.twitchUserId } })).toEqual(audit);
    }
    const after = await captureTargetedPlayerRows(db, scopes.map(s => s.playerId));
    const gameplay = (tables: typeof before.tables) => Object.fromEntries(Object.entries(tables).filter(([table]) => table !== 'player_cosmetics'));
    expect(rowGraphHash(gameplay(after.tables))).toBe(rowGraphHash(gameplay(before.tables)));
    expect(await db.twitchCanaryImport.findMany()).toEqual(imports);
    expect(await db.twitchNativeTarget.findMany()).toEqual(targets);
    expect(await db.twitchNativeAuthority.findMany()).toEqual(control);
    expect(await db.notification.count({ where: { playerId: { in: scopes.map(s => s.playerId) } } })).toBe(0);
  }, 180_000);
});
