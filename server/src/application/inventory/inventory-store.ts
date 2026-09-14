import type { ElementKey, ResourceKey } from '../../domain/economy/resources.js';

export type InventorySection = 'objects' | 'collection';

export type InventoryResource = Readonly<{
  key: ResourceKey;
  displayName: string;
  category: string;
  elementKey: ElementKey | null;
  amount: bigint;
}>;

export type InventoryItem = Readonly<{
  id: string;
  externalKey: string;
  displayName: string;
  category: string;
  section: InventorySection;
  description: string | null;
  quantity: bigint;
  firstObtainedAt: Date | null;
  acquisitionHint: string | null;
  originFestival?: string | null;
  originMonth?: string | null;
  visualKey?: string | null;
}>;

export type ItemAcquisition = Readonly<{ id: string; quantity: bigint; sourceKey: string; provenance: unknown; acquiredAt: Date }>;
export type InventoryItemDetail = Readonly<{
  item: InventoryItem;
  history: readonly ItemAcquisition[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}>;

export type PlayerInventory = Readonly<{
  resources: readonly InventoryResource[];
  items: readonly InventoryItem[];
}>;

export interface InventoryStore {
  getInventory(playerId: string): Promise<PlayerInventory>;
  getItemDetail(playerId: string, itemId: string, page: number): Promise<InventoryItemDetail | null>;
}
