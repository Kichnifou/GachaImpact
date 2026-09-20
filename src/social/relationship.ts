import type { FriendsSnapshot, RelationshipState } from './types'

export type RelationshipContext = Readonly<{
  state: RelationshipState | 'LOADING'
  requestId?: string
  friend?: FriendsSnapshot['friends'][number]
}>

export function relationshipContext(snapshot: FriendsSnapshot | null, ownerPlayerId: string, targetPlayerId: string): RelationshipContext {
  if (ownerPlayerId === targetPlayerId) return { state: 'SELF' }
  if (!snapshot) return { state: 'LOADING' }
  const friend = snapshot?.friends.find(item => item.playerId === targetPlayerId)
  if (friend) return { state: 'FRIEND', friend }
  const request = snapshot?.requests.find(item => item.playerId === targetPlayerId)
  return request ? { state: request.direction, requestId: request.id } : { state: 'NONE' }
}
