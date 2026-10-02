import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DailyRewardClaimDto } from '../api/types'
import { apiErrorMessage } from '../utils/formatters'

/** All UI entries share one flight and one reserved feedback, without creating an operation on mount. */
export function useDailyClaim(onClaim: () => Promise<DailyRewardClaimDto>, playerId: string) {
  const callback = useRef(onClaim)
  const alive = useRef(true), flight = useRef<Promise<DailyRewardClaimDto> | null>(null), timer = useRef<number | undefined>(undefined)
  const [pending, setPending] = useState(false), [feedback, setFeedback] = useState(''), [error, setError] = useState('')
  const owner = useRef(playerId)
  useLayoutEffect(() => { callback.current = onClaim; owner.current = playerId }, [onClaim, playerId])
  const presenting = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false; window.clearTimeout(timer.current) } }, [])
  const run = useCallback(() => {
    if (flight.current) return flight.current
    const requestedFor = owner.current
    const onClaim = callback.current
    setPending(true); setError(''); setFeedback('')
    const request = Promise.resolve().then(() => {
      if (!alive.current || requestedFor !== owner.current) throw new Error('Session remplacée.')
      return onClaim()
    }).then(result => {
      if (alive.current && requestedFor === owner.current) {
        presenting.current = true
        setFeedback(result.alreadyClaimed ? 'Déjà récupérée.' : 'Récompense récupérée.')
        timer.current = window.setTimeout(() => { if (flight.current === request) flight.current = null; presenting.current = false; if (alive.current && requestedFor === owner.current) setFeedback('') }, 900)
      }
      return result
    }).catch(reason => { if (alive.current && requestedFor === owner.current) setError(apiErrorMessage(reason)); throw reason })
      .finally(() => { if (!presenting.current && flight.current === request) flight.current = null; if (alive.current && requestedFor === owner.current) setPending(false) })
    flight.current = request
    return request
  }, [])
  return { pending, feedback, error, run, locked: pending || Boolean(feedback) }
}
export type DailyClaimController = ReturnType<typeof useDailyClaim>
