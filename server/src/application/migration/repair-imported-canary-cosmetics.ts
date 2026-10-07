import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { assertLegacyCosmeticsClassified, planDerivedPlayerCosmetics, rebuildDerivedPlayerCosmetics } from '../appearance/derived-player-cosmetics.js';
import { TwitchNativeAuthority, STREAMERBOT_PATH_DISABLED } from '../twitch/twitch-native-authority.js';
import { assessTwitchOperationsInFlight } from '../twitch/twitch-operations-in-flight.js';
import { captureTargetedPlayerRows, rowGraphHash } from './targeted-player-rows.js';

export type CosmeticRepairScope = { actorPlayerId: string; playerId: string; twitchUserId: string; backupHash: string; expectedRevision: number; acknowledgement: string };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function inspect(tx: Prisma.TransactionClient, config: AppConfig, scope: CosmeticRepairScope) {
  await new TwitchNativeAuthority(tx as PrismaClient, config).requireOperator(tx, scope.actorPlayerId);
  const control = await tx.twitchNativeAuthority.findUnique({ where: { id: 'twitch-commands' } });
  if (control?.desiredMode !== 'OFF' || control.revision !== scope.expectedRevision || scope.acknowledgement !== STREAMERBOT_PATH_DISABLED) throw new Error('COSMETIC_REPAIR_OFF_REVISION_ACK_REQUIRED');
  const targets = await tx.twitchNativeTarget.findMany({ orderBy: { twitchUserId: 'asc' } });
  if (targets.length !== 3 || targets.some(row => !row.canary || row.dataAuthority !== 'NATIVE' || !row.playerId || row.acknowledgement !== STREAMERBOT_PATH_DISABLED)) throw new Error('COSMETIC_REPAIR_THREE_IMPORTED_CANARIES_REQUIRED');
  for (const target of targets) {
    const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: target.twitchUserId }, include: { player: true } });
    const imported = await tx.twitchCanaryImport.findFirst({ where: { twitchUserId: target.twitchUserId, playerId: target.playerId!, status: 'DATA_IMPORTED', rolledBackAt: null }, orderBy: [{ importedAt: 'desc' }, { id: 'desc' }] });
    if (!identity || identity.playerId !== target.playerId || identity.player.status !== 'ACTIVE' || !imported) throw new Error('COSMETIC_REPAIR_IMPORT_IDENTITY_MISMATCH');
    const safety = await assessTwitchOperationsInFlight(tx, target.twitchUserId, target.playerId!);
    if (safety.blocked || safety.unresolvedOutbound) throw new Error('COSMETIC_REPAIR_OPERATIONS_IN_FLIGHT');
  }
  const target = targets.find(row => row.twitchUserId === scope.twitchUserId && row.playerId === scope.playerId);
  const imported = await tx.twitchCanaryImport.findFirst({ where: { twitchUserId: scope.twitchUserId, playerId: scope.playerId, status: 'DATA_IMPORTED', rolledBackAt: null }, orderBy: [{ importedAt: 'desc' }, { id: 'desc' }] });
  if (!target || imported?.backupHash !== scope.backupHash) throw new Error('COSMETIC_REPAIR_TARGET_PROVENANCE_MISMATCH');
  await assertLegacyCosmeticsClassified(tx, [scope.playerId]);
  const derived = await planDerivedPlayerCosmetics(tx, scope.playerId);
  if (derived.unexpected.length) throw new Error('COSMETIC_REPAIR_UNEXPECTED_POSSESSION');
  const graph = await captureTargetedPlayerRows(tx, [scope.playerId]);
  const notifications = await tx.$queryRaw<{ row: string }[]>`SELECT row_to_json(n)::text row FROM notifications n WHERE player_id=${scope.playerId}::uuid ORDER BY id`;
  const definitions = await tx.cosmeticDefinition.findMany({ where: { OR: [{ externalKey: { in: derived.expected } }, { sourceCharacterId: { in: derived.characters.map(row => row.characterId) } }] }, orderBy: { externalKey: 'asc' } });
  const evidence = { scope, control, targets, imported, derived, graph, notifications, definitions };
  return { ...evidence, planHash: hash(evidence), missingAvatars: derived.missing.filter(key => key.startsWith('character-avatar:')).length, missingTitles: derived.missing.filter(key => key.startsWith('title-level-')).length };
}
export type CosmeticRepairPlan = Awaited<ReturnType<typeof inspect>>;
/** Default operator entry is strictly read-only, including no audit or definitions. */
export async function planImportedCanaryCosmeticRepair(db: PrismaClient, config: AppConfig, scope: CosmeticRepairScope) {
  return db.$transaction(async tx => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; return inspect(tx, config, scope); }, { isolationLevel: 'RepeatableRead', timeout: 60_000 });
}
/** One immutable imported Player, no resource/history synthesis and no authority mutation. */
export async function applyImportedCanaryCosmeticRepair(db: PrismaClient, config: AppConfig, scope: CosmeticRepairScope,
  confirmation: { planHash: string; avatars: number; titles: number }, writeBackup: (plan: CosmeticRepairPlan) => Promise<void>) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id='twitch-commands' FOR UPDATE`;
    await tx.$queryRaw`SELECT twitch_user_id FROM twitch_native_targets WHERE canary=true ORDER BY twitch_user_id FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM players WHERE id=${scope.playerId}::uuid FOR UPDATE`;
    const before = await inspect(tx, config, scope);
    if (confirmation.planHash !== before.planHash || confirmation.avatars !== before.missingAvatars || confirmation.titles !== before.missingTitles) throw new Error('COSMETIC_REPAIR_PLAN_CHANGED');
    if (!before.derived.missing.length) return { status: 'ALREADY_EXACT', avatars: 0, titles: 0 } as const;
    await writeBackup(before); // fsync durable ignored preimage before any write.
    const added = await rebuildDerivedPlayerCosmetics(tx, { playerId: scope.playerId, now: new Date(), source: 'IMPORTED_CANARY_COSMETIC_REPAIR',
      provenance: { mode: 'SILENT_BACKFILL', importId: before.imported!.id, snapshotHash: before.imported!.snapshotHash, backupHash: scope.backupHash, repairPlanHash: before.planHash } });
    if (added.avatars !== confirmation.avatars || added.titles !== confirmation.titles) throw new Error('COSMETIC_REPAIR_COUNTS_MISMATCH');
    const after = await inspect(tx, config, scope);
    const withoutCosmetics = (graph: typeof before.graph) => Object.fromEntries(Object.entries(graph.tables).filter(([table]) => table !== 'player_cosmetics'));
    if (rowGraphHash(withoutCosmetics(before.graph)) !== rowGraphHash(withoutCosmetics(after.graph)) || JSON.stringify(before.notifications) !== JSON.stringify(after.notifications)
      || JSON.stringify(before.targets) !== JSON.stringify(after.targets) || JSON.stringify(before.control) !== JSON.stringify(after.control)
      || JSON.stringify(before.imported) !== JSON.stringify(after.imported) || after.derived.missing.length || after.derived.unexpected.length
      || before.graph.tables.player_cosmetics!.some(row => !after.graph.tables.player_cosmetics!.includes(row))) throw new Error('COSMETIC_REPAIR_POSTIMAGE_MISMATCH');
    await tx.twitchNativeAudit.create({ data: { actorPlayerId: scope.actorPlayerId, twitchUserId: scope.twitchUserId, action: 'DERIVED_COSMETICS_REPAIRED',
      revision: scope.expectedRevision, mode: 'OFF', acknowledgement: JSON.stringify({ planHash: before.planHash, importId: before.imported!.id, backupHash: scope.backupHash,
        preimageHash: before.graph.hash, postimageHash: after.graph.hash, ...added }) } });
    return { status: 'REPAIRED', ...added } as const;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 90_000 });
}
