import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { permanentMissionCatalog } from '../src/domain/missions/permanent-mission-catalog.js';

// Every mutable table and enum lives in this run's private schema, never public.
export function isolatedBatchDatabase() {
  const schema = `batch_test_${randomUUID().replaceAll('-', '')}`;
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL required');
  const admin = new pg.Client({ connectionString });
  // A private suite needs only a small pool. Keeping it bounded prevents a
  // long sequential run from exhausting Supabase's shared connection limit.
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString, options: `-c search_path=${schema},public`, max: 2, idleTimeoutMillis: 1_000 }, { schema }) });
  let created = false;
  return { database, admin, schema,
    async setup(options: { seedPublicCatalog?: boolean } = {}) {
      await admin.connect();
      await admin.query(`CREATE SCHEMA "${schema}"`); created = true;
      await admin.query(`REVOKE ALL ON SCHEMA "${schema}" FROM PUBLIC, anon, authenticated`);
      await admin.query(`SET search_path TO "${schema}", public`);
      const ddl = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' }).replace('CREATE SCHEMA IF NOT EXISTS "public";', '');
      if (/"public"\.|\bpublic\./.test(ddl)) throw new Error('Fixture DDL targets public');
      await admin.query(ddl);
      await admin.query(`REVOKE ALL ON ALL TABLES IN SCHEMA "${schema}" FROM PUBLIC, anon, authenticated`);
      const currentSchema = (await database.$queryRawUnsafe<{ current_schema: string }[]>('SELECT current_schema()'))[0]?.current_schema;
      if (currentSchema !== schema) throw new Error(`Mutable DB fixture escaped its private schema: ${currentSchema}`);
      if (options.seedPublicCatalog) {
        // Only immutable/reference catalogs are read from public. No Player or business row is copied.
        for (const table of ['elements', 'resource_definitions', 'characters', 'item_definitions', 'daily_challenge_definitions', 'shop_item_definitions', 'event_definitions', 'element_combat_matchups']) {
          await admin.query(`INSERT INTO "${schema}"."${table}" SELECT * FROM public."${table}"`);
        }
        // Rotation and featured slots are reference state for pull tests. JSON
        // conversion maps public enum values into this schema's enum types.
        for (const table of ['banner_rotations', 'banner_featured_characters']) {
          await admin.query(`INSERT INTO "${schema}"."${table}" SELECT (json_populate_record(NULL::"${schema}"."${table}", to_json(row))).* FROM public."${table}" AS row`);
        }
        await admin.query(`INSERT INTO "${schema}"."event_editions" SELECT (json_populate_record(NULL::"${schema}"."event_editions", to_json(row))).* FROM public."event_editions" AS row`);
        // Annual Festival codes are system catalog. Operator-authored codes and
        // all claims stay out of the fixture.
        await admin.query(`INSERT INTO "${schema}"."gift_codes" SELECT (jsonb_populate_record(NULL::"${schema}"."gift_codes", to_jsonb(row) || '{"created_by_id":null,"updated_by_id":null}'::jsonb)).* FROM public."gift_codes" AS row WHERE row.token LIKE 'FESTIVAL%'`);
        for (const table of ['gift_code_editions', 'gift_code_rewards']) {
          await admin.query(`INSERT INTO "${schema}"."${table}" SELECT * FROM public."${table}" WHERE gift_code_id IN (SELECT id FROM "${schema}"."gift_codes")`);
        }
        // Prisma's schema diff omits migration-only CHECK constraints, partial
        // indexes and RLS flags. Mirror those physical guards into the private
        // schema so DB tests exercise the same invariants as DEV.
        const checks = await admin.query<{ table_name: string; name: string; definition: string }>(`
          SELECT t.relname AS table_name, c.conname AS name, pg_get_constraintdef(c.oid) AS definition
          FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public' AND t.relname <> '_prisma_migrations' AND c.contype = 'c'
            AND NOT EXISTS (SELECT 1 FROM pg_constraint local JOIN pg_class lt ON lt.oid = local.conrelid JOIN pg_namespace ln ON ln.oid = lt.relnamespace
              WHERE ln.nspname = $1 AND lt.relname = t.relname AND local.conname = c.conname)
          ORDER BY t.relname, c.conname`, [schema]);
        const indexes = await admin.query<{ table_name: string; name: string; definition: string }>(`
          SELECT t.relname AS table_name, ix.relname AS name, pg_get_indexdef(i.indexrelid) AS definition
          FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace JOIN pg_class ix ON ix.oid = i.indexrelid
          WHERE n.nspname = 'public' AND t.relname <> '_prisma_migrations' AND NOT EXISTS (SELECT 1 FROM pg_class local JOIN pg_namespace ln ON ln.oid = local.relnamespace
            WHERE ln.nspname = $1 AND local.relname = ix.relname)
          ORDER BY ix.relname`, [schema]);
        const rls = await admin.query<{ table_name: string }>(`
          SELECT t.relname AS table_name FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public' AND t.relkind = 'r' AND t.relrowsecurity AND t.relname <> '_prisma_migrations' ORDER BY t.relname`);
        const physicalSql: string[] = [];
        for (const { table_name, name, definition } of checks.rows) {
          const localDefinition = definition.replaceAll('::public.', `::"${schema}".`);
          if (!/^[a-z0-9_]+$/.test(table_name) || !/^[a-z0-9_]+$/.test(name) || /;|\bpublic\./i.test(localDefinition)) throw new Error(`Unsafe CHECK fixture: ${table_name}.${name}: ${definition}`);
          physicalSql.push(`ALTER TABLE "${schema}"."${table_name}" ADD CONSTRAINT "${name}" ${localDefinition};`);
        }
        for (const { table_name, name, definition } of indexes.rows) {
          if (!/^[a-z0-9_]+$/.test(table_name) || !/^[a-z0-9_]+$/.test(name)) throw new Error(`Unsafe index fixture: ${table_name}.${name}`);
          const localDefinition = definition.replace(` ON public.${table_name} `, ` ON "${schema}"."${table_name}" `).replaceAll('::public.', `::"${schema}".`);
          if (localDefinition === definition || /;|\bpublic\./i.test(localDefinition)) throw new Error(`Unsafe index DDL fixture: ${name}`);
          physicalSql.push(`${localDefinition};`);
        }
        for (const { table_name } of rls.rows) {
          if (!/^[a-z0-9_]+$/.test(table_name)) throw new Error(`Unsafe RLS fixture: ${table_name}`);
          physicalSql.push(`ALTER TABLE "${schema}"."${table_name}" ENABLE ROW LEVEL SECURITY;`);
        }
        await admin.query(physicalSql.join('\n'));
      }
      await database.permanentMissionDefinition.createMany({ data: permanentMissionCatalog.map(entry => ({ ...entry })) });
    },
    async installMigrationOnlySql(path: URL) {
      const sql = readFileSync(path, 'utf8');
      if (/\bpublic\.|"public"\./i.test(sql)) throw new Error(`Migration fixture SQL must not address public: ${path.pathname}`);
      await admin.query(sql);
    },
    async cleanup() {
      await database.$disconnect();
      if (created && /^batch_test_[0-9a-f]{32}$/.test(schema)) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    },
  };
}
