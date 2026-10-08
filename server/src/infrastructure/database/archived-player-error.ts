/** Recognize the physical archive barrier without exposing Prisma/SQL details. */
export function isArchivedPlayerWriteError(error: unknown): boolean {
  if (!(error instanceof Error) || !['PrismaClientKnownRequestError', 'PrismaClientUnknownRequestError'].includes(error.name)) return false;
  const details = error as Error & { meta?: unknown };
  const text = `${details.message} ${JSON.stringify(details.meta ?? {})}`;
  return /\bPLAYER_ARCHIVED\b/.test(text) && /archived_player_write_guard|23514/.test(text);
}
