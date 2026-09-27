import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

const fixture = isolatedBatchDatabase();
const db = fixture.database;
let playerId: string;
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const operation = async () => (await db.businessOperation.create({ data: {
  playerId, operationType: 'foundation-052.fixture', sourceChannel: 'UI', idempotencyKey: randomUUID(),
} })).id;

beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  playerId = (await db.player.create({ data: { displayName: 'Private 052 fixture' } })).id;
}, 60_000);
afterAll(async () => { await fixture.cleanup(); }, 60_000);

describe('052 physical guards in an isolated PostgreSQL schema', () => {
  it('stores an inclusive calendar period and rejects incomplete or reversed periods', async () => {
    await db.playerFavorState.create({ data: { playerId, activeFromDate: day('2026-09-27'),
      activeUntilDate: day('2026-10-31'), legacyObtainedDate: day('2026-08-12'),
      legacyLastClaimDate: day('2026-09-26'), legacyProvenance: { initialDaysRemaining: 35 } } });
    await expect(db.playerFavorState.update({ where: { playerId }, data: { activeUntilDate: day('2026-09-26') } })).rejects.toThrow();
    await expect(db.playerFavorState.update({ where: { playerId }, data: { activeUntilDate: null } })).rejects.toThrow();
  });

  it('enforces complete FavorGrant amounts and one grant per Twitch receipt', async () => {
    const receipt = await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(),
      eventType: 'subscription', externalReference: 'private-fixture', payloadMinimal: { tier: '1000' },
      errorMessage: null } });
    expect(receipt.payloadMinimal).toEqual({ tier: '1000' });
    const create = (operationId: string, addedDays: number, blockedDays: number) => db.favorGrant.create({ data: {
      playerId, twitchEventReceiptId: receipt.id, subscriptionTier: '1000', requestedDays: 30,
      addedDays, blockedDays, immediatePrimogems: 1600n, compensationPrimogems: 0n, operationId,
    } });
    await create(await operation(), 30, 0);
    await expect(create(await operation(), 30, 0)).rejects.toThrow();
    await expect(db.favorGrant.create({ data: { playerId, requestedDays: 30, addedDays: 31, blockedDays: 0,
      immediatePrimogems: 1600n, compensationPrimogems: 0n, operationId: await operation() } })).rejects.toThrow();
    await expect(db.favorGrant.create({ data: { playerId, requestedDays: 30, addedDays: 10, blockedDays: 10,
      immediatePrimogems: 1600n, compensationPrimogems: 0n, operationId: await operation() } })).rejects.toThrow();
    await expect(db.favorGrant.create({ data: { playerId, requestedDays: 30, addedDays: 30, blockedDays: 0,
      immediatePrimogems: -1n, compensationPrimogems: 0n, operationId: await operation() } })).rejects.toThrow();
  });

  it('distinguishes native and legacy daily claims and prevents a second claim on the same day', async () => {
    const legacyDay = day('2026-09-26');
    await db.favorDailyClaim.create({ data: { playerId, businessDate: legacyDay, origin: 'LEGACY',
      sourceChannel: null, operationId: null, claimedAt: null, legacyProvenance: { source: 'fixture' } } });
    await expect(db.favorDailyClaim.create({ data: { playerId, businessDate: legacyDay, origin: 'NATIVE',
      sourceChannel: 'UI', operationId: await operation(), claimedAt: new Date() } })).rejects.toThrow();
    await expect(db.favorDailyClaim.create({ data: { playerId, businessDate: day('2026-09-27'), origin: 'NATIVE',
      operationId: await operation(), claimedAt: new Date() } })).rejects.toThrow();
    await db.favorDailyClaim.create({ data: { playerId, businessDate: day('2026-09-27'), origin: 'NATIVE',
      sourceChannel: 'UI', operationId: await operation(), claimedAt: new Date() } });
  });

  it('represents a proven legacy result followed by arbitrary native rerolls', async () => {
    const session = await db.giveawaySession.create({ data: { status: 'CLOSED', openedByPlayerId: playerId,
      closedByPlayerId: playerId, winnerPlayerId: playerId } });
    await db.giveawayWin.create({ data: { sessionId: session.id, drawIndex: 0, playerId,
      origin: 'LEGACY', operationId: null, drawnAt: null, legacyProvenance: { ordinalKnown: false } } });
    for (const index of [1, 2]) await db.giveawayWin.create({ data: { sessionId: session.id, drawIndex: index,
      playerId, origin: 'NATIVE', operationId: await operation(), drawnAt: new Date() } });
    expect((await db.giveawayWin.findMany({ where: { sessionId: session.id }, orderBy: { drawIndex: 'asc' } })).map(row => row.drawIndex)).toEqual([0, 1, 2]);
    await expect(db.giveawayWin.create({ data: { sessionId: session.id, drawIndex: 2, playerId,
      origin: 'LEGACY', legacyProvenance: { source: 'fixture' } } })).rejects.toThrow();
    await expect(db.giveawayWin.create({ data: { sessionId: session.id, drawIndex: 3, playerId,
      origin: 'NATIVE', drawnAt: new Date() } })).rejects.toThrow();
    await expect(db.giveawayWin.create({ data: { sessionId: session.id, drawIndex: 3, playerId,
      origin: 'LEGACY', operationId: await operation(), legacyProvenance: { source: 'fixture' } } })).rejects.toThrow();
  });

  it('retains the legacy XP business date without inventing a timestamp', async () => {
    const row = await db.playerProgression.create({ data: { playerId, legacyLastXpDate: day('2026-09-27'),
      lastXpAt: null, lastXpMessageAt: day('2026-09-26') } });
    expect(row.legacyLastXpDate?.toISOString().slice(0, 10)).toBe('2026-09-27');
    expect(row.lastXpAt).toBeNull();
  });
});
