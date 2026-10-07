import { createHash, randomUUID } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { TwitchPilotService } from '../src/application/twitch/twitch-pilot-service.js';
import { TwitchAccountLink } from '../src/application/twitch/twitch-account-link.js';
import { buildCutoverPurgePlan, applyPrivateCutoverPurge } from '../src/application/migration/legacy-cutover-purge.js';
import { GiftCodeService } from '../src/application/gift-code/gift-code-service.js';
import { PrismaBankingStore } from '../src/infrastructure/database/prisma-banking-store.js';
import { getBusinessDate } from '../src/domain/time/business-date.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const store = new PrismaCurrentPlayerStore(db), provision = new GetOrProvisionCurrentPlayer(store), link = new TwitchAccountLink(db);
const config = { host: 'localhost', port: 3001, frontendOrigin: 'https://private.example', supabase: {}, twitch: {
  clientId: 'private-client', clientSecret: 'fixture-secret', redirectUri: 'https://private.example/callback', pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'], keys: JWTVerifyGetKey, sequence = 0;
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  const pair = await generateKeyPair('RS256'); privateKey = pair.privateKey;
  keys = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: 'private-key' }] });
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);
afterEach(() => vi.restoreAllMocks());
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

async function profiles() {
  const auth = { subject: randomUUID() }, twitchUserId = String(970070000000 + ++sequence);
  // Real Web provisioning and Account reads, not a naked verified() fixture.
  const { player: web, created } = await provision.execute(auth, 'Private fresh Web'); expect(created).toBe(true);
  // The real banking owner initializes the same zero-balance account as maintenance,
  // even without any deposit or interest. Scope this call to the exact private Player.
  const now = new Date(); await new PrismaBankingStore(db).getState(web.id, getBusinessDate(now), now);
  const twitch = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private retained Twitch', twitchIdentity: {
    twitchUserId, login: 'private_retained', displayName: 'Private retained Twitch', firstSeenAt: new Date() } }));
  await db.playerProgression.update({ where: { playerId: twitch.id }, data: { xp: 900n, totalMessages: 100n } });
  await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: twitch.id, resourceKey: 'primogems' } }, data: { amount: 777n } });
  const identity = await db.webIdentity.findUniqueOrThrow({ where: { playerId: web.id } });
  const service = new TwitchPilotService(db, new GetCurrentPlayer(store), config, keys);
  expect((await service.status(auth)).linked).toBeNull(); expect(await service.linkResolution(auth)).toBeNull();
  return { auth, web, twitch, twitchUserId, identity, service };
}
type Profiles = Awaited<ReturnType<typeof profiles>>;
async function start(f: Profiles) {
  const url = new URL((await f.service.start(f.auth)).url);
  return { state: url.searchParams.get('state')!, nonce: url.searchParams.get('nonce')! };
}
async function oauth(f: Profiles, attempt: Awaited<ReturnType<typeof start>> | Awaited<ReturnType<typeof start>>[], badNonce = false) {
  const tokens = new Map<string, string>();
  for (const current of Array.isArray(attempt) ? attempt : [attempt]) tokens.set(current.state,
    await new SignJWT({ sub: f.twitchUserId, nonce: badNonce ? 'Z'.repeat(43) : current.nonce })
      .setProtectedHeader({ alg: 'RS256', kid: 'private-key' }).setIssuer('https://id.twitch.tv/oauth2')
      .setAudience(config.twitch.clientId).setIssuedAt().setExpirationTime('5m').sign(privateKey));
  // URL dispatch supports multiple concurrent real callbacks without ordered fetch mocks.
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => new Response(JSON.stringify(
    String(input).endsWith('/token') ? { access_token: 'private-transient', id_token: tokens.get(new URLSearchParams(String(options?.body)).get('code')!) }
      : String(input).endsWith('/validate') ? { client_id: config.twitch.clientId, user_id: f.twitchUserId, login: 'private_retained', scopes: ['openid'] }
        : { data: [{ id: f.twitchUserId, login: 'private_retained', display_name: 'Private retained Twitch' }] }
  ), { status: 200, headers: { 'content-type': 'application/json' } }));
}
const callback = (f: Profiles, attempt: Awaited<ReturnType<typeof start>>) => f.service.callback({ state: attempt.state, code: attempt.state });
async function comparison(f: Profiles, expired = false) {
  const createdAt = new Date(Date.now() - 120_000);
  return db.twitchLinkResolution.create({ data: { webIdentityId: f.identity.id, webPlayerId: f.web.id, twitchPlayerId: f.twitch.id,
    twitchUserId: f.twitchUserId, login: 'private_retained', createdAt, expiresAt: new Date(Date.now() + (expired ? -60_000 : 60_000)),
    comparedState: { version: 1, revision: randomUUID(), presentation: {}, fingerprints: { web: 'a'.repeat(64), twitch: 'b'.repeat(64) }, safety: {} } } });
}
async function retained(f: Profiles) {
  const tables = ['players','player_progression','player_resource_balances','player_gacha_states','player_economy_stats','player_wheel_stats',
    'player_permanent_mission_states','player_permanent_mission_progress','player_bank_accounts','privacy_settings','twitch_native_targets','twitch_canary_imports','twitch_native_authorities','twitch_native_audit'];
  const rows = await db.$queryRawUnsafe<{ name: string; rows: string }[]>(tables.map(table => {
    const column = table === 'players' ? 'id' : 'player_id';
    const filter = ['twitch_native_authorities','twitch_native_audit'].includes(table) ? '' : ` WHERE ${column}=$1::uuid`;
    return `SELECT '${table}' name,COALESCE(json_agg(row ORDER BY row),'[]'::json)::text rows FROM (SELECT to_jsonb(t)::text row FROM "${fixture.schema}".${table} t${filter}) r`;
  }).join(' UNION ALL '), f.twitch.id);
  return Object.fromEntries(rows.map(row => [row.name, row.rows]));
}
async function recovered(f: Profiles) {
  expect((await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).playerId).toBe(f.twitch.id);
  expect((await provision.execute(f.auth)).player.id).toBe(f.twitch.id);
  expect((await provision.execute(f.auth)).created).toBe(false);
  expect(await f.service.linkResolution(f.auth)).toBeNull();
  expect(await db.playerSession.count({ where: { playerId: f.web.id } })).toBe(0);
}

it('recovers the existing Twitch Player through Web creation, Account, OAuth start and signed callback', async () => {
  const f = await profiles(), before = await retained(f), attempt = await start(f); await oauth(f, attempt);
  await expect(callback(f, attempt)).resolves.toMatchObject({ linked: true, playerId: f.twitch.id, resolutionRequired: false });
  await recovered(f); expect(await retained(f)).toEqual(before);
  expect(await db.player.findUnique({ where: { id: f.web.id } })).toBeNull();
}, 60_000);
it('accepts the maintenance bank date just after the Europe/Paris reset, before UTC midnight', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-07T22:30:00Z'));
  try {
    const f = await profiles(), before = await retained(f), attempt = await start(f); await oauth(f, attempt);
    expect((await db.playerBankAccount.findUniqueOrThrow({ where: { playerId: f.web.id } })).lastInterestDate.toISOString()).toBe('2026-10-08T00:00:00.000Z');
    await expect(callback(f, attempt)).resolves.toMatchObject({ linked: true, playerId: f.twitch.id, resolutionRequired: false });
    await recovered(f); expect(await retained(f)).toEqual(before);
  } finally { vi.useRealTimers(); }
}, 60_000);
it('accepts old valid and expired OAuth attempts, cancels them, and rejects replay after success', async () => {
  const f = await profiles(), old = await start(f), expired = await start(f);
  await db.twitchLinkState.update({ where: { stateHash: hash(expired.state) }, data: { expiresAt: new Date(Date.now()-1000) } });
  const attempt = await start(f); await oauth(f, attempt);
  await expect(callback(f, attempt)).resolves.toMatchObject({ linked: true, playerId: f.twitch.id });
  expect(await db.twitchLinkState.count({ where: { playerId: f.web.id } })).toBe(0);
  const before = await retained(f);
  for (const state of [attempt, old, expired]) await expect(callback(f, state)).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
  await recovered(f); expect(await retained(f)).toEqual(before);
}, 60_000);
it('recovers with expired and unfinished comparisons, retains audit/FKs, and disables every old choice', async () => {
  const f = await profiles(), old = await comparison(f), expired = await comparison(f, true);
  await db.playerSession.create({ data: { playerId: f.web.id, sessionTokenHash: hash(randomUUID()) } });
  const attempt = await start(f); await oauth(f, attempt);
  await expect(callback(f, attempt)).resolves.toMatchObject({ linked: true, playerId: f.twitch.id });
  expect((await db.player.findUniqueOrThrow({ where: { id: f.web.id } })).status).toBe('ARCHIVED');
  for (const record of [old, expired]) {
    const after = await db.twitchLinkResolution.findUniqueOrThrow({ where: { id: record.id } });
    expect(after).toMatchObject({ webPlayerId: f.web.id, twitchPlayerId: f.twitch.id, webIdentityId: f.identity.id, comparedState: record.comparedState, choice: null, completedAt: null });
    expect(after.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
    await expect(link.resolve(f.identity.id, record.id, 'WEB', randomUUID())).rejects.toMatchObject({ code: 'TWITCH_RESOLUTION_EXPIRED' });
  }
  await recovered(f);
}, 60_000);
async function native(f: Profiles) {
  const operator = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private operator' }));
  await db.playerRoleAssignment.create({ data: { playerId: operator.id, role: 'ADMIN', source: 'private-recovery' } });
  await db.twitchNativeTarget.create({ data: { twitchUserId: f.twitchUserId, playerId: f.twitch.id, dataAuthority: 'NATIVE', canary: true, acknowledgement: 'STREAMERBOT_PATH_DISABLED', transferredAt: new Date() } });
  await db.twitchNativeAuthority.upsert({ where: { id: 'twitch-commands' }, create: { id: 'twitch-commands', desiredMode: 'CANARY', revision: 4, operatorPlayerId: operator.id, acknowledgement: 'STREAMERBOT_PATH_DISABLED', acknowledgedAt: new Date() }, update: { desiredMode: 'CANARY', operatorPlayerId: operator.id, acknowledgement: 'STREAMERBOT_PATH_DISABLED', acknowledgedAt: new Date() } });
  await db.twitchCanaryImport.create({ data: { twitchUserId: f.twitchUserId, playerId: f.twitch.id, snapshotHash: 'a'.repeat(64), identityReportHash: 'b'.repeat(64), backupHash: 'c'.repeat(64), importedAt: new Date() } });
  await db.twitchNativeAudit.create({ data: { actorPlayerId: operator.id, twitchUserId: f.twitchUserId, action: 'AUTHORITY_TRANSFERRED', acknowledgement: 'STREAMERBOT_PATH_DISABLED' } });
}
it('distinguishes active native authority from shared relations while leaving Twitch recovery safe', async () => {
  const f = await profiles(); await db.playerProgression.update({ where: { playerId: f.web.id }, data: { xp: 10n } }); await native(f);
  const attempt = await start(f); await oauth(f, attempt);
  expect(await callback(f, attempt)).toMatchObject({ linked: false, resolutionRequired: true });
  const pending = (await f.service.linkResolution(f.auth))!;
  expect(pending.safety.WEB).toEqual({ status: 'OPERATOR_REQUIRED', reason: 'TWITCH_PROGRESSION_NATIVE_AUTHORITY_REQUIRES_OPERATOR' });
  expect(pending.safety.TWITCH).toEqual({ status: 'SAFE', reason: null });
  await expect(link.resolve(f.identity.id, pending.id, 'WEB', pending.revision)).rejects.toMatchObject({ code: 'TWITCH_PROGRESSION_NATIVE_AUTHORITY_REQUIRES_OPERATOR' });
}, 90_000);
it('recovers a previously imported NATIVE/CANARY without disarming, transferring or changing gameplay/provenance', async () => {
  const f = await profiles(); await native(f); await comparison(f); await comparison(f, true); await start(f);
  const before = await retained(f), attempt = await start(f); await oauth(f, attempt);
  await expect(callback(f, attempt)).resolves.toMatchObject({ linked: true, playerId: f.twitch.id });
  await recovered(f); expect(await retained(f)).toEqual(before);
  expect((await f.service.status(f.auth)).linked).toMatchObject({ login: 'private_retained' });
  const result = await provision.execute(f.auth, 'Ignored new name'); expect(result).toMatchObject({ created: false, player: { id: f.twitch.id } });
}, 60_000);
it('retries after an OAuth network failure on the same Web account without recreating either Player', async () => {
  const f = await profiles(), old = await comparison(f), failed = await start(f);
  vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('private-network-failure'));
  await expect(callback(f, failed)).rejects.toThrow('private-network-failure');
  expect((await provision.execute(f.auth)).player.id).toBe(f.web.id);
  const attempt = await start(f); await oauth(f, attempt);
  await expect(callback(f, attempt)).resolves.toMatchObject({ linked: true, playerId: f.twitch.id });
  expect((await db.twitchLinkResolution.findUniqueOrThrow({ where: { id: old.id } })).expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
  await recovered(f);
}, 60_000);
it.each(['same-state','distinct-states'] as const)('allows exactly one concurrent recovery (%s) and rejects an already consumed in-flight source', async kind => {
  const f = await profiles(), first = await start(f), second = kind === 'same-state' ? first : await start(f);
  await oauth(f, [first, second]); const before = await retained(f);
  const results = await Promise.allSettled([callback(f, first), callback(f, second)]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
  const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
  expect(['TWITCH_STATE_INVALID','TWITCH_PROFILE_CHANGED']).toContain(rejected.reason.code);
  await recovered(f); expect(await retained(f)).toEqual(before);
  expect(await db.twitchIdentity.count({ where: { twitchUserId: f.twitchUserId } })).toBe(1);
  // Callback whose state was consumed before the winner committed cannot reattach the old source.
  await expect(link.verified(f.identity.id, f.web.id, f.twitchUserId, 'private_retained', null)).rejects.toMatchObject({ code: 'TWITCH_PROFILE_CHANGED' });
}, 90_000);
it.each(['expired','nonce','other-web','disabled-web'] as const)('rejects invalid %s proof without gameplay or ownership mutation', async bad => {
  const f = await profiles(), other = await profiles(), attempt = await start(f), before = await retained(f);
  if (bad === 'expired') await db.twitchLinkState.update({ where: { stateHash: hash(attempt.state) }, data: { expiresAt: new Date(Date.now()-1000) } });
  if (bad === 'other-web') await db.twitchLinkState.update({ where: { stateHash: hash(attempt.state) }, data: { webIdentityId: other.identity.id } });
  if (bad === 'disabled-web') await db.webIdentity.update({ where: { id: f.identity.id }, data: { state: 'DISABLED' } });
  await oauth(f, attempt, bad === 'nonce');
  await expect(callback(f, attempt)).rejects.toMatchObject({ code: bad === 'expired' ? 'TWITCH_STATE_INVALID' : bad === 'nonce' ? 'TWITCH_NONCE_INVALID' : 'TWITCH_PROFILE_CHANGED' });
  expect((await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).playerId).toBe(f.web.id);
  expect((await db.webIdentity.findUniqueOrThrow({ where: { id: other.identity.id } })).playerId).toBe(other.web.id);
  expect((await db.player.findUniqueOrThrow({ where: { id: f.web.id } })).status).toBe('ACTIVE');
  expect(await retained(f)).toEqual(before); expect(await db.twitchLinkResolution.count({ where: { webIdentityId: f.identity.id } })).toBe(0);
}, 60_000);
it.each(['resources','bank-funds','bank-date','bank-dependent','role','relation','unknown','foreign-state','unbound-state','foreign-comparison','completed-comparison','twitch-side-comparison','technical-column','technical-dependent'] as const)
('protects a null-element Web Player with %s despite valid OAuth', async kind => {
  const f = await profiles(), other = await profiles(), schema = `"${fixture.schema}"`;
  let cleanup = async () => {};
  if (kind === 'resources') await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: f.web.id, resourceKey: 'primogems' } }, data: { amount: 1n } });
  if (kind === 'bank-funds') await db.playerBankAccount.update({ where: { playerId: f.web.id }, data: { balance: 1n } });
  if (kind === 'bank-date') await db.playerBankAccount.update({ where: { playerId: f.web.id }, data: { lastInterestDate: new Date(Date.now()+2*86400_000) } });
  if (kind === 'bank-dependent') {
    await fixture.admin.query(`CREATE TABLE ${schema}.private_bank_child (account_id uuid REFERENCES ${schema}.player_bank_accounts(player_id) ON DELETE CASCADE, body text)`);
    await fixture.admin.query(`INSERT INTO ${schema}.private_bank_child VALUES ($1,'unknown')`, [f.web.id]);
    cleanup = async () => { await fixture.admin.query(`DROP TABLE ${schema}.private_bank_child`); };
  }
  if (kind === 'role') await db.playerRoleAssignment.create({ data: { playerId: f.web.id, role: 'ADMIN', source: 'private' } });
  if (kind === 'relation') { const [playerAId,playerBId] = [f.web.id,other.web.id].sort(); await db.friendship.create({ data: { playerAId: playerAId!, playerBId: playerBId!, becameFriendsAt: new Date() } }); }
  if (kind === 'unknown') {
    await fixture.admin.query(`CREATE TABLE ${schema}.private_unknown (player_id uuid REFERENCES ${schema}.players(id), body text)`);
    await fixture.admin.query(`INSERT INTO ${schema}.private_unknown VALUES ($1,'protected')`, [f.web.id]);
    cleanup = async () => { await fixture.admin.query(`DROP TABLE ${schema}.private_unknown`); };
  }
  if (kind === 'foreign-state' || kind === 'unbound-state') { const attempt = await start(f); await db.twitchLinkState.update({ where: { stateHash: hash(attempt.state) }, data: { webIdentityId: kind === 'foreign-state' ? other.identity.id : null } }); }
  if (kind === 'foreign-comparison') { const r = await comparison(f); await db.twitchLinkResolution.update({ where: { id: r.id }, data: { webIdentityId: other.identity.id } }); }
  if (kind === 'completed-comparison') { const r = await comparison(f); await db.twitchLinkResolution.update({ where: { id: r.id }, data: { choice: 'TWITCH', completedAt: new Date() } }); }
  if (kind === 'twitch-side-comparison') await db.twitchLinkResolution.create({ data: { webIdentityId: other.identity.id, webPlayerId: other.web.id, twitchPlayerId: f.web.id, twitchUserId: f.twitchUserId, login: 'private', comparedState: {}, expiresAt: new Date(Date.now()+60_000) } });
  if (kind === 'technical-column') { await start(f); await fixture.admin.query(`ALTER TABLE ${schema}.twitch_link_states ADD COLUMN unknown_body text DEFAULT 'protected'`); cleanup = async () => { await fixture.admin.query(`ALTER TABLE ${schema}.twitch_link_states DROP COLUMN unknown_body`); }; }
  if (kind === 'technical-dependent') {
    const old = await start(f);
    await fixture.admin.query(`CREATE TABLE ${schema}.private_technical_child (state_hash text REFERENCES ${schema}.twitch_link_states(state_hash) ON DELETE CASCADE)`);
    await fixture.admin.query(`INSERT INTO ${schema}.private_technical_child VALUES ($1)`, [hash(old.state)]);
    cleanup = async () => { await fixture.admin.query(`DROP TABLE ${schema}.private_technical_child`); };
  }
  try {
    const attempt = await start(f); await oauth(f, attempt);
    expect(await callback(f, attempt)).toMatchObject({ linked: false, resolutionRequired: true });
    expect((await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).playerId).toBe(f.web.id);
    expect((await db.player.findUniqueOrThrow({ where: { id: f.web.id } })).status).toBe('ACTIVE');
  } finally { await cleanup(); }
}, 90_000);
it('keeps comparison for two significant progressions and only reconfirms a changed fingerprint', async () => {
  const f = await profiles(); await db.playerProgression.update({ where: { playerId: f.web.id }, data: { xp: 10n } });
  const attempt = await start(f); await oauth(f, attempt); expect(await callback(f, attempt)).toMatchObject({ resolutionRequired: true });
  const old = (await f.service.linkResolution(f.auth))!;
  await db.playerGachaState.update({ where: { playerId: f.web.id }, data: { pity5: 1 } });
  const result = await f.service.resolveLink(f.auth, old.id, 'TWITCH', old.revision);
  expect(result).toMatchObject({ linked: false, resolutionRequired: true });
  expect((await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).playerId).toBe(f.web.id);
}, 90_000);
it('protects a target already owned by another WebIdentity, and links the same Player idempotently', async () => {
  const f = await profiles(); await db.webIdentity.create({ data: { playerId: f.twitch.id, provider: 'supabase', providerSubject: randomUUID() } });
  const attempt = await start(f); await oauth(f, attempt);
  await expect(callback(f, attempt)).rejects.toMatchObject({ code: 'TWITCH_PROFILE_WEB_CONFLICT' });
  expect((await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).playerId).toBe(f.web.id);
  const same = await profiles(), first = await start(same); await oauth(same, first); await callback(same, first);
  const before = await retained(same), repeat = await start(same); await oauth(same, repeat);
  await expect(callback(same, repeat)).resolves.toMatchObject({ linked: true, playerId: same.twitch.id });
  expect(await retained(same)).toEqual(before);
}, 60_000);
it('rolls back cancellation, archive and identity movement atomically on a final failure', async () => {
  const f = await profiles(), old = await comparison(f), prior = await start(f), schema = `"${fixture.schema}"`;
  await fixture.admin.query(`CREATE FUNCTION ${schema}.fail_recovery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private-failure'; END $$`);
  await fixture.admin.query(`CREATE TRIGGER private_fail_recovery BEFORE UPDATE ON ${schema}.players FOR EACH ROW EXECUTE FUNCTION ${schema}.fail_recovery()`);
  try {
    const attempt = await start(f); await oauth(f, attempt); await expect(callback(f, attempt)).rejects.toThrow();
    expect((await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).playerId).toBe(f.web.id);
    expect(await db.twitchLinkResolution.findUniqueOrThrow({ where: { id: old.id } })).toEqual(old);
    expect(await db.twitchLinkState.findUnique({ where: { stateHash: hash(prior.state) } })).not.toBeNull();
    expect((await db.player.findUniqueOrThrow({ where: { id: f.web.id } })).status).toBe('ACTIVE');
  } finally {
    await fixture.admin.query(`DROP TRIGGER private_fail_recovery ON ${schema}.players`); await fixture.admin.query(`DROP FUNCTION ${schema}.fail_recovery()`);
  }
  const attempt = await start(f); await oauth(f, attempt); await expect(callback(f, attempt)).resolves.toMatchObject({ linked: true });
}, 60_000);
it('retains auto-recovery comparison audit and both graphs in the future private purge', async () => {
  const f = await profiles(), old = await comparison(f), attempt = await start(f); await oauth(f, attempt); await callback(f, attempt);
  const before = await db.playerResourceBalance.findMany({ where: { playerId: { in: [f.web.id, f.twitch.id] } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] });
  const plan = await buildCutoverPurgePlan(db, fixture.schema); await db.$transaction(tx => applyPrivateCutoverPurge(tx, plan));
  expect(await db.playerResourceBalance.findMany({ where: { playerId: { in: [f.web.id, f.twitch.id] } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] })).toEqual(before);
  expect((await db.twitchLinkResolution.findUniqueOrThrow({ where: { id: old.id } })).comparedState).toEqual(old.comparedState);
}, 90_000);
async function availability(f: Profiles) {
  const now = new Date(), startsAt = new Date(+now-60_000), endsAt = new Date(+now+60_000);
  await db.giftCode.create({ data: { token: 'PRIVATE_RECOVERY_'+sequence, title: 'Private availability', description: '', type: 'ONE_OFF', status: 'PUBLISHED', publishedAt: now, startsAt, endsAt,
    editions: { create: { editionKey: 'private', startsAt, endsAt } }, rewards: { create: { resourceKey: 'primogems', amount: 8n } } } });
  // The real maintenance owner sends availability notices even to fresh Web accounts.
  // It is scoped to this exact private Player, with no public audience/materialization.
  await new GiftCodeService(new GetCurrentPlayer(store), db, { now: () => now }).reconcileNotificationsForPlayer(f.web.id, now, false);
  return db.notification.findMany({ where: { playerId: f.web.id }, orderBy: { id: 'asc' } });
}
it('recovers with real unclaimed availability notices, keeps them as evidence and protects the archive at future purge', async () => {
  const f = await profiles(), notices = await availability(f), before = await retained(f);
  expect(notices.length).toBeGreaterThan(0); expect(await db.giftCodeClaim.count({ where: { playerId: f.web.id } })).toBe(0);
  const attempt = await start(f); await oauth(f, attempt);
  await expect(callback(f, attempt)).resolves.toMatchObject({ linked: true, playerId: f.twitch.id });
  await recovered(f); expect(await retained(f)).toEqual(before);
  expect((await db.player.findUniqueOrThrow({ where: { id: f.web.id } })).status).toBe('ARCHIVED');
  expect(await db.notification.findMany({ where: { playerId: f.web.id }, orderBy: { id: 'asc' } })).toEqual(notices);
  const proof = await db.twitchLinkResolution.findFirstOrThrow({ where: { webIdentityId: f.identity.id, webPlayerId: f.web.id } });
  expect(proof).toMatchObject({ choice: null, completedAt: null, comparedState: { kind: 'AUTOMATIC_RECOVERY' } });
  expect(proof.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
  await expect(link.resolve(f.identity.id, proof.id, 'WEB', randomUUID())).rejects.toMatchObject({ code: 'TWITCH_RESOLUTION_EXPIRED' });
  const plan = await buildCutoverPurgePlan(db, fixture.schema); await db.$transaction(tx => applyPrivateCutoverPurge(tx, plan));
  expect(await db.notification.findMany({ where: { playerId: f.web.id }, orderBy: { id: 'asc' } })).toEqual(notices);
}, 90_000);
it.each(['unknown-notice','unknown-payload','wrong-owner','bad-reference','claimed-code'] as const)('protects %s notifications or claims from automatic disposal', async bad => {
  const f = await profiles(), notices = await availability(f), notice = notices.find(n => n.payload && typeof n.payload==='object' && !Array.isArray(n.payload) && n.payload.title==='Private availability')!;
  if (bad === 'unknown-notice') await db.notification.update({ where: { id: notice.id }, data: { typeKey: 'UNKNOWN_PROGRESS' } });
  if (bad === 'unknown-payload') await db.notification.update({ where: { id: notice.id }, data: { payload: { ...(notice.payload as object), unknown: 'preserve' } } });
  if (bad === 'wrong-owner') await db.notification.update({ where: { id: notice.id }, data: { deduplicationKey: 'gift-code:'+randomUUID()+':'+notice.actionTargetId } });
  if (bad === 'bad-reference') await db.notification.update({ where: { id: notice.id }, data: { actionTargetId: randomUUID() } });
  if (bad === 'claimed-code') {
    const operation = await db.businessOperation.create({ data: { playerId: f.web.id, operationType: 'gift-code.claim', sourceChannel: 'UI', status: 'COMPLETED', completedAt: new Date() } });
    await db.giftCodeClaim.create({ data: { playerId: f.web.id, giftCodeEditionId: notice.actionTargetId!, sourceChannel: 'UI', operationId: operation.id } });
  }
  const attempt = await start(f); await oauth(f, attempt);
  expect(await callback(f, attempt)).toMatchObject({ linked: false, resolutionRequired: true });
  expect((await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).playerId).toBe(f.web.id);
  expect((await db.player.findUniqueOrThrow({ where: { id: f.web.id } })).status).toBe('ACTIVE');
}, 90_000);
