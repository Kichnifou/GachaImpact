import { GiftCodeStatus, GiftCodeType, NotificationState, OperationStatus, Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { isElementKey, isResourceKey, type ResourceKey } from '../../domain/economy/resources.js';
import { getBusinessDate, getBusinessDayStartAt, type Clock } from '../../domain/time/business-date.js';
import { PrismaEconomyService } from '../../infrastructure/database/prisma-economy-service.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';

export type GiftCodeRewardInput = Readonly<{ resourceKey: ResourceKey; amount: bigint }>;
export type GiftCodeDraftInput = Readonly<{
  token?: string;
  title: string;
  description: string;
  type: 'ONE_OFF' | 'ANNUAL';
  recurringMonth?: number;
  startsAt?: Date;
  endsAt?: Date;
  rewards: readonly GiftCodeRewardInput[];
  idempotencyKey: string;
}>;
export type GiftCodeUpdateInput = Readonly<{
  token?: string;
  title?: string;
  description?: string;
  type?: 'ONE_OFF' | 'ANNUAL';
  recurringMonth?: number;
  startsAt?: Date;
  endsAt?: Date;
  rewards?: readonly GiftCodeRewardInput[];
  disabled?: boolean;
  idempotencyKey: string;
}>;
export type GiftCodeAdminQuery = Readonly<{
  page: number;
  search?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'DISABLED';
  type?: 'ONE_OFF' | 'ANNUAL';
  availability?: 'CURRENT' | 'FUTURE' | 'OUTSIDE';
  sort: 'createdAt' | 'publishedAt' | 'title' | 'claims';
  direction: 'asc' | 'desc';
}>;
export type GiftCodeClaimantQuery = Readonly<{ page: number; search?: string; editionKey?: string }>;

type Database = PrismaClient | Prisma.TransactionClient;
type GiftCodeMaintenanceScope = Readonly<{
  annualCodeIds?: readonly string[];
  activePlayerIds?: readonly string[];
  testHooks?: Readonly<{
    afterReconciliationCodeLock?: () => Promise<void>;
    afterAdminCodeLock?: () => Promise<void>;
  }>;
}>;
const activeNotificationStates = [NotificationState.UNREAD, NotificationState.READ] as const;
const noExpiry = new Date('9999-12-31T23:59:59.999Z');

export class GiftCodeService {
  private readonly economy = new PrismaEconomyService();

  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly database: PrismaClient, private readonly clock: Clock, private readonly maintenanceScope: GiftCodeMaintenanceScope = {}) {}

  public async listForPlayer(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    const now = this.clock.now();
    await this.materializeAnnualEditions(this.database, now);
    await this.reconcileNotificationsForPlayer(player.id, now);
    return this.playerSnapshot(player.id, now);
  }

  public async claim(identity: AuthenticatedIdentity, editionId: string, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    const now = this.clock.now();
    await this.materializeAnnualEditions(this.database, now);
    let alreadyProcessed = false;
    let operationId = '';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await this.database.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${player.id}::uuid FOR UPDATE`;
          const existingOperation = await tx.businessOperation.findFirst({ where: { sourceChannel: SourceChannel.UI, idempotencyKey } });
          if (existingOperation) {
            const request = readJsonRecord(existingOperation.resultSummary)?.request;
            if (existingOperation.playerId !== player.id || existingOperation.operationType !== 'gift-code.claim' || readJsonRecord(request)?.editionId !== editionId || existingOperation.status !== OperationStatus.COMPLETED) throw new BusinessError('GIFT_CODE_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence appartient à une autre opération.');
            return { operationId: existingOperation.id, alreadyProcessed: true };
          }
          await tx.$queryRaw`SELECT id FROM gift_codes WHERE id = (SELECT gift_code_id FROM gift_code_editions WHERE id = ${editionId}::uuid) FOR UPDATE`;
          const edition = await tx.giftCodeEdition.findUnique({
            where: { id: editionId },
            include: { giftCode: { include: { rewards: true } }, claims: { where: { playerId: player.id }, take: 1 } },
          });
          if (!edition) throw new BusinessError('GIFT_CODE_NOT_FOUND', 'Ce code cadeau n’existe pas.');
          if (!isEditionAvailable(edition.giftCode.status, edition.startsAt, edition.endsAt, now)) throw new BusinessError('GIFT_CODE_UNAVAILABLE', 'Ce code cadeau n’est pas disponible.');
          if (edition.claims.length > 0) {
            return { operationId: edition.claims[0]!.operationId, alreadyProcessed: true };
          }
          const playerElementKey = player.elementKey && isElementKey(player.elementKey) ? player.elementKey : null;
          const operation = await tx.businessOperation.create({ data: { playerId: player.id, operationType: 'gift-code.claim', sourceChannel: SourceChannel.UI, idempotencyKey, status: OperationStatus.PENDING, resultSummary: { request: { editionId } } } });
          await tx.giftCodeClaim.create({ data: { giftCodeEditionId: edition.id, playerId: player.id, sourceChannel: SourceChannel.UI, operationId: operation.id, claimedAt: now } });
          for (const reward of edition.giftCode.rewards) {
            if (reward.amount <= 0n || !isResourceKey(reward.resourceKey)) continue;
            await this.economy.credit(tx, { playerId: player.id, playerElementKey, resourceKey: reward.resourceKey, amount: reward.amount, causeKey: `gift-code.${edition.giftCode.token}`, domainKey: 'gift-codes', operationId: operation.id, sourceChannel: SourceChannel.UI });
          }
          await tx.notification.updateMany({ where: { playerId: player.id, actionKey: 'OPEN_GIFT_CODE', actionTargetId: edition.id, state: { in: [...activeNotificationStates] } }, data: { state: NotificationState.RESOLVED, resolvedAt: now } });
          await tx.businessOperation.update({ where: { id: operation.id }, data: { status: OperationStatus.COMPLETED, completedAt: now, resultSummary: { request: { editionId }, claimed: true } } });
          return { operationId: operation.id, alreadyProcessed: false };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        operationId = result.operationId;
        alreadyProcessed = result.alreadyProcessed;
        break;
      } catch (error) {
        if (attempt < 2 && isPrismaConcurrencyCollision(error)) continue;
        throw error;
      }
    }
    const [codes, resources] = await Promise.all([this.playerSnapshot(player.id, now), this.resources(player.id)]);
    return { ...codes, resources, operation: { id: operationId, alreadyProcessed } };
  }

  public async reconcileNotificationsForPlayer(playerId: string, now = this.clock.now(), materialize = true): Promise<void> {
    if (materialize) await this.materializeAnnualEditions(this.database, now);
    await this.database.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT gc.id
        FROM gift_codes gc
        JOIN gift_code_editions gce ON gce.gift_code_id = gc.id
        WHERE gc.status = 'PUBLISHED' AND gce.starts_at <= ${now} AND gce.ends_at > ${now}
        FOR SHARE OF gc
      `;
      await this.maintenanceScope.testHooks?.afterReconciliationCodeLock?.();
      const editions = await tx.giftCodeEdition.findMany({
        where: { startsAt: { lte: now }, endsAt: { gt: now }, giftCode: { status: GiftCodeStatus.PUBLISHED }, claims: { none: { playerId } } },
        include: { giftCode: { include: { rewards: true } } },
      });
      const activeIds = editions.map(({ id }) => id);
      for (const edition of editions) {
        const rewards = edition.giftCode.rewards.map((reward) => ({ resourceKey: reward.resourceKey, amount: reward.amount.toString() }));
        const deduplicationKey = `gift-code:${playerId}:${edition.id}`;
        const existing = await tx.notification.findUnique({ where: { deduplicationKey }, select: { id: true, state: true } });
        const content = { payload: { title: edition.giftCode.title, token: edition.giftCode.token, rewards }, actionKey: 'OPEN_GIFT_CODE', actionTargetId: edition.id };
        if (existing) {
          await tx.notification.update({
            where: { id: existing.id },
            data: existing.state === NotificationState.RESOLVED
              ? { ...content, state: NotificationState.UNREAD, readAt: null, resolvedAt: null }
              : content,
          });
        } else {
          await tx.notification.create({ data: { playerId, domainKey: 'gift-codes', typeKey: 'GIFT_CODE_AVAILABLE', ...content, deduplicationKey } });
        }
      }
      await tx.notification.updateMany({
        where: { playerId, domainKey: 'gift-codes', state: { in: [...activeNotificationStates] }, ...(activeIds.length ? { actionTargetId: { notIn: activeIds } } : {}) },
        data: { state: NotificationState.RESOLVED, resolvedAt: now },
      });
    });
  }

  public async listAdmin(identity: AuthenticatedIdentity, query: GiftCodeAdminQuery = { page: 1, sort: 'createdAt', direction: 'desc' }) {
    const actor = await this.requireAdmin(identity);
    const now = this.clock.now();
    await this.materializeAnnualEditions(this.database, now);
    const pageSize = 20;
    const page = Math.max(1, query.page);
    const where = adminWhere(query, now);
    const order = adminOrder(query.sort, query.direction);
    const [rows, totals] = await Promise.all([
      this.database.$queryRaw<readonly { id: string }[]>`
        SELECT gc.id
        FROM gift_codes gc
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::bigint AS claim_count
          FROM gift_code_editions gce
          JOIN gift_code_claims gcc ON gcc.gift_code_edition_id = gce.id
          WHERE gce.gift_code_id = gc.id
        ) claim_stats ON TRUE
        ${where}
        ORDER BY ${order}, gc.id ${query.direction === 'asc' ? Prisma.raw('ASC') : Prisma.raw('DESC')}
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `,
      this.database.$queryRaw<readonly { total: bigint | number }[]>`
        SELECT COUNT(*)::bigint AS total
        FROM gift_codes gc
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::bigint AS claim_count
          FROM gift_code_editions gce
          JOIN gift_code_claims gcc ON gcc.gift_code_edition_id = gce.id
          WHERE gce.gift_code_id = gc.id
        ) claim_stats ON TRUE
        ${where}
      `,
    ]);
    const ids = rows.map(({ id }) => id);
    const loaded = ids.length ? await this.database.giftCode.findMany({ where: { id: { in: ids } }, include: adminCodeInclude }) : [];
    const byId = new Map(loaded.map((code) => [code.id, code]));
    const total = Number(totals[0]?.total ?? 0);
    return { actorPlayerId: actor.id, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), codes: ids.map((id) => serializeAdminCode(byId.get(id)!)) };
  }

  public async createDraft(identity: AuthenticatedIdentity, input: GiftCodeDraftInput) {
    const actor = await this.requireAdmin(identity);
    validateDraft(input);
    const token = normalizeToken(input.token || `CADEAU-${input.idempotencyKey.replace(/-/g, '').slice(0, 8)}`);
    const oneOffStartsAt = input.startsAt ?? this.clock.now();
    const oneOffEndsAt = input.endsAt ?? noExpiry;
    const codeId = await this.adminMutation(actor.id, 'create', input.idempotencyKey, { ...input, token, rewards: input.rewards.map(stringifyReward) }, async (tx, operationId) => {
      const code = await tx.giftCode.create({ data: { token, title: input.title.trim(), description: input.description.trim(), type: input.type, status: GiftCodeStatus.DRAFT, recurringMonth: input.type === 'ANNUAL' ? input.recurringMonth : null, startsAt: input.type === 'ONE_OFF' ? oneOffStartsAt : null, endsAt: input.type === 'ONE_OFF' ? oneOffEndsAt : null, createdById: actor.id, updatedById: actor.id, rewards: { create: input.rewards.filter(({ amount }) => amount > 0n).map((reward) => ({ resourceKey: reward.resourceKey, amount: reward.amount })) } } });
      return [{}, { codeId: code.id, token, status: code.status }, code.id, operationId];
    });
    return { code: await this.adminCodeById(codeId) };
  }

  public async publish(identity: AuthenticatedIdentity, codeId: string, idempotencyKey: string) {
    const actor = await this.requireAdmin(identity); const now = this.clock.now();
    const affectedCodeId = await this.adminMutation(actor.id, 'publish', idempotencyKey, { codeId }, async (tx, operationId) => {
      const before = await tx.giftCode.findUnique({ where: { id: codeId }, include: { rewards: true } });
      if (!before) throw new BusinessError('GIFT_CODE_NOT_FOUND', 'Ce code cadeau n’existe pas.');
      if (before.rewards.length === 0) throw invalidConfiguration();
      const after = await tx.giftCode.update({ where: { id: codeId }, data: { status: GiftCodeStatus.PUBLISHED, publishedAt: before.publishedAt ?? now, disabledAt: null, updatedById: actor.id } });
      if (after.type === GiftCodeType.ONE_OFF) await tx.giftCodeEdition.upsert({ where: { giftCodeId_editionKey: { giftCodeId: codeId, editionKey: 'once' } }, create: { giftCodeId: codeId, editionKey: 'once', startsAt: after.startsAt!, endsAt: after.endsAt! }, update: { startsAt: after.startsAt!, endsAt: after.endsAt! } });
      return [{ status: before.status }, { status: after.status }, codeId, operationId];
    });
    await this.materializeAnnualEditionForCode(this.database, affectedCodeId, now);
    return { code: await this.adminCodeById(affectedCodeId) };
  }

  public async update(identity: AuthenticatedIdentity, codeId: string, input: GiftCodeUpdateInput) {
    const actor = await this.requireAdmin(identity);
    const request = { codeId, ...input, rewards: input.rewards?.map(stringifyReward) };
    const affectedCodeId = await this.adminMutation(actor.id, input.disabled === true ? 'disable' : 'update', input.idempotencyKey, request, async (tx, operationId) => {
      await tx.$queryRaw`SELECT id FROM gift_codes WHERE id = ${codeId}::uuid FOR UPDATE`;
      await this.maintenanceScope.testHooks?.afterAdminCodeLock?.();
      const before = await tx.giftCode.findUnique({ where: { id: codeId }, include: { rewards: true, editions: { include: { _count: { select: { claims: true } } } } } });
      if (!before) throw new BusinessError('GIFT_CODE_NOT_FOUND', 'Ce code cadeau n’existe pas.');
      const hasClaims = before.editions.some((edition) => edition._count.claims > 0);
      const changesLockedIdentity = input.token !== undefined || input.type !== undefined || input.recurringMonth !== undefined || input.rewards !== undefined;
      if (hasClaims && changesLockedIdentity) throw new BusinessError('GIFT_CODE_LOCKED', 'L’identité, le type et les récompenses sont verrouillés après la première récupération.');
      if (input.rewards) validateRewards(input.rewards);
      const type = input.type ?? before.type;
      const recurringMonth = type === GiftCodeType.ANNUAL ? input.recurringMonth ?? (before.type === GiftCodeType.ANNUAL ? before.recurringMonth : null) : null;
      const startsAt = type === GiftCodeType.ONE_OFF ? input.startsAt ?? (before.type === GiftCodeType.ONE_OFF ? before.startsAt : this.clock.now()) : null;
      const endsAt = type === GiftCodeType.ONE_OFF ? input.endsAt ?? (before.type === GiftCodeType.ONE_OFF ? before.endsAt : noExpiry) : null;
      if (type === GiftCodeType.ANNUAL && (!Number.isInteger(recurringMonth) || recurringMonth! < 1 || recurringMonth! > 12)) throw invalidConfiguration();
      if (type === GiftCodeType.ONE_OFF && (!startsAt || !endsAt || endsAt <= startsAt)) throw invalidConfiguration();
      const rebuildEditions = !hasClaims && (
        (input.type !== undefined && input.type !== before.type)
        || (input.recurringMonth !== undefined && input.recurringMonth !== before.recurringMonth)
        || (input.startsAt !== undefined && input.startsAt.getTime() !== before.startsAt?.getTime())
        || (input.endsAt !== undefined && input.endsAt.getTime() !== before.endsAt?.getTime())
      );
      if (rebuildEditions) await tx.giftCodeEdition.deleteMany({ where: { giftCodeId: codeId } });
      const after = await tx.giftCode.update({
        where: { id: codeId },
        data: {
          token: input.token === undefined ? undefined : normalizeToken(input.token),
          title: input.title?.trim(), description: input.description?.trim(), type, recurringMonth, startsAt, endsAt,
          rewards: input.rewards ? { deleteMany: {}, create: input.rewards.filter(({ amount }) => amount > 0n).map((reward) => ({ resourceKey: reward.resourceKey, amount: reward.amount })) } : undefined,
          status: input.disabled === undefined ? undefined : input.disabled ? GiftCodeStatus.DISABLED : GiftCodeStatus.PUBLISHED,
          disabledAt: input.disabled === undefined ? undefined : input.disabled ? this.clock.now() : null,
          publishedAt: input.disabled === false ? before.publishedAt ?? this.clock.now() : undefined,
          updatedById: actor.id,
        },
        include: { rewards: true },
      });
      if (after.type === GiftCodeType.ONE_OFF && after.status === GiftCodeStatus.PUBLISHED) {
        await tx.giftCodeEdition.upsert({ where: { giftCodeId_editionKey: { giftCodeId: codeId, editionKey: 'once' } }, create: { giftCodeId: codeId, editionKey: 'once', startsAt: after.startsAt!, endsAt: after.endsAt! }, update: { startsAt: after.startsAt!, endsAt: after.endsAt! } });
      }
      if (input.disabled === true && before.editions.length > 0) {
        await tx.notification.updateMany({
          where: { domainKey: 'gift-codes', actionKey: 'OPEN_GIFT_CODE', actionTargetId: { in: before.editions.map(({ id }) => id) }, state: { in: [...activeNotificationStates] } },
          data: { state: NotificationState.RESOLVED, resolvedAt: this.clock.now() },
        });
      }
      const snapshot = (code: typeof before | typeof after) => ({ token: code.token, title: code.title, description: code.description, type: code.type, status: code.status, recurringMonth: code.recurringMonth, startsAt: code.startsAt?.toISOString() ?? null, endsAt: code.endsAt?.toISOString() ?? null, rewards: code.rewards.map(({ resourceKey, amount }) => ({ resourceKey, amount: amount.toString() })) });
      return [snapshot(before), snapshot(after), codeId, operationId];
    });
    await this.materializeAnnualEditionForCode(this.database, affectedCodeId, this.clock.now());
    return { code: await this.adminCodeById(affectedCodeId) };
  }

  public async claimants(identity: AuthenticatedIdentity, codeId: string, query: GiftCodeClaimantQuery = { page: 1 }) {
    await this.requireAdmin(identity);
    const code = await this.database.giftCode.findUnique({ where: { id: codeId }, select: { id: true, token: true, title: true } });
    if (!code) throw new BusinessError('GIFT_CODE_NOT_FOUND', 'Ce code cadeau n’existe pas.');
    const page = Math.max(1, query.page); const pageSize = 20;
    const where: Prisma.GiftCodeClaimWhereInput = { edition: { giftCodeId: codeId, ...(query.editionKey ? { editionKey: query.editionKey } : {}) }, ...(query.search?.trim() ? { player: { displayName: { contains: query.search.trim(), mode: 'insensitive' } } } : {}) };
    const [claims, total] = await Promise.all([
      this.database.giftCodeClaim.findMany({ where, include: { player: { select: { id: true, displayName: true } }, edition: { select: { editionKey: true } } }, orderBy: [{ claimedAt: 'desc' }, { giftCodeEditionId: 'asc' }, { playerId: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
      this.database.giftCodeClaim.count({ where }),
    ]);
    return { code, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), claimants: claims.map((claim) => ({ playerId: claim.player.id, displayName: claim.player.displayName, editionKey: claim.edition.editionKey, claimedAt: claim.claimedAt.toISOString() })) };
  }

  public async reconcileAllActivePlayers(now = this.clock.now()): Promise<void> {
    await this.materializeAnnualEditions(this.database, now);
    const players = await this.database.player.findMany({ where: { status: 'ACTIVE', ...(this.maintenanceScope.activePlayerIds ? { id: { in: [...this.maintenanceScope.activePlayerIds] } } : {}) }, select: { id: true } });
    for (let offset = 0; offset < players.length; offset += 10) {
      await Promise.all(players.slice(offset, offset + 10).map((player) => this.reconcileNotificationsForPlayer(player.id, now, false)));
    }
  }

  private async playerSnapshot(playerId: string, now: Date) {
    const editions = await this.database.giftCodeEdition.findMany({
      where: { OR: [{ giftCode: { status: GiftCodeStatus.PUBLISHED }, startsAt: { lte: now }, endsAt: { gt: now } }, { claims: { some: { playerId } } }] },
      include: { giftCode: { include: { rewards: { include: { resource: true }, orderBy: { resourceKey: 'asc' } } } }, claims: { where: { playerId }, take: 1 } },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
    });
    const entries = editions.map((edition) => serializePlayerCode(edition, now));
    return { available: entries.filter((entry) => !entry.claimed && entry.available), claimed: entries.filter((entry) => entry.claimed) };
  }

  private async resources(playerId: string) {
    const balances = await this.database.playerResourceBalance.findMany({ where: { playerId }, select: { resourceKey: true, amount: true } });
    const amounts = new Map(balances.map((balance) => [balance.resourceKey, balance.amount.toString()]));
    return { primogems: amounts.get('primogems') ?? '0', moras: amounts.get('moras') ?? '0', particles: Object.fromEntries(['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].map((key) => [key, amounts.get(`particles_${key}`) ?? '0'])) };
  }

  private async materializeAnnualEditions(database: Database, now: Date): Promise<void> {
    const [yearText, monthText] = getBusinessDate(now).split('-'); const year = Number(yearText); const month = Number(monthText);
    const codes = await database.giftCode.findMany({ where: { status: GiftCodeStatus.PUBLISHED, type: GiftCodeType.ANNUAL, recurringMonth: month, ...(this.maintenanceScope.annualCodeIds ? { id: { in: [...this.maintenanceScope.annualCodeIds] } } : {}) }, select: { id: true } });
    const startsAt = monthStart(year, month); const endsAt = month === 12 ? monthStart(year + 1, 1) : monthStart(year, month + 1);
    for (const code of codes) await database.giftCodeEdition.upsert({ where: { giftCodeId_editionKey: { giftCodeId: code.id, editionKey: String(year) } }, create: { giftCodeId: code.id, editionKey: String(year), year, startsAt, endsAt }, update: {} });
  }

  private async materializeAnnualEditionForCode(database: Database, codeId: string, now: Date): Promise<void> {
    const [yearText, monthText] = getBusinessDate(now).split('-'); const year = Number(yearText); const month = Number(monthText);
    const code = await database.giftCode.findFirst({ where: { id: codeId, status: GiftCodeStatus.PUBLISHED, type: GiftCodeType.ANNUAL, recurringMonth: month }, select: { id: true } });
    if (!code) return;
    const startsAt = monthStart(year, month); const endsAt = month === 12 ? monthStart(year + 1, 1) : monthStart(year, month + 1);
    await database.giftCodeEdition.upsert({ where: { giftCodeId_editionKey: { giftCodeId: code.id, editionKey: String(year) } }, create: { giftCodeId: code.id, editionKey: String(year), year, startsAt, endsAt }, update: {} });
  }

  private async adminCodeById(codeId: string) {
    const code = await this.database.giftCode.findUnique({ where: { id: codeId }, include: adminCodeInclude });
    if (!code) throw new BusinessError('GIFT_CODE_NOT_FOUND', 'Ce code cadeau n’existe pas.');
    return serializeAdminCode(code);
  }

  private async requireAdmin(identity: AuthenticatedIdentity) {
    const actor = await this.getPlayer.execute(identity);
    const admin = await this.database.playerRoleAssignment.findFirst({ where: { playerId: actor.id, role: 'ADMIN', revokedAt: null }, select: { id: true } });
    if (!admin) throw new BusinessError('GIFT_CODE_ADMIN_FORBIDDEN', 'Seuls les administrateurs peuvent gérer les codes cadeaux.');
    return actor;
  }

  private async adminMutation(actorPlayerId: string, action: string, idempotencyKey: string, request: unknown, change: (tx: Prisma.TransactionClient, operationId: string) => Promise<readonly [Prisma.InputJsonValue, Prisma.InputJsonValue, string, string]>): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.database.$transaction(async (tx) => {
      const existing = await tx.businessOperation.findFirst({ where: { sourceChannel: SourceChannel.ADMIN, idempotencyKey } });
      if (existing) {
        const summary = readJsonRecord(existing.resultSummary);
        if (existing.playerId !== actorPlayerId || existing.operationType !== `gift-code.admin.${action}` || jsonFingerprint(summary?.request) !== jsonFingerprint(jsonSafe(request)) || existing.status !== OperationStatus.COMPLETED) throw new BusinessError('GIFT_CODE_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence appartient à une autre opération.');
        const codeId = summary?.codeId;
        if (typeof codeId !== 'string') throw new BusinessError('GIFT_CODE_IDEMPOTENCY_CONFLICT', 'Le résultat de cette opération ne peut pas être relu.');
        return codeId;
      }
      const operation = await tx.businessOperation.create({ data: { playerId: actorPlayerId, operationType: `gift-code.admin.${action}`, sourceChannel: SourceChannel.ADMIN, idempotencyKey, status: OperationStatus.PENDING, resultSummary: { request: jsonSafe(request) } } });
      const [before, after, codeId] = await change(tx, operation.id);
      await tx.adminAuditEntry.create({ data: { actorPlayerId, targetPlayerId: actorPlayerId, action, domain: 'gift-codes', before, after, operationId: operation.id } });
      await tx.businessOperation.update({ where: { id: operation.id }, data: { status: OperationStatus.COMPLETED, completedAt: this.clock.now(), resultSummary: { request: jsonSafe(request), codeId } } });
      return codeId;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (attempt < 2 && isPrismaConcurrencyCollision(error)) continue;
        throw error;
      }
    }
    throw new Error('Gift code concurrency retry exhausted.');
  }
}

export class GiftCodeScheduler {
  private timer: NodeJS.Timeout | null = null;
  private stopped = true;
  public constructor(private readonly service: GiftCodeService, private readonly reportError: (error: unknown) => void = (error) => console.error('Gift code reconciliation failed.', error)) {}
  public async start() { this.stopped = false; await this.run(); }
  public stop() { this.stopped = true; if (this.timer) clearTimeout(this.timer); this.timer = null; }
  private async run() {
    try { await this.service.reconcileAllActivePlayers(); }
    catch (error) { this.reportError(error); }
    finally {
      if (!this.stopped) { this.timer = setTimeout(() => void this.run(), 60_000); this.timer.unref(); }
    }
  }
}

function monthStart(year: number, month: number) { return getBusinessDayStartAt(`${year}-${String(month).padStart(2, '0')}-01`); }
function isEditionAvailable(status: GiftCodeStatus, startsAt: Date, endsAt: Date, now: Date) { return status === GiftCodeStatus.PUBLISHED && startsAt <= now && endsAt > now; }
const adminCodeInclude = {
  rewards: { include: { resource: true }, orderBy: { resourceKey: 'asc' as const } },
  editions: { include: { _count: { select: { claims: true } } }, orderBy: { startsAt: 'desc' as const } },
} as const;

function adminWhere(query: GiftCodeAdminQuery, now: Date) {
  const clauses: Prisma.Sql[] = [];
  if (query.search?.trim()) {
    const search = query.search.trim();
    clauses.push(Prisma.sql`(POSITION(LOWER(${search}) IN LOWER(gc.title)) > 0 OR POSITION(LOWER(${search}) IN LOWER(gc.token)) > 0)`);
  }
  if (query.status) clauses.push(Prisma.sql`gc.status = CAST(${query.status} AS gift_code_status)`);
  if (query.type) clauses.push(Prisma.sql`gc.type = CAST(${query.type} AS gift_code_type)`);
  if (query.availability) {
    const month = Number(getBusinessDate(now).slice(5, 7));
    if (query.availability === 'CURRENT') clauses.push(Prisma.sql`gc.status = 'PUBLISHED' AND ((gc.type = 'ONE_OFF' AND gc.starts_at <= ${now} AND gc.ends_at > ${now}) OR (gc.type = 'ANNUAL' AND gc.recurring_month = ${month}))`);
    if (query.availability === 'FUTURE') clauses.push(Prisma.sql`gc.status = 'PUBLISHED' AND ((gc.type = 'ONE_OFF' AND gc.starts_at > ${now}) OR (gc.type = 'ANNUAL' AND gc.recurring_month > ${month}))`);
    if (query.availability === 'OUTSIDE') clauses.push(Prisma.sql`gc.status = 'PUBLISHED' AND ((gc.type = 'ONE_OFF' AND gc.ends_at <= ${now}) OR (gc.type = 'ANNUAL' AND gc.recurring_month < ${month}))`);
  }
  return clauses.length ? Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}` : Prisma.empty;
}

function adminOrder(sort: GiftCodeAdminQuery['sort'], direction: GiftCodeAdminQuery['direction']) {
  const order = direction === 'asc' ? Prisma.raw('ASC') : Prisma.raw('DESC');
  if (sort === 'publishedAt') return Prisma.sql`gc.published_at ${order} NULLS LAST`;
  if (sort === 'title') return Prisma.sql`LOWER(gc.title) ${order}`;
  if (sort === 'claims') return Prisma.sql`COALESCE(claim_stats.claim_count, 0) ${order}`;
  return Prisma.sql`gc.created_at ${order}`;
}
function serializePlayerCode(edition: Prisma.GiftCodeEditionGetPayload<{ include: { giftCode: { include: { rewards: { include: { resource: true } } } }; claims: true } }>, now: Date) {
  const claim = edition.claims[0];
  return { id: edition.giftCode.id, editionId: edition.id, token: edition.giftCode.token, title: edition.giftCode.title, description: edition.giftCode.description, type: edition.giftCode.type, editionKey: edition.editionKey, startsAt: edition.startsAt.toISOString(), endsAt: edition.endsAt.toISOString(), available: isEditionAvailable(edition.giftCode.status, edition.startsAt, edition.endsAt, now), claimed: Boolean(claim), claimedAt: claim?.claimedAt.toISOString() ?? null, rewards: edition.giftCode.rewards.map((reward) => ({ resourceKey: reward.resourceKey, displayName: reward.resource.displayName, amount: reward.amount.toString() })) };
}
function serializeAdminCode(code: Prisma.GiftCodeGetPayload<{ include: { rewards: { include: { resource: true } }; editions: { include: { _count: { select: { claims: true } } } } } }>) {
  const claimCount = code.editions.reduce((total, edition) => total + edition._count.claims, 0);
  return { id: code.id, token: code.token, title: code.title, description: code.description, type: code.type, status: code.status, recurringMonth: code.recurringMonth, startsAt: code.startsAt?.toISOString() ?? null, endsAt: code.endsAt?.toISOString() ?? null, createdAt: code.createdAt.toISOString(), publishedAt: code.publishedAt?.toISOString() ?? null, claimCount, locked: claimCount > 0, rewards: code.rewards.map((reward) => ({ resourceKey: reward.resourceKey, displayName: reward.resource.displayName, amount: reward.amount.toString() })), editions: code.editions.map((edition) => ({ id: edition.id, editionKey: edition.editionKey, startsAt: edition.startsAt.toISOString(), endsAt: edition.endsAt.toISOString(), claimCount: edition._count.claims })) };
}
function validateDraft(input: GiftCodeDraftInput) {
  if (!input.title.trim() || !input.description.trim()) throw invalidConfiguration();
  validateRewards(input.rewards);
  if (input.type === 'ANNUAL' && (!Number.isInteger(input.recurringMonth) || input.recurringMonth! < 1 || input.recurringMonth! > 12)) throw invalidConfiguration();
  if (input.type === 'ONE_OFF' && input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw invalidConfiguration();
}
function validateRewards(rewards: readonly GiftCodeRewardInput[]) {
  if (rewards.filter(({ amount }) => amount > 0n).length === 0 || rewards.some(({ amount, resourceKey }) => amount < 0n || !isResourceKey(resourceKey)) || new Set(rewards.map(({ resourceKey }) => resourceKey)).size !== rewards.length) throw invalidConfiguration();
}
function normalizeToken(value: string) { const token = value.trim().toUpperCase().replace(/\s+/g, '-'); if (!/^[A-Z0-9_-]{4,64}$/.test(token)) throw invalidConfiguration(); return token; }
function invalidConfiguration() { return new BusinessError('GIFT_CODE_INVALID_CONFIGURATION', 'La configuration du code cadeau est invalide.'); }
function stringifyReward(reward: GiftCodeRewardInput) { return { resourceKey: reward.resourceKey, amount: reward.amount.toString() }; }
function jsonSafe(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value, (_key, entry) => entry instanceof Date ? entry.toISOString() : typeof entry === 'bigint' ? entry.toString() : entry)) as Prisma.InputJsonValue; }
function readJsonRecord(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function jsonFingerprint(value: unknown): string { if (Array.isArray(value)) return `[${value.map(jsonFingerprint).join(',')}]`; if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${jsonFingerprint(entry)}`).join(',')}}`; return JSON.stringify(value); }
