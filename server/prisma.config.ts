import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // A fallback lets generate and unit tests work before local Supabase exists.
    // No command in this lot connects to this URL.
    url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/gachaimpact',
  },
});
