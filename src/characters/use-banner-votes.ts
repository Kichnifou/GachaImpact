import { useEffect, useRef, useState } from 'react'
import type { BannerVoteDto } from '../api/types'
import { apiErrorMessage } from '../utils/formatters'
import { BannerVoteCache } from './banner-vote-cache'

export type BannerVoteActions = Readonly<{
  onLoadVotes?: () => Promise<BannerVoteDto>
  onVote?: (characterId: string, bannerRotationId: string) => Promise<BannerVoteDto>
  onReloadCatalog?: () => Promise<void>
}>

export function useBannerVotes({ onLoadVotes, onVote, onReloadCatalog }: BannerVoteActions, sharedCache?: BannerVoteCache) {
  const [localCache] = useState(() => new BannerVoteCache())
  const cache = sharedCache ?? localCache
  const [value, setValue] = useState<BannerVoteDto | null>(() => cache.value)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const alive = useRef(false)
  const revision = useRef(0)
  const catalogVersion = useRef<string | null>(cache.value?.catalogVersion ?? null)
  useEffect(() => {
    alive.current = true
    let active = true
    let inFlight = false
    let timer: number | undefined
    const refresh = async () => {
      if (!active || document.visibilityState !== 'visible') return
      if (inFlight) return
      inFlight = true
      const version = revision.current
      try {
        const next = onLoadVotes ? await cache.revalidate(onLoadVotes) : null
        if (!active || !next || version !== revision.current) return
        if (catalogVersion.current !== next.catalogVersion) {
          await onReloadCatalog?.()
          if (!active || version !== revision.current) return
          catalogVersion.current = next.catalogVersion
        }
        setValue(next); setError('')
      } catch (reason) { if (active) setError(apiErrorMessage(reason)) }
      finally { inFlight = false; if (active && document.visibilityState === 'visible') timer = window.setTimeout(() => void refresh(), 3000) }
    }
    const wake = () => { window.clearTimeout(timer); void refresh() }
    if (onLoadVotes) void refresh()
    window.addEventListener('focus', wake)
    document.addEventListener('visibilitychange', wake)
    return () => { active = false; alive.current = false; window.clearTimeout(timer); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake) }
  }, [cache, onLoadVotes, onReloadCatalog])
  const mutation = useRef(false)
  const vote = async (characterId: string) => {
    if (!value || !onVote || mutation.current || !value.canVote) return
    mutation.current = true; revision.current++; setPending(true); setError('')
    try {
      const next = await cache.vote(() => onVote(characterId, value.bannerRotationId))
      if (alive.current) setValue(next)
    } catch (reason) { if (alive.current) setError(apiErrorMessage(reason)) }
    finally { mutation.current = false; revision.current++; if (alive.current) setPending(false) }
  }
  return { value, pending, error, vote }
}
