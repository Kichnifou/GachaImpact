import type { ModerationStateDto } from '../api/types'

export function applyModerationResultToActor({ actorPlayerId, result, syncActorStella, onApplied }: {
  actorPlayerId: string
  result: ModerationStateDto
  syncActorStella: (quantity: string) => void
  onApplied: (state: ModerationStateDto, targetIsSelf: boolean) => void
}) {
  const targetIsSelf = result.player.id === actorPlayerId
  if (targetIsSelf) syncActorStella(result.stella.quantity)
  onApplied(result, targetIsSelf)
}
