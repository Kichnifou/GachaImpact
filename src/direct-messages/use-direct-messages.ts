import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getGameApiClient } from '../api/game-api'
import type { DirectConversationDto, DirectMessageDto, DirectMessagePageDto } from '../api/types'

const orderMessages = (items: readonly DirectMessageDto[]) => [...items].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)).slice(-500)

export function useDirectMessages(playerId: string, active: boolean, conversationId: string | null, archivesRequested: boolean, onUnreadChange: (count: number) => void) {
  const api = getGameApiClient().directMessages
  const [normal, setNormal] = useState<readonly DirectConversationDto[]>([])
  const [archived, setArchived] = useState<readonly DirectConversationDto[]>([])
  const [messages, setMessages] = useState<readonly DirectMessageDto[]>([])
  const [cursor, setCursor] = useState<DirectMessagePageDto['nextCursor']>(null)
  const [listLoaded, setListLoaded] = useState(false), [messagesLoaded, setMessagesLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null), [pending, setPending] = useState(false)
  const normalRef = useRef(normal), archivedRef = useRef(archived), messagesRef = useRef(messages)
  const listRevision = useRef(0), messageRevision = useRef(0), listBusy = useRef(false), messageBusy = useRef(false), unreadBusy = useRef(false), olderBusy = useRef(false), mutationBusy = useRef(false)
  const selectedRef = useRef<string | null>(conversationId)
  useEffect(() => { normalRef.current = normal; archivedRef.current = archived; messagesRef.current = messages; selectedRef.current = conversationId }, [archived, conversationId, messages, normal])

  const adoptUnread = useCallback((count: number) => onUnreadChange(count), [onUnreadChange])
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
      normalRef.current = current.conversations; setNormal(current.conversations); setListLoaded(true)
      if (old) { archivedRef.current = old.conversations; setArchived(old.conversations) }
      adoptUnread([...current.conversations, ...(old?.conversations ?? archivedRef.current)].reduce((sum, conversation) => sum + conversation.unreadCount, 0))
      setError(null)
    } catch (reason) { if (revision === listRevision.current) setError(reason instanceof Error ? reason.message : 'Messages privés indisponibles.') }
    finally { listBusy.current = false }
  }, [adoptUnread, api, archivesRequested])

  const refreshMessages = useCallback(async (id = selectedRef.current) => {
    if (!id || messageBusy.current) return
    messageBusy.current = true
    const revision = messageRevision.current
    try {
      const page = await api.messages(id)
      if (revision !== messageRevision.current || selectedRef.current !== id) return
      const merged = messagesLoaded ? orderMessages([...messagesRef.current, ...page.messages].filter((message, index, all) => all.findIndex(candidate => candidate.id === message.id) === index)) : orderMessages(page.messages)
      messagesRef.current = merged; setMessages(merged)
      if (!messagesLoaded) setCursor(page.nextCursor)
      setMessagesLoaded(true); setError(null)
    } catch (reason) { if (revision === messageRevision.current) setError(reason instanceof Error ? reason.message : 'Conversation indisponible.') }
    finally { messageBusy.current = false }
  }, [api, messagesLoaded])

  const loadOlder = useCallback(async () => {
    const id = selectedRef.current
    if (!id || !cursor || olderBusy.current) return false
    olderBusy.current = true
    const revision = messageRevision.current
    try {
      const page = await api.messages(id, cursor)
      if (revision !== messageRevision.current || selectedRef.current !== id) return false
      const merged = orderMessages([...page.messages, ...messagesRef.current].filter((message, index, all) => all.findIndex(candidate => candidate.id === message.id) === index))
      messagesRef.current = merged; setMessages(merged); setCursor(page.nextCursor); setError(null)
      return true
    } catch (reason) { if (revision === messageRevision.current) setError(reason instanceof Error ? reason.message : 'Anciens messages indisponibles.'); return false }
    finally { olderBusy.current = false }
  }, [api, cursor])

  useEffect(() => {
    listRevision.current++; messageRevision.current++
    normalRef.current = []; archivedRef.current = []; messagesRef.current = []
    // oxlint-disable-next-line react/set-state-in-effect -- an authenticated Player change owns a complete cache reset
    setNormal([]); setArchived([]); setMessages([]); setCursor(null); setListLoaded(false); setMessagesLoaded(false); setError(null); setPending(false); adoptUnread(0)
  }, [adoptUnread, playerId])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- selecting a thread invalidates the previous thread snapshot synchronously
    messageRevision.current++; messagesRef.current = []; setMessages([]); setCursor(null); setMessagesLoaded(false); setError(null)
  }, [conversationId])

  useEffect(() => {
    let stopped = false, timer: number | undefined
    const tick = async () => {
      if (stopped || document.hidden) return
      if (active) {
        await refreshLists(archivesRequested)
        if (selectedRef.current) await refreshMessages(selectedRef.current)
      } else await refreshUnread()
    }
    const interval = () => active ? (selectedRef.current ? 1_200 : 3_000) : 5_000
    const schedule = () => { window.clearTimeout(timer); if (!stopped && !document.hidden) timer = window.setTimeout(async () => { await tick(); schedule() }, interval()) }
    const visible = () => { if (document.hidden) window.clearTimeout(timer); else { void tick(); schedule() } }
    void tick().then(schedule)
    window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible)
    return () => { stopped = true; window.clearTimeout(timer); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible) }
  }, [active, archivesRequested, conversationId, refreshLists, refreshMessages, refreshUnread])

  const mutate = useCallback(async <T,>(run: () => Promise<T>) => {
    if (mutationBusy.current) return null
    mutationBusy.current = true
    setPending(true); setError(null); listRevision.current++; messageRevision.current++
    try {
      const result = await run()
      await Promise.all([refreshLists(true), selectedRef.current ? refreshMessages(selectedRef.current) : Promise.resolve()])
      return result
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Action indisponible.'); throw reason }
    finally { mutationBusy.current = false; setPending(false) }
  }, [refreshLists, refreshMessages])

  const openTarget = useCallback(async (targetPlayerId: string) => {
    const [current, old] = await Promise.all([api.list(false), api.list(true)])
    normalRef.current = current.conversations; archivedRef.current = old.conversations
    setNormal(current.conversations); setArchived(old.conversations); setListLoaded(true)
    adoptUnread([...current.conversations, ...old.conversations].reduce((sum, conversation) => sum + conversation.unreadCount, 0))
    return [...current.conversations, ...old.conversations].find(conversation => conversation.other.id === targetPlayerId) ?? null
  }, [adoptUnread, api])

  const selected = useMemo(() => [...normal, ...archived].find(conversation => conversation.id === conversationId) ?? null, [archived, conversationId, normal])
  return {
    normal, archived, messages, cursor, selected, listLoaded, messagesLoaded, error, pending,
    clearError: () => setError(null), refreshLists, refreshMessages, refreshUnread, loadOlder, openTarget,
    send: (id: string, content: string, key: string) => mutate(() => api.send(id, content, key)),
    initiate: (targetPlayerId: string, content: string, key: string) => mutate(() => api.initiate(targetPlayerId, content, key)),
    accept: (id: string, requestId: string, key: string) => mutate(() => api.accept(id, requestId, key)),
    ignore: (id: string, requestId: string, key: string) => mutate(() => api.ignore(id, requestId, key)),
    block: (id: string, key: string) => mutate(() => api.block(id, key)),
    unblock: (id: string, key: string) => mutate(() => api.unblock(id, key)),
    archive: (id: string, value: boolean) => mutate(() => api.archive(id, value)),
    receipts: (id: string, enabled: boolean) => mutate(() => api.receipts(id, enabled)),
    markRead: async (id: string, messageId: string) => { const result = await api.read(id, messageId); await Promise.all([refreshLists(archivesRequested), refreshUnread()]); return result },
  }
}
