import type { Prisma } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';

export const activeCatalogStates = ['QUEUED', 'RUNNING', 'FAILED'];
export async function lockCatalogJob(tx: Prisma.TransactionClient) {
  await tx.catalogJob.upsert({ where: { id: 'R1051' }, create: { id: 'R1051' }, update: {} });
  await tx.$queryRaw`SELECT id FROM catalog_job WHERE id = 'R1051' FOR UPDATE`;
}
export async function admitCatalogRun(tx: Prisma.TransactionClient, ownId?: string) {
  const active = await tx.catalogRun.findFirst({ where: { status: { in: activeCatalogStates }, ...(ownId ? { id: { not: ownId } } : {}) }, orderBy: { startedAt: 'asc' } });
  if (active) throw new AppError(`Une recherche est déjà active (${active.id}). Actualiser pour la suivre ou l’annuler.`, 409, 'CATALOG_BUSY');
}
