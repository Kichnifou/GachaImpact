import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testsDb = resolve(dirname(fileURLToPath(import.meta.url)), '../tests-db');

describe('PostgreSQL test isolation guard', () => {
  it('requires each mutable DB suite to use a private schema', () => {
    for (const name of readdirSync(testsDb).filter(name => name.endsWith('.test.ts'))) {
      const source = readFileSync(join(testsDb, name), 'utf8');
      expect(source, `${name} must not instantiate the production database boundary`).not.toMatch(/\bcreateDatabase\s*\(/);
      if (name === 'event-calendar.integration.test.ts') {
        expect(source).toContain('new PrismaPg({ connectionString, options: `-c search_path=${schema},public` }, { schema })');
        expect(source).toContain('CREATE SCHEMA');
      } else {
        expect(source, `${name} must use isolatedBatchDatabase`).toContain('isolatedBatchDatabase()');
        expect(source, `${name} must not open a second Prisma boundary`).not.toMatch(/\bnew\s+(?:PrismaClient|PrismaPg)\s*\(/);
      }
    }
  });
});
