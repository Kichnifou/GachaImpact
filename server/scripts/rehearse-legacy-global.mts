import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isolatedBatchDatabase } from '../tests-db/isolated-batch-database.js';
import { loadLegacySnapshotDirectory } from '../src/application/migration/legacy-snapshot-directory.js';
import { buildLegacyGlobalPlan, fixtureTwitchResolution } from '../src/application/migration/legacy-global-plan.js';
import { SnapshotPilotService } from '../src/application/migration/snapshot-pilot-service.js';
import { applyLegacyPersonalState, ensureLegacyCharacterAvatars } from '../src/application/migration/legacy-personal-apply.js';
import { applyLegacySocial } from '../src/application/migration/legacy-social-apply.js';
import { applyLegacyGiveaway } from '../src/application/migration/legacy-giveaway-apply.js';
import { applyLegacyCodes } from '../src/application/migration/legacy-code-apply.js';
import { applyLegacyBoss } from '../src/application/migration/legacy-boss-apply.js';
import { applyLegacyEvent } from '../src/application/migration/legacy-event-apply.js';
import { applyLegacyBanner } from '../src/application/migration/legacy-banner-apply.js';
import { applyLegacyDailyCombat } from '../src/application/migration/legacy-daily-combat-apply.js';
import { applyPrivateCutoverPurge, buildCutoverPurgePlan } from '../src/application/migration/legacy-cutover-purge.js';
import { applyLegacyContest } from '../src/application/migration/legacy-contest-apply.js';
import { remainingFavorDays } from '../src/application/migration/legacy-favor-calendar.js';
import { getBusinessDate } from '../src/domain/time/business-date.js';

const directory = process.argv[2];
if (!directory) throw new Error('Usage: tsx scripts/rehearse-legacy-global.mts <ignored-snapshot-directory> [cutover-ISO-instant]');
const snapshot = await loadLegacySnapshotDirectory(resolve(directory));
const catalog = JSON.parse(await readFile(new URL('../prisma/data/characters.json', import.meta.url), 'utf8')) as { externalKey: string }[];
const identities = fixtureTwitchResolution(snapshot);
const existingId = randomUUID(), unmatchedId = randomUUID();
const existingWeb = [
  { id: existingId, displayName: 'Existing web fixture', twitchUserId: identities[0]!.twitchUserId },
  { id: unmatchedId, displayName: 'Unmatched web fixture', twitchUserId: null },
];
const cutoverAt = new Date(process.argv[3] ?? '2026-09-26T19:00:00.000Z');
if (Number.isNaN(cutoverAt.getTime())) throw new Error('Invalid cutover instant.');
const plan = buildLegacyGlobalPlan(snapshot, identities, existingWeb, new Set(catalog.map(row => row.externalKey)),
  [{ playerId: existingId, twitchUserId: identities[0]!.twitchUserId }], cutoverAt);
if (plan.issues.some(issue => issue.severity === 'BLOCKER') || plan.players.length === 0) throw new Error('Population rehearsal blocked.');
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
  await db.player.createMany({ data: existingWeb.map(row => ({ id: row.id, displayName: row.displayName, elementKey: 'pyro' })) });
  await db.webIdentity.createMany({ data: existingWeb.map(row => ({ playerId: row.id, provider: 'fixture', providerSubject: row.id })) });
  await db.playerPreference.create({ data: { playerId: existingId, preferenceKey: 'menu.defaultTab', value: 'inventory' } });
  await db.privacySetting.create({ data: { playerId: existingId, categoryKey: 'CURRENCY_BALANCES', level: 'FRIENDS' } });
  await db.playerRoleAssignment.create({ data: { playerId: existingId, role: 'TESTER', source: 'private-rehearsal' } });
  await db.playerSession.create({ data: { playerId: existingId, sessionTokenHash: randomBytes(32).toString('hex') } });
  await db.twitchIdentity.create({ data: { playerId: existingId, twitchUserId: identities[0]!.twitchUserId, login: identities[0]!.currentLogin,
    displayName: 'Stale twitch fixture' } });
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
  if (purgePlan.retainedPlayers !== 2n || purgePlan.retainedWebIdentities !== 2n || purgePlan.retainedRoles !== 1n ||
    purgePlan.retainedPreferences !== 1n || purgePlan.retainedPrivacy !== 1n) throw new Error('Existing web preservation plan is incomplete.');
  for (const table of ['global_chat_messages', 'direct_messages', 'notifications', 'player_sessions']) {
    if (purgePlan.deleteOrder.find(row => row.table === table)?.rows !== 1n) throw new Error(`Private purge missed seeded ${table}.`);
  }
  await applyPrivateCutoverPurge(db, purgePlan);
  if (await db.playerProgression.count() !== 0 || await db.playerSession.count() !== 0 ||
    await db.player.count() !== 2 || await db.webIdentity.count() !== 2)
    throw new Error('Private purge did not preserve accounts or clear test gameplay.');
  await db.player.update({ where: { id: unmatchedId }, data: { elementKey: null } });
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
  const pilot = new SnapshotPilotService(db, {} as never, 'private-rehearsal');
  const rollbackPlayer = plan.players.find(player => player.mappingMode === 'TWITCH_ONLY');
  if (!rollbackPlayer) throw new Error('Rollback probe needs a new private Player.');
  const rollbackMapped = await pilot.globalPlayerPlan(rollbackPlayer.playerId, rollbackPlayer.legacyUsername, snapshot, cutoverAt);
  const rollbackMarker = new Error('INTENTIONAL_PRIVATE_ROLLBACK');
  try {
    await db.$transaction(async tx => { await applyLegacyPersonalState(tx, rollbackPlayer, rollbackMapped, batch.id, snapshot.hash, cutoverAt); throw rollbackMarker; }, { timeout: 30_000 });
    throw new Error('Rollback probe unexpectedly committed.');
  } catch (error) { if (error !== rollbackMarker) throw error; }
  if (await db.player.findUnique({ where: { id: rollbackPlayer.playerId } })) throw new Error('Private rollback retained Player state.');
  let imported = 0;
  for (const player of plan.players) {
    const mapped = await pilot.globalPlayerPlan(player.playerId, player.legacyUsername, snapshot, cutoverAt);
    await db.$transaction(tx => applyLegacyPersonalState(tx, player, mapped, batch.id, snapshot.hash, cutoverAt), { timeout: 30_000 });
    imported++;
  }
  const social = await db.$transaction(tx => applyLegacySocial(tx, snapshot, plan, batch.id), { timeout: 30_000 });
  const giveaway = await db.$transaction(tx => applyLegacyGiveaway(tx, snapshot, plan, batch.id), { timeout: 30_000 });
  const codes = await db.$transaction(tx => applyLegacyCodes(tx, snapshot, plan, batch.id, cutoverAt), { timeout: 30_000 });
  const boss = await db.$transaction(tx => applyLegacyBoss(tx, snapshot, plan, batch.id), { timeout: 30_000 });
  const event = await db.$transaction(tx => applyLegacyEvent(tx, snapshot, plan, batch.id, cutoverAt), { timeout: 30_000 });
  const banner = await db.$transaction(tx => applyLegacyBanner(tx, snapshot, plan, batch.id, cutoverAt), { timeout: 30_000 });
  const dailyCombat = await db.$transaction(tx => applyLegacyDailyCombat(tx, snapshot, plan, batch.id, cutoverAt), { timeout: 30_000 });
  const contest = await db.$transaction(tx => applyLegacyContest(tx, snapshot, plan, batch.id, cutoverAt), { timeout: 30_000 });
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
  const stats = { imported, players: await db.player.count(), webAccounts: await db.webIdentity.count(),
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
    retainedWebDisplayName: (await db.player.findUniqueOrThrow({ where: { id: existingId } })).displayName,
    retainedPreference: (await db.playerPreference.findUniqueOrThrow({ where: { playerId_preferenceKey: { playerId: existingId, preferenceKey: 'menu.defaultTab' } } })).value,
    retainedPrivacy: (await db.privacySetting.findUniqueOrThrow({ where: { playerId_categoryKey: { playerId: existingId, categoryKey: 'CURRENCY_BALANCES' } } })).level,
    retainedRoles: await db.playerRoleAssignment.count({ where: { playerId: existingId, revokedAt: null } }),
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
  if (retainedTwitch.displayName !== identities[0]!.displayName) throw new Error('Current Twitch display name was not refreshed.');
  if (stats.imported !== plan.players.length || stats.players !== expectedPlayers || stats.identityRows !== plan.players.length || stats.runs !== plan.players.length ||
    stats.resourceMovements !== 0 || stats.businessOperations !== 0 || stats.unmatchedWebElement !== null || stats.sourceFiles !== 17 ||
    stats.retainedWebDisplayName !== 'Existing web fixture' || stats.retainedPreference !== 'inventory' || stats.retainedPrivacy !== 'FRIENDS' || stats.retainedRoles !== 1 ||
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
  process.stdout.write(JSON.stringify({ phase: 'PRIVATE_GLOBAL_REHEARSAL', ...stats, snapshotHash: snapshot.hash }) + '\n');
} finally {
  if (setupStarted) await isolated.cleanup();
}
