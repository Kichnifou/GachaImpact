import { Prisma } from '../../../generated/prisma/client.js';

export function isPrismaConcurrencyCollision(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) return true;
  if (String(error).includes('TransactionWriteConflict')) return true;
  return hasPostgresConflictMarker(error);
}

function hasPostgresConflictMarker(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (('originalCode' in value && value.originalCode === '40001') || ('kind' in value && value.kind === 'TransactionWriteConflict')) return true;
  return ['cause', 'meta', 'driverAdapterError'].some((key) => key in value && hasPostgresConflictMarker((value as Record<string, unknown>)[key]));
}
