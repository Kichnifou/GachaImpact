import { CosmeticType, CosmeticVisibility, type Prisma } from '../../../generated/prisma/client.js';
import { businessDateToDatabaseDate, getBusinessDate } from '../../domain/time/business-date.js';
import { parseLegacyParisInstant } from './legacy-box-mapping.js';
import { projectLegacyFavorPeriod } from './legacy-favor-calendar.js';
import { mapLegacyXpProvenance } from './legacy-xp-provenance.js';
import type { PlannedPlayer } from './legacy-global-plan.js';
import type { SnapshotPilotService } from './snapshot-pilot-service.js';

type PlayerMapping = Awaited<ReturnType<SnapshotPilotService['globalPlayerPlan']>>;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function date(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const paris = parseLegacyParisInstant(value);
  if (paris) return paris;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) throw new Error('Invalid present legacy instant.');
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid present legacy instant.');
  return parsed;
}
function businessDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid present legacy business date.');
  const parsed = businessDateToDatabaseDate(value);
  if (parsed.toISOString().slice(0, 10) !== value) throw new Error('Invalid present legacy business date.');
  return parsed;
}

/** Writes only current, proven personal state. No synthetic BusinessOperation, movement or acquisition. */
export async function applyLegacyPersonalState(tx: Prisma.TransactionClient, player: PlannedPlayer,
  mapping: PlayerMapping, batchId: string, snapshotHash: string, cutoverAt: Date) {
  const blockers = mapping.domains.filter(domain => domain.category === 'BLOCKED_AMBIGUOUS' || domain.action === 'PENDING_MAPPING');
  if (blockers.length) throw new Error(`Personal mapping blocked in ${blockers.map(domain => domain.name).join(', ')}.`);
  const viewer = player.viewer;
  const dates = object(viewer.dates);
  const lastMessageAt = date(dates.lastSeen);
  const lastXpMessageAt = date(dates.lastMessageTime);
  const xpProvenance = mapLegacyXpProvenance(dates.lastXpDate, lastXpMessageAt);
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
    firstSeenAt: date(dates.firstSeen), lastMessageAt }, update: { login: player.twitchLogin, displayName: player.twitchDisplayName,
    firstSeenAt: date(dates.firstSeen), lastMessageAt } });
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
  const gachaLegacy = object(viewer.stats).lastPullWasFiveStar;
  const gacha = { ...mapping.gachaState, legacyLastPullWasFiveStar: typeof gachaLegacy === 'boolean' ? gachaLegacy : null };
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
  const options = object(viewer.options);
  const sortKey = ({ a: 'alphabetical', d: 'obtainedAt', c: 'constellation', e: 'element' } as Record<string, string>)[String(options.boxSort)] ?? 'alphabetical';
  const direction = options.boxSortDescending === true ? 'desc' : 'asc';
  await tx.playerPreference.upsert({ where: { playerId_preferenceKey: { playerId: player.playerId, preferenceKey: 'box.sort' } },
    create: { playerId: player.playerId, preferenceKey: 'box.sort', value: { sortKey, direction } },
    update: { value: { sortKey, direction } } });
  const favor = object(viewer.favor);
  if (viewer.favor != null) {
    const daysRemaining = favor.daysRemaining;
    if (typeof daysRemaining !== 'number' || !Number.isSafeInteger(daysRemaining)) throw new Error('Invalid legacy Faveur balance.');
    const obtainedDate = businessDate(favor.obtainedDate);
    const lastClaimDate = businessDate(favor.lastClaimDate);
    const period = projectLegacyFavorPeriod(daysRemaining, cutoverDate,
      obtainedDate?.toISOString().slice(0, 10) ?? null, lastClaimDate?.toISOString().slice(0, 10) ?? null);
    const favorData = { ...period, legacyObtainedDate: obtainedDate, legacyLastClaimDate: lastClaimDate,
      legacyProvenance: { source: 'viewers_data.json.favor', snapshotHash, cutoverBusinessDate: cutoverDate,
        initialDaysRemaining: daysRemaining, intervalBounds: 'inclusive' } };
    await tx.playerFavorState.upsert({ where: { playerId: player.playerId }, create: { playerId: player.playerId,
      ...favorData }, update: favorData });
    if (lastClaimDate) await tx.favorDailyClaim.upsert({ where: { playerId_businessDate: { playerId: player.playerId, businessDate: lastClaimDate } },
      create: { playerId: player.playerId, businessDate: lastClaimDate, origin: 'LEGACY', sourceChannel: null,
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
