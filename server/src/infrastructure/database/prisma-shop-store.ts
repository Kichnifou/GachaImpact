import { OperationStatus, Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import { BusinessError } from '../../application/errors.js';
import type { ShopCatalogItem, ShopEffectSnapshot, ShopPlayerSnapshot, ShopPurchase, ShopPurchaseInput, ShopPurchaseResult, ShopStore, ShopTicketReward, ShopView } from '../../application/shop/shop-store.js';
import { elementKeys, isElementKey, isResourceKey, particleResourceKey, resourceKeys, type ElementKey, type ResourceKey } from '../../domain/economy/resources.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import { isPrismaConcurrencyCollision } from './prisma-concurrency.js';
import { PrismaEconomyService } from './prisma-economy-service.js';
import { PrismaGachaRewardService } from './prisma-gacha-reward-service.js';

const RECENT_PURCHASE_LIMIT = 5;
const MAX_ATTEMPTS = 4;
const itemInclude = { priceResource: { select: { key: true } } } satisfies Prisma.ShopItemDefinitionInclude;
const purchaseInclude = { shopItem: { select: { externalKey: true, displayName: true } } } satisfies Prisma.ShopPurchaseInclude;

export class PrismaShopStore implements ShopStore {
  public constructor(
    private readonly database: PrismaClient,
    private readonly random: RandomSource,
    private readonly economy = new PrismaEconomyService(),
    private readonly gachaRewards = new PrismaGachaRewardService(),
  ) {}

  public async getView(playerId: string): Promise<ShopView> {
    return readView(this.database, playerId);
  }

  public async purchase(input: ShopPurchaseInput): Promise<ShopPurchaseResult> {
    const operationKey = `shop.purchase:${input.playerId}:${input.idempotencyKey}`;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.database.$transaction(async (transaction) => {
          const players = await transaction.$queryRaw<{ elementKey: string | null }[]>`
            SELECT element_key AS "elementKey" FROM players WHERE id = ${input.playerId}::uuid FOR UPDATE
          `;
          const player = players[0];
          if (!player) throw new BusinessError('PLAYER_NOT_FOUND', 'Aucun joueur n’est lié à ce compte.');
          if (!player.elementKey || !isElementKey(player.elementKey) || player.elementKey !== input.playerElementKey) {
            throw new BusinessError('PLAYER_ELEMENT_REQUIRED', 'Un élément permanent est requis pour acheter cet article.');
          }

          const existing = await transaction.businessOperation.findFirst({ where: { sourceChannel: SourceChannel.UI, idempotencyKey: operationKey } });
          if (existing) return readExistingPurchase(transaction, input, existing);

          const itemRow = await transaction.shopItemDefinition.findFirst({ where: { id: input.itemId, isVisible: true }, include: itemInclude });
          if (!itemRow) throw new BusinessError('SHOP_ITEM_NOT_FOUND', 'Cet article Boutique est introuvable.');
          const item = toCatalogItem(itemRow);
          if (!item.available) throw new BusinessError('SHOP_ITEM_UNAVAILABLE', item.unavailableReason ?? 'Cet article est actuellement indisponible.');
          validateQuantity(item, input.quantity);
          if (item.priceResourceKey !== 'moras') throw new BusinessError('SHOP_CATALOG_INVALID', 'La monnaie de cet article Boutique n’est pas prise en charge.');

          const totalPrice = item.priceAmount * input.quantity;
          const wallet = await transaction.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: input.playerId, resourceKey: 'moras' } }, select: { amount: true } });
          if (wallet.amount < totalPrice) throw new BusinessError('SHOP_WALLET_INSUFFICIENT', 'Vous ne possédez pas assez de Moras dans votre portefeuille.');

          const operation = await transaction.businessOperation.create({ data: {
            playerId: input.playerId,
            operationType: 'shop.purchase',
            sourceChannel: SourceChannel.UI,
            idempotencyKey: operationKey,
            resultSummary: requestSummary(input),
          }, select: { id: true } });

          await this.economy.debit(transaction, {
            playerId: input.playerId, playerElementKey: input.playerElementKey, resourceKey: 'moras', amount: totalPrice,
            causeKey: `shop.purchase.${item.externalKey}`, domainKey: 'shop', operationId: operation.id, sourceChannel: SourceChannel.UI,
          });

          const effect = await this.applyEffect(transaction, input, item, operation.id);
          const purchase = await transaction.shopPurchase.create({ data: {
            playerId: input.playerId, shopItemId: item.id, quantity: input.quantity,
            unitPrice: item.priceAmount, totalPrice, effectSnapshot: effectToJson(effect),
            operationId: operation.id, purchasedAt: input.occurredAt,
          }, include: purchaseInclude });
          await transaction.businessOperation.update({ where: { id: operation.id }, data: {
            status: OperationStatus.COMPLETED,
            completedAt: input.occurredAt,
            resultSummary: { ...requestSummary(input), purchaseId: purchase.id },
          } });
          return { ...(await readView(transaction, input.playerId)), purchase: toPurchase(purchase), operation: { id: operation.id, alreadyProcessed: false } };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 });
      } catch (error) {
        if (!isPrismaConcurrencyCollision(error) || attempt === MAX_ATTEMPTS) throw error;
      }
    }
    throw new Error('Shop purchase exhausted all retry attempts.');
  }

  private async applyEffect(transaction: Prisma.TransactionClient, input: ShopPurchaseInput, item: ShopCatalogItem, operationId: string): Promise<ShopEffectSnapshot> {
    if (item.effectType === 'resource_bundle') {
      if (!item.rewardPerUnit) throw new BusinessError('SHOP_CATALOG_INVALID', 'La récompense de cet article Boutique est invalide.');
      const amount = item.rewardPerUnit.amount * input.quantity;
      await this.economy.credit(transaction, {
        playerId: input.playerId, playerElementKey: input.playerElementKey,
        resourceKey: item.rewardPerUnit.resourceKey, amount,
        causeKey: `shop.reward.${item.externalKey}`, domainKey: 'shop', operationId, sourceChannel: SourceChannel.UI,
      });
      return { type: 'resource_bundle', resourceKey: item.rewardPerUnit.resourceKey, amount };
    }
    if (item.effectType !== 'random_ticket' || item.ticketRewards.length === 0) {
      throw new BusinessError('SHOP_ITEM_UNAVAILABLE', item.unavailableReason ?? 'Cet article est actuellement indisponible.');
    }
    const reward = selectTicketReward(item.ticketRewards, this.random);
    if (reward.type === 'pity5') {
      const result = await this.gachaRewards.grantFiveStarPity(transaction, input.playerId, Number(reward.amount));
      return { type: 'ticket_pity5', rewardId: reward.id, label: reward.label, requestedAmount: Number(reward.amount), grantedAmount: result.granted, pity5Before: result.before, pity5After: result.after };
    }
    let elementKey: ElementKey | null = null;
    let resourceKey = reward.resourceKey;
    if (reward.type === 'main_element_particles') {
      elementKey = input.playerElementKey;
      resourceKey = particleResourceKey(elementKey);
    } else if (reward.type === 'other_element_particles') {
      const others = elementKeys.filter((element) => element !== input.playerElementKey);
      elementKey = others[this.random.nextInt(others.length)] ?? null;
      if (!elementKey) throw new BusinessError('SHOP_CATALOG_INVALID', 'La récompense de particules est invalide.');
      resourceKey = particleResourceKey(elementKey);
    }
    if (!resourceKey) throw new BusinessError('SHOP_CATALOG_INVALID', 'La ressource de récompense est invalide.');
    await this.economy.credit(transaction, {
      playerId: input.playerId, playerElementKey: input.playerElementKey, resourceKey, amount: reward.amount,
      causeKey: `shop.ticket.${reward.id}`, domainKey: 'shop', operationId, sourceChannel: SourceChannel.UI,
    });
    if (reward.type === 'main_element_particles') return { type: 'ticket_main_element_particles', rewardId: reward.id, label: reward.label, elementKey: elementKey!, resourceKey, amount: reward.amount };
    if (reward.type === 'other_element_particles') return { type: 'ticket_other_element_particles', rewardId: reward.id, label: reward.label, elementKey: elementKey!, resourceKey, amount: reward.amount };
    return { type: 'ticket_resource', rewardId: reward.id, label: reward.label, resourceKey, amount: reward.amount };
  }
}

function validateQuantity(item: ShopCatalogItem, quantity: bigint): void {
  if (quantity <= 0n || (item.quantityMode === 'unit' && quantity !== 1n)) {
    throw new BusinessError('SHOP_QUANTITY_INVALID', item.quantityMode === 'unit' ? 'Cet article s’achète uniquement à l’unité.' : 'La quantité doit être un entier strictement positif.');
  }
}

function selectTicketReward(rewards: readonly ShopTicketReward[], random: RandomSource): ShopTicketReward {
  const total = rewards.reduce((sum, reward) => sum + reward.weight, 0);
  let roll = random.nextInt(total);
  for (const reward of rewards) {
    if (roll < reward.weight) return reward;
    roll -= reward.weight;
  }
  throw new BusinessError('SHOP_CATALOG_INVALID', 'La table de récompenses Ticket est invalide.');
}

async function readExistingPurchase(transaction: Prisma.TransactionClient, input: ShopPurchaseInput, existing: { id: string; playerId: string | null; operationType: string; status: OperationStatus; resultSummary: Prisma.JsonValue }): Promise<ShopPurchaseResult> {
  assertMatchingRequest(existing, input);
  if (existing.status !== OperationStatus.COMPLETED) throw new BusinessError('SHOP_IDEMPOTENCY_CONFLICT', 'Cet achat Boutique est encore en cours.');
  const purchase = await transaction.shopPurchase.findUnique({ where: { operationId: existing.id }, include: purchaseInclude });
  if (!purchase) throw new BusinessError('SHOP_IDEMPOTENCY_CONFLICT', 'Le résultat de cet achat Boutique est indisponible.');
  return { ...(await readView(transaction, input.playerId)), purchase: toPurchase(purchase), operation: { id: existing.id, alreadyProcessed: true } };
}

function assertMatchingRequest(existing: { playerId: string | null; operationType: string; resultSummary: Prisma.JsonValue }, input: ShopPurchaseInput): void {
  const summary = jsonObject(existing.resultSummary);
  if (existing.playerId !== input.playerId || existing.operationType !== 'shop.purchase' || summary?.itemId !== input.itemId || summary?.quantity !== input.quantity.toString()) {
    throw new BusinessError('SHOP_IDEMPOTENCY_CONFLICT', 'Cette clé d’achat Boutique correspond à une autre demande.');
  }
}

function requestSummary(input: ShopPurchaseInput): Prisma.InputJsonObject {
  return { itemId: input.itemId, quantity: input.quantity.toString() };
}

async function readView(database: PrismaClient | Prisma.TransactionClient, playerId: string): Promise<ShopView> {
  const [items, purchases, snapshot] = await Promise.all([
    database.shopItemDefinition.findMany({ where: { isVisible: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }], include: itemInclude }),
    database.shopPurchase.findMany({ where: { playerId }, orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }], take: RECENT_PURCHASE_LIMIT, include: purchaseInclude }),
    readPlayerSnapshot(database, playerId),
  ]);
  return { ...snapshot, items: items.map(toCatalogItem), recentPurchases: purchases.map(toPurchase) };
}

async function readPlayerSnapshot(database: PrismaClient | Prisma.TransactionClient, playerId: string): Promise<ShopPlayerSnapshot> {
  const [balances, gachaState] = await Promise.all([
    database.playerResourceBalance.findMany({ where: { playerId }, select: { resourceKey: true, amount: true } }),
    database.playerGachaState.findUnique({ where: { playerId }, select: {
      pity5: true, pity4: true, guaranteedFeatured5: true, captureProgress: true, fiftyFiftyLostStreak: true,
      selectedBannerCharacterId: true, totalPulls: true, totalFiveStars: true, totalFourStars: true,
      fiftyFiftyWon: true, fiftyFiftyLost: true, capturesTriggered: true,
    } }),
  ]);
  if (!gachaState) throw new BusinessError('GACHA_BANNER_UNAVAILABLE', 'L’état Gacha du joueur est indisponible.');
  const values = new Map(balances.map(({ resourceKey, amount }) => [resourceKey, amount]));
  if (!resourceKeys.every((key) => values.has(key))) throw new BusinessError('RESOURCE_STATE_INCOMPLETE', 'L’état des ressources du joueur est incomplet.');
  return { resources: Object.fromEntries(resourceKeys.map((key) => [key, values.get(key)!])) as Record<ResourceKey, bigint>, gachaState };
}

function toCatalogItem(row: Prisma.ShopItemDefinitionGetPayload<{ include: typeof itemInclude }>): ShopCatalogItem {
  if (!isResourceKey(row.priceResourceKey)) throw new BusinessError('SHOP_CATALOG_INVALID', `La monnaie de ${row.externalKey} est invalide.`);
  const config = jsonObject(row.effectConfig);
  const limits = jsonObject(row.limitConfig);
  const quantityMode = (limits?.quantityMode ?? config?.quantityMode) === 'multiple' ? 'multiple' : 'unit';
  let rewardPerUnit: ShopCatalogItem['rewardPerUnit'] = null;
  let ticketRewards: readonly ShopTicketReward[] = [];
  if (row.effectType === 'resource_bundle') {
    if (!config || typeof config.resourceKey !== 'string' || !isResourceKey(config.resourceKey) || !isPositiveInteger(config.amountPerUnit)) throw new BusinessError('SHOP_CATALOG_INVALID', `La récompense de ${row.externalKey} est invalide.`);
    rewardPerUnit = { resourceKey: config.resourceKey, amount: BigInt(config.amountPerUnit) };
  } else if (row.effectType === 'random_ticket') {
    ticketRewards = parseTicketRewards(config, row.externalKey);
  }
  if (row.effectType !== 'daily_mission' && row.effectType !== 'resource_bundle' && row.effectType !== 'random_ticket') throw new BusinessError('SHOP_CATALOG_INVALID', `Le type d’effet de ${row.externalKey} est inconnu.`);
  return {
    id: row.id, externalKey: row.externalKey, displayName: row.displayName, description: row.description,
    visualKey: row.visualKey, priceResourceKey: row.priceResourceKey, priceAmount: row.priceAmount,
    effectType: row.effectType, displayOrder: row.displayOrder,
    available: row.isEnabled, unavailableReason: row.isEnabled ? null : row.unavailableReason,
    quantityMode, rewardPerUnit, ticketRewards,
  };
}

function parseTicketRewards(config: JsonRecord | null, externalKey: string): readonly ShopTicketReward[] {
  if (!config || !Array.isArray(config.rewards) || config.rewards.length === 0) throw new BusinessError('SHOP_CATALOG_INVALID', `La table Ticket de ${externalKey} est vide.`);
  const raw = config.rewards.map((value) => {
    const reward = jsonObject(value);
    if (!reward || typeof reward.id !== 'string' || typeof reward.type !== 'string' || typeof reward.label !== 'string' || !isPositiveInteger(reward.amount) || !isPositiveInteger(reward.weight)) throw new BusinessError('SHOP_CATALOG_INVALID', `Une récompense Ticket de ${externalKey} est invalide.`);
    if (!['resource', 'main_element_particles', 'other_element_particles', 'pity5'].includes(reward.type)) throw new BusinessError('SHOP_CATALOG_INVALID', `Un type Ticket de ${externalKey} est invalide.`);
    const resourceKey = typeof reward.resourceKey === 'string' && isResourceKey(reward.resourceKey) ? reward.resourceKey : undefined;
    if (reward.type === 'resource' && !resourceKey) throw new BusinessError('SHOP_CATALOG_INVALID', `Une ressource Ticket de ${externalKey} est invalide.`);
    return { id: reward.id, type: reward.type as ShopTicketReward['type'], label: reward.label, amount: BigInt(reward.amount), weight: reward.weight, resourceKey };
  });
  const total = raw.reduce((sum, reward) => sum + reward.weight, 0);
  return raw.map((reward) => ({ ...reward, probabilityBasisPoints: Math.floor(reward.weight * 10_000 / total) }));
}

function toPurchase(row: Prisma.ShopPurchaseGetPayload<{ include: typeof purchaseInclude }>): ShopPurchase {
  return {
    id: row.id, itemId: row.shopItemId, externalKey: row.shopItem.externalKey, displayName: row.shopItem.displayName,
    quantity: row.quantity, unitPrice: row.unitPrice, totalPrice: row.totalPrice,
    effect: jsonToEffect(row.effectSnapshot), operationId: row.operationId, purchasedAt: row.purchasedAt,
  };
}

function effectToJson(effect: ShopEffectSnapshot): Prisma.InputJsonObject {
  const entries = Object.entries(effect).map(([key, value]) => [key, typeof value === 'bigint' ? value.toString() : value]);
  return Object.fromEntries(entries) as Prisma.InputJsonObject;
}

function jsonToEffect(value: Prisma.JsonValue): ShopEffectSnapshot {
  const effect = jsonObject(value);
  if (!effect || typeof effect.type !== 'string') throw new BusinessError('SHOP_CATALOG_INVALID', 'Un résultat d’achat Boutique est invalide.');
  if (effect.type === 'resource_bundle' && isResourceValue(effect.resourceKey) && isBigIntString(effect.amount)) return { type: effect.type, resourceKey: effect.resourceKey, amount: BigInt(effect.amount) };
  if (effect.type === 'ticket_resource' && hasTicketBase(effect) && isResourceValue(effect.resourceKey) && isBigIntString(effect.amount)) return { type: effect.type, rewardId: effect.rewardId, label: effect.label, resourceKey: effect.resourceKey, amount: BigInt(effect.amount) };
  if ((effect.type === 'ticket_main_element_particles' || effect.type === 'ticket_other_element_particles') && hasTicketBase(effect) && isElementValue(effect.elementKey) && isResourceValue(effect.resourceKey) && isBigIntString(effect.amount)) return { type: effect.type, rewardId: effect.rewardId, label: effect.label, elementKey: effect.elementKey, resourceKey: effect.resourceKey, amount: BigInt(effect.amount) };
  if (effect.type === 'ticket_pity5' && hasTicketBase(effect) && [effect.requestedAmount, effect.grantedAmount, effect.pity5Before, effect.pity5After].every(isNonNegativeInteger)) return { type: effect.type, rewardId: effect.rewardId, label: effect.label, requestedAmount: effect.requestedAmount as number, grantedAmount: effect.grantedAmount as number, pity5Before: effect.pity5Before as number, pity5After: effect.pity5After as number };
  throw new BusinessError('SHOP_CATALOG_INVALID', 'Un résultat d’achat Boutique est invalide.');
}

type JsonRecord = Record<string, Prisma.JsonValue | undefined>;
function jsonObject(value: Prisma.JsonValue | null): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function hasTicketBase(value: JsonRecord): value is JsonRecord & { rewardId: string; label: string } { return typeof value.rewardId === 'string' && typeof value.label === 'string'; }
function isPositiveInteger(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0; }
function isNonNegativeInteger(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function isBigIntString(value: unknown): value is string { return typeof value === 'string' && /^\d+$/.test(value); }
function isElementValue(value: unknown): value is ElementKey { return typeof value === 'string' && isElementKey(value); }
function isResourceValue(value: unknown): value is ResourceKey { return typeof value === 'string' && isResourceKey(value); }
