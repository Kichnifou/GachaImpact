import type { BannerVoteDto } from '../api/types'

/** Owned by one Player's GameShell session, never persisted. */
export class BannerVoteCache {
  readonly playerId: string | undefined
  constructor(playerId?: string) { this.playerId = playerId }
  value: BannerVoteDto | null = null
  private revision = 0
  private request = 0
  private mutating = false

  async revalidate(load: () => Promise<BannerVoteDto>) {
    const revision = this.revision
    const request = ++this.request
    const next = await load()
    if (revision === this.revision && request === this.request && !this.mutating) this.value = next
    return this.value
  }

  async vote(action: () => Promise<BannerVoteDto>) {
    if (this.mutating) return this.value
    this.mutating = true
    const revision = ++this.revision
    try {
      const next = await action()
      if (revision === this.revision) this.value = next
      return this.value
    } finally { this.mutating = false; this.revision++ }
  }

  clear() { this.revision++; this.value = null }
}
