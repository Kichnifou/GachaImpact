import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import type pg from 'pg';

/** Same private boundary as ordinary DB suites, exercising actual Prisma deploy instead of schema diff. */
export async function rehearsePrivateMigrations(admin: pg.Client, schema: string, connectionString: string) {
  if (!/^batch_test_[0-9a-f]{32}$/.test(schema)) throw Error('Unsafe migration schema');
  const root = mkdtempSync(path.join(tmpdir(), 'gacha-private-ddl-')), migrationRoot = path.join(root, 'migrations');
  const cleanup = () => {
    const resolved = path.resolve(root);
    if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('gacha-private-ddl-')) throw Error('Unsafe temporary directory');
    rmSync(resolved, { recursive: true });
  };
  try {
    const folders = readdirSync('prisma/migrations', { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    const privateUrl = new URL(connectionString); privateUrl.searchParams.set('schema', schema);
    const run = promisify(execFile);
    const prisma = async (action: 'deploy' | 'status') => (await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', action, '--config', path.join(root, 'prisma.config.mts')],
      { env: { ...process.env, DATABASE_URL: privateUrl.toString() }, timeout: 120_000 })).stdout;
    mkdirSync(migrationRoot); writeFileSync(path.join(migrationRoot, 'migration_lock.toml'), 'provider = "postgresql"\n');
    const configModule = createRequire(import.meta.url).resolve('prisma/config').replaceAll('\\', '/');
    writeFileSync(path.join(root, 'prisma.config.mts'), `import { defineConfig } from ${JSON.stringify(configModule)}; export default defineConfig({ schema: ${JSON.stringify(path.resolve('prisma/schema.prisma'))}, migrations: { path: ${JSON.stringify(migrationRoot)} }, datasource: { url: process.env.DATABASE_URL } });`);
    const copy = (name: string) => {
      mkdirSync(path.join(migrationRoot, name)); const sql = readFileSync(path.join('prisma/migrations', name, 'migration.sql'), 'utf8');
      // Historical 030/047 explicitly target public functions. Rehearsal changes only those schema names.
      const isolated = sql.replaceAll('FUNCTION public.', `FUNCTION "${schema}".`).replaceAll('search_path = pg_catalog, public', `search_path = pg_catalog, "${schema}"`);
      if (/\bpublic\.|"public"\./i.test(isolated)) throw Error('Private migration addresses public');
      writeFileSync(path.join(migrationRoot, name, 'migration.sql'), isolated);
    };
    copy(folders[0]!); await prisma('deploy');
    for (const table of ['elements', 'resource_definitions']) await admin.query(`INSERT INTO "${schema}"."${table}" SELECT * FROM public."${table}"`);
    for (const folder of folders.slice(1)) copy(folder);
    await prisma('deploy'); return await prisma('status');
  } finally { cleanup(); }
}
