import type { BankTransferDto, PlayerBankDto } from '../api/types'

type CacheEntry = {
  value: PlayerBankDto
  revision: number
}

export class BankMemoryCache {
  private readonly entries = new Map<string, CacheEntry>()
  private lifecycle = 0

  public read(playerId: string): PlayerBankDto | null {
    return this.entries.get(playerId)?.value ?? null
  }

  public async revalidate(playerId: string, load: () => Promise<PlayerBankDto>): Promise<PlayerBankDto> {
    const revision = this.entries.get(playerId)?.revision ?? 0
    const lifecycle = this.lifecycle
    const loaded = await load()
    const current = this.entries.get(playerId)
    if (this.lifecycle !== lifecycle || (current?.revision ?? 0) !== revision) return current?.value ?? loaded
    this.entries.set(playerId, { value: loaded, revision })
    return loaded
  }

  public writeConfirmed(playerId: string, value: BankTransferDto): BankTransferDto {
    const revision = (this.entries.get(playerId)?.revision ?? 0) + 1
    this.entries.set(playerId, { value, revision })
    return value
  }

  public clear(): void {
    this.lifecycle += 1
    this.entries.clear()
  }
}
