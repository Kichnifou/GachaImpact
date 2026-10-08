import { getBusinessDayStartAt } from '../../domain/time/business-date.js';
import { communityRecord as object } from './legacy-community-proof.js';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';

type Catalog = { id: string; externalKey: string; rarity: number; isActive?: boolean };
export function legacyBannerEvidence(snapshot: Snapshot, catalog: readonly Catalog[]) {
  const source = object(snapshot.sources['genshin_characters.json']), votes = object(snapshot.sources['banner_votes.json']);
  const week = source.lastBannerUpdate;
  if (typeof week !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(week) || new Date(`${week}T12:00:00Z`).getUTCDay() !== 1
    || new Date(`${week}T12:00:00Z`).toISOString().slice(0, 10) !== week || votes.weekId !== week)
    throw Error('LEGACY_BANNER_PERIOD_INVALID');
  const next = new Date(`${week}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 7);
  const byExternal = new Map(catalog.map(row => [row.externalKey, row]));
  if (!Array.isArray(source.characters)) throw Error('LEGACY_BANNER_SOURCE_INVALID');
  const featured = source.characters.map(object).filter(row => row.bannerFeatured === true).map(row => {
    if (!Number.isSafeInteger(row.id)) throw Error('LEGACY_BANNER_CHARACTER_INVALID');
    const character = byExternal.get(`legacy:${row.id}`);
    if (!character || character.isActive === false || ![4, 5].includes(character.rarity)) throw Error('LEGACY_BANNER_CHARACTER_INVALID');
    return character;
  });
  if (new Set(featured.map(row => row.id)).size !== 10 || featured.filter(row => row.rarity === 5).length !== 4 || featured.filter(row => row.rarity === 4).length !== 6)
    throw Error('LEGACY_BANNER_COMPOSITION_INVALID');
  const individual = Object.entries(object(votes.voters)).map(([name, choice]) => {
    if (!Number.isSafeInteger(choice)) throw Error('LEGACY_VOTE_CHOICE_INVALID');
    const character = byExternal.get(`legacy:${choice}`);
    if (!character || character.rarity !== 5) throw Error('LEGACY_VOTE_CHOICE_INVALID');
    return { legacyKey: normalizeLegacyName(name), characterId: character.id, externalKey: character.externalKey,
      eligible: character.isActive !== false && !featured.some(row => row.id === character.id && row.rarity === 5) };
  });
  if (new Set(individual.map(row => row.legacyKey)).size !== individual.length) throw Error('LEGACY_VOTE_IDENTITY_AMBIGUOUS');
  const derived: Record<string, number> = {};
  for (const row of individual) derived[row.externalKey.slice(7)] = (derived[row.externalKey.slice(7)] ?? 0) + 1;
  const aggregates = object(votes.votes);
  if (Object.entries(aggregates).some(([key, raw]) => {
    const count = object(raw).votes;
    return !Number.isSafeInteger(count) || Number(count) < 0 || (derived[key] ?? 0) !== count;
  }) || Object.entries(derived).some(([key, count]) => object(aggregates[key]).votes !== count)) throw Error('LEGACY_VOTE_AGGREGATES_CONFLICT');
  return { week, startsAt: getBusinessDayStartAt(week), endsAt: getBusinessDayStartAt(next.toISOString().slice(0, 10)), featured, individual };
}

/** No authority is selected merely because the two sources share a week. */
export function planLegacyBannerReconciliation(evidence: ReturnType<typeof legacyBannerEvidence>, rotations: readonly {
  id: string; startsAt: Date; endsAt: Date; status: string; supersededAt?: Date | null; featuredCharacters: readonly { characterId: string; rarity: number }[];
}[], now: Date) {
  const official = rotations.filter(row => !row.supersededAt);
  const overlap = official.filter(row => row.startsAt < evidence.endsAt && row.endsAt > evidence.startsAt);
  const signature = (rows: readonly { characterId: string; rarity: number }[]) => rows.map(row => `${row.rarity}:${row.characterId}`).sort().join('|');
  const expected = signature(evidence.featured.map(row => ({ characterId: row.id, rarity: row.rarity })));
  if (overlap.length > 1 || overlap.some(row => row.startsAt.getTime() !== evidence.startsAt.getTime() || row.endsAt.getTime() !== evidence.endsAt.getTime()
    || signature(row.featuredCharacters) !== expected)) return { status: 'CONFLICT' as const, reason: 'BANNER_AUTHORITY_CONFLICT', rotationId: null };
  if (now >= evidence.endsAt) return { status: 'HISTORICAL' as const, reason: 'LEGACY_WEEK_EXPIRED', rotationId: overlap[0]?.id ?? null };
  if (now < evidence.startsAt) return { status: 'CONFLICT' as const, reason: 'LEGACY_WEEK_IN_FUTURE', rotationId: null };
  if (overlap[0] && overlap[0].status !== 'ACTIVE' || official.some(row => row.status === 'ACTIVE' && row.id !== overlap[0]?.id))
    return { status: 'CONFLICT' as const, reason: 'BANNER_ACTIVE_STATE_CONFLICT', rotationId: null };
  return { status: overlap.length ? 'REUSE' as const : 'CREATE' as const, reason: null, rotationId: overlap[0]?.id ?? null };
}

/** Exactly one verified Player per source voter; unapproved population entries have no destination. */
export function planLegacyVotes(evidence: ReturnType<typeof legacyBannerEvidence>, bindings: readonly { legacyUsername: string; playerId: string }[], existing: readonly { playerId: string; characterId: string; sourceChannel: string }[]) {
  const byName = new Map(bindings.map(row => [normalizeLegacyName(row.legacyUsername), row.playerId]));
  if (byName.size !== bindings.length || new Set(bindings.map(row => row.playerId)).size !== bindings.length) throw Error('LEGACY_VOTE_BINDING_AMBIGUOUS');
  return evidence.individual.map(row => {
    const playerId = byName.get(row.legacyKey);
    if (!playerId) return { ...row, playerId: null, action: 'EXCLUDED' as const };
    const previous = existing.filter(vote => vote.playerId === playerId);
    if (previous.length > 1 || previous[0] && previous[0].characterId !== row.characterId) return { ...row, playerId, action: 'CONFLICT' as const };
    if (previous.length) return { ...row, playerId, action: 'RETAIN' as const };
    return { ...row, playerId, action: row.eligible ? 'IMPORT' as const : 'INELIGIBLE' as const };
  });
}
