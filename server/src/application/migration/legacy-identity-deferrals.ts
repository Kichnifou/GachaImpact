import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import { getBusinessDate } from '../../domain/time/business-date.js';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export type DeferredIdentityFact = { domain: string; source: string; path: string; count: number };

/** Source facts deferred by R1041, counted before purge without rewriting the immutable snapshot. */
export function planDeferredIdentityFacts(snapshot: Snapshot, quarantined: ReadonlySet<string>, cutoverAt?: Date, discarded: ReadonlySet<string> = new Set()) {
  const facts: DeferredIdentityFact[] = [];
  const isQuarantined = (name: unknown) => typeof name === 'string' && quarantined.has(normalizeLegacyName(name));
  const isDiscarded = (name: unknown) => typeof name === 'string' && discarded.has(normalizeLegacyName(name));
  const add = (domain: string, source: string, path: string, count: number) => {
    if (!count) return;
    const existing = facts.find(row => row.domain === domain && row.source === source && row.path === path);
    if (existing) existing.count += count; else facts.push({ domain, source, path, count });
  };
  const social = object(snapshot.sources['friendships_data.json']);
  for (const raw of Object.values(object(social.friendships))) {
    const row = object(raw);
    if (Array.isArray(row.users) && !row.users.some(isDiscarded) && row.users.some(isQuarantined)) {
      add('SOCIAL', 'friendships_data.json', 'friendships.*', 1);
      add('SOCIAL', 'friendships_data.json', 'friendships.*.lastHeartSent.*', Object.keys(object(row.lastHeartSent)).length);
    }
  }
  for (const raw of Array.isArray(social.requests) ? social.requests : []) {
    const row = object(raw);
    if (![row.from, row.to].some(isDiscarded) && [row.from, row.to].some(isQuarantined)) add('SOCIAL', 'friendships_data.json', 'requests[]', 1);
  }
  const boss = object(snapshot.sources['monthly_boss.json']);
  for (const raw of [...(Array.isArray(boss.history) ? boss.history : []), boss.currentBoss].filter(Boolean)) {
    const row = object(raw);
    add('BOSS', 'monthly_boss.json', '*.participants.*', Object.keys(object(row.participants)).filter(isQuarantined).length);
    if (isQuarantined(row.finalBlowBy)) add('BOSS', 'monthly_boss.json', '*.finalBlowBy', 1);
  }
  const event = object(snapshot.sources['monthly_events_data.json']);
  add('EVENT', 'monthly_events_data.json', 'participants.*', Object.keys(object(event.participants)).filter(isQuarantined).length);
  for (const buyers of Object.values(object(event.collectionPurchases))) for (const [name, items] of Object.entries(object(buyers)))
    if (isQuarantined(name)) add('EVENT', 'monthly_events_data.json', 'collectionPurchases.*.*[]', Array.isArray(items) ? items.length : 0);
  const day = cutoverAt ? getBusinessDate(cutoverAt) : null;
  const activeEvent = !day || `${event.year}-${String(event.month).padStart(2, '0')}` === day.slice(0, 7);
  if (activeEvent) {
    for (const [date, raw] of Object.entries(object(event.gameB)))
      if ((!day || date === day) && isQuarantined(object(raw).foundBy)) add('EVENT', 'monthly_events_data.json', 'gameB.*', 1);
    for (const [recipient, rows] of Object.entries(object(event.messages))) for (const raw of Array.isArray(rows) ? rows : []) {
      const row = object(raw);
      if (row.read !== true && ![recipient, row.sender].some(isDiscarded) && [recipient, row.sender].some(isQuarantined)) add('EVENT', 'monthly_events_data.json', 'messages.*[]', 1);
    }
  }
  const giveaway = object(snapshot.sources['giveaway.json']);
  for (const field of ['winner', 'previousWinner', 'openedBy', 'closedBy', 'lastParticipant'])
    if (isQuarantined(giveaway[field])) add('GIVEAWAY', 'giveaway.json', field, 1);
  add('GIVEAWAY', 'giveaway.json', 'participants[]', (Array.isArray(giveaway.participants) ? giveaway.participants : []).filter(isQuarantined).length);
  add('GIVEAWAY', 'giveaway.json', 'messageCounts.*', Object.keys(object(giveaway.messageCounts)).filter(isQuarantined).length);
  const bannerVotes = object(snapshot.sources['banner_votes.json']);
  add('BANNER', 'banner_votes.json', 'votes.*', Object.keys(object(bannerVotes.voters ?? bannerVotes.votes)).filter(isQuarantined).length);
  for (const [name, raw] of Object.entries(object(snapshot.sources['viewers_data.json']))) {
    const codes = object(raw).usedCodes;
    if (isQuarantined(name)) add('CODES', 'viewers_data.json', '*.usedCodes[]', Array.isArray(codes) ? codes.length : Object.keys(object(codes)).length);
  }
  for (const [name, raw] of Object.entries(object(object(snapshot.sources['contests_data.json']).dailyLocks))) {
    const row = object(raw);
    if (isQuarantined(name) && row.used === true && (!day || row.date === day)) add('CONTEST', 'contests_data.json', 'dailyLocks.*', 1);
  }
  const byDomain = Object.fromEntries([...new Set(facts.map(row => row.domain))].sort()
    .map(domain => [domain, facts.filter(row => row.domain === domain).reduce((sum, row) => sum + row.count, 0)]));
  return { total: facts.reduce((sum, row) => sum + row.count, 0), byDomain, facts };
}
