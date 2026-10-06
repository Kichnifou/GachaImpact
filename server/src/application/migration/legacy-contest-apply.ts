import type { Prisma } from '../../../generated/prisma/client.js';
import { getBusinessDate } from '../../domain/time/business-date.js';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import type { LegacyGlobalPlan } from './legacy-global-plan.js';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function applyLegacyContest(tx: Prisma.TransactionClient, snapshot: Snapshot, plan: LegacyGlobalPlan, batchId: string, cutoverAt: Date) {
  const source = object(snapshot.sources['contests_data.json']), current = object(source.currentContest);
  const businessDate = getBusinessDate(cutoverAt);
  // A live Contest cannot be cut over mid-turn without a proven transition contract.
  if (current.status !== 'none') throw new Error('Cutover requires the legacy Contest to finish before snapshot capture.');
  const byName = new Map(plan.players.map(player => [normalizeLegacyName(player.legacyUsername), player.playerId]));
  let locks = 0, staleLocks = 0, excludedLocks = 0;
  for (const [username, raw] of Object.entries(object(source.dailyLocks))) {
    const lock = object(raw);
    if (lock.date !== businessDate || lock.used !== true) { staleLocks++; continue; }
    const playerId = byName.get(normalizeLegacyName(username));
    if (!playerId) { excludedLocks++; continue; }
    if (plan.players.some(player => player.playerId === playerId && player.personalImport === false)) continue;
    if (lock.characterId != null && !Number.isSafeInteger(lock.characterId)) throw new Error('Invalid legacy Contest daily lock character ID.');
    await tx.contestLegacyDailyLock.create({ data: { playerId, businessDate: new Date(`${businessDate}T00:00:00.000Z`),
      legacyCharacterId: lock.characterId == null ? null : Number(lock.characterId), batchId,
      legacyProvenance: { source: 'contests_data.json.dailyLocks', batchId, consumedAtKnown: false } } });
    locks++;
  }
  return { activeContest: false, locks, staleLocks, excludedLocks, historyImported: 0 };
}
