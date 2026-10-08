import 'dotenv/config';
import { open } from 'node:fs/promises';
import { z } from 'zod';
import { loadConfig } from '../src/config/environment.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { checkedIdentityFile } from '../src/application/migration/local-identity-file.js';
import { TwitchCanonicalizationOperator } from '../src/application/twitch/twitch-canonicalization-operator.js';

// Local operator authorization only. Never performs OAuth, chooses or closes a relation.
async function main() {
  const args = process.argv.slice(2), values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index], value = args[index + 1];
    if (!key?.startsWith('--') || !value || Object.hasOwn(values, key.slice(2))) throw Error('ARGUMENTS_INVALID');
    values[key.slice(2)] = value;
  }
  const parsed = z.object({ 'operator-player': z.uuid(), 'web-identity': z.uuid(), 'expected-web-player': z.uuid(),
    'twitch-id': z.string().regex(/^[1-9][0-9]{0,127}$/), choice: z.enum(['WEB', 'TWITCH']),
    'expected-revision': z.coerce.number().int().min(1), acknowledgement: z.literal('STREAMERBOT_PATH_DISABLED'),
    output: z.string().min(1) }).strict().parse(values);
  const output = await checkedIdentityFile(parsed.output, true), config = loadConfig(), db = createDatabase(config.databaseUrl!);
  try {
    const plan = await new TwitchCanonicalizationOperator(db, config).prepare({ operatorPlayerId: parsed['operator-player'],
      webIdentityId: parsed['web-identity'], expectedWebPlayerId: parsed['expected-web-player'], twitchUserId: parsed['twitch-id'],
      choice: parsed.choice, expectedRevision: parsed['expected-revision'], acknowledgement: parsed.acknowledgement }, async backup => {
      const file = await open(output, 'wx', 0o600);
      try { await file.writeFile(JSON.stringify(backup)); await file.sync(); } finally { await file.close(); }
    });
    // Plan IDs and the backup remain in the private local artifact, never the terminal.
    const receipt = await open(await checkedIdentityFile(`${output}.plan.json`, true), 'wx', 0o600);
    try { await receipt.writeFile(JSON.stringify(plan)); await receipt.sync(); } finally { await receipt.close(); }
    process.stdout.write(JSON.stringify({ authorized: true, choice: parsed.choice, expiresAt: plan.expiresAt, consequences: plan.consequences, publicChoiceExecuted: false }) + '\n');
  } finally { await db.$disconnect(); }
}
main().catch(() => { process.stderr.write('R1055_OPERATOR_PLAN_FAILED_CLOSED\n'); process.exitCode = 1; });
