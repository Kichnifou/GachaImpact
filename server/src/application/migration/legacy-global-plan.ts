import { createHash } from 'node:crypto';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import { scanLegacyCoverage } from './legacy-coverage.js';
import type { ResolvedTwitchUser } from './twitch-identity-resolver.js';
import { getBusinessDate } from '../../domain/time/business-date.js';
import { isValidLegacyXpDate } from './legacy-xp-provenance.js';
import { validateIdentityQuarantine, type IdentityQuarantine } from './identity-quarantine.js';
import { planDeferredIdentityFacts } from './legacy-identity-deferrals.js';
import type { OwnerApprovedPopulation } from './owner-approved-population.js';

const elements = new Set(['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro']);
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export type LegacyPlanIssue = { code: string; severity: 'BLOCKER' | 'WARNING' | 'QUARANTINE' | 'INFO'; source: string; path: string; legacyKey?: string; domain?: string; factCount?: number };
export type ExistingWebAccount = { id: string; displayName: string; twitchUserId: string | null; hasWebAccount?: boolean; dataAuthority?: string; canaryImported?: boolean };
export type PlannedPlayer = { legacyUsername: string; elementKey: string; playerId: string; displayName: string;
  twitchUserId: string; twitchLogin: string; twitchDisplayName: string;
  mappingMode: 'EXISTING_VERIFIED_TWITCH' | 'TWITCH_ONLY'; viewer: Record<string, unknown>; personalImport?: boolean };
export type LegacyGlobalPlan = { snapshotHash: string; players: PlannedPlayer[]; unmatchedWebPlayerIds: string[];
  excludedProfiles: number; friendshipCount: number; friendshipExcluded: number; requestCount: number; requestExcluded: number;
  issues: LegacyPlanIssue[]; unknownPaths: number; identityQuarantined: string[];
  deferredIdentityFacts: ReturnType<typeof planDeferredIdentityFacts>; sourceProfiles: number; approvedPopulation: number; quarantined: number; ownerDiscarded: number;
  ownerDiscardedKeys: string[]; discardedSharedFacts: ReturnType<typeof planDeferredIdentityFacts>; unapprovedAdditional: number };

export const isIdentityQuarantined = (plan: LegacyGlobalPlan, login: unknown) => typeof login === 'string'
  && (plan.identityQuarantined ?? []).includes(normalizeLegacyName(login));
export const isOwnerDiscarded = (plan: LegacyGlobalPlan, login: unknown) => typeof login === 'string'
  && (plan.ownerDiscardedKeys ?? []).includes(normalizeLegacyName(login));

/** Shared CLI DTO intentionally omits individual logins, IDs, source values and message text. */
export function identityQuarantineSummary(plan: LegacyGlobalPlan) {
  return { identityQuarantined: plan.identityQuarantined.length,
    deferredIdentityFacts: { total: plan.deferredIdentityFacts.total, byDomain: plan.deferredIdentityFacts.byDomain } };
}

function deterministicUuid(snapshotHash: string, login: string): string {
  const hex = createHash('sha256').update(`legacy-rehearsal-player\0${snapshotHash}\0${login}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Stable-looking numeric IDs are isolated fixtures, never evidence of a Twitch account. */
export function fixtureTwitchResolution(snapshot: Snapshot): ResolvedTwitchUser[] {
  const viewers = record(snapshot.sources['viewers_data.json']);
  const users = Object.entries(viewers).filter(([, raw]) => elements.has(String(record(raw).element).toLowerCase()));
  return users.map(([login], index) => ({ legacyLogin: login, twitchUserId: String(900_000_000_000 + index),
    currentLogin: normalizeLegacyName(login), displayName: login, renamed: false }));
}

export function buildLegacyGlobalPlan(snapshot: Snapshot, resolved: readonly ResolvedTwitchUser[],
  existingWeb: readonly ExistingWebAccount[], catalogKeys: ReadonlySet<string>,
  existingIdentities: readonly { playerId: string; twitchUserId: string }[] = [], cutoverAt?: Date,
  quarantine?: IdentityQuarantine, finalPopulation?: OwnerApprovedPopulation): LegacyGlobalPlan {
  const coverage = scanLegacyCoverage(snapshot);
  const issues: LegacyPlanIssue[] = coverage.unknown.map(item => ({ code: 'UNKNOWN_SOURCE_PATH', severity: 'BLOCKER', source: item.file, path: item.path }));
  const viewers = record(snapshot.sources['viewers_data.json']);
  const approved = finalPopulation ? new Map(finalPopulation.approved.map(row => [normalizeLegacyName(row.legacyLogin), row.twitchUserId])) : null;
  const selected = Object.entries(viewers).filter(([name, raw]) => approved ? approved.has(normalizeLegacyName(name)) : elements.has(String(record(raw).element).toLowerCase()));
  const eligible = new Set(selected.map(([login]) => normalizeLegacyName(login)));
  const resolutionByLogin = new Map(resolved.map(user => [normalizeLegacyName(user.legacyLogin), user]));
  if (quarantine && !finalPopulation) validateIdentityQuarantine(quarantine, snapshot.hash, { snapshotHash: snapshot.hash,
    missing: selected.filter(([login]) => !resolutionByLogin.has(normalizeLegacyName(login))).map(([login]) => login), conflicts: [], duplicates: 0 });
  const quarantined = new Set((finalPopulation?.quarantined ?? quarantine?.legacyLogins ?? []).map(normalizeLegacyName));
  if (finalPopulation) for (const login of quarantined) issues.push({ code: 'TWITCH_IDENTITY_QUARANTINED', severity: 'QUARANTINE',
    source: 'viewers_data.json', path: '*.username', legacyKey: login, domain: 'IDENTITY' });
  const discarded = new Set(finalPopulation?.historicalProof.ownerDiscardedLogins.map(normalizeLegacyName) ?? []);
  if (approved && (selected.length !== 43 || selected.some(([name, raw]) => !elements.has(String(record(raw).element).toLowerCase())
    || resolutionByLogin.get(normalizeLegacyName(name))?.twitchUserId !== approved.get(normalizeLegacyName(name)))))
    issues.push({ code: 'FINAL_POPULATION_REVALIDATION_FAILED', severity: 'BLOCKER', source: 'viewers_data.json', path: '*' });
  const existingByTwitch = new Map(existingWeb.filter(row => row.twitchUserId).map(row => [row.twitchUserId!, row]));
  const linkedByTwitch = new Map(existingIdentities.map(row => [row.twitchUserId, row.playerId]));
  if (existingByTwitch.size !== existingWeb.filter(row => row.twitchUserId).length || linkedByTwitch.size !== existingIdentities.length)
    issues.push({ code: 'TWITCH_EXISTING_IDENTITY_DUPLICATE', severity: 'BLOCKER', source: 'twitch_identities', path: 'twitch_user_id' });
  if (cutoverAt) {
    const currentContest = record(record(snapshot.sources['contests_data.json']).currentContest);
    if (currentContest.status !== 'none') issues.push({ code: 'CONTEST_ACTIVE_AT_CUTOVER', severity: 'BLOCKER', source: 'contests_data.json', path: 'currentContest.status' });
    const banner = record(snapshot.sources['genshin_characters.json']), votes = record(snapshot.sources['banner_votes.json']);
    const day = getBusinessDate(cutoverAt), d = new Date(`${day}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
    const week = d.toISOString().slice(0, 10);
    if (banner.lastBannerUpdate !== week || votes.weekId !== week)
      issues.push({ code: 'BANNER_WEEK_MISMATCH', severity: 'BLOCKER', source: 'banner_votes.json', path: 'weekId' });
  }
  const seenIds = new Set<string>();
  const usedWeb = new Set<string>();
  const players: PlannedPlayer[] = [];
  for (const [login, raw] of selected) {
    const key = normalizeLegacyName(login);
    if (quarantined.has(key)) {
      issues.push({ code: 'TWITCH_IDENTITY_QUARANTINED', severity: 'QUARANTINE', source: 'viewers_data.json',
        path: '*.username', legacyKey: login, domain: 'IDENTITY' });
      continue;
    }
    const viewer = record(raw);
    const identity = resolutionByLogin.get(key);
    const existing = identity ? existingByTwitch.get(identity.twitchUserId) : undefined;
    if (identity && seenIds.has(identity.twitchUserId)) {
      issues.push({ code: 'TWITCH_IDENTITY_DUPLICATE', severity: 'BLOCKER', source: 'viewers_data.json', path: '*.username' }); continue;
    }
    if (identity && linkedByTwitch.has(identity.twitchUserId) && linkedByTwitch.get(identity.twitchUserId) !== existing?.id) {
      issues.push({ code: 'TWITCH_EXISTING_IDENTITY_CONFLICT', severity: 'BLOCKER', source: 'twitch_identities', path: 'twitch_user_id' }); continue;
    }
    const preserveNative = existing?.dataAuthority === 'NATIVE';
    if (existing?.dataAuthority === 'MIGRATION_PENDING') {
      issues.push({ code: 'PLAYER_MIGRATION_PENDING', severity: 'BLOCKER', source: 'twitch_native_targets', path: 'data_authority' }); continue;
    }
    if (preserveNative) {
      if (!existing.canaryImported) {
        issues.push({ code: 'NATIVE_CANARY_PROVENANCE_REQUIRED', severity: 'BLOCKER', source: 'twitch_canary_imports', path: 'status' }); continue;
      }
      usedWeb.add(existing.id);
      seenIds.add(identity!.twitchUserId);
      players.push({ legacyUsername: login, elementKey: String(viewer.element).toLowerCase(), playerId: existing.id, displayName: existing.displayName,
        twitchUserId: identity!.twitchUserId, twitchLogin: identity!.currentLogin, twitchDisplayName: identity!.displayName,
        mappingMode: 'EXISTING_VERIFIED_TWITCH', viewer: {}, personalImport: false });
      continue;
    }
    if (!isValidLegacyXpDate(record(viewer.dates).lastXpDate))
      issues.push({ code: 'LEGACY_XP_DATE_INVALID', severity: 'BLOCKER', source: 'viewers_data.json',
        path: '*.dates.lastXpDate', legacyKey: login });
    const box = record(viewer.box);
    for (const [characterKey, rawCharacter] of Object.entries(box)) {
      if (!catalogKeys.has(`legacy:${characterKey}`)) issues.push({ code: 'CHARACTER_CATALOG_GAP', severity: 'BLOCKER', source: 'viewers_data.json', path: '*.box.*', legacyKey: login });
      const entry = record(rawCharacter);
      if (entry.constellation === 6 && typeof entry.copies === 'number' && entry.copies < 7)
        issues.push({ code: 'BOX_C6_COPIES_REPAIRED', severity: 'WARNING', source: 'viewers_data.json', path: '*.box.*.copies', legacyKey: login });
    }
    const c6 = record(snapshot.sources['c6_characters.json']);
    const specialized = Object.entries(c6).filter(([name]) => normalizeLegacyName(name) === key);
    if (specialized.length > 1) issues.push({ code: 'C6_OWNER_AMBIGUOUS', severity: 'BLOCKER', source: 'c6_characters.json', path: '*.characters', legacyKey: login });
    for (const characterKey of Object.keys(record(record(specialized[0]?.[1]).characters))) {
      const possession = record(box[characterKey]);
      if (possession.constellation !== 6) issues.push({ code: 'C6_SPECIALIZED_QUARANTINED', severity: 'QUARANTINE', source: 'c6_characters.json', path: '*.characters.*', legacyKey: login });
    }
    if (!identity) { issues.push({ code: 'TWITCH_IDENTITY_UNRESOLVED', severity: 'BLOCKER', source: 'viewers_data.json', path: '*.username', legacyKey: login }); continue; }
    if (!/^[0-9]+$/.test(identity.twitchUserId) || seenIds.has(identity.twitchUserId)) {
      issues.push({ code: 'TWITCH_IDENTITY_DUPLICATE', severity: 'BLOCKER', source: 'viewers_data.json', path: '*.username', legacyKey: login }); continue;
    }
    seenIds.add(identity.twitchUserId);
    const web = existingByTwitch.get(identity.twitchUserId);
    const linkedPlayerId = linkedByTwitch.get(identity.twitchUserId);
    if (linkedPlayerId && (!web || linkedPlayerId !== web.id)) {
      issues.push({ code: 'TWITCH_EXISTING_IDENTITY_CONFLICT', severity: 'BLOCKER', source: 'twitch_identities', path: 'twitch_user_id', legacyKey: login }); continue;
    }
    if (web && usedWeb.has(web.id)) { issues.push({ code: 'TWITCH_EXISTING_CONFLICT', severity: 'BLOCKER', source: 'viewers_data.json', path: '*.username', legacyKey: login }); continue; }
    if (web) usedWeb.add(web.id);
    players.push({ legacyUsername: login, elementKey: String(viewer.element).toLowerCase(),
      playerId: web?.id ?? deterministicUuid(snapshot.hash, key), displayName: web?.displayName ?? identity.displayName,
      twitchUserId: identity.twitchUserId, twitchLogin: identity.currentLogin, twitchDisplayName: identity.displayName,
      mappingMode: web ? 'EXISTING_VERIFIED_TWITCH' : 'TWITCH_ONLY', viewer, personalImport: true });
  }
  const friends = record(snapshot.sources['friendships_data.json']);
  let friendshipCount = 0, friendshipExcluded = 0, requestCount = 0, requestExcluded = 0;
  for (const raw of Object.values(record(friends.friendships))) {
    const pair = record(raw).users;
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(value => typeof value !== 'string')) {
      issues.push({ code: 'FRIENDSHIP_PAIR_INVALID', severity: 'BLOCKER', source: 'friendships_data.json', path: 'friendships.*.users' }); continue;
    }
    if (pair.some(value => discarded.has(normalizeLegacyName(value)))) { friendshipExcluded++; continue; }
    if (pair.some(value => quarantined.has(normalizeLegacyName(value)))) continue;
    if (pair.every(value => eligible.has(normalizeLegacyName(value)))) friendshipCount++; else friendshipExcluded++;
  }
  for (const raw of Array.isArray(friends.requests) ? friends.requests : []) {
    const request = record(raw);
    if (typeof request.from !== 'string' || typeof request.to !== 'string') {
      issues.push({ code: 'FRIEND_REQUEST_INVALID', severity: 'BLOCKER', source: 'friendships_data.json', path: 'requests[]' }); continue;
    }
    if ([request.from, request.to].some(value => discarded.has(normalizeLegacyName(value)))) { requestExcluded++; continue; }
    if ([request.from, request.to].some(value => quarantined.has(normalizeLegacyName(value)))) continue;
    if ([request.from, request.to].every(value => eligible.has(normalizeLegacyName(value)))) requestCount++; else requestExcluded++;
  }
  const deferredIdentityFacts = planDeferredIdentityFacts(snapshot, quarantined, cutoverAt, discarded);
  const discardedSharedFacts = planDeferredIdentityFacts(snapshot, discarded, cutoverAt);
  if (discarded.size) issues.push({ code: 'OWNER_DISCARDED_LEGACY_PROFILE', severity: 'INFO', source: 'viewers_data.json', path: '*', factCount: discarded.size });
  for (const fact of deferredIdentityFacts.facts) issues.push({ code: 'DEFERRED_IDENTITY_QUARANTINE', severity: 'QUARANTINE',
    source: fact.source, path: fact.path, domain: fact.domain, factCount: fact.count });
  return { snapshotHash: snapshot.hash, players, unmatchedWebPlayerIds: existingWeb.filter(row => row.hasWebAccount !== false && !usedWeb.has(row.id)).map(row => row.id),
    excludedProfiles: finalPopulation ? Object.keys(viewers).length - selected.length - quarantined.size : coverage.excludedProfiles,
    sourceProfiles: Object.keys(viewers).length, approvedPopulation: selected.length, quarantined: quarantined.size,
    ownerDiscarded: finalPopulation ? discarded.size : coverage.excludedProfiles,
    friendshipCount, friendshipExcluded, requestCount, requestExcluded,
    issues, unknownPaths: coverage.unknown.length, identityQuarantined: [...quarantined], deferredIdentityFacts,
    ownerDiscardedKeys: [...discarded], discardedSharedFacts,
    unapprovedAdditional: finalPopulation ? Object.keys(viewers).filter(name => !approved!.has(normalizeLegacyName(name)) && !quarantined.has(normalizeLegacyName(name)) && !discarded.has(normalizeLegacyName(name))).length : 0 };
}
