import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { AppError } from '../../api/errors.js';
import { assessTwitchOperationsInFlight } from './twitch-operations-in-flight.js';

export const STREAMERBOT_PATH_DISABLED = 'STREAMERBOT_PATH_DISABLED';
export type NativeAuthorityMode = 'OFF' | 'CANARY' | 'GLOBAL';
export type NativeAuthorityState = { desiredMode: NativeAuthorityMode; revision: number; operatorPlayerId: string | null };
export interface NativeAuthorityStore {
  read(): Promise<NativeAuthorityState>;
  covers(twitchUserId: string): Promise<boolean>;
  hasPersistedCanary(): Promise<boolean>;
  resumePersistedCanary(actor: string, acknowledgement: string | undefined, expectedRevision: number): Promise<NativeAuthorityState>;
  configure(actor: string, mode: NativeAuthorityMode, ids: readonly string[], acknowledgement?: string, expectedRevision?: number): Promise<NativeAuthorityState>;
}
const key = 'twitch-commands';
const forbidden = () => new AppError('Autorité Twitch réservée à l’opérateur administrateur.', 403, 'TWITCH_COMMAND_PILOT_FORBIDDEN');

/** Desired authority is always read from PostgreSQL. Transport proof remains a separate, transient concern. */
export class TwitchNativeAuthority implements NativeAuthorityStore {
  constructor(private readonly db: PrismaClient, private readonly config: AppConfig) {}
  async read(): Promise<NativeAuthorityState> {
    const row = await this.db.twitchNativeAuthority.findUnique({ where: { id: key } });
    return { desiredMode: row?.desiredMode as NativeAuthorityMode ?? 'OFF', revision: row?.revision ?? 0, operatorPlayerId: row?.operatorPlayerId ?? null };
  }
  async hasPersistedCanary() {
    return await this.db.twitchNativeTarget.count({ where: { canary: true } }) > 0;
  }
  /** Resume the exact persisted set after OFF; this is not a data authority transfer. */
  async resumePersistedCanary(actor: string, acknowledgement: string | undefined, expectedRevision: number) {
    if (this.config.twitchCommandPilot?.enabled !== true)
      throw new AppError('Capacité du pilote de commandes inactive.', 409, 'TWITCH_COMMAND_PILOT_OFF');
    if (acknowledgement !== STREAMERBOT_PATH_DISABLED)
      throw new AppError('Confirmez la désactivation réelle des chemins Streamer.bot concernés.', 409, 'TWITCH_NATIVE_ACK_REQUIRED');
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
      throw new AppError('Révision d’autorité invalide.', 400, 'VALIDATION_ERROR');
    return this.db.$transaction(async tx => {
      await this.requireOperator(tx, actor);
      await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id = ${key} FOR UPDATE`;
      const control = await tx.twitchNativeAuthority.findUnique({ where: { id: key } });
      if (!control || control.revision !== expectedRevision)
        throw new AppError('Autorité modifiée : relisez son état.', 409, 'TWITCH_NATIVE_AUTHORITY_CHANGED');
      if (control.desiredMode !== 'OFF')
        throw new AppError('Désactivez le pilote avant de reprendre la canary.', 409, 'TWITCH_NATIVE_CANARY_RESUME_OFF_REQUIRED');
      await tx.$queryRaw`SELECT twitch_user_id FROM twitch_native_targets WHERE canary = true ORDER BY twitch_user_id FOR UPDATE`;
      const targets = await tx.twitchNativeTarget.findMany({ where: { canary: true }, orderBy: { twitchUserId: 'asc' } });
      const blocked = () => new AppError('Canary existante ou opérations en cours à contrôler.', 409, 'TWITCH_NATIVE_CANARY_RESUME_BLOCKED');
      if (!targets.length || targets.length > 100) throw blocked();
      for (const target of targets) {
        if (target.dataAuthority !== 'NATIVE' || target.acknowledgement !== STREAMERBOT_PATH_DISABLED || !target.transferredAt) throw blocked();
        if (target.playerId) await tx.$queryRaw`SELECT id FROM players WHERE id = ${target.playerId}::uuid FOR UPDATE`;
        const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: target.twitchUserId }, include: { player: true } });
        if (target.playerId ? identity?.playerId !== target.playerId || identity.player.status !== 'ACTIVE' : identity !== null) throw blocked();
        const operations = await assessTwitchOperationsInFlight(tx, target.twitchUserId, target.playerId ?? undefined);
        if (operations.blocked || operations.unresolvedOutbound) throw blocked();
      }
      const row = await tx.twitchNativeAuthority.update({ where: { id: key }, data: { desiredMode: 'CANARY', operatorPlayerId: actor,
        revision: { increment: 1 }, acknowledgement, acknowledgedAt: new Date() } });
      await tx.twitchNativeAudit.create({ data: { actorPlayerId: actor, action: 'DESIRED_AUTHORITY_CHANGED', mode: 'CANARY', revision: row.revision, acknowledgement } });
      return { desiredMode: row.desiredMode as NativeAuthorityMode, revision: row.revision, operatorPlayerId: row.operatorPlayerId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
  }
  async covers(twitchUserId: string) {
    if (this.config.twitchCommandPilot?.enabled !== true) return false;
    const state = await this.read();
    if (state.desiredMode === 'OFF' || state.desiredMode === 'GLOBAL' && this.config.twitchCommandPilot.globalEnabled !== true) return false;
    const target = await this.db.twitchNativeTarget.findUnique({ where: { twitchUserId } });
    if (target) {
      const identity = await this.db.twitchIdentity.findUnique({ where: { twitchUserId } });
      return target.dataAuthority === 'NATIVE' && target.acknowledgement === STREAMERBOT_PATH_DISABLED
        && (state.desiredMode === 'GLOBAL' || target.canary) && (!identity || target.playerId === identity.playerId);
    }
    // GLOBAL can provision a new identity, never silently take over an existing legacy Player.
    return state.desiredMode === 'GLOBAL' && !await this.db.twitchIdentity.findUnique({ where: { twitchUserId } });
  }
  async relinquishForRollback(actor: string, twitchUserId: string, backupHash: string) {
    return this.db.$transaction(async tx => {
      await this.requireOperator(tx, actor);
      await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id=${key} FOR UPDATE`;
      const control = await tx.twitchNativeAuthority.findUnique({ where: { id: key } });
      const target = await tx.twitchNativeTarget.findUnique({ where: { twitchUserId } });
      if (control?.desiredMode && control.desiredMode !== 'OFF' || !target?.playerId || target.dataAuthority === 'MIGRATION_PENDING')
        throw new AppError('Kill switch OFF et cible inactive requis avant rollback.', 409, 'TWITCH_NATIVE_ROLLBACK_OFF_REQUIRED');
      await tx.$queryRaw`SELECT id FROM players WHERE id=${target.playerId}::uuid FOR UPDATE`;
      const operations = await assessTwitchOperationsInFlight(tx, twitchUserId, target.playerId);
      if (operations.unresolvedOutbound)
        throw new AppError('Réponse Twitch incertaine : contrôle opérateur requis avant rollback.', 409, 'TWITCH_NATIVE_ROLLBACK_BLOCKED');
      if (!await tx.twitchCanaryImport.findFirst({ where: { twitchUserId, playerId: target.playerId, backupHash, status: 'DATA_IMPORTED' } })
        || operations.blocked)
        throw new AppError('Provenance ou opérations en cours à contrôler.', 409, 'TWITCH_NATIVE_ROLLBACK_BLOCKED');
      await tx.twitchNativeTarget.update({ where: { twitchUserId }, data: { dataAuthority: 'LEGACY', canary: false, acknowledgement: null, transferredAt: null } });
      if (control) await tx.twitchNativeAuthority.update({ where: { id: key }, data: { revision: { increment: 1 } } });
      await tx.twitchNativeAudit.create({ data: { actorPlayerId: actor, twitchUserId, action: 'ROLLBACK_AUTHORITY_RETURNED_TO_LEGACY' } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
  }
  async requireOperator(tx: Prisma.TransactionClient, playerId: string) {
    const player = await tx.player.findUnique({ where: { id: playerId }, select: { status: true,
      rolesGranted: { where: { revokedAt: null, role: 'ADMIN' }, select: { id: true } } } });
    const identity = await tx.twitchIdentity.findUnique({ where: { playerId } });
    if (player?.status !== 'ACTIVE' || !player.rolesGranted.length || !identity
      || !this.config.twitch?.pilotPlayerIds.includes(playerId) || this.config.twitch.pilotLogin !== 'kichnifou'
      || identity.login.toLowerCase() !== 'kichnifou') throw forbidden();
  }
  /** Local operator path: transfer one exact imported Player; never replace another canary. */
  async transferImportedCanary(actor: string, twitchUserId: string, expectedPlayerId: string, backupHash: string,
    acknowledgement: string, expectedRevision: number) {
    return this.configure(actor, 'CANARY', [twitchUserId], acknowledgement, expectedRevision, { expectedPlayerId, backupHash });
  }
  /** Local-only extension: preserve every existing native canary and transfer exactly one imported target. */
  async extendImportedCanary(actor: string, twitchUserId: string, expectedPlayerId: string, backupHash: string,
    acknowledgement: string, expectedRevision: number): Promise<NativeAuthorityState> {
    if (this.config.twitchCommandPilot?.enabled !== true)
      throw new AppError('Capacité du pilote de commandes inactive.', 409, 'TWITCH_COMMAND_PILOT_OFF');
    if (acknowledgement !== STREAMERBOT_PATH_DISABLED)
      throw new AppError('Confirmez la désactivation réelle des chemins Streamer.bot concernés.', 409, 'TWITCH_NATIVE_ACK_REQUIRED');
    if (!/^[1-9][0-9]{0,127}$/.test(twitchUserId) || !/^[a-f0-9]{64}$/.test(backupHash)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedPlayerId)
      || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || expectedRevision >= 2_147_483_647)
      throw new AppError('Paramètres d’extension invalides.', 400, 'VALIDATION_ERROR');
    return this.db.$transaction(async tx => {
      await this.requireOperator(tx, actor);
      await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id = ${key} FOR UPDATE`;
      const control = await tx.twitchNativeAuthority.findUnique({ where: { id: key } });
      if (!control || control.revision !== expectedRevision)
        throw new AppError('Autorité modifiée : relisez son état.', 409, 'TWITCH_NATIVE_AUTHORITY_CHANGED');
      if (control.desiredMode !== 'OFF')
        throw new AppError('Désactivez le pilote avant d’étendre la canary.', 409, 'TWITCH_NATIVE_CANARY_EXTENSION_OFF_REQUIRED');
      await tx.$queryRaw`SELECT twitch_user_id FROM twitch_native_targets
        WHERE canary = true OR twitch_user_id = ${twitchUserId} ORDER BY twitch_user_id FOR UPDATE`;
      const targets = await tx.twitchNativeTarget.findMany({ where: { OR: [{ canary: true }, { twitchUserId }] }, orderBy: { twitchUserId: 'asc' } });
      const existing = targets.filter(target => target.canary), added = targets.find(target => target.twitchUserId === twitchUserId);
      const blocked = () => new AppError('Cibles, imports ou opérations incompatibles : extension refusée.', 409, 'TWITCH_IMPORTED_CANARY_EXTENSION_BLOCKED');
      if (!existing.length || existing.length >= 100 || !added || added.canary || added.dataAuthority !== 'LEGACY'
        || added.playerId !== expectedPlayerId) throw blocked();
      const playerIds = [...new Set([actor, ...targets.flatMap(target => target.playerId ? [target.playerId] : [])])].sort();
      for (const playerId of playerIds) await tx.$queryRaw`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`;
      await this.requireOperator(tx, actor);
      for (const target of targets) {
        if (!target.playerId || target.canary && (target.dataAuthority !== 'NATIVE'
          || target.acknowledgement !== STREAMERBOT_PATH_DISABLED || !target.transferredAt)) throw blocked();
        await tx.$queryRaw`SELECT twitch_user_id FROM twitch_identities WHERE twitch_user_id = ${target.twitchUserId} FOR UPDATE`;
        const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: target.twitchUserId }, include: { player: true } });
        if (identity?.playerId !== target.playerId || identity.player.status !== 'ACTIVE') throw blocked();
        await tx.$queryRaw`SELECT id FROM twitch_canary_imports WHERE twitch_user_id = ${target.twitchUserId} FOR UPDATE`;
        const imported = await tx.twitchCanaryImport.findFirst({ where: { twitchUserId: target.twitchUserId }, orderBy: [{ importedAt: 'desc' }, { id: 'desc' }] });
        if (!imported || imported.status !== 'DATA_IMPORTED' || imported.rolledBackAt !== null || imported.playerId !== target.playerId
          || target.twitchUserId === twitchUserId && imported.backupHash !== backupHash) throw blocked();
        const operations = await assessTwitchOperationsInFlight(tx, target.twitchUserId, target.playerId);
        if (operations.blocked || operations.unresolvedOutbound) throw blocked();
        // A committed result still waiting to send is not idle, even when outbound is not yet uncertain.
        const receipts = await tx.twitchEventReceipt.findMany({ where: { twitchUserId: target.twitchUserId }, select: { payloadMinimal: true } });
        if (receipts.some(receipt => {
          const pilot = (receipt.payloadMinimal as Prisma.JsonObject | null)?.commandPilot as Prisma.JsonObject | undefined;
          return Array.isArray(pilot?.responses) && pilot.responses.some(response =>
            response !== null && typeof response === 'object' && !Array.isArray(response) && response.status === 'PENDING');
        })) throw blocked();
      }
      // No updateMany/re-import: existing targets (including updatedAt) and all imports stay byte-for-byte intact.
      await tx.twitchNativeTarget.update({ where: { twitchUserId }, data: { dataAuthority: 'NATIVE', canary: true,
        acknowledgement, transferredAt: new Date() } });
      await tx.twitchNativeAudit.create({ data: { actorPlayerId: actor, action: 'AUTHORITY_TRANSFERRED', twitchUserId, acknowledgement } });
      const row = await tx.twitchNativeAuthority.update({ where: { id: key }, data: { desiredMode: 'CANARY', revision: { increment: 1 },
        operatorPlayerId: actor, acknowledgement, acknowledgedAt: new Date() } });
      await tx.twitchNativeAudit.create({ data: { actorPlayerId: actor, action: 'DESIRED_AUTHORITY_CHANGED', mode: 'CANARY', revision: row.revision, acknowledgement } });
      return { desiredMode: 'CANARY', revision: row.revision, operatorPlayerId: row.operatorPlayerId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
  }
  async configure(actor: string, mode: NativeAuthorityMode, ids: readonly string[], acknowledgement?: string, expectedRevision?: number,
    importedTarget?: { expectedPlayerId: string; backupHash: string }) {
    if (!['OFF', 'CANARY', 'GLOBAL'].includes(mode) || new Set(ids).size !== ids.length || ids.length > 100
      || ids.some(id => !/^[1-9][0-9]{0,127}$/.test(id)) || mode !== 'CANARY' && ids.length)
      throw new AppError('Paramètres d’autorité invalides.', 400, 'VALIDATION_ERROR');
    if (mode !== 'OFF' && this.config.twitchCommandPilot?.enabled !== true)
      throw new AppError('Capacité du pilote de commandes inactive.', 409, 'TWITCH_COMMAND_PILOT_OFF');
    if (mode === 'GLOBAL' && this.config.twitchCommandPilot?.globalEnabled !== true)
      throw new AppError('Autorité globale indisponible avant le cutover final.', 409, 'TWITCH_NATIVE_GLOBAL_UNAVAILABLE');
    if (mode !== 'OFF' && (acknowledgement !== STREAMERBOT_PATH_DISABLED || mode === 'CANARY' && !ids.length))
      throw new AppError('Confirmez la désactivation réelle des chemins Streamer.bot concernés.', 409, 'TWITCH_NATIVE_ACK_REQUIRED');
    return this.db.$transaction(async tx => {
      await this.requireOperator(tx, actor);
      const before = importedTarget ? await tx.twitchNativeAuthority.findUnique({ where: { id: key } }) : null;
      await tx.twitchNativeAuthority.upsert({ where: { id: key }, create: { id: key }, update: {} });
      await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id = ${key} FOR UPDATE`;
      const previous = await tx.twitchNativeAuthority.findUniqueOrThrow({ where: { id: key } });
      if (expectedRevision !== undefined && previous.revision !== expectedRevision && !(expectedRevision === 0 && previous.revision === 1))
        throw new AppError('Autorité modifiée : relisez son état.', 409, 'TWITCH_NATIVE_AUTHORITY_CHANGED');
      if (importedTarget) {
        const twitchUserId = ids[0]!;
        const target = await tx.twitchNativeTarget.findUnique({ where: { twitchUserId } });
        const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId }, include: { player: true } });
        if (mode !== 'CANARY' || ids.length !== 1 || expectedRevision !== (before?.revision ?? 0)
          || previous.desiredMode !== 'OFF' || await tx.twitchNativeTarget.count({ where: { canary: true } })
          || !target || target.canary || target.dataAuthority !== 'LEGACY' || target.playerId !== importedTarget.expectedPlayerId
          || identity?.playerId !== importedTarget.expectedPlayerId || identity.player.status !== 'ACTIVE'
          || !await tx.twitchCanaryImport.findFirst({ where: { twitchUserId, playerId: importedTarget.expectedPlayerId,
            backupHash: importedTarget.backupHash, status: 'DATA_IMPORTED' } })
          || (await assessTwitchOperationsInFlight(tx, twitchUserId, importedTarget.expectedPlayerId)).blocked)
          throw new AppError('Cible importée ou autorité incompatible : transfert refusé.', 409, 'TWITCH_IMPORTED_CANARY_TRANSFER_BLOCKED');
      }
      if (mode === 'CANARY') {
        await tx.twitchNativeTarget.updateMany({ where: { canary: true }, data: { canary: false } });
        for (const twitchUserId of ids) {
          const target = await tx.twitchNativeTarget.findUnique({ where: { twitchUserId } });
          const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId }, include: { player: true } });
          if (target?.dataAuthority === 'MIGRATION_PENDING' || identity && target?.playerId && identity.playerId !== target.playerId)
            throw new AppError('Migration ou identité à contrôler.', 409, 'TWITCH_NATIVE_TARGET_CONFLICT');
          if (identity?.player.legacyUsername && !await tx.twitchCanaryImport.findFirst({ where: { twitchUserId, playerId: identity.playerId, status: 'DATA_IMPORTED' } }))
            throw new AppError('Import canary validé requis avant transfert.', 409, 'TWITCH_NATIVE_DATA_IMPORT_REQUIRED');
          await tx.twitchNativeTarget.upsert({ where: { twitchUserId }, create: { twitchUserId, playerId: identity?.playerId,
            canary: true, dataAuthority: 'NATIVE', acknowledgement, transferredAt: new Date() },
          update: { canary: true, dataAuthority: 'NATIVE', acknowledgement, transferredAt: target?.transferredAt ?? new Date(), ...(identity ? { playerId: identity.playerId } : {}) } });
          await tx.twitchNativeAudit.create({ data: { actorPlayerId: actor, action: 'AUTHORITY_TRANSFERRED', twitchUserId, acknowledgement } });
        }
      }
      const row = await tx.twitchNativeAuthority.update({ where: { id: key }, data: { desiredMode: mode, operatorPlayerId: actor,
        revision: { increment: 1 }, acknowledgement: mode === 'OFF' ? null : acknowledgement, acknowledgedAt: mode === 'OFF' ? null : new Date() } });
      await tx.twitchNativeAudit.create({ data: { actorPlayerId: actor, action: mode === 'OFF' ? 'KILL_SWITCH' : 'DESIRED_AUTHORITY_CHANGED', mode, revision: row.revision, acknowledgement } });
      return { desiredMode: row.desiredMode as NativeAuthorityMode, revision: row.revision, operatorPlayerId: row.operatorPlayerId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
  }
}
