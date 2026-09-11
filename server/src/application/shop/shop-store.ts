import type { ElementKey, ResourceKey } from '../../domain/economy/resources.js';

export type ShopQuantityMode = 'unit' | 'multiple';

export type ShopTicketReward = Readonly<{
  id: string;
  type: 'resource' | 'main_element_particles' | 'other_element_particles' | 'pity5';
  label: string;
  amount: bigint;
  weight: number;
  probabilityBasisPoints: number;
  resourceKey?: ResourceKey;
}>;

export type ShopCatalogItem = Readonly<{
  id: string;
  externalKey: string;
  displayName: string;
  description: string;
  visualKey: string;
  priceResourceKey: ResourceKey;
  priceAmount: bigint;
  effectType: 'daily_mission' | 'resource_bundle' | 'random_ticket';
  displayOrder: number;
  available: boolean;
  unavailableReason: string | null;
  quantityMode: ShopQuantityMode;
  rewardPerUnit: Readonly<{ resourceKey: ResourceKey; amount: bigint }> | null;
  ticketRewards: readonly ShopTicketReward[];
}>;

export type ShopEffectSnapshot =
  | Readonly<{ type: 'resource_bundle'; resourceKey: ResourceKey; amount: bigint }>
  | Readonly<{ type: 'ticket_resource'; rewardId: string; label: string; resourceKey: ResourceKey; amount: bigint }>
  | Readonly<{ type: 'ticket_main_element_particles'; rewardId: string; label: string; elementKey: ElementKey; resourceKey: ResourceKey; amount: bigint }>
  | Readonly<{ type: 'ticket_other_element_particles'; rewardId: string; label: string; elementKey: ElementKey; resourceKey: ResourceKey; amount: bigint }>
  | Readonly<{ type: 'ticket_pity5'; rewardId: string; label: string; requestedAmount: number; grantedAmount: number; pity5Before: number; pity5After: number }>;

export type ShopPurchase = Readonly<{
  id: string;
  itemId: string;
  externalKey: string;
  displayName: string;
  quantity: bigint;
  unitPrice: bigint;
  totalPrice: bigint;
  effect: ShopEffectSnapshot;
  operationId: string;
  purchasedAt: Date;
}>;

export type ShopPlayerSnapshot = Readonly<{
  resources: Readonly<Record<ResourceKey, bigint>>;
  gachaState: Readonly<{
    pity5: number; pity4: number; guaranteedFeatured5: boolean; captureProgress: number;
    fiftyFiftyLostStreak: number; selectedBannerCharacterId: string | null;
    totalPulls: bigint; totalFiveStars: bigint; totalFourStars: bigint;
    fiftyFiftyWon: bigint; fiftyFiftyLost: bigint; capturesTriggered: bigint;
  }>;
}>;

export type ShopView = ShopPlayerSnapshot & Readonly<{
  items: readonly ShopCatalogItem[];
  recentPurchases: readonly ShopPurchase[];
}>;

export type ShopPurchaseResult = ShopView & Readonly<{
  purchase: ShopPurchase;
  operation: Readonly<{ id: string; alreadyProcessed: boolean }>;
}>;

export type ShopHistoryPage = Readonly<{
  purchases: readonly ShopPurchase[];
  page: number;
  pageSize: 10;
  totalCount: number;
  totalPages: number;
}>;

export type ShopPurchaseInput = Readonly<{
  playerId: string;
  playerElementKey: ElementKey;
  itemId: string;
  quantity: bigint;
  idempotencyKey: string;
  occurredAt: Date;
}>;

export interface ShopStore {
  getView(playerId: string): Promise<ShopView>;
  getHistory(playerId: string, page: number): Promise<ShopHistoryPage>;
  purchase(input: ShopPurchaseInput): Promise<ShopPurchaseResult>;
}
