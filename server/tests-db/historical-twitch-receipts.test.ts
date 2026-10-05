import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { TwitchEventObserver } from '../src/application/twitch/twitch-event-observer.js';
import type { TwitchReceiptRetention } from '../src/application/twitch/twitch-receipt-retention.js';
import { collectHistoricalIdentityCandidates, readHistoricalChatEvidence } from '../src/application/migration/historical-twitch-evidence.js';

const fixture = isolatedBatchDatabase();
beforeAll(() => fixture.setup(), 60_000);
afterAll(() => fixture.cleanup(), 60_000);

describe('historical Twitch evidence in isolated PostgreSQL', () => {
  it('reads exact observer receipts in a READ ONLY transaction, without any public fixture or write', async () => {
    const observer = new TwitchEventObserver(fixture.database, { maybeCleanup() {} } as TwitchReceiptRetention);
    for (const externalEventId of ['fixture-one', 'fixture-two']) await observer.observeTwitchEvent({
      externalEventId, eventType: 'channel.chat.message', twitchUserId: '123', login: 'old_one', displayName: 'Fixture',
      sourceTimestamp: '2020-01-01T00:00:00.000Z', contentHash: 'a'.repeat(64), transportPayloadHash: 'b'.repeat(64),
    });
    const statements: string[] = [];
    const readonlyClient = { query: async (sql: string, values?: unknown[]) => {
      statements.push(sql);
      if (sql.startsWith('SELECT')) expect((await fixture.admin.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('on');
      return fixture.admin.query(sql.replaceAll('public.', `"${fixture.schema}".`), values);
    } } as unknown as pg.Client;
    const evidence = await readHistoricalChatEvidence(readonlyClient, ['OLD_ONE', 'absent']);
    expect(evidence).toHaveLength(2);
    expect(collectHistoricalIdentityCandidates(['OLD_ONE', 'absent'], [], evidence)).toEqual({ knownIds: { old_one: '123' }, conflicts: [] });
    expect(statements[0]).toContain('READ ONLY'); expect(statements.at(-1)).toBe('COMMIT');
    expect(statements.join(' ')).not.toMatch(/UPDATE|INSERT|DELETE|provider_subject|email|credentials|sessions/);
    expect(await fixture.database.twitchEventReceipt.count()).toBe(2);
  }, 60_000);
});
