import 'dotenv/config';
import { parseImportedCanaryArguments } from '../src/application/twitch/imported-canary-cli-contract.js';
import { TwitchNativeAuthority } from '../src/application/twitch/twitch-native-authority.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { loadConfig } from '../src/config/environment.js';

async function main() {
  const args = parseImportedCanaryArguments(process.argv.slice(2)), config = loadConfig();
  const db = createDatabase(config.databaseUrl!);
  try {
    const schema = await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`;
    if (schema[0]?.current_schema !== 'public') throw new Error('IMPORTED_CANARY_PUBLIC_SCHEMA_REQUIRED');
    const result = await new TwitchNativeAuthority(db, config).extendImportedCanary(args['operator-player'],
      args['twitch-id'], args['expected-player'], args['confirm-backup-hash'], args.acknowledgement, args['expected-revision']);
    process.stdout.write(JSON.stringify({ status: 'AUTHORITY_TRANSFERRED', desiredMode: result.desiredMode,
      revision: result.revision, scope: 'ONE_ADDED_IMPORTED_TARGET' }) + '\n');
  } finally { await db.$disconnect(); }
}
main().catch(() => { process.stderr.write('IMPORTED_CANARY_EXTENSION_FAILED_CLOSED: contrôlez opérateur, ensemble existant, cible, import, autorité et confirmations.\n'); process.exitCode = 1; });
