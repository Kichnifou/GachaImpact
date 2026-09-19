import { useLayoutEffect, useRef, useState } from 'react'
import type { EventCalendarClaimDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { eventCurrencyLabel } from './event-presentation'
import { apiErrorMessage } from '../utils/formatters'

// Mounted by EventScreen (not by its selected tab), so an ambiguous intent survives navigation.
export function useCalendarClaim(boundary: string, onClaim?: (key: string) => Promise<EventCalendarClaimDto>) {
  const intent = useRef<{ boundary: string; key: string; pending: boolean } | null>(null)
  const activeBoundary = useRef(boundary)
  useLayoutEffect(() => { activeBoundary.current = boundary; return () => { activeBoundary.current = '' } }, [boundary])
  const [feedback, setFeedback] = useState({ boundary, pending: false, success: '', error: '' })
  const claim = async () => {
    if (!onClaim) return
    if (intent.current?.boundary !== boundary) intent.current = null
    if (intent.current?.pending) return
    const current = intent.current ?? { boundary, key: crypto.randomUUID(), pending: false }
    intent.current = current
    current.pending = true
    setFeedback({ boundary, pending: true, success: '', error: '' })
    try {
      const result = await onClaim(current.key)
      if (activeBoundary.current !== boundary) return
      intent.current = null
      const amount = result.calendarClaim.reward
      setFeedback({ boundary, pending: false, success: `Case ouverte ! Vous obtenez ${amount} ${eventCurrencyLabel(amount, result.festival.currency)}.`, error: '' })
    } catch (reason) {
      if (activeBoundary.current !== boundary) return
      if (!isAmbiguousMutationError(reason)) intent.current = null
      setFeedback({ boundary, pending: false, success: '', error: apiErrorMessage(reason) })
    } finally {
      current.pending = false
    }
  }
  return { claim, ...(feedback.boundary === boundary ? feedback : { pending: false, success: '', error: '' }) }
}
