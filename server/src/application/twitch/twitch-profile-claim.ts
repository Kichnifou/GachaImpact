import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { isTutorialPreference } from '../tutorial/tutorial-preferences.js';

const emptyDefaults = new Set(['PlayerEconomyStats', 'PlayerWheelStats', 'PlayerDailyRewardState', 'PlayerProgression', 'PlayerGachaState']);
const housekeeping = new Set(['WebIdentity', 'PlayerSession']);
const timestamps = new Set(['createdAt', 'updatedAt']);
const defaults: Record<string, Record<string, unknown>> = {
  PlayerEconomyStats: { totalPrimosEarned: 0n, totalPrimosSpent: 0n, totalMorasEarned: 0n, totalMorasSpent: 0n, totalMainElementParticlesEarned: 0n },
  PlayerWheelStats: { totalSpins: 0n, totalJackpots: 0n },
  PlayerDailyRewardState: { firstClaimDate: null, lastClaimDate: null, lastClaimedAt: null, lastOperationId: null, legacyProvenance: null },
  PlayerProgression: { xp: 0n, level100OverflowRewardsClaimed: 0, totalMessages: 0n, countedMessages: 0n, lastXpAt: null, lastXpMessageAt: null, legacyLastXpDate: null },
  PlayerGachaState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null,
    totalPulls: 0n, totalFiveStars: 0n, totalFourStars: 0n, fiftyFiftyWon: 0n, fiftyFiftyLost: 0n, capturesTriggered: 0n, legacyLastPullWasFiveStar: null },
};
const knownTables: Record<string, string> = {
  web_identities: 'WebIdentity', player_sessions: 'PlayerSession', player_economy_stats: 'PlayerEconomyStats', player_wheel_stats: 'PlayerWheelStats',
  player_daily_reward_state: 'PlayerDailyRewardState', player_progression: 'PlayerProgression', player_gacha_states: 'PlayerGachaState',
  player_resource_balances: 'PlayerResourceBalance', player_permanent_mission_states: 'PlayerPermanentMissionState',
  player_permanent_mission_progress: 'PlayerPermanentMissionProgress', privacy_settings: 'PrivacySetting', player_preferences: 'PlayerPreference', player_activity_state: 'PlayerActivityState',
};
type Row = Record<string, unknown>;
type Delegate = { findMany(args: unknown): Promise<Row[]> };
const delegate = (tx: Prisma.TransactionClient, name: string) =>
  (tx as unknown as Record<string, Delegate>)[name[0]!.toLowerCase() + name.slice(1)]!;

function declaredDefaults(modelName: string, row: Row): boolean {
  const expected = defaults[modelName]!;
  return Object.keys(expected).every(key => row[key] === expected[key])
    && Object.keys(row).every(key => key === 'playerId' || timestamps.has(key) || Object.hasOwn(expected, key));
}

/** Every Player FK domain is inspected. New/unknown domains with rows fail closed.
 * Only the actual empty bootstrap and disposable UI/session bookkeeping are accepted. */
export async function isDisposableWebPlayer(tx: Prisma.TransactionClient, playerId: string): Promise<boolean> {
  const player = await tx.player.findUnique({ where: { id: playerId } });
  if (!player || player.status !== 'ACTIVE' || player.elementKey !== null || player.legacyUsername !== null
    || player.migrationRunId !== null || player.equippedAvatarCosmeticId !== null || player.equippedTitleCosmeticId !== null) return false;
  const playerKeys = new Set(['id', 'displayName', 'elementKey', 'equippedAvatarCosmeticId', 'equippedTitleCosmeticId', 'status', 'createdAt', 'updatedAt', 'migrationRunId', 'legacyUsername']);
  const playerColumns = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint count FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='players'`;
  if (Object.keys(player).some(key => !playerKeys.has(key)) || playerColumns[0]!.count !== BigInt(playerKeys.size)) return false;
  const required = new Set([...emptyDefaults, 'PlayerResourceBalance', 'PlayerPermanentMissionState', 'PlayerPermanentMissionProgress', 'PrivacySetting', 'WebIdentity']);
  const domains = await tx.$queryRaw<{ table_name: string; columns: string[] }[]>`SELECT child.relname table_name, array_agg(DISTINCT a.attname)::text[] columns
    FROM pg_constraint fk JOIN pg_class child ON child.oid=fk.conrelid JOIN pg_class parent ON parent.oid=fk.confrelid
    JOIN pg_namespace n ON n.oid=child.relnamespace JOIN pg_namespace pn ON pn.oid=parent.relnamespace
    CROSS JOIN LATERAL unnest(fk.conkey) key(col) JOIN pg_attribute a ON a.attrelid=child.oid AND a.attnum=key.col
    WHERE fk.contype='f' AND n.nspname=current_schema() AND pn.nspname=current_schema() AND parent.relname='players' GROUP BY child.relname ORDER BY child.relname`;
  for (const domain of domains) {
    const model = { name: knownTables[domain.table_name] ?? '' };
    if (!model.name) {
      if (!/^[a-z][a-z0-9_]*$/.test(domain.table_name) || domain.columns.some(column => !/^[a-z][a-z0-9_]*$/.test(column))) return false;
      const result = await tx.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint count FROM "${domain.table_name}" WHERE ${domain.columns.map(column => `"${column}"=$1::uuid`).join(' OR ')}`, playerId);
      if (result[0]!.count) return false;
      continue;
    }
    const rows = await delegate(tx, model.name).findMany({ where: { playerId }, take: 1000 });
    if (rows.length >= 1000 || required.has(model.name) && !rows.length) return false;
    if (!rows.length) continue;
    const columns = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint count FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=${domain.table_name}`;
    if (columns[0]!.count !== BigInt(Object.keys(rows[0]!).length)) return false;
    if (housekeeping.has(model.name)) {
      if (model.name === 'WebIdentity' && rows.length !== 1) return false;
    } else if (emptyDefaults.has(model.name)) {
      if (rows.length !== 1 || !declaredDefaults(model.name, rows[0]!)) return false;
    } else if (model.name === 'PlayerResourceBalance') {
      const resources = await tx.resourceDefinition.findMany({ where: { isActive: true }, select: { key: true } });
      if (rows.length !== resources.length || resources.length !== 9 || rows.some(row => row.amount !== 0n || !resources.some(resource => resource.key === row.resourceKey))) return false;
    } else if (model.name === 'PrivacySetting') {
      if (rows.length !== 1 || rows[0]!.categoryKey !== 'PRIVATE_MESSAGES' || rows[0]!.level !== 'PUBLIC') return false;
    } else if (model.name === 'PlayerPermanentMissionState') {
      if (rows.length !== 1 || rows[0]!.zUnlockedAt !== null || rows[0]!.legacyProvenance !== null
        || !(rows[0]!.standaloneCatchupCompletedAt instanceof Date) || !(rows[0]!.initializedAt instanceof Date)
        || rows[0]!.standaloneCatchupCompletedAt.getTime() !== rows[0]!.initializedAt.getTime()) return false;
    } else if (model.name === 'PlayerPermanentMissionProgress') {
      const definitions = await tx.permanentMissionDefinition.findMany({ where: { isActive: true }, select: { id: true, rank: true } });
      if (rows.length !== definitions.length || rows.some(row => {
        const definition = definitions.find(item => item.id === row.definitionId);
        return !definition || row.status !== (definition.rank === 'B' ? 'ACTIVE' : 'LOCKED') || row.progress !== 0n || row.baselineValue !== 0n || row.carriedProgress !== 0n
          || row.completedAt !== null || row.rewardedAt !== null || row.legacyProvenance !== null || row.completionTriggerOperationId !== null || row.rewardOperationId !== null;
      })) return false;
    } else if (model.name === 'PlayerPreference') {
      if (rows.some(row => row.preferenceKey === 'tutorial_v1' ? !isTutorialPreference(row.value)
        : row.preferenceKey !== 'tutorial_v1_autostart' || JSON.stringify(row.value) !== JSON.stringify({ version: 1, claimed: true }))) return false;
    } else if (model.name === 'PlayerActivityState') {
      if (rows.length !== 1 || rows[0]!.lastInternalChatAt !== null || rows[0]!.lastTwitchActivityAt !== null || rows[0]!.lastGameplayActivityAt !== null) return false;
    } else return false;
  }
  return true;
}

export async function moveDisposableWebIdentity(tx: Prisma.TransactionClient, webIdentityId: string, sourcePlayerId: string, targetPlayerId: string) {
  await tx.webIdentity.update({ where: { id: webIdentityId }, data: { playerId: targetPlayerId } });
  await tx.player.delete({ where: { id: sourcePlayerId } });
}

export class TwitchProfileClaim {
  constructor(private readonly db: PrismaClient) {}
  async execute(webIdentityId: string, expectedPlayerId: string, twitchUserId: string) {
    for (let retry = 0; ; retry++) {
      try {
        return await this.db.$transaction(async tx => {
          const target = await tx.twitchIdentity.findUnique({ where: { twitchUserId } });
          if (!target) throw new AppError('Aucun profil Twitch existant à récupérer.', 404, 'TWITCH_PROFILE_NOT_FOUND');
          const ids = [...new Set([expectedPlayerId, target.playerId])].sort();
          await tx.$queryRaw(Prisma.sql`SELECT id FROM players WHERE id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
          const web = await tx.webIdentity.findUnique({ where: { id: webIdentityId } });
          const current = await tx.twitchIdentity.findUnique({ where: { twitchUserId }, include: { player: true } });
          if (!web || web.playerId !== expectedPlayerId && web.playerId !== target.playerId || !current || current.playerId !== target.playerId || current.player.status !== 'ACTIVE')
            throw new AppError('Identité modifiée : recommencez la récupération.', 409, 'TWITCH_PROFILE_CHANGED');
          if (web.playerId === current.playerId) return { claimed: true, playerId: current.playerId };
          if (await tx.webIdentity.findUnique({ where: { playerId: current.playerId } }))
            throw new AppError('Ce profil Twitch possède déjà une identité web. Résolution opérateur nécessaire.', 409, 'TWITCH_PROFILE_WEB_CONFLICT');
          if (!await isDisposableWebPlayer(tx, web.playerId))
            throw new AppError('Votre profil web contient des données ou une identité à préserver. Résolution opérateur nécessaire.', 409, 'TWITCH_PROFILE_NOT_DISPOSABLE');
          await moveDisposableWebIdentity(tx, web.id, web.playerId, current.playerId);
          return { claimed: true, playerId: current.playerId };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
      } catch (error) { if (retry < 4 && isPrismaConcurrencyCollision(error)) continue; throw error; }
    }
  }
}
