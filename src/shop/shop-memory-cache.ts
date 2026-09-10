import type { PlayerShopDto, ShopPurchaseDto } from '../api/types'

type CacheEntry = { value: PlayerShopDto; revision: number }

export class ShopMemoryCache {
  private readonly entries = new Map<string, CacheEntry>()
  private lifecycle = 0

  public read(playerId: string): PlayerShopDto | null { return this.entries.get(playerId)?.value ?? null }

  public async revalidate(playerId: string, load: () => Promise<PlayerShopDto>): Promise<PlayerShopDto> {
    const revision = this.entries.get(playerId)?.revision ?? 0
    const lifecycle = this.lifecycle
    const loaded = await load()
    const current = this.entries.get(playerId)
    if (this.lifecycle !== lifecycle || (current?.revision ?? 0) !== revision) return current?.value ?? loaded
    this.entries.set(playerId, { value: loaded, revision })
    return loaded
  }

  public writeConfirmed(playerId: string, value: ShopPurchaseDto): ShopPurchaseDto {
    this.entries.set(playerId, { value, revision: (this.entries.get(playerId)?.revision ?? 0) + 1 })
    return value
  }

  public clear(): void { this.lifecycle += 1; this.entries.clear() }
}
