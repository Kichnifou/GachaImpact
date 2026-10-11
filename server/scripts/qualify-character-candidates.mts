import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { CatalogEngine } from '../src/application/character-catalog/catalog-engine.js';

// Explicit operator qualification, independent of worker activation. Never
// publishes a Character or uploads an image: no Storage credential is supplied.
// The current Paris cycle key and lease make replay and concurrent execution safe.
if (!process.argv.includes('--apply-candidates')) throw new Error('Explicit --apply-candidates required after independent review and migration');
const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL required');
const database = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
try {
  const engine = new CatalogEngine(database, { enabled: false, publish: false, dryRun: false });
  const result = await engine.run();
  console.log(JSON.stringify({ publicationEnabled: false, storageWritesEnabled: false, result }));
} catch {
  console.log(JSON.stringify({ publicationEnabled: false, errorCode: 'QUALIFICATION_FAILED_SEE_DURABLE_RUN' }));
  process.exitCode = 1;
} finally { await database.$disconnect(); }
