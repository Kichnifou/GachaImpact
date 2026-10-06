import { describe, expect, it } from 'vitest';
import { parseCanaryArguments, canaryBackupSchema } from '../src/application/migration/canary-cli-contract.js';
import { canaryBackupHash, type CanaryBackup } from '../src/application/migration/legacy-canary.js';
import { rowGraphHash } from '../src/application/migration/targeted-player-rows.js';

describe('local canary CLI guards, without executing public apply', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const target = ['--twitch-id', '900001', '--expected-player', 'ABSENT'];
  it('allows a read-only explicit absent target and rejects unknown, duplicate or name-based identity', () => {
    expect(parseCanaryArguments(['plan', ...target]).mode).toBe('plan');
    for (const args of [['plan', ...target, '--unknown', 'yes'], ['plan', ...target, '--twitch-id', '900002'],
      ['plan', '--twitch-id', 'viewer_name', '--expected-player', id]]) expect(() => parseCanaryArguments(args)).toThrow();
  });
  it.each(['apply', 'rollback'])('requires an explicit public schema, operator and exact numeric target before %s', mode => {
    const confirmed = [mode, ...target, '--schema', 'public', '--operator-player', id, '--confirm-twitch-id', '900001'];
    expect(parseCanaryArguments(confirmed).mode).toBe(mode);
    for (const args of [[mode, ...target], [mode, ...target, '--schema', 'public'],
      [...confirmed.slice(0, -1), '900002']]) expect(() => parseCanaryArguments(args)).toThrow();
  });
  it('checks the whole serialized backup independently of property order and detects authority/identity tampering', () => {
    const rows = { schema: 'public', playerIds: [id], tables: { players: [] }, order: ['players'], hash: rowGraphHash({ players: [] }) };
    const preimage: Omit<CanaryBackup, 'hash'> = { version: 1, kind: 'TARGETED_LEGACY_CANARY', twitchUserId: '900001',
      snapshotHash: 'a'.repeat(64), identityReportHash: 'b'.repeat(64), target: null, rows };
    const backup = canaryBackupSchema.parse(JSON.parse(JSON.stringify({ ...preimage, hash: canaryBackupHash(preimage) })));
    const { hash, ...serialized } = backup;
    expect(canaryBackupHash(serialized as Omit<CanaryBackup, 'hash'>)).toBe(hash);
    expect(canaryBackupHash({ ...preimage, twitchUserId: '900002' })).not.toBe(hash);
    expect(canaryBackupHash({ ...preimage, rows: { ...rows, schema: 'other' } })).not.toBe(hash);
    expect(canaryBackupSchema.safeParse({ ...backup, accessToken: 'forbidden' }).success).toBe(false);
  });
});
