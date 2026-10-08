import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import { loadConfig } from '../src/config/environment.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { checkedIdentityFile, readLocalIdentityJson } from '../src/application/migration/local-identity-file.js';
import { loadLocalOperatorSnapshot } from '../src/application/migration/local-operator-snapshot.js';
import { validateHistoricalTwitchReport } from '../src/application/migration/verified-twitch-report.js';
import { applyLegacySocialPair, legacySocialBackupSchema, planLegacySocialPair, rollbackLegacySocialPair } from '../src/application/migration/legacy-friendship-operator.js';

async function main() {
  const args = process.argv.slice(2), mode = args.shift();
  if (!mode || !['plan', 'apply', 'rollback'].includes(mode)) throw Error('LEGACY_SOCIAL_ARGUMENTS_INVALID');
  const required = ['operator-player', 'expected-revision', ...(mode === 'rollback' ? ['backup', 'confirm-backup-hash', 'legacy-path-frozen']
    : ['snapshot', 'report-left', 'report-right', 'source-pair-hash', 'output', ...(mode === 'apply' ? ['operation-id', 'confirm-plan-hash', 'legacy-path-frozen'] : [])])];
  const values: Record<string, string> = {};
  while (args.length) {
    const raw = args.shift()!, value = args.shift(), key = raw.slice(2);
    if (!raw.startsWith('--') || !required.includes(key) || !value || value.startsWith('--') || values[key]) throw Error('LEGACY_SOCIAL_ARGUMENTS_INVALID');
    values[key] = value;
  }
  if (required.some(key => !values[key]) || !/^(0|[1-9][0-9]*)$/.test(values['expected-revision']!)) throw Error('LEGACY_SOCIAL_ARGUMENTS_INVALID');
  const config = loadConfig(), db = createDatabase(config.databaseUrl!);
  try {
    if ((await db.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`)[0]?.schema !== 'public') throw Error('LEGACY_SOCIAL_PUBLIC_SCHEMA_REQUIRED');
    const scope = { operatorPlayerId: values['operator-player']!, expectedRevision: Number(values['expected-revision']) };
    if (mode === 'rollback') {
      const backup = legacySocialBackupSchema.parse(await readLocalIdentityJson(values.backup!));
      if (backup.preimage.schema !== 'public') throw Error('LEGACY_SOCIAL_BACKUP_INVALID');
      const result = await rollbackLegacySocialPair(db, config, { ...scope, backup, expectedBackupHash: values['confirm-backup-hash']!, acknowledgement: values['legacy-path-frozen']! });
      process.stdout.write(JSON.stringify(result) + '\n');
      return;
    }
    const snapshot = await loadLocalOperatorSnapshot(values.snapshot!);
    const reports = [validateHistoricalTwitchReport(await readLocalIdentityJson(values['report-left']!)), validateHistoricalTwitchReport(await readLocalIdentityJson(values['report-right']!))];
    const write = async (value: unknown) => {
      const output = await checkedIdentityFile(values.output!, true);
      const file = await open(output, 'wx', 0o600);
      try { await file.writeFile(JSON.stringify(value)); await file.sync(); } finally { await file.close(); }
    };
    const input = { ...scope, snapshot, reports, sourcePairKeyHash: values['source-pair-hash']! };
    if (mode === 'plan') {
      const plan = await planLegacySocialPair(db, config, input), operationId = randomUUID();
      await write({ kind: 'TARGETED_LEGACY_SOCIAL', version: 1, mode: 'READ_ONLY', operationId, ...plan });
      process.stdout.write(JSON.stringify({ status: plan.status, fingerprint: plan.fingerprint, operationId, materialized: plan.materialized, deferred: plan.deferred, retained: plan.retained }) + '\n');
    } else {
      const result = await applyLegacySocialPair(db, config, { ...input, operationId: values['operation-id']!, expectedFingerprint: values['confirm-plan-hash']!, acknowledgement: values['legacy-path-frozen']! }, write);
      process.stdout.write(JSON.stringify(result) + '\n');
    }
  } finally { await db.$disconnect(); }
}
main().catch(error => {
  const code = error instanceof Error && /^(LEGACY_SOCIAL|LEGACY_FRIENDSHIP|TWITCH_REPORT)_[A-Z_]+$/.test(error.message) ? error.message : 'LEGACY_SOCIAL_FAILED_CLOSED';
  process.stderr.write(`${code}: contrôler les preuves, le scope exact, OFF, le plan et le backup privés.\n`);
  process.exitCode = 1;
});
