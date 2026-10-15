import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { PrismaTeamStore } from '../src/infrastructure/database/prisma-team-store.js';
import { permanentMissionCatalog } from '../src/domain/missions/permanent-mission-catalog.js';
import { TwitchAccountLink } from '../src/application/twitch/twitch-account-link.js';
import { canAutomaticallyRecoverWebPlayer, isDisposableWebPlayer } from '../src/application/twitch/twitch-profile-claim.js';

const fixture = isolatedBatchDatabase(), db = fixture.database, link = new TwitchAccountLink(db);
let sequence = 0;
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  await db.permanentMissionDefinition.createMany({ data: permanentMissionCatalog.map(entry => ({ ...entry })), skipDuplicates: true });
}, 180_000);
afterAll(async () => {
  await fixture.cleanup();
  const pool = fixture.poolSnapshot();
  expect(pool.total).toBe(0); expect(pool.idle).toBe(0); expect(pool.waiting).toBe(0); expect(pool.opened).toBe(pool.closed);
}, 60_000);
async function profiles(chosen = true, teams = true) {
  const twitchUserId = String(989000000000 + ++sequence), subject = randomUUID();
  const web = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private Web', webIdentity: { provider: 'supabase', providerSubject: subject } }));
  const twitch = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private Twitch', twitchIdentity: { twitchUserId, login: 'private_original', displayName: 'Private Twitch', firstSeenAt: new Date() } }));
  if (chosen) await db.player.update({ where: { id: web.id }, data: { elementKey: 'pyro' } });
  if (teams) await new PrismaTeamStore(db).getOrProvision(web.id);
  await db.player.update({ where: { id: twitch.id }, data: { elementKey: 'cryo', presentationName: 'Retained Name', presentationNameRevision: 3 } });
  await db.playerProgression.update({ where: { playerId: twitch.id }, data: { xp: 2220n, totalMessages: 99n } });
  await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: twitch.id, resourceKey: 'primogems' } }, data: { amount: 777n } });
  return { web, twitch, twitchUserId, identity: await db.webIdentity.findUniqueOrThrow({ where: { playerId: web.id } }) };
}
const admissible = (f: Awaited<ReturnType<typeof profiles>>) => db.$transaction(tx => canAutomaticallyRecoverWebPlayer(tx, f.web.id, f.twitch.id), { timeout: 30_000 });

it('recovers a chosen zero-XP Web doorway with exact default teams and retains target presentation and gameplay', async () => {
  const f = await profiles();
  const player = await db.player.findUniqueOrThrow({ where: { id: f.twitch.id } });
  const progression = await db.playerProgression.findUniqueOrThrow({ where: { playerId: f.twitch.id } });
  const resources = await db.playerResourceBalance.findMany({ where: { playerId: f.twitch.id }, orderBy: { resourceKey: 'asc' } });
  await db.playerSession.create({ data: { playerId: f.web.id, sessionTokenHash: randomUUID().replaceAll('-', '').repeat(2) } });
  expect(await admissible(f)).toBe(true);
  expect(await link.verified(f.identity.id, f.web.id, f.twitchUserId, 'verified', 'Verified')).toMatchObject({ linked: true, playerId: f.twitch.id, resolutionRequired: false });
  expect(await db.player.findUnique({ where: { id: f.web.id } })).toBeNull();
  expect(await db.player.findUniqueOrThrow({ where: { id: f.twitch.id } })).toEqual(player);
  expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: f.twitch.id } })).toEqual(progression);
  expect(await db.playerResourceBalance.findMany({ where: { playerId: f.twitch.id }, orderBy: { resourceKey: 'asc' } })).toEqual(resources);
  expect(await db.playerSession.count({ where: { playerId: f.web.id } })).toBe(0);
  expect(await db.team.count({ where: { playerId: f.web.id } })).toBe(0);
  expect(await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).toMatchObject({ playerId: f.twitch.id });
  expect(await link.verified(f.identity.id, f.twitch.id, f.twitchUserId, 'verified', 'Verified')).toMatchObject({ linked: true, playerId: f.twitch.id });
  expect(await db.twitchLinkResolution.count({ where: { webIdentityId: f.identity.id } })).toBe(0);
});
it('preserves the old virgin-web recovery of a target without element or level two', async () => {
  const f = await profiles(false, false);
  await db.player.update({ where: { id: f.twitch.id }, data: { elementKey: null } });
  await db.playerProgression.update({ where: { playerId: f.twitch.id }, data: { xp: 0n } });
  expect(await db.$transaction(tx => isDisposableWebPlayer(tx, f.web.id))).toBe(true);
  expect(await link.verified(f.identity.id, f.web.id, f.twitchUserId, 'verified', 'Verified')).toMatchObject({ linked: true, playerId: f.twitch.id });
});
it.each(['no-element', 'level-one'] as const)('keeps comparison for a chosen doorway and a %s target', async kind => {
  const f = await profiles();
  if (kind === 'no-element') await db.player.update({ where: { id: f.twitch.id }, data: { elementKey: null } });
  else await db.playerProgression.update({ where: { playerId: f.twitch.id }, data: { xp: 59n } });
  expect(await admissible(f)).toBe(false);
  expect(await link.verified(f.identity.id, f.web.id, f.twitchUserId, 'verified', 'Verified')).toMatchObject({ linked: false, resolutionRequired: true });
  expect((await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).playerId).toBe(f.web.id);
});
it.each([1n, 30n, 59n, 60n])('protects unexplained positive Web XP %s even below level two', async xp => {
  const f = await profiles();
  await db.playerProgression.update({ where: { playerId: f.web.id }, data: { xp } });
  expect(await admissible(f)).toBe(false);
});
it.each(['resource', 'name', 'name-revision', 'badge', 'named-team', 'partial-teams', 'different-active-team', 'mission-progress'] as const)('protects significant Web state: %s', async kind => {
  const f = await profiles();
  if (kind === 'resource') await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: f.web.id, resourceKey: 'primogems' } }, data: { amount: 1n } });
  if (kind === 'name') await db.player.update({ where: { id: f.web.id }, data: { presentationName: 'Chosen Name' } });
  if (kind === 'name-revision') await db.player.update({ where: { id: f.web.id }, data: { presentationNameRevision: 1 } });
  if (kind === 'badge') {
    const badge = await db.cosmeticDefinition.create({ data: { externalKey: 'badge:star-solid', type: 'BADGE', displayName: '\u2726', unlockRule: { kind: 'FREE_BADGE' } } });
    await db.player.update({ where: { id: f.web.id }, data: { equippedBadgeCosmeticId: badge.id } });
  }
  const first = await db.team.findFirstOrThrow({ where: { playerId: f.web.id, displayPosition: 1 } });
  if (kind === 'named-team') await db.team.update({ where: { id: first.id }, data: { name: 'Custom' } });
  if (kind === 'partial-teams') await db.team.delete({ where: { id: first.id } });
  if (kind === 'different-active-team') await db.team.update({ where: { id: first.id }, data: { isActive: false } });
  if (kind === 'mission-progress') {
    const mission = await db.playerPermanentMissionProgress.findFirstOrThrow({ where: { playerId: f.web.id } });
    await db.playerPermanentMissionProgress.update({ where: { playerId_definitionId: { playerId: f.web.id, definitionId: mission.definitionId } }, data: { progress: 1n } });
  }
  expect(await admissible(f)).toBe(false);
});
it('fails closed for an unknown direct Player reference', async () => {
  const f = await profiles();
  await db.$executeRawUnsafe('CREATE TABLE private_future_player_ref (id uuid PRIMARY KEY, owner_id uuid REFERENCES players(id) ON DELETE CASCADE)');
  try {
    await db.$executeRaw`INSERT INTO private_future_player_ref VALUES (${randomUUID()}::uuid, ${f.web.id}::uuid)`;
    expect(await admissible(f)).toBe(false);
  } finally { await db.$executeRawUnsafe('DROP TABLE private_future_player_ref'); }
});
it.each(['character', 'item', 'friendship', 'role', 'operation', 'preference', 'gacha-history', 'bank'] as const)('protects an existing significant graph domain: %s', async kind => {
  const f = await profiles(), playerId = f.web.id;
  if (kind === 'character') {
    const character = await db.character.findFirstOrThrow();
    await db.playerCharacter.create({ data: { playerId, characterId: character.id, firstObtainedAt: new Date() } });
  }
  if (kind === 'item') {
    const item = await db.itemDefinition.findFirstOrThrow();
    await db.playerItem.create({ data: { playerId, itemId: item.id, quantity: 1n } });
  }
  if (kind === 'friendship') {
    const [playerAId, playerBId] = [playerId, f.twitch.id].sort();
    await db.friendship.create({ data: { playerAId: playerAId!, playerBId: playerBId! } });
  }
  if (kind === 'role') await db.playerRoleAssignment.create({ data: { playerId, role: 'TESTER', source: 'private-significant' } });
  if (kind === 'operation') await db.businessOperation.create({ data: { playerId, sourceChannel: 'UI', operationType: 'private-significant', status: 'COMPLETED' } });
  if (kind === 'preference') await db.playerPreference.create({ data: { playerId, preferenceKey: 'private_custom', value: {} } });
  if (kind === 'gacha-history') await db.playerGachaState.update({ where: { playerId }, data: { totalPulls: 1n } });
  if (kind === 'bank') await db.playerBankAccount.create({ data: { playerId, balance: 1n, lastInterestDate: new Date('2026-10-01') } });
  expect(await admissible(f)).toBe(false);
  expect(await db.player.findUnique({ where: { id: playerId } })).not.toBeNull();
});
it('fails closed for a new Player FK on a known table even without source-owned rows', async () => {
  const f = await profiles(), third = await profiles();
  await db.$executeRawUnsafe('ALTER TABLE player_sessions ADD COLUMN future_other_player_id uuid REFERENCES players(id) ON DELETE CASCADE');
  try {
    const session = await db.playerSession.create({ data: { playerId: third.web.id, sessionTokenHash: randomUUID().replaceAll('-', '').repeat(2) } });
    await db.$executeRaw`UPDATE player_sessions SET future_other_player_id=${f.web.id}::uuid WHERE id=${session.id}::uuid`;
    expect(await admissible(f)).toBe(false);
    expect(await db.playerSession.findUnique({ where: { id: session.id } })).not.toBeNull();
  } finally { await db.$executeRawUnsafe('ALTER TABLE player_sessions DROP COLUMN future_other_player_id'); }
});
it('fails closed for an unknown descendant of disposable session bookkeeping', async () => {
  const f = await profiles();
  const session = await db.playerSession.create({ data: { playerId: f.web.id, sessionTokenHash: randomUUID().replaceAll('-', '').repeat(2) } });
  await db.$executeRawUnsafe('CREATE TABLE private_future_session_ref (id uuid PRIMARY KEY, session_id uuid REFERENCES player_sessions(id) ON DELETE CASCADE)');
  try {
    await db.$executeRaw`INSERT INTO private_future_session_ref VALUES (${randomUUID()}::uuid, ${session.id}::uuid)`;
    expect(await admissible(f)).toBe(false);
    expect(await db.playerSession.findUnique({ where: { id: session.id } })).not.toBeNull();
  } finally { await db.$executeRawUnsafe('DROP TABLE private_future_session_ref'); }
});
it('serializes duplicate callbacks and only replays against the retained authenticated Player', async () => {
  const f = await profiles();
  const results = await Promise.allSettled([1, 2].map(() => link.verified(f.identity.id, f.web.id, f.twitchUserId, 'verified', 'Verified')));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  expect(await db.webIdentity.count({ where: { playerId: f.twitch.id } })).toBe(1);
  expect(await db.twitchIdentity.count({ where: { twitchUserId: f.twitchUserId } })).toBe(1);
  expect(await link.verified(f.identity.id, f.twitch.id, f.twitchUserId, 'verified', 'Verified')).toMatchObject({ linked: true, playerId: f.twitch.id });
});
it('routes customized Web presentation to comparison without copying it onto the retained Twitch profile', async () => {
  const f = await profiles();
  await db.player.update({ where: { id: f.web.id }, data: { presentationName: 'Web Identity', presentationNameRevision: 1 } });
  expect(await link.verified(f.identity.id, f.web.id, f.twitchUserId, 'verified', 'Verified')).toMatchObject({ linked: false, resolutionRequired: true });
  expect(await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).toMatchObject({ playerId: f.web.id });
  expect(await db.player.findUniqueOrThrow({ where: { id: f.twitch.id } })).toMatchObject({ presentationName: 'Retained Name', presentationNameRevision: 3 });
  expect(await db.player.findUniqueOrThrow({ where: { id: f.web.id } })).toMatchObject({ status: 'ACTIVE', presentationName: 'Web Identity' });
});
it('rolls back source cleanup and identity movement when a later operation fails', async () => {
  const f = await profiles();
  const session = await db.playerSession.create({ data: { playerId: f.web.id, sessionTokenHash: randomUUID().replaceAll('-', '').repeat(2) } });
  await db.$executeRawUnsafe("CREATE FUNCTION private_recovery_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private rollback proof'; END $$");
  await db.$executeRawUnsafe('CREATE TRIGGER private_recovery_failure BEFORE UPDATE ON web_identities FOR EACH ROW EXECUTE FUNCTION private_recovery_failure()');
  try {
    await expect(link.verified(f.identity.id, f.web.id, f.twitchUserId, 'verified', 'Verified')).rejects.toThrow();
    expect(await db.player.findUniqueOrThrow({ where: { id: f.web.id } })).toMatchObject({ status: 'ACTIVE', elementKey: 'pyro' });
    expect(await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).toMatchObject({ playerId: f.web.id });
    expect(await db.playerSession.findUnique({ where: { id: session.id } })).not.toBeNull();
    expect(await db.team.count({ where: { playerId: f.web.id } })).toBe(10);
    expect(await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: f.twitchUserId } })).toMatchObject({ login: 'private_original' });
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER private_recovery_failure ON web_identities');
    await db.$executeRawUnsafe('DROP FUNCTION private_recovery_failure()');
  }
});
