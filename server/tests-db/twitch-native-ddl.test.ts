import { afterAll, beforeAll, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

const fixture = isolatedBatchDatabase();
beforeAll(() => fixture.setup({ prismaMigrations: true }), 180_000);
afterAll(() => fixture.cleanup(), 60_000);
it('deploys all 61 migrations with Prisma in a private schema and leaves authority unconfigured', async () => {
  expect(fixture.migrationStatus).toContain('Database schema is up to date');
  const rows = await fixture.database.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint count FROM "${fixture.schema}"._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`);
  expect(rows[0]!.count).toBe(61n);
  expect(await fixture.database.twitchNativeAuthority.count()).toBe(0);
  expect(await fixture.database.twitchNativeTarget.count()).toBe(0);
  expect(await fixture.database.twitchCanaryImport.count()).toBe(0);
});
