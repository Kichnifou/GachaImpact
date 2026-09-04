import 'dotenv/config';

import { afterAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/environment.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';

const config = loadConfig();

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required for database smoke tests.');
}

const database = createDatabase(config.databaseUrl);

const expectedTables = [
  'business_operations',
  'elements',
  'player_economy_stats',
  'player_resource_balances',
  'player_wheel_daily_states',
  'player_wheel_stats',
  'players',
  'resource_definitions',
  'resource_movements',
  'web_identities',
] as const;

const expectedCheckConstraints = [
  'elements_display_order_positive_check',
  'player_economy_stats_main_particles_earned_nonnegative_check',
  'player_economy_stats_moras_earned_nonnegative_check',
  'player_economy_stats_moras_spent_nonnegative_check',
  'player_economy_stats_primos_earned_nonnegative_check',
  'player_economy_stats_primos_spent_nonnegative_check',
  'player_resource_balances_amount_nonnegative_check',
  'player_wheel_stats_jackpots_not_above_spins_check',
  'player_wheel_stats_total_jackpots_nonnegative_check',
  'player_wheel_stats_total_spins_nonnegative_check',
  'players_display_name_length_check',
  'resource_movements_balance_after_nonnegative_check',
  'resource_movements_balance_before_nonnegative_check',
  'resource_movements_balance_consistency_check',
] as const;

const expectedManualIndexes = [
  'business_operations_source_idempotency_key',
  'players_display_name_lower_idx',
] as const;

afterAll(async () => {
  await database.$disconnect();
});

describe('Supabase development database', () => {
  it('connects and exposes the expected reference data', async () => {
    const [elements, resources] = await Promise.all([
      database.element.findMany({ orderBy: { displayOrder: 'asc' } }),
      database.resourceDefinition.findMany({ orderBy: { key: 'asc' } }),
    ]);

    expect(elements.map(({ key }) => key)).toEqual([
      'pyro',
      'hydro',
      'cryo',
      'electro',
      'anemo',
      'geo',
      'dendro',
    ]);
    expect(resources.map(({ key }) => key)).toEqual([
      'moras',
      'particles_anemo',
      'particles_cryo',
      'particles_dendro',
      'particles_electro',
      'particles_geo',
      'particles_hydro',
      'particles_pyro',
      'primogems',
    ]);
  });

  it('contains only the expected initial tables with RLS enabled', async () => {
    const tables = await database.$queryRaw<{ tableName: string }[]>`
      SELECT table_name AS "tableName"
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name <> '_prisma_migrations'
      ORDER BY table_name
    `;
    const rlsStates = await database.$queryRaw<{ tableName: string; rlsEnabled: boolean }[]>`
      SELECT class.relname AS "tableName", class.relrowsecurity AS "rlsEnabled"
      FROM pg_class AS class
      INNER JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'public'
        AND class.relkind = 'r'
        AND class.relname <> '_prisma_migrations'
      ORDER BY class.relname
    `;
    const policies = await database.$queryRaw<{ policyName: string }[]>`
      SELECT policyname AS "policyName"
      FROM pg_policies
      WHERE schemaname = 'public'
    `;

    expect(tables.map(({ tableName }) => tableName)).toEqual(expectedTables);
    expect(rlsStates).toEqual(
      expectedTables.map((tableName) => ({ tableName, rlsEnabled: true })),
    );
    expect(policies).toEqual([]);
  });

  it('contains the PostgreSQL checks and indexes maintained by the migration SQL', async () => {
    const checkConstraints = await database.$queryRaw<{ constraintName: string }[]>`
      SELECT db_constraint.conname AS "constraintName"
      FROM pg_constraint AS db_constraint
      INNER JOIN pg_class AS class ON class.oid = db_constraint.conrelid
      INNER JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'public'
        AND db_constraint.contype = 'c'
      ORDER BY db_constraint.conname
    `;
    const indexes = await database.$queryRaw<{ indexName: string }[]>`
      SELECT indexname AS "indexName"
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'business_operations_source_idempotency_key',
          'players_display_name_lower_idx'
        )
      ORDER BY indexname
    `;

    expect(checkConstraints.map(({ constraintName }) => constraintName)).toEqual(
      expectedCheckConstraints,
    );
    expect(indexes.map(({ indexName }) => indexName)).toEqual(expectedManualIndexes);
  });
});
