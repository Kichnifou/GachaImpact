import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { TwitchReceiptRetention } from '../src/application/twitch/twitch-receipt-retention.js';
import { TwitchEventObserver } from '../src/application/twitch/twitch-event-observer.js';

const HOUR = 60 * 60 * 1_000;
const MINUTE = 60 * 1_000;
const fullBatch = () => Array.from({ length: 1_000 }, (_value, index) => ({ id: `old-${index}` }));
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function setup() {
  let now = Date.parse('2026-09-28T12:00:00Z');
  const receipts = { findMany: vi.fn().mockResolvedValue([{ id: 'old' }]), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) };
  const retention = new TwitchReceiptRetention({ twitchEventReceipt: receipts } as unknown as PrismaClient, () => now);
  return { retention, receipts, advance: (milliseconds: number) => { now += milliseconds; } };
}

describe('bounded Twitch observation receipt retention', () => {
  it('limits selection to 1,000 IDs and repeats every durable protection at DELETE', async () => {
    const { retention, receipts } = setup(); retention.maybeCleanup(); await flush();
    const eligible = { eventType: 'channel.chat.message', state: 'RECEIVED', processedAt: null, externalReference: null,
      receivedAt: { lt: new Date('2026-09-27T12:00:00Z') }, favorGrant: { is: null } };
    expect(receipts.findMany).toHaveBeenCalledWith({ where: eligible, select: { id: true }, orderBy: { receivedAt: 'asc' }, take: 1_000 });
    expect(receipts.deleteMany).toHaveBeenCalledWith({ where: { ...eligible, id: { in: ['old'] } } });
  });
  it('attempts cleanup only once an hour across closely spaced messages', async () => {
    const { retention, receipts, advance } = setup();
    for (let i = 0; i < 20; i++) retention.maybeCleanup();
    await flush(); advance(HOUR - 1); retention.maybeCleanup(); await flush();
    expect(receipts.findMany).toHaveBeenCalledTimes(1);
    advance(1); retention.maybeCleanup(); await flush();
    expect(receipts.findMany).toHaveBeenCalledTimes(2);
  });
  it('keeps one running cleanup and starts the normal delay after a long attempt completes', async () => {
    const { retention, receipts, advance } = setup();
    let release!: (rows: { id: string }[]) => void;
    receipts.findMany.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    retention.maybeCleanup(); advance(2 * HOUR); retention.maybeCleanup();
    expect(receipts.findMany).toHaveBeenCalledTimes(1);
    release([{ id: 'old' }]); await flush(); retention.maybeCleanup(); await flush();
    expect(receipts.findMany).toHaveBeenCalledTimes(1);
    advance(HOUR - 1); retention.maybeCleanup(); await flush();
    expect(receipts.findMany).toHaveBeenCalledTimes(1);
    advance(1); retention.maybeCleanup(); await flush();
    expect(receipts.findMany).toHaveBeenCalledTimes(2);
  });
  it.each(['findMany', 'deleteMany'] as const)('isolates %s failure and keeps the hourly retry bound', async method => {
    const { retention, receipts, advance } = setup();
    let rejectCleanup!: (reason: Error) => void;
    receipts[method].mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectCleanup = reject; }));
    retention.maybeCleanup(); await flush(); advance(2 * HOUR);
    rejectCleanup(new Error('private maintenance failure')); await flush();
    retention.maybeCleanup(); advance(HOUR - 1); retention.maybeCleanup(); await flush();
    expect(receipts.findMany).toHaveBeenCalledTimes(1);
    advance(1); retention.maybeCleanup(); await flush();
    expect(receipts.findMany).toHaveBeenCalledTimes(2);
  });
  it('waits a minute after a full selection, ignores intervening messages and runs only one batch per attempt', async () => {
    const { retention, receipts, advance } = setup(); receipts.findMany.mockResolvedValue(fullBatch());
    retention.maybeCleanup(); await flush();
    expect(receipts.findMany).toHaveBeenCalledTimes(1); expect(receipts.deleteMany).toHaveBeenCalledTimes(1);
    advance(MINUTE - 1);
    for (let index = 0; index < 20; index++) retention.maybeCleanup();
    await flush(); expect(receipts.findMany).toHaveBeenCalledTimes(1);
    advance(1); retention.maybeCleanup(); await flush();
    expect(receipts.findMany).toHaveBeenCalledTimes(2); expect(receipts.deleteMany).toHaveBeenCalledTimes(2);
    expect(receipts.deleteMany.mock.calls[0]![0].where.id.in).toHaveLength(1_000);
    await flush(); expect(receipts.findMany).toHaveBeenCalledTimes(2);
  });
  it('uses full selection rather than a lower DELETE count to keep catch-up cadence', async () => {
    const { retention, receipts, advance } = setup();
    receipts.findMany.mockResolvedValue(fullBatch()); receipts.deleteMany.mockResolvedValue({ count: 0 });
    retention.maybeCleanup(); await flush(); advance(MINUTE); retention.maybeCleanup(); await flush();
    expect(receipts.findMany).toHaveBeenCalledTimes(2);
  });
  it('returns to an hour after a partial batch following catch-up', async () => {
    const { retention, receipts, advance } = setup(); receipts.findMany.mockResolvedValueOnce(fullBatch());
    retention.maybeCleanup(); await flush(); advance(MINUTE); retention.maybeCleanup(); await flush();
    expect(receipts.findMany).toHaveBeenCalledTimes(2);
    advance(HOUR - 1); retention.maybeCleanup(); await flush(); expect(receipts.findMany).toHaveBeenCalledTimes(2);
    advance(1); retention.maybeCleanup(); await flush(); expect(receipts.findMany).toHaveBeenCalledTimes(3);
  });
  it('keeps one catch-up cleanup running and waits a fresh minute after slow DELETE completion', async () => {
    const { retention, receipts, advance } = setup(); receipts.findMany.mockResolvedValue(fullBatch());
    retention.maybeCleanup(); await flush(); advance(MINUTE);
    let release!: (result: { count: number }) => void;
    receipts.deleteMany.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    retention.maybeCleanup(); await flush(); advance(2 * HOUR);
    for (let index = 0; index < 20; index++) retention.maybeCleanup();
    expect(receipts.findMany).toHaveBeenCalledTimes(2); expect(receipts.deleteMany).toHaveBeenCalledTimes(2);
    release({ count: 1_000 }); await flush(); retention.maybeCleanup(); advance(MINUTE - 1); retention.maybeCleanup();
    expect(receipts.findMany).toHaveBeenCalledTimes(2);
    advance(1); retention.maybeCleanup(); await flush(); expect(receipts.findMany).toHaveBeenCalledTimes(3);
  });
  it.each(['findMany', 'deleteMany'] as const)('leaves catch-up on %s failure and retries only after an hour', async method => {
    const { retention, receipts, advance } = setup(); receipts.findMany.mockResolvedValue(fullBatch());
    retention.maybeCleanup(); await flush();
    receipts[method].mockRejectedValueOnce(new Error('private catch-up failure'));
    advance(MINUTE); retention.maybeCleanup(); await flush();
    advance(MINUTE); retention.maybeCleanup(); await flush(); expect(receipts.findMany).toHaveBeenCalledTimes(2);
    advance(HOUR - MINUTE - 1); retention.maybeCleanup(); await flush(); expect(receipts.findMany).toHaveBeenCalledTimes(2);
    advance(1); retention.maybeCleanup(); await flush(); expect(receipts.findMany).toHaveBeenCalledTimes(3);
  });
  it('skips DELETE when there is no eligible receipt and never loops over a backlog', async () => {
    const { retention, receipts } = setup(); receipts.findMany.mockResolvedValueOnce([]);
    retention.maybeCleanup(); await flush();
    expect(receipts.findMany).toHaveBeenCalledTimes(1); expect(receipts.deleteMany).not.toHaveBeenCalled();
  });
  it('accepts the observation and its replay without waiting for blocked or failing maintenance', async () => {
    const { retention, receipts } = setup();
    let rejectCleanup!: (reason: Error) => void;
    receipts.findMany.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectCleanup = reject; }));
    let saved: unknown;
    const tx = { twitchIdentity: { findUnique: vi.fn().mockResolvedValue(null) }, twitchEventReceipt: {
      findUnique: vi.fn().mockImplementation(async () => saved ?? null),
      create: vi.fn().mockImplementation(async ({ data }) => saved = { ...data, id: 'new', state: 'RECEIVED' }),
    } };
    const observer = new TwitchEventObserver({ $transaction: async (action: (value: typeof tx) => unknown) => action(tx) } as unknown as PrismaClient, retention);
    const input = { externalEventId: 'current', eventType: 'channel.chat.message', twitchUserId: '12345' };
    expect(await observer.observeTwitchEvent(input)).toMatchObject({ duplicate: false, identity: 'unresolved' });
    expect(await observer.observeTwitchEvent(input)).toMatchObject({ duplicate: true });
    expect(tx.twitchEventReceipt.create).toHaveBeenCalledTimes(1);
    expect(receipts.findMany).toHaveBeenCalledTimes(1);
    rejectCleanup(new Error('maintenance unavailable')); await flush();
    expect(await observer.observeTwitchEvent(input)).toMatchObject({ duplicate: true });
  });
  it('does not schedule chat retention for another observed event type', async () => {
    const { retention, receipts } = setup();
    const tx = { twitchIdentity: { findUnique: vi.fn().mockResolvedValue(null) }, twitchEventReceipt: {
      findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(async ({ data }) => ({ ...data, id: 'other' })),
    } };
    const observer = new TwitchEventObserver({ $transaction: async (action: (value: typeof tx) => unknown) => action(tx) } as unknown as PrismaClient, retention);
    await observer.observeTwitchEvent({ externalEventId: 'other', eventType: 'channel.subscribe', twitchUserId: '12345' });
    expect(receipts.findMany).not.toHaveBeenCalled();
  });
});
