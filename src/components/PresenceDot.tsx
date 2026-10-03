import type { Access, PresenceStatus } from '../social/types'
import { presenceLabels } from '../social/types'

/** Only authorized presence has a color. PRIVATE never becomes OFFLINE. */
export default function PresenceDot({ presence }: { presence?: Access<PresenceStatus> }) {
  if (presence?.access !== 'ALLOWED') return null
  const label = presenceLabels[presence.data]
  return <span className={`presence-dot presence-dot-${presence.data.toLowerCase()}`} role="img" aria-label={label} title={label} />
}
