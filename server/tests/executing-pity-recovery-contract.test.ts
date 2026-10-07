import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseExecutingPityRecoveryArguments } from '../src/application/twitch/executing-pity-recovery-contract.js';

const args = ['--operator-player', randomUUID(), '--receipt', randomUUID(), '--expected-player', randomUUID(), '--twitch-id', '123',
  '--expected-revision', '8', '--command-key', 'twitch-command:123:private-message', '--business-at', '2026-10-07T12:00:00.000Z',
  '--acknowledgement', 'STREAMERBOT_PATH_DISABLED'];
describe('local existing pity recovery contract', () => {
  it('defaults to dry run and preserves the supplied command key and business instant', () => {
    const result = parseExecutingPityRecoveryArguments(args);
    expect(result.apply).toBe(false);
    expect(result.request).toMatchObject({ commandKey: 'twitch-command:123:private-message', businessAt: '2026-10-07T12:00:00.000Z', expectedRevision: 8 });
    expect(parseExecutingPityRecoveryArguments([...args, '--apply']).apply).toBe(true);
  });
  it.each([['--force'], ['--handler', 'pull'], ['--batch'], ['--GLOBAL'], ['--apply', '--apply'], ['--receipt', randomUUID()], ['--unknown', 'x']].map(extra => ({ extra })))('rejects extra or duplicated arguments $extra', ({ extra }) => {
    expect(() => parseExecutingPityRecoveryArguments([...args, ...extra])).toThrow();
  });
  it.each(['--operator-player', '--receipt', '--expected-player', '--twitch-id', '--expected-revision', '--command-key', '--business-at', '--acknowledgement'])('requires %s explicitly', flag => {
    const missing = [...args], index = missing.indexOf(flag); missing.splice(index, 2);
    expect(() => parseExecutingPityRecoveryArguments(missing)).toThrow();
  });
  it.each(['0', '-1', '8x', '08', '2147483648'])('rejects revision %s', revision => {
    const invalid = [...args]; invalid[invalid.indexOf('--expected-revision') + 1] = revision;
    expect(() => parseExecutingPityRecoveryArguments(invalid)).toThrow();
  });
  it('has no HTTP route, scheduler start, subscription creation or fabricated delivery proof', () => {
    const source = readFileSync(new URL('../scripts/recover-executing-pity.mts', import.meta.url), 'utf8');
    expect(source).toContain('recoverExecutingPity(request, apply)');
    expect(source).toContain("current_schema !== 'public'");
    expect(source).not.toMatch(/\.start\(|consumeAuthenticated\(|createHmac\(|buildApp\(/);
    const routes = readFileSync(new URL('../src/api/routes/twitch-pilot.ts', import.meta.url), 'utf8');
    expect(routes).not.toContain('recoverExecutingPity');
  });
});
