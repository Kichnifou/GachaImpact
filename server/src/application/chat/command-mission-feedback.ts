import type { PrismaClient, SourceChannel } from '../../../generated/prisma/client.js';
import { chatLength } from './chat-list-result.js';

/** Transport-neutral joining of distinct announcements, between intact atoms. */
export function appendCommandFeedback(output: string | readonly string[], feedback: readonly string[], limit: number) {
  const parts = typeof output === 'string' ? [output] : [...output];
  for (const text of feedback) {
    const last = parts.at(-1);
    const joined = last ? `${last.replace(/\s*\|\s*$/u, '')} | ${text}` : text;
    if (last && chatLength(joined) <= limit) parts[parts.length - 1] = joined;
    else parts.push(text);
  }
  return parts;
}

/** Same authoritative completion feedback for both command transports; no Chat message required. */
export async function commandMissionFeedback(db: PrismaClient, playerId: string, sourceChannel: SourceChannel, key: string) {
  const keys = [{ idempotencyKey: key }, { idempotencyKey: { endsWith: `:${key}` } }];
  const rows = await db.playerPermanentMissionProgress.findMany({ where: { playerId, status: 'COMPLETED',
    completionTriggerOperation: { sourceChannel, OR: keys } }, include: { definition: true } });
  const dailyRewards = await db.resourceMovement.findMany({ where: { playerId, causeKey: 'daily-challenge.completion', delta: { gt: 0n },
    operation: { sourceChannel, OR: keys } }, orderBy: { createdAt: 'asc' } });
  return [...rows.map(row => `🎯 Mission terminée : ${row.definition.displayName} (+${row.definition.rewardPrimogems} Primogemmes).`),
    ...dailyRewards.map(row => `✅ Défi terminé : +💠${row.delta} Primogemmes.`)];
}
