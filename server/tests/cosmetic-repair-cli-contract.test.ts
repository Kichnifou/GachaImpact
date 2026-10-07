import { describe, expect, it } from 'vitest';
import { parseCosmeticRepairArguments } from '../src/application/migration/cosmetic-repair-cli-contract.js';
const base = ['--operator-player', '10000000-0000-4000-8000-000000000001', '--expected-player', '10000000-0000-4000-8000-000000000002', '--twitch-id', '900000000001', '--expected-revision', '9', '--acknowledgement', 'STREAMERBOT_PATH_DISABLED', '--confirm-backup-hash', 'a'.repeat(64), '--import-backup', '../local-data/identity-resolutions/import.json', '--output', '../local-data/identity-resolutions/repair.json'];
const confirmation = ['--confirm-plan-hash', 'b'.repeat(64), '--expected-avatars', '2', '--expected-titles', '5'];
describe('scoped cosmetic repair CLI', () => {
  it('defaults to read-only with all immutable scope confirmations', () => expect(parseCosmeticRepairArguments(base).apply).toBe(false));
  it('requires explicit apply and all plan/count confirmations', () => expect(parseCosmeticRepairArguments([...base, '--apply', ...confirmation]).apply).toBe(true));
  it.each([['--apply'], confirmation, ['--apply', ...confirmation.slice(0, -2)], ['--apply', '--apply', ...confirmation], ['--global', 'true'], ['--expected-player', 'Ceo'], ['--expected-revision', '-1'], ['--output']])('rejects incomplete, duplicate or unknown flags: %j', extra => expect(() => parseCosmeticRepairArguments([...base, ...extra])).toThrow());
});
