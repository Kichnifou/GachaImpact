import { createHash } from 'node:crypto';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import { scanLegacyCoverage } from './legacy-coverage.js';
import type { ResolvedTwitchUser } from './twitch-identity-resolver.js';
import { getBusinessDate } from '../../domain/time/business-date.js';

const elements = new Set(['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro']);
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export type LegacyPlanIssue = { code: string; severity: 'BLOCKER' | 'WARNING' | 'QUARANTINE' | 'INFO'; source: string; path: string; legacyKey?: string };
export type ExistingWebAccount = { id: string; displayName: string; twitchUserId: string | null };
export type PlannedPlayer = { legacyUsername: string; elementKey: string; playerId: string; displayName: string;
  twitchUserId: string; twitchLogin: string; twitchDisplayName: string;
  mappingMode: 'EXISTING_VERIFIED_TWITCH' | 'TWITCH_ONLY'; viewer: Record<string, unknown> };
export type LegacyGlobalPlan = { snapshotHash: string; players: PlannedPlayer[]; unmatchedWebPlayerIds: string[];
  excludedProfiles: number; friendshipCount: number; friendshipExcluded: number; requestCount: number; requestExcluded: number;
  issues: LegacyPlanIssue[]; unknownPaths: number };

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
  existingIdentities: readonly { playerId: string; twitchUserId: string }[] = [], cutoverAt?: Date): LegacyGlobalPlan {
  const coverage = scanLegacyCoverage(snapshot);
  const issues: LegacyPlanIssue[] = coverage.unknown.map(item => ({ code: 'UNKNOWN_SOURCE_PATH', severity: 'BLOCKER', source: item.file, path: item.path }));
  const viewers = record(snapshot.sources['viewers_data.json']);
  const selected = Object.entries(viewers).filter(([, raw]) => elements.has(String(record(raw).element).toLowerCase()));
  const eligible = new Set(selected.map(([login]) => normalizeLegacyName(login)));
  const resolutionByLogin = new Map(resolved.map(user => [normalizeLegacyName(user.legacyLogin), user]));
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
    const viewer = record(raw);
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
    const identity = resolutionByLogin.get(key);
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
      mappingMode: web ? 'EXISTING_VERIFIED_TWITCH' : 'TWITCH_ONLY', viewer });
  }
  const friends = record(snapshot.sources['friendships_data.json']);
  let friendshipCount = 0, friendshipExcluded = 0, requestCount = 0, requestExcluded = 0;
  for (const raw of Object.values(record(friends.friendships))) {
    const pair = record(raw).users;
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(value => typeof value !== 'string')) {
      issues.push({ code: 'FRIENDSHIP_PAIR_INVALID', severity: 'BLOCKER', source: 'friendships_data.json', path: 'friendships.*.users' }); continue;
    }
    if (pair.every(value => eligible.has(normalizeLegacyName(value)))) friendshipCount++; else friendshipExcluded++;
  }
  for (const raw of Array.isArray(friends.requests) ? friends.requests : []) {
    const request = record(raw);
    if (typeof request.from !== 'string' || typeof request.to !== 'string') {
      issues.push({ code: 'FRIEND_REQUEST_INVALID', severity: 'BLOCKER', source: 'friendships_data.json', path: 'requests[]' }); continue;
    }
    if ([request.from, request.to].every(value => eligible.has(normalizeLegacyName(value)))) requestCount++; else requestExcluded++;
  }
  return { snapshotHash: snapshot.hash, players, unmatchedWebPlayerIds: existingWeb.filter(row => !usedWeb.has(row.id)).map(row => row.id),
    excludedProfiles: coverage.excludedProfiles, friendshipCount, friendshipExcluded, requestCount, requestExcluded,
    issues, unknownPaths: coverage.unknown.length };
}
