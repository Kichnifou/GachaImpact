import { describe, expect, it, vi } from 'vitest';

import { EventService, resolveCurrentEventPeriod } from '../src/application/event/event-service.js';
import { activeEventGameAWindow, computeEventRefreshAfterMs, eventGameASucceeded, generateEventGameAState } from '../src/domain/event/game-a.js';
import { getBusinessMinuteAt, getNextBusinessResetAt } from '../src/domain/time/business-date.js';

describe('monthly Event period resolution', () => {
  it('generates three exact personal one-hour windows from injectable rolls', () => {
    const nextInt = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(300).mockReturnValueOnce(240);
    expect(generateEventGameAState({ nextInt })).toEqual({ version: 1, gameA: { windows: [
      { startMinute: 420, endMinute: 480 }, { startMinute: 1020, endMinute: 1080 }, { startMinute: 1320, endMinute: 1380 },
    ] } });
    expect(nextInt.mock.calls.map(([maximum]) => maximum)).toEqual([241, 301, 241]);
  });

  it('uses half-open window boundaries and an exact twenty-percent roll mapping', () => {
    const windows = [{ startMinute: 480, endMinute: 540 }];
    expect(activeEventGameAWindow(windows, 479)).toBeNull();
    expect(activeEventGameAWindow(windows, 480)).toBe(0);
    expect(activeEventGameAWindow(windows, 539)).toBe(0);
    expect(activeEventGameAWindow(windows, 540)).toBeNull();
    expect(eventGameASucceeded(19)).toBe(true);
    expect(eventGameASucceeded(20)).toBe(false);
  });

  it('converts daytime Paris windows with the correct DST offset', () => {
    expect(getBusinessMinuteAt('2026-03-29', 7 * 60).toISOString()).toBe('2026-03-29T05:00:00.000Z');
    expect(getBusinessMinuteAt('2026-10-25', 7 * 60).toISOString()).toBe('2026-10-25T06:00:00.000Z');
  });

  it('targets future starts, active ends and a closer cooldown from server time', () => {
    const reset = new Date('2026-09-15T22:00:00.000Z');
    const windows = [{ startAt: new Date('2026-09-15T10:00:00.000Z'), endAt: new Date('2026-09-15T11:00:00.000Z') }];
    expect(computeEventRefreshAfterMs({ now: new Date('2026-09-15T09:59:59.000Z'), nextBusinessResetAt: reset, completedToday: false, windows, cooldownEndsAt: null })).toBe(1_000);
    expect(computeEventRefreshAfterMs({ now: new Date('2026-09-15T10:15:00.000Z'), nextBusinessResetAt: reset, completedToday: false, windows, cooldownEndsAt: null })).toBe(45 * 60_000);
    expect(computeEventRefreshAfterMs({ now: new Date('2026-09-15T10:15:00.000Z'), nextBusinessResetAt: reset, completedToday: false, windows, cooldownEndsAt: new Date('2026-09-15T10:15:03.000Z') })).toBe(3_000);
  });

  it('falls back to the Paris reset after the windows, after success and before joining', () => {
    const now = new Date('2026-09-15T21:30:00.000Z');
    const reset = getNextBusinessResetAt(now);
    const windows = [{ startAt: new Date('2026-09-15T18:00:00.000Z'), endAt: new Date('2026-09-15T19:00:00.000Z') }];
    const expected = reset.getTime() - now.getTime();
    expect(computeEventRefreshAfterMs({ now, nextBusinessResetAt: reset, completedToday: false, windows, cooldownEndsAt: null })).toBe(expected);
    expect(computeEventRefreshAfterMs({ now, nextBusinessResetAt: reset, completedToday: true, windows, cooldownEndsAt: new Date('2026-09-15T21:30:03.000Z') })).toBe(expected);
    expect(computeEventRefreshAfterMs({ now, nextBusinessResetAt: reset, completedToday: false, windows: [], cooldownEndsAt: null })).toBe(expected);
  });

  it('keeps the next Paris reset correct across the autumn DST transition', () => {
    const now = new Date('2026-10-24T22:00:00.000Z');
    const reset = getNextBusinessResetAt(now);
    expect(reset.toISOString()).toBe('2026-10-25T23:00:00.000Z');
    expect(computeEventRefreshAfterMs({ now, nextBusinessResetAt: reset, completedToday: true, windows: [], cooldownEndsAt: null })).toBe(25 * 60 * 60_000);
  });
  it.each([
    ['2026-01-31T22:59:59.999Z', 2026, 1],
    ['2026-01-31T23:00:00.000Z', 2026, 2],
    ['2026-08-31T21:59:59.999Z', 2026, 8],
    ['2026-08-31T22:00:00.000Z', 2026, 9],
    ['2026-09-30T21:59:59.999Z', 2026, 9],
    ['2026-09-30T22:00:00.000Z', 2026, 10],
    ['2026-12-31T22:59:59.999Z', 2026, 12],
    ['2026-12-31T23:00:00.000Z', 2027, 1],
  ])('uses the Europe/Paris month at %s', (instant, year, month) => {
    expect(resolveCurrentEventPeriod(new Date(instant))).toMatchObject({ year, month });
  });

  it('produces exact September and December boundaries without assuming UTC midnight', () => {
    const september = resolveCurrentEventPeriod(new Date('2026-09-15T12:00:00.000Z'));
    expect(september.startsAt.toISOString()).toBe('2026-08-31T22:00:00.000Z');
    expect(september.endsAt.toISOString()).toBe('2026-09-30T22:00:00.000Z');
    const december = resolveCurrentEventPeriod(new Date('2026-12-15T12:00:00.000Z'));
    expect(december.startsAt.toISOString()).toBe('2026-11-30T23:00:00.000Z');
    expect(december.endsAt.toISOString()).toBe('2026-12-31T23:00:00.000Z');
  });

  it('projects an existing edition from its frozen snapshot after the definition changes', async () => {
    const definitionId = '00000000-0000-4000-8000-000000000009';
    const originalSnapshot = {
      externalKey: 'harvest', displayName: 'Festival des Récoltes', calendarMonth: 9, currencyKey: 'harvest-tokens',
      config: { emoji: '🌾', currency: { label: 'Jetons de Récolte', emoji: '🌾' }, collection: { key: 'harvest-sheaf', label: 'Gerbe de Récolte' } },
    };
    const edition = {
      id: '10000000-0000-4000-8000-000000000009', eventDefinitionId: definitionId, year: 2026,
      startsAt: new Date('2026-08-31T22:00:00.000Z'), endsAt: new Date('2026-09-30T22:00:00.000Z'),
      status: 'ACTIVE', snapshot: originalSnapshot, createdAt: new Date('2026-09-01T00:00:00.000Z'),
    };
    const database = {
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(database)),
      $queryRaw: vi.fn(async () => []),
      eventDefinition: { findFirst: vi.fn(async () => ({ id: definitionId, externalKey: 'changed', displayName: 'Festival renommé', calendarMonth: 9, currencyKey: 'changed-currency', config: { emoji: '❌', currency: { label: 'Monnaie modifiée', emoji: '❌' }, collection: { key: 'changed-item', label: 'Collection modifiée' } } })) },
      eventEdition: { findUnique: vi.fn(async () => edition), upsert: vi.fn() },
      eventParticipant: { findUnique: vi.fn(async () => null) },
      playerEventCurrencyBalance: { findUnique: vi.fn(async () => ({ amount: 7n })) },
    };
    const service = new EventService(
      { execute: vi.fn(async () => ({ id: '20000000-0000-4000-8000-000000000009' })) } as never,
      database as never,
      { now: () => new Date('2026-09-15T12:00:00.000Z') },
      { nextInt: vi.fn(() => 0) },
    );

    const result = await service.getCurrent({ subject: 'snapshot-test' });

    expect(result.festival).toEqual({
      key: 'harvest', month: 9, title: 'Festival des Récoltes', emoji: '🌾',
      currency: { key: 'harvest-tokens', label: 'Jetons de Récolte', emoji: '🌾' },
      collection: { key: 'harvest-sheaf', label: 'Gerbe de Récolte' },
    });
    expect(result.currency.amount).toBe('7');
    expect(result.refreshAfterMs).toBe(10 * 60 * 60_000);
    expect(database.eventEdition.upsert).not.toHaveBeenCalled();
    expect(database.playerEventCurrencyBalance.findUnique).toHaveBeenCalledWith({
      where: { playerId_eventDefinitionId: { playerId: '20000000-0000-4000-8000-000000000009', eventDefinitionId: definitionId } },
    });
  });
});
