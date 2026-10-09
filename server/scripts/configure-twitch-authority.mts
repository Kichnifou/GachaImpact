import 'dotenv/config';
import { parseNativeAuthorityArguments } from '../src/application/twitch/native-authority-cli-contract.js';
import { TwitchNativeAuthority } from '../src/application/twitch/twitch-native-authority.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { loadConfig } from '../src/config/environment.js';

/** Controlled transition only; never imports, promotes targets or edits credentials.
 * Transport, backup and exact deployment gates are required by the runbook. */
async function main() {
  const args = parseNativeAuthorityArguments(process.argv.slice(2)), config = loadConfig();
  const db = createDatabase(config.databaseUrl!);
  try {
    const schema = await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`;
    if (schema[0]?.current_schema !== 'public') throw Error('TWITCH_NATIVE_PUBLIC_SCHEMA_REQUIRED');
    const owner = new TwitchNativeAuthority(db, config);
    const result = args.mode === 'CANARY'
      ? await owner.resumePersistedCanary(args['operator-player'], args.acknowledgement, args['expected-revision'])
      : await owner.configure(args['operator-player'], args.mode, [], args.acknowledgement, args['expected-revision']);
    process.stdout.write(JSON.stringify({ status: 'AUTHORITY_CONFIGURED', desiredMode: result.desiredMode, revision: result.revision }) + '\n');
  } finally { await db.$disconnect(); }
}
main().catch(error => { process.stderr.write(`TWITCH_NATIVE_FAILED_CLOSED: ${typeof error?.code === 'string' ? error.code : 'CHECK_PARAMETERS_AND_GATES'}\n`); process.exitCode = 1; });
