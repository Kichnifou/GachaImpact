import { isDeepStrictEqual } from 'node:util';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { SnapshotPilotService } from './snapshot-pilot-service.js';
import { mapLegacyPersonalFacts } from './legacy-personal-facts.js';
import type { PlannedPlayer } from './legacy-global-plan.js';
import { businessDateToDatabaseDate } from '../../domain/time/business-date.js';

type Mapping = Awaited<ReturnType<SnapshotPilotService['globalPlayerPlan']>>;
const subset = (actual: object | null, expected: object, domain: string) => {
  if (!actual || Object.entries(expected).some(([key, value]) => value !== undefined && !isDeepStrictEqual((actual as Record<string, unknown>)[key], value)))
    throw new Error(`CANARY_COMPARISON_FAILED_${domain}`);
};
/** Compare persisted gameplay to the common mapping before committing DATA_IMPORTED. No values enter logs. */
export async function compareLegacyPersonalState(tx: Prisma.TransactionClient, player: PlannedPlayer, mapping: Mapping, hash: string, at: Date) {
  const where = { playerId: player.playerId }, facts = mapLegacyPersonalFacts(player.viewer, hash, at);
  subset(await tx.player.findUnique({ where: { id: player.playerId } }), { elementKey: player.elementKey, legacyUsername: player.legacyUsername, displayName: player.displayName }, 'PLAYER');
  subset(await tx.playerProgression.findUnique({ where }), { ...mapping.progression, lastXpAt: facts.xpProvenance.lastXpAt,
    lastXpMessageAt: facts.xpProvenance.lastXpMessageAt, legacyLastXpDate: facts.xpProvenance.legacyLastXpDate }, 'PROGRESSION');
  const resources = await tx.playerResourceBalance.findMany({ where });
  const expectedResources = new Map<string, bigint>(mapping.resources);
  if (resources.length !== expectedResources.size || resources.some(row => expectedResources.get(row.resourceKey) !== row.amount)) throw new Error('CANARY_COMPARISON_FAILED_RESOURCES');
  subset(await tx.playerBankAccount.findUnique({ where }), { balance: mapping.bankBalance }, 'BANK');
  subset(await tx.playerGachaState.findUnique({ where }), { ...mapping.gachaState, legacyLastPullWasFiveStar: facts.legacyLastPullWasFiveStar }, 'GACHA');
  subset(await tx.playerEconomyStats.findUnique({ where }), mapping.economyState, 'ECONOMY');
  subset(await tx.playerSocialStats.findUnique({ where }), mapping.socialState, 'SOCIAL');
  subset(await tx.playerCombatStats.findUnique({ where }), mapping.combatState, 'COMBAT');
  subset(await tx.playerExpedition.findUnique({ where }), mapping.expeditionData, 'EXPEDITION');
  const box = await tx.playerCharacter.findMany({ where });
  if (box.length !== mapping.boxRows.length) throw new Error('CANARY_COMPARISON_FAILED_BOX');
  for (const row of mapping.boxRows) subset(box.find(item => item.characterId === row.characterId) ?? null,
    { characterId: row.characterId, constellation: row.constellation, copies: row.copies, favorite: row.favorite, firstObtainedAt: row.firstObtainedAt }, 'BOX');
  const teams = await tx.team.findMany({ where, include: { members: { orderBy: { position: 'asc' } } } });
  if (teams.length !== mapping.teamSlots.length) throw new Error('CANARY_COMPARISON_FAILED_TEAMS');
  for (const slot of mapping.teamSlots) {
    const team = teams.find(item => item.displayPosition === slot.position);
    subset(team ?? null, { name: slot.name, isActive: slot.isActive, isBaseSlot: slot.isBaseSlot, legacySavedAt: slot.legacySavedAt }, 'TEAMS');
    if (!isDeepStrictEqual(team!.members.map(member => member.characterId), slot.members)) throw new Error('CANARY_COMPARISON_FAILED_TEAM_MEMBERS');
  }
  const items = await tx.playerItem.findMany({ where });
  if (items.length !== mapping.itemRows.length) throw new Error('CANARY_COMPARISON_FAILED_ITEMS');
  for (const row of mapping.itemRows) subset(items.find(item => item.itemId === row.itemId) ?? null, { quantity: row.quantity }, 'ITEMS');
  const missions = await tx.playerPermanentMissionProgress.findMany({ where });
  if (missions.length !== mapping.missionMapping.rows.length) throw new Error('CANARY_COMPARISON_FAILED_MISSIONS');
  for (const row of mapping.missionMapping.rows) subset(missions.find(item => item.definitionId === row.definitionId) ?? null, row, 'MISSIONS');
  subset(await tx.playerPermanentMissionState.findUnique({ where }), { zUnlockedAt: mapping.missionMapping.zUnlockedAt }, 'MISSION_STATE');
  const c6 = await tx.c6CompetitionProgress.findMany({ where });
  if (c6.length !== mapping.c6Rows.length) throw new Error('CANARY_COMPARISON_FAILED_C6');
  for (const row of mapping.c6Rows) subset(c6.find(item => item.characterId === row.characterId) ?? null, row, 'C6');
  const combat = await tx.playerCharacterCombatStats.findMany({ where });
  if (combat.length !== mapping.characterCombatRows.length) throw new Error('CANARY_COMPARISON_FAILED_CHARACTER_COMBAT');
  for (const row of mapping.characterCombatRows) subset(combat.find(item => item.characterId === row.characterId) ?? null, row, 'CHARACTER_COMBAT');
  subset(await tx.playerWheelStats.findUnique({ where }), { totalSpins: mapping.wheel.totalSpins, totalJackpots: mapping.wheel.totalJackpots }, 'WHEEL');
  subset(await tx.playerDailyRewardState.findUnique({ where }), { lastClaimDate: mapping.wheel.lastDailyRewardDate ? businessDateToDatabaseDate(mapping.wheel.lastDailyRewardDate) : null }, 'DAILY_REWARD');
  if (facts.favor) subset(await tx.playerFavorState.findUnique({ where }), facts.favor.state, 'FAVOR');
  if (mapping.dailyData) subset(await tx.playerDailyChallenge.findFirst({ where }), mapping.dailyData, 'DAILY_CHALLENGE');
  else if (await tx.playerDailyChallenge.count({ where })) throw new Error('CANARY_COMPARISON_FAILED_DAILY_CHALLENGE');
}
