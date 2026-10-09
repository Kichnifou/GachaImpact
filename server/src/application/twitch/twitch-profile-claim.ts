import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { isTutorialPreference } from '../tutorial/tutorial-preferences.js';
import { businessDateToDatabaseDate, getBusinessDate } from '../../domain/time/business-date.js';
import { z } from 'zod';

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
  twitch_link_states: 'TwitchLinkState', twitch_link_resolutions: 'TwitchLinkResolution',
  notifications: 'Notification',
  player_bank_accounts: 'PlayerBankAccount',
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

const availabilityPayload = z.object({ title: z.string().min(1), token: z.string().min(1), rewards: z.array(z.object({
  resourceKey: z.string().min(1), amount: z.string().regex(/^[1-9][0-9]*$/),
}).strict()) }).strict();
async function isUnclaimedAvailabilityNotice(tx: Prisma.TransactionClient, row: Row, playerId: string) {
  // Gift-code maintenance broadcasts an offer, not a gain, to every fresh Player.
  // Only the producer's exact edition/owner/template is accepted; all other notices
  // and any actual claim remain significant. Retain the notice in the source archive.
  if (row.domainKey !== 'gift-codes' || row.typeKey !== 'GIFT_CODE_AVAILABLE' || row.actionKey !== 'OPEN_GIFT_CODE'
    || typeof row.actionTargetId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.actionTargetId)
    || row.deduplicationKey !== `gift-code:${playerId}:${row.actionTargetId}`) return false;
  const parsed = availabilityPayload.safeParse(row.payload); if (!parsed.success) return false;
  const edition = await tx.giftCodeEdition.findUnique({ where: { id: row.actionTargetId }, include: { giftCode: { include: { rewards: true } } } });
  if (!edition || parsed.data.title !== edition.giftCode.title || parsed.data.token !== edition.giftCode.token
    || await tx.giftCodeClaim.findUnique({ where: { giftCodeEditionId_playerId: { giftCodeEditionId: edition.id, playerId } } })) return false;
  const canonical = (rewards: { resourceKey: string; amount: string }[]) => JSON.stringify(rewards.slice().sort((a,b) => a.resourceKey.localeCompare(b.resourceKey)));
  return canonical(parsed.data.rewards) === canonical(edition.giftCode.rewards.map(reward => ({ resourceKey: reward.resourceKey, amount: reward.amount.toString() })));
}

/** Every Player FK domain is inspected. New/unknown domains with rows fail closed.
 * Only the actual empty bootstrap and disposable UI/session bookkeeping are accepted. */
export async function isDisposableWebPlayer(tx: Prisma.TransactionClient, playerId: string): Promise<boolean> {
  const player = await tx.player.findUnique({ where: { id: playerId } });
  if (!player || player.status !== 'ACTIVE' || player.elementKey !== null || player.legacyUsername !== null
    || player.migrationRunId !== null || player.legacyRecovery !== null || player.equippedAvatarCosmeticId !== null || player.equippedTitleCosmeticId !== null) return false;
  const playerKeys = new Set(['id', 'displayName', 'elementKey', 'equippedAvatarCosmeticId', 'equippedTitleCosmeticId', 'status', 'createdAt', 'updatedAt', 'migrationRunId', 'legacyUsername', 'legacyRecovery']);
  const playerColumns = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint count FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='players'`;
  if (Object.keys(player).some(key => !playerKeys.has(key)) || playerColumns[0]!.count !== BigInt(playerKeys.size)) return false;
  const web = await tx.webIdentity.findUnique({ where: { playerId } });
  if (!web || web.state !== 'ACTIVE') return false;
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
    const technical = model.name === 'TwitchLinkState' || model.name === 'TwitchLinkResolution' || model.name === 'Notification';
    const rows = await delegate(tx, model.name).findMany({ where: model.name === 'TwitchLinkResolution'
      ? { OR: [{ webPlayerId: playerId }, { twitchPlayerId: playerId }] } : { playerId }, take: 1000 });
    if (rows.length >= 1000 || required.has(model.name) && !rows.length) return false;
    if (!rows.length) continue;
    const columns = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint count FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=${domain.table_name}`;
    if (columns[0]!.count !== BigInt(Object.keys(rows[0]!).length)) return false;
    if (technical) {
      const expectedColumns = model.name === 'TwitchLinkResolution' ? ['twitch_player_id', 'web_player_id'] : ['player_id'];
      if (domain.columns.slice().sort().join() !== expectedColumns.join()) return false;
      // No future child domain may inherit permission to cascade-delete OAuth proof.
      const dependents = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint count
        FROM pg_constraint fk JOIN pg_class parent ON parent.oid=fk.confrelid JOIN pg_namespace n ON n.oid=parent.relnamespace
        WHERE fk.contype='f' AND n.nspname=current_schema() AND parent.relname=${domain.table_name}`;
      if (dependents[0]!.count !== 0n) return false;
      for (const row of rows) {
        if (model.name === 'Notification') {
          if (!await isUnclaimedAvailabilityNotice(tx, row, playerId)) return false;
          continue;
        }
        if (row.webIdentityId !== web.id || !(row.expiresAt instanceof Date)) return false;
        if (model.name === 'TwitchLinkState') {
          if (row.playerId !== playerId || typeof row.stateHash !== 'string' || !/^[a-f0-9]{64}$/.test(row.stateHash)
            || typeof row.nonceHash !== 'string' || !/^[a-f0-9]{64}$/.test(row.nonceHash)) return false;
        } else {
          // Only this doorway's uncompleted comparisons are technical. A completed
          // decision, a Twitch-side reference or another owner protects the graph.
          if (row.webPlayerId !== playerId || row.twitchPlayerId === playerId || row.completedAt !== null || row.choice !== null
            || !(row.createdAt instanceof Date) || row.createdAt >= new Date() || row.expiresAt <= row.createdAt
            || typeof row.twitchUserId !== 'string' || !/^[0-9]+$/.test(row.twitchUserId)) return false;
          const target = await tx.twitchIdentity.findUnique({ where: { twitchUserId: row.twitchUserId } });
          if (!target || target.playerId !== row.twitchPlayerId) return false;
        }
      }
    } else if (model.name === 'PlayerBankAccount') {
      // Banking maintenance creates a zero account for every Player. No deposit,
      // withdrawal, interest, history, future cursor or unknown child is disposable.
      if (domain.columns.join() !== 'player_id' || rows.length !== 1 || rows[0]!.balance !== 0n
        || !(rows[0]!.lastInterestDate instanceof Date) || rows[0]!.lastInterestDate > businessDateToDatabaseDate(getBusinessDate(new Date()))
        || Object.keys(rows[0]!).some(key => !['playerId','balance','lastInterestDate','createdAt','updatedAt'].includes(key))
        || await tx.bankTransaction.count({ where: { playerId } })) return false;
      const children = await tx.$queryRaw<{ child: string; schema: string; child_columns: string[]; parent_columns: string[] }[]>`
        SELECT c.relname child,cn.nspname schema,
          ARRAY(SELECT a.attname::text FROM unnest(fk.conkey) k JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k)::text[] child_columns,
          ARRAY(SELECT a.attname::text FROM unnest(fk.confkey) k JOIN pg_attribute a ON a.attrelid=p.oid AND a.attnum=k)::text[] parent_columns
        FROM pg_constraint fk JOIN pg_class c ON c.oid=fk.conrelid JOIN pg_namespace cn ON cn.oid=c.relnamespace
        JOIN pg_class p ON p.oid=fk.confrelid JOIN pg_namespace pn ON pn.oid=p.relnamespace
        WHERE fk.contype='f' AND pn.nspname=current_schema() AND p.relname='player_bank_accounts'`;
      const schema = (await tx.$queryRaw<{ schema: string }[]>`SELECT current_schema() schema`)[0]!.schema;
      if (children.some(fk => fk.child !== 'bank_transactions' || fk.schema !== schema
        || fk.child_columns.join() !== 'player_id' || fk.parent_columns.join() !== 'player_id')) return false;
    } else if (housekeeping.has(model.name)) {
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
  // Caller holds the Players' locks and has verified the exact technical ownership.
  // Retain original comparison IDs, snapshots and restrictive FKs as historical
  // evidence; expiry cancels their authority without fabricating a player choice.
  const now = new Date();
  const comparisons = await tx.twitchLinkResolution.count({ where: { webIdentityId, webPlayerId: sourcePlayerId } });
  const notices = await tx.notification.count({ where: { playerId: sourcePlayerId } });
  await tx.twitchLinkResolution.updateMany({ where: { webIdentityId, webPlayerId: sourcePlayerId, completedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now } });
  await tx.twitchLinkState.deleteMany({ where: { playerId: sourcePlayerId, webIdentityId } });
  await tx.playerSession.deleteMany({ where: { playerId: sourcePlayerId } });
  await tx.webIdentity.update({ where: { id: webIdentityId }, data: { playerId: targetPlayerId } });
  if (notices && !comparisons) {
    const target = await tx.twitchIdentity.findUniqueOrThrow({ where: { playerId: targetPlayerId } });
    // Expired technical evidence, never a fabricated WEB/TWITCH consent. Also lets
    // the existing purge owner protect the archive and its informational notices.
    await tx.twitchLinkResolution.create({ data: { webIdentityId, webPlayerId: sourcePlayerId, twitchPlayerId: targetPlayerId,
      twitchUserId: target.twitchUserId, login: target.login, displayName: target.displayName,
      comparedState: { version: 1, kind: 'AUTOMATIC_RECOVERY' }, createdAt: now, expiresAt: new Date() } });
  }
  if (comparisons || notices) await tx.player.update({ where: { id: sourcePlayerId }, data: { status: 'ARCHIVED' } });
  else await tx.player.delete({ where: { id: sourcePlayerId } });
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
