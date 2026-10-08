import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { identityProofHash } from '../src/application/migration/owner-approved-population.js';
import { applyLegacyBannerReplacement, planLegacyBannerReplacement, rollbackLegacyBannerReplacement, type LegacyBannerReplacementBackup } from '../src/application/migration/legacy-banner-replacement.js';
import { captureTargetedPlayerRows } from '../src/application/migration/targeted-player-rows.js';
import { PrismaGachaStore } from '../src/infrastructure/database/prisma-gacha-store.js';
import { selectBannerFeatured } from '../src/domain/gacha/gacha.js';
import { HistoryService } from '../src/application/history/history-service.js';
import { BannerVoteService } from '../src/application/gacha/banner-vote-service.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import type { Snapshot } from '../src/application/migration/streamerbot-snapshot.js';
import type { VerifiedTwitchReport } from '../src/application/migration/verified-twitch-report.js';

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

async function scenario(nativeChoice?: number) {
  const n = ++sequence, name = `private_banner_${n}`, twitchUserId = String(970000000000 + n);
  // Isolate each scenario's cycle without deleting historical rotations or pulls.
  await db.bannerRotation.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'ENDED' } });
  const year = 2099 + n, at = new Date(`${year}-10-08T12:00:00Z`);
  // Use a Monday anchored to this scenario rather than relying on a fixed weekday across years.
  const day = new Date(`${year}-10-08T12:00:00Z`); day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7); const week = day.toISOString().slice(0, 10);
  const end = new Date(day); end.setUTCDate(day.getUTCDate() + 7);
  const start = new Date(week + 'T00:00:00+02:00'), finish = new Date(end.toISOString().slice(0, 10) + 'T00:00:00+02:00');
  const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private preserved native', twitchIdentity: { twitchUserId, login: name, displayName: 'Private native', firstSeenAt: at } }));
  const catalog = await db.character.findMany({ orderBy: { externalKey: 'asc' } }), byKey = new Map(catalog.map(c => [Number(c.externalKey.slice(7)), c]));
  const nativeIds = [0, 1, 2, 3, 14, 15, 16, 17, 18, 19], legacyIds = [4, 5, 6, 7, 20, 21, 22, 23, 24, 25];
  const native = await db.bannerRotation.create({ data: { startsAt: start, endsAt: finish, status: 'ACTIVE', generationVoteSnapshot: { originalNativeGeneration: true },
    featuredCharacters: { create: nativeIds.map((id, i) => ({ characterId: byKey.get(id)!.id, rarity: i < 4 ? 5 : 4, slot: i < 4 ? i + 1 : i - 3, selectionSource: 'RANDOM' })) } } });
  await db.playerGachaState.update({ where: { playerId: player.id }, data: { pity5: 17, pity4: 3, guaranteedFeatured5: true, captureProgress: 2, totalPulls: 115n, selectedBannerCharacterId: byKey.get(0)!.id } });
  for (let i = 0; i < 16; i++) {
    const pullCount = i < 11 ? 10 : 1;
    const operation = await db.businessOperation.create({ data: { playerId: player.id, operationType: 'gacha.pull', sourceChannel: 'UI', status: 'COMPLETED', resultSummary: { immutableNative: i } } });
    await db.pullOperation.create({ data: { playerId: player.id, bannerRotationId: native.id, targetCharacterId: byKey.get(0)!.id, pullCount, primogemCost: 160n * BigInt(pullCount), sourceChannel: 'UI', businessOperationId: operation.id,
      results: { create: Array.from({ length: pullCount }, (_, result) => ({ resultIndex: result + 1, resultType: 'character', characterId: byKey.get(0)!.id, rarity: 5, wasNewCharacter: false, constellationAfter: 1, copiesAfter: 2, snapshot: { immutableNative: i, result, pity5: i } })) } } });
  }
  if (nativeChoice !== undefined) await db.bannerVote.create({ data: { bannerRotationId: native.id, playerId: player.id, characterId: byKey.get(nativeChoice)!.id, sourceChannel: 'UI', votedAt: at } });
  const snapshot: Snapshot = { hash: createHash('sha256').update(`banner-replacement-${n}`).digest('hex'), files: 17, sources: { 'viewers_data.json': { [name]: {} },
    'genshin_characters.json': { lastBannerUpdate: week, characters: legacyIds.map(id => ({ id, bannerFeatured: true })) },
    'banner_votes.json': { weekId: week, voters: { [name]: 8, private_unresolved: 9 }, votes: { 8: { votes: 1 }, 9: { votes: 1 } } } } };
  const report: VerifiedTwitchReport = { version: 1, verification: 'TWITCH_HELIX', snapshotHash: snapshot.hash, resolvedAt: at.toISOString(), users: [{ legacyLogin: name, twitchUserId, currentLogin: name, displayName: 'Private source', renamed: false }], missing: [], conflicts: [], duplicates: 0 };
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

it('retains all 16 native operations and 115 results with their original rotation references, applies one ACTIVE legacy rotation, replays and compensates exactly', async () => {
  const s = await scenario(8);
  const archived = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private archived predecessor' }));
  await db.playerGachaState.update({ where: { playerId: archived.id }, data: { selectedBannerCharacterId: s.byKey.get(0)!.id } });
  await db.player.update({ where: { id: archived.id }, data: { status: 'ARCHIVED' } });
  const archivedGacha = await db.playerGachaState.findUniqueOrThrow({ where: { playerId: archived.id } });
  const f = await prepare(s), pulls = await pullGraph(s.player.id), original = await db.bannerRotation.findUniqueOrThrow({ where: { id: s.native.id }, include: { featuredCharacters: true, votes: true } });
  const gacha = await db.playerGachaState.findUniqueOrThrow({ where: { playerId: s.player.id } });
  expect(pulls.tables.pull_operations).toHaveLength(16); expect(pulls.tables.pull_results).toHaveLength(115);
  expect(f.plan).toMatchObject({ retainedLegacyVotes: 1, importedLegacyVotes: 0, unresolvedLegacyVotes: 1 });
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
