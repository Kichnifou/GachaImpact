import { Prisma } from '../../../generated/prisma/client.js';

export function isPrismaConcurrencyCollision(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) return true;
  // Pool contention before BEGIN has no transaction or committed effect. Keep
  // the existing bounded retries; never classify an expired/failed commit this way.
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2028'
    && error.message === 'Transaction API error: Unable to start a transaction in the given time.') return true;
  if (String(error).includes('TransactionWriteConflict')) return true;
  return hasPostgresConflictMarker(error);
}

function hasPostgresConflictMarker(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (('originalCode' in value && (value.originalCode === '40001' || value.originalCode === '40P01')) || ('kind' in value && value.kind === 'TransactionWriteConflict')) return true;
  return ['cause', 'meta', 'driverAdapterError'].some((key) => key in value && hasPostgresConflictMarker((value as Record<string, unknown>)[key]));
}
