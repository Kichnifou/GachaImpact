import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

// Every mutable table and enum lives in this run's private schema, never public.
export function isolatedBatchDatabase() {
  const schema = `batch_test_${randomUUID().replaceAll('-', '')}`;
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL required');
  const admin = new pg.Client({ connectionString });
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString, options: `-c search_path=${schema},public` }, { schema }) });
  let created = false;
  return { database, admin, schema,
    async setup() {
      await admin.connect();
      await admin.query(`CREATE SCHEMA "${schema}"`); created = true;
      await admin.query(`REVOKE ALL ON SCHEMA "${schema}" FROM PUBLIC, anon, authenticated`);
      await admin.query(`SET search_path TO "${schema}", public`);
      const ddl = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' }).replace('CREATE SCHEMA IF NOT EXISTS "public";', '');
      if (/"public"\.|\bpublic\./.test(ddl)) throw new Error('Fixture DDL targets public');
      await admin.query(ddl);
      await admin.query(`REVOKE ALL ON ALL TABLES IN SCHEMA "${schema}" FROM PUBLIC, anon, authenticated`);
    },
    async cleanup() {
      await database.$disconnect();
      if (created && /^batch_test_[0-9a-f]{32}$/.test(schema)) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    },
  };
}
