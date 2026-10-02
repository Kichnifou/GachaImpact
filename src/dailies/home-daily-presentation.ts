import { dailyOngoingItems, type DailyId, type DailyItem } from './daily-summary'

/** Home-only presentation: prioritize the non-actionable Expedition, including a confirmed completion. */
export function homeDailySecondaryItems(items: readonly DailyItem[], hidden: readonly DailyId[], actionIds: readonly DailyId[]) {
  const ongoing = dailyOngoingItems(items, hidden, actionIds)
  const expedition = items.find(item => item.id === 'expedition' && !item.actionable && !hidden.includes(item.id) && !actionIds.includes(item.id)
    && (item.state === 'in_progress' || item.state === 'waiting' || item.state === 'completed'))
  return (expedition ? [expedition, ...ongoing.filter(item => item.id !== 'expedition')] : ongoing.filter(item => item.id !== 'expedition')).slice(0, 2)
}

export function homeDailySecondaryText(item: DailyItem) {
  const status = item.state === 'completed' ? 'Terminé' : item.status
  // The projection's generic placeholder is not a character identity.
  const detail = item.id === 'expedition' ? item.detail?.replace(/^Personnage · /, '') : item.detail
  return [item.title, status, detail].filter(Boolean).join(' · ')
}
