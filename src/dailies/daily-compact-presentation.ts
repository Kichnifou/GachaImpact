import type { DailyItem } from './daily-summary'

/** The projection's generic placeholder is not a character identity. */
export function compactExpeditionDetail(item: DailyItem) {
  return item.detail?.replace(/^Personnage · /, '')
}

export function dailyTrackerStatus(item: DailyItem) {
  if (item.id === 'expedition' && item.state === 'in_progress') return compactExpeditionDetail(item) ?? ''
  return item.status === 'Disponible.' ? '' : item.status
}
