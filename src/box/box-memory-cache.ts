import type { BoxCharacterDto, PlayerBoxDto } from '../api/types'

export class BoxMemoryCache {
  private entries = new Map<string, { box: PlayerBoxDto; revision: number }>()
  private lifecycleRevision = 0

  read(playerId: string): PlayerBoxDto | null {
    return this.entries.get(playerId)?.box ?? null
  }

  write(playerId: string, box: PlayerBoxDto): void {
    this.entries.set(playerId, { box, revision: this.entries.get(playerId)?.revision ?? 0 })
  }

  async revalidate(playerId: string, load: () => Promise<PlayerBoxDto>): Promise<PlayerBoxDto> {
    const startedAtRevision = this.entries.get(playerId)?.revision ?? 0
    const startedInLifecycle = this.lifecycleRevision
    const box = await load()
    const current = this.entries.get(playerId)
    if (startedInLifecycle !== this.lifecycleRevision || (current?.revision ?? 0) !== startedAtRevision) {
      return current?.box ?? box
    }
    this.entries.set(playerId, { box, revision: startedAtRevision })
    return box
  }

  replaceCharacter(playerId: string, character: BoxCharacterDto): void {
    const current = this.entries.get(playerId)
    if (!current) return
    this.entries.set(playerId, {
      revision: current.revision + 1,
      box: {
        ...current.box,
        characters: current.box.characters.map((item) => item.id === character.id ? character : item),
      },
    })
  }

  clear(): void {
    this.entries.clear()
    this.lifecycleRevision += 1
  }
}
