import { useEffect, useState } from 'react'

import type { ExpeditionDto } from '../api/types'
import { formatRemainingSeconds } from '../expedition/expedition-presentation'

function ExpeditionCountdown({ value }: { value: ExpeditionDto }) {
  return <ExpeditionCountdownValue key={`${value.operationalStatus}:${value.readyAt ?? ''}:${value.remainingSeconds}`} initialRemainingSeconds={value.remainingSeconds} running={value.operationalStatus === 'RUNNING' && Boolean(value.readyAt)} />
}

function ExpeditionCountdownValue({ initialRemainingSeconds, running }: { initialRemainingSeconds: number; running: boolean }) {
  const [remainingSeconds, setRemainingSeconds] = useState(initialRemainingSeconds)

  useEffect(() => {
    if (!running) return
    const clientStartedAt = Date.now()
    const refresh = () => setRemainingSeconds(Math.max(0, initialRemainingSeconds - Math.floor((Date.now() - clientStartedAt) / 1_000)))
    const timer = window.setInterval(refresh, 1_000)
    return () => window.clearInterval(timer)
  }, [initialRemainingSeconds, running])

  return formatRemainingSeconds(remainingSeconds)
}

export default ExpeditionCountdown
