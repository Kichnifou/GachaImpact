import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { identityProofHash } from '../src/application/migration/owner-approved-population.js';
import { planNativeLegacyEvent, applyNativeLegacyEvent, rollbackNativeLegacyEvent, type LegacyEventBackup } from '../src/application/migration/legacy-event-reconciliation.js';
import { applyLegacyBanner } from '../src/application/migration/legacy-banner-apply.js';
import { legacyBannerEvidence, planLegacyBannerReconciliation } from '../src/application/migration/legacy-banner-reconciliation.js';
import { captureTargetedPlayerRows } from '../src/application/migration/targeted-player-rows.js';
import type { Snapshot } from '../src/application/migration/streamerbot-snapshot.js';
import type { VerifiedTwitchReport } from '../src/application/migration/verified-twitch-report.js';
import type { LegacyGlobalPlan } from '../src/application/migration/legacy-global-plan.js';
import { planOperatorRelationRetention } from '../src/application/migration/legacy-operator-retention-plan.js';
import { applyPrivateCutoverPurge, assertCutoverProtectedRows, buildCutoverPurgePlan, buildPrivateOperatorRetentionPurgePlan } from '../src/application/migration/legacy-cutover-purge.js';
import { capturePrivateSchema, restorePrivateBackup, writePrivateBackup } from './private-schema-backup.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const now = new Date('2099-10-08T12:00:00Z'), importedAt = new Date('2099-10-08T08:00:00Z');
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: false, globalEnabled: false }, twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
let actor: string, editionId: string, definitionId: string, sequence = 0;
beforeAll(async () => {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env['DATABASE_URL']!).hostname)) throw Error('Local PostgreSQL required');
  await fixture.setup({ prismaMigrations: true });
  await db.character.createMany({ data: Array.from({ length: 11 }, (_, i) => ({ externalKey: `legacy:${i + 1}`, name: `Private character ${i + 1}`, rarity: i < 5 ? 5 : 4, elementKey: 'pyro' })) });
  actor = (await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private operator', twitchIdentity: { twitchUserId: '960000000000', login: 'kichnifou', displayName: 'Private operator', firstSeenAt: now } }))).id;
  config.twitch.pilotPlayerIds.push(actor);
  await db.playerRoleAssignment.create({ data: { playerId: actor, role: 'ADMIN', source: 'private-fixture' } });
  await db.twitchNativeAuthority.create({ data: { id: 'twitch-commands', desiredMode: 'OFF', revision: 12, operatorPlayerId: actor } });
  definitionId = (await db.eventDefinition.findUniqueOrThrow({ where: { calendarMonth: 10 } })).id;
  editionId = (await db.eventEdition.create({ data: { eventDefinitionId: definitionId, year: 2099, startsAt: new Date('2099-09-30T22:00:00Z'), endsAt: new Date('2099-10-31T23:00:00Z'), status: 'ACTIVE', snapshot: {} } })).id;
}, 180_000);
afterAll(async () => { await fixture.cleanup(); expect(fixture.poolSnapshot()).toMatchObject({ total: 0, idle: 0, waiting: 0 }); }, 60_000);

async function scenario(points = 14, currency = 21) {
  const n = ++sequence, name = `private_legacy_${n}`, twitchUserId = String(960000000000 + n);
  const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Céotryd fixture', twitchIdentity: { twitchUserId, login: name, displayName: 'Private definitive', firstSeenAt: importedAt } }));
  const sourceRow = { joined: true, joinedAt: '2099-10-01 08:06:35', points, currency, milestonesClaimed: points >= 10 ? [10] : [], daily: { '2099-10-06': { dailyEventCurrencyClaimed: true } } as Record<string, { dailyEventCurrencyClaimed: boolean }> };
  const snapshot: Snapshot = { hash: createHash('sha256').update(`fixture-${n}`).digest('hex'), files: 17, sources: { 'viewers_data.json': { [name]: {} }, 'monthly_events_data.json': { year: 2099, month: 10, participants: { [name]: sourceRow }, collectionPurchases: {} } } };
  const report: VerifiedTwitchReport = { version: 1, verification: 'TWITCH_HELIX', snapshotHash: snapshot.hash, resolvedAt: importedAt.toISOString(), users: [{ legacyLogin: name, twitchUserId, currentLogin: name, displayName: 'Private source', renamed: false }], missing: [], conflicts: [], duplicates: 0 };
  await db.twitchNativeTarget.create({ data: { twitchUserId, playerId: player.id, dataAuthority: 'NATIVE', canary: true, acknowledgement: STREAMERBOT_PATH_DISABLED, transferredAt: importedAt } });
  const run = await db.twitchCanaryImport.create({ data: { twitchUserId, playerId: player.id, snapshotHash: snapshot.hash, identityReportHash: identityProofHash(report), backupHash: '1'.repeat(64), importedAt } });
  await db.eventParticipant.create({ data: { playerId: player.id, eventEditionId: editionId, points: 1, joinedAt: new Date('2099-10-08T09:00:00Z') } });
  await db.playerEventCurrencyBalance.create({ data: { playerId: player.id, eventDefinitionId: definitionId, amount: 3n, updatedAt: now } });
  await db.eventDailyPlayerState.create({ data: { playerId: player.id, eventEditionId: editionId, businessDate: new Date('2099-10-08'), gameASuccess: true, gameBAttemptsUsed: 3, dailyBonusClaimed: true, state: { immutableFixture: true } } });
  const receipt = async (operationType: string, p: number, c: number, summary: Record<string, unknown>, hour: number) => db.businessOperation.create({ data: {
    playerId: player.id, operationType, sourceChannel: 'UI', status: 'COMPLETED', startedAt: new Date(`2099-10-08T${String(hour).padStart(2, '0')}:00:00Z`), completedAt: new Date(`2099-10-08T${String(hour).padStart(2, '0')}:00:01Z`),
    resultSummary: { request: { editionId, businessDate: '2099-10-08' }, ...summary, snapshot: { edition: { id: editionId }, participation: { joined: true, points: p }, currency: { amount: String(c) } } },
  } });
  await receipt('event.join', 0, 1, { joined: true, credited: true, creditedCurrency: 1 }, 9);
  await receipt('event.daily-bonus.claim', 0, 2, {}, 10);
  await receipt('event.game-a.attempt', 1, 3, { succeeded: true }, 11);
  const input = { operatorPlayerId: actor, expectedRevision: 12, snapshot, importReport: report, importId: run.id, twitchUserId, playerId: player.id, now };
  return { input, player, sourceRow, receipt };
}
async function prepare(s: Awaited<ReturnType<typeof scenario>>) {
  const plan = await planNativeLegacyEvent(db, s.input);
  const input = { ...s.input, expectedFingerprint: plan.fingerprint, operationId: randomUUID(), acknowledgement: STREAMERBOT_PATH_DISABLED };
  let backup: LegacyEventBackup | undefined;
  const write = async (value: LegacyEventBackup) => {
    expect(await db.migrationBatch.count({ where: { id: input.operationId } })).toBe(0);
    expect((await db.eventParticipant.findUniqueOrThrow({ where: { eventEditionId_playerId: { eventEditionId: editionId, playerId: s.player.id } } })).points).toBe(1);
    await mkdir('../local-data/migration-backups', { recursive: true });
    const file = await open(`../local-data/migration-backups/${input.operationId}.json`, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(value)); await file.sync(); } finally { await file.close(); }
    backup = value;
  };
  return { input, plan, write, backup: () => backup! };
}

it('prepares READ ONLY and derives 15 points/23 currency, deduplicating native enrollment instead of adding both balances', async () => {
  const s = await scenario(), before = await captureTargetedPlayerRows(db, [s.player.id], ['players', 'event_participants', 'event_milestone_claims', 'player_event_currency_balances', 'event_daily_player_states']);
  const plan = await planNativeLegacyEvent(db, s.input);
  expect(plan).toMatchObject({ targetPoints: 15, targetCurrency: '23', deltaPoints: 14, deltaCurrency: '20', legacyMilestones: [10], deduplicatedEnrollmentCurrency: '1' });
  expect(await captureTargetedPlayerRows(db, [s.player.id], ['players', 'event_participants', 'event_milestone_claims', 'player_event_currency_balances', 'event_daily_player_states'])).toEqual(before);
});

it('applies atomically, retains personal gameplay/daily/native receipts, idempotently replays and compensates exactly', async () => {
  const s = await scenario(), f = await prepare(s), before = await captureTargetedPlayerRows(db, [s.player.id]);
  const daily = await db.eventDailyPlayerState.findMany({ where: { playerId: s.player.id } });
  const first = await applyNativeLegacyEvent(db, config, f.input, f.write);
  expect(first.replayed).toBe(false);
  expect((await db.eventParticipant.findUniqueOrThrow({ where: { eventEditionId_playerId: { eventEditionId: editionId, playerId: s.player.id } } })).points).toBe(15);
  expect((await db.playerEventCurrencyBalance.findUniqueOrThrow({ where: { playerId_eventDefinitionId: { playerId: s.player.id, eventDefinitionId: definitionId } } })).amount).toBe(23n);
  expect(await db.eventMilestoneClaim.findMany({ where: { playerId: s.player.id } })).toMatchObject([{ milestone: 10, origin: 'LEGACY', operationId: null, claimedAt: null }]);
  expect(await db.eventDailyPlayerState.findMany({ where: { playerId: s.player.id } })).toEqual(daily);
  expect(await captureTargetedPlayerRows(db, [s.player.id])).toEqual(before);
  expect(await applyNativeLegacyEvent(db, config, f.input, async () => { throw Error('No second backup'); })).toMatchObject({ replayed: true });
  const rollback = { ...s.input, backup: f.backup(), expectedBackupHash: f.backup().hash, acknowledgement: STREAMERBOT_PATH_DISABLED };
  expect(await rollbackNativeLegacyEvent(db, config, rollback)).toEqual({ replayed: false });
  expect(await rollbackNativeLegacyEvent(db, config, rollback)).toEqual({ replayed: true });
  expect((await db.eventParticipant.findUniqueOrThrow({ where: { eventEditionId_playerId: { eventEditionId: editionId, playerId: s.player.id } } })).points).toBe(1);
  expect(await db.eventMilestoneClaim.count({ where: { playerId: s.player.id } })).toBe(0);
  expect(await db.migrationBatch.count({ where: { id: f.input.operationId } })).toBe(1);
  await expect(applyNativeLegacyEvent(db, config, f.input, f.write)).rejects.toThrow('JOURNAL_OR_POSTIMAGE_CONFLICT');
});

it('rolls back every write if backup fails and rejects stale plans, altered backups and post-apply activity', async () => {
  const s = await scenario(), f = await prepare(s);
  await expect(applyNativeLegacyEvent(db, config, f.input, async () => { throw Error('DISK_FULL'); })).rejects.toThrow('DISK_FULL');
  expect(await db.migrationBatch.count({ where: { id: f.input.operationId } })).toBe(0);
  expect(await db.eventMilestoneClaim.count({ where: { playerId: s.player.id } })).toBe(0);
  await expect(applyNativeLegacyEvent(db, config, { ...f.input, expectedFingerprint: 'a'.repeat(64) }, f.write)).rejects.toThrow('PLAN_CHANGED');
  await applyNativeLegacyEvent(db, config, f.input, f.write);
  await expect(rollbackNativeLegacyEvent(db, config, { ...s.input, backup: { ...f.backup(), addedMilestones: [] }, expectedBackupHash: f.backup().hash, acknowledgement: STREAMERBOT_PATH_DISABLED })).rejects.toThrow('BACKUP_INVALID');
  await db.eventDailyPlayerState.updateMany({ where: { playerId: s.player.id }, data: { gameCSent: true } });
  await expect(rollbackNativeLegacyEvent(db, config, { ...s.input, backup: f.backup(), expectedBackupHash: f.backup().hash, acknowledgement: STREAMERBOT_PATH_DISABLED })).rejects.toThrow('POSTIMAGE_CHANGED');
});

it('refuses wrong identities, A archived, proof tampering, old month, overlapping days, missing ledger and new rewards', async () => {
  const s = await scenario();
  const archived = await db.player.create({ data: { displayName: 'Céo fixture', status: 'ARCHIVED' } });
  await expect(planNativeLegacyEvent(db, { ...s.input, playerId: archived.id })).rejects.toThrow('DEFINITIVE_PLAYER_CONFLICT');
  await expect(planNativeLegacyEvent(db, { ...s.input, importReport: { ...s.input.importReport, users: [{ ...s.input.importReport.users[0]!, twitchUserId: '999999999999' }] } })).rejects.toThrow('IMMUTABLE_ID_REQUIRED');
  s.sourceRow.daily['2099-10-08'] = { dailyEventCurrencyClaimed: true };
  await expect(planNativeLegacyEvent(db, s.input)).rejects.toThrow('SOURCE_NATIVE_DATE_OVERLAP');
  delete s.sourceRow.daily['2099-10-08'];
  await expect(planNativeLegacyEvent(db, { ...s.input, now: new Date('2099-11-01') })).rejects.toThrow('SOURCE_EDITION_NOT_CURRENT');
  await db.businessOperation.deleteMany({ where: { playerId: s.player.id, operationType: 'event.join' } });
  await expect(planNativeLegacyEvent(db, s.input)).rejects.toThrow('ENROLLMENT_BASELINE_UNPROVEN');
  const crossed = await scenario(19);
  await expect(planNativeLegacyEvent(db, crossed.input)).rejects.toThrow('NEW_MILESTONE_REWARD_REQUIRES_OWNER');
});

it('requires canonical OFF, exact operator/revision and no pending or ambiguous outbound before mutation', async () => {
  const s = await scenario(), f = await prepare(s);
  await expect(applyNativeLegacyEvent(db, { ...config, twitchCommandPilot: { enabled: true, globalEnabled: false } }, f.input, f.write)).rejects.toThrow('OFF_GATE_REQUIRED');
  await expect(applyNativeLegacyEvent(db, { ...config, twitchCommandPilot: { enabled: false, globalEnabled: true } }, f.input, f.write)).rejects.toThrow('OFF_GATE_REQUIRED');
  await expect(applyNativeLegacyEvent(db, config, { ...f.input, expectedRevision: 11 }, f.write)).rejects.toThrow('OFF_GATE_REQUIRED');
  await expect(applyNativeLegacyEvent(db, config, { ...f.input, operatorPlayerId: s.player.id }, f.write)).rejects.toMatchObject({ statusCode: 403 });
  const pending = await db.businessOperation.create({ data: { playerId: actor, operationType: 'private.pending', sourceChannel: 'SYSTEM' } });
  await expect(applyNativeLegacyEvent(db, config, f.input, f.write)).rejects.toThrow('OPERATION_IN_FLIGHT');
  await db.businessOperation.update({ where: { id: pending.id }, data: { status: 'FAILED' } });
  const receipt = await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(), eventType: 'channel.chat.message', state: 'PROCESSED', processedAt: now, payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'AMBIGUOUS' }] } } } });
  await expect(applyNativeLegacyEvent(db, config, f.input, f.write)).rejects.toThrow('OUTBOUND_IN_FLIGHT');
  await db.twitchEventReceipt.update({ where: { id: receipt.id }, data: { payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'PENDING' }] } } } });
  await expect(applyNativeLegacyEvent(db, config, f.input, f.write)).rejects.toThrow('OUTBOUND_IN_FLIGHT');
  await db.twitchEventReceipt.delete({ where: { id: receipt.id } });
});

it('preserves verified native spending, rejects impossible spending and blocks unproved shared Game B credits from another player', async () => {
  const s = await scenario(14, 100);
  const conversion = await s.receipt('event.shop.convert', 1, 2, { request: { editionId, target: 'PRIMOGEMS', quantity: 1 } }, 12);
  await db.playerEventCurrencyBalance.update({ where: { playerId_eventDefinitionId: { playerId: s.player.id, eventDefinitionId: definitionId } }, data: { amount: 2n } });
  expect(await planNativeLegacyEvent(db, s.input)).toMatchObject({ targetPoints: 15, targetCurrency: '101', deltaCurrency: '99' });
  await db.businessOperation.delete({ where: { id: conversion.id } });
  await db.playerEventCurrencyBalance.update({ where: { playerId_eventDefinitionId: { playerId: s.player.id, eventDefinitionId: definitionId } }, data: { amount: 3n } });
  await s.receipt('event.shop.collection', 1, 3 - 80, {}, 12);
  await expect(planNativeLegacyEvent(db, s.input)).rejects.toThrow('NATIVE_LEDGER_MISMATCH');
  await db.businessOperation.deleteMany({ where: { playerId: s.player.id, operationType: 'event.shop.collection' } });
  const shared = await db.businessOperation.create({ data: { playerId: actor, operationType: 'event.game-b.attempt', sourceChannel: 'UI', status: 'COMPLETED', startedAt: now, completedAt: now, resultSummary: { request: { editionId }, kind: 'CORRECT' } } });
  await expect(planNativeLegacyEvent(db, s.input)).rejects.toThrow('SHARED_GAME_B_MEMBERSHIP_PROOF_REQUIRED');
  await db.businessOperation.delete({ where: { id: shared.id } });
});

it('handles concurrent duplicate requests once while keeping every existing canary authority unchanged', async () => {
  const s = await scenario(), f = await prepare(s), before = await db.twitchNativeTarget.findMany({ orderBy: { twitchUserId: 'asc' } });
  const results = await Promise.allSettled([applyNativeLegacyEvent(db, config, f.input, f.write), applyNativeLegacyEvent(db, config, f.input, f.write)]);
  expect(results.some(row => row.status === 'fulfilled')).toBe(true);
  expect(await db.migrationBatch.count({ where: { id: f.input.operationId } })).toBe(1);
  expect(await db.eventMilestoneClaim.count({ where: { playerId: s.player.id } })).toBe(1);
  expect(await db.twitchNativeTarget.findMany({ orderBy: { twitchUserId: 'asc' } })).toEqual(before);
});

it('imports a verified NATIVE vote once on a compatible rotation without resetting generation or personal gacha, and blocks conflicts atomically', async () => {
  const s = await scenario(), name = Object.keys(s.input.snapshot.sources['viewers_data.json'] as object)[0]!;
  const catalog = await db.character.findMany({ orderBy: { externalKey: 'asc' } });
  const featured = [...catalog.filter(c => c.rarity === 5).slice(0, 4), ...catalog.filter(c => c.rarity === 4).slice(0, 6)];
  const choice = Number(catalog.filter(c => c.rarity === 5)[4]!.externalKey.slice(7));
  const snapshot: Snapshot = { ...s.input.snapshot, sources: { ...s.input.snapshot.sources, 'genshin_characters.json': { lastBannerUpdate: '2099-10-05', characters: featured.map(c => ({ id: Number(c.externalKey.slice(7)), bannerFeatured: true })) },
    'banner_votes.json': { weekId: '2099-10-05', voters: { [name]: choice, private_discarded: choice }, votes: { [choice]: { votes: 2 } } } } };
  const plan = { players: [{ playerId: s.player.id, legacyUsername: name, personalImport: false }] } as LegacyGlobalPlan;
  const evidence = legacyBannerEvidence(snapshot, catalog);
  const rotation = await db.bannerRotation.create({ data: { startsAt: evidence.startsAt, endsAt: evidence.endsAt, status: 'ACTIVE', generationVoteSnapshot: { immutableNative: true },
    featuredCharacters: { create: featured.map((c, i) => ({ characterId: c.id, rarity: c.rarity, slot: c.rarity === 5 ? i + 1 : i - 3, selectionSource: 'RANDOM' })) } } });
  const before = await db.playerGachaState.findUnique({ where: { playerId: s.player.id } });
  expect(await db.$transaction(tx => applyLegacyBanner(tx, snapshot, plan, randomUUID(), now))).toMatchObject({ rotations: 0, votes: 1, excludedVotes: 1 });
  expect(await db.$transaction(tx => applyLegacyBanner(tx, snapshot, plan, randomUUID(), now))).toMatchObject({ votes: 0, retainedVotes: 1 });
  expect((await db.bannerRotation.findUniqueOrThrow({ where: { id: rotation.id } })).generationVoteSnapshot).toEqual({ immutableNative: true });
  expect(await db.playerGachaState.findUnique({ where: { playerId: s.player.id } })).toEqual(before);
  expect(await db.bannerVote.count({ where: { bannerRotationId: rotation.id } })).toBe(1);
  await db.bannerVote.updateMany({ where: { playerId: s.player.id }, data: { characterId: featured[1]!.id, sourceChannel: 'UI' } });
  await expect(db.$transaction(tx => applyLegacyBanner(tx, snapshot, plan, randomUUID(), now))).rejects.toThrow('LEGACY_VOTE_NATIVE_CONFLICT');
  await db.bannerFeaturedCharacter.updateMany({ where: { bannerRotationId: rotation.id, rarity: 5, slot: 1 }, data: { characterId: catalog.filter(c => c.rarity === 5)[4]!.id } });
  const rotations = await db.bannerRotation.findMany({ include: { featuredCharacters: true } });
  expect(planLegacyBannerReconciliation(evidence, rotations, now)).toMatchObject({ status: 'CONFLICT', reason: 'BANNER_AUTHORITY_CONFLICT' });
  await expect(db.$transaction(tx => applyLegacyBanner(tx, snapshot, plan, randomUUID(), now))).rejects.toThrow('BANNER_AUTHORITY_CONFLICT');
  expect(planLegacyBannerReconciliation(evidence, [], new Date('2099-10-12T12:00:00Z'))).toMatchObject({ status: 'HISTORICAL' });
});

it('retains expired/consumed operator proof and both progression IDs while the global purge guard stays mandatory', async () => {
  const s = await scenario(), a = await db.player.create({ data: { displayName: 'Private losing progression', status: 'ARCHIVED' } });
  const web = await db.webIdentity.create({ data: { playerId: s.player.id, provider: 'SUPABASE', providerSubject: randomUUID() } });
  const resolution = await db.twitchLinkResolution.create({ data: { webIdentityId: web.id, webPlayerId: a.id, twitchPlayerId: s.player.id, twitchUserId: s.input.twitchUserId,
    login: 'private_final', comparedState: {}, choice: 'TWITCH', createdAt: new Date('2026-10-01'), expiresAt: new Date('2026-10-02'), completedAt: new Date('2026-10-01') } });
  await db.twitchCanonicalizationPlan.create({ data: { webIdentityId: web.id, webPlayerId: a.id, twitchPlayerId: s.player.id, twitchUserId: s.input.twitchUserId, choice: 'TWITCH', operatorPlayerId: actor,
    contractVersion: 1, fingerprint: 'a'.repeat(64), backupHash: 'b'.repeat(64), consequences: {}, createdAt: new Date('2026-10-01'), expiresAt: new Date('2026-10-02'), consumedAt: new Date('2026-10-01'), resolutionId: resolution.id } });
  const before = await db.twitchCanonicalizationPlan.findMany();
  const plan = await planOperatorRelationRetention(db);
  expect(plan).toMatchObject({ status: 'BLOCKED', reason: 'CUTOVER_OPERATOR_RELATION_PROOFS_PRESENT', planCount: 1, expiredPlanCount: 1, consumedPlanCount: 1, completeGameplayClosureVerified: false });
  expect(plan.playerIds).toEqual(expect.arrayContaining([a.id, s.player.id, actor]));
  expect(plan.proof.graph!.tables.twitch_canonicalization_plans).toHaveLength(1);
  expect(plan.proof.graph!.tables.twitch_link_resolutions).toHaveLength(1);
  await expect(buildCutoverPurgePlan(db, fixture.schema)).rejects.toThrow('CUTOVER_OPERATOR_RELATION_PROOFS_PRESENT');
  expect(await db.twitchCanonicalizationPlan.findMany()).toEqual(before);
  await expect(buildPrivateOperatorRetentionPurgePlan(db, 'public')).rejects.toThrow('REHEARSAL_PRIVATE_ONLY');
  await expect(buildPrivateOperatorRetentionPurgePlan(db, `batch_test_${'a'.repeat(32)}`)).rejects.toThrow('SCHEMA_MISMATCH');
  const unprotected = await db.player.create({ data: { displayName: 'Private replaceable fixture' } });
  const disposable = await db.businessOperation.create({ data: { playerId: unprotected.id, operationType: 'private.disposable', sourceChannel: 'SYSTEM', status: 'COMPLETED' } });
  const preimage = await capturePrivateSchema(fixture.admin, fixture.schema), file = await writePrivateBackup(preimage, 'operator_retention_review');
  const purge = await buildPrivateOperatorRetentionPurgePlan(db, fixture.schema);
  const saved = before[0]!;
  await db.twitchCanonicalizationPlan.update({ where: { id: saved.id }, data: { consequences: { changed: true } } });
  await expect(db.$transaction(tx => applyPrivateCutoverPurge(tx, purge))).rejects.toThrow('RELATION_PROOFS_CHANGED');
  expect(await db.businessOperation.count({ where: { id: disposable.id } })).toBe(1);
  await db.twitchCanonicalizationPlan.update({ where: { id: saved.id }, data: { consequences: saved.consequences as Record<string, never> } });
  await db.$transaction(async tx => { await applyPrivateCutoverPurge(tx, purge); await assertCutoverProtectedRows(tx, purge); }, { timeout: 30_000 });
  expect(await db.businessOperation.count({ where: { id: disposable.id } })).toBe(0);
  expect(await db.twitchCanonicalizationPlan.findMany()).toEqual(before);
  expect(await db.player.count({ where: { id: { in: [a.id, s.player.id, actor] } } })).toBe(3);
  const postHash = (await capturePrivateSchema(fixture.admin, fixture.schema)).hash;
  await db.$transaction(async tx => { await applyPrivateCutoverPurge(tx, purge); await assertCutoverProtectedRows(tx, purge); }, { timeout: 30_000 });
  expect((await capturePrivateSchema(fixture.admin, fixture.schema)).hash).toBe(postHash);
  await restorePrivateBackup(fixture.admin, fixture.schema, file);
  expect((await capturePrivateSchema(fixture.admin, fixture.schema)).hash).toBe(preimage.hash);
  await expect(db.player.update({ where: { id: a.id }, data: { displayName: 'Refused archived mutation' } })).rejects.toThrow('PLAYER_ARCHIVED');
  await expect(buildCutoverPurgePlan(db, fixture.schema)).rejects.toThrow('CUTOVER_OPERATOR_RELATION_PROOFS_PRESENT');
});
