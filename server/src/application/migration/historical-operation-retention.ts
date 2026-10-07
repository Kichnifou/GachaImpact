import type { Prisma } from '../../../generated/prisma/client.js';

/** Exact membership in the committed replacement proof, never a timestamp heuristic. */
export async function isRetainedHistoricalOperation(tx: Prisma.TransactionClient, playerId: string, operationId: string) {
  const rows = await tx.$queryRaw<{ retained: boolean }[]>`SELECT EXISTS (
    SELECT 1 FROM migration_runs r JOIN migration_batches b ON b.id=r.batch_id
    JOIN twitch_canary_imports i ON i.player_id=r.player_id AND i.snapshot_hash=r.snapshot_hash
      AND i.backup_hash=b.summary#>>'{historicalOperationRetention,backupHash}'
    WHERE r.player_id=${playerId}::uuid AND r.status='COMPLETED' AND r.source='STREAMERBOT_SNAPSHOT'
      AND b.status='COMPLETED' AND b.migrator_version='targeted-canary-v2' AND b.summary->>'kind'='TARGETED_CANARY'
      AND i.status='DATA_IMPORTED' AND i.rolled_back_at IS NULL
      AND b.summary#>>'{historicalOperationRetention,version}'='1'
      AND jsonb_typeof(b.summary#>'{historicalOperationRetention,operationIds}')='array'
      AND (b.summary#>'{historicalOperationRetention,operationIds}') @> jsonb_build_array(${operationId}::text)
  ) AS retained`;
  return rows[0]!.retained;
}
