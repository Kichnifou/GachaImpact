import type { BoxCharacterDto, BoxSortPreferenceDto, PlayerBoxDto, StellaUseDto } from '../api/types'

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

  replacePreference(playerId: string, preference: BoxSortPreferenceDto): void {
    this.mutate(playerId, (box) => ({ ...box, preference }))
  }

  applyStella(playerId: string, result: StellaUseDto): void {
    this.mutate(playerId, (box) => ({
      ...box,
      characters: box.characters.map((item) => item.id === result.character.id ? result.character : item),
      stella: result.stella,
      summary: {
        ...box.summary,
        c6: box.summary.c6 + (result.character.constellation === 6
          && box.characters.find((item) => item.id === result.character.id)?.constellation !== 6 ? 1 : 0),
      },
    }))
  }

  private mutate(playerId: string, update: (box: PlayerBoxDto) => PlayerBoxDto): void {
    const current = this.entries.get(playerId)
    if (!current) return
    this.entries.set(playerId, { revision: current.revision + 1, box: update(current.box) })
  }

  clear(): void {
    this.entries.clear()
    this.lifecycleRevision += 1
  }
}
