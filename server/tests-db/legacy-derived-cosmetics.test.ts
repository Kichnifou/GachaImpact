import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { canarySnapshot } from '../tests/helpers/legacy-canary-snapshot.js';
import { applyLegacyCanary, planLegacyCanary, rollbackLegacyCanary, type CanaryBackup } from '../src/application/migration/legacy-canary.js';
import { captureTargetedPlayerRows } from '../src/application/migration/targeted-player-rows.js';
import { STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { rebuildDerivedPlayerCosmetics } from '../src/application/appearance/derived-player-cosmetics.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: true, globalEnabled: false }, twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
let actor: string, sequence = 300;
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  actor = (await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private cosmetic operator', twitchIdentity: { twitchUserId: '900000000000', login: 'kichnifou', displayName: 'Fixture', firstSeenAt: new Date() } }))).id;
  config.twitch.pilotPlayerIds.push(actor);
  await db.playerRoleAssignment.create({ data: { playerId: actor, role: 'ADMIN', source: 'private-fixture' } });
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);
async function prepare(xp: number, existing: boolean, overrides: Record<string, unknown> = {}) {
  const { snapshot, report } = canarySnapshot({ xp, ...overrides });
  report.users[0]!.twitchUserId = String(900000000000 + sequence++);
  const twitchUserId = report.users[0]!.twitchUserId;
  const expected = existing ? (await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Unrelated Web name', webIdentity: { provider: 'supabase', providerSubject: randomUUID() }, twitchIdentity: { twitchUserId, login: 'fixture_canary', displayName: 'Fixture', firstSeenAt: new Date() } }))).id : null;
  const plan = await planLegacyCanary(db, snapshot, report, twitchUserId, expected, new Date());
  expect(plan.blockers).toEqual([]);
  return { snapshot, report, plan, playerId: plan.player.playerId };
}
async function apply(plan: Awaited<ReturnType<typeof prepare>>['plan']) {
  let backup!: CanaryBackup;
  await applyLegacyCanary(db, config, actor, plan, STREAMERBOT_PATH_DISABLED, async value => { backup = value; });
  return backup;
}
async function keys(playerId: string) {
  return (await db.playerCosmetic.findMany({ where: { playerId }, include: { cosmetic: true } })).map(row => row.cosmetic.externalKey).sort();
}
describe('derived cosmetics reconstructed from final imported PostgreSQL state', () => {
  it.each([{ xp: 5189, existing: true, levels: [10, 25, 50, 75, 100] }, { xp: 1500, existing: false, levels: [10, 25, 50] }, { xp: 301, existing: false, levels: [10] }, { xp: 32, existing: false, levels: [] }])('exact titles at XP $xp, verified Web=$existing; silent and exact rollback', async ({ xp, existing, levels }) => {
    const { plan, playerId } = await prepare(xp, existing);
    expect(plan.player.mappingMode).toBe(existing ? 'EXISTING_VERIFIED_TWITCH' : 'TWITCH_ONLY');
    const backup = await apply(plan);
    expect((await keys(playerId)).filter(key => key.startsWith('title-level-'))).toEqual(levels.map(level => `title-level-${level}`).sort());
    expect(await db.notification.count({ where: { playerId } })).toBe(0);
    expect(await db.player.findUniqueOrThrow({ where: { id: playerId } })).toMatchObject({ equippedAvatarCosmeticId: null, equippedTitleCosmeticId: null });
    expect((await db.playerProgression.findUniqueOrThrow({ where: { playerId } })).xp).toBe(BigInt(xp));
    await rollbackLegacyCanary(db, config, actor, backup);
    expect((await captureTargetedPlayerRows(db, [playerId])).hash).toBe(backup.rows.hash);
  }, 180_000);
  it('creates missing avatar definitions and possessions without migration 048, then refreshes without duplicates or notifications', async () => {
    const character = await db.character.findFirstOrThrow({ where: { rarity: 5 }, orderBy: { externalKey: 'asc' } });
    await db.cosmeticDefinition.deleteMany({ where: { sourceCharacterId: character.id } });
    const state = { box: { [character.externalKey.slice(7)]: { characterId: Number(character.externalKey.slice(7)), constellation: 0, copies: 1 } }, team: [], savedTeams: {}, boxFavorites: [], combat: {} };
    const f = await prepare(301, true, state);
    const first = await apply(f.plan);
    expect(await keys(f.playerId)).toEqual([`character-avatar:${character.externalKey}`, 'title-level-10'].sort());
    const refresh = await planLegacyCanary(db, f.snapshot, f.report, f.plan.player.twitchUserId, f.playerId, new Date());
    const second = await apply(refresh);
    expect(await keys(f.playerId)).toEqual([`character-avatar:${character.externalKey}`, 'title-level-10'].sort());
    expect(await db.notification.count({ where: { playerId: f.playerId } })).toBe(0);
    await rollbackLegacyCanary(db, config, actor, second);
    expect((await captureTargetedPlayerRows(db, [f.playerId])).hash).toBe(second.rows.hash);
    // The first import's original durable backup remains independently valid.
    expect(first.hash).not.toBe(second.hash);
    await rollbackLegacyCanary(db, config, actor, first);
    expect((await captureTargetedPlayerRows(db, [f.playerId])).hash).toBe(first.rows.hash);
  }, 180_000);
  it('refuses an unclassified cosmetic before deletion, preserving the whole preimage', async () => {
    const f = await prepare(5189, true);
    const unknown = await db.cosmeticDefinition.create({ data: { externalKey: 'future-family-fixture', type: 'TITLE', displayName: 'Unknown family' } });
    await db.playerCosmetic.create({ data: { playerId: f.playerId, cosmeticId: unknown.id, unlockSource: 'private-fixture' } });
    const before = await captureTargetedPlayerRows(db, [f.playerId]);
    const plan = await planLegacyCanary(db, f.snapshot, f.report, f.plan.player.twitchUserId, f.playerId, new Date());
    expect(plan.blockers).toContain('LEGACY_COSMETIC_FAMILY_UNCLASSIFIED');
    await expect(apply(plan)).rejects.toThrow();
    expect((await captureTargetedPlayerRows(db, [f.playerId])).hash).toBe(before.hash);
  }, 180_000);
  it('rebuilds 96 avatars and five titles at level 100, then restores exactly', async () => {
    const characters = await db.character.findMany({ where: { rarity: { in: [4, 5] } }, orderBy: { externalKey: 'asc' }, take: 96 });
    expect(characters).toHaveLength(96);
    const box = Object.fromEntries(characters.map(c => [c.externalKey.slice(7), { characterId: Number(c.externalKey.slice(7)), constellation: 0, copies: 1 }]));
    const f = await prepare(5189, true, { box, team: [], savedTeams: {}, boxFavorites: [], combat: {} });
    const backup = await apply(f.plan);
    const owned = await keys(f.playerId);
    expect(owned.filter(key => key.startsWith('character-avatar:'))).toHaveLength(96);
    expect(owned.filter(key => key.startsWith('title-level-'))).toHaveLength(5);
    expect(await db.notification.count({ where: { playerId: f.playerId } })).toBe(0);
    await rollbackLegacyCanary(db, config, actor, backup);
    expect((await captureTargetedPlayerRows(db, [f.playerId])).hash).toBe(backup.rows.hash);
  }, 180_000);
  it('replaces stale derived possessions from the imported state, clears equipment, and restores its exact original equipment on rollback', async () => {
    const f = await prepare(32, true);
    await db.playerProgression.update({ where: { playerId: f.playerId }, data: { xp: 5189n } });
    await db.$transaction(tx => rebuildDerivedPlayerCosmetics(tx, { playerId: f.playerId, now: new Date(), source: 'PRIVATE_FIXTURE', provenance: { mode: 'SILENT_BACKFILL' } }));
    const title = await db.cosmeticDefinition.findUniqueOrThrow({ where: { externalKey: 'title-level-100' } });
    await db.player.update({ where: { id: f.playerId }, data: { equippedTitleCosmeticId: title.id } });
    const plan = await planLegacyCanary(db, f.snapshot, f.report, f.plan.player.twitchUserId, f.playerId, new Date());
    const backup = await apply(plan);
    expect((await keys(f.playerId)).filter(key => key.startsWith('title-level-'))).toEqual([]);
    expect((await db.player.findUniqueOrThrow({ where: { id: f.playerId } })).equippedTitleCosmeticId).toBeNull();
    await rollbackLegacyCanary(db, config, actor, backup);
    expect((await captureTargetedPlayerRows(db, [f.playerId])).hash).toBe(backup.rows.hash);
    expect((await db.player.findUniqueOrThrow({ where: { id: f.playerId } })).equippedTitleCosmeticId).toBe(title.id);
  }, 180_000);
});
