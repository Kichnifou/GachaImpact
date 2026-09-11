import type { ElementKey, PlayerInventoryDto, StellaUseDto } from '../api/types'

export const MASTERLESS_STELLA_FORTUNA_KEY = 'masterless-stella-fortuna'

export class InventoryMemoryCache {
  private entries = new Map<string, { inventory: PlayerInventoryDto; revision: number }>()
  private lifecycleRevision = 0

  read(playerId: string): PlayerInventoryDto | null {
    return this.entries.get(playerId)?.inventory ?? null
  }

  async revalidate(playerId: string, load: () => Promise<PlayerInventoryDto>): Promise<PlayerInventoryDto> {
    const startedAtRevision = this.entries.get(playerId)?.revision ?? 0
    const startedInLifecycle = this.lifecycleRevision
    const inventory = await load()
    const current = this.entries.get(playerId)
    if (startedInLifecycle !== this.lifecycleRevision || (current?.revision ?? 0) !== startedAtRevision) {
      return current?.inventory ?? inventory
    }
    this.entries.set(playerId, { inventory, revision: startedAtRevision })
    return inventory
  }

  applyStella(playerId: string, result: StellaUseDto): void {
    const current = this.entries.get(playerId)
    if (!current) return
    this.entries.set(playerId, {
      revision: current.revision + 1,
      inventory: {
        ...current.inventory,
        items: current.inventory.items.map((item) => item.externalKey === MASTERLESS_STELLA_FORTUNA_KEY
          ? { ...item, quantity: result.stella.quantity }
          : item),
      },
    })
  }

  setStellaQuantity(playerId: string, quantity: string): void {
    const current = this.entries.get(playerId)
    if (!current) return
    this.entries.set(playerId, { revision: current.revision + 1, inventory: { ...current.inventory, items: current.inventory.items.map((item) => item.externalKey === MASTERLESS_STELLA_FORTUNA_KEY ? { ...item, quantity } : item) } })
  }

  applyParticleConversion(playerId: string, elementKey: ElementKey, amount: string, primogems: string): void {
    const current = this.entries.get(playerId)
    if (!current) return
    const particleKey = `particles_${elementKey}`
    this.entries.set(playerId, {
      revision: current.revision + 1,
      inventory: {
        ...current.inventory,
        resources: current.inventory.resources.map((resource) => resource.key === particleKey
          ? { ...resource, amount }
          : resource.key === 'primogems' ? { ...resource, amount: primogems } : resource),
      },
    })
  }

  clear(): void {
    this.entries.clear()
    this.lifecycleRevision += 1
  }
}
