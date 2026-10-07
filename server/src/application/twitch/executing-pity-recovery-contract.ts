import { z } from 'zod';

export const executingPityRecoveryRequest = z.object({
  operatorPlayerId: z.uuid(), receiptId: z.uuid(), expectedPlayerId: z.uuid(),
  twitchUserId: z.string().regex(/^[1-9][0-9]{0,127}$/),
  expectedRevision: z.number().int().positive().max(2_147_483_647),
  commandKey: z.string().min(1).max(512), businessAt: z.iso.datetime(),
  acknowledgement: z.literal('STREAMERBOT_PATH_DISABLED'),
}).strict();
export type ExecutingPityRecoveryRequest = z.infer<typeof executingPityRecoveryRequest>;

/** No handler, target selection, identity lookup by name, batch or force option. */
export function parseExecutingPityRecoveryArguments(argv: readonly string[]) {
  const values: Record<string, string> = {};
  let apply = false;
  const flags = new Set(['operator-player', 'receipt', 'expected-player', 'twitch-id', 'expected-revision', 'command-key', 'business-at', 'acknowledgement']);
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]!;
    if (flag === '--apply' && !apply) { apply = true; continue; }
    const name = flag.slice(2), value = argv[++index];
    if (!flag.startsWith('--') || !flags.has(name) || Object.hasOwn(values, name) || !value || value.startsWith('--')) throw new Error('EXECUTING_PITY_RECOVERY_ARGUMENTS_INVALID');
    values[name] = value;
  }
  if (!/^[1-9][0-9]*$/.test(values['expected-revision'] ?? '')) throw new Error('EXECUTING_PITY_RECOVERY_ARGUMENTS_INVALID');
  const request = executingPityRecoveryRequest.parse({ operatorPlayerId: values['operator-player'], receiptId: values.receipt,
    expectedPlayerId: values['expected-player'], twitchUserId: values['twitch-id'], expectedRevision: Number(values['expected-revision']),
    commandKey: values['command-key'], businessAt: values['business-at'], acknowledgement: values.acknowledgement });
  return { request, apply };
}
