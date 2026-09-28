import { Prisma, type PrismaClient, type SourceChannel } from '../../../generated/prisma/client.js';
import { FAVOR_DAILY_PRIMOGEMS, FAVOR_GRANT_DAYS, FAVOR_MAX_DAYS, FAVOR_TIER_PRIMOGEMS,
  extendFavorPeriod, projectFavorCalendar, type FavorTier } from '../../domain/favor/favor-calendar.js';
import { businessDateToDatabaseDate, databaseDateToBusinessDate, getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import { PrismaEconomyService } from '../../infrastructure/database/prisma-economy-service.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { BusinessError } from '../errors.js';
import { isElementKey } from '../../domain/economy/resources.js';

export type FavorClaimSource = Extract<SourceChannel, 'UI' | 'INTERNAL_CHAT' | 'TWITCH'>;
/** Trusted internal adapter input. Proof verification/resolution belongs to the future transport. */
export type FavorGrantInput = {
  playerId: string;
  idempotencyKey: string;
  tier: FavorTier;
  twitchEventReceiptId?: string;
};
export type FavorGrantResult = {
  grantId: string; operationId: string; businessDate: string; tier: FavorTier;
  requestedDays: number; addedDays: number; blockedDays: number;
  immediatePrimogems: string; compensationPrimogems: string; creditedPrimogems: string;
  activeFromDate: string; activeUntilDate: string;
};
export type FavorClaimResult = {
  status: 'CLAIMED' | 'ALREADY_CLAIMED' | 'INACTIVE'; businessDate: string;
  creditedPrimogems: string; operationId: string | null;
};

/** Server-owned core only: no HTTP route, presence hook, scheduler or Twitch consumer. */
export class FavorService {
  constructor(private readonly database: PrismaClient, private readonly clock: Clock,
    private readonly economy = new PrismaEconomyService(() => clock.now())) {}

  async getCurrent(playerId: string) {
    return this.database.$transaction(async tx => {
      await this.requirePlayer(tx, playerId);
      const businessDate = getBusinessDate(this.clock.now());
      const state = await tx.playerFavorState.findUnique({ where: { playerId } });
      const claim = await tx.favorDailyClaim.findUnique({ where: { playerId_businessDate: {
        playerId, businessDate: businessDateToDatabaseDate(businessDate),
      } } });
      const calendar = projectFavorCalendar(state, businessDate);
      return { businessDate, ...calendar, maxDays: FAVOR_MAX_DAYS, dailyPrimogems: FAVOR_DAILY_PRIMOGEMS.toString(),
        claimedToday: !!claim, claimStatus: claim ? 'CLAIMED' as const : calendar.active ? 'AVAILABLE' as const : 'UNAVAILABLE' as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async grant(input: FavorGrantInput): Promise<FavorGrantResult> {
    if (!input.idempotencyKey.trim() || ![1, 2, 3].includes(input.tier)) {
      throw new BusinessError('FAVOR_PROOF_INVALID', 'La preuve d’attribution de Faveur est invalide.');
    }
    // Acquisition is Twitch-only; channel is fixed by the core, never supplied by a client.
    const key = `favor:grant:${input.idempotencyKey}`;
    return this.transaction(async tx => {
      await this.lockPlayer(tx, input.playerId);
      const operation = await tx.businessOperation.findFirst({ where: { sourceChannel: 'TWITCH', idempotencyKey: key } });
      if (operation) return this.replayGrant(operation, input);
      if (input.twitchEventReceiptId) {
        const grant = await tx.favorGrant.findUnique({ where: { twitchEventReceiptId: input.twitchEventReceiptId }, include: { operation: true } });
        if (grant) return this.replayGrant(grant.operation, input);
        if (!await tx.twitchEventReceipt.findUnique({ where: { id: input.twitchEventReceiptId }, select: { id: true } })) {
          throw new BusinessError('FAVOR_PROOF_INVALID', 'Le reçu d’attribution de Faveur est absent.');
        }
      }
      const player = await this.requirePlayer(tx, input.playerId);
      if (!player.elementKey) throw new BusinessError('PLAYER_ELEMENT_REQUIRED', 'Choisissez votre élément avant de recevoir une Faveur.');
      const now = this.clock.now(), businessDate = getBusinessDate(now);
      const state = await tx.playerFavorState.findUnique({ where: { playerId: input.playerId } });
      const period = extendFavorPeriod(state, businessDate);
      const immediatePrimogems = FAVOR_TIER_PRIMOGEMS[input.tier];
      const amount = immediatePrimogems + period.compensationPrimogems;
      const op = await tx.businessOperation.create({ data: {
        playerId: input.playerId, operationType: 'favor.grant', sourceChannel: 'TWITCH', idempotencyKey: key, startedAt: now,
      } });
      await tx.playerFavorState.upsert({ where: { playerId: input.playerId },
        create: { playerId: input.playerId, activeFromDate: period.activeFromDate, activeUntilDate: period.activeUntilDate, updatedAt: now },
        update: { activeFromDate: period.activeFromDate, activeUntilDate: period.activeUntilDate, updatedAt: now } });
      await this.economy.credit(tx, { playerId: input.playerId, playerElementKey: player.elementKey,
        resourceKey: 'primogems', amount, causeKey: 'favor.grant', domainKey: 'favor', operationId: op.id, sourceChannel: 'TWITCH',
        // A beneficiary receipt is passive, like a Social recipient credit: no standalone catch-up.
        skipPermanentMissions: true });
      const grant = await tx.favorGrant.create({ data: {
        playerId: input.playerId, twitchEventReceiptId: input.twitchEventReceiptId ?? null, subscriptionTier: String(input.tier),
        requestedDays: FAVOR_GRANT_DAYS, addedDays: period.addedDays, blockedDays: period.blockedDays,
        immediatePrimogems, compensationPrimogems: period.compensationPrimogems, operationId: op.id, grantedAt: now,
      } });
      const result: FavorGrantResult = { grantId: grant.id, operationId: op.id, businessDate, tier: input.tier,
        requestedDays: FAVOR_GRANT_DAYS, addedDays: period.addedDays, blockedDays: period.blockedDays,
        immediatePrimogems: immediatePrimogems.toString(), compensationPrimogems: period.compensationPrimogems.toString(),
        creditedPrimogems: amount.toString(), activeFromDate: databaseDateToBusinessDate(period.activeFromDate),
        activeUntilDate: databaseDateToBusinessDate(period.activeUntilDate) };
      await tx.businessOperation.update({ where: { id: op.id }, data: { status: 'COMPLETED', completedAt: now,
        resultSummary: { twitchEventReceiptId: input.twitchEventReceiptId ?? null, result } } });
      return result;
    });
  }

  async claimToday(playerId: string, sourceChannel: FavorClaimSource = 'UI'): Promise<FavorClaimResult> {
    if (!['UI', 'INTERNAL_CHAT', 'TWITCH'].includes(sourceChannel)) throw new RangeError('Invalid Faveur claim source.');
    return this.transaction(async tx => {
      await this.lockPlayer(tx, playerId);
      const player = await this.requirePlayer(tx, playerId);
      // Capture the server date after serialization; never accept a requested historical day.
      const now = this.clock.now(), businessDate = getBusinessDate(now);
      const day = businessDateToDatabaseDate(businessDate);
      const claim = await tx.favorDailyClaim.findUnique({ where: { playerId_businessDate: { playerId, businessDate: day } } });
      if (claim) return { status: 'ALREADY_CLAIMED', businessDate, creditedPrimogems: '0', operationId: claim.operationId };
      const state = await tx.playerFavorState.findUnique({ where: { playerId } });
      if (!projectFavorCalendar(state, businessDate).active) return { status: 'INACTIVE', businessDate, creditedPrimogems: '0', operationId: null };
      const operation = await tx.businessOperation.create({ data: { playerId, operationType: 'favor.daily-claim', sourceChannel,
        idempotencyKey: `favor:daily-claim:${playerId}:${businessDate}`, startedAt: now } });
      await tx.favorDailyClaim.create({ data: { playerId, businessDate: day, origin: 'NATIVE', sourceChannel,
        operationId: operation.id, claimedAt: now } });
      await this.economy.credit(tx, { playerId, playerElementKey: player.elementKey, resourceKey: 'primogems',
        amount: FAVOR_DAILY_PRIMOGEMS, causeKey: 'favor.daily-claim', domainKey: 'favor', operationId: operation.id, sourceChannel });
      const result: FavorClaimResult = { status: 'CLAIMED', businessDate, creditedPrimogems: FAVOR_DAILY_PRIMOGEMS.toString(), operationId: operation.id };
      await tx.businessOperation.update({ where: { id: operation.id }, data: { status: 'COMPLETED', completedAt: now, resultSummary: result } });
      return result;
    });
  }

  private replayGrant(operation: { playerId: string | null; operationType: string; status: string; resultSummary: Prisma.JsonValue | null }, input: FavorGrantInput): FavorGrantResult {
    const summary = operation.resultSummary as { twitchEventReceiptId?: string | null; result?: FavorGrantResult } | null;
    if (operation.playerId !== input.playerId || operation.operationType !== 'favor.grant' || operation.status !== 'COMPLETED'
      || !summary?.result || summary.result.tier !== input.tier || summary.twitchEventReceiptId !== (input.twitchEventReceiptId ?? null)) {
      throw new BusinessError('FAVOR_IDEMPOTENCY_CONFLICT', 'Cette preuve appartient à une autre attribution de Faveur.');
    }
    return summary.result;
  }

  private async requirePlayer(tx: Prisma.TransactionClient, playerId: string) {
    const player = await tx.player.findFirst({ where: { id: playerId, status: 'ACTIVE' }, select: { id: true, elementKey: true } });
    if (!player) throw new BusinessError('PLAYER_NOT_FOUND', 'Joueur introuvable.');
    return { ...player, elementKey: player.elementKey && isElementKey(player.elementKey) ? player.elementKey : null };
  }

  private async lockPlayer(tx: Prisma.TransactionClient, playerId: string) {
    await tx.$queryRaw`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`;
  }

  private async transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.database.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 30_000 }); }
      catch (error) { if (attempt < 5 && isPrismaConcurrencyCollision(error)) continue; throw error; }
    }
  }
}
