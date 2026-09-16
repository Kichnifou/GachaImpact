import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { EventService } from '../src/application/event/event-service.js';
import { loadConfig } from '../src/config/environment.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Event Ranking DB tests.');
const database = createDatabase(config.databaseUrl);
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
    expect(await database.businessOperation.count({ where: { playerId: { in: ids } } })).toBe(0);
    expect(await database.resourceMovement.count({ where: { playerId: { in: ids } } })).toBe(0);
  }, 90_000);
});
