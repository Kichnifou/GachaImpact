import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { InventoryItem, InventorySection, InventoryStore } from '../../application/inventory/inventory-store.js';
import { isElementKey, isResourceKey, resourceKeys } from '../../domain/economy/resources.js';

export class PrismaInventoryStore implements InventoryStore {
  public constructor(private readonly database: PrismaClient) {}

  public async getInventory(playerId: string) {
    const [resourceRows, itemRows] = await Promise.all([
      this.database.resourceDefinition.findMany({
        where: { key: { in: [...resourceKeys] } },
        select: {
          key: true,
          displayName: true,
          category: true,
          elementKey: true,
          playerBalances: { where: { playerId }, select: { amount: true }, take: 1 },
        },
      }),
      this.database.itemDefinition.findMany({
        where: { isActive: true },
        orderBy: [{ displayName: 'asc' }, { externalKey: 'asc' }],
        select: {
          id: true,
          externalKey: true,
          displayName: true,
          category: true,
          description: true,
          metadata: true,
          playerBalances: {
            where: { playerId },
            select: { quantity: true, firstObtainedAt: true },
            take: 1,
          },
        },
      }),
    ]);

    const byKey = new Map(resourceRows.map((row) => [row.key, row]));
    const resources = resourceKeys.map((key) => {
      const row = byKey.get(key);
      if (!row || !isResourceKey(row.key)) throw new Error(`Missing inventory resource definition: ${key}`);
      return {
        key,
        displayName: row.displayName,
        category: row.category,
        elementKey: row.elementKey && isElementKey(row.elementKey) ? row.elementKey : null,
        amount: row.playerBalances[0]?.amount ?? 0n,
      };
    });

    return {
      resources,
      items: itemRows.map((row): InventoryItem => {
        const balance = row.playerBalances[0];
        return {
          id: row.id,
          externalKey: row.externalKey,
          displayName: row.displayName,
          category: row.category,
          section: inventorySection(row.category, row.metadata),
          description: row.description,
          quantity: balance?.quantity ?? 0n,
          firstObtainedAt: balance?.firstObtainedAt ?? null,
          acquisitionHint: metadataString(row.metadata, 'acquisitionHint'),
        };
      }),
    };
  }
}

function inventorySection(category: string, metadata: Prisma.JsonValue | null): InventorySection {
  const configured = metadataString(metadata, 'inventorySection');
  if (configured === 'collection') return 'collection';
  if (configured === 'objects') return 'objects';
  return category.toLowerCase() === 'collection' ? 'collection' : 'objects';
}

function metadataString(metadata: Prisma.JsonValue | null, key: string): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
