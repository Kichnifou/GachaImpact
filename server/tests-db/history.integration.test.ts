import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { HistoryService } from '../src/application/history/history-service.js';

const fixture = isolatedBatchDatabase();
const { database } = fixture;
const history = new HistoryService(database, () => new Date('2026-09-25T12:00:00Z'));
let owner: string;
let other: string;
let editionId: string;
let legacyRotationId: string;
beforeAll(async () => {
  await fixture.setup();
  owner = (await database.player.create({ data: { displayName: 'History owner' } })).id;
  other = (await database.player.create({ data: { displayName: 'History other' } })).id;
  legacyRotationId = (await database.bannerRotation.create({ data: { startsAt: new Date('2026-09-01T00:00:00Z'), endsAt: new Date('2026-09-08T00:00:00Z'), status: 'ENDED' } })).id;
  const definition = await database.eventDefinition.create({ data: { externalKey: `history-${randomUUID()}`, displayName: 'Fixture Festival', calendarMonth: 8, currencyKey: `history-${randomUUID()}`, config: {} } });
  editionId = (await database.eventEdition.create({ data: { eventDefinitionId: definition.id, year: 2026, startsAt: new Date('2026-08-01T00:00:00Z'), endsAt: new Date('2026-09-01T00:00:00Z'), status: 'ACTIVE', snapshot: { displayName: 'Festival figé', calendarMonth: 8 } } })).id;
  await database.eventParticipant.createMany({ data: [
    { eventEditionId: editionId, playerId: owner, points: 25, joinedAt: new Date('2026-08-01T01:00:00Z') },
    { eventEditionId: editionId, playerId: other, points: 40, joinedAt: new Date('2026-08-01T02:00:00Z') },
  ] });
  const operation = await database.businessOperation.create({ data: { playerId: owner, operationType: 'event.milestone', sourceChannel: 'UI', status: 'COMPLETED' } });
  await database.eventMilestoneClaim.create({ data: { eventEditionId: editionId, playerId: owner, milestone: 20, operationId: operation.id } });
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);

describe('History read projections on isolated PostgreSQL', () => {
  it('returns legacy banners with an unavailable vote snapshot and makes no writes', async () => {
    const before = await database.bannerRotation.count();
    const result = await history.banners(1);
    expect(result.entries.find(entry => entry.id === legacyRotationId)).toMatchObject({ generationVoteSnapshot: null });
    expect(await database.bannerRotation.count()).toBe(before);
    expect(await database.bannerVote.count()).toBe(0);
  });

  it('projects a completed edition with public ranking and owner-only detail', async () => {
    const before = await database.businessOperation.count();
    const result = await history.events(owner, 1);
    const edition = result.entries.find(entry => entry.id === editionId);
    expect(edition).toMatchObject({ festival: 'Festival figé', month: 8, year: 2026, participantCount: 2, top: [
      { rank: 1, playerId: other, points: 40 }, { rank: 2, playerId: owner, points: 25 },
    ], personal: { rank: 2, points: 25, milestones: [20], collectionAcquired: false } });
    expect((await history.events(other, 1)).entries.find(entry => entry.id === editionId)?.personal).toMatchObject({ rank: 1, points: 40, milestones: [] });
    expect(await database.businessOperation.count()).toBe(before);
  });

  it('keeps an exact personal rank outside the public Top 10', async () => {
    for (let index = 0; index < 11; index++) {
      const player = await database.player.create({ data: { displayName: `History ranked ${index}` } });
      await database.eventParticipant.create({ data: { eventEditionId: editionId, playerId: player.id, points: 100 - index, joinedAt: new Date('2026-08-02T00:00:00Z') } });
    }
    const edition = (await history.events(owner, 1)).entries.find(entry => entry.id === editionId)!;
    expect(edition.participantCount).toBe(13);
    expect(edition.top).toHaveLength(10);
    expect(edition.top.some(entry => entry.playerId === owner)).toBe(false);
    expect(edition.personal).toMatchObject({ rank: 13, points: 25, milestones: [20] });
  });
});
