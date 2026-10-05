import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../generated/prisma/client.js';
import { applyLegacyEvent } from '../src/application/migration/legacy-event-apply.js';
import type { LegacyGlobalPlan } from '../src/application/migration/legacy-global-plan.js';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';

function setup(foundBy = 'deferred', sender = 'deferred') {
  const files = Object.fromEntries(snapshotFileNames.map(name => [name, name === 'monthly_events.json' ? '' : '{}']));
  files['monthly_events_data.json'] = JSON.stringify({ year: 2026, month: 10, participants: {}, collectionPurchases: {},
    gameB: { '2026-10-04': { winningCode: '1234', testedCodes: [], found: true, foundBy } },
    messages: { verified: [{ sender, read: false, text: 'Fixture', createdAt: '2026-10-04 12:00:00' }],
      deferred: [{ sender: 'verified', read: false, text: 'Fixture', createdAt: '2026-10-04 12:00:00' }] } });
  const plan = { players: [{ legacyUsername: 'verified', playerId: 'fixture-player' }], identityQuarantined: ['deferred'] } as LegacyGlobalPlan;
  const createGame = vi.fn(), createMessage = vi.fn();
  const tx = { eventDefinition: { findUnique: vi.fn(async () => ({ id: 'definition', externalKey: 'fixture', displayName: 'Fixture', calendarMonth: 10, currencyKey: 'fixture', config: {} })) },
    eventEdition: { upsert: vi.fn(async () => ({ id: 'edition' })) }, eventGameBDailyState: { create: createGame }, eventSocialMessage: { create: createMessage } } as unknown as Prisma.TransactionClient;
  return { snapshot: parseStreamerbotSnapshot(files), plan, tx, createGame, createMessage };
}
describe('Event facts involving quarantined identities', () => {
  it('defers a Game B discoverer and messages in either direction without making up endpoints', async () => {
    const { snapshot, plan, tx, createGame, createMessage } = setup();
    expect(await applyLegacyEvent(tx, snapshot, plan, 'fixture-batch', new Date('2026-10-04T20:02:33.000Z'))).toMatchObject({ gameB: 0, messages: 0 });
    expect(createGame).not.toHaveBeenCalled(); expect(createMessage).not.toHaveBeenCalled();
  });
  it('keeps an unknown nonquarantined discoverer blocked', async () => {
    const { snapshot, plan, tx, createGame } = setup('unknown');
    await expect(applyLegacyEvent(tx, snapshot, plan, 'fixture-batch', new Date('2026-10-04T20:02:33.000Z'))).rejects.toThrow('discoverer is outside');
    expect(createGame).not.toHaveBeenCalled();
  });
  it('keeps an unknown nonquarantined message sender blocked', async () => {
    const { snapshot, plan, tx, createMessage } = setup('deferred', 'unknown');
    await expect(applyLegacyEvent(tx, snapshot, plan, 'fixture-batch', new Date('2026-10-04T20:02:33.000Z'))).rejects.toThrow('cannot be mapped');
    expect(createMessage).not.toHaveBeenCalled();
  });
});
