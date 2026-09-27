import { CosmeticType, CosmeticVisibility, type Prisma } from '../../../generated/prisma/client.js';
import { businessDateToDatabaseDate, getBusinessDate } from '../../domain/time/business-date.js';
import { mapLegacyPersonalFacts } from './legacy-personal-facts.js';
import type { PlannedPlayer } from './legacy-global-plan.js';
import type { SnapshotPilotService } from './snapshot-pilot-service.js';

type PlayerMapping = Awaited<ReturnType<SnapshotPilotService['globalPlayerPlan']>>;
/** Writes only current, proven personal state. No synthetic BusinessOperation, movement or acquisition. */
export async function applyLegacyPersonalState(tx: Prisma.TransactionClient, player: PlannedPlayer,
  mapping: PlayerMapping, batchId: string, snapshotHash: string, cutoverAt: Date) {
  const blockers = mapping.domains.filter(domain => domain.category === 'BLOCKED_AMBIGUOUS' || domain.action === 'PENDING_MAPPING');
  if (blockers.length) throw new Error(`Personal mapping blocked in ${blockers.map(domain => domain.name).join(', ')}.`);
  const viewer = player.viewer;
  const facts = mapLegacyPersonalFacts(viewer, snapshotHash, cutoverAt);
  const { lastMessageAt, xpProvenance } = facts;
  const cutoverDate = getBusinessDate(cutoverAt);
  const isExisting = player.mappingMode === 'EXISTING_VERIFIED_TWITCH';
  if (isExisting) await tx.player.update({ where: { id: player.playerId }, data: { elementKey: player.elementKey, legacyUsername: player.legacyUsername,
    equippedAvatarCosmeticId: null, equippedTitleCosmeticId: null } });
  else await tx.player.create({ data: { id: player.playerId, displayName: player.displayName, elementKey: player.elementKey,
    legacyUsername: player.legacyUsername } });
  const anomalies = mapping.domains.flatMap(domain => domain.anomalies.map(note => ({ domain: domain.name, note })));
  if (anomalies.length) await tx.migrationIssue.createMany({ data: anomalies.map(({ domain, note }) => ({ batchId,
    sourceName: 'viewers_data.json', legacyKey: player.legacyUsername, playerId: player.playerId,
    domain, severity: 'WARNING', issueCode: 'PERSONAL_MAPPING_ANOMALY',
    description: 'Personal legacy mapping required a documented adjustment.', details: { note } })) });
  if (xpProvenance.issue) await tx.migrationIssue.create({ data: { batchId, sourceName: 'viewers_data.json',
    path: '*.dates.lastXpDate', legacyKey: player.legacyUsername, playerId: player.playerId, domain: 'Progression',
    severity: xpProvenance.issue.severity, issueCode: xpProvenance.issue.code,
    description: 'The legacy XP day and XP message instant have different precision or dates.',
    details: xpProvenance.issue.details } });
  await tx.twitchIdentity.upsert({ where: { playerId: player.playerId }, create: { playerId: player.playerId,
    twitchUserId: player.twitchUserId, login: player.twitchLogin, displayName: player.twitchDisplayName,
    firstSeenAt: facts.firstSeenAt, lastMessageAt }, update: { login: player.twitchLogin, displayName: player.twitchDisplayName,
    firstSeenAt: facts.firstSeenAt, lastMessageAt } });
  await tx.playerActivityState.upsert({ where: { playerId: player.playerId }, create: { playerId: player.playerId, lastTwitchActivityAt: lastMessageAt },
    update: { lastTwitchActivityAt: lastMessageAt } });
  await tx.playerProgression.upsert({ where: { playerId: player.playerId }, create: { playerId: player.playerId,
    ...mapping.progression, lastXpAt: xpProvenance.lastXpAt, lastXpMessageAt: xpProvenance.lastXpMessageAt,
    legacyLastXpDate: xpProvenance.legacyLastXpDate }, update: { ...mapping.progression,
    lastXpAt: xpProvenance.lastXpAt, lastXpMessageAt: xpProvenance.lastXpMessageAt,
    legacyLastXpDate: xpProvenance.legacyLastXpDate } });
  await tx.playerResourceBalance.deleteMany({ where: { playerId: player.playerId } });
  await tx.playerResourceBalance.createMany({ data: [...mapping.resources].map(([resourceKey, amount]) => ({ playerId: player.playerId, resourceKey, amount })) });
  await tx.playerBankAccount.upsert({ where: { playerId: player.playerId }, create: { playerId: player.playerId,
    balance: mapping.bankBalance, lastInterestDate: businessDateToDatabaseDate(cutoverDate) },
    update: { balance: mapping.bankBalance, lastInterestDate: businessDateToDatabaseDate(cutoverDate) } });
  const gacha = { ...mapping.gachaState, legacyLastPullWasFiveStar: facts.legacyLastPullWasFiveStar };
  await tx.playerGachaState.upsert({ where: { playerId: player.playerId }, create: { playerId: player.playerId, ...gacha }, update: gacha });
  await tx.playerCharacter.deleteMany({ where: { playerId: player.playerId } });
  if (mapping.boxRows.length) await tx.playerCharacter.createMany({ data: mapping.boxRows.map(row => ({ playerId: player.playerId,
    characterId: row.characterId, constellation: row.constellation, copies: row.copies, firstObtainedAt: row.firstObtainedAt,
    favorite: row.favorite, provenance: row.provenance })) });
  await tx.c6CompetitionProgress.deleteMany({ where: { playerId: player.playerId } });
  if (mapping.c6Rows.length) await tx.c6CompetitionProgress.createMany({ data: mapping.c6Rows.map(row => ({
    ...row, playerId: player.playerId,
  })) as Prisma.C6CompetitionProgressCreateManyInput[] });
  await tx.team.deleteMany({ where: { playerId: player.playerId } });
  for (const slot of mapping.teamSlots) await tx.team.create({ data: { playerId: player.playerId, displayPosition: slot.position,
    name: slot.name, isActive: slot.isActive, isBaseSlot: slot.isBaseSlot, legacySavedAt: slot.legacySavedAt,
    members: { create: slot.members.map((characterId, index) => ({ characterId, position: index + 1 })) } } });
  await tx.playerEconomyStats.upsert({ where: { playerId: player.playerId }, create: { playerId: player.playerId, ...mapping.economyState }, update: mapping.economyState });
  await tx.playerSocialStats.upsert({ where: { playerId: player.playerId }, create: { playerId: player.playerId, ...mapping.socialState }, update: mapping.socialState });
  await tx.playerExpedition.upsert({ where: { playerId: player.playerId }, create: { playerId: player.playerId, ...mapping.expeditionData }, update: mapping.expeditionData });
  await tx.playerCombatStats.upsert({ where: { playerId: player.playerId }, create: { playerId: player.playerId, ...mapping.combatState }, update: mapping.combatState });
  await tx.playerCharacterCombatStats.deleteMany({ where: { playerId: player.playerId } });
  if (mapping.characterCombatRows.length) await tx.playerCharacterCombatStats.createMany({ data: mapping.characterCombatRows.map(row => ({ playerId: player.playerId, ...row })) });
  await tx.playerPermanentMissionState.upsert({ where: { playerId: player.playerId }, create: { playerId: player.playerId,
    initializedAt: cutoverAt, zUnlockedAt: mapping.missionMapping.zUnlockedAt,
    standaloneCatchupCompletedAt: cutoverAt, legacyProvenance: { source: 'viewers_data.json.longMissions', snapshotHash } },
    update: { zUnlockedAt: mapping.missionMapping.zUnlockedAt,
      standaloneCatchupCompletedAt: cutoverAt, legacyProvenance: { source: 'viewers_data.json.longMissions', snapshotHash } } });
  await tx.playerPermanentMissionProgress.deleteMany({ where: { playerId: player.playerId } });
  await tx.playerPermanentMissionProgress.createMany({ data: mapping.missionMapping.rows.map(row => ({ playerId: player.playerId, ...row })) });
  await tx.playerDailyChallenge.deleteMany({ where: { playerId: player.playerId } });
  if (mapping.dailyData) await tx.playerDailyChallenge.create({ data: { playerId: player.playerId, ...mapping.dailyData } });
  await tx.playerItem.deleteMany({ where: { playerId: player.playerId } });
  if (mapping.itemRows.length) await tx.playerItem.createMany({ data: mapping.itemRows.map(row => ({ playerId: player.playerId,
    itemId: row.itemId, quantity: row.quantity, firstObtainedAt: null,
    legacyProvenance: { source: 'viewers_data.json', snapshotHash, externalKey: row.externalKey } })) });
  await tx.playerWheelStats.upsert({ where: { playerId: player.playerId }, create: { playerId: player.playerId,
    totalSpins: mapping.wheel.totalSpins, totalJackpots: mapping.wheel.totalJackpots }, update: { totalSpins: mapping.wheel.totalSpins,
    totalJackpots: mapping.wheel.totalJackpots } });
  await tx.playerWheelDailyState.deleteMany({ where: { playerId: player.playerId } });
  if (mapping.wheel.lastWheelDate === cutoverDate) await tx.playerWheelDailyState.create({ data: { playerId: player.playerId,
    businessDate: businessDateToDatabaseDate(cutoverDate), resultKnown: false,
    legacyProvenance: { source: 'viewers_data.json', snapshotHash } } });
  await tx.playerDailyRewardState.upsert({ where: { playerId: player.playerId }, create: { playerId: player.playerId,
    firstClaimDate: null, lastClaimDate: mapping.wheel.lastDailyRewardDate ? businessDateToDatabaseDate(mapping.wheel.lastDailyRewardDate) : null,
    legacyProvenance: { source: 'viewers_data.json.dates.lastDailyFirstMessageReward', snapshotHash } },
    update: { firstClaimDate: null, lastClaimDate: mapping.wheel.lastDailyRewardDate ? businessDateToDatabaseDate(mapping.wheel.lastDailyRewardDate) : null,
      lastClaimedAt: null, lastOperationId: null, legacyProvenance: { source: 'viewers_data.json.dates.lastDailyFirstMessageReward', snapshotHash } } });
  await tx.playerPreference.upsert({ where: { playerId_preferenceKey: { playerId: player.playerId, preferenceKey: 'box.sort' } },
    create: { playerId: player.playerId, preferenceKey: 'box.sort', value: facts.boxSort },
    update: { value: facts.boxSort } });
  if (facts.favor) {
    const favorData = facts.favor.state;
    await tx.playerFavorState.upsert({ where: { playerId: player.playerId }, create: { playerId: player.playerId,
      ...favorData }, update: favorData });
    if (facts.favor.claimDate) await tx.favorDailyClaim.upsert({ where: { playerId_businessDate: { playerId: player.playerId, businessDate: facts.favor.claimDate } },
      create: { playerId: player.playerId, businessDate: facts.favor.claimDate, origin: 'LEGACY', sourceChannel: null,
        operationId: null, claimedAt: null,
        legacyProvenance: { source: 'viewers_data.json.favor.lastClaimDate', snapshotHash } }, update: {} });
  }
  const avatarDefinitions = await tx.cosmeticDefinition.findMany({ where: { sourceCharacterId: { in: mapping.boxRows.map(row => row.characterId) }, type: CosmeticType.AVATAR }, select: { id: true } });
  await tx.playerCosmetic.deleteMany({ where: { playerId: player.playerId } });
  if (avatarDefinitions.length) await tx.playerCosmetic.createMany({ data: avatarDefinitions.map(definition => ({
    playerId: player.playerId, cosmeticId: definition.id, unlockSource: 'legacy-proven-ownership',
    provenance: { source: 'viewers_data.json.box', snapshotHash },
  })) });
  await tx.migrationRun.create({ data: { playerId: player.playerId, batchId, snapshotHash, status: 'COMPLETED',
    summary: { personalDomains: mapping.domains.filter(domain => domain.category === 'PLAYER_LOCAL_PHYSICAL').length,
      characters: mapping.boxRows.length, missions: mapping.missionMapping.rows.length } } });
}

export async function ensureLegacyCharacterAvatars(tx: Prisma.TransactionClient) {
  const characters = await tx.character.findMany({ select: { id: true, externalKey: true, name: true } });
  await tx.cosmeticDefinition.createMany({ data: characters.map(character => ({ externalKey: `character-avatar:${character.externalKey}`,
    sourceCharacterId: character.id, type: CosmeticType.AVATAR, displayName: character.name, assetPath: null,
    visibility: CosmeticVisibility.SECRET })), skipDuplicates: true });
}
