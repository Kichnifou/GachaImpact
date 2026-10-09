import { randomUUID } from 'node:crypto';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../generated/prisma/client.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { canarySnapshot } from '../tests/helpers/legacy-canary-snapshot.js';
import { parseStreamerbotSnapshot, snapshotFileNames, type SnapshotFiles } from '../src/application/migration/streamerbot-snapshot.js';
import { createOwnerApprovedPopulation } from '../src/application/migration/owner-approved-population.js';
import { createVerifiedTwitchReport, type VerifiedTwitchReport } from '../src/application/migration/verified-twitch-report.js';
import { activateRecoveryProfiles, applyRecoveryProfile, planRecoveryProfile, validateRecoverySource, type RecoverySource } from '../src/application/migration/legacy-recovery.js';
import { canaryBackupHash, rollbackLegacyCanary, type CanaryBackup } from '../src/application/migration/legacy-canary.js';
import { captureTargetedPlayerRows } from '../src/application/migration/targeted-player-rows.js';
import { communityHash } from '../src/application/migration/legacy-community-proof.js';
import { recoveryExternalRows } from '../src/application/migration/legacy-recovery-facts.js';
import { permanentMissionCatalog } from '../src/domain/missions/permanent-mission-catalog.js';
import { TwitchNativeAuthority, STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { TwitchAccountLink } from '../src/application/twitch/twitch-account-link.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { verifiedPlayerActor } from '../src/application/player/player-execution-actor.js';
import { withPlayerCommandExecution } from '../src/application/player/player-command-execution.js';
import { GiftCodeService } from '../src/application/gift-code/gift-code-service.js';
import { BannerVoteService } from '../src/application/gacha/banner-vote-service.js';
import { bannerVoteContributions } from '../src/application/gacha/banner-vote-contributions.js';
import { PrismaBankingStore } from '../src/infrastructure/database/prisma-banking-store.js';
import { GetCurrentPlayerBank, TransferPlayerBank } from '../src/application/banking/banking-services.js';
import { PrismaGachaStore } from '../src/infrastructure/database/prisma-gacha-store.js';
import { PrismaBoxStore } from '../src/infrastructure/database/prisma-box-store.js';
import { GetCurrentPlayerBox } from '../src/application/box/box-services.js';
import { ExpeditionService } from '../src/application/expedition/expedition-service.js';
import { TwitchEventObserver, type TwitchObservedEvent } from '../src/application/twitch/twitch-event-observer.js';
import { TwitchFavorSubscriptionConsumer } from '../src/application/twitch/twitch-favor-subscription-consumer.js';
import { TwitchFavorResubConsumer } from '../src/application/twitch/twitch-favor-resub-consumer.js';
import { TwitchFavorGiftConsumer } from '../src/application/twitch/twitch-favor-gift-consumer.js';
import { giftFixture } from '../tests/helpers/twitch-gift-fixture.js';
import { TwitchGiftSupremeRuntime } from '../src/application/twitch/twitch-gift-supreme-runtime.js';

if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(process.env['DATABASE_URL'] ?? 'http://missing').hostname)) throw Error('Recovery tests require local PostgreSQL');
const fixture = isolatedBatchDatabase(), db = fixture.database;
const cutoverAt = new Date('2026-10-09T10:00:00Z'), cycleStartsAt = new Date('2026-10-04T22:00:00Z'), cycleEndsAt = new Date('2026-10-11T22:00:00Z');
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: true, globalEnabled: false },
  twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
const getPlayer = new GetCurrentPlayer({ findByIdentity: vi.fn(), provision: vi.fn() });
const clock = { now: () => cutoverAt }, authority = new TwitchNativeAuthority(db, config);
let scenarioNumber = 0, operatorId: string, archiveId: string, outsideId: string, bannerId: string, characterId: string, voteCharacterId: string, usedEditionId: string;
let backupDirectory: string, baseline: Awaited<ReturnType<typeof protectedState>>;
const backupPaths = new Map<string, string>();
let backupWrites = 0;

/** All 216 identities and every source byte are synthetic. Membership never follows a fresh element. */
function source() {
  const sequence = scenarioNumber++, seed = canarySnapshot().snapshot;
  const approved = Array.from({ length: 43 }, (_, index) => ({
    legacyLogin: index < 3 ? `native_${index}` : `recovery_${sequence}_${index}`,
    twitchUserId: String(index < 3 ? 970010000000 + index : 970020000000 + sequence * 1000 + index),
  }));
  const names = [...approved.map(row => row.legacyLogin), `quarantine_${sequence}_a`, `quarantine_${sequence}_b`,
    ...Array.from({ length: 171 }, (_, index) => `discarded_${sequence}_${index}`)];
  const base = structuredClone((seed.sources['viewers_data.json'] as Record<string, Record<string, unknown>>).fixture_canary!);
  const viewers = Object.fromEntries(names.map((name, index) => [name, { ...structuredClone(base), xp: 300 + index * 30,
    primogems: 1600 + index, moras: 80 + index }]));
  const historicalSourceFiles: SnapshotFiles = Object.fromEntries(snapshotFileNames.map(name => [name, JSON.stringify(
    name === 'viewers_data.json' ? viewers : name === 'c6_characters.json' ? {} : name === 'friendships_data.json' ? { friendships: {}, requests: [] }
      : name === 'contests_data.json' ? { currentContest: { status: 'none' }, dailyLocks: {} }
        : name === 'combat_data.json' ? { date: '2026-10-05' } : name === 'gift_codes.json' ? { codes: [] }
          : name === 'genshin_characters.json' ? { lastBannerUpdate: '2026-10-05', characters: Array.from({ length: 11 }, (_, i) => ({ id: i + 1, bannerFeatured: i < 4 || i >= 5 })) }
            : name === 'banner_votes.json' ? { weekId: '2026-10-05', voters: {}, votes: {} } : seed.sources[name]) ]));
  const historical = parseStreamerbotSnapshot(historicalSourceFiles);
  const users = approved.map((row, index) => ({ ...row, currentLogin: index === 0 ? 'kichnifou' : row.legacyLogin,
    displayName: `Synthetic profile ${index}`, renamed: index === 0 }));
  const historicalReport: VerifiedTwitchReport = { version: 1, verification: 'TWITCH_HELIX', snapshotHash: historical.hash,
    resolvedAt: new Date(Date.now() - 1000).toISOString(), users, missing: names.slice(43, 45), conflicts: [], duplicates: 0 };
  const population = createOwnerApprovedPopulation(historicalReport, historical);
  const freshViewers = structuredClone(viewers) as Record<string, Record<string, unknown>>;
  for (let index = 3; index < 43; index++) if (index % 5 === 0) freshViewers[approved[index]!.legacyLogin]!.element = null;
  const sourceFiles = { ...historicalSourceFiles, 'viewers_data.json': JSON.stringify(freshViewers) };
  const snapshot = parseStreamerbotSnapshot(sourceFiles);
  const freshReport = createVerifiedTwitchReport(snapshot, { users, missing: [], conflicts: [], duplicates: 0 }, new Date(), { kind: 'FINAL_POPULATION', population });
  const input: RecoverySource = { operationId: randomUUID(), sourceFiles, historicalSourceFiles, population, historicalReport, freshReport, cutoverAt };
  return { input, approved, viewers: freshViewers };
}
const main = source();
function changeViewer(s: ReturnType<typeof source>, index: number, patch: Record<string, unknown>): RecoverySource {
  const viewers = JSON.parse(s.input.sourceFiles['viewers_data.json']!) as Record<string, Record<string, unknown>>;
  Object.assign(viewers[s.approved[index]!.legacyLogin]!, patch);
  const sourceFiles = { ...s.input.sourceFiles, 'viewers_data.json': JSON.stringify(viewers) }, snapshot = parseStreamerbotSnapshot(sourceFiles);
  const original = s.input.freshReport as VerifiedTwitchReport;
  return { ...s.input, sourceFiles, freshReport: { ...original, snapshotHash: snapshot.hash } };
}
async function writeBackup(backup: CanaryBackup) {
  const target = path.join(backupDirectory, `${backup.hash}.json`), file = await open(target, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(backup)); await file.sync(); } finally { await file.close(); }
  backupPaths.set(backup.hash, target); backupWrites++;
  const saved = await readBackup(backup.hash), { hash, ...body } = saved;
  expect(canaryBackupHash(body)).toBe(hash);
}
async function readBackup(hash: string): Promise<CanaryBackup> {
  const target = backupPaths.get(hash); if (!target) throw Error('PRIVATE_BACKUP_MISSING');
  return JSON.parse(await readFile(target, 'utf8')) as CanaryBackup;
}
const apply = (input: RecoverySource, id: string) => applyRecoveryProfile(db, config, operatorId, input, id, writeBackup, readBackup);
async function state(playerId: string) { return captureTargetedPlayerRows(db, [playerId]); }
async function actor(playerId: string) { return verifiedPlayerActor(await db.player.findUniqueOrThrow({ where: { id: playerId } })); }
async function protectedState() {
  const native = await db.twitchNativeTarget.findMany({ where: { twitchUserId: { in: [...main.approved.slice(0, 3).map(row => row.twitchUserId), '970010000099'] } }, orderBy: { twitchUserId: 'asc' } });
  return { rows: await captureTargetedPlayerRows(db, [...native.map(row => row.playerId!), archiveId].sort()), targets: native,
    imports: await db.twitchCanaryImport.findMany({ where: { twitchUserId: { in: native.map(row => row.twitchUserId) } }, orderBy: { id: 'asc' } }),
    archive: await db.player.findUniqueOrThrow({ where: { id: archiveId } }) };
}
async function externalVote(twitchUserId: string, snapshotHash: string) {
  const proof = { source: 'banner_votes.json.voters', twitchUserId, characterId: voteCharacterId,
    snapshotHash, originalSourceHash: 'a'.repeat(64), populationHash: 'b'.repeat(64), historicalReportHash: 'c'.repeat(64), verificationReportHash: 'd'.repeat(64) };
  return db.externalBannerVote.create({ data: { cycleStartsAt, bannerRotationId: bannerId, twitchUserId, characterId: voteCharacterId,
    proofHash: communityHash(proof), provenance: { ...proof, operationId: randomUUID() } } });
}

beforeAll(async () => {
  await fixture.setup({ prismaMigrations: true });
  await db.permanentMissionDefinition.createMany({ data: permanentMissionCatalog.map(row => ({ ...row })), skipDuplicates: true });
  for (let key = 1; key <= 11; key++) await db.character.create({ data: { externalKey: `legacy:${key}`, name: `Synthetic character ${key}`, rarity: key <= 5 ? 5 : 4, elementKey: 'cryo' } });
  const characters = await db.character.findMany(), byKey = new Map(characters.map(row => [row.externalKey, row]));
  characterId = byKey.get('legacy:1')!.id; voteCharacterId = byKey.get('legacy:5')!.id;
  const featured = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11];
  const banner = await db.bannerRotation.create({ data: { startsAt: cycleStartsAt, endsAt: cycleEndsAt, status: 'ACTIVE', legacyProvenance: { synthetic: true },
    featuredCharacters: { create: featured.map((key, index) => ({ characterId: byKey.get(`legacy:${key}`)!.id, rarity: index < 4 ? 5 : 4,
      slot: index < 4 ? index + 1 : index - 3, selectionSource: 'RANDOM' })) } } });
  bannerId = banner.id;
  for (const [index, identity] of [...main.approved.slice(0, 3), { legacyLogin: 'outside_test', twitchUserId: '970010000099' }].entries()) {
    const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: `Protected ${index}`, twitchIdentity: {
      twitchUserId: identity.twitchUserId, login: index === 0 ? 'kichnifou' : identity.legacyLogin, displayName: `Protected ${index}`, firstSeenAt: cutoverAt } }, cutoverAt));
    await db.player.update({ where: { id: player.id }, data: { elementKey: 'hydro', legacyUsername: identity.legacyLogin } });
    await db.playerProgression.update({ where: { playerId: player.id }, data: { xp: 7000n + BigInt(index) } });
    await db.playerGachaState.update({ where: { playerId: player.id }, data: { pity5: 27, totalPulls: 226n, selectedBannerCharacterId: characterId } });
    await db.playerResourceBalance.updateMany({ where: { playerId: player.id }, data: { amount: 770n + BigInt(index) } });
    await db.twitchNativeTarget.create({ data: { twitchUserId: identity.twitchUserId, playerId: player.id, dataAuthority: 'NATIVE', canary: true,
      acknowledgement: STREAMERBOT_PATH_DISABLED, transferredAt: cutoverAt } });
    await db.twitchCanaryImport.create({ data: { twitchUserId: identity.twitchUserId, playerId: player.id,
      snapshotHash: '1'.repeat(64), identityReportHash: '2'.repeat(64), backupHash: '3'.repeat(64) } });
    await new PrismaGachaStore(db).pull({ playerId: player.id, playerElementKey: 'hydro', count: 1,
      idempotencyKey: randomUUID(), now: cutoverAt, random: { nextInt: max => max - 1 }, sourceChannel: 'TWITCH' });
    if (index === 0) { operatorId = player.id; config.twitch.pilotPlayerIds.push(player.id); }
    if (index === 3) outsideId = player.id;
  }
  await db.playerRoleAssignment.create({ data: { playerId: operatorId, role: 'ADMIN', source: 'private-recovery' } });
  const archive = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Protected archived graph' }, cutoverAt));
  await db.playerProgression.update({ where: { playerId: archive.id }, data: { xp: 987n } });
  await db.player.update({ where: { id: archive.id }, data: { status: 'ARCHIVED' } }); archiveId = archive.id;
  await db.twitchNativeAuthority.create({ data: { id: 'twitch-commands', desiredMode: 'CANARY', revision: 12,
    operatorPlayerId: operatorId, acknowledgement: STREAMERBOT_PATH_DISABLED, acknowledgedAt: cutoverAt } });
  const code = await db.giftCode.create({ data: { token: 'RECOVERY_USED', title: 'Synthetic used code', description: '', type: 'ONE_OFF', status: 'PUBLISHED',
    startsAt: cycleStartsAt, endsAt: cycleEndsAt, publishedAt: cycleStartsAt,
    rewards: { create: { resourceKey: 'primogems', amount: 1600n } }, editions: { create: { editionKey: 'once', startsAt: cycleStartsAt, endsAt: cycleEndsAt } } }, include: { editions: true } });
  usedEditionId = code.editions[0]!.id;
  backupDirectory = await mkdtemp(path.join(tmpdir(), 'gacha-recovery-test-'));
  baseline = await protectedState();
}, 180_000);
afterAll(async () => {
  await fixture.cleanup();
  const pool = fixture.poolSnapshot(); expect(pool).toMatchObject({ total: 0, idle: 0, waiting: 0 }); expect(pool.closed).toBe(pool.opened);
  if (backupDirectory) {
    const resolved = path.resolve(backupDirectory);
    if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('gacha-recovery-test-')) throw Error('Unsafe private backup cleanup');
    await rm(resolved, { recursive: true });
  }
}, 60_000);

describe('bounded historical recovery on local PostgreSQL', () => {
  it('keeps historical membership fixed, excludes quarantines/discarded/test, and skips Native without any backup or personal comparison', async () => {
    const s = source(), validated = validateRecoverySource(s.input);
    expect(validated.population.approved).toHaveLength(43); expect(validated.population.historicalProof.ownerDiscardedLogins).toHaveLength(171);
    expect(validated.population.quarantined).toHaveLength(2);
    expect((await planRecoveryProfile(db, s.input, s.approved[5]!.twitchUserId)).status).toBe('READY');
    const write = vi.fn(), read = vi.fn(async () => { throw Error('Native must not read an old backup'); });
    for (const member of s.approved.slice(0, 3)) expect((await applyRecoveryProfile(db, config, operatorId, s.input, member.twitchUserId, write, read)).status).toBe('NATIVE');
    expect(write).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
    await expect(planRecoveryProfile(db, s.input, '970010000099')).rejects.toThrow('LEGACY_RECOVERY_OUTSIDE_POPULATION');
    expect((await db.player.findUniqueOrThrow({ where: { id: outsideId } })).status).toBe('ACTIVE');
    expect(await protectedState()).toEqual(baseline);
  });

  it('requires the durable backup before the first write and recovers a lost caller response without another import', async () => {
    const s = source(), id = s.approved[3]!.twitchUserId;
    const beforeCount = await db.player.count();
    await expect(applyRecoveryProfile(db, config, operatorId, s.input, id, async () => { throw Error('PRIVATE_BACKUP_FAILURE'); }, readBackup)).rejects.toThrow('PRIVATE_BACKUP_FAILURE');
    expect(await db.player.count()).toBe(beforeCount); expect(await db.twitchNativeTarget.findUnique({ where: { twitchUserId: id } })).toBeNull();
    const writesBefore = backupWrites;
    const imported = await apply(s.input, id); expect(imported.status).toBe('IMPORTED');
    if (imported.status !== 'IMPORTED') throw Error('Import fixture failed');
    const after = await state(imported.playerId), run = await db.twitchCanaryImport.findUniqueOrThrow({ where: { id: imported.runId } });
    expect((await readBackup(run.backupHash)).version).toBe(4); expect(backupWrites).toBe(writesBefore + 1);
    expect(await apply(s.input, id)).toMatchObject({ status: 'IMPORTED', playerId: imported.playerId, runId: imported.runId });
    expect(backupWrites).toBe(writesBefore + 1); expect(await state(imported.playerId)).toEqual(after);
    expect(await db.twitchCanaryImport.count({ where: { twitchUserId: id } })).toBe(1);
    expect(await authority.read()).toMatchObject({ desiredMode: 'CANARY', revision: 12 });
    expect(await protectedState()).toEqual(baseline);
  });

  it('isolates a malformed personal source and rejects source, identity and durable backup drift without reimport', async () => {
    const s = source(), invalid = changeViewer(s, 3, { xp: 'not-an-integer' }), id = s.approved[4]!.twitchUserId;
    await expect(apply(invalid, s.approved[3]!.twitchUserId)).rejects.toThrow();
    expect(await db.twitchIdentity.findUnique({ where: { twitchUserId: s.approved[3]!.twitchUserId } })).toBeNull();
    const imported = await apply(invalid, id); expect(imported.status).toBe('IMPORTED');
    if (imported.status !== 'IMPORTED') throw Error('Independent profile was blocked');
    const before = await state(imported.playerId), writesBefore = backupWrites;
    expect((await apply(changeViewer(s, 4, { xp: 999 }), id)).status).toBe('BLOCKED');
    const report = structuredClone(invalid.freshReport) as VerifiedTwitchReport; report.users[4]!.twitchUserId = '999999999999';
    await expect(apply({ ...invalid, freshReport: report }, id)).rejects.toThrow('LEGACY_RECOVERY_FRESH_IDENTITY_CONFLICT');
    await expect(applyRecoveryProfile(db, config, operatorId, invalid, id, writeBackup, async hash => ({ ...await readBackup(hash), hash: '0'.repeat(64) })))
      .rejects.toThrow('LEGACY_RECOVERY_BACKUP_DRIFT');
    expect(await state(imported.playerId)).toEqual(before); expect(backupWrites).toBe(writesBefore);
    expect(await protectedState()).toEqual(baseline);
  });

  it('confines mutations and R1055 before transfer while preserving an unrelated same-name Web progression', async () => {
    const s = source(), id = s.approved[3]!.twitchUserId;
    const web = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Synthetic profile 3', webIdentity: { provider: 'supabase', providerSubject: randomUUID() } }, cutoverAt));
    await db.playerProgression.update({ where: { playerId: web.id }, data: { xp: 4321n } });
    const webBefore = await state(web.id), imported = await apply(s.input, id);
    expect(imported.status).toBe('IMPORTED'); if (imported.status !== 'IMPORTED') throw Error('Import fixture failed');
    expect(imported.playerId).not.toBe(web.id); expect(await state(web.id)).toEqual(webBefore);
    const before = await state(imported.playerId), playerActor = await actor(imported.playerId), banking = new PrismaBankingStore(db);
    await expect(new TransferPlayerBank('deposit', getPlayer, banking, clock, 'TWITCH').execute(playerActor, 1n, randomUUID()))
      .rejects.toMatchObject({ code: 'PLAYER_RECOVERY_NOT_ACTIVATED' });
    const gacha = new PrismaGachaStore(db);
    for (const key of [undefined, randomUUID()]) await expect(gacha.setTarget(imported.playerId, characterId, key, 'TWITCH'))
      .rejects.toMatchObject({ code: 'PLAYER_RECOVERY_NOT_ACTIVATED' });
    const random = { nextInt: vi.fn(() => 0) };
    await expect(gacha.pull({ playerId: imported.playerId, playerElementKey: 'cryo', count: 1, idempotencyKey: randomUUID(), now: cutoverAt, random, sourceChannel: 'TWITCH' }))
      .rejects.toMatchObject({ code: 'PLAYER_RECOVERY_NOT_ACTIVATED' });
    expect(random.nextInt).not.toHaveBeenCalled();
    const identity = await db.webIdentity.findUniqueOrThrow({ where: { playerId: web.id } });
    await expect(new TwitchAccountLink(db, config).verified(identity.id, web.id, id, s.approved[3]!.legacyLogin, 'Synthetic profile 3'))
      .rejects.toMatchObject({ code: 'PLAYER_RECOVERY_NOT_ACTIVATED' });
    expect(await state(imported.playerId)).toEqual(before); expect(await state(web.id)).toEqual(webBefore);
  });

  it('restores an exact pre-transfer preimage including code tombstones and an external vote binding', async () => {
    const s = source(), input = changeViewer(s, 3, { usedCodes: ['PRIVATE_ROLLBACK_ONLY'] }), id = s.approved[3]!.twitchUserId;
    await externalVote(id, validateRecoverySource(input).snapshot.hash);
    const votesBefore = await recoveryExternalRows(db, id), imported = await apply(input, id);
    expect(imported.status).toBe('IMPORTED'); if (imported.status !== 'IMPORTED') throw Error('Import fixture failed');
    const backup = await readBackup(imported.marker.backupHash);
    await authority.configure(operatorId, 'OFF', []);
    expect(await rollbackLegacyCanary(db, config, operatorId, backup)).toMatchObject({ status: 'ROLLED_BACK' });
    expect(await state(imported.playerId)).toEqual(backup.rows);
    expect(await recoveryExternalRows(db, id)).toEqual(votesBefore);
    expect(await db.giftCode.findUnique({ where: { token: 'PRIVATE_ROLLBACK_ONLY' } })).toBeNull();
    expect(await db.twitchNativeTarget.findUnique({ where: { twitchUserId: id } })).toBeNull();
    await authority.resumePersistedCanary(operatorId, STREAMERBOT_PATH_DISABLED, (await authority.read()).revision);
    expect(await protectedState()).toEqual(baseline);
  });

  it('rejects a target from an unproven source banner or a different same-week composition atomically', async () => {
    const s = source(), input = changeViewer(s, 3, { selectedBannerCharacterId: 1 }), id = s.approved[3]!.twitchUserId;
    const playersBefore = await db.player.count();
    await expect(apply(input, id)).rejects.toThrow('LEGACY_RECOVERY_LEGACY_BANNER_NOT_RESTORED');
    const bannerSource = JSON.parse(input.sourceFiles['genshin_characters.json']!);
    bannerSource.characters[0].bannerFeatured = false; bannerSource.characters[4].bannerFeatured = true;
    const sourceFiles = { ...input.sourceFiles, 'genshin_characters.json': JSON.stringify(bannerSource) }, hash = parseStreamerbotSnapshot(sourceFiles).hash;
    const changed = { ...input, sourceFiles, freshReport: { ...input.freshReport as VerifiedTwitchReport, snapshotHash: hash } };
    await db.bannerRotation.update({ where: { id: bannerId }, data: { legacyProvenance: { source: 'genshin_characters.json', snapshotHash: hash } } });
    await expect(apply(changed, id)).rejects.toThrow('LEGACY_RECOVERY_LEGACY_BANNER_NOT_RESTORED');
    expect(await db.player.count()).toBe(playersBefore); expect(await db.twitchIdentity.findUnique({ where: { twitchUserId: id } })).toBeNull();
    expect(await db.twitchNativeTarget.findUnique({ where: { twitchUserId: id } })).toBeNull();
    expect(await protectedState()).toEqual(baseline);
  });

  it('resumes forty heterogeneous imports, activates exactly the authorized 43 plus the test, and preserves subsequent gameplay', async () => {
    const input = changeViewer(main, 3, { usedCodes: ['RECOVERY_USED'], selectedBannerCharacterId: 1 }), sourceProof = validateRecoverySource(input);
    await db.bannerRotation.update({ where: { id: bannerId }, data: { legacyProvenance: { source: 'genshin_characters.json', snapshotHash: sourceProof.snapshot.hash } } });
    await externalVote(main.approved[3]!.twitchUserId, sourceProof.snapshot.hash);
    const beforeVotes = await db.$transaction(tx => bannerVoteContributions(tx, bannerId), { isolationLevel: 'RepeatableRead' });
    const beforeImports = await db.twitchCanaryImport.count(), writesBefore = backupWrites, start = performance.now();
    const importedPlayers = new Map<string, string>();
    for (const member of main.approved.slice(3, 8)) {
      const result = await apply(input, member.twitchUserId); expect(result.status).toBe('IMPORTED');
      if (result.status === 'IMPORTED') importedPlayers.set(member.twitchUserId, result.playerId);
    }
    const firstRuns = await db.twitchCanaryImport.findMany({ where: { twitchUserId: { in: [...importedPlayers.keys()] } }, orderBy: { id: 'asc' } });
    // This second loop is a fresh process decision: it starts again at the beginning of the manifest.
    for (const member of main.approved) {
      const result = await apply(input, member.twitchUserId);
      expect(['IMPORTED', 'NATIVE']).toContain(result.status);
      if (result.status === 'IMPORTED') importedPlayers.set(member.twitchUserId, result.playerId);
    }
    expect(importedPlayers.size).toBe(40); expect(backupWrites - writesBefore).toBe(40);
    expect(await db.twitchCanaryImport.count()).toBe(beforeImports + 40);
    expect(await db.twitchCanaryImport.findMany({ where: { id: { in: firstRuns.map(row => row.id) } }, orderBy: { id: 'asc' } })).toEqual(firstRuns);
    for (const [index, member] of main.approved.entries()) if (index >= 3) {
      const playerId = importedPlayers.get(member.twitchUserId)!;
      expect(await db.player.findUniqueOrThrow({ where: { id: playerId } })).toMatchObject({ elementKey: index % 5 === 0 ? null : 'cryo' });
      expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId } })).toMatchObject({ xp: BigInt(300 + index * 30) });
      expect(await db.playerBankAccount.findUniqueOrThrow({ where: { playerId } })).toMatchObject({ balance: 40n });
    }
    expect(await protectedState()).toEqual(baseline);
    expect(await db.twitchNativeTarget.count({ where: { canary: true } })).toBe(4);
    const observer = new TwitchEventObserver(db), deferredEvents = [];
    for (const [kind, index] of [['subscribe', 8], ['resub', 9], ['gift', 11]] as const) {
      const member = main.approved[index]!, playerId = importedPlayers.get(member.twitchUserId)!;
      const before = await state(playerId), balance = await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'primogems' } } });
      const event: TwitchObservedEvent = { externalEventId: randomUUID(), twitchUserId: member.twitchUserId,
        eventType: kind === 'subscribe' ? 'channel.subscribe' : kind === 'resub' ? 'channel.subscription.message' : 'channel.subscription.gift',
        ...(kind === 'subscribe' ? { subscriptionProof: { broadcasterTwitchId: '12', tier: '1000', isGift: false } }
          : kind === 'resub' ? { subscriptionMessageProof: { broadcasterTwitchId: '12', tier: '1000' } }
            : { subscriptionGiftProof: { broadcasterTwitchId: '12', tier: '1000', total: 2, isAnonymous: false } }) };
      const consumer = kind === 'subscribe' ? new TwitchFavorSubscriptionConsumer(db, clock)
        : kind === 'resub' ? new TwitchFavorResubConsumer(db, clock) : new TwitchFavorGiftConsumer(db, clock);
      const observed = await observer.observeTwitchEvent(event);
      await expect(consumer.consume(observed.receipt.id)).rejects.toMatchObject({ code: 'PLAYER_RECOVERY_NOT_ACTIVATED', statusCode: 503 });
      expect(await state(playerId)).toEqual(before);
      const recovery = (await db.player.findUniqueOrThrow({ where: { id: playerId } })).legacyRecovery;
      expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: observed.receipt.id } })).toMatchObject({
        state: 'RECEIVED', processedAt: null, externalReference: null,
        payloadMinimal: { recoveryDeferred: { version: 1, kind: 'FAVOR', playerId, recovery } } });
      deferredEvents.push({ event, receiptId: observed.receipt.id, consumer, playerId, originalAmount: balance.amount,
        amount: kind === 'gift' ? 3200n : 1600n, operationType: kind === 'gift' ? 'favor.gifter-bonus' : 'favor.grant' });
    }
    const giftPlayerId = importedPlayers.get(main.approved[12]!.twitchUserId)!, giftPlayer = await db.player.findUniqueOrThrow({ where: { id: giftPlayerId } });
    const giftBefore = await state(giftPlayerId), giftBalance = await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: giftPlayerId, resourceKey: 'particles_cryo' } } });
    const broadcasterId = main.approved[0]!.twitchUserId, gift = giftFixture(db, operatorId, broadcasterId);
    await db.twitchGiftSupremeCredential.create({ data: { playerId: operatorId, twitchUserId: broadcasterId, encryptedRefreshToken: gift.row!.encryptedRefreshToken, scopes: gift.row!.scopes! } });
    await gift.manager.ensure(operatorId);
    const giftRuntime = new TwitchGiftSupremeRuntime(db, clock, gift.manager), redemptionId = randomUUID(), deliveryIds = [randomUUID(), randomUUID()];
    const giftPayload = { subscription: { type: 'channel.channel_points_custom_reward_redemption.add', version: '1', status: 'enabled', condition: { broadcaster_user_id: broadcasterId, reward_id: 'reward-1' } },
      event: { id: redemptionId, broadcaster_user_id: broadcasterId, user_id: '999999', user_login: 'outside_gifter', user_name: 'Outside Gifter', user_input: giftPlayer.displayName,
        status: 'unfulfilled', reward: { id: 'reward-1', title: 'Gift Suprême', cost: 10000 }, redeemed_at: '2026-09-29T12:00:00Z' } };
    for (const messageId of deliveryIds) await expect(giftRuntime.consumeAuthenticated(giftPayload, { messageId, payloadHash: 'a'.repeat(64) }))
      .rejects.toMatchObject({ code: 'PLAYER_RECOVERY_NOT_ACTIVATED', statusCode: 503 });
    expect(await state(giftPlayerId)).toEqual(giftBefore);
    const giftReceiptIds = ['gift-supreme:' + redemptionId, ...deliveryIds];
    const giftReceipts = await db.twitchEventReceipt.findMany({ where: { externalEventId: { in: giftReceiptIds } } });
    expect(giftReceipts).toHaveLength(3);
    for (const receipt of giftReceipts) expect(receipt).toMatchObject({ state: 'RECEIVED', processedAt: null, externalReference: null,
      payloadMinimal: { recoveryDeferred: { version: 1, kind: 'GIFT_SUPREME', playerId: giftPlayerId, recovery: giftPlayer.legacyRecovery } } });
    const interruptedDeliveryId = randomUUID();
    await db.twitchEventReceipt.create({ data: { externalEventId: interruptedDeliveryId, eventType: 'channel.channel_points_custom_reward_redemption.add', twitchUserId: '999999',
      state: 'RECEIVED', payloadHash: 'a'.repeat(64), payloadMinimal: { redemptionId, rewardId: 'reward-1', broadcasterId } } });
    giftReceiptIds.push(interruptedDeliveryId);
    expect(gift.network.mock.calls.filter(([url]) => String(url).endsWith('/chat/messages'))).toHaveLength(0);
    const beforeControl = await authority.read(); expect(beforeControl.desiredMode).toBe('CANARY');
    await authority.configure(operatorId, 'OFF', [], undefined, beforeControl.revision);
    const off = await authority.read(), ids = main.approved.map(row => row.twitchUserId);
    const giftImport = await db.twitchCanaryImport.findFirstOrThrow({ where: { playerId: giftPlayerId }, orderBy: { importedAt: 'desc' } });
    const receiptsBeforeRollback = await db.twitchEventReceipt.findMany({ where: { externalEventId: { in: giftReceiptIds } }, orderBy: { id: 'asc' } });
    const auditsBeforeRollback = await db.twitchNativeAudit.count();
    await expect(rollbackLegacyCanary(db, config, operatorId, await readBackup(giftImport.backupHash))).rejects.toThrow('CANARY_OPERATIONS_IN_FLIGHT');
    expect(await state(giftPlayerId)).toEqual(giftBefore);
    expect(await db.twitchEventReceipt.findMany({ where: { externalEventId: { in: giftReceiptIds } }, orderBy: { id: 'asc' } })).toEqual(receiptsBeforeRollback);
    expect(await db.twitchCanaryImport.findUniqueOrThrow({ where: { id: giftImport.id } })).toEqual(giftImport);
    expect(await authority.read()).toEqual(off); expect(await db.twitchNativeAudit.count()).toBe(auditsBeforeRollback);
    await expect(activateRecoveryProfiles(db, config, operatorId, input, ids, off.revision - 1, readBackup)).rejects.toMatchObject({ code: 'TWITCH_NATIVE_AUTHORITY_CHANGED' });
    expect(await db.twitchNativeTarget.count({ where: { canary: true } })).toBe(4);
    const deferredReceipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: deferredEvents[0]!.receiptId } });
    const originalPayload = deferredReceipt.payloadMinimal as Prisma.JsonObject, originalMarker = originalPayload.recoveryDeferred as Prisma.JsonObject;
    const originalRecovery = originalMarker.recovery as Prisma.JsonObject, auditsBeforeTamper = await db.twitchNativeAudit.count();
    for (const patch of [{ recovery: { ...originalRecovery, importId: randomUUID() } }, { playerId: deferredEvents[1]!.playerId }]) {
      await db.twitchEventReceipt.update({ where: { id: deferredReceipt.id }, data: {
        payloadMinimal: { ...originalPayload, recoveryDeferred: { ...originalMarker, ...patch } } as Prisma.InputJsonObject } });
      await expect(activateRecoveryProfiles(db, config, operatorId, input, ids, off.revision, readBackup))
        .rejects.toMatchObject({ code: 'TWITCH_IMPORTED_CANARY_EXTENSION_BLOCKED' });
      expect(await authority.read()).toEqual(off); expect(await db.twitchNativeTarget.count({ where: { canary: true } })).toBe(4);
      expect(await db.twitchNativeAudit.count()).toBe(auditsBeforeTamper);
    }
    await db.twitchEventReceipt.update({ where: { id: deferredReceipt.id }, data: { payloadMinimal: originalPayload as Prisma.InputJsonObject } });
    const driftPlayerId = importedPlayers.get(main.approved[42]!.twitchUserId)!, beforeDrift = await state(driftPlayerId), beforeDriftAudits = await db.twitchNativeAudit.count();
    await db.$executeRaw`UPDATE player_gacha_states SET pity_5 = pity_5 + 1 WHERE player_id = ${driftPlayerId}::uuid`;
    await expect(activateRecoveryProfiles(db, config, operatorId, input, ids, off.revision, readBackup)).rejects.toThrow('LEGACY_RECOVERY_TRANSFER_DRIFT');
    expect(await authority.read()).toEqual(off); expect(await db.twitchNativeTarget.count({ where: { canary: true } })).toBe(4);
    expect(await db.twitchNativeAudit.count()).toBe(beforeDriftAudits);
    await db.$executeRaw`UPDATE player_gacha_states SET pity_5 = pity_5 - 1 WHERE player_id = ${driftPlayerId}::uuid`;
    expect(await state(driftPlayerId)).toEqual(beforeDrift);
    let activationQueries = 0;
    const measured = db.$extends({ query: { async $allOperations({ args, query }) { activationQueries++; return query(args); } } });
    const activationStart = performance.now();
    expect(await activateRecoveryProfiles(measured as unknown as typeof db, config, operatorId, input, ids, off.revision, readBackup))
      .toMatchObject({ status: 'ACTIVATED', desiredMode: 'CANARY', revision: off.revision + 1 });
    const activationMs = Math.round(performance.now() - activationStart);
    expect(activationMs).toBeLessThan(30_000); expect(fixture.poolSnapshot()).toMatchObject({ waiting: 0 });
    const authorityAfter = await authority.read(), auditsAfter = await db.twitchNativeAudit.count();
    expect(await activateRecoveryProfiles(db, config, operatorId, input, ids, off.revision, readBackup)).toMatchObject({ status: 'ALREADY_NATIVE' });
    expect(await authority.read()).toEqual(authorityAfter); expect(await db.twitchNativeAudit.count()).toBe(auditsAfter);
    const expectedIds = [...ids, '970010000099'].sort();
    expect((await db.twitchNativeTarget.findMany({ where: { canary: true }, select: { twitchUserId: true }, orderBy: { twitchUserId: 'asc' } })).map(row => row.twitchUserId)).toEqual(expectedIds);
    expect(await protectedState()).toEqual(baseline);
    for (const deferred of deferredEvents) {
      expect((await observer.observeTwitchEvent(deferred.event)).duplicate).toBe(true);
      expect(await deferred.consumer.consume(deferred.receiptId)).toMatchObject({ state: 'PROCESSED', processedAt: cutoverAt });
      expect(await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: deferred.playerId, resourceKey: 'primogems' } } }))
        .toMatchObject({ amount: deferred.originalAmount + deferred.amount });
      expect(await db.businessOperation.count({ where: { playerId: deferred.playerId, operationType: deferred.operationType } })).toBe(1);
      const after = await state(deferred.playerId);
      await deferred.consumer.consume(deferred.receiptId); await observer.observeTwitchEvent(deferred.event); await deferred.consumer.consume(deferred.receiptId);
      expect(await state(deferred.playerId)).toEqual(after);
    }
    gift.state.unfulfilledIds = [redemptionId]; gift.state.redemptionInputs[redemptionId] = giftPlayer.displayName;
    await db.player.update({ where: { id: giftPlayerId }, data: { displayName: 'Recovered Gift Recipient' } });
    const neighborId = importedPlayers.get(main.approved[13]!.twitchUserId)!;
    await db.player.update({ where: { id: neighborId }, data: { displayName: giftPlayer.displayName } });
    const neighborBefore = await state(neighborId);
    await giftRuntime.recoverUnfulfilled(operatorId);
    expect(await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: giftPlayerId, resourceKey: 'particles_cryo' } } }))
      .toMatchObject({ amount: giftBalance.amount + 1600n });
    expect(await db.businessOperation.count({ where: { playerId: giftPlayerId, idempotencyKey: 'gift-supreme:' + redemptionId } })).toBe(1);
    expect(await db.notification.count({ where: { playerId: giftPlayerId, deduplicationKey: 'gift-supreme:' + redemptionId } })).toBe(1);
    for (const receipt of await db.twitchEventReceipt.findMany({ where: { externalEventId: { in: giftReceiptIds } } })) expect(receipt.state).toBe('PROCESSED');
    expect((await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: 'gift-supreme:' + redemptionId } })).payloadMinimal)
      .toMatchObject({ remote: { settlementState: 'FULFILLED', announcementState: 'SENT' } });
    const giftAfter = await state(giftPlayerId);
    await giftRuntime.consumeAuthenticated(giftPayload, { messageId: deliveryIds[0]!, payloadHash: 'a'.repeat(64) });
    await giftRuntime.recoverUnfulfilled(operatorId);
    expect(await state(giftPlayerId)).toEqual(giftAfter);
    expect(await state(neighborId)).toEqual(neighborBefore);
    expect(gift.network.mock.calls.filter(([url]) => String(url).endsWith('/chat/messages'))).toHaveLength(1);
    const playerId = importedPlayers.get(main.approved[3]!.twitchUserId)!, playerActor = await actor(playerId);
    const claimsBefore = await state(playerId), codes = new GiftCodeService(getPlayer, db, clock, { annualCodeIds: [], activePlayerIds: [playerId] });
    await expect(codes.claim(playerActor, usedEditionId, randomUUID(), 'TWITCH')).rejects.toMatchObject({ code: 'GIFT_CODE_ALREADY_CLAIMED' });
    expect(await state(playerId)).toEqual(claimsBefore);
    expect(await db.giftCodeClaim.findUniqueOrThrow({ where: { giftCodeEditionId_playerId: { giftCodeEditionId: usedEditionId, playerId } } })).toMatchObject({ operationId: null, claimedAt: null, origin: 'LEGACY' });
    const votes = new BannerVoteService(getPlayer, db, clock);
    expect(await votes.vote(playerActor, voteCharacterId, bannerId, 'TWITCH')).toMatchObject({ alreadyProcessed: true, canVote: false });
    const afterVotes = await db.$transaction(tx => bannerVoteContributions(tx, bannerId), { isolationLevel: 'RepeatableRead' });
    expect(afterVotes.totalVotes).toBe(beforeVotes.totalVotes);
    expect(await db.bannerVote.count({ where: { playerId } })).toBe(0);
    expect(await db.externalBannerVote.findUniqueOrThrow({ where: { cycleStartsAt_twitchUserId: { cycleStartsAt, twitchUserId: main.approved[3]!.twitchUserId } } })).toMatchObject({ playerId });
    const box = await new GetCurrentPlayerBox(getPlayer, new PrismaBoxStore(db)).execute(playerActor);
    expect(box.summary).toMatchObject({ totalOwned: 1, c6: 1 });
    const banking = new PrismaBankingStore(db), bank = new GetCurrentPlayerBank(getPlayer, banking, clock);
    expect(await bank.execute(playerActor)).toMatchObject({ walletMoras: 83n, bankMoras: 40n });
    const transfer = new TransferPlayerBank('deposit', getPlayer, banking, clock, 'TWITCH'), key = randomUUID();
    await withPlayerCommandExecution({ source: 'TWITCH', now: cutoverAt }, () => transfer.execute(playerActor, 5n, key));
    await transfer.execute(playerActor, 5n, key);
    expect(await bank.execute(playerActor)).toMatchObject({ walletMoras: 78n, bankMoras: 45n });
    expect(await db.businessOperation.count({ where: { playerId, operationType: 'bank.deposit' } })).toBe(1);
    const gacha = new PrismaGachaStore(db), beforePull = await gacha.getCurrent(playerId);
    expect(beforePull?.playerState).toMatchObject({ pity5: 3, pity4: 2, selectedBannerCharacterId: characterId });
    const pullInput = { playerId, playerElementKey: 'cryo' as const, count: 1 as const, idempotencyKey: randomUUID(), now: cutoverAt,
      random: { nextInt: (max: number) => max - 1 }, sourceChannel: 'TWITCH' as const };
    await gacha.pull(pullInput); await gacha.pull(pullInput);
    expect(await db.pullOperation.count({ where: { playerId } })).toBe(1); expect(await db.pullResult.count({ where: { pullOperation: { playerId } } })).toBe(1);
    const expedition = new ExpeditionService(getPlayer, db, clock, { nextInt: max => max - 1 });
    const expeditionKey = randomUUID(); await expedition.start(playerActor, characterId, expeditionKey, 'TWITCH'); await expedition.start(playerActor, characterId, expeditionKey, 'TWITCH');
    expect(await db.playerExpedition.findUniqueOrThrow({ where: { playerId } })).toMatchObject({ state: 'RUNNING', characterId });
    expect(await db.businessOperation.count({ where: { playerId, operationType: 'expedition.start' } })).toBe(1);
    const gameplayAfter = await state(playerId), writesAfter = backupWrites;
    expect((await apply(input, main.approved[3]!.twitchUserId)).status).toBe('NATIVE');
    expect(await state(playerId)).toEqual(gameplayAfter); expect(backupWrites).toBe(writesAfter);
    await authority.configure(operatorId, 'OFF', []);
    const imported = await db.twitchCanaryImport.findFirstOrThrow({ where: { playerId }, orderBy: { importedAt: 'desc' } });
    await expect(authority.relinquishForRollback(operatorId, main.approved[3]!.twitchUserId, imported.backupHash)).rejects.toMatchObject({ code: 'TWITCH_NATIVE_ROLLBACK_BLOCKED' });
    await expect(rollbackLegacyCanary(db, config, operatorId, await readBackup(imported.backupHash))).rejects.toThrow();
    expect(await state(playerId)).toEqual(gameplayAfter);
    await authority.resumePersistedCanary(operatorId, STREAMERBOT_PATH_DISABLED, (await authority.read()).revision);
    expect(await protectedState()).toEqual(baseline);
    process.stdout.write(JSON.stringify({ fixture: 'historical-recovery', historical: 43, existingNative: 3, newlyImported: 40, extraTest: 1,
      covered: await db.twitchNativeTarget.count({ where: { canary: true } }), durationMs: Math.round(performance.now() - start), activationMs, activationQueries,
      pool: fixture.poolSnapshot() }) + '\n');
  }, 180_000);
});
