import type { ExpeditionClientSnapshot } from '../expedition/expedition-client-snapshot'
import { expeditionRemainingSeconds } from '../expedition/expedition-client-snapshot'
import { formatRemainingSeconds } from '../expedition/expedition-presentation'

function ExpeditionCountdown({ snapshot, monotonicNow }: { snapshot: ExpeditionClientSnapshot; monotonicNow: number }) {
  return formatRemainingSeconds(expeditionRemainingSeconds(snapshot, monotonicNow))
}

export default ExpeditionCountdown
