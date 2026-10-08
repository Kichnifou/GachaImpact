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
import { parseStreamerbotSnapshot } from '../src/application/migration/streamerbot-snapshot.js';
import { createVerifiedTwitchReport } from '../src/application/migration/verified-twitch-report.js';
import { registerLegacyFriendships } from '../src/application/migration/legacy-friendship-reconciliation.js';
import { permanentMissionCatalog } from '../src/domain/missions/permanent-mission-catalog.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: true, globalEnabled: false },
  twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
let operatorId: string;
beforeAll(async () => {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env['DATABASE_URL']!).hostname)) throw Error('Local PostgreSQL required');
  await fixture.setup({ prismaMigrations: true });
  await db.character.create({ data: { externalKey: 'legacy:1', name: 'Synthetic character', rarity: 5, elementKey: 'cryo' } });
  await db.permanentMissionDefinition.createMany({ data: permanentMissionCatalog.map(entry => ({ ...entry })), skipDuplicates: true });
  const operator = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private operator',
    twitchIdentity: { twitchUserId: '900000000000', login: 'kichnifou', displayName: 'Private operator', firstSeenAt: new Date() } }));
  operatorId = operator.id; config.twitch.pilotPlayerIds.push(operatorId);
  await db.playerRoleAssignment.create({ data: { playerId: operatorId, role: 'ADMIN', source: 'private-fixture' } });
}, 180_000);
afterAll(async () => { await fixture.cleanup(); const pool = fixture.poolSnapshot(); expect(pool).toMatchObject({ total: 0, idle: 0, waiting: 0 }); expect(pool.closed).toBe(pool.opened); }, 60_000);

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
    const id = sequence++;
    return canarySnapshot(overrides, { legacyLogin: `fixture_canary_${id}`, twitchUserId: String(900000000000 + id) });
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

describe('canary v3 social preflight and exact rollback', () => {
  let sequence = 100;
  async function socialScenario(existing: boolean) {
    const index = ++sequence, ownerName = `canary_social_${index}`, peerName = `peer_social_${index}`;
    const ownerId = String(930000000000 + index), peerId = String(940000000000 + index);
    const base = canarySnapshot({}, { legacyLogin: ownerName, twitchUserId: ownerId });
    const sources = { ...base.snapshot.sources, 'viewers_data.json': { ...(base.snapshot.sources['viewers_data.json'] as Record<string, unknown>), [peerName]: {} },
      'friendships_data.json': { friendships: { pair: { users: [ownerName, peerName], level: 9, sparkleHearts: 21, createdAt: '2026-01-01', lastHeartSent: { [peerName]: '2026-10-01' } } }, requests: [] } };
    const snapshot = parseStreamerbotSnapshot(Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, JSON.stringify(value)])));
    const reportFor = (name: string, twitchUserId: string) => createVerifiedTwitchReport(snapshot, { users: [{ legacyLogin: name, twitchUserId, currentLogin: name, displayName: name, renamed: false }], missing: [], conflicts: [], duplicates: 0 }, new Date(), { kind: 'CANARY', legacyLogin: name });
    const report = reportFor(ownerName, ownerId), peerReport = reportFor(peerName, peerId);
    const peer = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Imported peer', twitchIdentity: { twitchUserId: peerId, login: peerName, displayName: 'Imported peer', firstSeenAt: new Date() } }));
    await db.migrationRun.create({ data: { playerId: peer.id, snapshotHash: snapshot.hash, summary: {} } });
    await db.$transaction(tx => registerLegacyFriendships(tx, { snapshot, report: peerReport, ownerTwitchUserId: peerId, now: new Date() }));
    const fact = await db.legacyFriendshipFact.findFirstOrThrow({ where: { OR: [{ leftTwitchUserId: peerId }, { rightTwitchUserId: peerId }] } });
    const owner = existing ? await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Existing standalone', webIdentity: { provider: 'fixture', providerSubject: randomUUID() }, twitchIdentity: { twitchUserId: ownerId, login: ownerName, displayName: ownerName, firstSeenAt: new Date() } })) : null;
    return { snapshot, report, ownerId, peer, fact, owner };
  }

  it('reports a real social collision before backup or any application mutation', async () => {
    const f = await socialScenario(true), owner = f.owner!;
    const [playerAId, playerBId] = [owner.id, f.peer.id].sort() as [string, string];
    const relationship = await db.friendship.create({ data: { playerAId, playerBId, level: 27, totalHearts: 43n } });
    const before = await captureTargetedPlayerRows(db, [owner.id, f.peer.id]);
    const plan = await planLegacyCanary(db, f.snapshot, f.report, f.ownerId, owner.id, new Date());
    expect(plan.blockers).toContain('LEGACY_FRIENDSHIP_EFFECTIVE_RELATION_CONFLICT');
    let backedUp = false;
    await expect(applyLegacyCanary(db, config, operatorId, plan, STREAMERBOT_PATH_DISABLED, async () => { backedUp = true; })).rejects.toThrow('CANARY_PREFLIGHT_BLOCKED');
    expect(backedUp).toBe(false);
    expect((await captureTargetedPlayerRows(db, [owner.id, f.peer.id])).hash).toBe(before.hash);
    expect(await db.friendship.findUniqueOrThrow({ where: { id: relationship.id } })).toEqual(relationship);
    expect(await db.legacyFriendshipFact.findUniqueOrThrow({ where: { id: f.fact.id } })).toEqual(f.fact);
  }, 180_000);

  it('materializes a verified imported peer then rolls back exactly without deleting its original fact', async () => {
    const f = await socialScenario(false), peerBefore = await captureTargetedPlayerRows(db, [f.peer.id]);
    const plan = await planLegacyCanary(db, f.snapshot, f.report, f.ownerId, null, new Date());
    expect(plan.blockers).toEqual([]); expect(plan.player.mappingMode).toBe('TWITCH_ONLY');
    expect(plan.social).toMatchObject({ materialized: 1, deferred: 0, retained: 0 });
    let backup!: CanaryBackup;
    await applyLegacyCanary(db, config, operatorId, plan, STREAMERBOT_PATH_DISABLED, async value => { backup = value; });
    expect(backup.version).toBe(3);
    expect(await db.friendship.findFirstOrThrow({ where: { legacyFactId: f.fact.id, supersededAt: null } })).toMatchObject({ state: 'ACTIVE', level: 9, totalHearts: 21n });
    expect(await db.legacyFriendshipFact.findUniqueOrThrow({ where: { id: f.fact.id } })).toMatchObject({ status: 'MATERIALIZED' });
    expect((await captureTargetedPlayerRows(db, [f.peer.id])).hash).toBe(peerBefore.hash);
    await rollbackLegacyCanary(db, config, operatorId, backup);
    expect(await db.legacyFriendshipFact.findUniqueOrThrow({ where: { id: f.fact.id } })).toEqual(f.fact);
    expect(await db.friendship.count({ where: { legacyFactId: f.fact.id } })).toBe(0);
    expect((await captureTargetedPlayerRows(db, [f.peer.id])).hash).toBe(peerBefore.hash);
    expect((await captureTargetedPlayerRows(db, backup.rows.playerIds)).hash).toBe(backup.rows.hash);
    expect(await db.player.findUnique({ where: { id: plan.player.playerId } })).toBeNull();
  }, 180_000);

  it('invalidates the social preflight before durable backup if a peer changes', async () => {
    const f = await socialScenario(false);
    const plan = await planLegacyCanary(db, f.snapshot, f.report, f.ownerId, null, new Date()); expect(plan.blockers).toEqual([]);
    await db.player.update({ where: { id: f.peer.id }, data: { status: 'SUSPENDED' } });
    let backedUp = false;
    await expect(applyLegacyCanary(db, config, operatorId, plan, STREAMERBOT_PATH_DISABLED, async () => { backedUp = true; })).rejects.toThrow('CANARY_SOCIAL_PREFLIGHT_CHANGED');
    expect(backedUp).toBe(false); expect(await db.player.findUnique({ where: { id: plan.player.playerId } })).toBeNull();
    expect(await db.legacyFriendshipFact.findUniqueOrThrow({ where: { id: f.fact.id } })).toEqual(f.fact);
  }, 180_000);
});
