import { afterAll, beforeAll, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

const fixture = isolatedBatchDatabase();
beforeAll(() => fixture.setup({ prismaMigrations: true }), 180_000);
afterAll(() => fixture.cleanup(), 60_000);
it('deploys all 62 migrations with Prisma in a private schema and leaves authority unconfigured', async () => {
  expect(fixture.migrationStatus).toContain('Database schema is up to date');
  const rows = await fixture.database.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint count FROM "${fixture.schema}"._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`);
  expect(rows[0]!.count).toBe(62n);
  expect(await fixture.database.twitchLinkResolution.count()).toBe(0);
  const security = await fixture.database.$queryRawUnsafe<{ enabled: boolean; grants: bigint }[]>(`SELECT c.relrowsecurity enabled, (SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema=$1 AND table_name='twitch_link_resolutions' AND grantee IN ('PUBLIC','anon','authenticated'))::bigint grants FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname='twitch_link_resolutions'`, fixture.schema);
  expect(security[0]).toEqual({ enabled: true, grants: 0n });
  expect(await fixture.database.twitchNativeAuthority.count()).toBe(0);
  expect(await fixture.database.twitchNativeTarget.count()).toBe(0);
  expect(await fixture.database.twitchCanaryImport.count()).toBe(0);
});
