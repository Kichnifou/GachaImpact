import { useEffect } from 'react'

import type { EventDto } from '../api/types'

export const EVENT_REFRESH_MARGIN_MS = 75

export function useEventTemporalRefresh(
  event: EventDto | null,
  sessionUserId: string | undefined,
  loadEvent: () => Promise<EventDto>,
) {
  useEffect(() => {
    if (!sessionUserId || !event || !Number.isFinite(event.refreshAfterMs) || event.refreshAfterMs < 0) return
    const timer = window.setTimeout(() => { void loadEvent().catch(() => undefined) }, event.refreshAfterMs + EVENT_REFRESH_MARGIN_MS)
    return () => window.clearTimeout(timer)
  }, [event, loadEvent, sessionUserId])
}
