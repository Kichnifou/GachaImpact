import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { deepStrictEqual } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { identityResolutionSummary, loadVerifiedTwitchReport, parseRehearsalArguments } from '../src/application/migration/verified-twitch-report.js';
import { assertLegacyAccountPreservation, readLegacyAccountProjection, seedLegacyAccountProjection, type AccountProjection } from '../tests-db/legacy-account-projection.js';
import { isolatedBatchDatabase } from '../tests-db/isolated-batch-database.js';
import { capturePrivateSchema, privateNumericStateHash, restorePrivateBackup, writePrivateBackup } from '../tests-db/private-schema-backup.js';
import { loadLegacySnapshotDirectory } from '../src/application/migration/legacy-snapshot-directory.js';
import { buildLegacyGlobalPlan, fixtureTwitchResolution } from '../src/application/migration/legacy-global-plan.js';
import { SnapshotPilotService } from '../src/application/migration/snapshot-pilot-service.js';
import { applyLegacyPersonalState, ensureLegacyCharacterAvatars } from '../src/application/migration/legacy-personal-apply.js';
import { applyLegacySocial } from '../src/application/migration/legacy-social-apply.js';
import { applyLegacyGiveaway } from '../src/application/migration/legacy-giveaway-apply.js';
import { applyLegacyCodes } from '../src/application/migration/legacy-code-apply.js';
import { applyLegacyBoss, validateLegacyBossSnapshot } from '../src/application/migration/legacy-boss-apply.js';
import { applyLegacyEvent } from '../src/application/migration/legacy-event-apply.js';
import { applyLegacyBanner } from '../src/application/migration/legacy-banner-apply.js';
import { applyLegacyDailyCombat } from '../src/application/migration/legacy-daily-combat-apply.js';
import { applyPrivateCutoverPurge, buildCutoverPurgePlan } from '../src/application/migration/legacy-cutover-purge.js';
import { applyLegacyContest } from '../src/application/migration/legacy-contest-apply.js';
import { remainingFavorDays } from '../src/application/migration/legacy-favor-calendar.js';
import { getBusinessDate } from '../src/domain/time/business-date.js';

async function main() {
const { directory, cutoverAt, identities: identityFile, identityMode } = parseRehearsalArguments(process.argv.slice(2));
const snapshot = await loadLegacySnapshotDirectory(resolve(directory));
validateLegacyBossSnapshot(snapshot);
const catalog = JSON.parse(await readFile(new URL('../prisma/data/characters.json', import.meta.url), 'utf8')) as { externalKey: string }[];
const report = identityFile ? await loadVerifiedTwitchReport(identityFile, snapshot) : null;
const identities = report?.users ?? fixtureTwitchResolution(snapshot);
let accounts: AccountProjection;
if (report) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try { await client.connect(); accounts = await readLegacyAccountProjection(client); }
  finally { await client.end(); }
} else {
  const existingId = randomUUID(), unmatchedId = randomUUID();
  accounts = {
    players: [
      { id: existingId, displayName: 'Existing web fixture', twitchUserId: identities[0]!.twitchUserId, elementKey: 'pyro', hasWebAccount: true },
      { id: unmatchedId, displayName: 'Unmatched web fixture', twitchUserId: null, elementKey: 'pyro', hasWebAccount: true },
    ],
    identities: [{ playerId: existingId, twitchUserId: identities[0]!.twitchUserId, login: identities[0]!.currentLogin, displayName: 'Stale twitch fixture' }],
    preferences: [{ playerId: existingId, preferenceKey: 'menu.defaultTab', value: 'inventory' }],
    privacy: [{ playerId: existingId, categoryKey: 'CURRENCY_BALANCES', level: 'FRIENDS' }],
    roles: [{ playerId: existingId, role: 'TESTER', source: 'private-rehearsal' }],
  };
}
const existingWeb = accounts.players;
const plan = buildLegacyGlobalPlan(snapshot, identities, existingWeb, new Set(catalog.map(row => row.externalKey)), accounts.identities, cutoverAt);
const reused = plan.players.filter(row => row.mappingMode === 'EXISTING_VERIFIED_TWITCH').length;
const blockers = plan.issues.filter(issue => issue.severity === 'BLOCKER');
process.stdout.write(JSON.stringify({ phase: 'IDENTITY_PREFLIGHT', identityMode, snapshotHash: snapshot.hash,
  ...(report ? identityResolutionSummary(report) : { resolved: 0, fixtureIdentities: identities.length }),
  existingPlayers: accounts.players.length, webAccounts: accounts.players.filter(row => row.hasWebAccount).length,
  reusedPlayers: reused, reusedWebAccounts: plan.players.filter(row => row.mappingMode === 'EXISTING_VERIFIED_TWITCH' && accounts.players.find(account => account.id === row.playerId)?.hasWebAccount).length,
  futureTwitchOnly: plan.players.filter(row => row.mappingMode === 'TWITCH_ONLY').length,
  unmatchedWebAccounts: plan.unmatchedWebPlayerIds.length, blockers: blockers.length,
  blockerCodes: [...new Set(blockers.map(row => row.code))], exit30Certified: false }) + '\n');
if (blockers.length || !plan.players.length || report?.missing.length || report?.conflicts.length) throw new Error('IDENTITY_PREFLIGHT_BLOCKED');
const existingId = plan.players.find(row => row.mappingMode === 'EXISTING_VERIFIED_TWITCH')?.playerId;
const unmatchedId = plan.unmatchedWebPlayerIds[0];
if (!existingId || !unmatchedId) throw new Error('PRIVATE_PRESERVATION_PROBES_UNAVAILABLE');
const isolated = isolatedBatchDatabase();
let setupStarted = false;
try {
  setupStarted = true;
  await isolated.setup({ seedPublicCatalog: true });
  const db = isolated.database;
  const actualSchema = await db.$queryRawUnsafe<{ current_schema: string }[]>('SELECT current_schema()');
  if (actualSchema[0]?.current_schema !== isolated.schema || !/^batch_test_[0-9a-f]{32}$/.test(isolated.schema)) throw new Error('Private rehearsal schema guard failed.');
  for (const entry of catalog.filter(row => ['legacy:119', 'legacy:120'].includes(row.externalKey)))
    await db.character.upsert({ where: { externalKey: entry.externalKey }, create: entry as never, update: {} });
  await db.$transaction(tx => ensureLegacyCharacterAvatars(tx), { timeout: 30_000 });
  await db.$transaction(tx => seedLegacyAccountProjection(tx, isolated.schema, accounts));
  await db.playerSession.create({ data: { playerId: existingId, sessionTokenHash: randomBytes(32).toString('hex') } });
  await db.playerProgression.createMany({ data: [{ playerId: unmatchedId, xp: 999n }, { playerId: existingId, xp: 888n }] });
  await db.globalChatMessage.create({ data: { authorPlayerId: existingId, sourceChannel: 'INTERNAL_CHAT',
    messageType: 'PLAYER', content: 'Private pre-cutover fixture' } });
  await db.notification.create({ data: { playerId: existingId, domainKey: 'private-rehearsal',
    typeKey: 'pre-cutover', payload: { fixture: true } } });
  const [playerAId, playerBId] = [existingId, unmatchedId].sort() as [string, string];
  const conversation = await db.directConversation.create({ data: { playerAId, playerBId } });
  await db.directConversationParticipant.createMany({ data: [{ conversationId: conversation.id, playerId: playerAId },
    { conversationId: conversation.id, playerId: playerBId }] });
  const messageOperation = await db.businessOperation.create({ data: { playerId: existingId, operationType: 'direct-message.send',
    sourceChannel: 'UI', idempotencyKey: randomUUID(), status: 'COMPLETED' } });
  await db.directMessage.create({ data: { conversationId: conversation.id, authorPlayerId: existingId,
    operationId: messageOperation.id, content: 'Private pre-cutover fixture' } });
  const purgePlan = await buildCutoverPurgePlan(db, isolated.schema);
  const pilot = new SnapshotPilotService(db, {} as never, 'private-rehearsal');
  const personalPlans = new Map<string, Awaited<ReturnType<SnapshotPilotService['globalPlayerPlan']>>>();
  for (const player of plan.players) {
    const mapped = await pilot.globalPlayerPlan(player.playerId, player.legacyUsername, snapshot, cutoverAt);
    if (mapped.domains.some(domain => domain.category === 'BLOCKED_AMBIGUOUS' || domain.action === 'PENDING_MAPPING'))
      throw new Error('Personal mapping preflight blocked; no purge applied.');
    personalPlans.set(player.playerId, mapped);
  }
  process.stdout.write(JSON.stringify({ phase: 'PRIVATE_PURGE_IMPORT_PLAN', identityMode,
    exit30Certified: false,
    snapshotHash: snapshot.hash, cutoverAt: cutoverAt.toISOString(), included: plan.players.length,
    excluded: plan.excludedProfiles, issueCounts: plan.issues.reduce<Record<string, number>>((counts, issue) => {
      const key = `${issue.severity}:${issue.code}`; counts[key] = (counts[key] ?? 0) + 1; return counts;
    }, {}), deleteOrder: purgePlan.deleteOrder.map(row => ({ table: row.table, rows: row.rows.toString() })),
    preserved: { accounts: Number(purgePlan.retainedWebIdentities), roles: Number(purgePlan.retainedRoles),
      preferences: Number(purgePlan.retainedPreferences), privacy: Number(purgePlan.retainedPrivacy) },
    personalDomains: [...new Set([...personalPlans.values()].flatMap(mapped => mapped.domains.map(domain => domain.name)))],
    personalRowsToImport: [...personalPlans.values()].reduce((counts, mapped) => ({
      resourceBalances: counts.resourceBalances + mapped.resources.size,
      characters: counts.characters + mapped.boxRows.length,
      c6Progress: counts.c6Progress + mapped.c6Rows.length,
      teams: counts.teams + mapped.teamSlots.length,
      teamMembers: counts.teamMembers + mapped.teamSlots.reduce((sum, slot) => sum + slot.members.length, 0),
      items: counts.items + mapped.itemRows.length,
      missionProgress: counts.missionProgress + mapped.missionMapping.rows.length,
      characterCombatStats: counts.characterCombatStats + mapped.characterCombatRows.length,
    }), { resourceBalances: 0, characters: 0, c6Progress: 0, teams: 0, teamMembers: 0, items: 0, missionProgress: 0, characterCombatStats: 0 }),
    sharedDomains: ['Social', 'Giveaway', 'Codes', 'Boss', 'Event', 'Banner', 'DailyCombat', 'Contest'],
  }) + '\n');
  if (purgePlan.retainedPlayers !== BigInt(accounts.players.length) || purgePlan.retainedWebIdentities !== BigInt(accounts.players.filter(row => row.hasWebAccount).length) ||
    purgePlan.retainedRoles !== BigInt(accounts.roles.length) || purgePlan.retainedPreferences !== BigInt(accounts.preferences.length) ||
    purgePlan.retainedPrivacy !== BigInt(accounts.privacy.length)) throw new Error('Existing web preservation plan is incomplete.');
  for (const table of ['global_chat_messages', 'direct_messages', 'notifications', 'player_sessions']) {
    if (purgePlan.deleteOrder.find(row => row.table === table)?.rows !== 1n) throw new Error(`Private purge missed seeded ${table}.`);
  }
  const before = await capturePrivateSchema(isolated.admin, isolated.schema);
  const beforeFile = await writePrivateBackup(before, 'before');
  const rollbackMarker = new Error('INTENTIONAL_PRIVATE_GLOBAL_ROLLBACK');
  const execute = (injectFailure: boolean) => db.$transaction(async db => {
    await applyPrivateCutoverPurge(db, purgePlan);
    if (await db.playerProgression.count() !== 0 || await db.playerSession.count() !== 0 ||
      await db.player.count() !== accounts.players.length || await db.webIdentity.count() !== accounts.players.filter(row => row.hasWebAccount).length)
      throw new Error('Private purge did not preserve accounts or clear test gameplay.');
    await db.player.updateMany({ where: { id: { in: plan.unmatchedWebPlayerIds } }, data: { elementKey: null } });
    const manifest = JSON.parse((await readFile(resolve(directory, 'manifest.json'), 'utf8')).replace(/^\uFEFF/, '')) as {
      files: { name: string; size: number; sha256: string; sourceModifiedUtc?: string }[]; capturedAtUtc?: string };
    const batch = await db.migrationBatch.create({ data: { snapshotHash: snapshot.hash, status: 'APPLYING', mode: 'REHEARSAL',
      migratorVersion: 'legacy-foundation-v1', capturedAt: manifest.capturedAtUtc ? new Date(manifest.capturedAtUtc) : null } });
    await db.migrationSourceFile.createMany({ data: manifest.files.map(file => ({ batchId: batch.id, sourceName: file.name,
      contentHash: file.sha256, byteSize: BigInt(file.size), capturedAt: manifest.capturedAtUtc ? new Date(manifest.capturedAtUtc) : null,
      sourceModifiedAt: file.sourceModifiedUtc ? new Date(file.sourceModifiedUtc) : null })) });
    await db.migrationIssue.createMany({ data: plan.issues.map(issue => ({ batchId: batch.id, sourceName: issue.source,
      path: issue.path, legacyKey: issue.legacyKey ?? null, severity: issue.severity, issueCode: issue.code,
      description: issue.code, resolution: issue.severity === 'QUARANTINE' ? 'Source quarantined; Box authoritative' : 'Applied validated correction' })) });
    await db.migrationMapping.createMany({ data: plan.players.map(player => ({ batchId: batch.id,
      sourceName: 'viewers_data.json', legacyType: 'VIEWER', legacyKey: player.legacyUsername,
      targetType: 'PLAYER', targetId: player.playerId, twitchUserId: player.twitchUserId,
      twitchLogin: player.twitchLogin, twitchDisplayName: player.twitchDisplayName,
      mappingMode: player.mappingMode, status: 'RESOLVED' })) });
    let imported = 0;
    for (const player of plan.players) {
      await applyLegacyPersonalState(db, player, personalPlans.get(player.playerId)!, batch.id, snapshot.hash, cutoverAt);
      imported++;
    }
    const social = await applyLegacySocial(db, snapshot, plan, batch.id);
    const giveaway = await applyLegacyGiveaway(db, snapshot, plan, batch.id);
    const codes = await applyLegacyCodes(db, snapshot, plan, batch.id, cutoverAt);
    const boss = await applyLegacyBoss(db, snapshot, plan, batch.id);
    const event = await applyLegacyEvent(db, snapshot, plan, batch.id, cutoverAt);
    const banner = await applyLegacyBanner(db, snapshot, plan, batch.id, cutoverAt);
    const dailyCombat = await applyLegacyDailyCombat(db, snapshot, plan, batch.id, cutoverAt);
    const contest = await applyLegacyContest(db, snapshot, plan, batch.id, cutoverAt);
    const favorRows = await db.playerFavorState.findMany({ select: { playerId: true, activeFromDate: true, activeUntilDate: true } });
    const favorByPlayer = new Map(favorRows.map(row => [row.playerId, row]));
    for (const player of plan.players) {
      if (player.viewer.favor == null) continue;
      const days = (player.viewer.favor as { daysRemaining: number }).daysRemaining;
      const state = favorByPlayer.get(player.playerId);
      if (!state || remainingFavorDays(state.activeFromDate, state.activeUntilDate, getBusinessDate(cutoverAt)) !== days)
        throw new Error('Private Faveur calendar differs from legacy starting balance.');
    }
    const progressionRows = await db.playerProgression.findMany({ select: { playerId: true, legacyLastXpDate: true } });
    const xpByPlayer = new Map(progressionRows.map(row => [row.playerId, row.legacyLastXpDate?.toISOString().slice(0, 10) ?? null]));
    for (const player of plan.players) {
      const expected = (player.viewer.dates as { lastXpDate?: string } | undefined)?.lastXpDate ?? null;
      if (xpByPlayer.get(player.playerId) !== expected) throw new Error('Private legacy lastXpDate was not retained.');
    }
    const legacyWin = await db.giveawayWin.findFirst({ where: { origin: 'LEGACY' } });
    if (!legacyWin || legacyWin.drawIndex !== 0 || legacyWin.operationId !== null || legacyWin.drawnAt !== null)
      throw new Error('Private Giveaway result provenance is incomplete.');
    const issueRows = await db.migrationIssue.findMany({ where: { batchId: batch.id }, select: { severity: true, issueCode: true, domain: true } });
    const issueCounts = Object.fromEntries([...new Set(issueRows.map(issue => `${issue.severity}:${issue.issueCode}`))].sort()
      .map(key => [key, issueRows.filter(issue => `${issue.severity}:${issue.issueCode}` === key).length]));
    const personalIssueDomains = Object.fromEntries([...new Set(issueRows.filter(issue => issue.issueCode === 'PERSONAL_MAPPING_ANOMALY').map(issue => issue.domain ?? 'UNKNOWN'))].sort()
      .map(domain => [domain, issueRows.filter(issue => issue.issueCode === 'PERSONAL_MAPPING_ANOMALY' && (issue.domain ?? 'UNKNOWN') === domain).length]));
    const stats = { logicalNumericStateHash: await privateNumericStateHash(db, isolated.schema),
      imported, players: await db.player.count(), webAccounts: await db.webIdentity.count(),
      identityRows: await db.twitchIdentity.count(), runs: await db.migrationRun.count({ where: { batchId: batch.id } }),
      resourceMovements: await db.resourceMovement.count(), businessOperations: await db.businessOperation.count(),
      fabricatedHistories: { itemAcquisitions: await db.itemAcquisition.count(), pulls: await db.pullOperation.count(),
        bossAttacks: await db.bossAttack.count(), friendHearts: await db.friendHeart.count(),
        bankTransactions: await db.bankTransaction.count(), shopPurchases: await db.shopPurchase.count(),
        notifications: await db.notification.count() },
      clearedMessaging: { globalChat: await db.globalChatMessage.count(), directMessages: await db.directMessage.count(),
        tradeRequests: await db.tradeRequest.count() },
      favor: { states: await db.playerFavorState.count(), calendarChecked: favorRows.length,
        grants: await db.favorGrant.count(), claims: await db.favorDailyClaim.count() },
      xpDatesRetained: progressionRows.filter(row => row.legacyLastXpDate !== null).length,
      clearedSessions: await db.playerSession.count(),
      bossAggregates: await db.bossLegacyAggregate.count(),
      unmatchedWebElement: (await db.player.findUniqueOrThrow({ where: { id: unmatchedId } })).elementKey,
      reusedPlayers: reused, futureTwitchOnly: plan.players.length - reused,
      retainedRoles: await db.playerRoleAssignment.count(),
      sourceFiles: await db.migrationSourceFile.count({ where: { batchId: batch.id } }),
      issues: issueRows.length, issueCounts, personalIssueDomains,
      social,
      giveaway,
      codes,
      boss,
      event,
      banner,
      dailyCombat,
      contest,
      purge: { tables: purgePlan.deleteOrder.length, rows: purgePlan.deletedRows.toString(), tablesWithRows: purgePlan.tablesWithRows },
      unknownPaths: plan.unknownPaths,
      excludedProfiles: plan.excludedProfiles,
      intentionalDrops: { excludedFriendships: plan.friendshipExcluded, excludedRequests: plan.requestExcluded,
        staleContestLocks: contest.staleLocks, testRowsPurged: purgePlan.deletedRows.toString() },
    };
    const expectedPlayers = existingWeb.length + plan.players.filter(player => player.mappingMode === 'TWITCH_ONLY').length;
    const expectedFavorStates = plan.players.filter(player => player.viewer.favor != null).length;
    const retainedTwitch = await db.twitchIdentity.findUniqueOrThrow({ where: { playerId: existingId } });
    const mappedIdentity = plan.players.find(row => row.playerId === existingId)!;
    if (retainedTwitch.displayName !== mappedIdentity.twitchDisplayName || retainedTwitch.login !== mappedIdentity.twitchLogin) throw new Error('Current Twitch identity was not refreshed.');
    await assertLegacyAccountPreservation(db, accounts, plan.players.map(row => row.playerId));
    if (stats.imported !== plan.players.length || stats.players !== expectedPlayers || stats.identityRows !== accounts.identities.length + plan.players.filter(row => !accounts.identities.some(identity => identity.playerId === row.playerId)).length || stats.runs !== plan.players.length ||
      stats.resourceMovements !== 0 || stats.businessOperations !== 0 || stats.unmatchedWebElement !== null || stats.sourceFiles !== 17 ||
      stats.retainedRoles !== accounts.roles.length ||
      stats.unknownPaths !== 0 || issueRows.some(issue => issue.severity === 'BLOCKER') ||
      stats.social.friendships !== plan.friendshipCount || stats.social.requests !== plan.requestCount ||
      Object.values(stats.fabricatedHistories).some(count => count !== 0) || Object.values(stats.clearedMessaging).some(count => count !== 0) ||
      stats.favor.states !== expectedFavorStates || stats.favor.calendarChecked !== expectedFavorStates ||
      stats.favor.grants !== 0 || stats.favor.claims > stats.favor.states || stats.bossAggregates !== stats.boss.bosses ||
      stats.clearedSessions !== 0 || stats.giveaway.wins !== 1)
      throw new Error(`Personal rehearsal invariant failed: ${JSON.stringify(stats)}`);
    if (snapshot.hash === '1852d7141a121c335c5928a8265c20e840e5c5dd20ccee12b054b99f780806ba' &&
      (plan.players.length !== 45 || plan.excludedProfiles !== 168 || stats.social.friendships !== 86 || stats.social.requests !== 19 ||
        stats.codes.catalog !== 12 || stats.codes.archived !== 2 || stats.boss.bosses !== 2 || stats.giveaway.sessions !== 1))
      throw new Error('Frozen snapshot controls differ from the audited capture.');
    await db.migrationBatch.update({ where: { id: batch.id }, data: { status: 'COMPLETED', completedAt: new Date(), summary: stats } });
    if (injectFailure) throw rollbackMarker;
    return stats;
  }, { timeout: 300_000, maxWait: 10_000 });
  try { await execute(true); throw new Error('Global rollback probe unexpectedly committed.'); }
  catch (error) { if (error !== rollbackMarker) throw error; }
  if ((await capturePrivateSchema(isolated.admin, isolated.schema)).hash !== before.hash)
    throw new Error('Global rollback changed private target data.');
  const first = await execute(false);
  const importedBackup = await capturePrivateSchema(isolated.admin, isolated.schema);
  const importedFile = await writePrivateBackup(importedBackup, 'imported');
  await restorePrivateBackup(isolated.admin, isolated.schema, beforeFile);
  const second = await execute(false);
  deepStrictEqual(second, first);
  await restorePrivateBackup(isolated.admin, isolated.schema, importedFile);
  process.stdout.write(JSON.stringify({ phase: 'PRIVATE_GLOBAL_REHEARSAL', identityMode,
    ...first, snapshotHash: snapshot.hash, globalRollbackVerified: true, idempotentCleanTarget: true,
    privateBackupRestoreVerified: true,
    exit30Certified: identityMode === 'VERIFIED_TWITCH_IDENTITIES' }) + '\n');
} finally {
  if (setupStarted) await isolated.cleanup();
}

}
await main().catch(error => {
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'PRIVATE_REHEARSAL_FAILED';
  process.stderr.write(`${code}; private details withheld.\n`); process.exitCode = 1;
});
