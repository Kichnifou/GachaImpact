import { afterEach, describe, expect, it, vi } from 'vitest';
import { eventDrawPosition, eventDrawTotal, eventDrawWinner } from '../src/domain/event/monthly-draw.js';
import { resolveCurrentEventPeriod, type EventService } from '../src/application/event/event-service.js';
import { EventMonthlyDrawScheduler } from '../src/application/event/event-monthly-draw-service.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { eventMessageParts } from '../src/application/event/event-message-delivery.js';

afterEach(() => vi.useRealTimers());
describe('Event weighted draw exact tickets', () => {
  const population = [{ playerId: 'A', points: '1' }, { playerId: 'B', points: '10' }, { playerId: 'C', points: '25' }];
  it.each([[0n, 'A'], [1n, 'B'], [10n, 'B'], [11n, 'C'], [35n, 'C']] as const)('maps boundary %s to %s', (ticket, winner) => expect(eventDrawWinner(population, ticket)).toBe(winner));
  it('has exactly the requested intervals without rounding', () => {
    expect(eventDrawTotal(population)).toBe(36n);
    expect(Array.from({ length: 36 }, (_, i) => eventDrawWinner(population, BigInt(i))).reduce<Record<string, number>>((counts, id) => ({ ...counts, [id]: (counts[id] ?? 0) + 1 }), {})).toEqual({ A: 1, B: 10, C: 25 });
  });
  it('supports quantities far beyond Number and bigint database bounds', () => {
    const huge = 10n ** 60n, entries = [{ playerId: 'A', points: huge.toString() }, { playerId: 'B', points: '1' }];
    expect(eventDrawTotal(entries)).toBe(huge + 1n);
    expect(eventDrawWinner(entries, huge)).toBe('B');
    expect(eventDrawWinner(entries, huge - 1n)).toBe('A');
    const position = eventDrawPosition('ab'.repeat(32), huge + 1n);
    expect(position >= 0n && position <= huge).toBe(true);
    expect(eventDrawPosition('ab'.repeat(32), huge + 1n)).toBe(position);
  });
  it('rejects invalid populations and positions', () => {
    expect(eventDrawTotal([])).toBe(0n);
    for (const points of ['0', '-1', '1.1', '01']) expect(() => eventDrawTotal([{ playerId: 'A', points }])).toThrow();
    expect(() => eventDrawTotal([population[0]!, population[0]!])).toThrow();
    for (const position of [-1n, 36n]) expect(() => eventDrawWinner(population, position)).toThrow();
    expect(() => eventDrawPosition('invalid', 1n)).toThrow(); expect(() => eventDrawPosition('00'.repeat(32), 0n)).toThrow();
  });
  it.each([1n, 2n, 3n, 255n, 256n, 257n, 9007199254740993n])('keeps seeded positions inside total %s', total => {
    for (let i = 0; i < 20; i++) { const value = eventDrawPosition(i.toString(16).padStart(64, '0'), total); expect(value >= 0n && value < total).toBe(true); }
  });
});
describe('Paris monthly boundaries', () => {
  it.each([
    ['2026-10-15T12:00:00Z', '2026-09-30T22:00:00.000Z', '2026-10-31T23:00:00.000Z'],
    ['2026-12-31T22:59:59Z', '2026-11-30T23:00:00.000Z', '2026-12-31T23:00:00.000Z'],
    ['2026-12-31T23:00:00Z', '2026-12-31T23:00:00.000Z', '2027-01-31T23:00:00.000Z'],
    ['2028-02-29T12:00:00Z', '2028-01-31T23:00:00.000Z', '2028-02-29T23:00:00.000Z'],
    ['2027-02-28T12:00:00Z', '2027-01-31T23:00:00.000Z', '2027-02-28T23:00:00.000Z'],
    ['2026-03-15T12:00:00Z', '2026-02-28T23:00:00.000Z', '2026-03-31T22:00:00.000Z'],
  ])('resolves %s', (now, start, end) => { const period = resolveCurrentEventPeriod(new Date(now)); expect(period.startsAt.toISOString()).toBe(start); expect(period.endsAt.toISOString()).toBe(end); });
});
describe('server monthly scheduler', () => {
  it('catches up on startup, wakes at midnight, retries failures and stops', async () => {
    vi.useFakeTimers();
    let now = new Date('2026-10-31T22:59:59Z');
    const catchUp = vi.fn<() => Promise<number>>().mockResolvedValueOnce(0).mockRejectedValueOnce(new Error('private failure')).mockResolvedValue(1);
    const resolveCurrentEdition = vi.fn(async () => ({ edition: { endsAt: resolveCurrentEventPeriod(now).endsAt } })) as unknown as EventService['resolveCurrentEdition'];
    const log = vi.fn();
    const scheduler = new EventMonthlyDrawScheduler({ catchUp }, { resolveCurrentEdition }, {} as PrismaClient, { now: () => now }, log);
    await scheduler.start(); expect(catchUp).toHaveBeenCalledTimes(1);
    now = new Date('2026-10-31T23:00:00Z'); await vi.advanceTimersByTimeAsync(1000);
    expect(catchUp).toHaveBeenCalledTimes(2); expect(log).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'EVENT_MONTHLY_DRAW_SCHEDULER_RETRY' }));
    await vi.advanceTimersByTimeAsync(60_000); expect(catchUp).toHaveBeenCalledTimes(3);
    await scheduler.stop(); await vi.advanceTimersByTimeAsync(120_000); expect(catchUp).toHaveBeenCalledTimes(3);
  });
  it('waits for an in-flight catch-up when closing and leaves no timer', async () => {
    vi.useFakeTimers(); let release!: (value: number) => void;
    const catchUp = vi.fn(() => new Promise<number>(resolve => { release = resolve; }));
    const resolveCurrentEdition = vi.fn(async () => ({ edition: { endsAt: new Date('2026-11-01T00:00:00Z') } })) as unknown as EventService['resolveCurrentEdition'];
    const scheduler = new EventMonthlyDrawScheduler({ catchUp }, { resolveCurrentEdition }, {} as PrismaClient, { now: () => new Date('2026-10-10T12:00:00Z') }, vi.fn());
    const started = scheduler.start(); await Promise.resolve();
    const stopped = scheduler.stop(); release(0); await Promise.all([started, stopped]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
it('splits long Event messages with complete Unicode content and sender context', () => {
  const content = 'bonjour 🌸 '.repeat(50).trim(), parts = eventMessageParts('Destinataire', 'Expéditeur', content, 320);
  expect(parts.length).toBeGreaterThan(1); expect(parts.every(part => Array.from(part).length <= 320)).toBe(true);
  expect(parts.map(part => part.replace(/^🎁 Destinataire, message de Expéditeur(?: \(suite\))? : /u, '')).join('')).toBe(content);
});
