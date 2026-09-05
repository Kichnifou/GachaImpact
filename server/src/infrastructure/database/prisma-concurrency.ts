import { Prisma } from '../../../generated/prisma/client.js';

export function isPrismaConcurrencyCollision(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) return true;
  if (String(error).includes('TransactionWriteConflict')) return true;
  if (hasPostgresConflictMarker(error)) return true;
  return Boolean(error && typeof error === 'object' && 'cause' in error && hasPostgresConflictMarker(error.cause));
}

function hasPostgresConflictMarker(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && (
    ('originalCode' in value && value.originalCode === '40001')
    || ('kind' in value && value.kind === 'TransactionWriteConflict')
  ));
}
