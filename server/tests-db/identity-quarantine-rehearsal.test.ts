import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';
import { createVerifiedTwitchReport, assertIdentityRehearsalReady } from '../src/application/migration/verified-twitch-report.js';
import { validateIdentityQuarantine } from '../src/application/migration/identity-quarantine.js';
import { buildLegacyGlobalPlan } from '../src/application/migration/legacy-global-plan.js';
import { SnapshotPilotService } from '../src/application/migration/snapshot-pilot-service.js';
import { applyLegacyPersonalState, ensureLegacyCharacterAvatars } from '../src/application/migration/legacy-personal-apply.js';
import { applyLegacySocial } from '../src/application/migration/legacy-social-apply.js';
import { applyLegacyGiveaway } from '../src/application/migration/legacy-giveaway-apply.js';

const fixture = isolatedBatchDatabase();
beforeAll(async () => { await fixture.setup({ seedPublicCatalog: true }); await fixture.database.$transaction(tx => ensureLegacyCharacterAvatars(tx)); }, 60_000);
afterAll(() => fixture.cleanup(), 60_000);

describe('explicit identity quarantine in isolated PostgreSQL', () => {
  it('imports only verified identities, reuses a web account and creates no quarantined gameplay or linked fact', async () => {
    const files = Object.fromEntries(snapshotFileNames.map(name => [name, name === 'monthly_events.json' ? '' : '{}']));
    const viewer = { element: 'pyro', xp: 100, primogems: 120, moras: 80,
      particles: Object.fromEntries(['pyro','hydro','cryo','electro','anemo','geo','dendro'].map(key => [key, 0])),
      box: {}, team: [], savedTeams: {}, bank: { moras: 40 }, pity: { pity5: 3, pity4: 2 }, dates: { lastXpDate: '2026-10-04' },
      combat: {}, stats: { totalMessages: 1, countedMessages: 1, level100OverflowRewardsClaimed: 0 },
      guarantee: { guaranteedFeatured5: false }, expedition: { active: false }, favor: null,
      missions: { daily: null }, usedCodes: [], coffre: {}, specialItems: {} };
    files['viewers_data.json'] = JSON.stringify({ verified: viewer, second: viewer, deferred_one: viewer, deferred_two: viewer });
    files['friendships_data.json'] = JSON.stringify({ friendships: { delayed: { users: ['verified', 'deferred_one'] } }, requests: [{ from: 'deferred_two', to: 'second' }] });
    files['giveaway.json'] = JSON.stringify({ status: 'closed', winner: 'deferred_one', participants: ['verified', 'deferred_two'], messageCounts: { verified: 1, deferred_one: 10 } });
    const snapshot = parseStreamerbotSnapshot(files), at = new Date('2026-10-04T20:02:33.000Z');
    const users = ['verified','second'].map((legacyLogin, index) => ({ legacyLogin, twitchUserId: String(123 + index), currentLogin: legacyLogin,
      displayName: `Fixture ${index}`, renamed: false }));
    const report = createVerifiedTwitchReport(snapshot, { users, missing: ['deferred_one','deferred_two'], conflicts: [], duplicates: 0 });
    const approved = validateIdentityQuarantine({ version: 1, decision: 'OWNER_APPROVED_IDENTITY_QUARANTINE', snapshotHash: snapshot.hash,
      createdAt: new Date().toISOString(), legacyLogins: report.missing, reason: 'TWITCH_IDENTITY_NOT_FOUND' }, snapshot.hash, report);
    const existing = randomUUID(), unmatched = randomUUID(), db = fixture.database;
    await db.player.createMany({ data: [{ id: existing, displayName: 'Retained web name' }, { id: unmatched, displayName: 'deferred_one' }] });
    await db.webIdentity.createMany({ data: [{ playerId: existing, provider: 'fixture', providerSubject: existing }, { playerId: unmatched, provider: 'fixture', providerSubject: unmatched }] });
    await db.twitchIdentity.create({ data: { playerId: existing, twitchUserId: '123', login: 'verified' } });
    const plan = buildLegacyGlobalPlan(snapshot, users, [{ id: existing, displayName: 'Retained web name', twitchUserId: '123' },
      { id: unmatched, displayName: 'deferred_one', twitchUserId: null }], new Set(), [{ playerId: existing, twitchUserId: '123' }], undefined, approved);
    assertIdentityRehearsalReady(report, plan.issues.filter(row => row.severity === 'BLOCKER').length, plan.players.length, approved);
    const service = new SnapshotPilotService(db, {} as never, 'private-quarantine-test');
    const mapped = await Promise.all(plan.players.map(player => service.globalPlayerPlan(player.playerId, player.legacyUsername, snapshot, at)));
    await db.$transaction(async tx => {
      const batch = await tx.migrationBatch.create({ data: { snapshotHash: snapshot.hash, mode: 'REHEARSAL', migratorVersion: 'quarantine-test' } });
      for (let index = 0; index < plan.players.length; index++) await applyLegacyPersonalState(tx, plan.players[index]!, mapped[index]!, batch.id, snapshot.hash, at);
      await applyLegacySocial(tx, snapshot, plan, batch.id);
      expect(await applyLegacyGiveaway(tx, snapshot, plan, batch.id)).toMatchObject({ wins: 0, participants: 1, chatStats: 1, rewardsCreated: 0 });
    }, { timeout: 60_000 });
    expect(await db.player.count()).toBe(3); expect(await db.twitchIdentity.count()).toBe(2); expect(await db.migrationRun.count()).toBe(2);
    expect(await db.playerProgression.count()).toBe(2); expect(await db.playerBankAccount.count()).toBe(2);
    expect(await db.playerProgression.count({ where: { playerId: unmatched } })).toBe(0);
    expect(await db.twitchIdentity.count({ where: { playerId: unmatched } })).toBe(0);
    expect(await db.friendship.count()).toBe(0); expect(await db.friendRequest.count()).toBe(0); expect(await db.giveawayWin.count()).toBe(0);
    expect(await db.resourceMovement.count()).toBe(0); expect(await db.businessOperation.count()).toBe(0);
    expect((await db.player.findUniqueOrThrow({ where: { id: existing } })).displayName).toBe('Retained web name');
    expect(plan.players.filter(row => row.mappingMode === 'TWITCH_ONLY')).toHaveLength(1);
    expect(plan.deferredIdentityFacts.byDomain).toEqual({ GIVEAWAY: 3, SOCIAL: 2 });
  }, 120_000);
});
