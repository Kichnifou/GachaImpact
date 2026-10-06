import { z } from 'zod';
import { STREAMERBOT_PATH_DISABLED } from './twitch-native-authority.js';

const input = z.object({
  schema: z.literal('public'),
  'operator-player': z.uuid(),
  'twitch-id': z.string().regex(/^[1-9][0-9]{0,127}$/),
  'expected-player': z.uuid(),
  'confirm-backup-hash': z.string().regex(/^[a-f0-9]{64}$/),
  acknowledgement: z.literal(STREAMERBOT_PATH_DISABLED),
  'expected-revision': z.string().regex(/^(0|[1-9][0-9]*)$/).transform(Number).pipe(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)),
}).strict();

/** No mode argument, GLOBAL, fallback identity or implicit confirmation. */
export function parseImportedCanaryArguments(args: readonly string[]) {
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index], value = args[index + 1];
    if (!option?.startsWith('--') || !value || value.startsWith('--') || Object.hasOwn(values, option.slice(2)))
      throw new Error('IMPORTED_CANARY_ARGUMENTS_INVALID');
    values[option.slice(2)] = value;
  }
  const parsed = input.safeParse(values);
  if (!parsed.success) throw new Error('IMPORTED_CANARY_ARGUMENTS_INVALID');
  return parsed.data;
}
