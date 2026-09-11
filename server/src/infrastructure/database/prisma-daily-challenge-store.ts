import { DailyChallengeStatus, OperationStatus, Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import { BusinessError } from '../../application/errors.js';
import {
  DAILY_CHALLENGE_PURCHASE_COST,
  nextDailyChallengeSwitchCost,
  type DailyChallengeMutationResult,
  type DailyChallengeProgressor,
  type DailyChallengePurchaseInput,
  type DailyChallengeStore,
  type DailyChallengeSwitchInput,
  type DailyChallengeType,
  type DailyChallengeView,
  type ParticleConversionInput,
} from '../../application/daily-challenge/daily-challenge-store.js';
import { businessDateToDatabaseDate, databaseDateToBusinessDate } from '../../domain/time/business-date.js';
import { particleResourceKey, resourceKeys } from '../../domain/economy/resources.js';
import type { PlayerResourceBalances } from '../../application/player/player-resource-store.js';
import { PrismaEconomyService } from './prisma-economy-service.js';
import { isPrismaConcurrencyCollision } from './prisma-concurrency.js';

const MAX_ATTEMPTS = 4;
const definitionSelection = {
  id: true, externalKey: true, type: true, target: true, displayName: true, description: true,
  progressLabel: true, rewardPrimogems: true, weight: true,
} satisfies Prisma.DailyChallengeDefinitionSelect;

type Definition = Prisma.DailyChallengeDefinitionGetPayload<{ select: typeof definitionSelection }>;

export class PrismaDailyChallengeStore implements DailyChallengeStore, DailyChallengeProgressor {
  public constructor(private readonly database: PrismaClient, private readonly economy = new PrismaEconomyService()) {}

  public async getView(playerId: string, businessDate: string): Promise<DailyChallengeView> {
    await expirePrevious(this.database, playerId, businessDate);
    return readView(this.database, playerId, businessDate);
  }

  public async purchase(input: DailyChallengePurchaseInput): Promise<DailyChallengeMutationResult> {
    return this.mutate(input, 'daily-challenge.purchase', async (transaction, operationId) => {
      const current = await readCurrent(transaction, input.playerId, input.businessDate);
      if (current) throw new BusinessError('DAILY_CHALLENGE_ALREADY_ASSIGNED', 'Un Défi est déjà attribué pour aujourd’hui.');
      const definitions = await transaction.dailyChallengeDefinition.findMany({
        where: { isEnabled: true, isEligible: true }, select: definitionSelection, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      });
      const wallet = await readBalance(transaction, input.playerId, 'moras');
      if (wallet < DAILY_CHALLENGE_PURCHASE_COST) throw new BusinessError('DAILY_CHALLENGE_WALLET_INSUFFICIENT', 'Vous ne possédez pas assez de Moras pour acheter le Défi.');
      await this.economy.debit(transaction, {
        playerId: input.playerId, playerElementKey: input.playerElementKey, resourceKey: 'moras', amount: DAILY_CHALLENGE_PURCHASE_COST,
        causeKey: 'daily-challenge.purchase', domainKey: 'daily-challenge', operationId, sourceChannel: SourceChannel.UI,
      });
      const definition = selectDefinition(definitions, input.random);
      await transaction.playerDailyChallenge.create({ data: snapshotData(input, definition) });
      return { definitionExternalKey: definition.externalKey };
    });
  }

  public async switchChallenge(input: DailyChallengeSwitchInput): Promise<DailyChallengeMutationResult> {
    return this.mutate(input, 'daily-challenge.switch', async (transaction, operationId) => {
      const current = await lockCurrent(transaction, input.playerId, input.businessDate);
      if (!current) throw new BusinessError('DAILY_CHALLENGE_NOT_ASSIGNED', 'Aucun Défi actif n’est attribué aujourd’hui.');
      if (current.status !== DailyChallengeStatus.ACTIVE) throw new BusinessError('DAILY_CHALLENGE_SWITCH_UNAVAILABLE', 'Un Défi terminé ne peut pas être remplacé.');
      const definitions = await transaction.dailyChallengeDefinition.findMany({
        where: { isEnabled: true, isEligible: true, id: { not: current.definitionId } },
        select: definitionSelection, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      });
      if (definitions.length === 0) throw new BusinessError('DAILY_CHALLENGE_SWITCH_UNAVAILABLE', 'Aucun autre Défi n’est disponible aujourd’hui.');
      const cost = nextDailyChallengeSwitchCost(current.switchCount);
      const wallet = await readBalance(transaction, input.playerId, 'moras');
      if (wallet < cost) throw new BusinessError('DAILY_CHALLENGE_WALLET_INSUFFICIENT', 'Vous ne possédez pas assez de Moras pour remplacer le Défi.');
      await this.economy.debit(transaction, {
        playerId: input.playerId, playerElementKey: input.playerElementKey, resourceKey: 'moras', amount: cost,
        causeKey: 'daily-challenge.switch', domainKey: 'daily-challenge', operationId, sourceChannel: SourceChannel.UI,
      });
      const definition = selectDefinition(definitions, input.random);
      await transaction.playerDailyChallenge.update({ where: { id: current.id }, data: {
        definitionId: definition.id,
        definitionExternalKeySnapshot: definition.externalKey,
        typeSnapshot: definition.type,
        displayNameSnapshot: definition.displayName,
        descriptionSnapshot: definition.description,
        progressLabelSnapshot: definition.progressLabel,
        targetSnapshot: definition.target,
        rewardPrimogemsSnapshot: definition.rewardPrimogems,
        progress: 0n,
        switchCount: { increment: 1 },
        assignedAt: input.now,
      } });
      return { definitionExternalKey: definition.externalKey, switchCost: cost.toString() };
    });
  }

  public async convertParticles(input: ParticleConversionInput): Promise<DailyChallengeMutationResult> {
    return this.mutate(input, 'particles.convert', async (transaction, operationId) => {
      const resourceKey = particleResourceKey(input.playerElementKey);
      const stock = await readBalance(transaction, input.playerId, resourceKey);
      if (stock < input.amount) throw new BusinessError('PARTICLE_CONVERSION_INSUFFICIENT', 'Vous ne possédez pas assez de particules de votre élément.');
      await this.economy.debit(transaction, {
        playerId: input.playerId, playerElementKey: input.playerElementKey, resourceKey, amount: input.amount,
        causeKey: 'particles.convert.consume', domainKey: 'resources', operationId, sourceChannel: SourceChannel.UI,
      });
      await this.economy.credit(transaction, {
        playerId: input.playerId, playerElementKey: input.playerElementKey, resourceKey: 'primogems', amount: input.amount,
        causeKey: 'particles.convert.reward', domainKey: 'resources', operationId, sourceChannel: SourceChannel.UI,
      });
      await this.progress(transaction, {
        playerId: input.playerId, playerElementKey: input.playerElementKey, businessDate: input.businessDate,
        type: 'conversion', amount: input.amount, now: input.now, operationId, sourceChannel: SourceChannel.UI,
      });
      return { amount: input.amount.toString(), resourceKey };
    }, { amount: input.amount.toString() });
  }

  public async progress(transaction: Prisma.TransactionClient, input: Parameters<DailyChallengeProgressor['progress']>[1]): Promise<void> {
    if (input.amount <= 0n) return;
    const current = await lockCurrent(transaction, input.playerId, input.businessDate);
    if (!current || current.status !== DailyChallengeStatus.ACTIVE || current.typeSnapshot !== input.type) return;
    const progress = current.progress + input.amount >= current.targetSnapshot ? current.targetSnapshot : current.progress + input.amount;
    const completed = progress === current.targetSnapshot;
    await transaction.playerDailyChallenge.update({ where: { id: current.id }, data: {
      progress,
      status: completed ? DailyChallengeStatus.COMPLETED : DailyChallengeStatus.ACTIVE,
      completedAt: completed ? input.now : null,
    } });
    if (completed) await this.economy.credit(transaction, {
      playerId: input.playerId, playerElementKey: input.playerElementKey, resourceKey: 'primogems', amount: current.rewardPrimogemsSnapshot,
      causeKey: 'daily-challenge.completion', domainKey: 'daily-challenge', operationId: input.operationId, sourceChannel: input.sourceChannel,
    });
  }

  private async mutate(
    input: DailyChallengePurchaseInput | DailyChallengeSwitchInput | ParticleConversionInput,
    operationType: string,
    action: (transaction: Prisma.TransactionClient, operationId: string) => Promise<Prisma.InputJsonObject>,
    request: Prisma.InputJsonObject = {},
  ): Promise<DailyChallengeMutationResult> {
    const operationKey = `${operationType}:${input.playerId}:${input.idempotencyKey}`;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.database.$transaction(async (transaction) => {
          await lockPlayer(transaction, input.playerId);
          await expirePrevious(transaction, input.playerId, input.businessDate);
          const existing = await transaction.businessOperation.findFirst({ where: { sourceChannel: SourceChannel.UI, idempotencyKey: operationKey } });
          if (existing) {
            assertExisting(existing, input.playerId, operationType, request);
            if (existing.status !== OperationStatus.COMPLETED) throw new BusinessError('DAILY_CHALLENGE_IDEMPOTENCY_CONFLICT', 'Cette opération est déjà en cours.');
            return { operation: { id: existing.id, alreadyProcessed: true }, view: await readView(transaction, input.playerId, input.businessDate), resources: await readBalances(transaction, input.playerId) };
          }
          const operation = await transaction.businessOperation.create({ data: {
            playerId: input.playerId, operationType, sourceChannel: SourceChannel.UI, idempotencyKey: operationKey,
            resultSummary: { ...request },
          }, select: { id: true } });
          const result = await action(transaction, operation.id);
          await transaction.businessOperation.update({ where: { id: operation.id }, data: {
            status: OperationStatus.COMPLETED, completedAt: input.now, resultSummary: { ...request, ...result },
          } });
          return { operation: { id: operation.id, alreadyProcessed: false }, view: await readView(transaction, input.playerId, input.businessDate), resources: await readBalances(transaction, input.playerId) };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 });
      } catch (error) {
        if (!isPrismaConcurrencyCollision(error) || attempt === MAX_ATTEMPTS) throw error;
      }
    }
    throw new Error(`${operationType} exhausted all retry attempts.`);
  }
}

function snapshotData(input: DailyChallengePurchaseInput, definition: Definition) {
  return {
    playerId: input.playerId,
    businessDate: businessDateToDatabaseDate(input.businessDate),
    definitionId: definition.id,
    definitionExternalKeySnapshot: definition.externalKey,
    typeSnapshot: definition.type,
    displayNameSnapshot: definition.displayName,
    descriptionSnapshot: definition.description,
    progressLabelSnapshot: definition.progressLabel,
    targetSnapshot: definition.target,
    rewardPrimogemsSnapshot: definition.rewardPrimogems,
    assignedAt: input.now,
  };
}

function selectDefinition(definitions: readonly Definition[], random: DailyChallengePurchaseInput['random']): Definition {
  if (definitions.length === 0) throw new BusinessError('DAILY_CHALLENGE_POOL_UNAVAILABLE', 'Aucun Défi n’est disponible aujourd’hui.');
  const totalWeight = definitions.reduce((sum, definition) => sum + definition.weight, 0);
  if (!Number.isSafeInteger(totalWeight) || totalWeight <= 0) throw new Error('The daily challenge pool has an invalid total weight.');
  let roll = random.nextInt(totalWeight);
  for (const definition of definitions) {
    if (roll < definition.weight) return definition;
    roll -= definition.weight;
  }
  throw new Error('The daily challenge pool selection failed.');
}

async function lockPlayer(transaction: Prisma.TransactionClient, playerId: string): Promise<void> {
  const rows = await transaction.$queryRaw<{ id: string }[]>`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`;
  if (!rows[0]) throw new BusinessError('PLAYER_NOT_FOUND', 'Aucun joueur n’est lié à ce compte.');
}

async function expirePrevious(client: PrismaClient | Prisma.TransactionClient, playerId: string, businessDate: string): Promise<void> {
  await client.playerDailyChallenge.updateMany({ where: {
    playerId, status: DailyChallengeStatus.ACTIVE, businessDate: { lt: businessDateToDatabaseDate(businessDate) },
  }, data: { status: DailyChallengeStatus.EXPIRED } });
}

async function lockCurrent(transaction: Prisma.TransactionClient, playerId: string, businessDate: string) {
  const date = businessDateToDatabaseDate(businessDate);
  await transaction.$queryRaw`SELECT id FROM player_daily_challenges WHERE player_id = ${playerId}::uuid AND business_date = ${date}::date FOR UPDATE`;
  return readCurrent(transaction, playerId, businessDate);
}

function readCurrent(client: PrismaClient | Prisma.TransactionClient, playerId: string, businessDate: string) {
  return client.playerDailyChallenge.findUnique({ where: { playerId_businessDate: { playerId, businessDate: businessDateToDatabaseDate(businessDate) } } });
}

async function readView(client: PrismaClient | Prisma.TransactionClient, playerId: string, businessDate: string): Promise<DailyChallengeView> {
  const row = await readCurrent(client, playerId, businessDate);
  if (!row) return { businessDate, status: 'AVAILABLE', assigned: false, purchaseCost: DAILY_CHALLENGE_PURCHASE_COST, challenge: null, switchCount: 0, nextSwitchCost: null, canSwitch: false, completedAt: null };
  const type = dailyChallengeType(row.typeSnapshot);
  const completed = row.status === DailyChallengeStatus.COMPLETED;
  return {
    businessDate: databaseDateToBusinessDate(row.businessDate), status: completed ? 'COMPLETED' : 'ACTIVE', assigned: true,
    purchaseCost: DAILY_CHALLENGE_PURCHASE_COST,
    challenge: {
      externalKey: row.definitionExternalKeySnapshot, type, displayName: row.displayNameSnapshot,
      description: row.descriptionSnapshot, progressLabel: row.progressLabelSnapshot,
      progress: row.progress, target: row.targetSnapshot, rewardPrimogems: row.rewardPrimogemsSnapshot,
    },
    switchCount: row.switchCount,
    nextSwitchCost: completed ? null : nextDailyChallengeSwitchCost(row.switchCount),
    canSwitch: row.status === DailyChallengeStatus.ACTIVE,
    completedAt: row.completedAt,
  };
}

function dailyChallengeType(value: string): DailyChallengeType {
  if (value === 'messages' || value === 'pulls' || value === 'conversion') return value;
  throw new Error(`Unsupported daily challenge type: ${value}`);
}

async function readBalance(client: Prisma.TransactionClient, playerId: string, resourceKey: string): Promise<bigint> {
  const row = await client.playerResourceBalance.findUnique({ where: { playerId_resourceKey: { playerId, resourceKey } }, select: { amount: true } });
  if (!row) throw new BusinessError('RESOURCE_STATE_INCOMPLETE', `La ressource ${resourceKey} est indisponible.`);
  return row.amount;
}

async function readBalances(client: Prisma.TransactionClient, playerId: string): Promise<PlayerResourceBalances> {
  const rows = await client.playerResourceBalance.findMany({ where: { playerId, resourceKey: { in: [...resourceKeys] } }, select: { resourceKey: true, amount: true } });
  const values = new Map(rows.map(({ resourceKey, amount }) => [resourceKey, amount]));
  if (!resourceKeys.every((key) => values.has(key))) throw new BusinessError('RESOURCE_STATE_INCOMPLETE', 'L’état des ressources du joueur est incomplet.');
  return Object.fromEntries(resourceKeys.map((key) => [key, values.get(key)!])) as PlayerResourceBalances;
}

function assertExisting(existing: { playerId: string | null; operationType: string; resultSummary: Prisma.JsonValue }, playerId: string, operationType: string, request: Prisma.InputJsonObject): void {
  const summary = existing.resultSummary && typeof existing.resultSummary === 'object' && !Array.isArray(existing.resultSummary) ? existing.resultSummary : null;
  const matches = Object.entries(request).every(([key, value]) => summary?.[key] === value);
  if (existing.playerId !== playerId || existing.operationType !== operationType || !matches) throw new BusinessError('DAILY_CHALLENGE_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence correspond à une autre demande.');
}
