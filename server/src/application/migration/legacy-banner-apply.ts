import { Prisma, SourceChannel } from '../../../generated/prisma/client.js';
import { getBusinessDate, getBusinessDayStartAt } from '../../domain/time/business-date.js';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import type { LegacyGlobalPlan } from './legacy-global-plan.js';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function monday(date: string): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}
function nextMonday(date: string): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

export async function applyLegacyBanner(tx: Prisma.TransactionClient, snapshot: Snapshot, plan: LegacyGlobalPlan, batchId: string, cutoverAt: Date) {
  const source = object(snapshot.sources['genshin_characters.json']), votes = object(snapshot.sources['banner_votes.json']);
  const started = source.lastBannerUpdate;
  if (typeof started !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(started) || monday(started) !== started) throw new Error('Legacy banner start day is invalid.');
  const cutoverWeek = monday(getBusinessDate(cutoverAt));
  if (started !== cutoverWeek || votes.weekId !== cutoverWeek) throw new Error('Legacy banner/vote week does not match cutover week.');
  const rawCharacters = source.characters;
  if (!Array.isArray(rawCharacters)) throw new Error('Legacy banner characters are missing.');
  const featured = rawCharacters.map(object).filter(row => row.bannerFeatured === true);
  const catalog = await tx.character.findMany({ select: { id: true, externalKey: true, rarity: true } });
  const byExternal = new Map(catalog.map(row => [row.externalKey, row]));
  const slots = { 4: 0, 5: 0 };
  const rows = featured.map(row => {
    if (!Number.isSafeInteger(row.id)) throw new Error('Invalid featured character ID.');
    const character = byExternal.get(`legacy:${row.id}`);
    if (!character || (character.rarity !== 4 && character.rarity !== 5)) throw new Error('Legacy featured character is missing from the V1 catalog.');
    const rarity = character.rarity as 4 | 5;
    slots[rarity]++;
    return { characterId: character.id, rarity, slot: slots[rarity], selectionSource: 'LEGACY_UNKNOWN' as const };
  });
  if (slots[5] !== 4 || slots[4] !== 6) throw new Error('Legacy banner must have four 5-star and six 4-star characters.');
  const rotation = await tx.bannerRotation.create({ data: { startsAt: getBusinessDayStartAt(started), endsAt: getBusinessDayStartAt(nextMonday(started)), status: 'ACTIVE',
    generationVoteSnapshot: Prisma.JsonNull, legacyProvenance: { source: 'genshin_characters.json', batchId,
      startDayKnown: true, selectionSourceKnown: false, previousBannerFeaturedIds: source.previousBannerFeaturedIds ?? [] },
    featuredCharacters: { create: rows } } });
  const byName = new Map(plan.players.map(player => [normalizeLegacyName(player.legacyUsername), player.playerId]));
  let importedVotes = 0, excludedVotes = 0;
  for (const [username, rawChoice] of Object.entries(object(votes.voters))) {
    const playerId = byName.get(normalizeLegacyName(username));
    if (!playerId) { excludedVotes++; continue; }
    if (plan.players.some(player => player.playerId === playerId && player.personalImport === false)) continue;
    if (!Number.isSafeInteger(rawChoice)) throw new Error('Invalid legacy vote choice.');
    const character = byExternal.get(`legacy:${rawChoice}`);
    if (!character || character.rarity !== 5) throw new Error('Legacy vote choice is missing from the 5-star catalog.');
    await tx.bannerVote.create({ data: { bannerRotationId: rotation.id, playerId, characterId: character.id,
      sourceChannel: SourceChannel.MIGRATION, votedAt: null,
      legacyProvenance: { source: 'banner_votes.json.voters', batchId, voteTimeKnown: false } } });
    importedVotes++;
  }
  const fiveStars = new Set(rows.filter(row => row.rarity === 5).map(row => row.characterId));
  let validTargets = 0, invalidTargets = 0;
  for (const player of plan.players) {
    if (player.personalImport === false) continue;
    const rawTarget = player.viewer.selectedBannerCharacterId;
    if (rawTarget == null) continue;
    const target = byExternal.get(`legacy:${rawTarget}`);
    if (!target || !fiveStars.has(target.id)) {
      invalidTargets++;
      await tx.migrationIssue.create({ data: { batchId, sourceName: 'viewers_data.json', path: '*.selectedBannerCharacterId',
        legacyKey: player.legacyUsername, playerId: player.playerId, domain: 'BANNER', severity: 'INFO',
        issueCode: 'LEGACY_BANNER_TARGET_INVALID', description: 'Selected target is not a 5-star character on the imported banner.',
        resolution: 'Target cleared; pity, guarantee and Capture retained.' } });
      continue;
    }
    await tx.playerGachaState.update({ where: { playerId: player.playerId }, data: { selectedBannerCharacterId: target.id } });
    validTargets++;
  }
  return { rotations: 1, featuredFive: slots[5], featuredFour: slots[4], votes: importedVotes, excludedVotes,
    validTargets, invalidTargets, inventedVoteTimes: 0 };
}
