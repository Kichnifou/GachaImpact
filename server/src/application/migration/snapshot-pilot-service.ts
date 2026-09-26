import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import { CosmeticType, CosmeticVisibility } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { TwitchPilotService } from '../twitch/twitch-pilot-service.js';
import { AppError } from '../../api/errors.js';
import { businessDateToDatabaseDate, getBusinessDate, getBusinessDayStartAt } from '../../domain/time/business-date.js';
import { derivePlayerLevel } from '../../domain/player/player-progression.js';
import { normalizeLegacyName, parseStreamerbotSnapshot, resolveSnapshotViewer, type SnapshotFiles } from './streamerbot-snapshot.js';
import { mapLegacyBox, parseLegacyParisInstant } from './legacy-box-mapping.js';
import { mapLegacyC6 } from './legacy-c6-mapping.js';
import { mapLegacyTeams } from './legacy-team-mapping.js';
import { mapLegacyPermanentMissions } from './legacy-mission-mapping.js';

const keys = ['primogems', 'moras', 'particles_pyro', 'particles_hydro', 'particles_cryo', 'particles_electro', 'particles_anemo', 'particles_geo', 'particles_dendro'] as const;
const names = ['Progression', 'Ressources', 'Banque', 'Gacha / pity', 'Personnages / constellations', 'Teams', 'Missions', 'Roue / Quotidiennes', 'Expédition', 'Combat', 'Boss', 'Concours', 'Amitié', 'Event', 'Codes', 'Collection / objets', 'Statistiques économiques / sociales', 'Votes', 'Catalogues', 'Faveur', 'Giveaway', 'Concours / C6 personnel', 'Combat quotidien actuel', 'Cosmétiques de personnages', 'Cible de bannière'] as const;
type DomainCategory = 'PLAYER_LOCAL_PHYSICAL' | 'DEFERRED_CROSS_PLAYER_OR_GLOBAL' | 'DEFERRED_NOT_PHYSICAL' | 'BLOCKED_AMBIGUOUS';
type Domain = { name: string; category: DomainCategory; action: 'NO_CHANGE' | 'UPDATE' | 'REPLACE' | 'CREATE' | 'PENDING_MAPPING' | 'DEFERRED' | 'BLOCKED'; current: string; snapshot: string; reason: string | null; anomalies: string[] };
const deferredGlobal = new Set<string>(['Boss', 'Concours', 'Amitié', 'Event', 'Codes', 'Votes', 'Catalogues', 'Combat quotidien actuel', 'Cible de bannière']);
const deferredAbsent = new Set<string>(['Faveur', 'Giveaway']);
function initialDomain(name: string): Domain {
  if (deferredGlobal.has(name)) return { name, category: 'DEFERRED_CROSS_PLAYER_OR_GLOBAL', action: 'DEFERRED', current: 'État autonome conservé', snapshot: 'État source à rapprocher du référentiel global ou d’autres Players', reason: 'Identités ou état partagé nécessaires au rapprochement ; aucun autre Player créé.', anomalies: [] };
  if (deferredAbsent.has(name)) return { name, category: 'DEFERRED_NOT_PHYSICAL', action: 'DEFERRED', current: 'Cible absente', snapshot: 'Donnée legacy conservée dans le snapshot', reason: 'Aucune table Player correspondante n’est encore matérialisée.', anomalies: [] };
  return { name, category: 'PLAYER_LOCAL_PHYSICAL', action: 'PENDING_MAPPING', current: 'État autonome conservé', snapshot: 'Source personnelle reconnue', reason: 'Mapping ou remplacement transactionnel non encore implémenté ; import bloqué.', anomalies: [] };
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function integer(value: unknown, label: string): bigint {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new AppError(`Valeur legacy invalide : ${label}.`, 422, 'SNAPSHOT_VALUE_INVALID');
  return BigInt(value);
}
function smallInteger(value: unknown, label: string, maximum = 32_767): number {
  const parsed = integer(value, label);
  if (parsed > BigInt(maximum)) throw new AppError(`Valeur legacy hors bornes : ${label}.`, 422, 'SNAPSHOT_VALUE_INVALID');
  return Number(parsed);
}
function resourceAmounts(viewer: Record<string, unknown>) {
  const particles = record(viewer.particles);
  return new Map(keys.map(key => [key, integer(key.startsWith('particles_') ? particles[key.slice(10)] : viewer[key], key)]));
}
function legacyDate(value: unknown, label: string): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value)
    throw new AppError(`Date legacy invalide : ${label}.`, 422, 'SNAPSHOT_VALUE_INVALID');
  return value;
}
const asText = (value: bigint | number | null | undefined) => value == null ? 'Absent' : String(value);

export class SnapshotPilotService {
  private readonly previewKey: Buffer | null;
  constructor(private readonly db: PrismaClient, private readonly twitch: TwitchPilotService, previewSecret: string) {
    this.previewKey = previewSecret ? createHash('sha256').update('streamerbot-preview-v1\0').update(previewSecret).digest() : null;
  }

  private previewSignature(id: string, playerId: string, snapshotHash: string, expiresAt: number) {
    if (!this.previewKey) throw new AppError('Le pilote snapshot n’est pas configuré.', 503, 'SNAPSHOT_UNAVAILABLE');
    return createHmac('sha256', this.previewKey).update(`${id}.${playerId}.${snapshotHash}.${expiresAt}`).digest();
  }

  private verifyPreviewToken(token: string, playerId: string, snapshotHash: string) {
    const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9]{13})\.([A-Za-z0-9_-]{43})$/.exec(token);
    if (!match) throw new AppError('Nouvelle prévisualisation requise pour ce snapshot.', 409, 'SNAPSHOT_PREVIEW_REQUIRED');
    const expiresAt = Number(match[2]);
    const supplied = Buffer.from(match[3]!, 'base64url');
    const expected = this.previewSignature(match[1]!, playerId, snapshotHash, expiresAt);
    if (expiresAt <= Date.now() || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      throw new AppError('Nouvelle prévisualisation requise pour ce snapshot.', 409, 'SNAPSHOT_PREVIEW_REQUIRED');
    return { id: match[1]!, expiresAt: new Date(expiresAt) };
  }

  private async context(identity: AuthenticatedIdentity, files: SnapshotFiles) {
    const player = await this.twitch.requirePilot(identity);
    const linked = await this.db.twitchIdentity.findUnique({ where: { playerId: player.id } });
    if (!linked) throw new AppError('Liez d’abord votre compte Twitch.', 409, 'TWITCH_NOT_LINKED');
    const snapshot = parseStreamerbotSnapshot(files);
    const viewer = resolveSnapshotViewer(snapshot, linked.login);
    return { player, linked, snapshot, viewer };
  }

  private async report(playerId: string, viewer: Record<string, unknown>, sources: Readonly<Record<string, unknown>>, login: string) {
    const progression = await this.db.playerProgression.findUnique({ where: { playerId } });
    const balances = await this.db.playerResourceBalance.findMany({ where: { playerId } });
    const openTrades = await this.db.tradeRequest.count({ where: { senderPlayerId: playerId, state: 'PENDING' } });
    const bank = await this.db.playerBankAccount.findUnique({ where: { playerId }, select: { balance: true, lastInterestDate: true } });
    const gacha = await this.db.playerGachaState.findUnique({ where: { playerId } });
    const characters = await this.db.playerCharacter.count({ where: { playerId } });
    const boxSource = record(viewer.box);
    const boxCatalog = await this.db.character.findMany({ where: { externalKey: { in: Object.keys(boxSource).map(key => `legacy:${key}`) } }, select: { id: true, externalKey: true, rarity: true } });
    const boxMapping = mapLegacyBox(viewer, boxCatalog, new Date());
    const c6Mapping = mapLegacyC6(sources['c6_characters.json'], login, boxMapping.rows, boxCatalog);
    const teamMapping = mapLegacyTeams(viewer, boxMapping.rows);
    const currentC6 = await this.db.c6CompetitionProgress.count({ where: { playerId } });
    const currentAvatars = await this.db.playerCosmetic.count({ where: { playerId, cosmetic: { sourceCharacterId: { not: null } } } });
    const teams = await this.db.team.count({ where: { playerId } });
    const expedition = await this.db.playerExpedition.findUnique({ where: { playerId }, select: { state: true } });
    const combatStats = await this.db.playerCombatStats.findUnique({ where: { playerId } });
    const currentCharacterCombatStats = await this.db.playerCharacterCombatStats.count({ where: { playerId } });
    const wheel = await this.db.playerWheelStats.findUnique({ where: { playerId } });
    const wheelDaily = await this.db.playerWheelDailyState.findMany({ where: { playerId }, select: { businessDate: true } });
    const dailyReward = await this.db.playerDailyRewardState.findUnique({ where: { playerId }, select: { lastClaimDate: true } });
    const codes = await this.db.giftCodeClaim.count({ where: { playerId } });
    const friendships = await this.db.friendship.count({ where: { OR: [{ playerAId: playerId }, { playerBId: playerId }] } });
    const friendRequests = await this.db.friendRequest.count({ where: { OR: [{ senderPlayerId: playerId }, { recipientPlayerId: playerId }] } });
    const items = await this.db.playerItem.count({ where: { playerId } });
    const coffre = record(viewer.coffre);
    const specialItems = record(viewer.specialItems);
    const itemCatalog = await this.db.itemDefinition.findMany({ where: { externalKey: { in: [...Object.keys(coffre), 'masterless-stella-fortuna'] } }, select: { id: true, externalKey: true } });
    const itemIds = new Map(itemCatalog.map(item => [item.externalKey, item.id]));
    const itemBlockers: string[] = [];
    const itemRows: { itemId: string; quantity: bigint; externalKey: string }[] = [];
    for (const [externalKey, rawQuantity] of [...Object.entries(coffre), ['masterless-stella-fortuna', specialItems.masterlessStellaFortuna] as const]) {
      const itemId = itemIds.get(externalKey);
      if (!itemId) { itemBlockers.push('Objet legacy sans définition catalogue physique.'); continue; }
      itemRows.push({ itemId, externalKey, quantity: integer(rawQuantity, `item ${externalKey}`) });
    }
    const socialStats = await this.db.playerSocialStats.findUnique({ where: { playerId } });
    const economyStats = await this.db.playerEconomyStats.findUnique({ where: { playerId } });
    const missionDefinitions = await this.db.permanentMissionDefinition.findMany({ where: { isActive: true }, select: { id: true, externalKey: true, metric: true, rank: true, target: true } });
    const currentMissionProgress = await this.db.playerPermanentMissionProgress.count({ where: { playerId } });
    const currentDailyChallenge = await this.db.playerDailyChallenge.count({ where: { playerId } });
    const stats = record(viewer.stats);
    const xp = integer(viewer.xp, 'xp');
    const totalMessages = integer(stats.totalMessages, 'stats.totalMessages');
    const countedMessages = integer(stats.countedMessages, 'stats.countedMessages');
    const overflowClaims = integer(stats.level100OverflowRewardsClaimed, 'stats.level100OverflowRewardsClaimed');
    if (overflowClaims > 2_147_483_647n) throw new AppError('Compteur legacy trop grand.', 422, 'SNAPSHOT_VALUE_INVALID');
    const resources = resourceAmounts(viewer);
    const bankSource = record(viewer.bank);
    const bankBalance = integer(bankSource.moras, 'bank.moras');
    const current = new Map(balances.map(row => [row.resourceKey, row.amount]));
    const domains: Domain[] = names.map(initialDomain);
    domains[0] = { name: 'Progression', category: 'PLAYER_LOCAL_PHYSICAL', action: progression ? (progression.xp === xp && progression.totalMessages === totalMessages && progression.countedMessages === countedMessages && progression.level100OverflowRewardsClaimed === Number(overflowClaims) ? 'NO_CHANGE' : 'REPLACE') : 'CREATE',
      current: `XP ${asText(progression?.xp)}, messages ${asText(progression?.totalMessages)}`, snapshot: `XP ${xp}, messages ${totalMessages}`, reason: null, anomalies: [] };
    const sameResources = [...resources].every(([key, amount]) => current.get(key) === amount);
    domains[1] = { name: 'Ressources', category: 'PLAYER_LOCAL_PHYSICAL', action: balances.length ? (sameResources ? 'NO_CHANGE' : 'REPLACE') : 'CREATE',
      current: `${balances.length} soldes, Primos ${asText(current.get('primogems'))}, Moras ${asText(current.get('moras'))}`,
      snapshot: `${resources.size} soldes, Primos ${resources.get('primogems')}, Moras ${resources.get('moras')}`, reason: null, anomalies: [] };
    if (openTrades) { domains[1]!.category = 'BLOCKED_AMBIGUOUS'; domains[1]!.action = 'BLOCKED'; domains[1]!.reason = 'Échanges sortants en attente liés aux ressources à remplacer.'; domains[1]!.anomalies.push(`${openTrades} échange(s) sortant(s) en attente : résolution requise avant import.`); }
    const cutoverDate = getBusinessDate(new Date());
    const dates = record(viewer.dates);
    const lastWheelDate = legacyDate(dates.lastWheelDate, 'dates.lastWheelDate');
    const lastDailyRewardDate = legacyDate(dates.lastDailyFirstMessageReward, 'dates.lastDailyFirstMessageReward');
    const wheelSpins = integer(stats.totalWheelSpins, 'stats.totalWheelSpins');
    const wheelJackpots = integer(stats.totalWheelJackpots, 'stats.totalWheelJackpots');
    const pity = record(viewer.pity);
    const guarantee = record(viewer.guarantee);
    if (typeof guarantee.guaranteedFeatured5 !== 'boolean') throw new AppError('Garantie Gacha legacy invalide.', 422, 'SNAPSHOT_VALUE_INVALID');
    const lostStreak = smallInteger(stats.fiftyFiftyLostStreak, 'stats.fiftyFiftyLostStreak');
    const gachaState = {
      pity5: smallInteger(pity.pity5, 'pity.pity5', 89), pity4: smallInteger(pity.pity4, 'pity.pity4', 9),
      guaranteedFeatured5: guarantee.guaranteedFeatured5,
      fiftyFiftyLostStreak: lostStreak, captureProgress: Math.min(lostStreak, 3), selectedBannerCharacterId: null,
      totalPulls: integer(stats.totalPulls, 'stats.totalPulls'), totalFiveStars: integer(stats.totalFiveStars, 'stats.totalFiveStars'),
      totalFourStars: integer(stats.totalFourStars, 'stats.totalFourStars'), fiftyFiftyWon: integer(stats.fiftyFiftyWon, 'stats.fiftyFiftyWon'),
      fiftyFiftyLost: integer(stats.fiftyFiftyLost, 'stats.fiftyFiftyLost'), capturesTriggered: 0n,
    };
    const economyState = {
      totalPrimosEarned: integer(stats.totalPrimosEarned, 'stats.totalPrimosEarned'),
      totalPrimosSpent: integer(stats.totalPrimosSpent, 'stats.totalPrimosSpent'),
      totalMorasEarned: integer(stats.totalMorasEarned, 'stats.totalMorasEarned'),
      totalMorasSpent: integer(stats.totalMorasSpent, 'stats.totalMorasSpent'),
      totalMainElementParticlesEarned: integer(stats.totalMainElementParticlesEarned, 'stats.totalMainElementParticlesEarned'),
    };
    const socialState = { totalFriendHeartsSent: integer(stats.totalFriendHeartsSent, 'stats.totalFriendHeartsSent') };
    const totalCompleted = integer(stats.totalExpeditionsCompleted, 'stats.totalExpeditionsCompleted');
    const combatState = { totalFights: integer(stats.totalCombatFights, 'stats.totalCombatFights'),
      totalWins: integer(stats.totalCombatWins, 'stats.totalCombatWins'), totalLosses: integer(stats.totalCombatLosses, 'stats.totalCombatLosses'),
      totalManualWins: stats.totalManualCombatWins == null ? 0n : integer(stats.totalManualCombatWins, 'stats.totalManualCombatWins') };
    const combatSource = record(viewer.combat);
    const wins = record(combatSource.characterWins);
    const losses = record(combatSource.characterLosses);
    const combatKeys = new Set([...Object.keys(wins), ...Object.keys(losses)]);
    const catalogByLegacyKey = new Map(boxCatalog.map(row => [row.externalKey.slice(7), row.id]));
    const combatBlockers: string[] = [];
    const characterCombatRows: { characterId: string; wins: bigint; losses: bigint }[] = [];
    for (const key of combatKeys) {
      const characterId = catalogByLegacyKey.get(key);
      if (!characterId) { combatBlockers.push('Statistique Combat liée à un personnage sans catalogue.'); continue; }
      characterCombatRows.push({ characterId, wins: wins[key] == null ? 0n : integer(wins[key], `combat.characterWins.${key}`),
        losses: losses[key] == null ? 0n : integer(losses[key], `combat.characterLosses.${key}`) });
    }
    if (combatState.totalFights !== combatState.totalWins + combatState.totalLosses || combatState.totalManualWins > combatState.totalWins)
      combatBlockers.push('Totaux Combat legacy incohérents.');
    const missionMetrics: Record<string, bigint> = {
      COUNTED_MESSAGES: countedMessages, PULLS: gachaState.totalPulls,
      DISTINCT_CHARACTERS_4: BigInt(boxMapping.rows.filter(row => boxCatalog.find(character => character.id === row.characterId)?.rarity === 4).length),
      DISTINCT_CHARACTERS_5: BigInt(boxMapping.rows.filter(row => boxCatalog.find(character => character.id === row.characterId)?.rarity === 5).length),
      MORAS_EARNED: economyState.totalMorasEarned, MAIN_ELEMENT_PARTICLES_EARNED: economyState.totalMainElementParticlesEarned,
      EXPEDITIONS_COMPLETED: totalCompleted, COMBAT_WINS: combatState.totalWins, FRIEND_HEARTS_SENT: socialState.totalFriendHeartsSent,
      C6_CHARACTERS: BigInt(boxMapping.rows.filter(row => row.constellation === 6).length), PERFECT_FRIENDSHIP: 0n,
      PLAYER_LEVEL: BigInt(derivePlayerLevel(xp)), MANUAL_COMBAT_WINS: combatState.totalManualWins,
    };
    const missionMapping = mapLegacyPermanentMissions(viewer, missionDefinitions, missionMetrics, new Date());
    const dailySource = record(record(viewer.missions).daily);
    const dailyDate = dailySource ? legacyDate(dailySource.startedAt, 'missions.daily.startedAt') : null;
    const dailyDefinition = dailyDate === getBusinessDate(new Date()) && typeof dailySource?.missionId === 'string'
      ? await this.db.dailyChallengeDefinition.findUnique({ where: { externalKey: dailySource.missionId } }) : null;
    const missionBlockers = [...missionMapping.blockers];
    let dailyData: { businessDate: Date; definitionId: string; definitionExternalKeySnapshot: string; typeSnapshot: string;
      displayNameSnapshot: string; descriptionSnapshot: string; progressLabelSnapshot: string; targetSnapshot: bigint;
      rewardPrimogemsSnapshot: bigint; progress: bigint; status: 'ACTIVE' | 'COMPLETED'; assignedAt: Date;
      completedAt: null; switchCount: number } | null = null;
    if (dailyDate === getBusinessDate(new Date())) {
      if (!dailySource || !dailyDefinition || typeof dailySource.type !== 'string' || dailySource.type !== dailyDefinition.type ||
          typeof dailySource.completed !== 'boolean' || typeof dailySource.rewardClaimed !== 'boolean' ||
          (dailySource.completed && !dailySource.rewardClaimed)) missionBlockers.push('Défi quotidien du jour absent, incompatible ou récompense contradictoire.');
      else {
        const progress = integer(dailySource.progress, 'missions.daily.progress');
        const target = integer(dailySource.target, 'missions.daily.target');
        const switchCount = smallInteger(dailySource.switchCount, 'missions.daily.switchCount');
        if (target !== dailyDefinition.target || progress > target) missionBlockers.push('Objectif ou progression du Défi quotidien incompatible avec le catalogue.');
        else dailyData = { businessDate: businessDateToDatabaseDate(dailyDate), definitionId: dailyDefinition.id,
          definitionExternalKeySnapshot: dailyDefinition.externalKey, typeSnapshot: dailyDefinition.type,
          displayNameSnapshot: dailyDefinition.displayName, descriptionSnapshot: dailyDefinition.description,
          progressLabelSnapshot: dailyDefinition.progressLabel, targetSnapshot: target,
          rewardPrimogemsSnapshot: dailyDefinition.rewardPrimogems, progress,
          status: dailySource.completed ? 'COMPLETED' : 'ACTIVE', assignedAt: getBusinessDayStartAt(dailyDate),
          completedAt: null, switchCount };
      }
    }
    const expeditionSource = record(viewer.expedition);
    const expeditionAnomalies: string[] = [];
    const expeditionBlockers: string[] = [];
    if (typeof expeditionSource.active !== 'boolean') expeditionBlockers.push('Statut Expedition legacy illisible.');
    const departureBusinessDate = legacyDate(expeditionSource.lastStartedDate, 'expedition.lastStartedDate');
    let expeditionState: 'IDLE' | 'RUNNING' | 'READY' = 'IDLE';
    let expeditionCharacterId: string | null = null;
    let departedAt: Date | null = null;
    let readyAt: Date | null = null;
    if (expeditionSource.active === true) {
      const legacyCharacterId = expeditionSource.characterId;
      const character = Number.isSafeInteger(legacyCharacterId) ? boxCatalog.find(row => row.externalKey === `legacy:${legacyCharacterId}`) : null;
      if (!character || !boxMapping.rows.some(row => row.characterId === character.id)) {
        expeditionAnomalies.push('Expedition active annulée : personnage non possédé ou introuvable.');
      } else {
        departedAt = parseLegacyParisInstant(expeditionSource.startedAt);
        readyAt = parseLegacyParisInstant(expeditionSource.readyAt);
        if (!readyAt && departedAt) { readyAt = new Date(departedAt.getTime() + 20 * 3_600_000); expeditionAnomalies.push('readyAt Expedition reconstruit depuis startedAt + 20 h.'); }
        if (!departedAt || !readyAt) expeditionAnomalies.push('Expedition active annulée : dates insuffisantes.');
        else { expeditionCharacterId = character.id; expeditionState = readyAt <= new Date() ? 'READY' : 'RUNNING'; }
      }
    }
    const expeditionData = { state: expeditionState, characterId: expeditionCharacterId,
      departedAt: expeditionCharacterId ? departedAt : null, readyAt: expeditionCharacterId ? readyAt : null,
      departureBusinessDate: departureBusinessDate ? businessDateToDatabaseDate(departureBusinessDate) : null,
      lastCompletedAt: null, totalCompleted };
    domains[2] = { name: 'Banque', category: 'PLAYER_LOCAL_PHYSICAL', action: bank ? (bank.balance === bankBalance && bank.lastInterestDate.toISOString().slice(0, 10) === cutoverDate ? 'NO_CHANGE' : 'REPLACE') : 'CREATE',
      current: `Solde Banque ${asText(bank?.balance)}`, snapshot: `Solde Banque ${bankBalance}`, reason: null, anomalies: [] };
    const sameGacha = gacha && (Object.keys(gachaState) as (keyof typeof gachaState)[]).every(key => gacha[key] === gachaState[key]);
    domains[3] = { name: 'Gacha / pity', category: 'PLAYER_LOCAL_PHYSICAL', action: gacha ? (sameGacha ? 'NO_CHANGE' : 'REPLACE') : 'CREATE',
      current: `Pity 5★ ${gacha?.pity5 ?? 'absente'}, 4★ ${gacha?.pity4 ?? 'absente'}`,
      snapshot: `Pity 5★ ${gachaState.pity5}, 4★ ${gachaState.pity4} ; garantie et compteurs historiques`,
      reason: null, anomalies: [] };
    domains[4] = { name: 'Personnages / constellations', category: boxMapping.blockers.length ? 'BLOCKED_AMBIGUOUS' : 'PLAYER_LOCAL_PHYSICAL',
      action: boxMapping.blockers.length ? 'BLOCKED' : characters ? 'REPLACE' : 'CREATE',
      current: `${characters} possessions standalone`, snapshot: `Possessions : ${boxMapping.rows.length}`,
      reason: boxMapping.blockers.length ? 'Correspondance Box → catalogue ou structure legacy ambiguë.' : null,
      anomalies: [...boxMapping.anomalies, ...boxMapping.blockers] };
    const c6 = Object.entries(record(sources['c6_characters.json'])).filter(([name]) => normalizeLegacyName(name) === normalizeLegacyName(login));
    if (c6.length > 1) domains[4]!.anomalies.push('Entrées C6 ambiguës pour le viewer pilote.');
    if (c6.length === 1) {
      const c6Characters = Object.keys(record(record(c6[0]![1]).characters));
      const missing = c6Characters.filter(key => !(key in record(viewer.box)));
      domains[4]!.snapshot += `, C6 spécialisés ${c6Characters.length}`;
      if (missing.length) domains[4]!.anomalies.push(`${missing.length} personnage(s) C6 absents de la Box viewer.`);
    }
    domains[21] = { name: 'Concours / C6 personnel', category: c6Mapping.blockers.length ? 'BLOCKED_AMBIGUOUS' : 'PLAYER_LOCAL_PHYSICAL',
      action: c6Mapping.blockers.length ? 'BLOCKED' : currentC6 ? 'REPLACE' : 'CREATE',
      current: `${currentC6} progression(s) C6 standalone`, snapshot: `${c6Mapping.rows.length} progression(s) C6 personnelles`,
      reason: c6Mapping.blockers.length ? 'Progression personnelle C6 impossible à rattacher sans ambiguïté.' : null,
      anomalies: [...c6Mapping.anomalies, ...c6Mapping.blockers] };
    domains[23] = { name: 'Cosmétiques de personnages', category: 'PLAYER_LOCAL_PHYSICAL',
      action: currentAvatars || boxMapping.rows.length ? 'REPLACE' : 'NO_CHANGE',
      current: `${currentAvatars} avatar(s) personnage possédé(s)`, snapshot: `${boxMapping.rows.length} avatar(s) dérivables de la Box`,
      reason: null, anomalies: [] };
    domains[5] = { name: 'Teams', category: teamMapping.blockers.length ? 'BLOCKED_AMBIGUOUS' : 'PLAYER_LOCAL_PHYSICAL',
      action: teamMapping.blockers.length ? 'BLOCKED' : teams ? 'REPLACE' : 'CREATE',
      current: `${teams} Teams standalone`, snapshot: `${teamMapping.slots.length} positions, dont ${teamMapping.slots.filter(slot => slot.members.length).length} compositions`,
      reason: teamMapping.blockers.length ? 'Composition personnelle impossible à rattacher sans ambiguïté.' : null,
      anomalies: [...teamMapping.anomalies, ...teamMapping.blockers] };
    domains[6] = { name: 'Missions', category: missionBlockers.length ? 'BLOCKED_AMBIGUOUS' : 'PLAYER_LOCAL_PHYSICAL',
      action: missionBlockers.length ? 'BLOCKED' : 'REPLACE',
      current: `${currentMissionProgress} permanentes, ${currentDailyChallenge} Défi(s) standalone`,
      snapshot: `${missionMapping.rows.length} permanentes, Défi du jour ${dailyData ? 'présent' : 'absent'}`,
      reason: missionBlockers.length ? 'Progression ou Défi quotidien legacy ambigu.' : null,
      anomalies: [...missionMapping.anomalies, ...missionBlockers] };
    domains[14]!.snapshot = `Codes utilisés : ${Array.isArray(viewer.usedCodes) ? viewer.usedCodes.length : 0}`;
    domains[14]!.current = `${codes} claims standalone`;
    domains[14]!.reason = 'Les claims dépendent des définitions et éditions du catalogue global de codes ; aucun claim ni crédit n’est fabriqué.';
    const legacyFriends = record(sources['friendships_data.json']);
    const relatedFriendships = Object.values(record(legacyFriends.friendships)).filter(raw =>
      Array.isArray(record(raw).users) && (record(raw).users as unknown[]).some(user => typeof user === 'string' && normalizeLegacyName(user) === normalizeLegacyName(login))).length;
    const relatedRequests = Object.values(record(legacyFriends.requests)).filter(raw => {
      const request = record(raw);
      return [request.from, request.to].some(user => typeof user === 'string' && normalizeLegacyName(user) === normalizeLegacyName(login));
    }).length;
    domains[12]!.current = `${friendships} relation(s), ${friendRequests} demande(s) standalone`;
    domains[12]!.snapshot = `${relatedFriendships} relation(s), ${relatedRequests} demande(s) concernant le pilote`;
    domains[12]!.reason = 'Les autres viewers ne disposent pas encore d’identités Player vérifiées ; relations et demandes conservées pour la migration générale.';
    const bossSource = record(sources['monthly_boss.json']);
    domains[10]!.current = 'Rencontre mensuelle standalone conservée';
    domains[10]!.snapshot = `Boss courant ${bossSource.currentBoss ? 'présent' : 'absent'}, ${Array.isArray(bossSource.history) ? bossSource.history.length : 0} historique(s) globaux`;
    domains[10]!.reason = 'Le Boss et ses participants sont un état global partagé ; aucune attaque ni récompense n’est rejouée.';
    const contestSource = record(sources['contests_data.json']);
    domains[11]!.current = 'Concours et participants standalone conservés';
    domains[11]!.snapshot = `Concours courant ${contestSource.currentContest ? 'présent' : 'absent'}, ${Array.isArray(contestSource.history) ? contestSource.history.length : 0} historique(s) globaux`;
    domains[11]!.reason = 'Lobby, résultats et participants sont partagés ; leur rapprochement attend la migration générale.';
    const eventSource = record(sources['monthly_events_data.json']);
    domains[13]!.current = 'Édition et participations Event standalone conservées';
    domains[13]!.snapshot = `${Object.keys(record(eventSource.participants)).length} participation(s) legacy dans l’édition globale`;
    domains[13]!.reason = 'L’édition globale, ses fenêtres et ses participants doivent être rapprochés ensemble.';
    const votesSource = record(sources['banner_votes.json']);
    domains[17]!.current = 'Rotation et votes standalone conservés';
    domains[17]!.snapshot = `${Object.keys(record(votesSource.voters)).length} votant(s) legacy dans la rotation globale`;
    domains[17]!.reason = 'La rotation et les votes communautaires doivent être rapprochés comme un tout.';
    const charactersSource = record(sources['genshin_characters.json']);
    domains[18]!.current = 'Catalogues standalone conservés';
    domains[18]!.snapshot = `${Array.isArray(charactersSource.characters) ? charactersSource.characters.length : 0} personnage(s) dans le catalogue legacy`;
    domains[18]!.reason = 'Les référentiels partagés ne sont pas remplacés par le snapshot d’un seul Player.';
    const dailyCombatSource = record(sources['combat_data.json']);
    domains[22]!.current = 'Rencontre quotidienne standalone conservée';
    domains[22]!.snapshot = `${Array.isArray(dailyCombatSource.enemyTeam) ? dailyCombatSource.enemyTeam.length : 0} ennemi(s) du jour, ${Object.keys(record(combatSource.lostCharacters)).length} KO personnel(s) legacy`;
    domains[22]!.reason = 'Les KO dépendent de la rencontre globale du jour, non rapprochée pendant le pilote.';
    domains[19]!.snapshot = `Faveur legacy ${viewer.favor == null ? 'absente' : 'présente'}`;
    domains[20]!.snapshot = `Giveaway legacy ${Object.keys(record(sources['giveaway.json'])).length ? 'présent' : 'absent'}`;
    domains[24]!.current = `Cible standalone ${gacha?.selectedBannerCharacterId ? 'définie' : 'absente'}`;
    domains[24]!.snapshot = `Cible legacy ${viewer.selectedBannerCharacterId == null ? 'absente' : 'présente'}`;
    domains[24]!.reason = 'La cible ne peut être liée sûrement qu’après rapprochement de la rotation globale de bannière.';
    domains[15] = { name: 'Collection / objets', category: itemBlockers.length ? 'BLOCKED_AMBIGUOUS' : 'PLAYER_LOCAL_PHYSICAL',
      action: itemBlockers.length ? 'BLOCKED' : items ? 'REPLACE' : 'CREATE',
      current: `${items} lignes d'objets standalone`, snapshot: `${itemRows.length} objets personnels, dont Stella`,
      reason: itemBlockers.length ? 'Définition catalogue absente ; placeholder sûr à matérialiser avant import.' : null,
      anomalies: itemBlockers };
    const sameEconomy = economyStats && (Object.keys(economyState) as (keyof typeof economyState)[]).every(key => economyStats[key] === economyState[key]);
    domains[16] = { name: 'Statistiques économiques / sociales', category: 'PLAYER_LOCAL_PHYSICAL',
      action: economyStats && socialStats ? (sameEconomy && socialStats.totalFriendHeartsSent === socialState.totalFriendHeartsSent ? 'NO_CHANGE' : 'REPLACE') : 'CREATE',
      current: `Économiques ${economyStats ? 'présentes' : 'absentes'}, sociales ${socialStats ? 'présentes' : 'absentes'}`,
      snapshot: `5 compteurs économiques et 1 compteur social historiques`, reason: null, anomalies: [] };
    domains[7] = { name: 'Roue / Quotidiennes', category: 'PLAYER_LOCAL_PHYSICAL',
      action: wheel || wheelDaily.length || dailyReward ? 'REPLACE' : 'CREATE',
      current: `Roue ${asText(wheel?.totalSpins)} tours, ${asText(wheel?.totalJackpots)} jackpots ; quotidien ${dailyReward?.lastClaimDate?.toISOString().slice(0, 10) ?? 'absent'}`,
      snapshot: `Roue ${wheelSpins} tours, ${wheelJackpots} jackpots ; dernier tour ${lastWheelDate ?? 'absent'}, dernière récompense quotidienne ${lastDailyRewardDate ?? 'absente'}`,
      reason: null, anomalies: [] };
    domains[8] = { name: 'Expédition', category: expeditionBlockers.length ? 'BLOCKED_AMBIGUOUS' : 'PLAYER_LOCAL_PHYSICAL',
      action: expeditionBlockers.length ? 'BLOCKED' : expedition ? 'REPLACE' : 'CREATE',
      current: `Expédition ${expedition?.state ?? 'absente'}`, snapshot: `État ${expeditionState}, ${totalCompleted} complétées`,
      reason: expeditionBlockers.length ? 'Source Expedition ambiguë.' : null, anomalies: [...expeditionAnomalies, ...expeditionBlockers] };
    domains[9] = { name: 'Combat', category: combatBlockers.length ? 'BLOCKED_AMBIGUOUS' : 'PLAYER_LOCAL_PHYSICAL',
      action: combatBlockers.length ? 'BLOCKED' : combatStats || currentCharacterCombatStats ? 'REPLACE' : 'CREATE',
      current: `${asText(combatStats?.totalFights)} combats, ${currentCharacterCombatStats} compteurs personnage`,
      snapshot: `${combatState.totalFights} combats, ${characterCombatRows.length} compteurs personnage`,
      reason: combatBlockers.length ? 'Compte ou personnage Combat impossible à rapprocher.' : null, anomalies: combatBlockers };
    return { domains, resources, bankBalance, boxRows: boxMapping.rows, c6Rows: c6Mapping.rows, teamSlots: teamMapping.slots, itemRows, missionMapping, dailyData, gachaState, economyState, socialState, expeditionData, combatState, characterCombatRows, wheel: { totalSpins: wheelSpins, totalJackpots: wheelJackpots, lastWheelDate, lastDailyRewardDate }, progression: { xp, totalMessages, countedMessages, level100OverflowRewardsClaimed: Number(overflowClaims) } };
  }

  async preview(identity: AuthenticatedIdentity, files: SnapshotFiles) {
    if (!this.previewKey) throw new AppError('Le pilote snapshot n’est pas configuré.', 503, 'SNAPSHOT_UNAVAILABLE');
    const { player, linked, snapshot, viewer } = await this.context(identity, files);
    const report = await this.report(player.id, viewer.data, snapshot.sources, linked.login);
    const id = randomUUID();
    const expiresAt = Date.now() + 15 * 60_000;
    const signature = this.previewSignature(id, player.id, snapshot.hash, expiresAt).toString('base64url');
    return { previewId: `${id}.${expiresAt}.${signature}`, snapshotHash: snapshot.hash, viewerFound: true, files: snapshot.files, domains: report.domains,
      warning: 'Ce rafraîchissement remplacera les domaines personnels mappés par le snapshot sélectionné. Le pilote reste bloqué tant qu’un domaine personnel physique attend son mapping ou qu’une ambiguïté subsiste. Les domaines globaux, interjoueurs ou sans cible physique restent explicitement différés.' };
  }

  async localReadOnlyReport(playerId: string, login: string, files: SnapshotFiles) {
    const snapshot = parseStreamerbotSnapshot(files);
    const viewer = resolveSnapshotViewer(snapshot, login);
    const report = await this.report(playerId, viewer.data, snapshot.sources, login);
    return { snapshotHash: snapshot.hash, files: snapshot.files, viewerFound: true, domains: report.domains };
  }

  async apply(identity: AuthenticatedIdentity, files: SnapshotFiles, previewId: string) {
    if (!this.previewKey) throw new AppError('Le pilote snapshot n’est pas configuré.', 503, 'SNAPSHOT_UNAVAILABLE');
    const { player, linked, snapshot, viewer } = await this.context(identity, files);
    const report = await this.report(player.id, viewer.data, snapshot.sources, linked.login);
    if (report.domains.some(domain => domain.category === 'BLOCKED_AMBIGUOUS' || (domain.category === 'PLAYER_LOCAL_PHYSICAL' && domain.action === 'PENDING_MAPPING')))
      throw new AppError('Le mapping du snapshot est incomplet ; aucun import ne peut être confirmé.', 409, 'SNAPSHOT_MAPPING_INCOMPLETE');
    const previewToken = this.verifyPreviewToken(previewId, player.id, snapshot.hash);
    const applyOnce = () => this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM players WHERE id = ${player.id}::uuid FOR UPDATE`;
      if (previewToken.expiresAt.getTime() <= Date.now()) throw new AppError('Nouvelle prévisualisation requise pour ce snapshot.', 409, 'SNAPSHOT_PREVIEW_REQUIRED');
      const openTrades = await tx.tradeRequest.count({ where: { senderPlayerId: player.id, state: 'PENDING' } });
      if (openTrades) throw new AppError('Résolvez les échanges en attente avant ce remplacement des ressources.', 409, 'SNAPSHOT_PENDING_TRADES');
      if (await tx.migrationPreview.findUnique({ where: { id: previewToken.id } }))
        throw new AppError('Cette confirmation a déjà été utilisée.', 409, 'SNAPSHOT_PREVIEW_REQUIRED');
      await tx.migrationPreview.create({ data: { id: previewToken.id, playerId: player.id, snapshotHash: snapshot.hash, expiresAt: previewToken.expiresAt } });
      const existing = await tx.migrationRun.findUnique({ where: { playerId_snapshotHash: { playerId: player.id, snapshotHash: snapshot.hash } } });
      if (existing) return { snapshotHash: snapshot.hash, replayed: true, imported: [], deferred: report.domains.filter(d => d.action === 'DEFERRED').map(d => d.name) };
      // A historical ledger may hold newer standalone test entries; the migration records a single adjustment per changed balance.
      const operation = await tx.businessOperation.findFirst({ where: { playerId: player.id, operationType: 'migration.streamerbot-refresh', idempotencyKey: `streamerbot:${snapshot.hash}` } })
        ?? await tx.businessOperation.create({ data: { playerId: player.id, operationType: 'migration.streamerbot-refresh', sourceChannel: 'MIGRATION',
          idempotencyKey: `streamerbot:${snapshot.hash}`, status: 'COMPLETED', completedAt: new Date(), resultSummary: { snapshotHash: snapshot.hash } } });
      await tx.playerProgression.upsert({ where: { playerId: player.id }, create: { playerId: player.id, ...report.progression }, update: report.progression });
      await tx.playerGachaState.upsert({ where: { playerId: player.id }, create: { playerId: player.id, ...report.gachaState }, update: report.gachaState });
      await tx.playerCharacter.deleteMany({ where: { playerId: player.id } });
      if (report.boxRows.length) await tx.playerCharacter.createMany({ data: report.boxRows.map(row => ({ playerId: player.id, characterId: row.characterId,
        constellation: row.constellation, copies: row.copies, firstObtainedAt: row.firstObtainedAt, favorite: row.favorite,
        provenance: row.provenance })) });
      const importedCharacterIds = report.boxRows.map(row => row.characterId);
      const avatarCharacters = importedCharacterIds.length ? await tx.character.findMany({ where: { id: { in: importedCharacterIds } }, select: { id: true, externalKey: true, name: true } }) : [];
      if (avatarCharacters.length) await tx.cosmeticDefinition.createMany({ data: avatarCharacters.map(character => ({
        externalKey: `character-avatar:${character.externalKey}`, sourceCharacterId: character.id, type: CosmeticType.AVATAR,
        displayName: character.name, assetPath: null, visibility: CosmeticVisibility.SECRET,
      })), skipDuplicates: true });
      const avatarDefinitions = await tx.cosmeticDefinition.findMany({ where: { sourceCharacterId: { in: importedCharacterIds } },
        select: { id: true, sourceCharacterId: true, type: true, externalKey: true } });
      const avatarByCharacter = new Map(avatarDefinitions.map(definition => [definition.sourceCharacterId, definition]));
      if (avatarCharacters.some(character => avatarByCharacter.get(character.id)?.externalKey !== `character-avatar:${character.externalKey}` || avatarByCharacter.get(character.id)?.type !== CosmeticType.AVATAR))
        throw new AppError('Définition Avatar personnage incohérente.', 409, 'SNAPSHOT_AVATAR_CONFLICT');
      const removedAvatars = await tx.playerCosmetic.findMany({ where: { playerId: player.id, cosmetic: { sourceCharacterId: { not: null } },
        cosmeticId: { notIn: avatarDefinitions.map(definition => definition.id) } }, select: { cosmeticId: true } });
      if (removedAvatars.length) {
        await tx.playerCosmetic.deleteMany({ where: { playerId: player.id, cosmeticId: { in: removedAvatars.map(row => row.cosmeticId) } } });
        await tx.player.updateMany({ where: { id: player.id, equippedAvatarCosmeticId: { in: removedAvatars.map(row => row.cosmeticId) } },
          data: { equippedAvatarCosmeticId: null } });
      }
      if (avatarDefinitions.length) await tx.playerCosmetic.createMany({ data: avatarDefinitions.map(definition => ({
        playerId: player.id, cosmeticId: definition.id, unlockSource: 'migration.streamerbot-snapshot',
        provenance: { snapshotHash: snapshot.hash, sourceCharacterId: definition.sourceCharacterId },
      })), skipDuplicates: true });
      await tx.c6CompetitionProgress.deleteMany({ where: { playerId: player.id } });
      if (report.c6Rows.length) await tx.c6CompetitionProgress.createMany({ data: report.c6Rows.map(row => ({ playerId: player.id, ...row })) as Prisma.C6CompetitionProgressCreateManyInput[] });
      await tx.team.deleteMany({ where: { playerId: player.id } });
      for (const slot of report.teamSlots) await tx.team.create({ data: { playerId: player.id, displayPosition: slot.position,
        name: slot.name, isActive: slot.isActive, isBaseSlot: slot.isBaseSlot, legacySavedAt: slot.legacySavedAt,
        members: { create: slot.members.map((characterId, index) => ({ characterId, position: index + 1 })) } } });
      await tx.playerEconomyStats.upsert({ where: { playerId: player.id }, create: { playerId: player.id, ...report.economyState }, update: report.economyState });
      await tx.playerSocialStats.upsert({ where: { playerId: player.id }, create: { playerId: player.id, ...report.socialState }, update: report.socialState });
      await tx.playerExpedition.upsert({ where: { playerId: player.id }, create: { playerId: player.id, ...report.expeditionData }, update: report.expeditionData });
      await tx.playerCombatStats.upsert({ where: { playerId: player.id }, create: { playerId: player.id, ...report.combatState }, update: report.combatState });
      await tx.playerCharacterCombatStats.deleteMany({ where: { playerId: player.id } });
      if (report.characterCombatRows.length) await tx.playerCharacterCombatStats.createMany({ data: report.characterCombatRows.map(row => ({ playerId: player.id, ...row })) });
      const priorMissionState = await tx.playerPermanentMissionState.findUnique({ where: { playerId: player.id }, select: { initializedAt: true } });
      const missionCutoverAt = new Date(Math.max(Date.now(), (priorMissionState?.initializedAt.getTime() ?? 0) + 1));
      const zUnlockedAt = report.missionMapping.zUnlockedAt ? missionCutoverAt : null;
      await tx.playerPermanentMissionState.upsert({ where: { playerId: player.id },
        create: { playerId: player.id, initializedAt: new Date(missionCutoverAt.getTime() - 1), zUnlockedAt,
          standaloneCatchupCompletedAt: missionCutoverAt },
        update: { zUnlockedAt, standaloneCatchupCompletedAt: missionCutoverAt } });
      await tx.playerPermanentMissionProgress.deleteMany({ where: { playerId: player.id } });
      await tx.playerPermanentMissionProgress.createMany({ data: report.missionMapping.rows.map(row => ({ playerId: player.id, ...row })) });
      await tx.playerDailyChallenge.deleteMany({ where: { playerId: player.id } });
      if (report.dailyData) await tx.playerDailyChallenge.create({ data: { playerId: player.id, ...report.dailyData } });
      await tx.playerItem.deleteMany({ where: { playerId: player.id } });
      if (report.itemRows.length) await tx.playerItem.createMany({ data: report.itemRows.map(row => ({ playerId: player.id, itemId: row.itemId, quantity: row.quantity,
        firstObtainedAt: null, legacyProvenance: { source: 'viewers_data.json', externalKey: row.externalKey, snapshotHash: snapshot.hash } })) });
      await tx.itemAcquisition.deleteMany({ where: { playerId: player.id, sourceKey: 'migration.streamerbot-snapshot' } });
      const collectionRows = report.itemRows.filter(row => row.externalKey !== 'masterless-stella-fortuna' && row.quantity > 0n);
      if (collectionRows.length) await tx.itemAcquisition.createMany({ data: collectionRows.map(row => ({ playerId: player.id, itemId: row.itemId,
        quantity: row.quantity, sourceKey: 'migration.streamerbot-snapshot', operationId: operation.id,
        provenance: { snapshotHash: snapshot.hash, historicalDateKnown: false } })) });
      // The legacy bank date is provenance only. Accrual starts at the next Paris reset after cutover.
      const cutoverDate = businessDateToDatabaseDate(getBusinessDate(new Date()));
      await tx.playerBankAccount.upsert({ where: { playerId: player.id },
        create: { playerId: player.id, balance: report.bankBalance, lastInterestDate: cutoverDate },
        update: { balance: report.bankBalance, lastInterestDate: cutoverDate } });
      await tx.playerWheelStats.upsert({ where: { playerId: player.id },
        create: { playerId: player.id, totalSpins: report.wheel.totalSpins, totalJackpots: report.wheel.totalJackpots },
        update: { totalSpins: report.wheel.totalSpins, totalJackpots: report.wheel.totalJackpots } });
      await tx.playerWheelDailyState.deleteMany({ where: { playerId: player.id } });
      if (report.wheel.lastWheelDate) await tx.playerWheelDailyState.create({ data: {
        playerId: player.id, businessDate: businessDateToDatabaseDate(report.wheel.lastWheelDate), resultKnown: false,
        legacyProvenance: { source: 'viewers_data.json', lastWheelDate: report.wheel.lastWheelDate },
      } });
      await tx.playerDailyRewardState.upsert({ where: { playerId: player.id },
        create: { playerId: player.id, firstClaimDate: null, lastClaimDate: report.wheel.lastDailyRewardDate ? businessDateToDatabaseDate(report.wheel.lastDailyRewardDate) : null },
        update: { firstClaimDate: null, lastClaimDate: report.wheel.lastDailyRewardDate ? businessDateToDatabaseDate(report.wheel.lastDailyRewardDate) : null, lastClaimedAt: null, lastOperationId: null } });
      for (const [key, amount] of report.resources) {
        const prior = await tx.playerResourceBalance.findUnique({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: key } } });
        const before = prior?.amount ?? 0n;
        await tx.playerResourceBalance.upsert({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: key } }, create: { playerId: player.id, resourceKey: key, amount }, update: { amount } });
        if (before !== amount) await tx.resourceMovement.create({ data: { playerId: player.id, resourceKey: key, delta: amount - before,
          balanceBefore: before, balanceAfter: amount, causeKey: 'migration.streamerbot-refresh', domainKey: 'migration', operationId: operation.id, sourceChannel: 'MIGRATION' } });
      }
      await tx.migrationRun.create({ data: { playerId: player.id, snapshotHash: snapshot.hash,
        summary: { imported: ['Progression', 'Ressources', 'Banque', 'Gacha / pity', 'Personnages / constellations', 'Teams', 'Missions', 'Roue / Quotidiennes', 'Statistiques économiques / sociales', 'Concours / C6 personnel', 'Collection / objets', 'Expédition', 'Combat', 'Cosmétiques de personnages'], deferred: report.domains.filter(d => d.action === 'DEFERRED').map(d => d.name), bankLegacyLastInterestDate: record(viewer.data.bank).lastInterestDate ?? null, legacySelectedBannerCharacterId: viewer.data.selectedBannerCharacterId ?? null, legacyZUnlockedAt: report.missionMapping.zUnlockedAt?.toISOString() ?? null, anomalies: report.domains.flatMap(d => d.anomalies) } as Prisma.InputJsonValue } });
      return { snapshotHash: snapshot.hash, replayed: false, imported: ['Progression', 'Ressources', 'Banque', 'Gacha / pity', 'Personnages / constellations', 'Teams', 'Missions', 'Roue / Quotidiennes', 'Statistiques économiques / sociales', 'Concours / C6 personnel', 'Collection / objets', 'Expédition', 'Combat', 'Cosmétiques de personnages'], deferred: report.domains.filter(d => d.action === 'DEFERRED').map(d => d.name) };
    }, { isolationLevel: 'Serializable', timeout: 30_000 });
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await applyOnce(); }
      catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
        if (code !== 'P2034' || attempt === 2) throw error;
      }
    }
    throw new AppError('Import indisponible.', 503, 'SNAPSHOT_RETRY_EXHAUSTED');
  }
}
