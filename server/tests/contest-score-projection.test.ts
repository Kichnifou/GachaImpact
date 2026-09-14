import { describe, expect, it } from 'vitest';
import type { Prisma } from '../generated/prisma/client.js';
import { presentLatestScoreChange } from '../src/application/contest/contest-service.js';

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
});
