/** Per-domain deduplication; mutations invalidate earlier reads and reset isolates an auth session. */
export function createDailyReadCoordinator() {
  let generation = 0
  const revisions = new Map<string, number>(), flights = new Map<string, Promise<unknown>>(), mutations = new Map<string, Promise<unknown>>(), latestDates = new Map<string, string>()
  const acceptsDate = (key: string, value: unknown) => {
    const date = (value as { businessDate?: unknown } | null)?.businessDate
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return true
    if (date < (latestDates.get(key) ?? '')) return false
    latestDates.set(key, date); return true
  }
  return {
    mutate<T>(key: string, load: () => Promise<T>, publish: (value: T) => void): Promise<T> {
      const token = generation
      revisions.set(key, (revisions.get(key) ?? 0) + 1); flights.delete(key)
      const request = Promise.resolve().then(() => { if (token !== generation) throw new Error('Session remplacée.'); return load() }).then(value => {
        if (token === generation) { revisions.set(key, (revisions.get(key) ?? 0) + 1); publish(value) }
        return value
      }).finally(() => { if (mutations.get(key) === request) mutations.delete(key) })
      mutations.set(key, request)
      return request
    },
    read<T>(key: string, load: () => Promise<T>, publish: (value: T) => void, onError?: (reason: unknown) => void): Promise<T> {
      const existing = flights.get(key)
      if (existing) return existing as Promise<T>
      const token = generation
      let revision = revisions.get(key) ?? 0
      const request = Promise.resolve().then(async () => {
        const pending = mutations.get(key)
        if (pending) { await pending.catch(() => undefined); revision = revisions.get(key) ?? 0 }
        if (token !== generation) throw new Error('Session remplacée.')
        const value = await load()
        if (token === generation && revision === (revisions.get(key) ?? 0) && acceptsDate(key, value)) publish(value)
        return value
      }).catch(reason => { if (token === generation && revision === (revisions.get(key) ?? 0)) onError?.(reason); throw reason })
        .finally(() => { if (flights.get(key) === request) flights.delete(key) })
      flights.set(key, request)
      return request
    },
    accept<T>(key: string, value: T, publish: (value: T) => void) {
      if (!acceptsDate(key, value)) return value
      revisions.set(key, (revisions.get(key) ?? 0) + 1); if (!mutations.has(key)) flights.delete(key); publish(value)
      return value
    },
    invalidate(key: string) { revisions.set(key, (revisions.get(key) ?? 0) + 1); flights.delete(key) },
    reset() { generation++; revisions.clear(); flights.clear(); mutations.clear(); latestDates.clear() },
  }
}
