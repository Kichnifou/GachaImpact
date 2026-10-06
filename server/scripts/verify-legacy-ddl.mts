import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL required');
const root = resolve('..');
const tempRoot = resolve(root, 'local-data');
const temp = await mkdtemp(join(tempRoot, 'legacy-ddl-'));
const schema = `legacy_ddl_${randomUUID().replaceAll('-', '')}`;
const expectedSchema = `legacy_expected_${randomUUID().replaceAll('-', '')}`;
const client = new pg.Client({ connectionString });
let created = false;
let expectedCreated = false;
try {
  const baseline = execFileSync('git', ['show', '5062aeda68ad77db11389f8980abc997c8695d5e:server/prisma/schema.prisma'], { cwd: root, encoding: 'utf8' });
  const baselinePath = join(temp, 'schema.prisma');
  await writeFile(baselinePath, baseline);
  const ddl = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', baselinePath, '--script'], { encoding: 'utf8' })
    .replace('CREATE SCHEMA IF NOT EXISTS "public";', '');
  if (/"public"\.|\bpublic\./.test(ddl)) throw new Error('Baseline DDL addresses public.');
  await client.connect();
  await client.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  await client.query(`REVOKE ALL ON SCHEMA "${schema}" FROM PUBLIC, anon, authenticated`);
  await client.query(`SET search_path TO "${schema}", public`);
  await client.query(ddl);
  // Prisma's schema diff omits the migration-only daily completion CHECK.
  await client.query(`ALTER TABLE "player_daily_challenges" ADD CONSTRAINT "player_daily_challenges_completion_check" CHECK (("status" = 'COMPLETED' AND "progress" = "target_snapshot" AND "completed_at" IS NOT NULL) OR ("status" <> 'COMPLETED' AND "completed_at" IS NULL))`);
  await client.query(`ALTER TABLE "player_permanent_mission_states" ADD CONSTRAINT "player_permanent_mission_states_unlock_check" CHECK ("z_unlocked_at" IS NULL OR "z_unlocked_at" >= "initialized_at")`);
  await client.query(`ALTER TABLE "player_daily_reward_state" ADD CONSTRAINT "player_daily_reward_state_claim_dates_check" CHECK (("first_claim_date" IS NULL AND "last_claim_date" IS NULL) OR ("first_claim_date" IS NOT NULL AND "last_claim_date" IS NOT NULL AND "first_claim_date" <= "last_claim_date"))`);
  await client.query(`ALTER TABLE "gift_codes" ADD CONSTRAINT "gift_codes_recurrence_check" CHECK (("type" = 'ANNUAL' AND "recurring_month" BETWEEN 1 AND 12 AND "starts_at" IS NULL AND "ends_at" IS NULL) OR ("type" = 'ONE_OFF' AND "recurring_month" IS NULL AND "starts_at" IS NOT NULL AND "ends_at" IS NOT NULL AND "ends_at" > "starts_at"))`);
  await client.query(`ALTER TABLE "event_game_b_daily_states" ADD CONSTRAINT "event_game_b_daily_states_solved_discoverer_check" CHECK ("discoverer_player_id" IS NULL OR "solved_at" IS NOT NULL)`);
  // The historical baseline is 049. Verify every subsequent migration against current HEAD.
  const migrations = (await readdir(join('prisma', 'migrations'), { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && entry.name > '20260926150000_049_add_twitch_pilot_identity_snapshot')
    .map(entry => entry.name).sort();
  for (const migration of migrations) {
    const sql = await readFile(join('prisma', 'migrations', migration, 'migration.sql'), 'utf8');
    if (/"public"\.|\bpublic\./.test(sql)) throw new Error(`${migration} addresses public.`);
    await client.query(sql);
  }
  const tables = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='r' AND c.relname IN ('migration_batches','migration_source_files','migration_mappings','migration_issues','boss_legacy_contributions','boss_legacy_aggregates','contest_legacy_daily_locks','friendship_legacy_heart_state','player_favor_states','favor_grants','favor_daily_claims','giveaway_sessions','giveaway_participants','giveaway_chat_stats','giveaway_wins','twitch_event_receipts','twitch_native_authorities','twitch_native_targets','twitch_native_audit','twitch_canary_imports','twitch_link_resolutions')`, [schema]);
  if (tables.rows[0]?.count !== '21') throw new Error('Expected 21 private foundation tables.');
  const security = await client.query<{ relname: string; relrowsecurity: boolean; anon: boolean; authenticated: boolean }>(`
    SELECT c.relname, c.relrowsecurity, has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS anon,
      has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS authenticated
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relname IN ('migration_batches','migration_source_files','migration_mappings','migration_issues','boss_legacy_contributions','boss_legacy_aggregates','contest_legacy_daily_locks','friendship_legacy_heart_state','player_favor_states','favor_grants','favor_daily_claims','giveaway_sessions','giveaway_participants','giveaway_chat_stats','giveaway_wins','twitch_event_receipts','twitch_native_authorities','twitch_native_targets','twitch_native_audit','twitch_canary_imports','twitch_link_resolutions')`, [schema]);
  if (security.rows.some(row => !row.relrowsecurity || row.anon || row.authenticated)) throw new Error('Private table security mismatch.');
  const policies = await client.query(`SELECT count(*)::text count FROM pg_policies WHERE schemaname=$1 AND tablename IN ('twitch_native_authorities','twitch_native_targets','twitch_native_audit','twitch_canary_imports','twitch_link_resolutions')`, [schema]);
  if (policies.rows[0]?.count !== '0') throw new Error('Native browser policies are forbidden.');
  const rejectCheck = async (sql: string) => {
    await client.query('BEGIN');
    try { await client.query(sql); throw new Error('Expected CHECK rejection.'); }
    catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === '23514')) throw error; }
    finally { await client.query('ROLLBACK'); }
  };
  await rejectCheck(`INSERT INTO twitch_native_authorities (id,desired_mode) VALUES ('twitch-commands','CANARY')`);
  await rejectCheck(`INSERT INTO twitch_native_targets (twitch_user_id,data_authority,transferred_at) VALUES ('900001','NATIVE',now())`);
  await rejectCheck(`INSERT INTO twitch_native_targets (twitch_user_id) VALUES ('not-numeric')`);
  const provenance = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM information_schema.columns WHERE table_schema=$1 AND column_name='legacy_provenance'`, [schema]);
  const expectedDdl = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' })
    .replace('CREATE SCHEMA IF NOT EXISTS "public";', '');
  if (/"public"\.|\bpublic\./.test(expectedDdl)) throw new Error('Expected schema DDL addresses public.');
  await client.query(`CREATE SCHEMA "${expectedSchema}"`);
  expectedCreated = true;
  await client.query(`SET search_path TO "${expectedSchema}", public`);
  await client.query(expectedDdl);
  const columns = await client.query<{ table_schema: string; table_name: string; column_name: string; udt_name: string; is_nullable: string }>(`
    SELECT table_schema, table_name, column_name, udt_name, is_nullable FROM information_schema.columns
    WHERE table_schema IN ($1, $2) ORDER BY table_name, column_name`, [schema, expectedSchema]);
  const shape = (name: string) => columns.rows.filter(row => row.table_schema === name)
    .map(({ table_name, column_name, udt_name, is_nullable }) => `${table_name}.${column_name}:${udt_name}:${is_nullable}`);
  const actualShape = shape(schema), expectedShape = shape(expectedSchema);
  const actualSet = new Set(actualShape), expectedSet = new Set(expectedShape);
  const missing = expectedShape.filter(column => !actualSet.has(column));
  const extra = actualShape.filter(column => !expectedSet.has(column));
  if (missing.length || extra.length) throw new Error(`Migrated columns differ from Prisma: missing=${missing.join(',')}; extra=${extra.join(',')}`);
  process.stdout.write(JSON.stringify({ privateSchema: true, foundationTables: security.rowCount, legacyProvenanceColumns: Number(provenance.rows[0]?.count), securityVerified: true, columnParity: actualShape.length }) + '\n');
} finally {
  if (expectedCreated) await client.query(`DROP SCHEMA "${expectedSchema}" CASCADE`);
  if (created) {
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  }
  if (!resolve(temp).startsWith(tempRoot + sep)) throw new Error('Unsafe temporary path.');
  await rm(temp, { recursive: true, force: true });
}
