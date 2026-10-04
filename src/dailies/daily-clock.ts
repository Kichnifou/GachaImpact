const parisDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
export function parisBusinessDate(timestamp: number): string {
  const parts = parisDay.formatToParts(timestamp)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-')
}
/** Search the next Paris date boundary; DST days are 23/25 hours, never a fixed 24h interval. */
export function nextParisMidnight(timestamp: number): number {
  const day = parisBusinessDate(timestamp)
  let low = Math.floor(timestamp), high = low + 26 * 60 * 60 * 1000
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (parisBusinessDate(middle) === day) low = middle
    else high = middle
  }
  return high
}

export function resetCountdownMessage(resetAt: number, now: number): string {
  const minutes = Math.max(0, Math.ceil((resetAt - now) / 60_000))
  const hours = Math.floor(minutes / 60)
  return `Réinitialisation dans ${hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`}`
}
