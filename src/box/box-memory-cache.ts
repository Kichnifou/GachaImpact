import type { BoxCharacterDto, PlayerBoxDto } from '../api/types'

export class BoxMemoryCache {
  private entry: { playerId: string; box: PlayerBoxDto } | null = null

  read(playerId: string): PlayerBoxDto | null {
    return this.entry?.playerId === playerId ? this.entry.box : null
  }

  write(playerId: string, box: PlayerBoxDto): void {
    this.entry = { playerId, box }
  }

  async revalidate(playerId: string, load: () => Promise<PlayerBoxDto>): Promise<PlayerBoxDto> {
    const box = await load()
    this.write(playerId, box)
    return box
  }

  replaceCharacter(playerId: string, character: BoxCharacterDto): void {
    const box = this.read(playerId)
    if (!box) return
    this.write(playerId, {
      ...box,
      characters: box.characters.map((item) => item.id === character.id ? character : item),
    })
  }

  clear(): void {
    this.entry = null
  }
}
