import { z } from 'zod';
import { STREAMERBOT_PATH_DISABLED } from '../twitch/twitch-native-authority.js';
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const integer = z.string().regex(/^(0|[1-9][0-9]*)$/).transform(Number).pipe(z.number().int().safe().nonnegative());
const schema = z.object({
  'operator-player': z.uuid(), 'expected-player': z.uuid(), 'twitch-id': z.string().regex(/^[1-9][0-9]{0,24}$/),
  'expected-revision': integer.pipe(z.number().positive()), acknowledgement: z.literal(STREAMERBOT_PATH_DISABLED),
  'confirm-backup-hash': digest, 'import-backup': z.string().min(1), output: z.string().min(1),
  'confirm-plan-hash': digest.optional(), 'expected-avatars': integer.optional(), 'expected-titles': integer.optional(),
}).strict();
export function parseCosmeticRepairArguments(args: readonly string[]) {
  const values: Record<string, string> = {};
  let apply = false;
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]!;
    if (flag === '--apply') { if (apply) throw new Error('COSMETIC_REPAIR_ARGUMENTS_INVALID'); apply = true; continue; }
    if (!flag.startsWith('--') || !args[index + 1] || args[index + 1]!.startsWith('--') || Object.hasOwn(values, flag.slice(2))) throw new Error('COSMETIC_REPAIR_ARGUMENTS_INVALID');
    values[flag.slice(2)] = args[++index]!;
  }
  const parsed = schema.safeParse(values);
  if (!parsed.success) throw new Error('COSMETIC_REPAIR_ARGUMENTS_INVALID');
  const confirmations = ['confirm-plan-hash', 'expected-avatars', 'expected-titles'] as const;
  if (confirmations.some(key => (parsed.data[key] !== undefined) !== apply)) throw new Error('COSMETIC_REPAIR_CONFIRMATIONS_REQUIRED');
  return { apply, values: parsed.data };
}
