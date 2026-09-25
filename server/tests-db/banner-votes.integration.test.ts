import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { BannerVoteService } from '../src/application/gacha/banner-vote-service.js';
import { PrismaGachaStore } from '../src/infrastructure/database/prisma-gacha-store.js';
import { selectBannerFeatured } from '../src/domain/gacha/gacha.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';

const fixture = isolatedBatchDatabase();
const { database, admin } = fixture;
let now = new Date('2026-09-19T12:00:00Z');
const getPlayer = { execute: async (identity: { subject: string }) => ({ id: identity.subject }) } as GetCurrentPlayer;
const votes = new BannerVoteService(getPlayer, database, { now: () => now });
const store = new PrismaGachaStore(database);
const select: Parameters<typeof store.ensureRotation>[2] = (catalog, previous, weights) => selectBannerFeatured(catalog, previous, weights, { nextInt: () => 0 });
let rotationId: string;
let candidateIds: string[];
let featuredId: string;
let fourId: string;
beforeAll(async () => {
  await fixture.setup();
  const element = (await admin.query("SELECT * FROM public.elements WHERE key='pyro'")).rows[0];
  await database.element.create({ data: { key: element.key, displayName: element.display_name, displayOrder: element.display_order } });
  for (const rarity of [5, 4]) for (let i = 0; i < 14; i++) await database.character.create({ data: { externalKey: `vote-${rarity}-${i}`, name: `Fixture ${rarity} ${i}`, rarity, elementKey: 'pyro' } });
  const banner = await store.ensureRotation(new Date('2026-09-13T22:00:00Z'), new Date('2026-09-20T22:00:00Z'), select);
  rotationId = banner.id;
  expect((await database.bannerRotation.findUniqueOrThrow({ where: { id: banner.id } })).generationVoteSnapshot).toMatchObject({ sourceRotationId: null, selectionSource: 'RANDOM_FALLBACK' });
  featuredId = banner.featuredFiveStars[0]!.id;
  fourId = banner.featuredFourStars[0]!.id;
  candidateIds = (await votes.getCurrent(await player())).candidates.map(c => c.characterId);
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);
async function player() { return { subject: (await database.player.create({ data: { displayName: `Vote ${randomUUID().slice(0, 8)}` } })).id }; }

describe('Banner votes isolated PostgreSQL', () => {
  it('enforces active five-star eligibility, permanent choice, safe replay and midweek imports', async () => {
    const identity = await player();
    for (const characterId of [featuredId, fourId, randomUUID()]) await expect(votes.vote(identity, characterId, rotationId)).rejects.toMatchObject({ code: 'BANNER_VOTE_INELIGIBLE' });
    const inactive = await database.character.create({ data: { externalKey: randomUUID(), name: 'Inactive', rarity: 5, elementKey: 'pyro', isActive: false } });
    await expect(votes.vote(identity, inactive.id, rotationId)).rejects.toMatchObject({ code: 'BANNER_VOTE_INELIGIBLE' });
    const before = await votes.getCurrent(identity);
    await database.character.update({ where: { id: inactive.id }, data: { isActive: true } });
    const updated = await votes.getCurrent(identity);
    expect(updated.catalogVersion).not.toBe(before.catalogVersion);
    expect(updated.candidates.some(c => c.characterId === inactive.id)).toBe(true);
    const result = await votes.vote(identity, inactive.id, rotationId);
    expect(result).toMatchObject({ canVote: false, ownVote: { characterId: inactive.id }, alreadyProcessed: false });
    expect((await votes.vote(identity, inactive.id, rotationId)).alreadyProcessed).toBe(true);
    await expect(votes.vote(identity, candidateIds[0]!, rotationId)).rejects.toMatchObject({ code: 'BANNER_VOTE_USED' });
    expect(await database.bannerVote.findFirst({ where: { playerId: identity.subject } })).toMatchObject({ sourceChannel: 'UI' });
    expect(await database.resourceMovement.count()).toBe(0);
  }, 30_000);

  it('serializes same-choice/different-choice races and derives exact public counts', async () => {
    const same = await player();
    const replay = await Promise.all([votes.vote(same, candidateIds[0]!, rotationId), votes.vote(same, candidateIds[0]!, rotationId)]);
    expect(replay.filter(r => !r.alreadyProcessed)).toHaveLength(1);
    expect(await database.bannerVote.count({ where: { playerId: same.subject } })).toBe(1);
    const different = await player();
    const race = await Promise.allSettled([votes.vote(different, candidateIds[0]!, rotationId), votes.vote(different, candidateIds[1]!, rotationId)]);
    expect(race.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(race.find(r => r.status === 'rejected')).toMatchObject({ reason: { code: 'BANNER_VOTE_USED' } });
    const first = await player(); const second = await player();
    await Promise.all([votes.vote(first, candidateIds[2]!, rotationId), votes.vote(second, candidateIds[2]!, rotationId)]);
    expect((await votes.getCurrent(first)).candidates.find(c => c.characterId === candidateIds[2])?.voteCount).toBe(2);
  }, 60_000);

  it('freezes expired votes, preserves them on failed rotation, consumes them on successful retry and clears old targets', async () => {
    const identity = await player();
    await database.playerGachaState.create({ data: { playerId: identity.subject, selectedBannerCharacterId: featuredId } });
    const rows = await database.bannerVote.findMany({ orderBy: { id: 'asc' } });
    const excluded = await database.character.create({ data: { externalKey: randomUUID(), name: 'Still inactive', rarity: 5, elementKey: 'pyro', isActive: false } });
    now = new Date('2026-09-20T22:00:00Z');
    expect((await votes.getCurrent(identity)).canVote).toBe(false);
    await expect(votes.vote(identity, candidateIds[0]!, rotationId)).rejects.toMatchObject({ code: 'BANNER_VOTE_CLOSED' });
    const fourStars = await database.character.findMany({ where: { rarity: 4 } });
    await database.character.updateMany({ where: { rarity: 4 }, data: { isActive: false } });
    const end = new Date('2026-09-27T22:00:00Z');
    await expect(store.ensureRotation(now, end, select)).rejects.toThrow('valid weekly banner');
    expect(await database.bannerRotation.findUnique({ where: { id: rotationId } })).toMatchObject({ status: 'ACTIVE' });
    expect(await database.bannerVote.findMany({ orderBy: { id: 'asc' } })).toEqual(rows);
    await database.character.updateMany({ where: { id: { in: fourStars.map(c => c.id) } }, data: { isActive: true } });
    const next = await store.ensureRotation(now, end, (catalog, previous, weights) => {
      expect(weights.reduce((sum, row) => sum + row.votes, 0)).toBe(rows.length);
      const weightedIds = new Set(weights.map(row => row.characterId));
      // Keep voted candidates out of the first three random slots.
      return selectBannerFeatured([...catalog].sort((a, b) => Number(weightedIds.has(a.id)) - Number(weightedIds.has(b.id))), previous, weights, { nextInt: () => 0 });
    });
    const snapshot = (await database.bannerRotation.findUniqueOrThrow({ where: { id: next.id } })).generationVoteSnapshot as { sourceRotationId: string; selectionSource: string; selectedCharacterId: string; candidates: { characterId: string; voteCount: number }[] };
    expect(snapshot.sourceRotationId).toBe(rotationId);
    expect(snapshot.selectionSource).toBe('COMMUNITY_VOTE');
    expect(snapshot.selectedCharacterId).toBe((await database.bannerFeaturedCharacter.findFirstOrThrow({ where: { bannerRotationId: next.id, rarity: 5, slot: 4 } })).characterId);
    expect(snapshot.candidates.find(row => row.characterId === candidateIds[2])).toMatchObject({ voteCount: 2 });
    expect(snapshot.candidates.some(row => row.voteCount === 0)).toBe(true);
    expect(snapshot.candidates.some(row => row.characterId === featuredId)).toBe(false);
    expect(snapshot.candidates.some(row => row.characterId === excluded.id)).toBe(false);
    const imported = await database.character.findFirstOrThrow({ where: { name: 'Inactive' } });
    expect(snapshot.candidates.some(row => row.characterId === imported.id)).toBe(true);
    const retried = await store.ensureRotation(now, end, select);
    expect(retried.id).toBe(next.id);
    expect((await database.bannerRotation.findUniqueOrThrow({ where: { id: next.id } })).generationVoteSnapshot).toEqual(snapshot);
    const concurrent = await Promise.all([store.ensureRotation(now, end, select), store.ensureRotation(now, end, select)]);
    expect(concurrent.map(row => row.id)).toEqual([next.id, next.id]);
    expect(await database.bannerRotation.count({ where: { startsAt: now } })).toBe(1);
    expect(await database.bannerFeaturedCharacter.count({ where: { bannerRotationId: next.id, selectionSource: 'COMMUNITY_VOTE' } })).toBe(1);
    expect(next.featuredFiveStars.some(c => c.id === featuredId)).toBe(false);
    expect(next.featuredFourStars.some(c => c.id === fourId)).toBe(false);
    expect(await database.bannerVote.findMany({ orderBy: { id: 'asc' } })).toEqual(rows);
    expect((await database.playerGachaState.findUniqueOrThrow({ where: { playerId: identity.subject } })).selectedBannerCharacterId).toBeNull();
    expect((await votes.getCurrent(identity))).toMatchObject({ bannerRotationId: next.id, ownVote: null, canVote: true });
    expect(await votes.vote({ subject: rows[0]!.playerId }, rows[0]!.characterId, rotationId)).toMatchObject({ alreadyProcessed: true, bannerRotationId: next.id, ownVote: null });
    await expect(votes.vote(identity, candidateIds[0]!, rotationId)).rejects.toMatchObject({ code: 'BANNER_VOTE_CLOSED' });
  }, 60_000);
});
