import type { Prisma } from '../../../generated/prisma/client.js';
import { captureCanonicalizationGraph } from '../twitch/canonicalization-graph.js';
import { targetedBackupTables, targetedRowMetadata } from './targeted-player-rows.js';
import { createHash } from 'node:crypto';

/** Reuse the bounded canonical graph owner; full PostgreSQL row text retains
 * int8/timestamp precision. The completed import compares this under the same
 * Player lock again immediately before the authority transfer. */
export async function recoveryIntegrityHash(tx: Prisma.TransactionClient, playerId: string,
  metadata?: Awaited<ReturnType<typeof targetedRowMetadata>>) {
  const graph = await captureCanonicalizationGraph(tx, playerId, metadata ?? await targetedRowMetadata(tx),
    new Set<string>([...targetedBackupTables, 'gift_code_claims', 'external_banner_votes']));
  return createHash('sha256').update(JSON.stringify(graph.tables)).digest('hex');
}

export async function assertRecoveryTransferIntegrity(tx: Prisma.TransactionClient, profiles: { playerId: string; importId: string }[]) {
  if (!profiles.length) return;
  const batches = await tx.migrationBatch.findMany({ where: { status: 'COMPLETED', OR: profiles.map(p => ({ summary: { path: ['recovery', 'importId'], equals: p.importId } })) }, select: { summary: true } });
  const metadata = await targetedRowMetadata(tx);
  for (const profile of profiles) {
    const proofs = batches.map(b => (b.summary as Prisma.JsonObject).recovery as Prisma.JsonObject).filter(p => p?.importId === profile.importId);
    if (proofs.length !== 1 || proofs[0]!.integrityHash !== await recoveryIntegrityHash(tx, profile.playerId, metadata)) throw Error('LEGACY_RECOVERY_TRANSFER_DRIFT');
  }
}
