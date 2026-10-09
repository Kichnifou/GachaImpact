import { randomUUID } from 'node:crypto';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../generated/prisma/client.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { recoveryDomainSource, recoveryImportedAt, recoveryNow } from '../tests/helpers/legacy-recovery-domain-fixture.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { captureTargetedPlayerRows } from '../src/application/migration/targeted-player-rows.js';
import { communityHash, communityRecord } from '../src/application/migration/legacy-community-proof.js';
import { applyRecoveryDomain, planRecoveryDomain, rollbackRecoveryDomain, recoveryDomainBackupSchema,
  type RecoveryDomainInput, type RecoveryDomainBackup } from '../src/application/migration/legacy-recovery-domains.js';
import { applySharedRecovery, planSharedRecovery, rollbackSharedRecovery, sharedRecoveryBackupSchema,
  type SharedRecoveryInput, type SharedRecoveryKind, type SharedRecoveryBackup } from '../src/application/migration/legacy-recovery-shared.js';
import { parsePlayerRecovery } from '../src/application/player/player-recovery-readiness.js';
import { STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { verifiedPlayerActor } from '../src/application/player/player-execution-actor.js';
import { EventService } from '../src/application/event/event-service.js';
import { EventChatPresence } from '../src/application/event/event-chat-presence.js';
import { MonthlyBossService } from '../src/application/combat/monthly-boss-service.js';
import { GiveawayService } from '../src/application/giveaway/giveaway-service.js';
import { parseStreamerbotSnapshot } from '../src/application/migration/streamerbot-snapshot.js';
import { createVerifiedTwitchReport, type VerifiedTwitchReport } from '../src/application/migration/verified-twitch-report.js';
import { identityProofHash } from '../src/application/migration/owner-approved-population.js';

if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env['DATABASE_URL'] ?? 'http://missing').hostname)) throw Error('Recovery domain tests require loopback PostgreSQL');
const fixture = isolatedBatchDatabase(), db = fixture.database, source = recoveryDomainSource();
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: false, globalEnabled: false },
  twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
const getPlayer = new GetCurrentPlayer({ findByIdentity: vi.fn(), provision: vi.fn() });
const random = { nextInt: vi.fn(() => 0) }, clock = { now: () => recoveryNow };
const events = new EventService(getPlayer, db, clock, random), bosses = new MonthlyBossService(getPlayer, db, clock, random);
const giveaway = new GiveawayService(db, { assertActive: async () => {}, status: async () => ({ available: true, authorized: true, enabled: true, active: true, pending: false }) }, clock.now, () => 0);
const players: { id: string; importId: string; twitchUserId: string }[] = [];
const historyOperations = new Map<SharedRecoveryKind, string>();
let operatorId: string, archiveId: string, directory: string, editionId: string, definitionId: string, nativeBossId: string;
let baseline: Awaited<ReturnType<typeof protectedState>>, archiveBaseline: Awaited<ReturnType<typeof captureTargetedPlayerRows>>;
let untouchedNativeBaseline: Awaited<ReturnType<typeof captureTargetedPlayerRows>>;
const characterIds: string[] = [];

function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
async function removeBackups() {
  if (!directory) return;
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('gacha-recovery-domains-')) throw Error('Unsafe synthetic backup cleanup');
  await rm(resolved, { recursive: true });
}
async function historyBackup(kind: SharedRecoveryKind) {
  return sharedRecoveryBackupSchema.parse(JSON.parse(await readFile(path.join(directory, `${historyOperations.get(kind)!}.json`), 'utf8')));
}

async function actor(index: number) { return verifiedPlayerActor(await db.player.findUniqueOrThrow({ where: { id: players[index]!.id } })); }
async function marker(index: number) { return parsePlayerRecovery((await db.player.findUniqueOrThrow({ where: { id: players[index]!.id } })).legacyRecovery)!; }
async function economy(index: number) {
  const playerId = players[index]!.id;
  return { balances: await db.playerResourceBalance.findMany({ where: { playerId }, orderBy: { resourceKey: 'asc' } }),
    movements: await db.resourceMovement.findMany({ where: { playerId }, orderBy: { id: 'asc' } }),
    operations: await db.businessOperation.findMany({ where: { playerId }, orderBy: { id: 'asc' } }),
    notifications: await db.notification.findMany({ where: { playerId }, orderBy: { id: 'asc' } }) };
}
async function protectedState() {
  const protectedIds = [...players.slice(0, 3), players[43]!].map(p => p.id).concat(archiveId);
  return { rows: await captureTargetedPlayerRows(db, protectedIds),
    targets: await db.twitchNativeTarget.findMany({ orderBy: { twitchUserId: 'asc' } }),
    imports: await db.twitchCanaryImport.findMany({ orderBy: { id: 'asc' } }) };
}
async function bossState() { return { bosses: await db.monthlyBoss.findMany({ orderBy: { id: 'asc' } }),
  attacks: await db.bossAttack.findMany({ orderBy: { id: 'asc' } }), participations: await db.playerBossParticipation.findMany({ orderBy: [{ bossId: 'asc' }, { playerId: 'asc' }] }),
  rewards: await db.bossReward.findMany({ orderBy: [{ bossId: 'asc' }, { playerId: 'asc' }] }), aggregates: await db.bossLegacyAggregate.findMany(), contributions: await db.bossLegacyContribution.findMany() }; }
function sharedInput(kind: SharedRecoveryKind): SharedRecoveryInput { return { source: source.input, kind, operatorPlayerId: operatorId, expectedRevision: 15, now: recoveryNow }; }
async function persist<T extends { hash: string; operationId: string }>(backup: T) {
  const { hash, ...body } = backup;
  expect(communityHash(body)).toBe(hash);
  expect(await db.migrationBatch.count({ where: { id: backup.operationId } })).toBe(0);
  const target = path.join(directory, `${backup.operationId}.json`), file = await open(target, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(backup)); await file.sync(); } finally { await file.close(); }
  expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(backup);
}
async function prepareShared(kind: SharedRecoveryKind) {
  const input = sharedInput(kind), plan = await planSharedRecovery(db, config, input);
  const request = { ...input, operationId: randomUUID(), expectedFingerprint: plan.fingerprint, acknowledgement: STREAMERBOT_PATH_DISABLED };
  let backup: SharedRecoveryBackup;
  const write = vi.fn(async (b: SharedRecoveryBackup) => { backup = sharedRecoveryBackupSchema.parse(b); await persist(backup); });
  return { input, plan, request, write, backup: () => backup!, apply: () => applySharedRecovery(db, config, request, write) };
}
async function ensureHistory(domain: 'BOSS' | 'GIVEAWAY') {
  const kind = domain === 'BOSS' ? 'BOSS_HISTORY' : 'GIVEAWAY_HISTORY';
  if (!historyOperations.has(kind)) { const prepared = await prepareShared(kind); await prepared.apply(); historyOperations.set(kind, prepared.request.operationId); }
  return historyOperations.get(kind)!;
}
async function domainInput(index: number, domain: RecoveryDomainInput['domain']): Promise<RecoveryDomainInput> {
  const p = players[index]!;
  return { source: source.input, domain, operatorPlayerId: operatorId, expectedRevision: 15, now: recoveryNow,
    playerId: p.id, twitchUserId: p.twitchUserId, importId: p.importId, importReport: source.reports[index]!,
    ...(domain !== 'EVENT' ? { sharedOperationId: await ensureHistory(domain) } : {}) };
}
async function prepare(index: number, domain: RecoveryDomainInput['domain']) {
  const input = await domainInput(index, domain), plan = await planRecoveryDomain(db, config, input);
  const request = { ...input, operationId: randomUUID(), expectedFingerprint: plan.fingerprint, acknowledgement: STREAMERBOT_PATH_DISABLED };
  let backup: RecoveryDomainBackup;
  const write = vi.fn(async (b: RecoveryDomainBackup) => { backup = recoveryDomainBackupSchema.parse(b); await persist(backup); });
  return { input, plan, request, write, backup: () => backup!, apply: () => applyRecoveryDomain(db, config, request, write) };
}

beforeAll(async () => {
  await fixture.setup({ prismaMigrations: true });
  directory = await mkdtemp(path.join(tmpdir(), 'gacha-recovery-domains-'));
  for (let i = 0; i < 4; i++) characterIds.push((await db.character.create({ data: { externalKey: `r1063-synthetic:${i}`, name: `Synthetic recovery fighter ${i}`, rarity: 5, elementKey: 'cryo' } })).id);
  const identities = [...source.approved, { legacyLogin: 'outside_domain_test', twitchUserId: '975519999999' }];
  for (const [index, identity] of identities.entries()) {
    const created = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: `Synthetic domain ${index}`, twitchIdentity: {
      twitchUserId: identity.twitchUserId, login: index === 0 ? 'kichnifou' : identity.legacyLogin, displayName: `Synthetic domain ${index}`, firstSeenAt: recoveryImportedAt } }, recoveryImportedAt));
    await db.twitchNativeTarget.create({ data: { playerId: created.id, twitchUserId: identity.twitchUserId, dataAuthority: 'NATIVE', canary: true,
      acknowledgement: STREAMERBOT_PATH_DISABLED, transferredAt: recoveryImportedAt } });
    const imported = await db.twitchCanaryImport.create({ data: { playerId: created.id, twitchUserId: identity.twitchUserId, importedAt: recoveryImportedAt,
      snapshotHash: source.snapshot.hash, identityReportHash: source.reportHashes[index] ?? 'd'.repeat(64), backupHash: 'b'.repeat(64) } });
    const restricted = index >= 3 && index < 43;
    await db.player.update({ where: { id: created.id }, data: { elementKey: 'cryo', legacyUsername: identity.legacyLogin,
      ...(restricted ? { legacyRecovery: { version: 1, operationId: source.input.operationId, importId: imported.id, backupHash: imported.backupHash,
        snapshotHash: source.snapshot.hash, populationHash: source.populationHash, restrictedDomains: ['EVENT', 'BOSS', 'GIVEAWAY'] } } : {}) } });
    await db.playerResourceBalance.updateMany({ where: { playerId: created.id }, data: { amount: 12_345n } });
    players.push({ id: created.id, importId: imported.id, twitchUserId: identity.twitchUserId });
  }
  operatorId = players[0]!.id; config.twitch.pilotPlayerIds.push(operatorId);
  await db.playerRoleAssignment.create({ data: { playerId: operatorId, role: 'ADMIN', source: 'synthetic-recovery' } });
  await db.twitchNativeAuthority.create({ data: { id: 'twitch-commands', desiredMode: 'OFF', revision: 15, operatorPlayerId: operatorId, acknowledgement: STREAMERBOT_PATH_DISABLED, acknowledgedAt: recoveryNow } });
  const archive = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Protected synthetic archive' }, recoveryImportedAt));
  archiveId = archive.id; await db.playerProgression.update({ where: { playerId: archiveId }, data: { xp: 777n } });
  await db.player.update({ where: { id: archiveId }, data: { status: 'ARCHIVED' } });
  if (!await db.eventDefinition.findFirst({ where: { calendarMonth: 10 } })) await db.eventDefinition.create({ data: { externalKey: 'shadows', displayName: 'Synthetic Festival', calendarMonth: 10, currencyKey: 'shadows',
    config: { emoji: '🎃', currency: { label: 'Synthetic token', emoji: '🍬' }, collection: { key: 'synthetic-october', label: 'Synthetic collection' } } } });
  const edition = await events.resolveCurrentEdition(db, recoveryNow); editionId = edition.edition.id; definitionId = edition.definition.id;
  await db.monthlyBoss.create({ data: { monthStart: new Date('2026-09-01T00:00:00Z'), nameSnapshot: 'Protected previous native Boss', baseHp: 1_500_000n, maxHp: 1_500_000n, currentHp: 1_269_000n, hpVariationPercent: 0, resistanceElementKey: 'anemo' } });
  nativeBossId = (await db.monthlyBoss.create({ data: { monthStart: new Date('2026-10-01T00:00:00Z'), nameSnapshot: 'Protected current native Boss', baseHp: 500_000n, maxHp: 490_000n, currentHp: 398_950n, hpVariationPercent: -2, resistanceElementKey: 'pyro' } })).id;
  await db.playerBossStats.create({ data: { playerId: operatorId, totalDamage: 91_050n, totalAttacks: 12n, totalParticipated: 1n, bestHit: 10_000n } });
  await db.playerBossParticipation.create({ data: { bossId: nativeBossId, playerId: operatorId, totalDamage: 91_050n, attackCount: 12n, bestHit: 10_000n } });
  for (const index of [3, 4]) {
    await db.playerCharacter.createMany({ data: characterIds.map(characterId => ({ playerId: players[index]!.id, characterId, constellation: 0, copies: 1, firstObtainedAt: recoveryImportedAt })) });
    await db.playerBossLoadout.create({ data: { playerId: players[index]!.id, slots: { create: characterIds.map((characterId, i) => ({ characterId, position: i + 1 })) } } });
  }
  await db.giveawaySession.create({ data: { status: 'CLOSED', origin: 'NATIVE', rewardStatus: 'DISTRIBUTED', openedAt: new Date('2026-10-07T12:00:00Z'), closedAt: new Date('2026-10-07T14:00:00Z'), openedByPlayerId: operatorId } });
  baseline = await protectedState(); archiveBaseline = await captureTargetedPlayerRows(db, [archiveId]);
  untouchedNativeBaseline = await captureTargetedPlayerRows(db, [players[1]!.id, players[2]!.id, players[43]!.id]);
}, 180_000);

afterAll(async () => {
  try { if (archiveBaseline) {
    expect(await db.twitchNativeTarget.count({ where: { canary: true, dataAuthority: 'NATIVE' } })).toBe(44);
    expect(await captureTargetedPlayerRows(db, [archiveId])).toEqual(archiveBaseline);
    expect(await captureTargetedPlayerRows(db, [players[1]!.id, players[2]!.id, players[43]!.id])).toEqual(untouchedNativeBaseline);
    expect(await db.twitchNativeTarget.findMany({ orderBy: { twitchUserId: 'asc' } })).toEqual(baseline.targets);
    expect(await db.twitchCanaryImport.findMany({ orderBy: { id: 'asc' } })).toEqual(baseline.imports);
    expect(await db.player.count()).toBe(45);
  } } finally {
    await fixture.cleanup(); const pool = fixture.poolSnapshot(); expect(pool).toMatchObject({ total: 0, idle: 0, waiting: 0 }); expect(pool.closed).toBe(pool.opened);
    await removeBackups();
  }
}, 60_000);

describe('recovery domains and shared histories on private PostgreSQL', () => {
  it('prepares read-only while CANARY runs, fixes the population and excludes old natives, archives and outside identities', async () => {
    expect(source.approved).toHaveLength(43);
    const population = source.input.population as { historicalProof: { ownerDiscardedLogins: unknown[] }; quarantined: unknown[] };
    expect(population.historicalProof.ownerDiscardedLogins).toHaveLength(171); expect(population.quarantined).toHaveLength(2);
    const before = await protectedState(), count = await db.migrationBatch.count();
    const input = await domainInput(3, 'EVENT');
    config.twitchCommandPilot.enabled = true; await db.twitchNativeAuthority.update({ where: { id: 'twitch-commands' }, data: { desiredMode: 'CANARY' } });
    try {
      const first = await planRecoveryDomain(db, config, input); expect(first.status).toBe('READY');
      expect(await planRecoveryDomain(db, config, input)).toEqual(first);
      await expect(planRecoveryDomain(db, config, { ...input, playerId: archiveId })).rejects.toThrow('DEFINITIVE_PLAYER_CONFLICT');
      await expect(planRecoveryDomain(db, config, { ...input, twitchUserId: players[43]!.twitchUserId })).rejects.toThrow('OUTSIDE_VERIFIED_POPULATION');
      await expect(planRecoveryDomain(db, config, await domainInput(0, 'EVENT'))).rejects.toThrow();
    } finally { config.twitchCommandPilot.enabled = false; await db.twitchNativeAuthority.update({ where: { id: 'twitch-commands' }, data: { desiredMode: 'OFF' } }); }
    expect(await protectedState()).toEqual(before); expect(await db.migrationBatch.count()).toBe(count);
  });

  it('backs up and journals every historical Boss without changing native instances or creating native reward eligibility', async () => {
    const before = await bossState(), prepared = await prepareShared('BOSS_HISTORY');
    await expect(applySharedRecovery(db, config, prepared.request, async () => { throw Error('BACKUP_UNAVAILABLE'); })).rejects.toThrow('BACKUP_UNAVAILABLE');
    expect(await db.migrationBatch.findUnique({ where: { id: prepared.request.operationId } })).toBeNull();
    expect(await prepared.apply()).toMatchObject({ replayed: false, result: { sourceBosses: 3, nativeBossesChanged: 0, payments: 0 } });
    expect(await prepared.apply()).toMatchObject({ replayed: true }); expect(prepared.write).toHaveBeenCalledTimes(1);
    expect(await bossState()).toEqual(before);
    expect(communityRecord(prepared.backup().facts).bindings).toHaveLength(43);
    expect(await rollbackSharedRecovery(db, config, prepared.input, prepared.backup())).toEqual({ status: 'ROLLED_BACK' });
    expect(await bossState()).toEqual(before); expect(await protectedState()).toEqual(baseline);
  });

  it('serializes two Boss archives of the same source into one applied journal, with bounded replay after a collision', async () => {
    const first = await prepareShared('BOSS_HISTORY'), second = await prepareShared('BOSS_HISTORY'), before = await bossState();
    const entered = deferred(), release = deferred();
    const applying = applySharedRecovery(db, config, first.request, async backup => { await first.write(backup); entered.resolve(); await release.promise; });
    await Promise.race([entered.promise, applying.then(() => { throw Error('Backup barrier was not reached'); })]);
    let secondFinished = false;
    const competing = second.apply().then(value => ({ value, error: undefined }), error => ({ value: undefined, error: String(error) })).finally(() => { secondFinished = true; });
    try { await new Promise(resolve => setTimeout(resolve, 100)); expect(secondFinished).toBe(false); }
    finally { release.resolve(); }
    expect(await applying).toMatchObject({ replayed: false });
    expect((await competing).error).toContain('SOURCE_ALREADY_ARCHIVED');
    expect(first.write).toHaveBeenCalledTimes(1); expect(second.write.mock.calls.length).toBeLessThanOrEqual(1);
    const journals = await db.migrationBatch.findMany({ where: { id: { in: [first.request.operationId, second.request.operationId] } } });
    expect(journals.map(row => row.id)).toEqual([first.request.operationId]);
    expect(communityRecord(journals[0]!.summary).state).toBe('APPLIED');
    expect(await db.twitchNativeAudit.count({ where: { action: { in: [first.request.operationId, second.request.operationId].map(id => `RECOVERY_BOSS_HISTORY_APPLIED:${id}`) } } })).toBe(1);
    expect(await bossState()).toEqual(before); historyOperations.set('BOSS_HISTORY', first.request.operationId);
  });

  it('restores a closed Giveaway with truthful participants, counters and winner, no payment or announcement, and exact compensation', async () => {
    const resources = await db.playerResourceBalance.findMany({ orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] });
    const native = await db.giveawaySession.findMany({ where: { origin: 'NATIVE' } }), prepared = await prepareShared('GIVEAWAY_HISTORY');
    expect(await prepared.apply()).toMatchObject({ result: { sessions: 1, participants: 2, chatStats: 3, wins: 1, rewardsCreated: 0 } });
    const session = await db.giveawaySession.findFirstOrThrow({ where: { origin: 'LEGACY' }, include: { participants: true, chatStats: true, wins: true, rewards: true, announcements: true } });
    expect(session).toMatchObject({ status: 'CLOSED', rewardStatus: 'UNKNOWN', winnerPlayerId: players[3]!.id, rerollCount: null, rerolledAt: null });
    expect(session.participants).toHaveLength(2); expect(session.chatStats.map(s => s.messageCount).sort()).toEqual([10n, 20n, 4n].sort());
    expect(session.wins[0]).toMatchObject({ playerId: players[3]!.id, origin: 'LEGACY', operationId: null, drawnAt: null });
    expect(session.rewards).toHaveLength(0); expect(session.announcements).toHaveLength(0);
    expect(await prepared.apply()).toMatchObject({ replayed: true }); expect(prepared.write).toHaveBeenCalledTimes(1);
    expect(await db.playerResourceBalance.findMany({ orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] })).toEqual(resources);
    expect(await db.giveawaySession.findMany({ where: { origin: 'NATIVE' } })).toEqual(native);
    expect(await rollbackSharedRecovery(db, config, prepared.input, prepared.backup())).toEqual({ status: 'ROLLED_BACK' });
    expect(await db.giveawaySession.count({ where: { origin: 'LEGACY' } })).toBe(0);
    expect(await protectedState()).toEqual(baseline); await ensureHistory('GIVEAWAY');
  });

  it('restores Event registration, points, unspent currency and acquired milestone without a second gain; compensates exactly', async () => {
    const prepared = await prepare(3, 'EVENT'), before = await captureTargetedPlayerRows(db, [players[3]!.id]), balances = await economy(3);
    await prepared.apply();
    expect(await db.eventParticipant.findUniqueOrThrow({ where: { eventEditionId_playerId: { eventEditionId: editionId, playerId: players[3]!.id } } })).toMatchObject({ points: 12, joinedAt: new Date('2026-10-01T10:00:00Z') });
    expect(await db.playerEventCurrencyBalance.findUniqueOrThrow({ where: { playerId_eventDefinitionId: { playerId: players[3]!.id, eventDefinitionId: definitionId } } })).toMatchObject({ amount: 20n });
    expect(await db.eventMilestoneClaim.findMany({ where: { playerId: players[3]!.id } })).toMatchObject([{ milestone: 10, origin: 'LEGACY', operationId: null, claimedAt: null }]);
    expect(await economy(3)).toEqual(balances); expect((await marker(3)).restrictedDomains).toEqual(['BOSS', 'GIVEAWAY']);
    expect(await db.eventGameBDailyState.count()).toBe(0);
    expect(await prepared.apply()).toMatchObject({ replayed: true }); expect(prepared.write).toHaveBeenCalledTimes(1);
    const applied = await captureTargetedPlayerRows(db, [players[3]!.id]);
    await expect(rollbackRecoveryDomain(db, config, prepared.input, { ...prepared.backup(), preimage: {} })).rejects.toThrow('BACKUP_CONFLICT');
    expect(await captureTargetedPlayerRows(db, [players[3]!.id])).toEqual(applied);
    expect(await rollbackRecoveryDomain(db, config, prepared.input, prepared.backup())).toMatchObject({ status: 'ROLLED_BACK' });
    expect(await captureTargetedPlayerRows(db, [players[3]!.id])).toEqual(before);
    expect(await protectedState()).toEqual(baseline);
  });

  it('rejects backup failure, stale plans and unknown native domain rows atomically', async () => {
    const prepared = await prepare(5, 'EVENT'), before = await captureTargetedPlayerRows(db, [players[5]!.id]);
    await expect(applyRecoveryDomain(db, config, prepared.request, async () => { throw Error('BACKUP_UNAVAILABLE'); })).rejects.toThrow('BACKUP_UNAVAILABLE');
    expect(await captureTargetedPlayerRows(db, [players[5]!.id])).toEqual(before);
    await expect(applyRecoveryDomain(db, config, { ...prepared.request, expectedFingerprint: '0'.repeat(64) }, prepared.write)).rejects.toThrow('PLAN_CHANGED');
    expect(prepared.write).not.toHaveBeenCalled();
    await db.eventParticipant.create({ data: { eventEditionId: editionId, playerId: players[5]!.id, points: 1 } });
    try { await expect(prepared.apply()).rejects.toThrow('DOMAIN_NOT_EMPTY'); } finally { await db.eventParticipant.delete({ where: { eventEditionId_playerId: { eventEditionId: editionId, playerId: players[5]!.id } } }); }
    expect(prepared.write).not.toHaveBeenCalled(); expect(await captureTargetedPlayerRows(db, [players[5]!.id])).toEqual(before);
  });

  it('rejects malformed markers, a different recovery operation and an expired Event month', async () => {
    const input = await domainInput(5, 'EVENT'), saved = await db.player.findUniqueOrThrow({ where: { id: input.playerId } });
    await expect(planRecoveryDomain(db, config, { ...input, source: { ...source.input, operationId: randomUUID() } })).rejects.toThrow('RECOVERY_BINDING_INVALID');
    await expect(planRecoveryDomain(db, config, { ...input, now: new Date('2026-11-01T12:00:00Z') })).rejects.toThrow('EVENT_EDITION_NOT_CURRENT');
    try {
      await db.player.update({ where: { id: input.playerId }, data: { legacyRecovery: { version: 1, restrictedDomains: [], wrong: true } } });
      await expect(planRecoveryDomain(db, config, input)).rejects.toThrow();
    } finally { await db.player.update({ where: { id: input.playerId }, data: { status: saved.status, legacyRecovery: saved.legacyRecovery as Prisma.InputJsonValue, updatedAt: saved.updatedAt } }); }
  });

  it.each(['milestone', 'daily', 'gameB', 'draw'] as const)('rejects incomplete or overlapping Event source facts: %s', async change => {
    const original = await domainInput(5, 'EVENT'), player = await db.player.findUniqueOrThrow({ where: { id: original.playerId } });
    const imported = await db.twitchCanaryImport.findUniqueOrThrow({ where: { id: original.importId } });
    const data = JSON.parse(source.input.sourceFiles['monthly_events_data.json']!) as Record<string, unknown>, parts = communityRecord(data.participants), row = communityRecord(parts[source.approved[5]!.legacyLogin]);
    if (change === 'milestone') row.milestonesClaimed = [];
    if (change === 'daily') row.daily = { '2026-10-09': {} };
    if (change === 'gameB') data.gameB = { '2026-10-09': { found: true } };
    if (change === 'draw') data.monthlyDraw = { drawDone: true };
    const files = { ...source.input.sourceFiles, 'monthly_events_data.json': JSON.stringify(data) }, snapshot = parseStreamerbotSnapshot(files);
    const users = (source.input.freshReport as VerifiedTwitchReport).users;
    const freshReport = createVerifiedTwitchReport(snapshot, { users, missing: [], conflicts: [], duplicates: 0 }, new Date(), { kind: 'FINAL_POPULATION', population: source.population });
    const report = createVerifiedTwitchReport(snapshot, { users: [users[5]!], missing: [], conflicts: [], duplicates: 0 }, new Date(), { kind: 'CANARY', legacyLogin: users[5]!.legacyLogin });
    try {
      await db.twitchCanaryImport.update({ where: { id: original.importId }, data: { snapshotHash: snapshot.hash, identityReportHash: identityProofHash(report) } });
      await db.player.update({ where: { id: original.playerId }, data: { legacyRecovery: { ...parsePlayerRecovery(player.legacyRecovery)!, snapshotHash: snapshot.hash } } });
      await expect(planRecoveryDomain(db, config, { ...original, importReport: report, source: { ...source.input, sourceFiles: files, freshReport } })).rejects.toThrow(/EVENT_/);
    } finally {
      await db.twitchCanaryImport.update({ where: { id: imported.id }, data: { snapshotHash: imported.snapshotHash, identityReportHash: imported.identityReportHash } });
      await db.player.update({ where: { id: player.id }, data: { legacyRecovery: player.legacyRecovery as Prisma.InputJsonValue, updatedAt: player.updatedAt } });
    }
  });

  it('waits on the common Player lock before backup or opening a domain', async () => {
    const prepared = await prepare(13, 'EVENT');
    let unlock!: () => void, ready!: () => void;
    const acquired = new Promise<void>(resolve => { ready = resolve; }), held = new Promise<void>(resolve => { unlock = resolve; });
    const holder = db.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM players WHERE id=${players[13]!.id}::uuid FOR UPDATE`; ready(); await held; }, { timeout: 10_000 });
    await acquired; let finished = false;
    const applying = prepared.apply().finally(() => { finished = true; });
    try { await new Promise(resolve => setTimeout(resolve, 100)); expect(finished).toBe(false); expect(prepared.write).not.toHaveBeenCalled(); }
    finally { unlock(); await holder; }
    expect(await applying).toMatchObject({ replayed: false });
    expect((await marker(13)).restrictedDomains).toEqual(['BOSS', 'GIVEAWAY']);
  });

  it('restarts a real PostgreSQL serialization abort after backup without a second durable backup or duplicated restoration', async () => {
    const prepared = await prepare(15, 'EVENT');
    if (!/^[0-9a-f-]{36}$/.test(prepared.input.playerId) || !/^batch_test_[0-9a-f]{32}$/.test(fixture.schema)) throw Error('Unsafe private fault-injection identifiers');
    await fixture.admin.query(`CREATE SEQUENCE recovery_retry_probe;
      CREATE FUNCTION recovery_retry_once() RETURNS trigger LANGUAGE plpgsql AS $body$
      BEGIN
        IF nextval('${fixture.schema}.recovery_retry_probe') = 1 THEN
          RAISE EXCEPTION 'synthetic serialization collision after durable backup' USING ERRCODE = '40001';
        END IF;
        RETURN NEW;
      END $body$;
      CREATE TRIGGER recovery_retry_once AFTER INSERT ON event_participants FOR EACH ROW
        WHEN (NEW.player_id = '${prepared.input.playerId}'::uuid) EXECUTE FUNCTION recovery_retry_once();`);
    try {
      expect(await prepared.apply()).toMatchObject({ replayed: false });
      expect((await fixture.admin.query<{ last_value: string }>('SELECT last_value FROM recovery_retry_probe')).rows[0]!.last_value).toBe('2');
      expect(prepared.write).toHaveBeenCalledTimes(1);
      expect(await db.eventParticipant.count({ where: { playerId: prepared.input.playerId } })).toBe(1);
      expect(await db.eventMilestoneClaim.count({ where: { playerId: prepared.input.playerId } })).toBe(1);
      expect(await db.migrationBatch.count({ where: { id: prepared.request.operationId } })).toBe(1);
      expect(await db.twitchNativeAudit.count({ where: { action: `RECOVERY_EVENT_APPLIED:${prepared.request.operationId}` } })).toBe(1);
      expect(await prepared.apply()).toMatchObject({ replayed: true }); expect(prepared.write).toHaveBeenCalledTimes(1);
    } finally { await fixture.admin.query('DROP TRIGGER recovery_retry_once ON event_participants; DROP FUNCTION recovery_retry_once(); DROP SEQUENCE recovery_retry_probe;'); }
  });

  it('requires fresh OFF controls and no pending operation or uncertain announcement before writing a backup', async () => {
    const prepared = await prepare(17, 'EVENT'), before = await captureTargetedPlayerRows(db, [players[17]!.id]);
    config.twitchCommandPilot.enabled = true;
    try { await expect(prepared.apply()).rejects.toThrow('COMMUNITY_OFF_GATE_REQUIRED'); }
    finally { config.twitchCommandPilot.enabled = false; }
    await expect(applyRecoveryDomain(db, config, { ...prepared.request, expectedRevision: 14 }, prepared.write)).rejects.toThrow('COMMUNITY_OFF_GATE_REQUIRED');
    const pending = await db.businessOperation.create({ data: { playerId: players[18]!.id, operationType: 'synthetic.pending', sourceChannel: 'SYSTEM', idempotencyKey: randomUUID(), status: 'PENDING' } });
    try { await expect(prepared.apply()).rejects.toThrow('COMMUNITY_OPERATION_IN_FLIGHT'); }
    finally { await db.businessOperation.delete({ where: { id: pending.id } }); }
    const uncertain = await db.giveawayAnnouncement.create({ data: { kind: 'COMMAND', text: 'Synthetic uncertain announcement', state: 'RESERVED', reservedAt: recoveryNow } });
    try { await expect(prepared.apply()).rejects.toThrow('COMMUNITY_OUTBOUND_IN_FLIGHT'); }
    finally { await db.giveawayAnnouncement.delete({ where: { id: uncertain.id } }); }
    expect(prepared.write).not.toHaveBeenCalled(); expect(await captureTargetedPlayerRows(db, [players[17]!.id])).toEqual(before);
    expect(await db.migrationBatch.count({ where: { id: prepared.request.operationId } })).toBe(0);
  });

  it('resumes completed profiles after an interruption, preserving each personal import and untouched profiles', async () => {
    const first = await prepare(17, 'EVENT'), second = await prepare(19, 'EVENT');
    const beforeThird = await captureTargetedPlayerRows(db, [players[21]!.id]);
    await first.apply(); await second.apply();
    const completed = await captureTargetedPlayerRows(db, [players[17]!.id, players[19]!.id]);
    expect(await first.apply()).toMatchObject({ replayed: true }); expect(await second.apply()).toMatchObject({ replayed: true });
    expect(await captureTargetedPlayerRows(db, [players[17]!.id, players[19]!.id])).toEqual(completed);
    expect(await captureTargetedPlayerRows(db, [players[21]!.id])).toEqual(beforeThird);
    const third = await prepare(21, 'EVENT'); await third.apply();
    expect(first.write).toHaveBeenCalledTimes(1); expect(second.write).toHaveBeenCalledTimes(1); expect(third.write).toHaveBeenCalledTimes(1);
    expect(await db.twitchCanaryImport.findMany({ orderBy: { id: 'asc' } })).toEqual(baseline.imports);
    expect(await db.twitchNativeTarget.findMany({ orderBy: { twitchUserId: 'asc' } })).toEqual(baseline.targets);
  });

  it('requires the exact shared history before opening Boss and restores maxima without native participation or payment', async () => {
    const prepared = await prepare(3, 'BOSS'), before = await bossState(), economyBefore = await economy(3);
    await expect(planRecoveryDomain(db, config, { ...prepared.input, sharedOperationId: randomUUID() })).rejects.toThrow('HISTORY_JOURNAL_REQUIRED');
    await expect(planRecoveryDomain(db, config, { ...prepared.input, sharedOperationId: historyOperations.get('GIVEAWAY_HISTORY')! })).rejects.toThrow('HISTORY_JOURNAL_REQUIRED');
    const personal = await captureTargetedPlayerRows(db, [players[3]!.id]);
    await prepared.apply();
    await expect(rollbackSharedRecovery(db, config, sharedInput('BOSS_HISTORY'), await historyBackup('BOSS_HISTORY'))).rejects.toThrow('HISTORY_DOMAIN_ALREADY_OPEN');
    expect(await db.playerBossStats.findUniqueOrThrow({ where: { playerId: players[3]!.id } })).toMatchObject({ totalDamage: 1_310_000n, totalAttacks: 112n, totalParticipated: 3n, totalRewarded: 2n, finalBlows: 1n, bestHit: 20_000n });
    expect(await bossState()).toEqual(before); expect(await economy(3)).toEqual(economyBefore);
    expect(await prepared.apply()).toMatchObject({ replayed: true }); expect(prepared.write).toHaveBeenCalledTimes(1);
    expect(await rollbackRecoveryDomain(db, config, prepared.input, prepared.backup())).toMatchObject({ status: 'ROLLED_BACK' });
    expect(await captureTargetedPlayerRows(db, [players[3]!.id])).toEqual(personal);
    expect(await protectedState()).toEqual(baseline);
  });

  it('recognizes the real monthly-boss operation prefix as acquired native activity', async () => {
    const input = await domainInput(7, 'BOSS');
    const operation = await db.businessOperation.create({ data: { playerId: input.playerId, operationType: 'monthly-boss.attack', sourceChannel: 'TWITCH', idempotencyKey: randomUUID(), status: 'COMPLETED', completedAt: recoveryNow } });
    try { await expect(planRecoveryDomain(db, config, input)).rejects.toThrow('DOMAIN_NOT_EMPTY'); }
    finally { await db.businessOperation.delete({ where: { id: operation.id } }); }
  });

  it('opens an historically unregistered Event profile, permits one new registration, and never restores spent currency on replay', async () => {
    const absent = await prepare(4, 'EVENT'); await absent.apply();
    expect(await db.eventParticipant.count({ where: { playerId: players[4]!.id } })).toBe(0);
    expect(await db.playerEventCurrencyBalance.count({ where: { playerId: players[4]!.id } })).toBe(0);
    const key = randomUUID(), joined = await events.join(await actor(4), key, 'TWITCH');
    expect(joined.creditedCurrency).toBe(1); expect((await events.join(await actor(4), key, 'TWITCH')).operation.alreadyProcessed).toBe(true);
    expect(await db.eventParticipant.count({ where: { playerId: players[4]!.id } })).toBe(1);
    await expect(rollbackRecoveryDomain(db, config, absent.input, absent.backup())).rejects.toThrow('ROLLBACK_POSTIMAGE_CHANGED');
    const restored = await prepare(3, 'EVENT'); await restored.apply();
    const economyBefore = await economy(3); await events.join(await actor(3), randomUUID(), 'TWITCH');
    expect((await db.playerEventCurrencyBalance.findUniqueOrThrow({ where: { playerId_eventDefinitionId: { playerId: players[3]!.id, eventDefinitionId: definitionId } } })).amount).toBe(20n);
    await events.convertShop(await actor(3), 'PRIMOGEMS', 3, randomUUID(), 'TWITCH');
    expect((await db.playerEventCurrencyBalance.findUniqueOrThrow({ where: { playerId_eventDefinitionId: { playerId: players[3]!.id, eventDefinitionId: definitionId } } })).amount).toBe(17n);
    const after = await captureTargetedPlayerRows(db, [players[3]!.id]);
    expect(await restored.apply()).toMatchObject({ replayed: true }); expect(restored.write).toHaveBeenCalledTimes(1);
    expect(await captureTargetedPlayerRows(db, [players[3]!.id])).toEqual(after);
    expect(await db.eventMilestoneClaim.count({ where: { playerId: players[3]!.id, milestone: 10 } })).toBe(1);
    expect((await economy(3)).movements.length).toBe(economyBefore.movements.length + 1);
    await expect(rollbackRecoveryDomain(db, config, restored.input, restored.backup())).rejects.toThrow('ROLLBACK_POSTIMAGE_CHANGED');
  });

  it('keeps an unopened Event profile outside a real shared Game B reward and its milestone fanout', async () => {
    const confined = players[9]!.id;
    await db.eventParticipant.create({ data: { eventEditionId: editionId, playerId: confined, points: 9 } });
    await db.playerEventCurrencyBalance.create({ data: { eventDefinitionId: definitionId, playerId: confined, amount: 4n } });
    const before = await captureTargetedPlayerRows(db, [confined]);
    try {
      const current = await db.eventGameBDailyState.findFirstOrThrow({ where: { eventEditionId: editionId, businessDate: new Date('2026-10-09T00:00:00Z') } });
      expect(current.solvedAt).toBeNull(); expect(current.legacyFound).toBe(false);
      const key = randomUUID(), result = await events.attemptGameB(await actor(4), current.solutionCode, key, 'TWITCH');
      expect(result.attempt.kind).toBe('CORRECT');
      expect(await captureTargetedPlayerRows(db, [confined])).toEqual(before);
      const acquired = await captureTargetedPlayerRows(db, [players[3]!.id, players[4]!.id]);
      expect((await events.attemptGameB(await actor(4), current.solutionCode, key, 'TWITCH')).operation.alreadyProcessed).toBe(true);
      expect(await captureTargetedPlayerRows(db, [players[3]!.id, players[4]!.id])).toEqual(acquired);
      expect(await db.eventMilestoneClaim.count({ where: { playerId: confined } })).toBe(0);
    } finally {
      await db.playerEventCurrencyBalance.delete({ where: { playerId_eventDefinitionId: { playerId: confined, eventDefinitionId: definitionId } } });
      await db.eventParticipant.delete({ where: { eventEditionId_playerId: { eventEditionId: editionId, playerId: confined } } });
    }
  });

  it('preserves unread source messages, compensates before delivery and refuses compensation after one canonical delivery', async () => {
    const input = sharedInput('EVENT_MESSAGES'), write = vi.fn();
    await expect(planSharedRecovery(db, config, input)).rejects.toThrow('MESSAGE_EVENT_NOT_OPEN');
    await expect(applySharedRecovery(db, config, { ...input, operationId: randomUUID(), expectedFingerprint: '0'.repeat(64), acknowledgement: STREAMERBOT_PATH_DISABLED }, write)).rejects.toThrow('MESSAGE_EVENT_NOT_OPEN');
    expect(write).not.toHaveBeenCalled(); expect(await db.eventSocialMessage.count()).toBe(0);
    await (await prepare(6, 'EVENT')).apply();
    await expect(planSharedRecovery(db, config, input)).rejects.toThrow('MESSAGE_EVENT_NOT_OPEN');
    expect(await db.eventSocialMessage.count()).toBe(0);
    await (await prepare(7, 'EVENT')).apply();
    const first = await prepareShared('EVENT_MESSAGES'); await first.apply();
    expect(await db.eventSocialMessage.count()).toBe(1);
    expect(await db.businessOperation.count({ where: { operationType: 'event.message.delivery' } })).toBe(0);
    expect(await rollbackSharedRecovery(db, config, first.input, first.backup())).toEqual({ status: 'ROLLED_BACK' });
    expect(await db.eventSocialMessage.count()).toBe(0);
    const restored = await prepareShared('EVENT_MESSAGES'); await restored.apply();
    const presence = new EventChatPresence(db, events), recipient = await getPlayer.execute(await actor(6)), intent = await presence.prepare(recipient, recoveryNow);
    expect(intent?.messageIds).toHaveLength(1);
    const messages = await presence.deliver(recipient, intent!, randomUUID(), recoveryNow);
    expect(messages.filter(m => m.includes('Synthetic historical message'))).toHaveLength(1);
    expect((await presence.prepare(recipient, recoveryNow))?.messageIds).toHaveLength(0);
    expect(await restored.apply()).toMatchObject({ replayed: true });
    expect(await db.eventSocialMessage.count()).toBe(1); expect(await db.businessOperation.count({ where: { operationType: 'event.message.delivery' } })).toBe(1);
    await expect(rollbackSharedRecovery(db, config, restored.input, restored.backup())).rejects.toThrow('ROLLBACK_POSTIMAGE_CHANGED');
  });

  it('opens Giveaway only after closed history, preserves that history and admits a fresh wish exactly once', async () => {
    const prepared = await prepare(3, 'GIVEAWAY'); await prepared.apply();
    await expect(rollbackSharedRecovery(db, config, sharedInput('GIVEAWAY_HISTORY'), await historyBackup('GIVEAWAY_HISTORY'))).rejects.toThrow('HISTORY_DOMAIN_ALREADY_OPEN');
    const history = await db.giveawaySession.findFirstOrThrow({ where: { origin: 'LEGACY' }, include: { participants: true, chatStats: true, wins: true, rewards: true } });
    const fresh = await db.giveawaySession.create({ data: { origin: 'NATIVE', status: 'OPEN', rewardStatus: 'PENDING', openedAt: recoveryNow, openedByPlayerId: operatorId } });
    const key = randomUUID(); expect(await giveaway.wish(players[3]!.twitchUserId, key)).toMatchObject({ outcome: 'JOINED', duplicate: false });
    expect(await giveaway.wish(players[3]!.twitchUserId, key)).toMatchObject({ outcome: 'JOINED', duplicate: true });
    expect(await db.giveawayParticipant.count({ where: { sessionId: fresh.id, playerId: players[3]!.id } })).toBe(1);
    expect(await prepared.apply()).toMatchObject({ replayed: true });
    expect(await db.giveawaySession.findUniqueOrThrow({ where: { id: history.id }, include: { participants: true, chatStats: true, wins: true, rewards: true } })).toEqual(history);
    await expect(rollbackRecoveryDomain(db, config, prepared.input, prepared.backup())).rejects.toThrow('ROLLBACK_POSTIMAGE_CHANGED');
    await db.giveawaySession.update({ where: { id: fresh.id }, data: { status: 'CLOSED', closedAt: recoveryNow } });
  });

  it('commits a native Boss victory concurrent with another profile restoration, rewards only real participants and refuses unsafe rollback', async () => {
    const prepared = await prepare(3, 'BOSS'); await prepared.apply();
    const empty = await prepare(4, 'BOSS'); await empty.apply();
    expect(await db.playerBossParticipation.count({ where: { playerId: { in: [players[3]!.id, players[4]!.id] } } })).toBe(0);
    expect(await db.bossReward.count()).toBe(0);
    const before = await economy(3), stats = await db.playerBossStats.findUniqueOrThrow({ where: { playerId: players[3]!.id } });
    await db.monthlyBoss.update({ where: { id: nativeBossId }, data: { currentHp: 1n } });
    const unrelated = await prepare(8, 'BOSS'), untouched = await captureTargetedPlayerRows(db, [players[8]!.id]);
    const entered = deferred(), release = deferred();
    const restoring = applyRecoveryDomain(db, config, unrelated.request, async backup => { await unrelated.write(backup); entered.resolve(); await release.promise; });
    await Promise.race([entered.promise, restoring.then(() => { throw Error('Backup barrier was not reached'); })]);
    let attackFinished = false;
    const key = randomUUID(), attacking = bosses.attack(await actor(3), nativeBossId, key, false, 'UI').finally(() => { attackFinished = true; });
    try { await new Promise(resolve => setTimeout(resolve, 100)); expect(attackFinished).toBe(false); }
    finally { release.resolve(); }
    const [restoration, hit] = await Promise.all([restoring, attacking]);
    expect(restoration).toMatchObject({ replayed: false }); expect(unrelated.write).toHaveBeenCalledTimes(1);
    expect(hit.result.defeated).toBe(true);
    expect((await bosses.attack(await actor(3), nativeBossId, key, false, 'UI')).operation).toMatchObject({ id: hit.operation.id, alreadyProcessed: true });
    const after = await db.playerBossStats.findUniqueOrThrow({ where: { playerId: players[3]!.id } });
    expect(after.totalDamage).toBe(stats.totalDamage + hit.result.damage); expect(after.totalAttacks).toBe(stats.totalAttacks + 1n);
    expect(after.totalRewarded).toBe(3n); expect(await db.bossReward.count({ where: { bossId: nativeBossId } })).toBe(2);
    expect(await db.bossReward.count({ where: { playerId: players[4]!.id } })).toBe(0);
    expect(await db.bossReward.count({ where: { playerId: players[8]!.id } })).toBe(0);
    expect(await db.playerBossStats.findUniqueOrThrow({ where: { playerId: players[8]!.id } })).toMatchObject({ totalDamage: 0n, totalAttacks: 0n, totalRewarded: 0n });
    await rollbackRecoveryDomain(db, config, unrelated.input, unrelated.backup());
    expect(await captureTargetedPlayerRows(db, [players[8]!.id])).toEqual(untouched);
    const balance = (state: Awaited<ReturnType<typeof economy>>, key: string) => state.balances.find(b => b.resourceKey === key)!.amount;
    const paid = await economy(3), previousMovementIds = new Set(before.movements.map(m => m.id));
    for (const [resourceKey, amount] of [['primogems', 16_000n], ['moras', 500_000n]] as const) {
      const acquired = paid.movements.filter(m => !previousMovementIds.has(m.id) && m.resourceKey === resourceKey);
      expect(acquired.filter(m => m.domainKey === 'monthly-boss').map(m => m.delta)).toEqual([amount]);
      expect(balance(paid, resourceKey) - balance(before, resourceKey)).toBe(acquired.reduce((sum, m) => sum + m.delta, 0n));
    }
    expect(await prepared.apply()).toMatchObject({ replayed: true }); expect(await economy(3)).toEqual(paid);
    await expect(rollbackRecoveryDomain(db, config, prepared.input, prepared.backup())).rejects.toThrow('ROLLBACK_POSTIMAGE_CHANGED');
  });

  it('refuses an archived canonical endpoint without altering its acquired graph', async () => {
    const input = await domainInput(42, 'EVENT');
    await db.player.update({ where: { id: input.playerId }, data: { status: 'ARCHIVED' } });
    const before = await captureTargetedPlayerRows(db, [input.playerId]);
    await expect(planRecoveryDomain(db, config, input)).rejects.toThrow('DEFINITIVE_PLAYER_CONFLICT');
    expect(await captureTargetedPlayerRows(db, [input.playerId])).toEqual(before);
  });
});
