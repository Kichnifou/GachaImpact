import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ApiError, getGameApiClient } from '../api/game-api'
import type { DirectMessageHistoryMessageDto, DirectMessageMutationDto } from '../api/types'
import { applyDirectMessageProjection } from './reply-preview'

type HistoryCache = { messages: readonly DirectMessageHistoryMessageDto[]; olderCursor: string | null; newerCursor: string | null; fetched: boolean }
type Mutation = { kind: 'edit'; messageId: string; content: string; key: string } | { kind: 'delete' | 'restore'; messageId: string; key: string }

const ordered = (items: readonly DirectMessageHistoryMessageDto[]) => [...items].sort((left, right) => {
  const a = BigInt(left.submissionOrder ?? '0'), b = BigInt(right.submissionOrder ?? '0')
  return a < b ? -1 : a > b ? 1 : left.id.localeCompare(right.id)
})
function merge(current: readonly DirectMessageHistoryMessageDto[], incoming: readonly DirectMessageHistoryMessageDto[]) {
  const values = new Map(current.map(message => [message.id, message]))
  incoming.forEach(message => values.set(message.id, message))
  return ordered([...values.values()])
}

export function useDirectMessageHistory(playerId: string, conversationId: string | null, active: boolean, query: string) {
  const api = getGameApiClient().directMessages
  const caches = useRef(new Map<string, HistoryCache>()), selected = useRef<string | null>(conversationId), revision = useRef(0)
  const busy = useRef(new Set<string>()), searchTail = useRef<Promise<void>>(Promise.resolve()), searchVersion = useRef(0), deletedContent = useRef(new Map<string, string>())
  const mutationOriginals = useRef(new Map<string, DirectMessageHistoryMessageDto>())
  const [messages, setMessages] = useState<readonly DirectMessageHistoryMessageDto[]>([])
  const [olderCursor, setOlderCursor] = useState<string | null>(null), [newerCursor, setNewerCursor] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const [results, setResults] = useState<readonly DirectMessageHistoryMessageDto[]>([]), [searchCursor, setSearchCursor] = useState<string | null>(null), [searching, setSearching] = useState(false)

  const publish = useCallback((id: string, cache: HistoryCache) => {
    caches.current.set(id, cache)
    if (selected.current !== id) return
    setMessages(cache.messages); setOlderCursor(cache.olderCursor); setNewerCursor(cache.newerCursor); setLoaded(cache.fetched)
  }, [])
  const fetchPage = useCallback(async (id: string, cursor: { beforeOrder?: string; afterOrder?: string; aroundOrder?: string } = {}) => api.history(id, cursor), [api])
  const loadInitial = useCallback(async (id: string) => {
    if (busy.current.has(`initial:${id}`)) return
    busy.current.add(`initial:${id}`); setLoading(true)
    const expected = revision.current
    try {
      const page = await fetchPage(id)
      if (expected !== revision.current || selected.current !== id) return
      publish(id, { messages: page.messages, olderCursor: page.olderCursor, newerCursor: page.newerCursor, fetched: true }); setError('')
    } catch (reason) { if (expected === revision.current) setError(reason instanceof Error ? reason.message : 'Historique indisponible.') }
    finally { busy.current.delete(`initial:${id}`); if (expected === revision.current) setLoading(false) }
  }, [fetchPage, publish])

  useLayoutEffect(() => {
    revision.current++; selected.current = null; caches.current.clear(); deletedContent.current.clear(); mutationOriginals.current.clear(); searchVersion.current++
    // oxlint-disable-next-line react/set-state-in-effect -- an authenticated Player boundary owns and clears every historical cache
    setMessages([]); setOlderCursor(null); setNewerCursor(null); setLoaded(false); setLoading(false); setError(''); setResults([]); setSearchCursor(null); setSearching(false)
  }, [playerId])
  useLayoutEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- changing the internal history route publishes that conversation's isolated snapshot before paint
    revision.current++; selected.current = conversationId; setError(''); setResults([]); setSearchCursor(null)
    if (!conversationId) { setMessages([]); setOlderCursor(null); setNewerCursor(null); setLoaded(false); return }
    const cached = caches.current.get(conversationId)
    if (cached) publish(conversationId, cached)
    else { setMessages([]); setOlderCursor(null); setNewerCursor(null); setLoaded(false) }
    if (active && !cached?.fetched) void loadInitial(conversationId)
  }, [active, conversationId, loadInitial, playerId, publish])

  const loadOlder = useCallback(async () => {
    const id = selected.current, cache = id ? caches.current.get(id) : null
    if (!id || !cache?.olderCursor || busy.current.has(`older:${id}`)) return false
    busy.current.add(`older:${id}`); setLoading(true)
    try {
      const page = await fetchPage(id, { beforeOrder: cache.olderCursor })
      const current = caches.current.get(id) ?? cache
      publish(id, { messages: merge(current.messages, page.messages), olderCursor: page.olderCursor, newerCursor: current.newerCursor, fetched: true }); setError(''); return true
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Anciens messages indisponibles.'); return false }
    finally { busy.current.delete(`older:${id}`); setLoading(false) }
  }, [fetchPage, publish])
  const loadNewer = useCallback(async () => {
    const id = selected.current, cache = id ? caches.current.get(id) : null
    if (!id || !cache?.newerCursor || busy.current.has(`newer:${id}`)) return false
    busy.current.add(`newer:${id}`); setLoading(true)
    try {
      const page = await fetchPage(id, { afterOrder: cache.newerCursor })
      const current = caches.current.get(id) ?? cache
      publish(id, { messages: merge(current.messages, page.messages), olderCursor: current.olderCursor, newerCursor: page.newerCursor, fetched: true }); setError(''); return true
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Messages récents indisponibles.'); return false }
    finally { busy.current.delete(`newer:${id}`); setLoading(false) }
  }, [fetchPage, publish])
  const jumpTo = useCallback(async (order: string) => {
    const id = selected.current
    if (!id || busy.current.has(`jump:${id}`)) return false
    busy.current.add(`jump:${id}`); setLoading(true)
    try {
      const page = await fetchPage(id, { aroundOrder: order })
      publish(id, { messages: page.messages, olderCursor: page.olderCursor, newerCursor: page.newerCursor, fetched: true }); setError(''); return true
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Contexte indisponible.'); return false }
    finally { busy.current.delete(`jump:${id}`); setLoading(false) }
  }, [fetchPage, publish])

  const runSearch = useCallback(async (id: string, value: string, cursor?: string, append = false, version = searchVersion.current) => {
    setSearching(true)
    try {
      const page = await api.historySearch(id, value, cursor)
      if (version !== searchVersion.current || selected.current !== id) return
      setResults(current => append ? [...current, ...page.results.filter(item => !current.some(known => known.id === item.id))] : page.results)
      setSearchCursor(page.nextCursor); setError('')
    } catch (reason) { if (version === searchVersion.current) setError(reason instanceof Error ? reason.message : 'Recherche indisponible.') }
    finally { if (version === searchVersion.current) setSearching(false) }
  }, [api])
  useEffect(() => {
    const value = query.trim(), id = conversationId, version = ++searchVersion.current
    // oxlint-disable-next-line react/set-state-in-effect -- clearing the query immediately removes obsolete search results
    if (!active || !id || !value) { setResults([]); setSearchCursor(null); setSearching(false); return }
    const timer = window.setTimeout(() => {
      const task = () => runSearch(id, value, undefined, false, version)
      searchTail.current = searchTail.current.then(task, task)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [active, conversationId, playerId, query, runSearch])
  const loadMoreResults = useCallback(async () => {
    const id = selected.current, value = query.trim(), cursor = searchCursor, version = searchVersion.current
    if (!id || !value || !cursor || searching) return false
    const task = async () => { await runSearch(id, value, cursor, true, version); return true }
    const queued = searchTail.current.then(task, task)
    searchTail.current = queued.then(() => undefined, () => undefined)
    return queued
  }, [query, runSearch, searchCursor, searching])
  const findDate = useCallback(async (at: string) => {
    const id = selected.current
    if (!id) return null
    try { const value = await api.historyDate(id, at); setError(''); return value.anchor }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Navigation par date indisponible.'); return null }
  }, [api])

  const mutate = useCallback(async (intent: Mutation): Promise<DirectMessageMutationDto> => {
    const id = selected.current, cache = id ? caches.current.get(id) : null, currentMessage = cache?.messages.find(message => message.id === intent.messageId)
    if (!id || !cache || !currentMessage) throw new Error('Message indisponible.')
    const operationKey = `${id}:${intent.key}`, original = mutationOriginals.current.get(operationKey) ?? currentMessage
    mutationOriginals.current.set(operationKey, original)
    if (intent.kind === 'delete' && original.content) deletedContent.current.set(original.id, original.content)
    const optimistic: DirectMessageHistoryMessageDto = intent.kind === 'edit' ? { ...currentMessage, content: intent.content, editedAt: new Date().toISOString() }
      : intent.kind === 'delete' ? { ...currentMessage, content: null, deletedAt: new Date().toISOString(), restoredAt: null, canRestore: false }
        : { ...currentMessage, content: deletedContent.current.get(original.id) ?? currentMessage.content, deletedAt: null, restoredAt: new Date().toISOString(), canRestore: false }
    publish(id, { ...cache, messages: applyDirectMessageProjection(cache.messages, optimistic) })
    setResults(current => {
      const projected = applyDirectMessageProjection(current, optimistic)
      return intent.kind === 'delete' ? projected.filter(message => message.id !== currentMessage.id) : projected
    })
    try {
      const result = intent.kind === 'edit' ? await api.edit(id, original.id, intent.content, intent.key) : intent.kind === 'delete' ? await api.remove(id, original.id, intent.key) : await api.restore(id, original.id, intent.key)
      const authoritative = { ...optimistic, ...result.message }
      const current = caches.current.get(id) ?? cache
      publish(id, { ...current, messages: applyDirectMessageProjection(current.messages, authoritative) })
      if (intent.kind === 'restore') deletedContent.current.delete(original.id)
      const context = await fetchPage(id, { aroundOrder: currentMessage.submissionOrder ?? undefined })
      const confirmed = context.messages.find(message => message.id === currentMessage.id)
      if (confirmed) {
        const latest = caches.current.get(id) ?? current
        publish(id, { ...latest, messages: applyDirectMessageProjection(latest.messages, confirmed) })
      }
      if (query.trim()) { const version = ++searchVersion.current; await runSearch(id, query.trim(), undefined, false, version) }
      mutationOriginals.current.delete(operationKey); setError(''); return result
    } catch (reason) {
      const deterministic = reason instanceof ApiError && reason.status !== null && reason.status < 500
      if (deterministic) {
        const current = caches.current.get(id) ?? cache
        publish(id, { ...current, messages: applyDirectMessageProjection(current.messages, original) })
        if (intent.kind === 'delete' && original.content) deletedContent.current.delete(original.id)
        mutationOriginals.current.delete(operationKey)
        if (query.trim()) { const version = ++searchVersion.current; await runSearch(id, query.trim(), undefined, false, version) }
      }
      setError(reason instanceof Error ? reason.message : 'Modification du message indisponible.'); throw reason
    }
  }, [api, fetchPage, publish, query, runSearch])

  return { messages, olderCursor, newerCursor, loaded, loading, error, results, searchCursor, searching, loadOlder, loadNewer, loadMoreResults, jumpTo, findDate, mutate, clearError: () => setError('') }
}
