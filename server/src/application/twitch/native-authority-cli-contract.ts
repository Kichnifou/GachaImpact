import { parseArgs } from 'node:util';
import { z } from 'zod';
import { STREAMERBOT_PATH_DISABLED } from './twitch-native-authority.js';

export function parseNativeAuthorityArguments(args: string[]) {
  const { values } = parseArgs({ args, allowPositionals: false, strict: true, options: {
    'operator-player': { type: 'string' }, mode: { type: 'string' }, 'expected-revision': { type: 'string' }, acknowledgement: { type: 'string' },
  } });
  return z.object({ 'operator-player': z.uuid(), mode: z.enum(['OFF', 'CANARY', 'GLOBAL']),
    'expected-revision': z.string().regex(/^[1-9][0-9]*$/).transform(Number).refine(Number.isSafeInteger),
    acknowledgement: z.literal(STREAMERBOT_PATH_DISABLED).optional(),
  }).strict().refine(value => value.mode === 'OFF' || value.acknowledgement === STREAMERBOT_PATH_DISABLED).parse(values);
}
