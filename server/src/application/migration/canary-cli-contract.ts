import { z } from 'zod';
const modes = new Set(['plan', 'rehearse', 'apply', 'rollback']);
export function parseCanaryArguments(args: string[]) {
  const [mode, ...rest] = args;
  if (!mode || !modes.has(mode)) throw new Error('CANARY_ARGUMENTS_INVALID');
  const allowed = new Set(['snapshot', 'identities', 'twitch-id', 'expected-player', 'cutover-at', 'operator-player', 'schema', 'confirm-hash',
    'confirm-identity-report-hash', 'confirm-twitch-id', 'legacy-path-frozen', 'backup', 'confirm-backup-hash', 'restore-authority']);
  const values: Record<string, string> = {};
  while (rest.length) {
    const option = rest.shift()!, value = rest.shift();
    if (!option.startsWith('--') || !allowed.has(option.slice(2)) || !value || value.startsWith('--') || values[option.slice(2)]) throw new Error('CANARY_ARGUMENTS_INVALID');
    values[option.slice(2)] = value;
  }
  if (!/^[1-9][0-9]{0,127}$/.test(values['twitch-id'] ?? '') || !values['expected-player']
    || values['expected-player'] !== 'ABSENT' && !z.uuid().safeParse(values['expected-player']).success) throw new Error('CANARY_ARGUMENTS_INVALID');
  if (mode === 'apply' || mode === 'rollback') {
    if (values.schema !== 'public' || !z.uuid().safeParse(values['operator-player']).success || values['confirm-twitch-id'] !== values['twitch-id'])
      throw new Error('CANARY_PUBLIC_EXPLICIT_CONFIRMATIONS_REQUIRED');
  }
  return { mode, values };
}

const canaryBackupFields = { kind: z.literal('TARGETED_LEGACY_CANARY'), twitchUserId: z.string().regex(/^[1-9][0-9]{0,127}$/),
  hash: z.string().regex(/^[a-f0-9]{64}$/), snapshotHash: z.string().regex(/^[a-f0-9]{64}$/), identityReportHash: z.string().regex(/^[a-f0-9]{64}$/), target: z.object({
    twitchUserId: z.string(), playerId: z.uuid().nullable(), dataAuthority: z.literal('LEGACY'), canary: z.literal(false), acknowledgement: z.string().nullable(),
    transferredAt: z.iso.datetime().nullable(), updatedAt: z.iso.datetime() }).strict().nullable(),
  rows: z.object({ schema: z.string(), playerIds: z.array(z.uuid()).length(1), tables: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), z.array(z.string())),
    order: z.array(z.string()), hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict() };
export const canaryBackupSchema = z.discriminatedUnion('version', [
  z.object({ ...canaryBackupFields, version: z.literal(1) }).strict(),
  z.object({ ...canaryBackupFields, version: z.literal(2), retention: z.object({ version: z.literal(1), foreignKeys: z.array(z.string()),
    operations: z.array(z.string()), references: z.array(z.object({ foreignKey: z.string(), rows: z.array(z.string()) }).strict()) }).strict() }).strict(),
  z.object({ ...canaryBackupFields, version: z.literal(3), retention: z.object({ version: z.literal(1), foreignKeys: z.array(z.string()),
    operations: z.array(z.string()), references: z.array(z.object({ foreignKey: z.string(), rows: z.array(z.string()) }).strict()) }).strict(),
    social: z.object({ version: z.literal(1), schema: z.string(), sourcePairKeyHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)), playerIds: z.array(z.uuid()),
      rows: z.object({ legacy_friendship_facts: z.array(z.string()), friendships: z.array(z.string()), friend_hearts: z.array(z.string()), friendship_legacy_heart_state: z.array(z.string()) }).strict(),
      hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict() }).strict(),
  z.object({ ...canaryBackupFields, version: z.literal(4), retention: z.object({ version: z.literal(1), foreignKeys: z.array(z.string()),
    operations: z.array(z.string()), references: z.array(z.object({ foreignKey: z.string(), rows: z.array(z.string()) }).strict()) }).strict(),
    social: z.object({ version: z.literal(1), schema: z.string(), sourcePairKeyHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)), playerIds: z.array(z.uuid()),
      rows: z.object({ legacy_friendship_facts: z.array(z.string()), friendships: z.array(z.string()), friend_hearts: z.array(z.string()), friendship_legacy_heart_state: z.array(z.string()) }).strict(),
      hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
    recovery: z.object({ operationId: z.uuid(), populationHash: z.string().regex(/^[a-f0-9]{64}$/), externalVotes: z.array(z.string()) }).strict(),
  }).strict(),
]);
