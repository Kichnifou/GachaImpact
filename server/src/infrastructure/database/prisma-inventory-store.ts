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
          originFestival: metadataString(row.metadata, 'originFestival'),
          originMonth: metadataString(row.metadata, 'originMonth'),
          visualKey: metadataString(row.metadata, 'visualKey'),
        };
      }),
    };
  }

  public async getItemDetail(playerId: string, itemId: string, page: number) {
    const pageSize = 20;
    const definition = await this.database.itemDefinition.findFirst({
      where: { id: itemId, isActive: true },
      select: {
        id: true, externalKey: true, displayName: true, category: true, description: true, metadata: true,
        playerBalances: { where: { playerId }, select: { quantity: true, firstObtainedAt: true }, take: 1 },
      },
    });
    if (!definition) return null;
    const [history, total] = await Promise.all([
      this.database.itemAcquisition.findMany({
        where: { playerId, itemId }, orderBy: [{ acquiredAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, quantity: true, sourceKey: true, provenance: true, acquiredAt: true },
      }),
      this.database.itemAcquisition.count({ where: { playerId, itemId } }),
    ]);
    const balance = definition.playerBalances[0];
    return {
      item: {
        id: definition.id, externalKey: definition.externalKey, displayName: definition.displayName,
        category: definition.category, section: inventorySection(definition.category, definition.metadata),
        description: definition.description, quantity: balance?.quantity ?? 0n,
        firstObtainedAt: balance?.firstObtainedAt ?? null,
        acquisitionHint: metadataString(definition.metadata, 'acquisitionHint'),
        originFestival: metadataString(definition.metadata, 'originFestival'),
        originMonth: metadataString(definition.metadata, 'originMonth'),
        visualKey: metadataString(definition.metadata, 'visualKey'),
      },
      history, page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)),
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
