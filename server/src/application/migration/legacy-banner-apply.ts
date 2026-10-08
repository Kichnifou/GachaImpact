import { Prisma, SourceChannel } from '../../../generated/prisma/client.js';
import { getBusinessDate, getBusinessDayStartAt } from '../../domain/time/business-date.js';
import type { Snapshot } from './streamerbot-snapshot.js';
import type { LegacyGlobalPlan } from './legacy-global-plan.js';
import { legacyBannerEvidence, planLegacyBannerReconciliation, planLegacyVotes } from './legacy-banner-reconciliation.js';

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
  const catalog = await tx.character.findMany({ select: { id: true, externalKey: true, rarity: true, isActive: true } });
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
  const evidence = legacyBannerEvidence(snapshot, catalog);
  const reconciliation = planLegacyBannerReconciliation(evidence, await tx.bannerRotation.findMany({ include: { featuredCharacters: true } }), cutoverAt);
  if (reconciliation.status === 'CONFLICT' || reconciliation.status === 'HISTORICAL') throw Error(`LEGACY_${reconciliation.reason}`);
  const votePlan = planLegacyVotes(evidence, plan.players, reconciliation.rotationId
    ? await tx.bannerVote.findMany({ where: { bannerRotationId: reconciliation.rotationId } }) : []);
  if (votePlan.some(row => row.action === 'CONFLICT' || row.action === 'INELIGIBLE')) throw Error('LEGACY_VOTE_NATIVE_CONFLICT');
  const rotation = reconciliation.rotationId ? { id: reconciliation.rotationId } : await tx.bannerRotation.create({ data: { startsAt: getBusinessDayStartAt(started), endsAt: getBusinessDayStartAt(nextMonday(started)), status: 'ACTIVE',
    generationVoteSnapshot: Prisma.JsonNull, legacyProvenance: { source: 'genshin_characters.json', batchId,
      startDayKnown: true, selectionSourceKnown: false, previousBannerFeaturedIds: source.previousBannerFeaturedIds ?? [] },
    featuredCharacters: { create: rows } } });
  let importedVotes = 0, excludedVotes = 0, retainedVotes = 0;
  for (const vote of votePlan) {
    if (vote.action === 'EXCLUDED') { excludedVotes++; continue; }
    if (vote.action === 'RETAIN') { retainedVotes++; continue; }
    await tx.bannerVote.create({ data: { bannerRotationId: rotation.id, playerId: vote.playerId!, characterId: vote.characterId,
      sourceChannel: SourceChannel.MIGRATION, votedAt: null,
      legacyProvenance: { source: 'banner_votes.json.voters', batchId, snapshotHash: snapshot.hash, weekId: evidence.week, voteTimeKnown: false } } });
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
  return { rotations: reconciliation.rotationId ? 0 : 1, featuredFive: slots[5], featuredFour: slots[4], votes: importedVotes, excludedVotes, retainedVotes,
    validTargets, invalidTargets, inventedVoteTimes: 0 };
}
