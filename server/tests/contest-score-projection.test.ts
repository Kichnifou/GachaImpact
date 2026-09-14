import { describe, expect, it } from 'vitest';
import type { Prisma } from '../generated/prisma/client.js';
import { presentLatestScoreChange, presentRecentScoreChanges, recentScoreEventQuery } from '../src/application/contest/contest-service.js';

function event(type: string, payload: Record<string, unknown>, targetSlot: number | null = null) {
  return { id: `${type}-event`, type, payload: payload as Prisma.JsonObject, targetSlot, createdAt: new Date('2026-09-14T12:00:00.000Z') };
}

describe('Contest latest score projection', () => {
  it('projects a human Risk worth zero points from its event instead of a score delta', () => {
    expect(presentLatestScoreChange(event('TURN_PLAYED', { slot: 1, points: 0 }))).toEqual({
      eventId: 'TURN_PLAYED-event', slot: 1, points: 0, kind: 'TURN_PLAYED', createdAt: '2026-09-14T12:00:00.000Z',
    });
  });

  it('projects bot and automatic turns from their participant slots', () => {
    expect(presentLatestScoreChange(event('BOT_TURN_PLAYED', { slot: 3, points: 1 }))?.slot).toBe(3);
    expect(presentLatestScoreChange(event('TURN_AUTO_BASIC', { slot: 2, points: 4 }))?.kind).toBe('TURN_AUTO_BASIC');
  });

  it('projects support points on the target slot', () => {
    expect(presentLatestScoreChange(event('SUPPORT_PLAYED', { targetSlot: 2, points: 3 }, 2))).toMatchObject({
      slot: 2, points: 3, kind: 'SUPPORT_PLAYED',
    });
  });

  it('ignores unrelated or malformed events', () => {
    expect(presentLatestScoreChange(event('SUPPORT_SELECTED', { slot: 2, points: 3 }))).toBeNull();
    expect(presentLatestScoreChange(event('TURN_PLAYED', { slot: 2 }))).toBeNull();
  });

  it('projects the bounded database window in chronological order while preserving slots and zero points', () => {
    const newestFirst = [
      { ...event('SUPPORT_PLAYED', { targetSlot: 3, points: 2 }, 3), id: 'support', createdAt: new Date('2026-09-14T12:00:03.000Z') },
      { ...event('TURN_PLAYED', { slot: 2, points: 0 }), id: 'zero', createdAt: new Date('2026-09-14T12:00:02.000Z') },
      { ...event('BOT_TURN_PLAYED', { slot: 1, points: 1 }), id: 'bot', createdAt: new Date('2026-09-14T12:00:01.000Z') },
    ];
    expect(presentRecentScoreChanges(newestFirst)).toEqual([
      expect.objectContaining({ eventId: 'bot', slot: 1, points: 1 }),
      expect.objectContaining({ eventId: 'zero', slot: 2, points: 0 }),
      expect.objectContaining({ eventId: 'support', slot: 3, points: 2 }),
    ]);
  });

  it('requests no more than eight score-only events with a minimal newest-first select', () => {
    expect(recentScoreEventQuery('contest-id')).toEqual({
      where: { contestId: 'contest-id', type: { in: ['TURN_PLAYED', 'BOT_TURN_PLAYED', 'TURN_AUTO_BASIC', 'SUPPORT_PLAYED'] } },
      select: { id: true, type: true, payload: true, targetSlot: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 8,
    });
    const nineEvents = Array.from({ length: 9 }, (_, index) => ({ ...event('TURN_PLAYED', { slot: 1, points: index }), id: String(index) }));
    expect(presentRecentScoreChanges(nineEvents)).toHaveLength(8);
  });
});
