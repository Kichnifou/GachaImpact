import type { Prisma } from '../../../generated/prisma/client.js';
import { getBusinessDate } from '../../domain/time/business-date.js';
import type { Snapshot } from './streamerbot-snapshot.js';
import type { LegacyGlobalPlan } from './legacy-global-plan.js';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function applyLegacyDailyCombat(tx: Prisma.TransactionClient, snapshot: Snapshot, plan: LegacyGlobalPlan, batchId: string, cutoverAt: Date) {
  const source = object(snapshot.sources['combat_data.json']);
  const businessDate = getBusinessDate(cutoverAt);
  if (source.date !== businessDate) return { encounter: 0, states: 0, won: 0, kos: 0, stale: true };
  const enemyIds = source.enemyTeam;
  if (!Array.isArray(enemyIds) || enemyIds.length !== 4) throw new Error('Invalid legacy daily Combat enemy team.');
  const catalog = await tx.character.findMany({ select: { id: true, externalKey: true, elementKey: true } });
  const byExternal = new Map(catalog.map(row => [row.externalKey, row]));
  const encounter = await tx.dailyCombatEncounter.create({ data: { businessDate: new Date(`${businessDate}T00:00:00.000Z`) } });
  for (let index = 0; index < enemyIds.length; index++) {
    const rawId = enemyIds[index];
    if (!Number.isSafeInteger(rawId)) throw new Error('Invalid legacy daily Combat enemy ID.');
    const character = byExternal.get(`legacy:${rawId}`);
    if (!character) throw new Error('Legacy daily Combat enemy absent from the V1 catalog.');
    await tx.dailyCombatEnemy.create({ data: { encounterId: encounter.id, position: index + 1, characterId: character.id,
      elementKeySnapshot: character.elementKey } });
  }
  let states = 0, won = 0, kos = 0;
  for (const player of plan.players) {
    const combat = object(player.viewer.combat), wonToday = combat.lastWinDate === businessDate,
      foughtToday = combat.lastFightDate === businessDate;
    if (wonToday || foughtToday) {
      await tx.playerDailyCombatState.create({ data: { playerId: player.playerId, encounterId: encounter.id, wonAt: null,
        legacyWon: wonToday, legacyProvenance: { source: 'viewers_data.json.combat', batchId, winDayKnown: wonToday, fightDayKnown: foughtToday } } });
      states++; if (wonToday) won++;
    }
    const lost = object(combat.lostCharacters)[businessDate];
    if (lost === undefined) continue;
    if (!Array.isArray(lost)) throw new Error('Invalid legacy daily Combat KO list.');
    for (const rawId of lost) {
      if (!Number.isSafeInteger(rawId)) throw new Error('Invalid legacy daily Combat KO character ID.');
      const character = byExternal.get(`legacy:${rawId}`);
      if (!character) throw new Error('Legacy daily Combat KO character absent from the V1 catalog.');
      await tx.playerDailyCombatKo.create({ data: { playerId: player.playerId, encounterId: encounter.id, characterId: character.id } });
      kos++;
    }
  }
  return { encounter: 1, states, won, kos, stale: false };
}
