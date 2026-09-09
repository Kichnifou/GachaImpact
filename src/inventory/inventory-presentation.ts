import type { InventoryItemDto, InventoryResourceDto, PlayerResourcesDto } from '../api/types'

export type InventoryCategory = 'all' | 'resources' | 'objects' | 'collection'
export type InventoryEntry =
  | Readonly<{ type: 'resource'; resource: InventoryResourceDto; amount: string }>
  | Readonly<{ type: 'item'; item: InventoryItemDto }>

export function presentInventory(
  inventoryResources: readonly InventoryResourceDto[],
  items: readonly InventoryItemDto[],
  wallet: PlayerResourcesDto,
  category: InventoryCategory,
  query: string,
): InventoryEntry[] {
  const resources: InventoryEntry[] = inventoryResources.map((resource) => ({ type: 'resource', resource, amount: walletAmount(wallet, resource.key) }))
  const objects: InventoryEntry[] = items.filter(({ section }) => section === 'objects').map((item) => ({ type: 'item', item }))
  const collection: InventoryEntry[] = items.filter(({ section }) => section === 'collection')
    .sort((left, right) => ownedRank(left) - ownedRank(right) || left.displayName.localeCompare(right.displayName, 'fr', { sensitivity: 'base' }))
    .map((item) => ({ type: 'item', item }))
  const entries = category === 'resources' ? resources : category === 'objects' ? objects : category === 'collection' ? collection : [...resources, ...objects, ...collection]
  const normalizedQuery = normalizeInventorySearch(query)
  return normalizedQuery ? entries.filter((entry) => normalizeInventorySearch(searchableText(entry)).includes(normalizedQuery)) : entries
}

export function inventoryCategoryCount(inventory: { resources: readonly InventoryResourceDto[]; items: readonly InventoryItemDto[] }, category: InventoryCategory): number {
  if (category === 'resources') return inventory.resources.length
  if (category === 'objects') return inventory.items.filter(({ section }) => section === 'objects').length
  if (category === 'collection') return inventory.items.filter(({ section }) => section === 'collection').length
  return inventory.resources.length + inventory.items.length
}

export function collectionCompletion(items: readonly InventoryItemDto[]) {
  const collection = items.filter(({ section }) => section === 'collection')
  return { owned: collection.filter(({ quantity }) => BigInt(quantity) > 0n).length, total: collection.length }
}

export function normalizeInventorySearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim()
}

function walletAmount(wallet: PlayerResourcesDto, key: InventoryResourceDto['key']): string {
  if (key === 'primogems') return wallet.primogems
  if (key === 'moras') return wallet.moras
  return wallet.particles[key.slice(10) as keyof PlayerResourcesDto['particles']]
}

function ownedRank(item: InventoryItemDto) { return BigInt(item.quantity) > 0n ? 0 : 1 }
function searchableText(entry: InventoryEntry) {
  return entry.type === 'resource'
    ? `${entry.resource.displayName} ${entry.resource.key} ${entry.resource.elementKey ?? ''}`
    : `${entry.item.displayName} ${entry.item.description ?? ''} ${entry.item.acquisitionHint ?? ''}`
}
