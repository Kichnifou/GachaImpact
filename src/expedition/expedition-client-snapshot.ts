import type { ExpeditionDto } from '../api/types'

export type ExpeditionClientSnapshot = Readonly<{
  value: ExpeditionDto
  observedAt: number
}>

export function createExpeditionClientSnapshot(value: ExpeditionDto, observedAt: number): ExpeditionClientSnapshot {
  return { value, observedAt }
}

export function expeditionRemainingSeconds(snapshot: ExpeditionClientSnapshot, monotonicNow: number): number {
  const elapsedSeconds = Math.floor(Math.max(0, monotonicNow - snapshot.observedAt) / 1_000)
  return Math.max(0, snapshot.value.remainingSeconds - elapsedSeconds)
}
