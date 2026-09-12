import { NotificationState, OperationStatus, Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { EXPEDITION_DURATION_MS, selectExpeditionReward, type ExpeditionReward } from '../../domain/expedition/expedition.js';
import { isElementKey, resourceKeys } from '../../domain/economy/resources.js';
import { businessDateToDatabaseDate, databaseDateToBusinessDate, getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { PlayerResourceBalances } from '../player/player-resource-store.js';
import { PrismaEconomyService } from '../../infrastructure/database/prisma-economy-service.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';

const MAX_ATTEMPTS = 4;
const characterSelect = { id: true, externalKey: true, name: true, rarity: true, elementKey: true, weaponType: true, region: true, iconPath: true, splashPath: true, wishPath: true, fullbodyPath: true } as const;
type Client = PrismaClient | Prisma.TransactionClient;

export type ExpeditionView = Readonly<{
  businessDate: string;
  operationalStatus: 'IDLE' | 'RUNNING' | 'READY';
  departureUsedToday: boolean;
  canStartToday: boolean;
  activeCharacter: null | Readonly<{ id: string; externalKey: string; name: string; rarity: number; elementKey: string; weaponType: string | null; region: string | null; iconPath: string | null; splashPath: string | null; wishPath: string | null; fullbodyPath: string | null }>;
  departedAt: Date | null;
  readyAt: Date | null;
  remainingSeconds: number;
  startedOnCurrentBusinessDate: boolean;
  totalCompleted: bigint;
}>;

export type ExpeditionClaimResult = Readonly<{
  operation: Readonly<{ id: string; alreadyProcessed: boolean }>;
  reward: ExpeditionReward;
  view: ExpeditionView;
  resources: PlayerResourceBalances;
  missionEvent: Readonly<{ type: 'expedition.completed'; playerId: string; characterId: string; completedAt: Date }>;
}>;

export class ExpeditionService {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly database: PrismaClient, private readonly clock: Clock, private readonly random: RandomSource, private readonly economy = new PrismaEconomyService()) {}

  public async getState(identity: AuthenticatedIdentity): Promise<ExpeditionView> {
    const player = await this.getPlayer.execute(identity); const now = this.clock.now(); const businessDate = getBusinessDate(now);
    await this.reconcile(player.id, now);
    return readView(this.database, player.id, businessDate, now);
  }

  public async start(identity: AuthenticatedIdentity, characterId: string, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity); const now = this.clock.now(); const businessDate = getBusinessDate(now);
    const operationKey = `expedition.start:${player.id}:${idempotencyKey}`;
    const committed = await this.withRetry(async () => this.database.$transaction(async (transaction) => {
      await lockPlayer(transaction, player.id); await reconcileLocked(transaction, player.id, now);
      const existing = await transaction.businessOperation.findFirst({ where: { sourceChannel: SourceChannel.UI, idempotencyKey: operationKey } });
      if (existing) {
        const summary = objectSummary(existing.resultSummary);
        if (existing.playerId !== player.id || existing.operationType !== 'expedition.start' || summary.characterId !== characterId || existing.status !== OperationStatus.COMPLETED) throw new BusinessError('EXPEDITION_IDEMPOTENCY_CONFLICT', 'Cette tentative ne correspond plus à l’expédition attendue.');
        return { id: existing.id, alreadyProcessed: true };
      }
      const state = await transaction.playerExpedition.findUnique({ where: { playerId: player.id } });
      if (state && state.state !== 'IDLE') throw new BusinessError('EXPEDITION_ALREADY_ACTIVE', 'Une expédition est déjà en cours.');
      if (state?.departureBusinessDate && databaseDateToBusinessDate(state.departureBusinessDate) === businessDate) throw new BusinessError('EXPEDITION_DEPARTURE_ALREADY_USED', 'Vous avez déjà lancé une expédition aujourd’hui.');
      const possession = await transaction.playerCharacter.findUnique({ where: { playerId_characterId: { playerId: player.id, characterId } }, include: { character: { select: { isActive: true, name: true } } } });
      if (!possession) throw new BusinessError('EXPEDITION_CHARACTER_NOT_OWNED', 'Ce personnage ne fait pas partie de votre Box.');
      if (!possession.character.isActive) throw new BusinessError('EXPEDITION_CHARACTER_INACTIVE', 'Ce personnage n’est plus disponible.');
      const readyAt = new Date(now.getTime() + EXPEDITION_DURATION_MS);
      const operation = await transaction.businessOperation.create({ data: { playerId: player.id, operationType: 'expedition.start', sourceChannel: SourceChannel.UI, idempotencyKey: operationKey, status: OperationStatus.COMPLETED, completedAt: now, resultSummary: { characterId, characterName: possession.character.name, departedAt: now.toISOString(), readyAt: readyAt.toISOString(), businessDate } }, select: { id: true } });
      await transaction.playerExpedition.upsert({ where: { playerId: player.id }, create: { playerId: player.id, state: 'RUNNING', characterId, departedAt: now, readyAt, departureBusinessDate: businessDateToDatabaseDate(businessDate) }, update: { state: 'RUNNING', characterId, departedAt: now, readyAt, departureBusinessDate: businessDateToDatabaseDate(businessDate) } });
      return { id: operation.id, alreadyProcessed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 }));
    return { operation: committed, view: await readView(this.database, player.id, businessDate, now) };
  }

  public async claim(identity: AuthenticatedIdentity, idempotencyKey: string): Promise<ExpeditionClaimResult> {
    const player = await this.getPlayer.execute(identity); if (!player.elementKey || !isElementKey(player.elementKey)) throw new BusinessError('PLAYER_ELEMENT_REQUIRED', 'Un élément permanent est requis.');
    const playerElementKey = player.elementKey;
    const now = this.clock.now(); const businessDate = getBusinessDate(now); const operationKey = `expedition.claim:${player.id}:${idempotencyKey}`; let retainedRoll: number | null = null;
    const committed = await this.withRetry(async () => this.database.$transaction(async (transaction) => {
      await lockPlayer(transaction, player.id); await reconcileLocked(transaction, player.id, now);
      const existing = await transaction.businessOperation.findFirst({ where: { sourceChannel: SourceChannel.UI, idempotencyKey: operationKey } });
      if (existing) {
        const summary = objectSummary(existing.resultSummary); const roll = Number(summary.roll);
        if (existing.playerId !== player.id || existing.operationType !== 'expedition.claim' || existing.status !== OperationStatus.COMPLETED || !Number.isInteger(roll)) throw new BusinessError('EXPEDITION_IDEMPOTENCY_CONFLICT', 'Cette tentative ne correspond plus à la récupération attendue.');
        return { id: existing.id, alreadyProcessed: true, reward: selectExpeditionReward(roll, playerElementKey), characterId: String(summary.characterId), completedAt: new Date(String(summary.completedAt)) };
      }
      const state = await transaction.playerExpedition.findUnique({ where: { playerId: player.id }, include: { character: true } });
      if (!state || state.state === 'IDLE' || !state.characterId || !state.character) throw new BusinessError('EXPEDITION_NOT_ACTIVE', 'Aucune expédition n’est prête à être récupérée.');
      if (!state.readyAt || state.readyAt.getTime() > now.getTime()) throw new BusinessError('EXPEDITION_NOT_READY', 'Cette expédition n’est pas encore terminée.');
      const roll = retainedRoll ?? this.random.nextInt(10) + 1; retainedRoll = roll;
      const reward = selectExpeditionReward(roll, playerElementKey);
      const operation = await transaction.businessOperation.create({ data: { playerId: player.id, operationType: 'expedition.claim', sourceChannel: SourceChannel.UI, idempotencyKey: operationKey, resultSummary: { characterId: state.characterId, roll, rewardKind: reward.kind, resourceKey: reward.resourceKey, amount: reward.amount.toString(), completedAt: now.toISOString() } }, select: { id: true } });
      await this.economy.credit(transaction, { playerId: player.id, playerElementKey, resourceKey: reward.resourceKey, amount: reward.amount, causeKey: 'expedition.claim', domainKey: 'expedition', operationId: operation.id, sourceChannel: SourceChannel.UI });
      await transaction.playerExpedition.update({ where: { playerId: player.id }, data: { state: 'IDLE', characterId: null, departedAt: null, readyAt: null, lastCompletedAt: now, totalCompleted: { increment: 1n } } });
      await transaction.notification.updateMany({ where: { playerId: player.id, domainKey: 'expedition', typeKey: 'ready', state: { in: [NotificationState.UNREAD, NotificationState.READ] } }, data: { state: NotificationState.RESOLVED, resolvedAt: now } });
      await transaction.businessOperation.update({ where: { id: operation.id }, data: { status: OperationStatus.COMPLETED, completedAt: now } });
      return { id: operation.id, alreadyProcessed: false, reward, characterId: state.characterId, completedAt: now };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 }));
    return { operation: { id: committed.id, alreadyProcessed: committed.alreadyProcessed }, reward: committed.reward, view: await readView(this.database, player.id, businessDate, now), resources: await readBalances(this.database, player.id), missionEvent: { type: 'expedition.completed', playerId: player.id, characterId: committed.characterId, completedAt: committed.completedAt } };
  }

  public async cleanup(playerId: string): Promise<boolean> { return this.reconcile(playerId, this.clock.now()); }

  private async reconcile(playerId: string, now: Date): Promise<boolean> { return this.database.$transaction(async (transaction) => { await lockPlayer(transaction, playerId); return reconcileLocked(transaction, playerId, now); }); }
  private async withRetry<T>(run: () => Promise<T>): Promise<T> { for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) { try { return await run(); } catch (error) { if (!isPrismaConcurrencyCollision(error) || attempt === MAX_ATTEMPTS) throw error; } } throw new Error('Expedition transaction exhausted retries.'); }
}

async function reconcileLocked(transaction: Prisma.TransactionClient, playerId: string, now: Date): Promise<boolean> {
  const state = await transaction.playerExpedition.findUnique({ where: { playerId }, include: { character: { select: { isActive: true, name: true } } } });
  if (!state || state.state === 'IDLE') return false;
  if (!state.character?.isActive) {
    await transaction.playerExpedition.update({ where: { playerId }, data: { state: 'IDLE', characterId: null, departedAt: null, readyAt: null, departureBusinessDate: null } });
    await transaction.notification.updateMany({ where: { playerId, domainKey: 'expedition', typeKey: 'ready', state: { in: [NotificationState.UNREAD, NotificationState.READ] } }, data: { state: NotificationState.RESOLVED, resolvedAt: now } });
    return true;
  }
  if (state.state === 'RUNNING' && state.readyAt && state.readyAt <= now) {
    await transaction.playerExpedition.update({ where: { playerId }, data: { state: 'READY' } });
    await transaction.notification.upsert({ where: { deduplicationKey: `expedition-ready:${playerId}:${state.departedAt!.toISOString()}` }, create: { playerId, domainKey: 'expedition', typeKey: 'ready', payload: { characterName: state.character.name }, actionKey: 'open-expedition-character', actionTargetId: state.characterId, deduplicationKey: `expedition-ready:${playerId}:${state.departedAt!.toISOString()}` }, update: {} });
    return true;
  }
  return false;
}

async function readView(client: Client, playerId: string, businessDate: string, now: Date): Promise<ExpeditionView> {
  const state = await client.playerExpedition.findUnique({ where: { playerId }, include: { character: { select: characterSelect } } });
  const departureDate = state?.departureBusinessDate ? databaseDateToBusinessDate(state.departureBusinessDate) : null; const status = state?.state ?? 'IDLE';
  return { businessDate, operationalStatus: status, departureUsedToday: departureDate === businessDate, canStartToday: status === 'IDLE' && departureDate !== businessDate, activeCharacter: state?.character ?? null, departedAt: state?.departedAt ?? null, readyAt: state?.readyAt ?? null, remainingSeconds: status === 'RUNNING' && state?.readyAt ? Math.max(0, Math.ceil((state.readyAt.getTime() - now.getTime()) / 1_000)) : 0, startedOnCurrentBusinessDate: departureDate === businessDate, totalCompleted: state?.totalCompleted ?? 0n };
}
async function lockPlayer(transaction: Prisma.TransactionClient, playerId: string) { const rows = await transaction.$queryRaw<{ id: string }[]>`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`; if (!rows[0]) throw new BusinessError('PLAYER_NOT_FOUND', 'Aucun joueur n’est lié à ce compte.'); }
async function readBalances(client: Client, playerId: string): Promise<PlayerResourceBalances> { const rows = await client.playerResourceBalance.findMany({ where: { playerId, resourceKey: { in: [...resourceKeys] } }, select: { resourceKey: true, amount: true } }); const values = new Map(rows.map(row => [row.resourceKey, row.amount])); if (!resourceKeys.every(key => values.has(key))) throw new BusinessError('RESOURCE_STATE_INCOMPLETE', 'L’état des ressources du joueur est incomplet.'); return Object.fromEntries(resourceKeys.map(key => [key, values.get(key)!])) as PlayerResourceBalances; }
function objectSummary(value: Prisma.JsonValue | null): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
