import { useEffect, useState } from 'react'
import type { ContestLatestScoreChangeDto, ContestSnapshotDto } from '../api/types'

export type ScoreFeedback = ContestLatestScoreChangeDto & { durationMs: number }
const empty: readonly ContestLatestScoreChangeDto[] = []
type Presentation = {
  id: string | null; source: readonly ContestLatestScoreChangeDto[];
  seen: ReadonlySet<string>; queue: readonly ContestLatestScoreChangeDto[]; startedAt: number; drainBy: number; baseline: boolean
}

export function useContestPresentation(contest: ContestSnapshotDto | null, now: number): ScoreFeedback | null {
  const id = contest?.status === 'RUNNING' ? contest.id : null
  const events = contest?.recentScoreChanges ?? empty
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden')
  const [state, setState] = useState<Presentation>(() => ({ id, source: events, seen: new Set(events.map(e => e.eventId)), queue: [], startedAt: 0, drainBy: 0, baseline: hidden }))
  const deadline = contest?.phase === 'SUPPORT' ? contest.supportDeadlineAt : contest?.turnDeadlineAt
  const urgent = Boolean(deadline && Date.parse(deadline) - now <= 5_000)
  const skip = hidden || reduced || urgent || !id

  // Ingest before committing the render: no frame with enabled commands and an
  // unregistered event. Keep IDs for this contest, including outside the last 8.
  if (state.id !== id || state.source !== events) {
    const baseline = state.id !== id || state.baseline || skip
    const seen = state.id === id ? new Set(state.seen) : new Set<string>()
    const unseen = events.filter(event => !seen.has(event.eventId))
    events.forEach(event => seen.add(event.eventId))
    const queue = baseline ? [] : [...state.queue, ...unseen].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    setState({ id, source: events, seen, queue, startedAt: state.queue[0]?.eventId === queue[0]?.eventId ? state.startedAt : Date.now(), drainBy: state.queue.length ? state.drainBy : Date.now() + 3_600, baseline: hidden })
  } else if (skip && state.queue.length > 0) {
    setState({ ...state, queue: [] })
  }

  useEffect(() => {
    const visibility = () => {
      const next = document.visibilityState === 'hidden'
      setHidden(next)
      if (next) setState(current => ({ ...current, queue: [], baseline: true }))
    }
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const motion = () => setReduced(media?.matches ?? false)
    document.addEventListener('visibilitychange', visibility)
    media?.addEventListener('change', motion)
    return () => { document.removeEventListener('visibilitychange', visibility); media?.removeEventListener('change', motion) }
  }, [])

  const head = state.queue[0]
  // At most 3.6 seconds of accumulated presentation; never extend the real turn.
  const durationMs = Math.min(1_200, Math.max(0, (state.drainBy - state.startedAt) / Math.max(1, state.queue.length)))
  useEffect(() => {
    if (!head || skip) return
    const timer = window.setTimeout(() => setState(current => current.id === id && current.queue[0]?.eventId === head.eventId
      ? { ...current, queue: current.queue.slice(1), startedAt: Date.now() } : current), Math.max(0, state.startedAt + durationMs - Date.now()))
    return () => window.clearTimeout(timer)
  }, [id, head?.eventId, state.startedAt, durationMs, skip])
  return !skip && state.id === id && head ? { ...head, durationMs } : null
}

export function contestActionAvailability(contest: ContestSnapshotDto, permissions: { canPlay: boolean; canSupport: boolean }, blocked: boolean, now: number) {
  const deadline = contest.phase === 'SUPPORT' ? contest.supportDeadlineAt : contest.turnDeadlineAt
  const current = !blocked && contest.status === 'RUNNING' && Boolean(deadline) && Date.parse(deadline!) > now
  return { current, canPlay: current && contest.phase === 'TURNS' && permissions.canPlay, canSupport: current && contest.phase === 'SUPPORT' && permissions.canSupport }
}
