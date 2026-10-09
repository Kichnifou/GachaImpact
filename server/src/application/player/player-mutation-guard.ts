import { Prisma } from '../../../generated/prisma/client.js';
import { BusinessError } from '../errors.js';
import { AppError } from '../../api/errors.js';
import { parsePlayerRecovery } from './player-recovery-readiness.js';

async function recoveryTransferred(tx: Prisma.TransactionClient, playerId: string, marker: unknown) {
  if (marker == null) return true;
  try { parsePlayerRecovery(marker); } catch { return false; }
  return await tx.twitchNativeTarget.count({ where: { playerId, dataAuthority: 'NATIVE', canary: true } }) === 1;
}
const recovering = () => new AppError('La reprise de ce profil est en cours. Réessayez après sa remise en service.', 409, 'PLAYER_RECOVERY_NOT_ACTIVATED');

/** For owners that already hold all Player rows in order and have their own
 * archive/suspension rules (messages, trades, Arcade). */
export async function assertPlayerRecoveryActivated(tx: Prisma.TransactionClient, playerId: string): Promise<void> {
  const player = await tx.player.findUnique({ where: { id: playerId }, select: { legacyRecovery: true } });
  if (player && !await recoveryTransferred(tx, playerId, player.legacyRecovery)) throw recovering();
}

/** Hold the same Player lock as identity canonicalization until the transaction ends.
 * Archives and staged recovery profiles cannot mutate before authority transfer;
 * domain rules for suspended Players are unchanged.
 */
export async function lockPlayerMutationState(tx: Prisma.TransactionClient, playerId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string; status: string; legacy_recovery: unknown }[]>`
    SELECT id, status::text AS status, legacy_recovery FROM players WHERE id = ${playerId}::uuid FOR UPDATE
  `;
  if (!rows[0]) throw new BusinessError('PLAYER_NOT_FOUND', 'Aucun joueur n’est lié à ce compte.');
  return rows[0].status !== 'ARCHIVED' && await recoveryTransferred(tx, playerId, rows[0].legacy_recovery);
}

export async function lockPlayerMutation(tx: Prisma.TransactionClient, playerId: string): Promise<void> {
  if (!await lockPlayerMutationState(tx, playerId)) {
    const player = await tx.player.findUnique({ where: { id: playerId }, select: { status: true } });
    if (player?.status !== 'ARCHIVED') throw recovering();
    throw new BusinessError('PLAYER_ARCHIVED', 'Cette progression est archivée. Reconnectez-vous à votre compte.');
  }
}

export async function lockPlayerMutations(tx: Prisma.TransactionClient, playerIds: readonly string[]): Promise<void> {
  const ids = [...new Set(playerIds)].sort();
  if (!ids.length) return;
  const rows = await tx.$queryRaw<{ id: string; status: string; legacy_recovery: unknown }[]>(Prisma.sql`
    SELECT id, status::text AS status, legacy_recovery FROM players
    WHERE id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE
  `);
  if (rows.length !== ids.length) throw new BusinessError('PLAYER_NOT_FOUND', 'Aucun joueur n’est lié à ce compte.');
  if (rows.some(row => row.status === 'ARCHIVED')) throw new BusinessError('PLAYER_ARCHIVED', 'Cette progression est archivée. Reconnectez-vous à votre compte.');
  for (const row of rows) if (!await recoveryTransferred(tx, row.id, row.legacy_recovery)) throw recovering();
}
