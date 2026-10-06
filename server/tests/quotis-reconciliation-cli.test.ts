import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseQuotisReconciliationArguments } from '../src/application/twitch/reconcile-quotis-preparation.js';

const args = ['--schema', 'public', '--operator-player', randomUUID(), '--twitch-id', '910040000001', '--expected-player', randomUUID(),
  '--expected-revision', '3', '--receipt-1', randomUUID(), '--receipt-2', randomUUID()];
describe('local quotis reconciliation argument boundary', () => {
  it('requires two exact receipts, operator, immutable identity, Player, revision and public schema', () => {
    expect(parseQuotisReconciliationArguments(args)).toMatchObject({ expectedRevision: 3, receiptIds: [args[11], args[13]] });
  });
  it.each([
    args.slice(0, -2), [...args, '--mode', 'GLOBAL'], [...args, '--execute', 'true'], [...args, '--schema', 'public'],
    args.map(value => value === 'public' ? 'private' : value), args.map(value => value === '3' ? '-1' : value),
    args.map(value => value === args[13] ? args[11]! : value), [...args, '--unexpected'],
  ].map(invalid => ({ invalid })))('refuses incomplete, ambiguous or broadened arguments %#', ({ invalid }) => {
    expect(() => parseQuotisReconciliationArguments(invalid)).toThrow();
  });
});
