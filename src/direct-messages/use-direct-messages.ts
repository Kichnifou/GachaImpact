import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getGameApiClient } from '../api/game-api'
import type { DirectConversationDto, DirectMessageDto, DirectMessagePageDto } from '../api/types'

type MessageCache = { messages: readonly DirectMessageDto[]; cursor: DirectMessagePageDto['nextCursor']; fetched: boolean }

const durableOrder = (items: readonly DirectMessageDto[]) => [...items].sort((left, right) => {
  if (left.submissionOrder === null) return right.submissionOrder === null ? 0 : 1
  if (right.submissionOrder === null) return -1
  const leftOrder = BigInt(left.submissionOrder), rightOrder = BigInt(right.submissionOrder)
  return leftOrder === rightOrder ? left.id.localeCompare(right.id) : leftOrder < rightOrder ? -1 : 1
}).slice(-500)

/** Live delivery is arrival-stable: known rows are replaced in place and unknown rows append. */
function mergeDirectMessages(current: readonly DirectMessageDto[], incoming: readonly DirectMessageDto[]) {
  const byId = new Map(incoming.map(message => [message.id, message]))
  const byIntent = new Map(incoming.filter(message => message.clientIntentKey).map(message => [message.clientIntentKey!, message]))
  const consumed = new Set<string>()
  const next = current.map(message => {
    const fresh = byId.get(message.id) ?? (message.clientIntentKey ? byIntent.get(message.clientIntentKey) : undefined)
    if (!fresh) return message
    consumed.add(fresh.id)
    return fresh
  })
  for (const message of incoming) {
    if (!consumed.has(message.id) && !next.some(known => known.id === message.id || Boolean(known.clientIntentKey && known.clientIntentKey === message.clientIntentKey))) next.push(message)
  }
  return next.slice(-500)
}

export function createOptimisticDirectMessage(playerId: string, conversationId: string, content: string, key: string): DirectMessageDto {
  return { id: `optimistic:${key}`, conversationId, authorPlayerId: playerId, own: true, clientIntentKey: key, content, createdAt: new Date().toISOString(), submissionOrder: null, editedAt: null, deletedAt: null, restoredAt: null, readByOther: false, readByOtherAt: null }
}

/** A server projection already observed by polling/listing must never be downgraded by a later POST acknowledgement. */
function confirmDirectMessage(current: readonly DirectMessageDto[], optimistic: DirectMessageDto, messageId: string, key: string) {
  const authoritative = current.find(message => message.submissionOrder !== null && (message.id === messageId || message.clientIntentKey === key))
  if (authoritative) return current.filter(message => message === authoritative || message.clientIntentKey !== key).slice(-500)
  return mergeDirectMessages(current, [{ ...optimistic, id: messageId }])
}

export function useDirectMessages(playerId: string, active: boolean, conversationId: string | null, archivesRequested: boolean, onUnreadChange: (count: number) => void) {
  const api = getGameApiClient().directMessages
  const [normal, setNormal] = useState<readonly DirectConversationDto[]>([])
  const [archived, setArchived] = useState<readonly DirectConversationDto[]>([])
  const [messages, setMessages] = useState<readonly DirectMessageDto[]>([])
  const [cursor, setCursor] = useState<DirectMessagePageDto['nextCursor']>(null)
  const [listLoaded, setListLoaded] = useState(false), [messagesLoaded, setMessagesLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null), [pending, setPending] = useState(false)
  const normalRef = useRef(normal), archivedRef = useRef(archived), messagesRef = useRef(messages)
  const caches = useRef(new Map<string, MessageCache>())
  const listRevision = useRef(0), messageRevision = useRef(0), listBusy = useRef(false), unreadBusy = useRef(false), olderBusy = useRef(false)
  const messageBusy = useRef(new Set<string>()), mutationCount = useRef(0), selectedRef = useRef<string | null>(conversationId)
  useEffect(() => { normalRef.current = normal; archivedRef.current = archived; messagesRef.current = messages }, [archived, messages, normal])

  const adoptUnread = useCallback((count: number) => onUnreadChange(count), [onUnreadChange])
  const publishLists = useCallback((nextNormal: readonly DirectConversationDto[], nextArchived: readonly DirectConversationDto[]) => {
    normalRef.current = nextNormal; archivedRef.current = nextArchived
    setNormal(nextNormal); setArchived(nextArchived)
    adoptUnread([...nextNormal, ...nextArchived].reduce((sum, conversation) => sum + conversation.unreadCount, 0))
  }, [adoptUnread])
  const publishMessages = useCallback((id: string, entry: MessageCache) => {
    caches.current.set(id, entry)
    if (selectedRef.current !== id) return
    messagesRef.current = entry.messages; setMessages(entry.messages); setCursor(entry.cursor); setMessagesLoaded(true)
  }, [])

  const refreshUnread = useCallback(async () => {
    if (unreadBusy.current) return
    unreadBusy.current = true
    try { adoptUnread((await api.unread()).unreadCount) } finally { unreadBusy.current = false }
  }, [adoptUnread, api])

  const refreshLists = useCallback(async (includeArchived = archivesRequested) => {
    if (listBusy.current) return
    listBusy.current = true
    const revision = listRevision.current
    try {
      const [current, old] = await Promise.all([api.list(false), includeArchived ? api.list(true) : Promise.resolve(null)])
      if (revision !== listRevision.current) return
      publishLists(current.conversations, old?.conversations ?? archivedRef.current)
      setListLoaded(true); setError(null)
    } catch (reason) { if (revision === listRevision.current) setError(reason instanceof Error ? reason.message : 'Messages privés indisponibles.') }
    finally { listBusy.current = false }
  }, [api, archivesRequested, publishLists])

  const refreshMessages = useCallback(async (id = selectedRef.current) => {
    if (!id || messageBusy.current.has(id)) return
    messageBusy.current.add(id)
    const revision = messageRevision.current
    try {
      const page = await api.messages(id)
      if (revision !== messageRevision.current || selectedRef.current !== id) return
      const cached = caches.current.get(id)
      const nextMessages = cached?.fetched ? mergeDirectMessages(cached.messages, page.messages) : durableOrder(page.messages)
      publishMessages(id, { messages: nextMessages, cursor: cached?.fetched ? cached.cursor : page.nextCursor, fetched: true })
      setError(null)
    } catch (reason) { if (revision === messageRevision.current && selectedRef.current === id) setError(reason instanceof Error ? reason.message : 'Conversation indisponible.') }
    finally { messageBusy.current.delete(id) }
  }, [api, publishMessages])

  const loadOlder = useCallback(async () => {
    const id = selectedRef.current, cached = id ? caches.current.get(id) : null
    if (!id || !cached?.cursor || olderBusy.current) return false
    olderBusy.current = true
    const revision = messageRevision.current
    try {
      const page = await api.messages(id, cached.cursor)
      if (revision !== messageRevision.current || selectedRef.current !== id) return false
      const freshById = new Map(page.messages.map(message => [message.id, message]))
      const refreshedCurrent = cached.messages.map(message => freshById.get(message.id) ?? message)
      const known = new Set(refreshedCurrent.map(message => message.id))
      const prefix = page.messages.filter(message => !known.has(message.id))
      publishMessages(id, { messages: [...prefix, ...refreshedCurrent].slice(-500), cursor: page.nextCursor, fetched: true })
      setError(null)
      return true
    } catch (reason) { if (revision === messageRevision.current) setError(reason instanceof Error ? reason.message : 'Anciens messages indisponibles.'); return false }
    finally { olderBusy.current = false }
  }, [api, publishMessages])

  useLayoutEffect(() => {
    listRevision.current++; messageRevision.current++
    normalRef.current = []; archivedRef.current = []; messagesRef.current = []; caches.current.clear(); selectedRef.current = null
    // oxlint-disable-next-line react/set-state-in-effect -- an authenticated Player change owns a complete cache reset
    setNormal([]); setArchived([]); setMessages([]); setCursor(null); setListLoaded(false); setMessagesLoaded(false); setError(null); setPending(false); adoptUnread(0)
  }, [adoptUnread, playerId])

  useLayoutEffect(() => {
    messageRevision.current++; selectedRef.current = conversationId
    // oxlint-disable-next-line react/set-state-in-effect -- a thread switch clears obsolete request feedback before paint
    setError(null)
    // oxlint-disable-next-line react/set-state-in-effect -- an empty route must not retain the previous thread snapshot
    if (!conversationId) { messagesRef.current = []; setMessages([]); setCursor(null); setMessagesLoaded(false); return }
    const cached = caches.current.get(conversationId)
    const conversation = [...normalRef.current, ...archivedRef.current].find(item => item.id === conversationId)
    const seed = cached ?? { messages: conversation?.lastMessage ? [conversation.lastMessage] : [], cursor: null, fetched: false }
    caches.current.set(conversationId, seed); messagesRef.current = seed.messages
    // oxlint-disable-next-line react/set-state-in-effect -- selecting a thread publishes its cached snapshot before the first paint
    setMessages(seed.messages); setCursor(seed.cursor); setMessagesLoaded(cached?.fetched === true || seed.messages.length > 0)
    void refreshMessages(conversationId)
  }, [conversationId, playerId, refreshMessages])

  useEffect(() => {
    let stopped = false, busy = false, timer: number | undefined, lastListAt = 0
    const cadence = () => active ? (selectedRef.current ? 500 : 1_250) : 5_000
    const tick = async () => {
      if (stopped || busy || document.hidden) return
      busy = true
      try {
        if (!active) await refreshUnread()
        else if (selectedRef.current) {
          const now = Date.now()
          const includeArchived = archivesRequested || archivedRef.current.some(item => item.id === selectedRef.current)
          const jobs: Promise<unknown>[] = [refreshMessages(selectedRef.current)]
          if (now - lastListAt >= 1_250) { lastListAt = now; jobs.push(refreshLists(includeArchived)) }
          await Promise.all(jobs)
        } else await refreshLists(archivesRequested)
      } finally { busy = false }
    }
    const runAndSchedule = async () => {
      const startedAt = performance.now()
      await tick()
      if (!stopped && !document.hidden) timer = window.setTimeout(runAndSchedule, Math.max(0, cadence() - (performance.now() - startedAt)))
    }
    const visible = () => { window.clearTimeout(timer); if (!document.hidden) void runAndSchedule() }
    void runAndSchedule()
    window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible)
    return () => { stopped = true; window.clearTimeout(timer); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible) }
  }, [active, archivesRequested, conversationId, refreshLists, refreshMessages, refreshUnread])

  const beginMutation = () => { mutationCount.current++; setPending(true); setError(null) }
  const endMutation = () => { mutationCount.current--; if (mutationCount.current === 0) setPending(false) }
  const revalidate = () => { void refreshLists(true); if (selectedRef.current) void refreshMessages(selectedRef.current) }
  const mutate = useCallback(async <T,>(run: () => Promise<T>) => {
    beginMutation()
    try { const result = await run(); revalidate(); return result }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Action indisponible.'); throw reason }
    finally { endMutation() }
  }, [refreshLists, refreshMessages]) // eslint-disable-line react-hooks/exhaustive-deps

  const openTarget = useCallback(async (targetPlayerId: string) => {
    const known = [...normalRef.current, ...archivedRef.current].find(conversation => conversation.other.id === targetPlayerId)
    if (known) { void refreshLists(true); return known }
    const [current, old] = await Promise.all([api.list(false), api.list(true)])
    publishLists(current.conversations, old.conversations); setListLoaded(true)
    return [...current.conversations, ...old.conversations].find(conversation => conversation.other.id === targetPlayerId) ?? null
  }, [api, publishLists, refreshLists])

  const send = useCallback(async (id: string, content: string, key: string) => {
    const optimistic = createOptimisticDirectMessage(playerId, id, content, key)
    const before = caches.current.get(id) ?? { messages: [], cursor: null, fetched: false }
    publishMessages(id, { ...before, messages: mergeDirectMessages(before.messages, [optimistic]) })
    beginMutation()
    try {
      const result = await api.send(id, content, key)
      const current = caches.current.get(id) ?? before
      publishMessages(id, { ...current, messages: confirmDirectMessage(current.messages, optimistic, result.messageId, key) })
      revalidate()
      return result
    } catch (reason) {
      const current = caches.current.get(id) ?? before
      publishMessages(id, { ...current, messages: current.messages.filter(message => message.clientIntentKey !== key) })
      setError(reason instanceof Error ? reason.message : 'Message non envoyé.')
      throw reason
    } finally { endMutation() }
  }, [api, playerId, publishMessages]) // eslint-disable-line react-hooks/exhaustive-deps

  const initiate = useCallback(async (targetPlayerId: string, content: string, key: string) => {
    beginMutation()
    try {
      const result = await api.initiate(targetPlayerId, content, key)
      const cached = caches.current.get(result.conversationId) ?? { messages: [], cursor: null, fetched: false }
      const listed = [...normalRef.current, ...archivedRef.current].find(conversation => conversation.id === result.conversationId || conversation.other.id === targetPlayerId)?.lastMessage
      const observed = listed ? mergeDirectMessages(cached.messages, [listed]) : cached.messages
      const optimistic = createOptimisticDirectMessage(playerId, result.conversationId, content, key)
      caches.current.set(result.conversationId, { ...cached, messages: confirmDirectMessage(observed, optimistic, result.messageId, key) })
      revalidate()
      return result
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Message non envoyé.'); throw reason }
    finally { endMutation() }
  }, [api, playerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const markConversationSeen = useCallback((id: string) => {
    listRevision.current++
    const clear = (items: readonly DirectConversationDto[]) => items.map(item => item.id === id ? { ...item, unreadCount: 0 } : item)
    publishLists(clear(normalRef.current), clear(archivedRef.current))
  }, [publishLists])

  const receipts = useCallback(async (id: string, enabled: boolean) => {
    const previous = [...normalRef.current, ...archivedRef.current].find(item => item.id === id)?.readReceiptsEnabled ?? !enabled
    const update = (items: readonly DirectConversationDto[], value: boolean) => items.map(item => item.id === id ? { ...item, readReceiptsEnabled: value } : item)
    listRevision.current++; publishLists(update(normalRef.current, enabled), update(archivedRef.current, enabled)); beginMutation()
    try { const result = await api.receipts(id, enabled); publishLists(update(normalRef.current, result.readReceiptsEnabled), update(archivedRef.current, result.readReceiptsEnabled)); revalidate(); return result }
    catch (reason) { listRevision.current++; publishLists(update(normalRef.current, previous), update(archivedRef.current, previous)); setError(reason instanceof Error ? reason.message : 'Accusés de lecture indisponibles.'); throw reason }
    finally { endMutation() }
  }, [api, publishLists]) // eslint-disable-line react-hooks/exhaustive-deps

  const archive = useCallback(async (id: string, value: boolean) => {
    const beforeNormal = normalRef.current, beforeArchived = archivedRef.current
    const item = [...beforeNormal, ...beforeArchived].find(conversation => conversation.id === id)
    if (item) {
      listRevision.current++
      const moved = { ...item, archived: value }
      publishLists(value ? beforeNormal.filter(row => row.id !== id) : [moved, ...beforeNormal.filter(row => row.id !== id)], value ? [moved, ...beforeArchived.filter(row => row.id !== id)] : beforeArchived.filter(row => row.id !== id))
    }
    beginMutation()
    try { const result = await api.archive(id, value); revalidate(); return result }
    catch (reason) { listRevision.current++; publishLists(beforeNormal, beforeArchived); setError(reason instanceof Error ? reason.message : 'Archivage indisponible.'); throw reason }
    finally { endMutation() }
  }, [api, publishLists]) // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = useCallback(async (id: string, messageId: string) => {
    markConversationSeen(id)
    try { const result = await api.read(id, messageId); void refreshLists(archivesRequested); void refreshUnread(); return result }
    catch (reason) { void refreshLists(archivesRequested); void refreshUnread(); throw reason }
  }, [api, archivesRequested, markConversationSeen, refreshLists, refreshUnread])

  const selected = useMemo(() => [...normal, ...archived].find(conversation => conversation.id === conversationId) ?? null, [archived, conversationId, normal])
  return {
    normal, archived, messages, cursor, selected, listLoaded, messagesLoaded, error, pending,
    clearError: () => setError(null), refreshLists, refreshMessages, refreshUnread, loadOlder, openTarget, markConversationSeen,
    send,
    initiate,
    accept: (id: string, requestId: string, key: string) => mutate(() => api.accept(id, requestId, key)),
    ignore: (id: string, requestId: string, key: string) => mutate(() => api.ignore(id, requestId, key)),
    block: (id: string, key: string) => mutate(() => api.block(id, key)),
    unblock: (id: string, key: string) => mutate(() => api.unblock(id, key)),
    archive, receipts, markRead,
  }
}
