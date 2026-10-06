import 'dotenv/config';
import { parseQuotisReconciliationArguments, reconcileQuotisPreparation } from '../src/application/twitch/reconcile-quotis-preparation.js';
import { loadConfig } from '../src/config/environment.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';

async function main() {
  const args = parseQuotisReconciliationArguments(process.argv.slice(2)), config = loadConfig();
  const db = createDatabase(config.databaseUrl!);
  try {
    const schema = await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`;
    if (schema[0]?.current_schema !== 'public') throw new Error('QUOTIS_RECONCILIATION_PUBLIC_SCHEMA_REQUIRED');
    const result = await reconcileQuotisPreparation(db, config, args);
    process.stdout.write(JSON.stringify(result) + '\n');
  } finally { await db.$disconnect(); }
}
main().catch(() => { process.stderr.write('QUOTIS_RECONCILIATION_FAILED_CLOSED: contrôlez opérateur, désarmement, révision, cible et les deux receipts.\n'); process.exitCode = 1; });
