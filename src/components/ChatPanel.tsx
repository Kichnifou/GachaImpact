import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type CSSProperties, type ReactNode } from 'react'
import { ApiError, getGameApiClient } from '../api/game-api'
import type { ChatMentionDto, ChatMessageDto, ChatRefreshScope, DirectMessagePlayerDto } from '../api/types'
import { elementColors } from '../utils/elementTheme'
import DirectMessagePanel, { type DirectMessageOpenIntent } from './DirectMessagePanel'

type Props = { playerId: string; playerDisplayName?: string; playerElementKey?: string | null; connectedCount?: number | null; isCollapsed: boolean; onToggle: () => void; onOpenPlayers: () => void; onOpenProfile: (id: string) => void; onRefreshScopes: (scopes: readonly ChatRefreshScope[]) => Promise<void>; directMessageIntent?: DirectMessageOpenIntent | null; onDirectMessageIntentConsumed?: (token: string) => void }
type Intent = { key: string; content: string; replyId: string | null; mentions: ChatMentionDto[]; burstTrigger: boolean }
type FailedIntent = Intent & { reason: string }
type PacingAttempt = { key: string; submittedAt: number }
const CHAT_VISIBLE_MESSAGE_LIMIT = 200
const CHAT_MIN_SUBMISSION_INTERVAL_MS = 750
const CHAT_BURST_WINDOW_MS = 4_000
const CHAT_BURST_LOCK_MS = 4_000

function pacingProjection(attempts: readonly PacingAttempt[]) {
  const ordered = [...attempts].sort((left, right) => left.submittedAt - right.submittedAt || left.key.localeCompare(right.key))
  const lastAcceptedAt = ordered.at(-1)?.submittedAt ?? null
  const recent = ordered.slice(-3)
  const burstLockedUntil = recent.length === 3 && recent[2]!.submittedAt - recent[0]!.submittedAt < CHAT_BURST_WINDOW_MS ? recent[2]!.submittedAt + CHAT_BURST_LOCK_MS : 0
  return { lastAcceptedAt, burstLockedUntil }
}

function linkChatText(content: string) {
  return content.split(/(https?:\/\/[^\s]+)/giu).map((part, index) => {
    if (!/^https?:\/\//iu.test(part)) return part
    const candidate = part.replace(/[),.!?;:]+$/u, '')
    try {
      const url = new URL(candidate)
      if (url.protocol === 'http:' || url.protocol === 'https:') return <span key={index}><a href={url.href} target="_blank" rel="noopener noreferrer">{candidate}</a>{part.slice(candidate.length)}</span>
    } catch { /* malformed URL stays plain escaped text */ }
    return part
  })
}
const normalizeMention = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr-FR')
function resolvedMentionRanges(content: string, mentions: readonly ChatMentionDto[]) {
  let normalized = ''
  const starts: number[] = [], ends: number[] = []
  for (let offset = 0; offset < content.length;) {
    const point = String.fromCodePoint(content.codePointAt(offset)!)
    const normalizedPoint = normalizeMention(point)
    for (let index = 0; index < normalizedPoint.length; index += 1) { normalized += normalizedPoint[index]!; starts.push(offset); ends.push(offset + point.length) }
    if (!normalizedPoint.length && ends.length) ends[ends.length - 1] = offset + point.length
    offset += point.length
  }
  const matches: { playerId: string; offset: number; length: number }[] = []
  for (const mention of mentions) {
    const needle = `@${normalizeMention(mention.displayName)}`
    if (needle === '@') continue
    let offset = normalized.indexOf(needle)
    while (offset >= 0) {
      const before = offset ? normalized[offset - 1] : null
      const after = normalized[offset + needle.length] ?? null
      const following = normalized[offset + needle.length + 1] ?? null
      if ((!before || /\s/u.test(before)) && (!after || /\s/u.test(after) || /[.,!?;:]/u.test(after) && (!following || /\s/u.test(following)))) matches.push({ playerId: mention.playerId, offset, length: needle.length })
      offset = normalized.indexOf(needle, offset + 1)
    }
  }
  matches.sort((left, right) => left.offset - right.offset || right.length - left.length || left.playerId.localeCompare(right.playerId))
  const usedOffsets = new Set<number>()
  return matches.flatMap(match => {
    if (usedOffsets.has(match.offset)) return []
    usedOffsets.add(match.offset)
    return [{ start: starts[match.offset]!, end: ends[match.offset + match.length - 1]! }]
  })
}
function chatText(content: string, mentions: readonly ChatMentionDto[] = []) {
  const ranges = resolvedMentionRanges(content, mentions)
  const rendered: ReactNode[] = []
  let cursor = 0
  ranges.forEach((range, index) => {
    if (cursor < range.start) rendered.push(...linkChatText(content.slice(cursor, range.start)))
    rendered.push(<strong className="chat-inline-mention" key={`mention-${index}`}>{content.slice(range.start, range.end)}</strong>)
    cursor = range.end
  })
  if (cursor < content.length || !rendered.length) rendered.push(...linkChatText(content.slice(cursor)))
  return rendered
}

const orderMessages = (items: ChatMessageDto[]) => items.sort((a, b) => {
  if (a.id.startsWith('optimistic:')) return b.id.startsWith('optimistic:') ? a.createdAt.localeCompare(b.createdAt) : 1
  if (b.id.startsWith('optimistic:')) return -1
  if (a.submissionOrder !== null && b.submissionOrder !== null) {
    const left = BigInt(a.submissionOrder), right = BigInt(b.submissionOrder)
    if (left !== right) return left < right ? -1 : 1
  }
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
})

function mergeChatMessagesStable(current: readonly ChatMessageDto[], incoming: readonly ChatMessageDto[]) {
  const byId = new Map(incoming.map(message => [message.id, message]))
  const byIntent = new Map(incoming.filter(message => message.clientIntentKey).map(message => [message.clientIntentKey, message]))
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
  return next
}

function ChatPanel({ playerId, playerDisplayName = 'Vous', playerElementKey = null, isCollapsed, onToggle, onOpenPlayers, onOpenProfile, onRefreshScopes, connectedCount = null, directMessageIntent = null, onDirectMessageIntentConsumed = () => undefined }: Props) {
  const api = getGameApiClient().chat
  const [activeTab, setActiveTab] = useState<'chat' | 'direct'>('chat')
  const [directUnread, setDirectUnread] = useState(0)
  const [localDirectIntent, setLocalDirectIntent] = useState<DirectMessageOpenIntent | null>(null)
  const [directResetToken, setDirectResetToken] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageDto[]>([])
  const [cursor, setCursor] = useState<{ createdAt: string; id: string } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [unread, setUnread] = useState(0)
  const [newCount, setNewCount] = useState(0)
  const [draft, setDraft] = useState('')
  const [reply, setReply] = useState<ChatMessageDto | null>(null)
  const [mentions, setMentions] = useState<ChatMentionDto[]>([])
  const [suggestions, setSuggestions] = useState<{ id: string; displayName: string; elementKey: string | null }[]>([])
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [commandPending, setCommandPending] = useState(false)
  const [ambiguousIntents, setAmbiguousIntents] = useState<Intent[]>([])
  const [failedIntents, setFailedIntents] = useState<FailedIntent[]>([])
  const [failedOverlayVisible, setFailedOverlayVisible] = useState(true)
  const [ambiguousOverlayVisible, setAmbiguousOverlayVisible] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [scrollbarAtBottom, setScrollbarAtBottom] = useState(true)
  const [composerExpanded, setComposerExpanded] = useState(false)
  const [pacingNow, setPacingNow] = useState(() => Date.now())
  const [burstLockedUntil, setBurstLockedUntil] = useState(0)
  const [transportLockedUntil, setTransportLockedUntil] = useState(0)
  const [transportBurstPending, setTransportBurstPending] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [suppressedHoverId, setSuppressedHoverId] = useState<string | null>(null)
  const [hidden, setHidden] = useState<string[]>(() => { try { return JSON.parse(sessionStorage.getItem(`chat.hidden.${playerId}`) ?? '[]') as string[] } catch { return [] } })
  const [revealed, setRevealed] = useState<string[]>([])
  const generation = useRef<number | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const readId = useRef<string | null>(null)
  const olderBusy = useRef(false)
  const prepend = useRef<{ top: number; height: number } | null>(null)
  const searchVersion = useRef(0)
  const lastRenderedId = useRef<string | null>(null)
  const messagesRef = useRef<ChatMessageDto[]>([])
  const visibleMessageIds = useRef<string[]>([])
  const deferredLatest = useRef(false)
  const unseenIds = useRef(new Set<string>())
  const initialScrollPending = useRef(true)
  const composer = useRef<HTMLTextAreaElement>(null)
  const copyFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pacingAttempts = useRef<PacingAttempt[]>([])
  const transportTail = useRef<Promise<void>>(Promise.resolve())
  const lastNewTransportStartAt = useRef<number | null>(null)
  const transportGeneration = useRef(0)
  const chatActive = !isCollapsed && activeTab === 'chat'
  const wasChatActive = useRef(chatActive)
  const resolvedDirectIntent = directMessageIntent ?? localDirectIntent

  // oxlint-disable-next-line react/set-state-in-effect -- a GameShell deep-link deliberately activates the MP tab
  useEffect(() => { if (directMessageIntent) setActiveTab('direct') }, [directMessageIntent])
  const openDirectMessage = (player: NonNullable<ChatMessageDto['author']>) => {
    const target: DirectMessagePlayerDto = { id: player.id, displayName: player.displayName, elementKey: player.elementKey && player.elementKey in elementColors ? player.elementKey as DirectMessagePlayerDto['elementKey'] : null }
    setLocalDirectIntent({ playerId: player.id, token: crypto.randomUUID(), player: target }); setActiveTab('direct')
  }

  useEffect(() => () => { if (copyFeedbackTimer.current) clearTimeout(copyFeedbackTimer.current) }, [])
  useEffect(() => {
    pacingAttempts.current = []; transportGeneration.current += 1; transportTail.current = Promise.resolve(); lastNewTransportStartAt.current = null
    // oxlint-disable-next-line react/set-state-in-effect -- changing Player invalidates the previous account's local pacing window
    setBurstLockedUntil(0); setTransportLockedUntil(0); setTransportBurstPending(false); setPacingNow(Date.now())
  }, [playerId])
  const effectiveBurstLockedUntil = Math.max(burstLockedUntil, transportLockedUntil)
  const burstLocked = transportBurstPending || pacingNow < effectiveBurstLockedUntil
  useEffect(() => {
    if (transportBurstPending || !burstLocked) return
    const timer = window.setTimeout(() => setPacingNow(Date.now()), Math.max(0, effectiveBurstLockedUntil - Date.now()))
    return () => window.clearTimeout(timer)
  }, [burstLocked, effectiveBurstLockedUntil, transportBurstPending])
  useLayoutEffect(() => {
    if (!composer.current) return
    composer.current.style.height = '0px'
    const height = Math.min(Math.max(composer.current.scrollHeight, 42), 154)
    composer.current.style.height = `${height}px`
    composer.current.style.overflowY = composer.current.scrollHeight > 154 ? 'auto' : 'hidden'
    setComposerExpanded(height > 42)
  }, [draft])

  const adoptGeneration = useCallback((value: number, snapshot: ChatMessageDto[], nextCursor: { createdAt: string; id: string } | null, isLoaded: boolean, nextUnread = 0) => {
    generation.current = value
    messagesRef.current = snapshot
    setMessages(snapshot); setCursor(nextCursor); setLoaded(isLoaded); setUnread(nextUnread); setNewCount(0)
    readId.current = null; unseenIds.current.clear(); visibleMessageIds.current = snapshot.filter(item => !item.id.startsWith('optimistic:')).map(item => item.id); deferredLatest.current = false; atBottom.current = true; setScrollbarAtBottom(true); prepend.current = null; lastRenderedId.current = null
    initialScrollPending.current = true
    setAmbiguousIntents([])
  }, [])
  const unreadNow = useCallback(async () => {
    const value = await api.unread()
    if (generation.current !== null && value.generation < generation.current) return
    if (generation.current !== null && value.generation !== generation.current) {
      adoptGeneration(value.generation, [], null, false, value.unreadCount)
    } else setUnread(value.unreadCount)
  }, [adoptGeneration, api])
  const messagesNow = useCallback(async (initial: boolean) => {
    const page = await api.messages()
    if (generation.current !== null && page.generation < generation.current) return
    const changed = generation.current !== null && generation.current !== page.generation
    if (changed) {
      adoptGeneration(page.generation, page.messages, page.nextCursor, true)
      visibleMessageIds.current = page.visibleMessageIds ?? page.messages.map(item => item.id)
      return
    }
    generation.current = page.generation
    visibleMessageIds.current = page.visibleMessageIds ?? page.messages.map(item => item.id)
    const current = messagesRef.current
    const previous = new Set(current.filter(item => !item.id.startsWith('optimistic:')).map(item => item.id))
    const fresh = initial ? [] : page.messages.filter(item => !previous.has(item.id) && item.author?.id !== playerId)
    const updates = new Map(page.messages.map(item => [item.id, item]))
    const byIntent = new Map(page.messages.filter(item => item.clientIntentKey).map(item => [item.clientIntentKey, item]))
    if (byIntent.size) {
      setAmbiguousIntents(items => items.filter(item => !byIntent.has(item.key)))
      setFailedIntents(items => items.filter(item => !byIntent.has(item.key)))
    }
    const retain = (item: ChatMessageDto) => item.id.startsWith('optimistic:') ? byIntent.get(item.clientIntentKey) ?? item : updates.get(item.id) ?? item
    const newlySeen = fresh.filter(item => !unseenIds.current.has(item.id))
    if (newlySeen.length && !atBottom.current) setNewCount(count => count + newlySeen.length)
    if (!initial && !atBottom.current && current.length >= CHAT_VISIBLE_MESSAGE_LIMIT) {
      newlySeen.forEach(item => unseenIds.current.add(item.id))
      deferredLatest.current = true
      const next = current.map(retain).filter((item, index, all) => all.findIndex(other => other.id === item.id) === index)
      messagesRef.current = next
      setMessages(next)
      return
    }
    const next = (initial ? orderMessages([...page.messages, ...current.filter(item => item.id.startsWith('optimistic:') && !byIntent.has(item.clientIntentKey))]) : mergeChatMessagesStable(current.map(retain), page.messages)).slice(-CHAT_VISIBLE_MESSAGE_LIMIT)
    if (initial) { deferredLatest.current = false; unseenIds.current.clear(); setNewCount(0) }
    messagesRef.current = next
    setMessages(next)
    if (initial) { initialScrollPending.current = true; atBottom.current = false; setScrollbarAtBottom(true); setCursor(page.nextCursor); setLoaded(true) }
  }, [adoptGeneration, api, playerId])

  const updatesNow = useCallback(async () => {
    if (typeof api.updates !== 'function') return messagesNow(false)
    if (generation.current === null) return messagesNow(true)
    const anchor = [...messagesRef.current].reverse().find(item => !item.id.startsWith('optimistic:'))
    const update = await api.updates(generation.current, anchor ? { createdAt: anchor.createdAt, id: anchor.id } : null, visibleMessageIds.current)
    if (update.generation < generation.current) return
    if (update.reset) return messagesNow(true)
    if (!update.messages.length && !update.changes.length) return
    visibleMessageIds.current = update.visibleMessageIds ?? [...new Set([...visibleMessageIds.current, ...update.messages.map(item => item.id)])].slice(-CHAT_VISIBLE_MESSAGE_LIMIT)
    const current = messagesRef.current
    const known = new Set(current.map(item => item.id))
    const delivered = [...new Map([...update.messages, ...update.changes].map(item => [item.id, item])).values()]
    const incoming = new Map(delivered.map(item => [item.id, item]))
    const byIntent = new Map(delivered.filter(item => item.clientIntentKey).map(item => [item.clientIntentKey, item]))
    if (byIntent.size) {
      setAmbiguousIntents(items => items.filter(item => !byIntent.has(item.key)))
      setFailedIntents(items => items.filter(item => !byIntent.has(item.key)))
      setError(null)
    }
    const deleted = new Set([...update.messages, ...update.changes].filter(item => item.deletionState !== 'ACTIVE').map(item => item.id))
    const retain = (item: ChatMessageDto) => {
      const next = item.id.startsWith('optimistic:') ? byIntent.get(item.clientIntentKey) ?? item : incoming.get(item.id) ?? item
      return next.replyToMessageId && deleted.has(next.replyToMessageId) ? { ...next, replyPreview: 'Message supprimé' } : next
    }
    const fresh = delivered.filter(item => !known.has(item.id) && !current.some(old => old.clientIntentKey && old.clientIntentKey === item.clientIntentKey))
    const newlySeen = fresh.filter(item => item.author?.id !== playerId && !unseenIds.current.has(item.id))
    if (newlySeen.length && !atBottom.current && !initialScrollPending.current) setNewCount(value => value + newlySeen.length)
    if (!atBottom.current && !initialScrollPending.current && current.length >= CHAT_VISIBLE_MESSAGE_LIMIT && fresh.length) {
      newlySeen.forEach(item => unseenIds.current.add(item.id))
      deferredLatest.current = true
      const retained = current.map(retain).filter((item, index, all) => all.findIndex(other => other.id === item.id) === index)
      messagesRef.current = retained; setMessages(retained)
      return
    }
    const merged = mergeChatMessagesStable(current.map(retain), fresh).slice(-CHAT_VISIBLE_MESSAGE_LIMIT)
    messagesRef.current = merged; setMessages(merged)
  }, [api, messagesNow, playerId])

  // oxlint-disable-next-line react/set-state-in-effect -- reopen state and local scroll must settle before the first visible paint
  useLayoutEffect(() => {
    const reopening = !wasChatActive.current && chatActive
    wasChatActive.current = chatActive
    if (!reopening) return
    initialScrollPending.current = true; atBottom.current = true; deferredLatest.current = false; unseenIds.current.clear()
    setScrollbarAtBottom(true); setNewCount(0)
    if (list.current) list.current.scrollTop = list.current.scrollHeight
    void messagesNow(true).catch(cause => setError(cause instanceof Error ? cause.message : 'Chat indisponible.'))
  }, [chatActive, messagesNow])

  useEffect(() => {
    let cancelled = false, busy = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      if (cancelled || busy || document.hidden) return
      busy = true
      try { if (!chatActive) await unreadNow(); else if (!loaded) await messagesNow(true); else await updatesNow() }
      catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Chat indisponible.') }
      finally { busy = false }
    }
    const runAndSchedule = async () => {
      if (cancelled || busy || document.hidden) return
      const startedAt = performance.now()
      await tick()
      if (!cancelled && !document.hidden) timer = setTimeout(runAndSchedule, Math.max(0, (chatActive ? 350 : 5000) - (performance.now() - startedAt)))
    }
    const visible = () => { clearTimeout(timer); if (!document.hidden) void runAndSchedule() }
    void runAndSchedule()
    document.addEventListener('visibilitychange', visible); window.addEventListener('focus', visible)
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', visible) }
  }, [chatActive, loaded, messagesNow, playerId, unreadNow, updatesNow])

  useEffect(() => {
    if (!chatActive || document.hidden || !atBottom.current || !messages.length) return
    const id = [...messages].reverse().find(message => !message.id.startsWith('optimistic:'))?.id
    if (!id) return
    if (readId.current === id) return
    readId.current = id
    void api.read(id).then(() => setUnread(0)).catch(() => { readId.current = null })
  }, [api, chatActive, messages])

  useLayoutEffect(() => {
    if (!list.current) return
    messagesRef.current = messages
    if (initialScrollPending.current && messages.length) { list.current.scrollTop = list.current.scrollHeight; initialScrollPending.current = false; atBottom.current = true; setScrollbarAtBottom(true) }
    else if (prepend.current) { list.current.scrollTop = prepend.current.top + list.current.scrollHeight - prepend.current.height; prepend.current = null }
    else if (atBottom.current && messages.at(-1)?.id !== lastRenderedId.current) { list.current.scrollTop = list.current.scrollHeight; setScrollbarAtBottom(true) }
    lastRenderedId.current = messages.at(-1)?.id ?? null
  }, [messages])

  const loadOlder = async () => {
    if (!list.current || !cursor || olderBusy.current) return
    olderBusy.current = true
    const anchor = { top: list.current.scrollTop, height: list.current.scrollHeight }
    try {
      const page = await api.messages(cursor)
      if (generation.current !== null && page.generation !== generation.current) { await messagesNow(true); return }
      prepend.current = anchor
      visibleMessageIds.current = page.visibleMessageIds ?? [...new Set([...visibleMessageIds.current, ...page.messages.map(item => item.id)])].slice(-CHAT_VISIBLE_MESSAGE_LIMIT)
      setMessages(current => orderMessages([...page.messages.filter(item => !current.some(old => old.id === item.id)), ...current]).slice(0, CHAT_VISIBLE_MESSAGE_LIMIT))
      setCursor(page.nextCursor)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Historique indisponible.') }
    finally { olderBusy.current = false }
  }
  const markRecent = () => { const id = [...messagesRef.current].reverse().find(item => !item.id.startsWith('optimistic:'))?.id; if (id && !document.hidden && chatActive && readId.current !== id) { readId.current = id; void api.read(id).then(() => setUnread(0)).catch(() => { readId.current = null }) } }
  const scrollBottom = () => { if (deferredLatest.current) { void messagesNow(true).catch(cause => setError(cause instanceof Error ? cause.message : 'Chat indisponible.')); return } if (list.current) list.current.scrollTop = list.current.scrollHeight; atBottom.current = true; setScrollbarAtBottom(true); setNewCount(0); markRecent() }
  const onScroll = () => { if (!list.current || initialScrollPending.current) return; const remaining = list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight; atBottom.current = remaining < 80; setScrollbarAtBottom(remaining <= 2); if (atBottom.current) { if (deferredLatest.current) scrollBottom(); else { setNewCount(0); markRecent() } } if (list.current.scrollTop < 90) void loadOlder() }
  useEffect(() => {
    const match = draft.match(/(?:^|\s)@([^\s@]*)$/u), version = ++searchVersion.current
    if (!match) return
    const timer = setTimeout(() => { void api.mentions(match[1]!).then(value => { if (version === searchVersion.current) { setSuggestions(value.players.slice(0, 5)); setSuggestionIndex(0) } }).catch(() => { if (version === searchVersion.current) setSuggestions([]) }) }, match[1] ? 220 : 0)
    return () => clearTimeout(timer)
  }, [api, draft])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuId(null); setReportId(null); setSuggestions([]) } }
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return
      if (!event.target.closest('.chat-message-menu, .chat-message-menu-button')) setMenuId(null)
      if (!event.target.closest('.chat-report-confirm, .chat-message-actions')) setReportId(null)
    }
    window.addEventListener('keydown', escape); document.addEventListener('pointerdown', outside)
    return () => { window.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside) }
  }, [])

  const submitIntent = async (next: Intent) => {
    const isCommand = next.content.startsWith('!')
    let burstOutcomeUntil: number | null = null
    if (isCommand) setCommandPending(true); setError(null)
    try {
      const result = await api.send(next.content, next.key, next.replyId, next.mentions)
      setAmbiguousIntents(current => current.filter(item => item.key !== next.key))
      setFailedIntents(current => current.filter(item => item.key !== next.key))
      if (result.cleared) {
        burstOutcomeUntil = 0
        pacingAttempts.current = pacingAttempts.current.filter(attempt => attempt.key !== next.key); setBurstLockedUntil(pacingProjection(pacingAttempts.current).burstLockedUntil); setPacingNow(Date.now())
        const previousGeneration = generation.current
        if (previousGeneration === null || result.generation > previousGeneration) adoptGeneration(result.generation, [], null, true)
        else setMessages(current => current.filter(item => item.clientIntentKey !== next.key))
        if (previousGeneration === null || result.generation >= previousGeneration) {
          void messagesNow(true).catch(cause => setError(cause instanceof Error ? cause.message : 'Chat indisponible.'))
        }
      } else {
        const serverAcceptedAt = new Date(result.message.createdAt).getTime()
        burstOutcomeUntil = Math.abs(serverAcceptedAt - Date.now()) <= 60_000 ? serverAcceptedAt + CHAT_BURST_LOCK_MS : Date.now() + CHAT_BURST_LOCK_MS
        const previousGeneration = generation.current
        if (previousGeneration !== null && result.generation > previousGeneration) {
          const confirmed = orderMessages([result.message, ...result.results].filter((item, index, all) => all.findIndex(other => other.id === item.id) === index)).slice(-CHAT_VISIBLE_MESSAGE_LIMIT)
          adoptGeneration(result.generation, confirmed, null, true)
        } else {
          if (previousGeneration === null) generation.current = result.generation
          setMessages(current => {
            const confirmedMessage = { ...result.message, clientIntentKey: next.key }
            const confirmed = result.generation === generation.current ? [confirmedMessage, ...result.results] : []
            const merged = mergeChatMessagesStable(current, confirmed).slice(-CHAT_VISIBLE_MESSAGE_LIMIT)
            messagesRef.current = merged
            return merged
          })
        }
        if (result.refreshScopes.length) void onRefreshScopes(result.refreshScopes).catch(() => setFeedback('Certaines données se mettront à jour au prochain chargement.'))
        if (result.dailyChallengeCompleted) setFeedback('Défi Messages terminé !')
      }
    } catch (cause) {
      if (messagesRef.current.some(item => !item.id.startsWith('optimistic:') && item.clientIntentKey === next.key)) return
      const deterministicRejection = cause instanceof ApiError && cause.status !== null && cause.status < 500
      if (deterministicRejection) { burstOutcomeUntil = 0; pacingAttempts.current = pacingAttempts.current.filter(attempt => attempt.key !== next.key); setBurstLockedUntil(pacingProjection(pacingAttempts.current).burstLockedUntil); setPacingNow(Date.now()) }
      if (cause instanceof ApiError && cause.code === 'CHAT_PACING_LIMIT') {
        const retained = messagesRef.current.filter(item => item.clientIntentKey !== next.key)
        messagesRef.current = retained; setMessages(retained); setError(null)
        setAmbiguousIntents(current => current.filter(item => item.key !== next.key)); setFailedIntents(current => current.filter(item => item.key !== next.key))
        setDraft(current => current || next.content)
        setReply(current => current ?? messagesRef.current.find(item => item.id === next.replyId) ?? null)
        setMentions(current => current.length ? current : next.mentions)
        return
      }
      setError(cause instanceof Error ? cause.message : 'Envoi indisponible.')
      if (deterministicRejection) {
        setFailedOverlayVisible(true)
        setMessages(current => current.filter(item => item.clientIntentKey !== next.key))
        setAmbiguousIntents(current => current.filter(item => item.key !== next.key))
        setFailedIntents(current => current.some(item => item.key === next.key) ? current : [...current, { ...next, reason: cause.message }])
      } else {
        setAmbiguousOverlayVisible(true)
        setFailedIntents(current => current.filter(item => item.key !== next.key))
        setAmbiguousIntents(current => current.some(item => item.key === next.key) ? current : [...current, next])
      }
    } finally {
      if (next.burstTrigger) {
        setTransportBurstPending(false)
        setTransportLockedUntil(current => burstOutcomeUntil === null ? Math.max(current, Date.now() + CHAT_BURST_LOCK_MS) : Math.max(current, burstOutcomeUntil))
        setPacingNow(Date.now())
      }
      if (isCommand) setCommandPending(false)
    }
  }

  const enqueueTransport = (next: Intent, isNewIntent: boolean) => {
    const generationAtEnqueue = transportGeneration.current
    if (next.burstTrigger) setTransportBurstPending(true)
    const run = async () => {
      if (generationAtEnqueue !== transportGeneration.current) return
      if (isNewIntent && lastNewTransportStartAt.current !== null) {
        const remaining = CHAT_MIN_SUBMISSION_INTERVAL_MS - (Date.now() - lastNewTransportStartAt.current)
        if (remaining > 0) await new Promise<void>(resolve => window.setTimeout(resolve, remaining))
      }
      if (generationAtEnqueue !== transportGeneration.current) return
      if (isNewIntent) lastNewTransportStartAt.current = Date.now()
      await submitIntent(next)
    }
    const queued = transportTail.current.then(run, run)
    transportTail.current = queued.then(() => undefined, () => undefined)
    return queued
  }

  const send = (event: FormEvent) => {
    event.preventDefault()
    if ((draft.trim().startsWith('!') && commandPending) || !draft.trim() || Array.from(draft.trim()).length > 500) return
    const submittedAt = Date.now(), state = pacingProjection(pacingAttempts.current)
    if (submittedAt < state.burstLockedUntil || state.lastAcceptedAt !== null && submittedAt - state.lastAcceptedAt < CHAT_MIN_SUBMISSION_INTERVAL_MS) return
    const key = crypto.randomUUID()
    pacingAttempts.current = [...pacingAttempts.current, { key, submittedAt }].slice(-32)
    const nextPacing = pacingProjection(pacingAttempts.current)
    const next: Intent = { key, content: draft.trim(), replyId: reply?.id ?? null, mentions: mentions.filter(item => draft.includes(`@${item.displayName}`)), burstTrigger: nextPacing.burstLockedUntil > submittedAt }
    setBurstLockedUntil(nextPacing.burstLockedUntil)
    setPacingNow(submittedAt)
    const provisional: ChatMessageDto = { id: `optimistic:${next.key}`, clientIntentKey: next.key, author: { id: playerId, displayName: playerDisplayName, elementKey: playerElementKey }, authorLabel: playerDisplayName, sourceChannel: 'INTERNAL_CHAT', messageType: next.content.startsWith('!') ? 'COMMAND' : 'PLAYER', content: next.content, createdAt: new Date().toISOString(), submissionOrder: null, deletedAt: null, deletionState: 'ACTIVE', replyToMessageId: next.replyId, replyPreview: reply?.content ?? null, mentionedMe: false, repliedToMe: false }
    setDraft(''); setReply(null); setSuggestions([]); setMentions([]); setError(null)
    messagesRef.current = [...messagesRef.current, provisional].slice(-CHAT_VISIBLE_MESSAGE_LIMIT)
    setMessages(messagesRef.current)
    requestAnimationFrame(() => { if (atBottom.current && list.current) { list.current.scrollTop = list.current.scrollHeight; setScrollbarAtBottom(true) } })
    queueMicrotask(() => void enqueueTransport(next, true))
  }

  const focusComposer = () => requestAnimationFrame(() => { composer.current?.focus(); composer.current?.setSelectionRange(composer.current.value.length, composer.current.value.length) })
  const recoverFailed = () => {
    const failed = failedIntents.at(-1)
    if (!failed || draft) return
    setDraft(failed.content)
    setReply(messagesRef.current.find(item => item.id === failed.replyId) ?? null)
    setMentions(failed.mentions)
    setFailedIntents(current => current.filter(item => item.key !== failed.key))
    setError(null)
    focusComposer()
  }

  const remove = async (id: string) => {
    setMenuId(null)
    const before = new Map(messagesRef.current.filter(item => item.id === id || item.replyToMessageId === id).map(item => [item.id, item]))
    const changed = new Map<string, ChatMessageDto>()
    const optimistic = messagesRef.current.map(message => {
      if (message.id !== id && message.replyToMessageId !== id) return message
      const next = message.id === id ? { ...message, deletionState: 'AUTHOR' as const, content: null } : { ...message, replyPreview: 'Message supprimé' }
      changed.set(message.id, next)
      return next
    })
    messagesRef.current = optimistic; setMessages(optimistic)
    try { await api.remove(id) }
    catch (cause) {
      const restored = messagesRef.current.map(message => message === changed.get(message.id) ? before.get(message.id)! : message)
      messagesRef.current = restored; setMessages(restored)
      setError(cause instanceof Error ? cause.message : 'Suppression indisponible.')
    }
  }
  const report = async (id: string) => { try { await api.report(id); setReportId(null); setFeedback('Signalement envoyé.'); setTimeout(() => setFeedback(current => current === 'Signalement envoyé.' ? null : current), 3000) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Signalement indisponible.') } }
  const hide = (id: string) => { const next = hidden.includes(id) ? hidden.filter(item => item !== id) : [...hidden, id]; setHidden(next); sessionStorage.setItem(`chat.hidden.${playerId}`, JSON.stringify(next)); setMenuId(null); (document.activeElement as HTMLElement | null)?.blur() }
  const mention = (person: { id: string; displayName: string }) => { setDraft(value => value.replace(/@[^\s@]*$/u, `@${person.displayName} `)); setMentions(value => [...value.filter(item => item.playerId !== person.id), { playerId: person.id, displayName: person.displayName }]); setSuggestions([]); focusComposer() }
  const copy = async (message: ChatMessageDto) => { try { await navigator.clipboard.writeText(message.content ?? ''); if (copyFeedbackTimer.current) clearTimeout(copyFeedbackTimer.current); setFeedback('Message copié.'); copyFeedbackTimer.current = setTimeout(() => { setFeedback(current => current === 'Message copié.' ? null : current); copyFeedbackTimer.current = null }, 2000) } catch { setError('Copie indisponible.') } }
  const characterCount = Array.from(draft).length
  const showCharacterCount = characterCount >= 450

  return <aside className={`chat-panel ${isCollapsed ? 'collapsed' : 'panel'}`} aria-label={isCollapsed ? 'Communauté repliée' : 'Communauté'}>
    {isCollapsed ? <button type="button" className="chat-expand-button" onClick={onToggle} aria-label={`Afficher la communauté, ${unread} messages Chat et ${directUnread} messages privés non lus`}><span aria-hidden="true">‹</span><strong>C</strong>{unread > 0 && <span className="unread-count">{unread > 99 ? '99+' : unread}</span>}<strong>M</strong>{directUnread > 0 && <span className="unread-count direct">{directUnread > 99 ? '99+' : directUnread}</span>}</button> : <><div className="chat-header"><div><span className="eyebrow">Communauté</span><h2>{activeTab === 'chat' ? 'Chat global' : 'Messages privés'}</h2></div><button type="button" className="icon-button" onClick={onToggle} aria-label="Replier la communauté"><span className="icon-glyph">›</span></button></div>
    <div className="community-tabs" role="tablist" aria-label="Communauté"><button type="button" role="tab" aria-selected={activeTab === 'chat'} onClick={() => setActiveTab('chat')}>Chat{unread > 0 && <span className="community-tab-badge">{unread > 99 ? '99+' : unread}</span>}</button><button type="button" role="tab" aria-selected={activeTab === 'direct'} onClick={() => { setActiveTab('direct'); setDirectResetToken(crypto.randomUUID()) }}>MP{directUnread > 0 && <span className="community-tab-badge">{directUnread > 99 ? '99+' : directUnread}</span>}</button></div></>}
    <section className="community-pane chat-community-pane" hidden={isCollapsed || activeTab !== 'chat'} aria-label="Chat global">
    <button type="button" className="chat-presence" onClick={onOpenPlayers}><span className="status-dot" />{connectedCount === null ? 'Joueurs connectés' : `${connectedCount} joueur${connectedCount > 1 ? 's' : ''} connecté${connectedCount > 1 ? 's' : ''}`}<span aria-hidden="true">›</span></button>
    <div className={`message-list${scrollbarAtBottom ? ' chat-scrollbar-hidden' : ''}`} ref={list} onScroll={onScroll} aria-live="off">{!loaded && <p className="chat-status">Chargement du Chat…</p>}{loaded && !messages.length && <p className="chat-status">Aucun message pour le moment.</p>}
      {messages.map(message => {
        const own = message.author?.id === playerId, game = message.messageType === 'GAME_RESULT' || message.messageType === 'SYSTEM'
        const masked = !!message.author && hidden.includes(message.author.id) && !revealed.includes(message.id)
        const optimistic = message.id.startsWith('optimistic:')
        const canReply = !optimistic && message.deletionState === 'ACTIVE'
        const canDelete = !optimistic && own && message.deletionState === 'ACTIVE'
        const canMention = !optimistic && !own && !game && !!message.author
        const canReport = canMention && message.deletionState === 'ACTIVE'
        const canMask = canMention
        const canAct = canReply || canDelete || canMention || canReport || canMask
        const authorColor = message.author?.elementKey && message.author.elementKey in elementColors ? elementColors[message.author.elementKey as keyof typeof elementColors] : '#b794ff'
        const authorStyle = !game && message.author ? { '--chat-author-color': authorColor } as CSSProperties : undefined
        const replyTo = () => { setReply(message); setMenuId(null); focusComposer() }
        const mentionAuthor = () => { if (!message.author) return; setDraft(value => `${value}${value && !value.endsWith(' ') ? ' ' : ''}@${message.author!.displayName} `); setMentions(value => [...value, { playerId: message.author!.id, displayName: message.author!.displayName }]); setMenuId(null); focusComposer() }
        return <article className={`chat-message${message.mentionedMe || message.repliedToMe ? ' chat-message-mentioned' : ''}${optimistic ? ' chat-message-optimistic' : ''}`} style={authorStyle} data-message-id={message.id} data-command={optimistic && message.messageType === 'COMMAND' ? 'true' : undefined} data-hover-suppressed={suppressedHoverId === message.id ? 'true' : undefined} data-report-open={reportId === message.id ? 'true' : undefined} onPointerLeave={() => setSuppressedHoverId(current => current === message.id ? null : current)} key={message.id}>
          {game ? <div className="message-avatar chat-game-avatar" aria-hidden="true">✦</div> : <button type="button" className="message-avatar chat-avatar-button" aria-label={`Profil de ${message.authorLabel}`} onClick={() => message.author && onOpenProfile(message.author.id)}>{message.authorLabel?.slice(0, 1).toLocaleUpperCase('fr-FR')}</button>}
          <div className="message-content"><div className="message-meta">{game ? <strong className="chat-game-label">GachaImpact</strong> : <button type="button" className="chat-author-button" onClick={() => message.author && onOpenProfile(message.author.id)}>{message.authorLabel}</button>}<time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</time></div>
            {message.replyToMessageId && <div className="chat-reply-preview">↳ {message.replyPreview ?? 'Message supprimé'}</div>}
            <p>{masked ? <>Message masqué — <button type="button" onClick={() => setRevealed(value => [...value, message.id])}>Afficher</button></> : message.deletionState === 'AUTHOR' ? 'Message supprimé' : message.deletionState === 'MODERATION' ? 'Message supprimé par la modération' : chatText(message.content ?? '', message.resolvedMentions)}</p>
            {canAct && <><div className="chat-message-actions" aria-label={`Actions pour le message de ${message.authorLabel}`} onClickCapture={event => { if (event.detail) { setSuppressedHoverId(message.id); (document.activeElement as HTMLElement | null)?.blur() } }}>
              {canReport && <button type="button" title="Signaler" aria-label="Signaler" onClick={() => setReportId(message.id)}>⚑</button>}
              {canMask && <button type="button" title={hidden.includes(message.author!.id) ? 'Démasquer ce joueur' : 'Masquer ce joueur'} aria-label={hidden.includes(message.author!.id) ? 'Démasquer ce joueur' : 'Masquer ce joueur'} onClick={() => hide(message.author!.id)}>◌</button>}
              {message.content && <button type="button" title="Copier le message" aria-label="Copier le message" onClick={() => void copy(message)}>⧉</button>}
              {canMention && <button type="button" title="Message privé" aria-label="Message privé" onClick={() => openDirectMessage(message.author!)}>✉</button>}
              {canMention && <button type="button" title="Mentionner" aria-label="Mentionner" onClick={mentionAuthor}>@</button>}
              {canReply && <button type="button" title="Répondre" aria-label="Répondre" onClick={replyTo}>↩</button>}
              {canDelete && <button type="button" title="Supprimer" aria-label="Supprimer" onClick={() => void remove(message.id)}>×</button>}
            </div>
            <button type="button" className="chat-message-menu-button" aria-label={`Actions pour le message de ${message.authorLabel}`} aria-expanded={menuId === message.id} onClick={() => setMenuId(value => value === message.id ? null : message.id)}>⋯</button>
            {reportId === message.id && <div className="chat-report-confirm" role="dialog" aria-label="Confirmer le signalement"><p>Signaler ce message ?</p><button type="button" onClick={() => void report(message.id)}>Confirmer</button><button type="button" onClick={() => setReportId(null)}>Annuler</button></div>}
            {menuId === message.id && <div className="chat-message-menu" role="menu">{canReport && <button type="button" role="menuitem" onClick={() => { setReportId(message.id); setMenuId(null) }}>Signaler</button>}{canMask && <button type="button" role="menuitem" onClick={() => hide(message.author!.id)}>{hidden.includes(message.author!.id) ? 'Démasquer ce joueur' : 'Masquer les messages de ce joueur'}</button>}{message.content && <button type="button" role="menuitem" onClick={() => { void copy(message); setMenuId(null) }}>Copier le message</button>}{canMention && <button type="button" role="menuitem" onClick={() => { openDirectMessage(message.author!); setMenuId(null) }}>Message privé</button>}{canMention && <button type="button" role="menuitem" onClick={mentionAuthor}>Mentionner</button>}{canReply && <button type="button" role="menuitem" onClick={replyTo}>Répondre</button>}{canDelete && <button type="button" role="menuitem" onClick={() => void remove(message.id)}>Supprimer</button>}</div>}</>}
          </div>
        </article>
      })}</div>
    {newCount > 0 && <button type="button" className="chat-new-messages" onClick={scrollBottom}>{newCount} nouveau{newCount > 1 ? 'x' : ''} message{newCount > 1 ? 's' : ''} ↓</button>}
    <div className="chat-composer-wrap">
      <form className="chat-composer" autoComplete="off" onSubmit={send}>
        <div className="chat-composer-field">
          {!!suggestions.length && <div className="chat-mention-suggestions" role="listbox" aria-label="Joueurs à mentionner">{suggestions.map((person, index) => <button type="button" role="option" aria-selected={index === suggestionIndex} className={index === suggestionIndex ? 'selected' : undefined} key={person.id} onMouseDown={event => event.preventDefault()} onClick={() => mention(person)}>{person.displayName}</button>)}</div>}
          <div className="chat-composer-accessory">{reply && <div className="chat-composer-reply"><span className="chat-overlay-content">Réponse à {reply.authorLabel}<small>« {reply.deletionState === 'ACTIVE' ? reply.content : 'Message supprimé'} »</small></span><button type="button" className="chat-overlay-close" onClick={() => setReply(null)} aria-label="Fermer la réponse">×</button></div>}
            {!!failedIntents.length && failedOverlayVisible && <div className="chat-status chat-error chat-failed-status" role="alert"><span className="chat-overlay-content" title={`${failedIntents.at(-1)!.reason} — ${failedIntents.at(-1)!.content}`}>{failedIntents.length > 1 ? `${failedIntents.length} envois refusés : ` : 'Envoi refusé : '}{failedIntents.at(-1)!.content}</span><button type="button" disabled={commandPending} onClick={() => void enqueueTransport(failedIntents.at(-1)!, false)}>Réessayer</button><button type="button" disabled={commandPending || !!draft} title={draft ? 'Terminer le brouillon courant pour récupérer ce message' : undefined} onClick={recoverFailed}>Récupérer</button><button type="button" className="chat-overlay-close" aria-label="Fermer le feedback" onClick={() => setFailedOverlayVisible(false)}>×</button></div>}
            {!!ambiguousIntents.length && !failedIntents.length && ambiguousOverlayVisible && <div className="chat-status"><span className="chat-overlay-content">{ambiguousIntents.length === 1 ? 'Envoi non confirmé.' : `${ambiguousIntents.length} envois non confirmés.`}</span><button type="button" disabled={commandPending} onClick={() => void enqueueTransport(ambiguousIntents[0]!, false)}>Réessayer</button><button type="button" className="chat-overlay-close" aria-label="Fermer le feedback" onClick={() => setAmbiguousOverlayVisible(false)}>×</button></div>}
            {error && !ambiguousIntents.length && !failedIntents.length && <p className="chat-status chat-error" role="alert"><span className="chat-overlay-content">{error}</span><button type="button" className="chat-overlay-close" aria-label="Fermer le feedback" onClick={() => setError(null)}>×</button></p>}{feedback && !error && !ambiguousIntents.length && !failedIntents.length && <p className="chat-status" role="status"><span className="chat-overlay-content">{feedback}</span><button type="button" className="chat-overlay-close" aria-label="Fermer le feedback" onClick={() => setFeedback(null)}>×</button></p>}
          </div>
          <label className="sr-only" htmlFor="chat-message">Écrire un message</label><textarea ref={composer} id="chat-message" name="chat-composer-current-message" className={`chat-composer-textarea${composerExpanded ? ' is-expanded' : ''}${showCharacterCount ? ' with-counter' : ''}`} data-autogrow="true" rows={1} autoComplete="off" value={draft} disabled={burstLocked} onChange={event => { const value = Array.from(event.target.value.replace(/[\r\n]+/gu, ' ')).slice(0, 500).join(''); setDraft(value); setSuggestions([]); setMentions(current => current.filter(item => value.includes(`@${item.displayName}`))) }} onKeyDown={event => { if (suggestions.length && ['ArrowDown', 'ArrowUp', 'Tab', 'Escape'].includes(event.key)) { event.preventDefault(); if (event.key === 'ArrowDown') setSuggestionIndex(index => (index + 1) % suggestions.length); else if (event.key === 'ArrowUp') setSuggestionIndex(index => (index - 1 + suggestions.length) % suggestions.length); else if (event.key === 'Tab') mention(suggestions[suggestionIndex]!); else setSuggestions([]); return } if (event.key === 'Enter') { if (suggestions.length) { event.preventDefault(); mention(suggestions[suggestionIndex]!); return } event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} maxLength={1000} placeholder={burstLocked ? 'Spam, veuillez attendre...' : 'Écrire un message…'} />
          {showCharacterCount && <span className="chat-character-count" aria-label={`${500 - characterCount} caractères restants`}>{characterCount - 500}</span>}
          <button type="submit" className="chat-send-button" disabled={burstLocked || !draft.trim() || (draft.trim().startsWith('!') && commandPending)} aria-label="Envoyer le message"><span className="icon-glyph">›</span></button>
        </div>
      </form>
    </div>
    </section>
    <section className="community-pane direct-community-pane" hidden={isCollapsed || activeTab !== 'direct'} aria-label="Messages privés">
      <DirectMessagePanel playerId={playerId} isActive={!isCollapsed && activeTab === 'direct'} intent={resolvedDirectIntent} resetToken={directResetToken} onIntentConsumed={token => { setLocalDirectIntent(current => current?.token === token ? null : current); onDirectMessageIntentConsumed(token) }} onUnreadChange={setDirectUnread} onOpenProfile={onOpenProfile} />
    </section>
  </aside>
}
export default ChatPanel
