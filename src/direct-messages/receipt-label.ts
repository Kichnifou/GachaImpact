export function directMessageReceiptLabel(value: string | null, now: number) {
  if (!value) return 'Lu ✓'
  const date = new Date(value), minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000))
  const days = Math.floor(minutes / 1_440)
  if (minutes < 60) return 'Lu ✓'
  if (minutes < 1_440) return `Lu il y a ${Math.floor(minutes / 60)}h`
  if (days < 30) return `Lu il y a ${days}j`
  if (days < 365) return `Lu il y a ${Math.floor(days / 30)} mois`
  return `Lu il y a ${Math.floor(days / 365)} an${days >= 730 ? 's' : ''}`
}
