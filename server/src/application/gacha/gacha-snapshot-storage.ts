import type { Prisma } from '../../../generated/prisma/client.js';

const record = (value: Prisma.JsonValue | null | undefined) => value && typeof value === 'object' && !Array.isArray(value) ? value : null;

/** Resolve the original Team for audits of either receipt format, never today's Team. */
export function readGachaActiveTeam(snapshot: Prisma.JsonValue | null, summary: Prisma.JsonValue | null): Prisma.JsonValue {
  const row = record(snapshot);
  if (row && Object.hasOwn(row, 'activeTeam')) return row.activeTeam!;
  const operation = record(summary);
  if (row?.snapshotVersion === 2 && row.activeTeamRef === 'operation' && operation?.gachaSnapshotVersion === 2
    && Object.hasOwn(operation, 'activeTeam')) return operation.activeTeam!;
  throw new Error('GACHA_TEAM_SNAPSHOT_MISSING');
}
