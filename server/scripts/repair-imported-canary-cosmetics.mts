import 'dotenv/config';
import { open } from 'node:fs/promises';
import { loadConfig } from '../src/config/environment.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { checkedIdentityFile, readLocalIdentityJson } from '../src/application/migration/local-identity-file.js';
import { canaryBackupSchema } from '../src/application/migration/canary-cli-contract.js';
import { canaryBackupHash, type CanaryBackup } from '../src/application/migration/legacy-canary.js';
import { rowGraphHash } from '../src/application/migration/targeted-player-rows.js';
import { parseCosmeticRepairArguments } from '../src/application/migration/cosmetic-repair-cli-contract.js';
import { applyImportedCanaryCosmeticRepair, planImportedCanaryCosmeticRepair } from '../src/application/migration/repair-imported-canary-cosmetics.js';

async function main() {
  const { apply, values } = parseCosmeticRepairArguments(process.argv.slice(2));
  const backup = canaryBackupSchema.parse(await readLocalIdentityJson(values['import-backup'])) as CanaryBackup;
  const { hash, ...preimage } = backup;
  if (backup.hash !== values['confirm-backup-hash'] || canaryBackupHash(preimage) !== hash || rowGraphHash(backup.rows.tables) !== backup.rows.hash
    || backup.rows.schema !== 'public' || backup.rows.playerIds.length !== 1 || backup.rows.playerIds[0] !== values['expected-player'] || backup.twitchUserId !== values['twitch-id']) throw new Error('COSMETIC_REPAIR_BACKUP_MISMATCH');
  const output = await checkedIdentityFile(values.output, true);
  const write = async (value: unknown) => { const file = await open(output, 'wx', 0o600); try { await file.writeFile(JSON.stringify(value)); await file.sync(); } finally { await file.close(); } };
  const config = loadConfig(), db = createDatabase(config.databaseUrl!);
  try {
    if ((await db.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`)[0]?.schema !== 'public') throw new Error('COSMETIC_REPAIR_PUBLIC_SCHEMA_REQUIRED');
    const scope = { actorPlayerId: values['operator-player'], playerId: values['expected-player'], twitchUserId: values['twitch-id'], backupHash: values['confirm-backup-hash'], expectedRevision: values['expected-revision'], acknowledgement: values.acknowledgement };
    if (!apply) {
      const plan = await planImportedCanaryCosmeticRepair(db, config, scope);
      await write({ kind: 'IMPORTED_CANARY_DERIVED_COSMETIC_REPAIR', version: 1, mode: 'DRY_RUN', ...plan });
      process.stdout.write(JSON.stringify({ status: 'DRY_RUN', avatars: plan.missingAvatars, titles: plan.missingTitles }) + '\n');
    } else {
      const result = await applyImportedCanaryCosmeticRepair(db, config, scope, { planHash: values['confirm-plan-hash']!, avatars: values['expected-avatars']!, titles: values['expected-titles']! },
        plan => write({ kind: 'IMPORTED_CANARY_DERIVED_COSMETIC_REPAIR', version: 1, mode: 'PREIMAGE', ...plan }));
      process.stdout.write(JSON.stringify(result) + '\n');
    }
  } finally { await db.$disconnect(); }
}
main().catch(() => { process.stderr.write('COSMETIC_REPAIR_FAILED_CLOSED: contrôlez le scope immuable, OFF, les imports/backups, le plan et les opérations en cours.\n'); process.exitCode = 1; });
