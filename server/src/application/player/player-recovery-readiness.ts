import { z } from 'zod';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';

export const recoveryDomains = ['EVENT', 'BOSS', 'GIVEAWAY'] as const;
export type RecoveryDomain = typeof recoveryDomains[number];
const hash = z.string().regex(/^[0-9a-f]{64}$/);
export const playerRecoverySchema = z.object({
  version: z.literal(1), operationId: z.uuid(), populationHash: hash, snapshotHash: hash,
  importId: z.uuid(), backupHash: hash,
  restrictedDomains: z.array(z.enum(recoveryDomains)).max(recoveryDomains.length)
    .refine(domains => new Set(domains).size === domains.length),
}).strict();
export type PlayerRecovery = z.infer<typeof playerRecoverySchema>;
type Database = PrismaClient | Prisma.TransactionClient;

const domainNames: Record<RecoveryDomain, string> = { EVENT: 'Le Festival', BOSS: 'Le Boss', GIVEAWAY: 'Le Giveaway' };
export const recoveryUnavailable = (domain: RecoveryDomain) => new AppError(
  `${domainNames[domain]} est temporairement indisponible pour ce profil pendant la reprise de sa progression.`,
  409, 'PLAYER_DOMAIN_TEMPORARILY_UNAVAILABLE',
);

/** Null is the existing standalone/canary contract. A non-null malformed marker never opens a domain. */
export function parsePlayerRecovery(value: unknown): PlayerRecovery | null {
  if (value === null) return null;
  const result = playerRecoverySchema.safeParse(value);
  if (!result.success) throw new AppError('La reprise de ce profil doit être vérifiée avant cette action.', 503, 'PLAYER_RECOVERY_STATE_INVALID');
  return result.data;
}

export function isRecoveryUnavailable(error: unknown): boolean {
  return error instanceof AppError && ['PLAYER_DOMAIN_TEMPORARILY_UNAVAILABLE', 'PLAYER_RECOVERY_STATE_INVALID'].includes(error.code);
}

export function recoveryAllowsDomain(value: unknown, domain: RecoveryDomain): boolean {
  try { return !parsePlayerRecovery(value)?.restrictedDomains.includes(domain); }
  catch (error) { if (isRecoveryUnavailable(error)) return false; throw error; }
}

export async function getPlayerRecovery(database: Database, playerId: string): Promise<PlayerRecovery | null> {
  const player = await database.player.findUnique({ where: { id: playerId }, select: { legacyRecovery: true } });
  if (!player) throw new AppError('Ce profil est indisponible.', 404, 'PLAYER_NOT_FOUND');
  return parsePlayerRecovery(player.legacyRecovery);
}

export async function assertPlayerDomainReady(database: Database, playerId: string, domain: RecoveryDomain): Promise<void> {
  if ((await getPlayerRecovery(database, playerId))?.restrictedDomains.includes(domain)) throw recoveryUnavailable(domain);
}

/** Background work may skip this domain while unrelated gameplay continues. Database errors still fail closed. */
export async function isPlayerDomainReady(database: Database, playerId: string, domain: RecoveryDomain): Promise<boolean> {
  try { return !(await getPlayerRecovery(database, playerId))?.restrictedDomains.includes(domain); }
  catch (error) { if (isRecoveryUnavailable(error)) return false; throw error; }
}

/** A mixed overview reports restricted domains without hiding unrelated failures. */
export async function optionalRecoveryDomain<T>(action: Promise<T>): Promise<T | null> {
  try { return await action; }
  catch (error) { if (isRecoveryUnavailable(error)) return null; throw error; }
}
