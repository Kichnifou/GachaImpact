import 'dotenv/config';
import { mkdir, open } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseCanaryArguments, canaryBackupSchema } from '../src/application/migration/canary-cli-contract.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { loadConfig } from '../src/config/environment.js';
import { loadLocalOperatorSnapshot } from '../src/application/migration/local-operator-snapshot.js';
import { checkedIdentityFile, readLocalIdentityJson, identityReportDirectory } from '../src/application/migration/local-identity-file.js';
import { applyLegacyCanary, planLegacyCanary, rollbackLegacyCanary, canarySummary, canaryBackupHash, type CanaryBackup } from '../src/application/migration/legacy-canary.js';
import { TwitchNativeAuthority, STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { isolatedBatchDatabase } from '../tests-db/isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { captureTargetedPlayerRows, rowGraphHash } from '../src/application/migration/targeted-player-rows.js';


async function main() {
  const { mode, values } = parseCanaryArguments(process.argv.slice(2));
  const config = loadConfig(), db = createDatabase(config.databaseUrl!);
  try {
    if (mode === 'rollback') {
      const parsed = canaryBackupSchema.safeParse(await readLocalIdentityJson(values.backup ?? ''));
      if (!parsed.success) throw new Error('CANARY_BACKUP_INVALID');
      const backup = parsed.data as unknown as CanaryBackup;
      const { hash, ...preimage } = backup;
      if (canaryBackupHash(preimage) !== hash || backup.rows.schema !== 'public' || backup.twitchUserId !== values['twitch-id'] || backup.rows.playerIds[0] !== values['expected-player']
        || rowGraphHash(backup.rows.tables) !== backup.rows.hash || values['confirm-backup-hash'] !== backup.hash || values['restore-authority'] !== 'LEGACY')
        throw new Error('CANARY_ROLLBACK_CONFIRMATIONS_REQUIRED');
      await new TwitchNativeAuthority(db, config).relinquishForRollback(values['operator-player']!, backup.twitchUserId, backup.hash);
      process.stdout.write(JSON.stringify(await rollbackLegacyCanary(db, config, values['operator-player']!, backup)) + '\n');
      return;
    }
    if (!values.snapshot || !values.identities || !values['cutover-at']) throw new Error('CANARY_ARGUMENTS_INVALID');
    const snapshot = await loadLocalOperatorSnapshot(values.snapshot), rawReport = await readLocalIdentityJson(values.identities);
    const expectedPlayer = values['expected-player'] === 'ABSENT' ? null : values['expected-player']!;
    if (mode === 'rehearse') {
      // Mutations occur only in two fresh private fixtures; no public account/gameplay is copied.
      for (const existing of [false, true]) {
        const fixture = isolatedBatchDatabase(), testDb = fixture.database;
        try {
          await fixture.setup({ seedPublicCatalog: true });
          const operator = await testDb.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private operator',
            twitchIdentity: { twitchUserId: '900000000000000001', login: 'kichnifou', displayName: 'Private operator', firstSeenAt: new Date() } }));
          await testDb.playerRoleAssignment.create({ data: { playerId: operator.id, role: 'ADMIN', source: 'private-canary-rehearsal' } });
          const privateConfig = { ...config, twitch: { ...config.twitch!, pilotPlayerIds: [operator.id], pilotLogin: 'kichnifou' } };
          let expected: string | null = null;
          if (existing) {
            const target = await testDb.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Standalone preimage',
              webIdentity: { provider: 'supabase', providerSubject: randomUUID() }, twitchIdentity: {
                twitchUserId: values['twitch-id']!, login: 'private_metadata', displayName: 'Private metadata', firstSeenAt: new Date() } }));
            expected = target.id;
            await testDb.playerProgression.update({ where: { playerId: target.id }, data: { xp: 777n } });
            await testDb.playerRoleAssignment.create({ data: { playerId: target.id, role: 'TESTER', source: 'private-preimage' } });
            await testDb.playerPreference.create({ data: { playerId: target.id, preferenceKey: 'menu.defaultTab', value: 'inventory' } });
          }
          const plan = await planLegacyCanary(testDb, snapshot, rawReport, values['twitch-id']!, expected, new Date(values['cutover-at']!));
          let backup!: CanaryBackup;
          const applied = await applyLegacyCanary(testDb, privateConfig, operator.id, plan, STREAMERBOT_PATH_DISABLED, async value => { backup = value; });
          if ((await testDb.webIdentity.count({ where: { playerId: applied.playerId } })) !== (existing ? 1 : 0)) throw new Error('CANARY_WEB_IDENTITY_MISMATCH');
          await rollbackLegacyCanary(testDb, privateConfig, operator.id, backup);
          const restored = await captureTargetedPlayerRows(testDb, backup.rows.playerIds);
          if (restored.hash !== backup.rows.hash) throw new Error('CANARY_ROLLBACK_PREIMAGE_MISMATCH');
          process.stdout.write(JSON.stringify({ mode: existing ? 'EXISTING_VERIFIED_TWITCH' : 'TWITCH_ONLY', ...canarySummary(plan),
            applied: 'PRIVATE_ONLY', rollback: 'EXACT_PREIMAGE', publicApplyExecuted: false }) + '\n');
        } finally { await fixture.cleanup(); }
      }
      return;
    }
    const plan = await planLegacyCanary(db, snapshot, rawReport, values['twitch-id']!, expectedPlayer, new Date(values['cutover-at']));
    process.stdout.write(JSON.stringify(canarySummary(plan)) + '\n');
    if (mode === 'plan') return;
    if (values['confirm-hash'] !== plan.snapshot.hash || values['confirm-identity-report-hash'] !== plan.identityReportHash
      || values['legacy-path-frozen'] !== STREAMERBOT_PATH_DISABLED || plan.blockers.length) throw new Error('CANARY_PUBLIC_EXPLICIT_CONFIRMATIONS_REQUIRED');
    await mkdir(identityReportDirectory(), { recursive: true });
    const backupFile = await checkedIdentityFile(resolve(identityReportDirectory(), `canary-backup-${randomUUID()}.json`), true);
    const result = await applyLegacyCanary(db, config, values['operator-player']!, plan, values['legacy-path-frozen'],
      async backup => { const file = await open(backupFile, 'wx', 0o600); try { await file.writeFile(JSON.stringify(backup)); await file.sync(); } finally { await file.close(); } });
    process.stdout.write(JSON.stringify({ status: result.status, backupHash: result.backupHash, backupCreated: true, backupFileName: basename(backupFile), dataAuthority: result.dataAuthority }) + '\n');
  } finally { await db.$disconnect(); }
}
main().catch(() => { process.stderr.write('CANARY_FAILED_CLOSED: contrôlez le plan, les confirmations, la preuve et le backup locaux.\n'); process.exitCode = 1; });
