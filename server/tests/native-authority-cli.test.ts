import { expect, it } from 'vitest';
import { parseNativeAuthorityArguments } from '../src/application/twitch/native-authority-cli-contract.js';
const base = ['--operator-player', '11111111-1111-4111-8111-111111111111', '--mode', 'GLOBAL', '--expected-revision', '18'];
it('requires an explicit scope, operator, revision and non-OFF Streamer.bot acknowledgement', () => {
  expect(() => parseNativeAuthorityArguments(base)).toThrow();
  expect(parseNativeAuthorityArguments([...base, '--acknowledgement', 'STREAMERBOT_PATH_DISABLED'])).toMatchObject({ mode: 'GLOBAL', 'expected-revision': 18 });
  expect(() => parseNativeAuthorityArguments([...base, '--twitch-id', '123'])).toThrow();
  expect(() => parseNativeAuthorityArguments([...base, '--expected-revision', '9007199254740993'])).toThrow();
  expect(() => parseNativeAuthorityArguments(['--mode', 'OFF'])).toThrow();
});
