import { describe, expect, it } from 'vitest';
import { parseImportedCanaryArguments } from '../src/application/twitch/imported-canary-cli-contract.js';

const args = ['--schema', 'public', '--operator-player', '00000000-0000-4000-8000-000000000001',
  '--twitch-id', '910000000001', '--expected-player', '00000000-0000-4000-8000-000000000002',
  '--confirm-backup-hash', 'a'.repeat(64), '--acknowledgement', 'STREAMERBOT_PATH_DISABLED', '--expected-revision', '0'];
describe('local imported canary CLI', () => {
  it('requires an exact operator, identity, imported Player, backup and OFF revision', () => {
    expect(parseImportedCanaryArguments(args)).toMatchObject({ schema: 'public', 'expected-revision': 0, acknowledgement: 'STREAMERBOT_PATH_DISABLED' });
  });
  it.each([
    args.slice(0, -2), [...args, '--mode', 'GLOBAL'], [...args, '--twitch-id', '910000000002'],
    args.map(value => value === 'public' ? 'private' : value), args.map(value => value === 'STREAMERBOT_PATH_DISABLED' ? 'YES' : value),
    args.map(value => value === '0' ? '-1' : value), args.map(value => value === '910000000001' ? 'Kichni_Test' : value),
    args.map(value => value === '00000000-0000-4000-8000-000000000002' ? 'ABSENT' : value),
  ].map(values => ({ values })))('fails closed on missing, duplicated or incompatible arguments (%#)', ({ values }) => {
    expect(() => parseImportedCanaryArguments(values)).toThrow('IMPORTED_CANARY_ARGUMENTS_INVALID');
  });
});
