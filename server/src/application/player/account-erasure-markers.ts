import { createHash, createHmac } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client.js';

export const authSubjectHash = (subject: string) => createHash('sha256').update('auth-subject\0' + subject).digest('hex');
export function erasureDigest(kind: string, value: string, key = process.env['ACCOUNT_DELETION_MARKER_KEY']) {
  if (!key || !/^[a-f0-9]{64}$/.test(key)) throw new Error('ACCOUNT_DELETION_MARKER_KEY_REQUIRED');
  return createHmac('sha256', Buffer.from(key, 'hex')).update(kind + '\0' + value).digest('hex');
}
export async function assertNotErased(tx: Prisma.TransactionClient, kind: 'TWITCH' | 'PLAYER' | 'FRIENDSHIP_SOURCE', value: string) {
  // No marker-key means the erasure feature has not yet been configured. Existing migration tools remain usable.
  // Once an erasure has occurred, missing key must fail closed instead of forgetting the marker.
  const count = await tx.accountErasureMarker.count();
  if (!count) return;
  const digest = erasureDigest(kind, value);
  if (await tx.accountErasureMarker.findUnique({ where: { kind_digest: { kind, digest } } })) throw new Error('ACCOUNT_ERASED_RESTORE_FORBIDDEN');
}
export async function twitchErasedAt(tx: Pick<Prisma.TransactionClient,'accountErasureMarker'>,twitchUserId:string) {
  if(!process.env['ACCOUNT_DELETION_MARKER_KEY']) {
    if(tx.accountErasureMarker&&await tx.accountErasureMarker.count())throw new Error('ACCOUNT_DELETION_MARKER_KEY_REQUIRED');
    return null;
  }
  const row=await tx.accountErasureMarker.findUnique({where:{kind_digest:{kind:'TWITCH',digest:erasureDigest('TWITCH',twitchUserId)}}});
  return row?.createdAt??null;
}
export async function lockAuthSubject(tx: Prisma.TransactionClient, subject: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`auth-subject:${subject}`},0))::text`;
}
export async function assertSubjectNotDeleting(tx: Prisma.TransactionClient, subject: string) {
  if (await tx.accountDeletion.findUnique({ where: { subjectHash: authSubjectHash(subject) } })) throw new Error('ACCOUNT_DELETION_ACCEPTED');
}
