import { describe, expect, it, vi } from 'vitest';

import { EventService, resolveCurrentEventPeriod } from '../src/application/event/event-service.js';

describe('monthly Event period resolution', () => {
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
      eventDefinition: { findFirst: vi.fn(async () => ({ id: definitionId, externalKey: 'changed', displayName: 'Festival renommé', calendarMonth: 9, currencyKey: 'changed-currency', config: { emoji: '❌', currency: { label: 'Monnaie modifiée', emoji: '❌' }, collection: { key: 'changed-item', label: 'Collection modifiée' } } })) },
      eventEdition: { findUnique: vi.fn(async () => edition), upsert: vi.fn() },
      eventParticipant: { findUnique: vi.fn(async () => null) },
      playerEventCurrencyBalance: { findUnique: vi.fn(async () => ({ amount: 7n })) },
    };
    const service = new EventService(
      { execute: vi.fn(async () => ({ id: '20000000-0000-4000-8000-000000000009' })) } as never,
      database as never,
      { now: () => new Date('2026-09-15T12:00:00.000Z') },
    );

    const result = await service.getCurrent({ subject: 'snapshot-test' });

    expect(result.festival).toEqual({
      key: 'harvest', month: 9, title: 'Festival des Récoltes', emoji: '🌾',
      currency: { key: 'harvest-tokens', label: 'Jetons de Récolte', emoji: '🌾' },
      collection: { key: 'harvest-sheaf', label: 'Gerbe de Récolte' },
    });
    expect(result.currency.amount).toBe('7');
    expect(database.eventEdition.upsert).not.toHaveBeenCalled();
    expect(database.playerEventCurrencyBalance.findUnique).toHaveBeenCalledWith({
      where: { playerId_eventDefinitionId: { playerId: '20000000-0000-4000-8000-000000000009', eventDefinitionId: definitionId } },
    });
  });
});
