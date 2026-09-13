import type { BoxCharacterDto, ExpeditionDto } from '../api/types'

export function prioritizeReady(characters: BoxCharacterDto[], expedition: ExpeditionDto) {
  if (expedition.operationalStatus !== 'READY' || !expedition.activeCharacter) return characters
  return [...characters].sort((left, right) => Number(right.id === expedition.activeCharacter!.id) - Number(left.id === expedition.activeCharacter!.id))
}

export function expeditionOverview(value: ExpeditionDto, now: number) {
  if (value.operationalStatus === 'RUNNING') return { status: '✅ Terminé', detail: `${value.activeCharacter?.name ?? 'Personnage'} · ${formatRemaining(value.readyAt, now)}`, completed: true }
  if (value.operationalStatus === 'READY') return { status: '✅ Terminé', detail: `${value.activeCharacter?.name ?? 'Le personnage'} est revenu · Récompense à récupérer.`, completed: true }
  if (value.departureUsedToday) return { status: '✅ Terminé', detail: 'Expédition effectuée.', completed: true }
  return { status: 'À faire', detail: 'Aucune expédition lancée.', completed: false }
}

export function expeditionInitialNow(value: ExpeditionDto) {
  return value.readyAt ? Date.parse(value.readyAt) - value.remainingSeconds * 1_000 : 0
}

export function formatRemaining(readyAt: string | null, now: number) {
  if (!readyAt) return '—'
  const seconds = Math.max(0, Math.ceil((Date.parse(readyAt) - now) / 1_000))
  return formatRemainingSeconds(seconds)
}

export function formatRemainingSeconds(seconds: number) {
  return `${String(Math.floor(seconds / 3_600)).padStart(2, '0')}:${String(Math.floor(seconds % 3_600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
