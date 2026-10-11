import type { Prisma } from '../../../generated/prisma/client.js';
import type { ValidImage } from '../../infrastructure/character-catalog/catalog-images.js';

/** The caller holds the candidate row lock and has rechecked its revision/scope.
 * Objects are immutable; selecting an older hash never deletes a newer version. */
export async function recordImageVersion(tx: Prisma.TransactionClient, input: {
  candidateId: string; role: 'icon'|'splash'|'wish'|'fullbody'; image: ValidImage;
  provider: string; sourceUrl: string; sourceMime: string; url: string | null;
  editorialStatus: 'PROVISIONAL'|'VALIDATED'; manual?: boolean; now: Date;
}) {
  const { candidateId, role, image } = input;
  const previous = await tx.catalogAsset.findFirst({ where: { candidateId, role, status: 'AVAILABLE' }, orderBy: [{ checkedAt: 'desc' }, { id: 'asc' }] });
  const existing = await tx.catalogAsset.findUnique({where:{candidateId_role_hash:{candidateId,role,hash:image.hash}}});
  const url = input.url ?? (existing?.status === 'AVAILABLE' ? existing.url : null);
  const metadata = { provider: input.provider, sourceUrl: input.sourceUrl, url,
    mime: image.mime, width: image.width, height: image.height, bytes: image.bytes,
    sourceHash: image.sourceHash, sourceMime: input.sourceMime,
    status: url ? 'AVAILABLE' : 'SOURCE_VALIDATED', editorialStatus: existing?.editorialStatus === 'VALIDATED' ? 'VALIDATED' : input.editorialStatus,
    officialConfirmed: existing?.officialConfirmed || input.provider === 'hoyoverse', adminValidated: existing?.adminValidated || !!input.manual, autoLocked: !!input.manual,
    checkedAt: input.now };
  const asset = await tx.catalogAsset.upsert({ where: { candidateId_role_hash: { candidateId, role, hash: image.hash } },
    create: { candidateId, role, hash: image.hash, ...metadata }, update: metadata });
  const changed = !existing || existing.status !== metadata.status || existing.editorialStatus !== metadata.editorialStatus ||
    existing.officialConfirmed !== metadata.officialConfirmed || existing.adminValidated !== metadata.adminValidated || (!!url && previous?.hash !== image.hash);
  return { asset, changed };
}
