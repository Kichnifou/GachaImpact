/** Presentation only: eligibility and business days remain server/Paris owned. */
export function formatLocalWindow(startAt: string, endAt: string, timeZone?: string): string {
  const options = { timeZone, hour: '2-digit', minute: '2-digit' } as const
  const start = new Date(startAt), end = new Date(endAt)
  try {
    const day = new Intl.DateTimeFormat('fr-FR', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' })
    const sameDay = day.format(start) === day.format(end)
    const formatter = new Intl.DateTimeFormat('fr-FR', { ...options, ...(sameDay ? {} : { day: '2-digit', month: '2-digit', year: 'numeric' }) })
    return `${formatter.format(start)} – ${formatter.format(end)}`
  } catch {
    // A missing/unsupported browser zone must never suggest a false local time.
    const utc = new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
    return `${utc.format(start)} – ${utc.format(end)} (UTC)`
  }
}
