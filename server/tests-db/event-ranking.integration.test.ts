import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { EventService } from '../src/application/event/event-service.js';
import { loadConfig } from '../src/config/environment.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Event Ranking DB tests.');
const isolated = isolatedBatchDatabase();
const database = isolated.database;
beforeAll(() => isolated.setup({ seedPublicCatalog: true }), 60_000);
afterAll(() => isolated.cleanup(), 60_000);
const ids: string[] = [];
const editions: string[] = [];

afterEach(async () => {
  if (ids.length) await database.eventParticipant.deleteMany({ where: { playerId: { in: ids } } });
  if (editions.length) await database.eventEdition.deleteMany({ where: { id: { in: editions }, participants: { none: {} } } });
  if (ids.length) await database.player.deleteMany({ where: { id: { in: ids } } });
  ids.length = 0;
  editions.length = 0;
});
afterAll(async () => database.$disconnect());

describe('active Event ranking', () => {
  it.each([0, 1, 5, 6, 10, 11, 26])('paginates %i participants with bounded reads, stable ties and clamped pages', async (size) => {
    const now = new Date('2627-09-15T12:00:00.000Z');
    const viewerId = randomUUID();
    const service = new EventService({ execute: async () => ({ id: viewerId }) } as never, database, { now: () => now }, { nextInt: () => 0 });
    const { edition } = await service.resolveCurrentEdition(database, now);
    editions.push(edition.id);
    const participants = Array.from({ length: size }, () => randomUUID()).sort();
    const archived = randomUUID();
    ids.push(viewerId, archived, ...participants);
    await database.player.createMany({ data: ids.map(id => ({ id, displayName: 'Ranking fixture', status: id === archived ? 'ARCHIVED' : 'ACTIVE' })) });
    await database.eventParticipant.createMany({ data: [...participants, archived].map(playerId => ({ eventEditionId: edition.id, playerId, points: playerId === archived ? 100 : 20, joinedAt: new Date('2627-09-02T12:00:00Z') })) });
    const seen: string[] = [];
    const pageCount = Math.max(1, Math.ceil(size / 5));
    for (let page = 1; page <= pageCount; page++) {
      const result = await service.getRankingPage({ subject: 'ranking-page-fixture' }, edition.id, page);
      expect(result).toMatchObject({ editionId: edition.id, page, pageSize: 5, pageCount, total: size, self: null });
      expect(result.entries.length).toBeLessThanOrEqual(5);
      expect(result.entries.map(row => row.rank)).toEqual(Array.from({ length: result.entries.length }, (_, index) => (page - 1) * 5 + index + 1));
      seen.push(...result.entries.map(row => row.playerId));
    }
    expect(seen).toEqual(participants);
    expect((await service.getRankingPage({ subject: 'ranking-page-fixture' }, edition.id, 999)).page).toBe(pageCount);
    if (size) {
      const ownService = new EventService({ execute: async () => ({ id: participants[size - 1] }) } as never, database, { now: () => now }, { nextInt: () => 0 });
      expect((await ownService.getRankingPage({ subject: 'ranking-page-self' }, edition.id, 1)).self).toEqual({ rank: size, points: 20 });
    }
    await expect(service.getRankingPage({ subject: 'ranking-page-fixture' }, randomUUID(), 1)).rejects.toMatchObject({ code: 'EVENT_EDITION_CLOSED' });
    const nextMonth = new EventService({ execute: async () => ({ id: viewerId }) } as never, database, { now: () => new Date('2627-10-01T12:00:00Z') }, { nextInt: () => 0 });
    await expect(nextMonth.getRankingPage({ subject: 'ranking-page-fixture' }, edition.id, 1)).rejects.toMatchObject({ code: 'EVENT_EDITION_CLOSED' });
    expect(await database.businessOperation.count({ where: { playerId: { in: ids } } })).toBe(0);
    expect(await database.resourceMovement.count({ where: { playerId: { in: ids } } })).toBe(0);
  }, 90_000);

  it('returns a public top ten ordered by points, join time and player ID without payouts', async () => {
    const now = new Date('2626-09-15T12:00:00.000Z');
    const contextService = new EventService({ execute: async () => ({ id: ids[11] }) } as never, database, { now: () => now }, { nextInt: () => 0 });
    const context = await contextService.resolveCurrentEdition(database, now);
    editions.push(context.edition.id);
    const participantIds = Array.from({ length: 11 }, () => randomUUID());
    ids.push(...participantIds, randomUUID());
    await database.player.createMany({ data: ids.map((id, index) => ({ id, displayName: index === 0 ? 'PseudonymeTrèsLong' : `Ranking ${index}` })) });
    const joinedAt = new Date('2626-09-02T12:00:00.000Z');
    await database.eventParticipant.createMany({ data: participantIds.map((playerId, index) => ({ eventEditionId: context.edition.id, playerId, points: index < 2 ? 20 : 20 - index, joinedAt })) });
    const result = await contextService.getRanking({ subject: 'ranking-nonparticipant' });
    expect(result.editionId).toBe(context.edition.id);
    expect(result.entries).toHaveLength(10);
    expect(result.entries.map(({ rank }) => rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.entries.map(({ points }) => points)).toEqual([20, 20, 18, 17, 16, 15, 14, 13, 12, 11]);
    expect(result.entries.slice(0, 2).map(({ playerId }) => playerId)).toEqual(participantIds.slice(0, 2).sort());
    expect(result.entries.some(({ playerId }) => playerId === participantIds[10])).toBe(false);
    expect(result.entries.some(({ playerId }) => playerId === ids[11])).toBe(false);
    expect(result.entries.every((entry) => Object.keys(entry).sort().join(',') === 'displayName,playerId,points,rank')).toBe(true);
    expect(result.self).toBeNull();
    await database.eventParticipant.create({ data: { eventEditionId: context.edition.id, playerId: ids[11]!, points: 11, joinedAt: null, legacyProvenance: { fixture: 'unknown legacy join date' } } });
    const legacyRanking = await contextService.getRanking({ subject: 'ranking-legacy' });
    expect(legacyRanking.self).toEqual({ rank: 11, points: 11 });
    const lastPage = await contextService.getRankingPage({ subject: 'ranking-legacy' }, context.edition.id, 3);
    expect(lastPage.self).toEqual({ rank: 11, points: 11 });
    expect(lastPage.entries[0]).toEqual({ playerId: ids[11], displayName: 'Ranking 11', points: 11, rank: 11 });
    expect(lastPage.entries[1]).toMatchObject({ playerId: participantIds[10], points: 10, rank: 12 });
    expect(legacyRanking.entries.map(entry => entry.playerId)).toEqual(result.entries.map(entry => entry.playerId));
    expect(await database.businessOperation.count({ where: { playerId: { in: ids } } })).toBe(0);
    expect(await database.resourceMovement.count({ where: { playerId: { in: ids } } })).toBe(0);
  }, 90_000);
});
