/** Coalesce identical in-flight reads and serialize other chat reads.
 * Completed values are never cached; each instance belongs to one mounted viewer.
 */
export class ChatReadCoordinator {
  private tail: Promise<unknown> = Promise.resolve()
  private pending = new Map<string, Promise<unknown>>()

  run<T>(key: string, read: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key)
    if (existing) return existing as Promise<T>
    const result = this.tail.then(read, read)
    this.pending.set(key, result)
    this.tail = result.then(() => undefined, () => undefined)
    void result.finally(() => { this.pending.delete(key) }).catch(() => undefined)
    return result
  }
}

/** Delay measured from completion, with bounded jitter and gradual slow recovery. */
export function chatPollDelay(active: boolean, failures: number, slowLevel: number, random = Math.random()): number {
  const base = failures ? Math.min(15_000, 1000 * 2 ** Math.min(4, failures))
    : active ? Math.min(8000, 1500 * 2 ** slowLevel) : 5000
  return base + Math.floor(Math.max(0, Math.min(1, random)) * 500)
}
