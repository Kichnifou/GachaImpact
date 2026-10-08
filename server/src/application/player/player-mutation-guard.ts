import { Prisma } from '../../../generated/prisma/client.js';
import { BusinessError } from '../errors.js';

/** Hold the same Player lock as identity canonicalization until the transaction ends.
 * This guard only freezes archives; domain rules for suspended Players are unchanged.
 */
export async function lockPlayerMutationState(tx: Prisma.TransactionClient, playerId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string; status: string }[]>`
    SELECT id, status::text AS status FROM players WHERE id = ${playerId}::uuid FOR UPDATE
  `;
  if (!rows[0]) throw new BusinessError('PLAYER_NOT_FOUND', 'Aucun joueur n’est lié à ce compte.');
  return rows[0].status !== 'ARCHIVED';
}

export async function lockPlayerMutation(tx: Prisma.TransactionClient, playerId: string): Promise<void> {
  if (!await lockPlayerMutationState(tx, playerId)) throw new BusinessError('PLAYER_ARCHIVED', 'Cette progression est archivée. Reconnectez-vous à votre compte.');
}

export async function lockPlayerMutations(tx: Prisma.TransactionClient, playerIds: readonly string[]): Promise<void> {
  const ids = [...new Set(playerIds)].sort();
  if (!ids.length) return;
  const rows = await tx.$queryRaw<{ id: string; status: string }[]>(Prisma.sql`
    SELECT id, status::text AS status FROM players
    WHERE id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE
  `);
  if (rows.length !== ids.length) throw new BusinessError('PLAYER_NOT_FOUND', 'Aucun joueur n’est lié à ce compte.');
  if (rows.some(row => row.status === 'ARCHIVED')) throw new BusinessError('PLAYER_ARCHIVED', 'Cette progression est archivée. Reconnectez-vous à votre compte.');
}
