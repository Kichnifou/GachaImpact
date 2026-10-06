import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { planLegacyCanary, applyLegacyCanary, rollbackLegacyCanary, type CanaryBackup } from '../src/application/migration/legacy-canary.js';
import { TwitchNativeAuthority, STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { canarySnapshot } from '../tests/helpers/legacy-canary-snapshot.js';
import { captureTargetedPlayerRows } from '../src/application/migration/targeted-player-rows.js';
import { buildCutoverPurgePlan, applyPrivateCutoverPurge, assertCutoverProtectedRows } from '../src/application/migration/legacy-cutover-purge.js';
import { buildLegacyGlobalPlan } from '../src/application/migration/legacy-global-plan.js';
import { applyLegacyPersonalState } from '../src/application/migration/legacy-personal-apply.js';
import { applyLegacySocial } from '../src/application/migration/legacy-social-apply.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: true, globalEnabled: false },
  twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
let operatorId: string;
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  const operator = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private operator',
    twitchIdentity: { twitchUserId: '900000000000', login: 'kichnifou', displayName: 'Private operator', firstSeenAt: new Date() } }));
  operatorId = operator.id; config.twitch.pilotPlayerIds.push(operatorId);
  await db.playerRoleAssignment.create({ data: { playerId: operatorId, role: 'ADMIN', source: 'private-fixture' } });
}, 60_000);
afterAll(async () => fixture.cleanup(), 60_000);

describe('single legacy canary with exact private backup/rollback', () => {
  it.each([false, true])('imports only the selected Player (existing verified web=%s), preserves globals and restores exact preimage', async existing => {
    const { snapshot, report } = canarySnapshot(), twitchUserId = report.users[0]!.twitchUserId;
    let expected: string | null = null;
    if (existing) {
      const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Standalone display name',
        webIdentity: { provider: 'supabase', providerSubject: randomUUID() }, twitchIdentity: { twitchUserId, login: 'different_metadata', displayName: 'Metadata', firstSeenAt: new Date() } }));
      expected = player.id;
      await db.playerProgression.update({ where: { playerId: expected }, data: { xp: 888n } });
      await db.playerRoleAssignment.create({ data: { playerId: expected, role: 'TESTER', source: 'preserve-me' } });
      await db.playerPreference.create({ data: { playerId: expected, preferenceKey: 'menu.defaultTab', value: 'inventory' } });
      await db.privacySetting.update({ where: { playerId_categoryKey: { playerId: expected, categoryKey: 'PRIVATE_MESSAGES' } }, data: { level: 'FRIENDS' } });
    }
    const globalBefore = { editions: await db.eventEdition.findMany(), banners: await db.bannerRotation.findMany(), operator: await db.playerProgression.findUnique({ where: { playerId: operatorId } }) };
    const plan = await planLegacyCanary(db, snapshot, report, twitchUserId, expected, new Date());
    expect(plan.blockers).toEqual([]);
    expect(plan.deferred.byDomain.SOCIAL).toBe(1);
    const beforeCount = await db.player.count();
    let backup!: CanaryBackup;
    const result = await applyLegacyCanary(db, config, operatorId, plan, STREAMERBOT_PATH_DISABLED, async value => { backup = value; });
    expect(result).toMatchObject({ status: 'DATA_IMPORTED', dataAuthority: 'LEGACY', playerId: plan.player.playerId });
    expect(await db.player.count()).toBe(beforeCount + (existing ? 0 : 1));
    expect(await db.webIdentity.count({ where: { playerId: result.playerId } })).toBe(existing ? 1 : 0);
    expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: result.playerId } })).toMatchObject({ xp: 300n, totalMessages: 10n });
    expect((await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: result.playerId, resourceKey: 'moras' } } })).amount).toBe(80n);
    expect(await db.friendship.count()).toBe(0);
    expect(await db.playerCharacter.count({ where: { playerId: result.playerId, constellation: 6, copies: 7, favorite: true } })).toBe(1);
    expect(await db.c6CompetitionProgress.findFirst({ where: { playerId: result.playerId } })).toMatchObject({ totalContests: 7n, totalWins: 2n, intelligenceParticipations: 3n });
    expect(await db.playerCharacterCombatStats.findFirst({ where: { playerId: result.playerId } })).toMatchObject({ wins: 2n, losses: 1n });
    expect(await db.playerWheelStats.findUniqueOrThrow({ where: { playerId: result.playerId } })).toMatchObject({ totalSpins: 4n, totalJackpots: 1n });
    expect(await db.team.count({ where: { playerId: result.playerId, isActive: true, members: { some: {} } } })).toBe(1);
    expect(await db.playerFavorState.count({ where: { playerId: result.playerId } })).toBe(1);
    if (existing) {
      expect((await db.player.findUniqueOrThrow({ where: { id: expected! } })).displayName).toBe('Standalone display name');
      expect(await db.playerRoleAssignment.count({ where: { playerId: expected!, role: 'TESTER' } })).toBe(1);
      expect(await db.playerPreference.findUnique({ where: { playerId_preferenceKey: { playerId: expected!, preferenceKey: 'menu.defaultTab' } } })).toBeTruthy();
    }
    expect({ editions: await db.eventEdition.findMany(), banners: await db.bannerRotation.findMany(), operator: await db.playerProgression.findUnique({ where: { playerId: operatorId } }) }).toEqual(globalBefore);
    await rollbackLegacyCanary(db, config, operatorId, backup);
    expect((await captureTargetedPlayerRows(db, backup.rows.playerIds)).hash).toBe(backup.rows.hash);
  }, 180_000);

  it('refreshes only while LEGACY, blocks Native re-import and rollback until OFF/LEGACY, then restores the exact earlier snapshot', async () => {
    const { snapshot, report } = canarySnapshot(), twitchUserId = report.users[0]!.twitchUserId;
    const identity = await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId } });
    const plan = await planLegacyCanary(db, snapshot, report, twitchUserId, identity.playerId, new Date());
    let backup!: CanaryBackup;
    await applyLegacyCanary(db, config, operatorId, plan, STREAMERBOT_PATH_DISABLED, async value => { backup = value; });
    const authority = new TwitchNativeAuthority(db, config);
    await authority.configure(operatorId, 'CANARY', [twitchUserId], STREAMERBOT_PATH_DISABLED);
    expect((await planLegacyCanary(db, snapshot, report, twitchUserId, identity.playerId, new Date())).blockers).toContain('CANARY_LEGACY_AUTHORITY_REQUIRED');
    await expect(applyLegacyCanary(db, config, operatorId, plan, STREAMERBOT_PATH_DISABLED, async () => {})).rejects.toThrow('CANARY_TARGET_CHANGED');
    await expect(rollbackLegacyCanary(db, config, operatorId, backup)).rejects.toThrow('CANARY_ROLLBACK_OFF_REQUIRED');
    await authority.configure(operatorId, 'OFF', []);
    await expect(rollbackLegacyCanary(db, config, operatorId, backup)).rejects.toThrow('CANARY_ROLLBACK_LEGACY_REQUIRED');
    await authority.relinquishForRollback(operatorId, twitchUserId, backup.hash);
    await rollbackLegacyCanary(db, config, operatorId, backup);
    expect((await captureTargetedPlayerRows(db, backup.rows.playerIds)).hash).toBe(backup.rows.hash);
  }, 180_000);

  it('protects every Native preimage row during a future purge and allows a new shared relation to use that Player ID', async () => {
    const { snapshot, report } = canarySnapshot(), twitchUserId = report.users[0]!.twitchUserId;
    const identity = await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId } });
    const plan = await planLegacyCanary(db, snapshot, report, twitchUserId, identity.playerId, new Date());
    await applyLegacyCanary(db, config, operatorId, plan, STREAMERBOT_PATH_DISABLED, async () => {});
    await new TwitchNativeAuthority(db, config).configure(operatorId, 'CANARY', [twitchUserId], STREAMERBOT_PATH_DISABLED);
    const native = await db.player.findUniqueOrThrow({ where: { id: identity.playerId } });
    const batchPlan = buildLegacyGlobalPlan(snapshot, report.users, [{ id: native.id, displayName: native.displayName, twitchUserId, dataAuthority: 'NATIVE', canaryImported: true }], new Set());
    expect(batchPlan.players[0]!.personalImport).toBe(false);
    await expect(db.$transaction(tx => applyLegacyPersonalState(tx, batchPlan.players[0]!, plan.mapping, randomUUID(), snapshot.hash, new Date()))).rejects.toThrow('NATIVE_PLAYER_LEGACY_IMPORT_FORBIDDEN');
    const peer = await db.player.create({ data: { displayName: 'Other endpoint' } });
    const purge = await buildCutoverPurgePlan(db, fixture.schema, [native.id, operatorId]);
    await db.$transaction(async tx => {
      await applyPrivateCutoverPurge(tx, purge);
      await assertCutoverProtectedRows(tx, purge);
      const relationSnapshot = { ...snapshot, sources: { ...snapshot.sources,
        'friendships_data.json': { friendships: { one: { users: ['fixture_canary', 'other_endpoint'], level: 1, sparkleHearts: 0, lastHeartSent: {} } }, requests: [] } } };
      const relationPlan = { ...batchPlan, friendshipCount: 1, friendshipExcluded: 0, requestExcluded: 0, players: [...batchPlan.players, { ...batchPlan.players[0]!, playerId: peer.id, legacyUsername: 'other_endpoint' }] };
      await applyLegacySocial(tx, relationSnapshot, relationPlan, randomUUID());
      expect(await tx.friendship.count({ where: { OR: [{ playerAId: native.id }, { playerBId: native.id }] } })).toBe(1);
      await assertCutoverProtectedRows(tx, purge);
    }, { timeout: 180_000 });
  }, 180_000);
});


describe('legacy canaries without a chosen element', () => {
  beforeAll(() => new TwitchNativeAuthority(db, config).configure(operatorId, 'OFF', []));
  let sequence = 10;
  function noElementSnapshot(overrides: Record<string, unknown>) {
    const f = canarySnapshot(overrides); f.report.users[0]!.twitchUserId = String(900000000000 + sequence++); return f;
  }
  it.each([0, 30, 60])('imports XP %s without element or WebIdentity and restores the exact absence', async xp => {
    const { snapshot, report } = noElementSnapshot({ element: xp === 0 ? undefined : xp === 30 ? null : '', xp });
    const plan = await planLegacyCanary(db, snapshot, report, report.users[0]!.twitchUserId, null, new Date());
    expect(plan.blockers).toEqual([]); expect(plan.player.elementKey).toBeNull();
    let backup!: CanaryBackup;
    const result = await applyLegacyCanary(db, config, operatorId, plan, STREAMERBOT_PATH_DISABLED, async value => { backup = value; });
    expect((await db.player.findUniqueOrThrow({ where: { id: result.playerId } })).elementKey).toBeNull();
    expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: result.playerId } })).toMatchObject({ xp: BigInt(xp), totalMessages: 10n });
    expect((await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: result.playerId, resourceKey: 'moras' } } })).amount).toBe(80n);
    expect(await db.twitchIdentity.count({ where: { playerId: result.playerId } })).toBe(1);
    expect(await db.webIdentity.count({ where: { playerId: result.playerId } })).toBe(0);
    await rollbackLegacyCanary(db, config, operatorId, backup);
    expect((await captureTargetedPlayerRows(db, backup.rows.playerIds)).hash).toBe(backup.rows.hash);
  }, 180_000);
  it('replaces verified standalone gameplay with element null and retains WebIdentity/Player ID without addition', async () => {
    const { snapshot, report } = noElementSnapshot({ element: null, xp: 300 });
    const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private existing null-element canary',
      webIdentity: { provider: 'supabase', providerSubject: randomUUID() }, twitchIdentity: { twitchUserId: report.users[0]!.twitchUserId, login: 'fixture_canary', displayName: 'Fixture', firstSeenAt: new Date() } }));
    await db.player.update({ where: { id: player.id }, data: { elementKey: 'pyro' } });
    await db.playerProgression.update({ where: { playerId: player.id }, data: { xp: 999n } });
    const web = await db.webIdentity.findUniqueOrThrow({ where: { playerId: player.id } });
    const plan = await planLegacyCanary(db, snapshot, report, report.users[0]!.twitchUserId, player.id, new Date());
    let backup!: CanaryBackup;
    await applyLegacyCanary(db, config, operatorId, plan, STREAMERBOT_PATH_DISABLED, async value => { backup = value; });
    expect(await db.player.findUniqueOrThrow({ where: { id: player.id } })).toMatchObject({ elementKey: null });
    expect((await db.playerProgression.findUniqueOrThrow({ where: { playerId: player.id } })).xp).toBe(300n);
    expect(await db.webIdentity.findUniqueOrThrow({ where: { id: web.id } })).toEqual(web);
    await rollbackLegacyCanary(db, config, operatorId, backup);
    expect((await captureTargetedPlayerRows(db, backup.rows.playerIds)).hash).toBe(backup.rows.hash);
    await db.twitchIdentity.delete({ where: { playerId: player.id } });
  }, 180_000);
  it('rejects a real typo before import instead of silently choosing no element', async () => {
    const { snapshot, report } = noElementSnapshot({ element: 'pyrp' });
    const count = await db.player.count();
    await expect(planLegacyCanary(db, snapshot, report, report.users[0]!.twitchUserId, null, new Date())).rejects.toThrow('LEGACY_ELEMENT_INVALID');
    expect(await db.player.count()).toBe(count);
  });
});
