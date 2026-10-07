import 'dotenv/config';
import { parseExecutingPityRecoveryArguments } from '../src/application/twitch/executing-pity-recovery-contract.js';
import { createRuntimeDependencies } from '../src/infrastructure/runtime-dependencies.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { loadConfig } from '../src/config/environment.js';

async function main() {
  const { request, apply } = parseExecutingPityRecoveryArguments(process.argv.slice(2)), config = loadConfig();
  const check = createDatabase(config.databaseUrl!);
  try {
    const schema = await check.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`;
    if (schema[0]?.current_schema !== 'public') throw new Error('EXECUTING_PITY_RECOVERY_PUBLIC_SCHEMA_REQUIRED');
  } finally { await check.$disconnect(); }
  // Construction only: never start schedulers, HTTP server or subscriptions.
  const runtime = createRuntimeDependencies(config);
  try {
    if (!runtime.twitchCommandPilot) throw new Error('EXECUTING_PITY_RECOVERY_UNAVAILABLE');
    const result = await runtime.twitchCommandPilot.recoverExecutingPity(request, apply);
    process.stdout.write(JSON.stringify({ status: result.state, responses: result.responses, scope: 'ONE_EXISTING_READ_ONLY_PITY' }) + '\n');
    if (apply && result.state !== 'PROCESSED') process.exitCode = 1;
  } finally { await runtime.close(); }
}
main().catch(() => { process.stderr.write('EXECUTING_PITY_RECOVERY_FAILED_CLOSED: contrôlez les preuves exactes ; ne pas modifier le receipt ni rejouer automatiquement.\n'); process.exitCode = 1; });
