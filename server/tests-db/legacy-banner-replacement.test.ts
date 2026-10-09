import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { createOwnerApprovedPopulation, identityProofHash } from '../src/application/migration/owner-approved-population.js';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';
import { bannerVoteContributions, reconcileExternalBannerVotes } from '../src/application/gacha/banner-vote-contributions.js';
import { TwitchAccountLink } from '../src/application/twitch/twitch-account-link.js';
import { buildCutoverPurgePlan } from '../src/application/migration/legacy-cutover-purge.js';
import { capturePrivateSchema, writePrivateBackup, restorePrivateBackup } from './private-schema-backup.js';
import { applyLegacyBannerReplacement, planLegacyBannerReplacement, readBannerReplacementTime, rollbackLegacyBannerReplacement, type LegacyBannerReplacementBackup } from '../src/application/migration/legacy-banner-replacement.js';
import { captureTargetedPlayerRows } from '../src/application/migration/targeted-player-rows.js';
import { PrismaGachaStore } from '../src/infrastructure/database/prisma-gacha-store.js';
import { selectBannerFeatured } from '../src/domain/gacha/gacha.js';
import { HistoryService } from '../src/application/history/history-service.js';
import { BannerVoteService } from '../src/application/gacha/banner-vote-service.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import type { Snapshot } from '../src/application/migration/streamerbot-snapshot.js';
import type { VerifiedTwitchReport } from '../src/application/migration/verified-twitch-report.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { isPrismaConcurrencyCollision } from '../src/infrastructure/database/prisma-concurrency.js';

const fixture = isolatedBatchDatabase(), db = fixture.database, now = new Date('2099-10-08T12:00:00Z');
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: false, globalEnabled: false }, twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
let actor: string, sequence = 0;
beforeAll(async () => {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env['DATABASE_URL']!).hostname)) throw Error('Local PostgreSQL required');
  await fixture.setup({ prismaMigrations: true });
  actor = (await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private operator', twitchIdentity: { twitchUserId: '970000000000', login: 'kichnifou', displayName: 'Private operator', firstSeenAt: now } }))).id;
  config.twitch.pilotPlayerIds.push(actor);
  await db.playerRoleAssignment.create({ data: { playerId: actor, role: 'ADMIN', source: 'private-fixture' } });
  await db.twitchNativeAuthority.create({ data: { id: 'twitch-commands', desiredMode: 'OFF', revision: 12, operatorPlayerId: actor } });
  await db.character.createMany({ data: Array.from({ length: 28 }, (_, i) => ({ externalKey: `legacy:${i}`, name: `Private banner character ${i}`, rarity: i < 14 ? 5 : 4, elementKey: 'pyro' })) });
  expect(fixture.migrationStatus).toContain('Database schema is up to date');
}, 180_000);
afterAll(async () => { await fixture.cleanup(); expect(fixture.poolSnapshot()).toMatchObject({ total: 0, idle: 0, waiting: 0 }); }, 60_000);

it('deploys migration 065 privately with backend-only RLS/grants, indexed restrictive FKs and cycle uniqueness', async () => {
  const rows = await db.$queryRaw<{ rls: boolean; anon: boolean; authenticated: boolean }[]>`SELECT c.relrowsecurity AS rls,
    has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS anon,
    has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS authenticated
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relname='external_banner_votes'`;
  expect(rows).toEqual([{ rls: true, anon: false, authenticated: false }]);
  const migrations = await db.$queryRaw<{ count: number }[]>`SELECT count(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  expect(migrations[0]!.count).toBe(65);
  const indexes = await db.$queryRaw<{ indexname: string }[]>`SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND tablename='external_banner_votes'`;
  expect(indexes.map(i => i.indexname)).toEqual(expect.arrayContaining(['external_banner_votes_cycle_twitch_key', 'external_banner_votes_rotation_character_idx', 'external_banner_votes_character_idx', 'external_banner_votes_player_idx']));
});

async function scenario(nativeChoice?: number, flags: { deferred?: boolean; compatible?: boolean; year?: number } = {}) {
  const n = ++sequence, name = `private_banner_${n}`, twitchUserId = String(970000000000 + n);
  // Isolate each scenario's cycle without deleting historical rotations or pulls.
  await db.bannerRotation.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'ENDED' } });
  const year = flags.year ?? 2099 + n, at = new Date(`${year}-10-08T12:00:00Z`);
  // Use a Monday anchored to this scenario rather than relying on a fixed weekday across years.
  const day = new Date(`${year}-10-08T12:00:00Z`); day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7); const week = day.toISOString().slice(0, 10);
  const end = new Date(day); end.setUTCDate(day.getUTCDate() + 7);
  const start = new Date(week + 'T00:00:00+02:00'), finish = new Date(end.toISOString().slice(0, 10) + 'T00:00:00+02:00');
  const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private preserved native', twitchIdentity: { twitchUserId, login: name, displayName: 'Private native', firstSeenAt: at } }));
  const catalog = await db.character.findMany({ orderBy: { externalKey: 'asc' } }), byKey = new Map(catalog.map(c => [Number(c.externalKey.slice(7)), c]));
  const nativeIds = [0, 1, 2, 3, 14, 15, 16, 17, 18, 19], legacyIds = [flags.compatible ? 0 : 4, 5, 6, 7, 20, 21, 22, 23, 24, 25];
  const native = await db.bannerRotation.create({ data: { startsAt: start, endsAt: finish, status: 'ACTIVE', generationVoteSnapshot: { originalNativeGeneration: true },
    featuredCharacters: { create: nativeIds.map((id, i) => ({ characterId: byKey.get(id)!.id, rarity: i < 4 ? 5 : 4, slot: i < 4 ? i + 1 : i - 3, selectionSource: 'RANDOM' })) } } });
  await db.playerGachaState.update({ where: { playerId: player.id }, data: { pity5: 17, pity4: 3, guaranteedFeatured5: true, captureProgress: 2, totalPulls: 115n, selectedBannerCharacterId: byKey.get(0)!.id } });
  await db.playerCharacter.create({ data: { playerId: player.id, characterId: byKey.get(0)!.id, constellation: 1, copies: 2, favorite: true, firstObtainedAt: at } });
  await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: 'primogems' } }, data: { amount: 123_456n } });
  await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: 'moras' } }, data: { amount: 987_654n } });
  await db.playerEconomyStats.update({ where: { playerId: player.id }, data: { totalPrimosEarned: 200_000n, totalPrimosSpent: 18_400n, totalMorasEarned: 1_000_000n } });
  await db.playerProgression.update({ where: { playerId: player.id }, data: { xp: 1_000_000n, totalMessages: 2345n } });
  for (let i = 0; i < 16; i++) {
    const pullCount = i < 11 ? 10 : 1;
    const operation = await db.businessOperation.create({ data: { playerId: player.id, operationType: 'gacha.pull', sourceChannel: 'UI', status: 'COMPLETED', resultSummary: { immutableNative: i } } });
    await db.pullOperation.create({ data: { playerId: player.id, bannerRotationId: native.id, targetCharacterId: byKey.get(0)!.id, pullCount, primogemCost: 160n * BigInt(pullCount), sourceChannel: 'UI', businessOperationId: operation.id,
      results: { create: Array.from({ length: pullCount }, (_, result) => ({ resultIndex: result + 1, resultType: 'character', characterId: byKey.get(0)!.id, rarity: 5, wasNewCharacter: false, constellationAfter: 1, copiesAfter: 2, snapshot: { immutableNative: i, result, pity5: i } })) } } });
  }
  if (nativeChoice !== undefined) await db.bannerVote.create({ data: { bannerRotationId: native.id, playerId: player.id, characterId: byKey.get(nativeChoice)!.id, sourceChannel: 'UI', votedAt: at } });
  const snapshot: Snapshot = { hash: createHash('sha256').update(`banner-replacement-${n}`).digest('hex'), files: 17, sources: { 'viewers_data.json': { [name]: {}, ...(flags.deferred ? { private_unresolved: {} } : {}) },
    'genshin_characters.json': { lastBannerUpdate: week, characters: legacyIds.map(id => ({ id, bannerFeatured: true })) },
    'banner_votes.json': { weekId: week, voters: { [name]: 8, ...(flags.deferred ? { private_unresolved: 9 } : {}) }, votes: { 8: { votes: 1 }, ...(flags.deferred ? { 9: { votes: 1 } } : {}) } } } };
  const report: VerifiedTwitchReport = { version: 1, verification: 'TWITCH_HELIX', snapshotHash: snapshot.hash, resolvedAt: at.toISOString(), users: [{ legacyLogin: name, twitchUserId, currentLogin: name, displayName: 'Private source', renamed: false }], missing: [], conflicts: [], duplicates: 0 };
  if (flags.deferred) report.users.push({ legacyLogin: 'private_unresolved', twitchUserId: String(980000000000 + n), currentLogin: 'private_unresolved', displayName: 'Private legacy voter', renamed: false });
  await db.twitchNativeTarget.create({ data: { twitchUserId, playerId: player.id, dataAuthority: 'NATIVE', canary: true, acknowledgement: STREAMERBOT_PATH_DISABLED, transferredAt: at } });
  const run = await db.twitchCanaryImport.create({ data: { twitchUserId, playerId: player.id, snapshotHash: snapshot.hash, identityReportHash: identityProofHash(report), backupHash: 'a'.repeat(64) } });
  const binding = { snapshot, importReport: report, importId: run.id, twitchUserId, playerId: player.id };
  const input = { snapshot, bindings: [binding], operatorPlayerId: actor, expectedRevision: 12, expectedNativeRotationId: native.id, now: at };
  return { input, player, native, byKey, legacyIds, at, start, finish };
}
async function prepare(s: Awaited<ReturnType<typeof scenario>>) {
  const plan = await planLegacyBannerReplacement(db, s.input), operationId = randomUUID();
  let backup: LegacyBannerReplacementBackup;
  const write = async (value: LegacyBannerReplacementBackup) => {
    expect((await db.bannerRotation.findUniqueOrThrow({ where: { id: s.native.id } })).status).toBe('ACTIVE');
    await mkdir('../local-data/migration-backups', { recursive: true });
    const file = await open(`../local-data/migration-backups/${operationId}.json`, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(value)); await file.sync(); } finally { await file.close(); }
    backup = value;
  };
  return { plan, input: { ...s.input, operationId, expectedFingerprint: plan.fingerprint, acknowledgement: STREAMERBOT_PATH_DISABLED }, write, backup: () => backup! };
}
const pullGraph = (playerId: string) => captureTargetedPlayerRows(db, [playerId], ['players', 'pull_operations', 'pull_results', 'business_operations', 'resource_movements', 'player_resource_balances', 'player_characters', 'player_progression', 'player_economy_stats']);

async function fourVoters(nativeChoice?: number) {
  const s = await scenario(nativeChoice), original = s.input.bindings[0]!, prefix = `ext_${sequence}_`;
  const names = [Object.keys(s.input.snapshot.sources['viewers_data.json'] as object)[0]!, ...Array.from({ length: 42 }, (_, i) => prefix + i)];
  const ids = [original.twitchUserId, ...Array.from({ length: 42 }, (_, i) => String(990000000000 + sequence * 100 + i))];
  const missing = [prefix + 'missing_a', prefix + 'missing_b'], discarded = Array.from({ length: 171 }, (_, i) => prefix + 'out_' + i);
  const viewers = Object.fromEntries([...names, ...missing, ...discarded].map(n => [n, {}]));
  const sources = { ...s.input.snapshot.sources, 'viewers_data.json': viewers,
    'banner_votes.json': { weekId: (s.input.snapshot.sources['banner_votes.json'] as { weekId: string }).weekId,
      voters: Object.fromEntries(names.slice(0, 4).map(n => [n, 8])), votes: { 8: { votes: 4 } } } };
  const sourceFiles = Object.fromEntries(snapshotFileNames.map(n => [n, JSON.stringify(sources[n as keyof typeof sources] ?? {})]));
  const snapshot = parseStreamerbotSnapshot(sourceFiles);
  const historicalSourceFiles = { ...sourceFiles, 'banner_votes.json': '{}' }, historicalSnapshot = parseStreamerbotSnapshot(historicalSourceFiles);
  const historicalReport: VerifiedTwitchReport = { version: 1, verification: 'TWITCH_HELIX', snapshotHash: historicalSnapshot.hash, resolvedAt: s.at.toISOString(),
    users: names.map((legacyLogin, i) => ({ legacyLogin, twitchUserId: ids[i]!, currentLogin: legacyLogin, displayName: 'Private voter', renamed: false })), missing, conflicts: [], duplicates: 0 };
  const population = createOwnerApprovedPopulation(historicalReport, historicalSnapshot, s.at);
  const voterReports = names.slice(0, 4).map((legacyLogin, i): VerifiedTwitchReport => ({ ...historicalReport, snapshotHash: snapshot.hash,
    users: [{ legacyLogin, twitchUserId: ids[i]!, currentLogin: legacyLogin, displayName: 'Private voter', renamed: false }], missing: [] }));
  const importReport = voterReports[0]!;
  await db.twitchCanaryImport.update({ where: { id: original.importId }, data: { snapshotHash: snapshot.hash, identityReportHash: identityProofHash(importReport) } });
  const input = { ...s.input, snapshot, bindings: [{ ...original, snapshot, importReport }],
    voterProof: { population, historicalSnapshot, historicalReport, sourceFiles, historicalSourceFiles, voterReports } };
  return { ...s, input, ids, names, missing, discarded };
}
const tally = (rotationId: string) => db.$transaction(tx => bannerVoteContributions(tx, rotationId), { isolationLevel: 'RepeatableRead' });

it.each(['SUSPENDED', 'ARCHIVED'] as const)('keeps acquired %s ballots readable and closable without permitting a new vote', async status => {
  const s = await scenario(8);
  if (status === 'ARCHIVED') await db.twitchIdentity.delete({ where: { playerId: s.player.id } });
  await db.player.update({ where: { id: s.player.id }, data: { status } });
  expect((await tally(s.native.id)).totalVotes).toBe(1);
  const reader = new BannerVoteService({ execute: async () => ({ id: actor }) } as unknown as GetCurrentPlayer, db, { now: () => s.at });
  expect((await reader.getCurrent({ subject: 'private' })).candidates.find(c => c.characterId === s.byKey.get(8)!.id)?.voteCount).toBe(1);
  const writer = new BannerVoteService({ execute: async () => ({ id: s.player.id }) } as unknown as GetCurrentPlayer, db, { now: () => s.at });
  await expect(writer.vote({ subject: 'private' }, s.byKey.get(8)!.id, s.native.id)).rejects.toMatchObject({ code: 'PLAYER_NOT_FOUND' });
  await expect(new PrismaGachaStore(db).ensureRotation(s.finish, new Date(+s.finish + 7 * 86400_000), () => { throw Error('Private closure acquired'); })).rejects.toThrow('Private closure acquired');
});

it.each([false, true])('deduplicates the archived Web ballot after TWITCH choice; closed=%s', async closed => {
  const s = await fourVoters(), f = await prepare(s), result = await applyLegacyBannerReplacement(db, config, f.input, f.write);
  const twitch = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private target', twitchIdentity: { twitchUserId: s.ids[1]!, login: s.names[1]!, displayName: 'Private target', firstSeenAt: new Date() } }));
  await db.$transaction(tx => reconcileExternalBannerVotes(tx, s.ids[1]!));
  const web = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private web voter', webIdentity: { provider: 'supabase', providerSubject: randomUUID() } }));
  await db.player.update({ where: { id: web.id }, data: { elementKey: 'pyro' } });
  await db.bannerVote.create({ data: { bannerRotationId: result.rotationId, playerId: web.id, characterId: s.byKey.get(8)!.id, sourceChannel: 'UI' } });
  if (closed) await expect(new PrismaGachaStore(db).ensureRotation(s.finish, new Date(+s.finish + 7 * 86400_000), () => { throw Error('Private closed'); })).rejects.toThrow('Private closed');
  const frozen = (await db.bannerRotation.findUniqueOrThrow({ where: { id: result.rotationId } })).generationVoteSnapshot;
  const wi = await db.webIdentity.findUniqueOrThrow({ where: { playerId: web.id } }), link = new TwitchAccountLink(db);
  await link.verified(wi.id, web.id, s.ids[1]!, s.names[1]!, 'Private voter');
  const pending = await link.pending(wi.id);
  expect(await link.resolve(wi.id, pending!.id, 'TWITCH', pending!.revision)).toMatchObject({ linked: true, playerId: twitch.id });
  expect((await tally(result.rotationId)).totalVotes).toBe(4);
  expect((await db.bannerRotation.findUniqueOrThrow({ where: { id: result.rotationId } })).generationVoteSnapshot).toEqual(frozen);
});

it.each([false, true])('rejects divergent Web ballot at TWITCH choice atomically; closed=%s', async closed => {
  const s = await fourVoters(), f = await prepare(s), result = await applyLegacyBannerReplacement(db, config, f.input, f.write);
  const twitch = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private target', twitchIdentity: { twitchUserId: s.ids[1]!, login: s.names[1]!, displayName: 'Private target', firstSeenAt: new Date() } }));
  await db.$transaction(tx => reconcileExternalBannerVotes(tx, s.ids[1]!));
  const web = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private web voter', webIdentity: { provider: 'supabase', providerSubject: randomUUID() } }));
  await db.player.update({ where: { id: web.id }, data: { elementKey: 'pyro' } });
  await db.bannerVote.create({ data: { bannerRotationId: result.rotationId, playerId: web.id, characterId: s.byKey.get(9)!.id, sourceChannel: 'UI' } });
  if (closed) await expect(new PrismaGachaStore(db).ensureRotation(s.finish, new Date(+s.finish + 7 * 86400_000), () => { throw Error('Private closed'); })).rejects.toThrow('Private closed');
  const wi = await db.webIdentity.findUniqueOrThrow({ where: { playerId: web.id } }), link = new TwitchAccountLink(db);
  await link.verified(wi.id, web.id, s.ids[1]!, s.names[1]!, 'Private voter');
  const pending = await link.pending(wi.id);
  await expect(link.resolve(wi.id, pending!.id, 'TWITCH', pending!.revision)).rejects.toMatchObject({ code: 'BANNER_VOTE_IDENTITY_CONFLICT' });
  expect((await db.player.findUniqueOrThrow({ where: { id: web.id } })).status).toBe('ACTIVE');
  expect((await db.webIdentity.findUniqueOrThrow({ where: { id: wi.id } })).playerId).toBe(web.id);
  expect((await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: s.ids[1]! } })).playerId).toBe(twitch.id);
});

it.each([undefined, 8])('counts four proven Twitch identities exactly once, with three absent Players and native choice %s', async nativeChoice => {
  const s = await fourVoters(nativeChoice), f = await prepare(s), before = await pullGraph(s.player.id), players = await db.player.count();
  expect(f.plan).toMatchObject({ status: 'READY', applicationGate: null, externalProvenVotes: 3, unresolvedLegacyVotes: 0,
    importedLegacyVotes: nativeChoice === undefined ? 1 : 0, retainedLegacyVotes: nativeChoice === undefined ? 0 : 1 });
  const result = await applyLegacyBannerReplacement(db, config, f.input, f.write);
  expect((await tally(result.rotationId)).counts.get(s.byKey.get(8)!.id)).toBe(4);
  expect((await tally(result.rotationId)).totalVotes).toBe(4);
  expect(await db.externalBannerVote.count({ where: { bannerRotationId: result.rotationId, playerId: null } })).toBe(3);
  expect(await db.twitchIdentity.count({ where: { twitchUserId: { in: s.ids.slice(1, 4) } } })).toBe(0);
  expect(await db.player.count()).toBe(players);
  const service = new BannerVoteService({ execute: async () => ({ id: s.player.id }) } as unknown as GetCurrentPlayer, db, { now: () => s.at });
  const publicVotes = await service.getCurrent({ subject: 'private' });
  expect(publicVotes.candidates.find(c => c.characterId === s.byKey.get(8)!.id)?.voteCount).toBe(4);
  expect(publicVotes.canVote).toBe(false);
  expect((await service.vote({ subject: 'private' }, s.byKey.get(8)!.id, result.rotationId)).alreadyProcessed).toBe(true);
  await expect(service.vote({ subject: 'private' }, s.byKey.get(9)!.id, result.rotationId)).rejects.toMatchObject({ code: 'BANNER_VOTE_USED' });
  expect(await applyLegacyBannerReplacement(db, config, f.input, async () => { throw Error('No repeated backup'); })).toMatchObject({ replayed: true });
  expect(await db.externalBannerVote.count({ where: { bannerRotationId: result.rotationId } })).toBe(4);
  expect(await pullGraph(s.player.id)).toEqual(before);
  expect(await db.pullOperation.count({ where: { bannerRotationId: s.native.id } })).toBe(16);
  expect(await db.pullResult.count({ where: { pullOperation: { bannerRotationId: s.native.id } } })).toBe(115);
  const nativeHistory = await new PrismaGachaStore(db).getHistory(s.player.id, 1);
  expect(nativeHistory.totalResults).toBe(115);
  await expect(buildCutoverPurgePlan(db, fixture.schema)).rejects.toThrow('CUTOVER_LEGACY_VOTE_PROOFS_PRESENT');
  const undo = { ...s.input, backup: f.backup(), expectedBackupHash: f.backup().hash, acknowledgement: STREAMERBOT_PATH_DISABLED };
  expect(await rollbackLegacyBannerReplacement(db, config, undo)).toEqual({ replayed: false });
  expect(await db.externalBannerVote.count({ where: { bannerRotationId: result.rotationId } })).toBe(0);
  expect(await rollbackLegacyBannerReplacement(db, config, undo)).toEqual({ replayed: true });
  expect(await pullGraph(s.player.id)).toEqual(before);
});

it.each(['hash', 'raw-source', 'report', 'identity', 'discarded', 'quarantine', 'missing-report', 'native-conflict'])(
  'rejects invalid or excluded source before backup: %s', async mode => {
    const s = await fourVoters(mode === 'native-conflict' ? 9 : undefined);
    if (mode === 'hash') s.input.voterProof.voterReports[1]!.snapshotHash = 'f'.repeat(64);
    if (mode === 'raw-source') s.input.voterProof.sourceFiles['banner_votes.json'] = '{}';
    if (mode === 'report') s.input.voterProof.voterReports[1]!.resolvedAt = new Date(+s.at - 25 * 3600_000).toISOString();
    if (mode === 'identity') s.input.voterProof.voterReports[1]!.users[0]!.twitchUserId = '999999999999';
    if (mode === 'missing-report') s.input.voterProof.voterReports.pop();
    if (mode === 'discarded' || mode === 'quarantine') {
      const name = mode === 'discarded' ? s.discarded[0]! : s.missing[0]!;
      const source = s.input.snapshot.sources['banner_votes.json'] as { voters: Record<string, number> };
      delete source.voters[s.names[1]!]; source.voters[name] = 8;
      s.input.voterProof.sourceFiles['banner_votes.json'] = JSON.stringify(source);
      const snapshot = parseStreamerbotSnapshot(s.input.voterProof.sourceFiles);
      s.input.snapshot = snapshot;
      s.input.bindings[0]!.snapshot = snapshot;
      for (const r of s.input.voterProof.voterReports) r.snapshotHash = snapshot.hash;
      s.input.voterProof.voterReports[1]!.users[0]!.legacyLogin = name;
      s.input.voterProof.voterReports[1]!.users[0]!.currentLogin = name;
      await db.twitchCanaryImport.update({ where: { id: s.input.bindings[0]!.importId }, data: { snapshotHash: snapshot.hash, identityReportHash: identityProofHash(s.input.bindings[0]!.importReport) } });
    }
    await expect(planLegacyBannerReplacement(db, s.input)).rejects.toThrow();
    await expect(applyLegacyBannerReplacement(db, config, { ...s.input, operationId: randomUUID(), expectedFingerprint: 'a'.repeat(64), acknowledgement: STREAMERBOT_PATH_DISABLED }, async () => { throw Error('Unexpected backup'); })).rejects.toThrow();
    expect(await db.externalBannerVote.count({ where: { cycleStartsAt: s.start } })).toBe(0);
    expect((await db.bannerRotation.findUniqueOrThrow({ where: { id: s.native.id } })).status).toBe('ACTIVE');
  });

it.each(['WEB', 'TWITCH'] as const)('attaches only after the real R1055 %s choice, preserves retired ballots and refuses a divergent later vote', async choice => {
  const s = await fourVoters(), f = await prepare(s), result = await applyLegacyBannerReplacement(db, config, f.input, f.write);
  const twitch = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private later Twitch', twitchIdentity: { twitchUserId: s.ids[1]!, login: s.names[1]!, displayName: 'Private later Twitch', firstSeenAt: new Date() } }));
  await db.$transaction(async tx => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(70422401)`; await reconcileExternalBannerVotes(tx, s.ids[1]!); });
  await db.bannerVote.create({ data: { bannerRotationId: result.rotationId, playerId: twitch.id, characterId: s.byKey.get(8)!.id, sourceChannel: 'TWITCH' } });
  const web = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private later Web', webIdentity: { provider: 'supabase', providerSubject: randomUUID() } }));
  await db.player.update({ where: { id: web.id }, data: { elementKey: 'pyro' } });
  const identity = await db.webIdentity.findUniqueOrThrow({ where: { playerId: web.id } }), link = new TwitchAccountLink(db);
  expect(await link.verified(identity.id, web.id, s.ids[1]!, s.names[1]!, 'Private voter')).toMatchObject({ resolutionRequired: true });
  expect((await db.externalBannerVote.findUniqueOrThrow({ where: { cycleStartsAt_twitchUserId: { cycleStartsAt: s.start, twitchUserId: s.ids[1]! } } })).playerId).toBe(twitch.id);
  const pending = await link.pending(identity.id);
  expect(pending).not.toBeNull();
  // A closure while the comparison is displayed changes the ballot proof.
  // Existing consent must refresh before either definitive choice can bind it.
  await expect(new PrismaGachaStore(db).ensureRotation(s.finish, new Date(+s.finish + 7 * 86400_000), () => { throw Error('Private closure before R1055'); })).rejects.toThrow('Private closure');
  expect(await link.resolve(identity.id, pending!.id, choice, pending!.revision)).toMatchObject({ resolutionRequired: true, linked: false });
  const refreshed = await link.pending(identity.id);
  expect(refreshed!.revision).not.toBe(pending!.revision);
  expect(await link.resolve(identity.id, refreshed!.id, choice, refreshed!.revision)).toMatchObject({ linked: true, playerId: choice === 'WEB' ? web.id : twitch.id });
  const winner = choice === 'WEB' ? web.id : twitch.id, loser = choice === 'WEB' ? twitch.id : web.id;
  expect((await db.player.findUniqueOrThrow({ where: { id: loser } })).status).toBe('ARCHIVED');
  expect((await db.externalBannerVote.findUniqueOrThrow({ where: { cycleStartsAt_twitchUserId: { cycleStartsAt: s.start, twitchUserId: s.ids[1]! } } })).playerId).toBe(winner);
  expect((await tally(result.rotationId)).totalVotes).toBe(4);
  const service = new BannerVoteService({ execute: async () => ({ id: winner }) } as unknown as GetCurrentPlayer, db, { now: () => s.at });
  expect((await service.vote({ subject: 'private' }, s.byKey.get(8)!.id, result.rotationId)).alreadyProcessed).toBe(true);
  await expect(service.vote({ subject: 'private' }, s.byKey.get(9)!.id, result.rotationId)).rejects.toMatchObject({ code: 'BANNER_VOTE_USED' });
  expect(await db.bannerVote.count({ where: { bannerRotationId: result.rotationId, playerId: winner } })).toBe(choice === 'WEB' ? 0 : 1);
});

it('persists four weights before generation failure, restarts from the exact closure and never changes the frozen result', async () => {
  const s = await fourVoters(), f = await prepare(s), result = await applyLegacyBannerReplacement(db, config, f.input, f.write), before = await pullGraph(s.player.id);
  const end = new Date(+s.finish + 7 * 86400_000);
  await expect(new PrismaGachaStore(db).ensureRotation(s.finish, end, () => { throw Error('Private crash after durable closure'); })).rejects.toThrow('Private crash');
  const closed = (await db.bannerRotation.findUniqueOrThrow({ where: { id: result.rotationId } })).generationVoteSnapshot;
  expect(JSON.stringify(closed)).toContain('"voteCount":4');
  expect(await db.externalBannerVote.count({ where: { bannerRotationId: result.rotationId, frozenAt: { not: null } } })).toBe(4);
  const late = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private late binding', webIdentity: { provider: 'supabase', providerSubject: randomUUID() } }));
  const lateIdentity = await db.webIdentity.findUniqueOrThrow({ where: { playerId: late.id } });
  const earlyClockService = new BannerVoteService({ execute: async () => ({ id: late.id }) } as unknown as GetCurrentPlayer, db, { now: () => s.at });
  await expect(earlyClockService.vote({ subject: 'private' }, s.byKey.get(9)!.id, result.rotationId)).rejects.toMatchObject({ code: 'BANNER_VOTE_CLOSED' });
  expect(await new TwitchAccountLink(db).verified(lateIdentity.id, late.id, s.ids[2]!, s.names[2]!, 'Private late binding')).toMatchObject({ linked: true, playerId: late.id });
  expect((await tally(result.rotationId)).totalVotes).toBe(4);
  expect((await db.bannerRotation.findUniqueOrThrow({ where: { id: result.rotationId } })).generationVoteSnapshot).toEqual(closed);
  const proof = await db.externalBannerVote.findFirstOrThrow({ where: { bannerRotationId: result.rotationId } });
  await expect(db.externalBannerVote.update({ where: { id: proof.id }, data: { characterId: s.byKey.get(9)!.id } })).rejects.toThrow('EXTERNAL_BANNER_VOTE_IMMUTABLE');
  await expect(db.externalBannerVote.delete({ where: { id: proof.id } })).rejects.toThrow('EXTERNAL_BANNER_VOTE_FROZEN');
  let calls = 0;
  const next = await new PrismaGachaStore(db).ensureRotation(s.finish, end, (catalog, previous, weights) => {
    calls++; expect(weights.find(w => w.characterId === s.byKey.get(8)!.id)?.votes).toBe(4);
    return selectBannerFeatured(catalog, previous, weights, { nextInt: () => 0 });
  });
  expect(calls).toBe(1); expect(next.featuredFiveStars.some(c => c.id === s.byKey.get(8)!.id)).toBe(true);
  expect((await new PrismaGachaStore(db).ensureRotation(s.finish, end, () => { throw Error('No second generation'); })).id).toBe(next.id);
  expect((await db.bannerRotation.findUniqueOrThrow({ where: { id: result.rotationId } })).generationVoteSnapshot).toEqual(closed);
  expect(await pullGraph(s.player.id)).toEqual(before);
  const history = await new HistoryService(db).banners(1);
  expect(history.entries.find(e => e.id === next.id)?.generationVoteSnapshot?.candidates.find(c => c.characterId === s.byKey.get(8)!.id)?.voteCount).toBe(4);
  expect(JSON.stringify(history)).not.toContain(s.ids[1]!);
  await expect(rollbackLegacyBannerReplacement(db, config, { ...s.input, backup: f.backup(), expectedBackupHash: f.backup().hash, acknowledgement: STREAMERBOT_PATH_DISABLED })).rejects.toThrow('POSTIMAGE_CHANGED');
});

it('serializes a genuine additional native ballot behind replacement without duplicating the four source weights', async () => {
  const s = await fourVoters(), other = await db.player.create({ data: { displayName: 'Private additional voter' } }), f = await prepare(s);
  let release!: () => void, entered!: () => void, rotationId = '';
  const paused = new Promise<void>(r => { release = r; }), ready = new Promise<void>(r => { entered = r; });
  const replacing = applyLegacyBannerReplacement(db, config, f.input, async backup => { await f.write(backup); rotationId = backup.newRotationId; entered(); await paused; });
  await ready;
  const service = new BannerVoteService({ execute: async () => ({ id: other.id }) } as unknown as GetCurrentPlayer, db, { now: () => s.at });
  const voting = Promise.allSettled([service.vote({ subject: 'private' }, s.byKey.get(9)!.id, rotationId)]);
  try { expect(await waitingOnCycleHolder()).toContain('pg_advisory_xact_lock(70422401)'); } finally { release(); }
  await replacing;
  expect((await voting)[0]!.status).toBe('fulfilled');
  const counts = await tally(rotationId);
  expect(counts.counts.get(s.byKey.get(8)!.id)).toBe(4);
  expect(counts.counts.get(s.byKey.get(9)!.id)).toBe(1);
  expect(counts.totalVotes).toBe(5);
  await expect(rollbackLegacyBannerReplacement(db, config, { ...s.input, backup: f.backup(), expectedBackupHash: f.backup().hash, acknowledgement: STREAMERBOT_PATH_DISABLED })).rejects.toThrow('POSTIMAGE_CHANGED');
});

it.each(['native-first', 'replacement-first'])('handles a native vote from the proven identity racing the external proof: %s', async order => {
  const s = await fourVoters(), f = await prepare(s);
  const service = new BannerVoteService({ execute: async () => ({ id: s.player.id }) } as unknown as GetCurrentPlayer, db, { now: () => s.at });
  if (order === 'native-first') {
    await service.vote({ subject: 'private' }, s.byKey.get(8)!.id, s.native.id);
    await expect(applyLegacyBannerReplacement(db, config, f.input, async () => { throw Error('No backup on drift'); })).rejects.toThrow('PLAN_CHANGED');
    f.input.expectedFingerprint = (await planLegacyBannerReplacement(db, s.input)).fingerprint;
  }
  const result = await applyLegacyBannerReplacement(db, config, f.input, f.write);
  expect((await service.vote({ subject: 'private' }, s.byKey.get(8)!.id, result.rotationId)).alreadyProcessed).toBe(true);
  expect((await tally(result.rotationId)).totalVotes).toBe(4);
  expect(await db.bannerVote.count({ where: { bannerRotationId: result.rotationId, playerId: s.player.id } })).toBe(1);
});

it.each(['revision', 'authority', 'pending', 'outbound', 'backup-timeout'])('keeps external proofs atomic at the repair gate: %s', async mode => {
  const s = await fourVoters(), f = await prepare(s);
  let pending: string | undefined;
  let receipt: string | undefined;
  if (mode === 'revision') f.input.expectedRevision = 11;
  if (mode === 'authority') await db.twitchNativeAuthority.update({ where: { id: 'twitch-commands' }, data: { desiredMode: 'CANARY', acknowledgement: STREAMERBOT_PATH_DISABLED, acknowledgedAt: new Date() } });
  if (mode === 'pending') pending = (await db.businessOperation.create({ data: { playerId: s.player.id, operationType: 'private.pending', sourceChannel: 'UI', status: 'PENDING' } })).id;
  if (mode === 'outbound') receipt = (await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(), eventType: 'channel.chat.message', state: 'PROCESSED', processedAt: new Date(), payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'AMBIGUOUS' }] } } } })).id;
  try {
    await expect(applyLegacyBannerReplacement(db, config, f.input, async () => {
      if (mode === 'backup-timeout') await db.$transaction(async tx => { await tx.$executeRaw`SET LOCAL statement_timeout='10ms'`; await tx.$queryRaw`SELECT pg_sleep(0.2)`; });
      throw Error('PRIVATE_BACKUP_TIMEOUT_OR_UNKNOWN');
    })).rejects.toThrow();
    expect(await db.externalBannerVote.count({ where: { cycleStartsAt: s.start } })).toBe(0);
    expect((await db.bannerRotation.findUniqueOrThrow({ where: { id: s.native.id } })).status).toBe('ACTIVE');
    expect(await db.migrationBatch.count({ where: { id: f.input.operationId } })).toBe(0);
  } finally {
    if (pending) await db.businessOperation.delete({ where: { id: pending } });
    if (receipt) await db.twitchEventReceipt.delete({ where: { id: receipt } });
    if (mode === 'authority') await db.twitchNativeAuthority.update({ where: { id: 'twitch-commands' }, data: { desiredMode: 'OFF' } });
  }
});

it('rejects unauthorized identity movement and a divergent native vote on later verified linking', async () => {
  const s = await fourVoters(), f = await prepare(s), result = await applyLegacyBannerReplacement(db, config, f.input, f.write);
  const web = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private conflicting Web', webIdentity: { provider: 'supabase', providerSubject: randomUUID() } }));
  const identity = await db.webIdentity.findUniqueOrThrow({ where: { playerId: web.id } });
  await db.bannerVote.create({ data: { bannerRotationId: result.rotationId, playerId: web.id, characterId: s.byKey.get(9)!.id, sourceChannel: 'UI' } });
  await expect(new TwitchAccountLink(db).verified(identity.id, web.id, s.ids[1]!, s.names[1]!, 'Private voter')).rejects.toMatchObject({ code: 'BANNER_VOTE_IDENTITY_CONFLICT' });
  expect(await db.twitchIdentity.findUnique({ where: { twitchUserId: s.ids[1]! } })).toBeNull();
  await db.twitchIdentity.update({ where: { twitchUserId: s.ids[0]! }, data: { playerId: web.id } });
  await expect(tally(result.rotationId)).rejects.toMatchObject({ code: 'BANNER_VOTE_IDENTITY_CONFLICT' });
  await db.twitchIdentity.update({ where: { twitchUserId: s.ids[0]! }, data: { playerId: s.player.id } });
});

const gate = () => { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; };
async function waitingOnCycleHolder(eligibilityAlreadyRead = () => false) {
  // Observe an actual blocked PostgreSQL backend; no timing-based ordering assumption.
  for (let attempt = 0; attempt < 200; attempt++) {
    if (eligibilityAlreadyRead()) return 'TARGET_ALREADY_READ_OLD_BANNER';
    const rows = await db.$queryRaw<{ query: string }[]>`SELECT a.query FROM pg_stat_activity a
      WHERE a.wait_event_type='Lock' AND EXISTS (SELECT 1 FROM pg_locks l
        WHERE l.locktype='advisory' AND l.classid=0 AND l.objid=70422401 AND l.granted AND l.pid=ANY(pg_blocking_pids(a.pid)))`;
    if (rows.length) return rows[0]!.query;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw Error('Expected a real lock waiter on the cycle holder');
}

it.each([false, true])('rejects a retired target when replacement wins before setTarget (keyed=%s)', async keyed => {
  const s = await scenario(), f = await prepare(s), entered = gate(), resume = gate(), allowWrite = gate(), oldTarget = s.byKey.get(0)!.id;
  let eligibilityReads = 0;
  const observed = db.$extends({ query: { bannerFeaturedCharacter: { async findFirst({ args, query }) {
    const value = await query(args); eligibilityReads++; await allowWrite.promise; return value;
  } } } });
  const store = new PrismaGachaStore(observed as unknown as PrismaClient), before = await pullGraph(s.player.id);
  const replacing = applyLegacyBannerReplacement(db, config, f.input, async backup => { await f.write(backup); entered.release(); await resume.promise; });
  await entered.promise;
  const selecting = store.setTarget(s.player.id, oldTarget, keyed ? randomUUID() : undefined, keyed ? 'INTERNAL_CHAT' : 'UI');
  const settledSelection = Promise.allSettled([selecting]);
  let waitingQuery: string, readsWhileReplacing: number;
  try { waitingQuery = await waitingOnCycleHolder(() => eligibilityReads > 0); readsWhileReplacing = eligibilityReads; } finally { resume.release(); }
  try { await replacing; } finally { allowWrite.release(); }
  const [selection] = await settledSelection;
  expect(selection!.status).toBe('rejected');
  if (selection!.status === 'rejected') expect(selection!.reason).toMatchObject({ code: 'GACHA_TARGET_INVALID' });
  expect(waitingQuery!).toContain('pg_advisory_xact_lock(70422401)'); expect(readsWhileReplacing!).toBe(0);
  expect((await db.playerGachaState.findUniqueOrThrow({ where: { playerId: s.player.id } })).selectedBannerCharacterId).toBeNull();
  expect(await pullGraph(s.player.id)).toEqual(before);
  expect(await db.businessOperation.count({ where: { playerId: s.player.id, operationType: 'gacha.target' } })).toBe(0);
});

it.each([{ keyed: false, compatible: false }, { keyed: true, compatible: false }, { keyed: false, compatible: true }, { keyed: true, compatible: true }])(
  'serializes setTarget first and preserves or clears its choice without gains ($keyed/$compatible)', async ({ keyed, compatible }) => {
    const s = await scenario(undefined, { compatible }), f = await prepare(s), entered = gate(), resume = gate(), target = s.byKey.get(0)!.id, key = keyed ? randomUUID() : undefined;
    const beforeGacha = await db.playerGachaState.findUniqueOrThrow({ where: { playerId: s.player.id } });
    const observed = db.$extends({ query: { bannerFeaturedCharacter: { async findFirst({ args, query }) {
      const value = await query(args); entered.release(); await resume.promise; return value;
    } } } });
    const store = new PrismaGachaStore(observed as unknown as PrismaClient);
    const selecting = store.setTarget(s.player.id, target, key, keyed ? 'INTERNAL_CHAT' : 'UI');
    await entered.promise;
    let prematureBackups = 0;
    const firstReplacement = Promise.allSettled([applyLegacyBannerReplacement(db, config, f.input, async backup => { prematureBackups++; await f.write(backup); })]);
    let waitingQuery: string;
    try { waitingQuery = await waitingOnCycleHolder(); } finally { resume.release(); }
    expect((await selecting).selectedBannerCharacterId).toBe(target);
    expect(waitingQuery!).toContain('pg_advisory_xact_lock(70422401)');
    const [stale] = await firstReplacement;
    expect(stale!.status).toBe('rejected');
    if (stale!.status === 'rejected') {
      expect(isPrismaConcurrencyCollision(stale!.reason) || String(stale!.reason).includes('PLAN_CHANGED')).toBe(true);
      expect(String(stale!.reason)).not.toMatch(/deadlock|40P01/i);
    }
    expect(prematureBackups).toBe(0);
    // A target mutation invalidates the old approved preimage; refresh before retry.
    f.input.expectedFingerprint = (await planLegacyBannerReplacement(db, s.input)).fingerprint;
    const preserved = await pullGraph(s.player.id);
    await applyLegacyBannerReplacement(db, config, f.input, f.write);
    const after = await db.playerGachaState.findUniqueOrThrow({ where: { playerId: s.player.id } });
    const { selectedBannerCharacterId: _old, updatedAt: _time, ...invariants } = beforeGacha;
    expect(after).toMatchObject(invariants); expect(after.selectedBannerCharacterId).toBe(compatible ? target : null);
    if (keyed || compatible) expect((await store.setTarget(s.player.id, target, key, keyed ? 'INTERNAL_CHAT' : 'UI')).selectedBannerCharacterId).toBe(compatible ? target : null);
    else await expect(store.setTarget(s.player.id, target)).rejects.toMatchObject({ code: 'GACHA_TARGET_INVALID' });
    expect(await db.businessOperation.count({ where: { playerId: s.player.id, operationType: 'gacha.target' } })).toBe(keyed ? 1 : 0);
    expect(await pullGraph(s.player.id)).toEqual(preserved);
  });

it('uses fresh database time and refuses caller time outside the actual loopback private schema', async () => {
  const start = new Date(), current = await db.$transaction(tx => readBannerReplacementTime(tx));
  expect(current.getTime()).toBeGreaterThanOrEqual(start.getTime() - 1000); expect(current.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  expect(await db.$transaction(tx => readBannerReplacementTime(tx, now))).toEqual(now);
  await expect(db.$transaction(async tx => {
    // SELECT/search_path only; no public table is read or mutated.
    await tx.$executeRaw`SET LOCAL search_path TO public`;
    return readBannerReplacementTime(tx, new Date('2001-10-08T12:00:00Z'));
  })).rejects.toThrow('PRIVATE_CLOCK_ONLY');
  const expired = await scenario(undefined, { year: 2001 }), input = { ...expired.input, now: undefined };
  await expect(planLegacyBannerReplacement(db, input)).rejects.toThrow('SOURCE_WEEK_NOT_CURRENT');
  await expect(applyLegacyBannerReplacement(db, config, { ...input, operationId: randomUUID(), expectedFingerprint: 'a'.repeat(64), acknowledgement: STREAMERBOT_PATH_DISABLED }, async () => { throw Error('Must not back up'); })).rejects.toThrow('SOURCE_WEEK_NOT_CURRENT');
  expect((await db.bannerRotation.findUniqueOrThrow({ where: { id: expired.native.id } })).status).toBe('ACTIVE');
});

it.each(['backup', 'writes'])('rolls back if the source week expires during %s', async stage => {
  const s = await scenario(), f = await prepare(s), before = await pullGraph(s.player.id);
  const observed = stage === 'writes' ? db.$extends({ query: { bannerRotation: { async create({ args, query }) {
    const value = await query(args); f.input.now = s.finish; return value;
  } } } }) as unknown as PrismaClient : db;
  await expect(applyLegacyBannerReplacement(observed, config, f.input, async backup => {
    await f.write(backup); if (stage === 'backup') f.input.now = s.finish;
  })).rejects.toThrow('SOURCE_WEEK_NOT_CURRENT');
  expect(await pullGraph(s.player.id)).toEqual(before);
  expect((await db.bannerRotation.findUniqueOrThrow({ where: { id: s.native.id } })).status).toBe('ACTIVE');
  expect(await db.migrationBatch.count({ where: { id: f.input.operationId } })).toBe(0);
});

it.each([undefined, 8])('reports a verified non-NATIVE voter as deferred and blocks apply without ghost or weighting (nativeChoice=%s)', async nativeChoice => {
  const s = await scenario(nativeChoice, { deferred: true }), f = await prepare(s), report = s.input.bindings[0]!.importReport, source = report.users[1]!;
  const legacy = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private existing legacy voter', twitchIdentity: { twitchUserId: source.twitchUserId, login: source.currentLogin, displayName: source.displayName, firstSeenAt: s.at } }));
  await db.twitchNativeTarget.create({ data: { twitchUserId: source.twitchUserId, playerId: legacy.id, dataAuthority: 'LEGACY', canary: false } });
  const run = await db.twitchCanaryImport.create({ data: { twitchUserId: source.twitchUserId, playerId: legacy.id, snapshotHash: s.input.snapshot.hash, identityReportHash: identityProofHash(report), backupHash: 'b'.repeat(64) } });
  f.input.expectedFingerprint = (await planLegacyBannerReplacement(db, s.input)).fingerprint;
  const planned = await planLegacyBannerReplacement(db, s.input), count = await db.player.count(), votes = await db.bannerVote.findMany();
  expect(planned).toMatchObject({ status: 'BLOCKED_VOTES', applicationGate: 'LEGACY_VOTES_REQUIRE_DECISION', unresolvedLegacyVotes: 1 });
  expect(planned.legacyVoteDisposition.map(v => v.action)).toEqual([nativeChoice === undefined ? 'IMPORT' : 'RETAIN', 'DEFERRED']);
  await expect(applyLegacyBannerReplacement(db, config, f.input, async () => { throw Error('No backup/write before vote decision'); })).rejects.toThrow('LEGACY_VOTES_REQUIRE_DECISION');
  await expect(planLegacyBannerReplacement(db, { ...s.input, bindings: [...s.input.bindings, { snapshot: s.input.snapshot, importReport: report, importId: run.id, twitchUserId: source.twitchUserId, playerId: legacy.id }] })).rejects.toThrow('DEFINITIVE_PLAYER_CONFLICT');
  expect(await db.player.count()).toBe(count); expect(await db.bannerVote.findMany()).toEqual(votes);
  expect((await db.bannerRotation.findUniqueOrThrow({ where: { id: s.native.id } })).status).toBe('ACTIVE');
});

it('retains all 16 native operations and 115 results with their original rotation references, applies one ACTIVE legacy rotation, replays and compensates exactly', async () => {
  const s = await scenario(8);
  const archived = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private archived predecessor' }));
  await db.playerGachaState.update({ where: { playerId: archived.id }, data: { selectedBannerCharacterId: s.byKey.get(0)!.id } });
  await db.player.update({ where: { id: archived.id }, data: { status: 'ARCHIVED' } });
  const archivedGacha = await db.playerGachaState.findUniqueOrThrow({ where: { playerId: archived.id } });
  const f = await prepare(s), pulls = await pullGraph(s.player.id), original = await db.bannerRotation.findUniqueOrThrow({ where: { id: s.native.id }, include: { featuredCharacters: true, votes: true } });
  const gacha = await db.playerGachaState.findUniqueOrThrow({ where: { playerId: s.player.id } });
  expect(pulls.tables.pull_operations).toHaveLength(16); expect(pulls.tables.pull_results).toHaveLength(115);
  expect(f.plan).toMatchObject({ retainedLegacyVotes: 1, importedLegacyVotes: 0, unresolvedLegacyVotes: 0 });
  const result = await applyLegacyBannerReplacement(db, config, f.input, f.write);
  const legacy = await db.bannerRotation.findUniqueOrThrow({ where: { id: result.rotationId }, include: { featuredCharacters: true, votes: true } });
  expect(legacy).toMatchObject({ status: 'ACTIVE', startsAt: s.start, endsAt: s.finish, generationVoteSnapshot: null });
  expect(legacy.featuredCharacters.map(c => c.characterId).sort()).toEqual(s.legacyIds.map(id => s.byKey.get(id)!.id).sort());
  expect(legacy.votes).toHaveLength(1); expect(legacy.votes[0]).toMatchObject({ sourceChannel: 'UI', votedAt: s.at });
  const old = await db.bannerRotation.findUniqueOrThrow({ where: { id: s.native.id }, include: { featuredCharacters: true, votes: true } });
  expect(old).toEqual({ ...original, status: 'ENDED', supersededAt: s.at });
  expect(await pullGraph(s.player.id)).toEqual(pulls);
  expect(await db.playerGachaState.findUniqueOrThrow({ where: { playerId: s.player.id } })).toMatchObject({ pity5: gacha.pity5, pity4: gacha.pity4, guaranteedFeatured5: true, captureProgress: 2, totalPulls: 115n, selectedBannerCharacterId: null });
  expect(await db.bannerRotation.count({ where: { status: 'ACTIVE' } })).toBe(1);
  expect(await db.playerGachaState.findUniqueOrThrow({ where: { playerId: archived.id } })).toEqual(archivedGacha);
  await expect(db.bannerRotation.create({ data: { startsAt: s.start, endsAt: s.finish, status: 'ENDED' } })).rejects.toMatchObject({ code: 'P2002' });
  expect((await new HistoryService(db).banners(1)).entries.some(r => r.id === s.native.id)).toBe(false);
  expect(await applyLegacyBannerReplacement(db, config, f.input, async () => { throw Error('No second backup'); })).toMatchObject({ replayed: true });
  const rollback = { ...s.input, backup: f.backup(), expectedBackupHash: f.backup().hash, acknowledgement: STREAMERBOT_PATH_DISABLED };
  expect(await rollbackLegacyBannerReplacement(db, config, rollback)).toEqual({ replayed: false });
  expect(await rollbackLegacyBannerReplacement(db, config, rollback)).toEqual({ replayed: true });
  expect(await db.bannerRotation.findUniqueOrThrow({ where: { id: s.native.id }, include: { featuredCharacters: true, votes: true } })).toEqual(original);
  expect(await db.playerGachaState.findUniqueOrThrow({ where: { playerId: s.player.id } })).toEqual(gacha);
  expect(await pullGraph(s.player.id)).toEqual(pulls);
});

it('fails before writes on vote collision, an ineligible native vote, stale fingerprint, backup failure or non-OFF gates', async () => {
  const collision = await scenario(9);
  await expect(planLegacyBannerReplacement(db, collision.input)).rejects.toThrow('VOTE_COLLISION');
  const ineligible = await scenario();
  const nativeVoter = await db.player.create({ data: { displayName: 'Private native voter' } });
  await db.bannerVote.create({ data: { bannerRotationId: ineligible.native.id, playerId: nativeVoter.id, characterId: ineligible.byKey.get(4)!.id, sourceChannel: 'UI' } });
  await expect(planLegacyBannerReplacement(db, ineligible.input)).rejects.toThrow('NATIVE_VOTE_NOW_INELIGIBLE');
  const s = await scenario(), f = await prepare(s), before = await pullGraph(s.player.id);
  await expect(applyLegacyBannerReplacement(db, config, { ...f.input, expectedFingerprint: 'b'.repeat(64) }, f.write)).rejects.toThrow('PLAN_CHANGED');
  await expect(applyLegacyBannerReplacement(db, config, f.input, async () => { throw Error('DISK_FULL'); })).rejects.toThrow('DISK_FULL');
  await expect(applyLegacyBannerReplacement(db, { ...config, twitchCommandPilot: { enabled: true, globalEnabled: false } }, f.input, f.write)).rejects.toThrow('OFF_GATE_REQUIRED');
  expect(await pullGraph(s.player.id)).toEqual(before);
  expect((await db.bannerRotation.findUniqueOrThrow({ where: { id: s.native.id } })).status).toBe('ACTIVE');
});

it('keeps the replacement through the current week and rotates normally at Paris Monday with transferred votes', async () => {
  const s = await scenario(), f = await prepare(s), result = await applyLegacyBannerReplacement(db, config, f.input, f.write), store = new PrismaGachaStore(db), before = await pullGraph(s.player.id);
  expect((await store.ensureRotation(s.start, s.finish, () => { throw Error('No artificial generation'); })).id).toBe(result.rotationId);
  const end = new Date(s.finish); end.setUTCDate(end.getUTCDate() + 7);
  const next = await store.ensureRotation(s.finish, end, (catalog, previous, votes) => selectBannerFeatured(catalog, previous, votes, { nextInt: () => 0 }));
  expect(next.id).not.toBe(result.rotationId);
  expect(next.featuredFiveStars.some(c => c.id === s.byKey.get(8)!.id)).toBe(true);
  expect((await store.ensureRotation(s.finish, end, () => { throw Error('No second rotation'); })).id).toBe(next.id);
  expect(await db.bannerRotation.count({ where: { status: 'ACTIVE' } })).toBe(1);
  expect(await pullGraph(s.player.id)).toEqual(before);
  await expect(rollbackLegacyBannerReplacement(db, config, { ...s.input, backup: f.backup(), expectedBackupHash: f.backup().hash, acknowledgement: STREAMERBOT_PATH_DISABLED })).rejects.toThrow('POSTIMAGE_CHANGED');
});

it('serializes native votes and replacement on the common cycle lock, and refuses compensation after new gameplay', async () => {
  const s = await scenario(), f = await prepare(s), other = await db.player.create({ data: { displayName: 'Private concurrent voter' } });
  // A newly created Player invalidates the protected preimage: refresh before racing.
  f.input.expectedFingerprint = (await planLegacyBannerReplacement(db, s.input)).fingerprint;
  const service = new BannerVoteService({ execute: async () => ({ id: other.id }) } as unknown as GetCurrentPlayer, db, { now: () => s.at });
  const race = await Promise.allSettled([applyLegacyBannerReplacement(db, config, f.input, f.write), service.vote({ subject: 'private' }, s.byKey.get(9)!.id, s.native.id)]);
  const applied = race[0];
  expect(await db.bannerRotation.count({ where: { status: 'ACTIVE' } })).toBe(1);
  if (applied.status === 'fulfilled') {
    if (race[1].status === 'fulfilled') expect(await db.bannerVote.count({ where: { bannerRotationId: applied.value.rotationId, playerId: other.id } })).toBe(1);
    await db.playerGachaState.update({ where: { playerId: s.player.id }, data: { pity5: 18 } });
    await expect(rollbackLegacyBannerReplacement(db, config, { ...s.input, backup: f.backup(), expectedBackupHash: f.backup().hash, acknowledgement: STREAMERBOT_PATH_DISABLED })).rejects.toThrow('POSTIMAGE_CHANGED');
  } else {
    expect(applied.reason?.code === 'P2034' || String(applied.reason).includes('PLAN_CHANGED')).toBe(true);
    expect(race[1].status).toBe('fulfilled');
    expect((await db.bannerRotation.findUniqueOrThrow({ where: { id: s.native.id } })).status).toBe('ACTIVE');
  }
});

it('restores the entire private schema including closed proofs exactly, and restores all physical guards', async () => {
  const backup = await capturePrivateSchema(fixture.admin, fixture.schema), file = await writePrivateBackup(backup, 'r1061_closed_proofs');
  expect(backup.tables.external_banner_votes!.length).toBeGreaterThan(0);
  await expect(restorePrivateBackup(fixture.admin, 'public', file)).rejects.toThrow('isolated private schema');
  await restorePrivateBackup(fixture.admin, fixture.schema, file);
  expect((await capturePrivateSchema(fixture.admin, fixture.schema)).hash).toBe(backup.hash);
  const frozen = await db.externalBannerVote.findFirstOrThrow({ where: { frozenAt: { not: null } } });
  await expect(db.externalBannerVote.delete({ where: { id: frozen.id } })).rejects.toThrow('EXTERNAL_BANNER_VOTE_FROZEN');
});
