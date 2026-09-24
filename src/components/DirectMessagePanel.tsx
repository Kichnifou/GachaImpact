import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { ApiError, getGameApiClient } from '../api/game-api'
import type { DirectConversationDto, DirectMessageDto, DirectMessageHistoryMessageDto, DirectMessagePlayerDto } from '../api/types'
import { directMessageReceiptLabel } from '../direct-messages/receipt-label'
import { useDirectMessageHistory } from '../direct-messages/use-direct-message-history'
import { createOptimisticDirectMessage, useDirectMessages } from '../direct-messages/use-direct-messages'
import { elementLabels } from '../utils/formatters'

export type DirectMessageOpenIntent = Readonly<{ playerId: string; token: string; player?: DirectMessagePlayerDto }>
type View = 'list' | 'archives' | 'conversation' | 'history' | 'new'
type SendIntent = { signature: string; key: string }
type MessageMutationIntent = { kind: 'edit'; messageId: string; content: string; key: string } | { kind: 'delete' | 'restore'; messageId: string; key: string }
type ProvisionalThread = { target: DirectMessagePlayerDto; message: DirectMessageDto; key: string; state: 'SENDING' | 'PENDING' | 'ACCEPTED'; conversationId: string | null; requestId: string | null }

function linkedText(content: string): ReactNode[] {
  return content.split(/(https?:\/\/[^\s]+)/giu).map((part, index) => {
    if (!/^https?:\/\//iu.test(part)) return part
    const candidate = part.replace(/[),.!?;:]+$/u, '')
    try { const url = new URL(candidate); if (url.protocol === 'http:' || url.protocol === 'https:') return <span key={index}><a href={url.href} target="_blank" rel="noopener noreferrer">{candidate}</a>{part.slice(candidate.length)}</span> } catch { /* unsafe or malformed stays escaped text */ }
    return part
  })
}
function usefulDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value), today = new Date()
  return date.toDateString() === today.toDateString() ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}
function Avatar({ player }: { player: DirectMessagePlayerDto }) { return <span className={`dm-avatar ${player.elementKey ?? ''}`} aria-hidden="true">{Array.from(player.displayName.trim())[0]?.toLocaleUpperCase('fr-FR') ?? '✦'}</span> }
const isCoarsePointer = () => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

export default function DirectMessagePanel({ playerId, isActive, intent, resetToken, onIntentConsumed, onUnreadChange, onOpenProfile }: { playerId: string; isActive: boolean; intent: DirectMessageOpenIntent | null; resetToken?: string | null; onIntentConsumed: (token: string) => void; onUnreadChange: (count: number) => void; onOpenProfile: (id: string) => void }) {
  const [view, setView] = useState<View>('list'), [selectedId, setSelectedId] = useState<string | null>(null), [target, setTarget] = useState<DirectMessagePlayerDto | null>(null)
  const [draft, setDraft] = useState(''), [search, setSearch] = useState(''), [candidates, setCandidates] = useState<DirectMessagePlayerDto[]>([])
  const [searchError, setSearchError] = useState(''), [searching, setSearching] = useState(false), [menuOpen, setMenuOpen] = useState(false), [confirmBlock, setConfirmBlock] = useState(false)
  const [newCount, setNewCount] = useState(0), [sendPending, setSendPending] = useState(false), [now, setNow] = useState(() => Date.now()), [scrollbarAtBottom, setScrollbarAtBottom] = useState(true)
  const [provisional, setProvisional] = useState<ProvisionalThread | null>(null)
  const [messageActionsId, setMessageActionsId] = useState<string | null>(null), [editingId, setEditingId] = useState<string | null>(null), [editDraft, setEditDraft] = useState(''), [deleteId, setDeleteId] = useState<string | null>(null)
  const [messageActionPending, setMessageActionPending] = useState<string | null>(null), [messageActionError, setMessageActionError] = useState(''), [retryMutation, setRetryMutation] = useState<MessageMutationIntent | null>(null)
  const [historyQuery, setHistoryQuery] = useState(''), [historyDate, setHistoryDate] = useState(''), [historyHighlight, setHistoryHighlight] = useState<string | null>(null)
  const intentRef = useRef<SendIntent | null>(null), searchVersion = useRef(0), list = useRef<HTMLDivElement>(null), historyList = useRef<HTMLDivElement>(null), composer = useRef<HTMLTextAreaElement>(null), editor = useRef<HTMLDivElement>(null), atBottom = useRef(true), initialScroll = useRef(false), historyInitialScroll = useRef(false), forceBottom = useRef(false), seenIds = useRef(new Set<string>()), prepend = useRef<{ top: number; height: number } | null>(null), historyPrepend = useRef<{ top: number; height: number } | null>(null), liveScrollTop = useRef<number | null>(null), readId = useRef<string | null>(null), sendBusy = useRef(false), readBusy = useRef(false), queuedRead = useRef<{ conversationId: string; messageId: string } | null>(null)
  const model = useDirectMessages(playerId, isActive && view !== 'history', selectedId, view === 'archives', onUnreadChange)
  const history = useDirectMessageHistory(playerId, selectedId, isActive && view === 'history', historyQuery)
  const provisionalConversation: DirectConversationDto | null = provisional ? { id: provisional.conversationId ?? `provisional:${provisional.key}`, other: provisional.target, archived: false, lastMessageAt: provisional.message.createdAt, lastMessage: provisional.message, request: provisional.state === 'PENDING' ? { id: provisional.requestId ?? `provisional-request:${provisional.key}`, state: 'PENDING', senderPlayerId: playerId, retryAfter: null } : null, unreadCount: 0, readReceiptsEnabled: true, canSend: provisional.state === 'ACCEPTED', blockedByMe: false } : null
  const selected = model.selected ?? provisionalConversation
  const renderedMessages = useMemo(() => provisional && !model.messages.some(message => message.id === provisional.message.id || message.clientIntentKey === provisional.key) ? [provisional.message] : model.messages, [model.messages, provisional])
  const latestEvent = renderedMessages.at(-1)
  const latestOwn = latestEvent?.own ? latestEvent : null
  const incomingPending = selected?.request?.state === 'PENDING' && selected.request.senderPlayerId !== playerId
  const outgoingPending = selected?.request?.state === 'PENDING' && selected.request.senderPlayerId === playerId

  const openConversation = (conversation: DirectConversationDto) => { model.markConversationSeen(conversation.id); setProvisional(null); setSelectedId(conversation.id); setTarget(null); setView('conversation'); setMenuOpen(false); setConfirmBlock(false); setNewCount(0); setScrollbarAtBottom(true); seenIds.current.clear(); readId.current = null; queuedRead.current = null; initialScroll.current = true; atBottom.current = true }
  const openTarget = async (targetPlayerId: string, fallback?: DirectMessagePlayerDto) => {
    const version = ++searchVersion.current
    if (fallback) { setTarget(fallback); setSearch(fallback.displayName); setCandidates([]); setSearchError(''); setSearching(false) }
    try {
      const existing = await model.openTarget(targetPlayerId)
      if (version !== searchVersion.current) return
      if (existing) openConversation(existing)
      else { const chosen = fallback ?? { id: targetPlayerId, displayName: 'Joueur', elementKey: null }; setSelectedId(null); setTarget(chosen); setSearch(chosen.displayName); setCandidates([]); setSearchError(''); setView('new'); setDraft(''); intentRef.current = null }
    } catch (reason) { if (version === searchVersion.current) setSearchError(reason instanceof Error ? reason.message : 'Joueur indisponible.') }
  }
  // oxlint-disable-next-line react/set-state-in-effect -- a shell navigation intent deliberately changes the internal panel route
  useEffect(() => { if (!intent) return; void openTarget(intent.playerId, intent.player).finally(() => onIntentConsumed(intent.token)) }, [intent?.token]) // eslint-disable-line react-hooks/exhaustive-deps
  // oxlint-disable-next-line react/set-state-in-effect -- an explicit click on the already mounted MP tab resets its internal route
  useLayoutEffect(() => { if (!resetToken) return; setView('list'); setProvisional(null); setSelectedId(null); setTarget(null); setDraft(''); setMenuOpen(false); setConfirmBlock(false); setNewCount(0); setScrollbarAtBottom(true); setHistoryQuery(''); setHistoryDate(''); setHistoryHighlight(null) }, [resetToken])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- leaving or clearing the search immediately clears obsolete suggestions
    if (view !== 'new' || target || !search.trim()) { setCandidates([]); setSearching(false); return }
    const version = ++searchVersion.current
    setSearching(true)
    const timer = window.setTimeout(() => void getGameApiClient().directMessages.players(search).then(result => { if (version === searchVersion.current) { setCandidates([...result.players]); setSearchError('') } }).catch(reason => { if (version === searchVersion.current) setSearchError(reason instanceof Error ? reason.message : 'Recherche indisponible.') }).finally(() => { if (version === searchVersion.current) setSearching(false) }), 50)
    return () => window.clearTimeout(timer)
  }, [search, target, view])

  useLayoutEffect(() => {
    if (!composer.current) return
    composer.current.style.height = '0px'; const height = Math.min(Math.max(composer.current.scrollHeight, 42), 132); composer.current.style.height = `${height}px`; composer.current.style.overflowY = composer.current.scrollHeight > 132 ? 'auto' : 'hidden'
  }, [draft, view])
  useLayoutEffect(() => {
    const owner = view === 'history' ? historyList.current : list.current
    if (!editingId || !editor.current || !owner) return
    const ownerRect = owner.getBoundingClientRect(), editorRect = editor.current.getBoundingClientRect()
    if (editorRect.top < ownerRect.top) owner.scrollTop -= ownerRect.top - editorRect.top
    else if (editorRect.bottom > ownerRect.bottom) owner.scrollTop += editorRect.bottom - ownerRect.bottom
    const textarea = editor.current.querySelector<HTMLTextAreaElement>('textarea')
    textarea?.focus(); textarea?.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [editingId, view])
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('.dm-message-actions, .dm-message-delete-confirm')) return
      const bubble = event.target.closest('.dm-message-bubble')
      const bubbleMessageId = bubble?.closest<HTMLElement>('[data-message-id]')?.dataset.messageId
      if (!bubble || bubbleMessageId !== messageActionsId) setMessageActionsId(null)
      setDeleteId(null)
      if (editingId && !event.target.closest('.dm-message-edit')) { setEditingId(null); setEditDraft('') }
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMessageActionsId(null); setDeleteId(null); setEditingId(null); setEditDraft('') } }
    document.addEventListener('pointerdown', close); window.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape) }
  }, [editingId, messageActionsId])
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- a conversation boundary owns and closes its message overlays
    setMessageActionsId(null); setDeleteId(null)
  }, [selectedId])
  useLayoutEffect(() => {
    const listElement = list.current
    if (!listElement || view !== 'conversation') return
    if (initialScroll.current && (model.messagesLoaded || provisional)) { listElement.scrollTop = listElement.scrollHeight; initialScroll.current = false; atBottom.current = true; setScrollbarAtBottom(true); seenIds.current = new Set(renderedMessages.map(message => message.id)); setNewCount(0) }
    else if (prepend.current) { listElement.scrollTop = prepend.current.top + listElement.scrollHeight - prepend.current.height; prepend.current = null }
    else if (forceBottom.current) { listElement.scrollTop = listElement.scrollHeight; forceBottom.current = false; atBottom.current = true; setScrollbarAtBottom(true); setNewCount(0) }
    else {
      const fresh = renderedMessages.filter(message => !seenIds.current.has(message.id) && !message.own)
      fresh.forEach(message => seenIds.current.add(message.id))
      if (fresh.length && atBottom.current) { listElement.scrollTop = listElement.scrollHeight; setScrollbarAtBottom(true) }
      else if (fresh.length) setNewCount(value => value + fresh.length)
    }
    if (isActive && atBottom.current) {
      const last = [...renderedMessages].reverse().find(message => !message.id.startsWith('optimistic:'))
      if (last) markConversationRead(selectedId!, last.id)
    }
  }, [isActive, model.messages, model.messagesLoaded, provisional, renderedMessages, selectedId, view]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const owner = historyList.current
    if (!owner || view !== 'history' || historyQuery.trim()) return
    if (historyInitialScroll.current && history.loaded) { owner.scrollTop = owner.scrollHeight; historyInitialScroll.current = false }
    else if (historyPrepend.current) { owner.scrollTop = historyPrepend.current.top + owner.scrollHeight - historyPrepend.current.height; historyPrepend.current = null }
    if (historyHighlight) {
      const targetMessage = owner.querySelector<HTMLElement>(`[data-message-id="${historyHighlight}"]`)
      if (targetMessage) { targetMessage.scrollIntoView({ block: 'center' }); const timer = window.setTimeout(() => setHistoryHighlight(null), 1_800); return () => window.clearTimeout(timer) }
    }
  }, [history.loaded, history.messages, historyHighlight, historyQuery, view])
  useLayoutEffect(() => {
    if (view !== 'conversation' || liveScrollTop.current === null || !list.current) return
    list.current.scrollTop = liveScrollTop.current; liveScrollTop.current = null
  }, [view])

  function markConversationRead(conversationId: string, messageId: string) {
    if (readId.current === messageId) return
    readId.current = messageId; queuedRead.current = { conversationId, messageId }
    if (readBusy.current) return
    readBusy.current = true
    void (async () => {
      while (queuedRead.current) {
        const current = queuedRead.current; queuedRead.current = null
        try { await model.markRead(current.conversationId, current.messageId) }
        catch { if (readId.current === current.messageId) readId.current = null }
      }
      readBusy.current = false
    })()
  }
  const scrollBottom = () => { if (!list.current) return; list.current.scrollTop = list.current.scrollHeight; atBottom.current = true; setScrollbarAtBottom(true); setNewCount(0); const last = [...renderedMessages].reverse().find(message => !message.id.startsWith('optimistic:')); if (isActive && selectedId && last) markConversationRead(selectedId, last.id) }
  const onScroll = () => {
    if (!list.current || initialScroll.current) return
    const remaining = list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight; atBottom.current = remaining < 70; setScrollbarAtBottom(remaining <= 2)
    if (atBottom.current) { setNewCount(0); const last = [...renderedMessages].reverse().find(message => !message.id.startsWith('optimistic:')); if (isActive && selectedId && last) markConversationRead(selectedId, last.id) }
    if (list.current.scrollTop < 70 && model.cursor) { prepend.current = { top: list.current.scrollTop, height: list.current.scrollHeight }; void model.loadOlder() }
  }
  const openHistory = () => { liveScrollTop.current = list.current?.scrollTop ?? null; setMenuOpen(false); setHistoryQuery(''); setHistoryDate(''); setHistoryHighlight(null); historyInitialScroll.current = true; setView('history') }
  const closeHistory = () => { setHistoryQuery(''); setHistoryDate(''); setHistoryHighlight(null); setEditingId(null); setEditDraft(''); setDeleteId(null); setMessageActionsId(null); setView('conversation') }
  const onHistoryScroll = () => {
    const owner = historyList.current
    if (!owner) return
    if (historyQuery.trim()) {
      if (owner.scrollHeight - owner.scrollTop - owner.clientHeight < 90 && history.searchCursor) void history.loadMoreResults()
      return
    }
    if (owner.scrollTop < 90 && history.olderCursor) { historyPrepend.current = { top: owner.scrollTop, height: owner.scrollHeight }; void history.loadOlder() }
    if (owner.scrollHeight - owner.scrollTop - owner.clientHeight < 90 && history.newerCursor) void history.loadNewer()
  }
  const jumpHistory = async (message: Pick<DirectMessageDto, 'id' | 'submissionOrder'>) => {
    if (!message.submissionOrder) return
    setHistoryQuery('')
    if (await history.jumpTo(message.submissionOrder)) setHistoryHighlight(message.id)
  }
  const navigateHistoryDate = async () => {
    if (!historyDate) return
    const localStart = new Date(`${historyDate}T00:00:00`)
    if (Number.isNaN(localStart.getTime())) return
    const anchor = await history.findDate(localStart.toISOString())
    if (anchor && await history.jumpTo(anchor.submissionOrder)) setHistoryHighlight(anchor.messageId)
  }
  const returnToList = () => { setView(selected?.archived ? 'archives' : 'list'); setProvisional(null); setSelectedId(null); setTarget(null); setDraft(''); setMenuOpen(false); setConfirmBlock(false); intentRef.current = null }
  const send = async (event: FormEvent) => {
    event.preventDefault(); const content = draft.trim(); if (!content || Array.from(content).length > 1_000 || sendBusy.current) return
    const signature = `${selectedId ?? target?.id}:${content}`
    if (intentRef.current?.signature !== signature) intentRef.current = { signature, key: crypto.randomUUID() }
    const currentIntent = intentRef.current; sendBusy.current = true; setSendPending(true); model.clearError()
    const previousDraft = draft; setDraft(''); forceBottom.current = true
    try {
      if (selectedId) await model.send(selectedId, content, currentIntent.key)
      else if (target) {
        const optimistic = createOptimisticDirectMessage(playerId, `provisional:${currentIntent.key}`, content, currentIntent.key)
        setProvisional({ target, message: optimistic, key: currentIntent.key, state: 'SENDING', conversationId: null, requestId: null }); setSelectedId(null); setView('conversation'); initialScroll.current = true; setScrollbarAtBottom(true)
        const result = await model.initiate(target.id, content, currentIntent.key)
        setProvisional(current => current?.key === currentIntent.key ? { ...current, message: { ...current.message, id: result.messageId, conversationId: result.conversationId }, state: result.state, conversationId: result.conversationId, requestId: result.requestId } : current)
        setSelectedId(result.conversationId)
      }
      intentRef.current = null
    } catch { setProvisional(null); if (!selectedId) { setSelectedId(null); setView('new') } setDraft(previousDraft) }
    finally { sendBusy.current = false; setSendPending(false) }
  }
  const chooseTarget = async (candidate: DirectMessagePlayerDto) => { await openTarget(candidate.id, candidate) }
  const act = async (action: 'accept' | 'ignore' | 'block' | 'unblock' | 'archive' | 'unarchive') => {
    if (!selected) return
    try {
      if (action === 'accept' && selected.request) await model.accept(selected.id, selected.request.id, crypto.randomUUID())
      if (action === 'ignore' && selected.request) { await model.ignore(selected.id, selected.request.id, crypto.randomUUID()); returnToList() }
      if (action === 'block') { await model.block(selected.id, crypto.randomUUID()); setConfirmBlock(false); setView('archives'); setSelectedId(null) }
      if (action === 'unblock') await model.unblock(selected.id, crypto.randomUUID())
      if (action === 'archive') { setView('archives'); setSelectedId(null); await model.archive(selected.id, true) }
      if (action === 'unarchive') { setView('list'); setSelectedId(null); await model.archive(selected.id, false) }
      setMenuOpen(false)
    } catch { /* hook owns the visible error */ }
  }
  const mutateMessage = async (mutation: MessageMutationIntent) => {
    if (!selected) return 'deterministic' as const
    setMessageActionPending(mutation.messageId); setMessageActionError(''); setRetryMutation(null)
    try {
      if (view === 'history') await history.mutate(mutation)
      else if (mutation.kind === 'edit') await model.editMessage(selected.id, mutation.messageId, mutation.content, mutation.key)
      else if (mutation.kind === 'delete') await model.deleteMessage(selected.id, mutation.messageId, mutation.key)
      else await model.restoreMessage(selected.id, mutation.messageId, mutation.key)
      return 'success' as const
    } catch (reason) {
      const ambiguous = !(reason instanceof ApiError) || reason.status === null || reason.status >= 500
      setMessageActionError(reason instanceof Error ? reason.message : 'Action indisponible.')
      if (ambiguous) setRetryMutation(mutation)
      return ambiguous ? 'ambiguous' as const : 'deterministic' as const
    } finally { setMessageActionPending(null) }
  }
  const saveEdit = async (messageId: string) => {
    const content = editDraft.trim()
    if (!content || Array.from(content).length > 1000 || messageActionPending !== null) return
    const result = await mutateMessage({ kind: 'edit', messageId, content, key: crypto.randomUUID() })
    if (result !== 'deterministic') { setEditingId(null); setEditDraft('') }
  }
  const renderMessage = (message: DirectMessageDto | DirectMessageHistoryMessageDto) => {
    const restorable = !message.deletedAt || view !== 'history' || 'canRestore' in message && message.canRestore
    const actionable = message.own && !message.id.startsWith('optimistic:') && restorable
    const actionsOpen = messageActionsId === message.id
    return <article className={`dm-message ${message.own ? 'own' : 'other'}${message.id.startsWith('optimistic:') ? ' pending' : ''}${actionsOpen ? ' actions-open' : ''}${historyHighlight === message.id ? ' dm-history-highlight' : ''}`} data-message-id={message.id} data-submission-order={message.submissionOrder ?? undefined} data-read-by-other={message.readByOther ? 'true' : 'false'} data-read-by-other-at={message.readByOtherAt ?? undefined} key={message.id} tabIndex={actionable ? 0 : undefined}>
      <div className="dm-message-content">
        {editingId === message.id ? <div className="dm-message-edit" ref={editor}><textarea aria-label="Modifier le message" value={editDraft} disabled={messageActionPending === message.id} onChange={event => setEditDraft(Array.from(event.target.value).slice(0, 1000).join(''))} onKeyDown={event => { if (event.key !== 'Enter' || event.nativeEvent.isComposing) return; event.preventDefault(); if (event.ctrlKey || event.metaKey) { const field = event.currentTarget; field.setRangeText('\n', field.selectionStart, field.selectionEnd, 'end'); setEditDraft(Array.from(field.value).slice(0, 1000).join('')); return } void saveEdit(message.id) }} /><small>{Array.from(editDraft).length} / 1 000</small><span><button type="button" disabled={messageActionPending === message.id || !editDraft.trim()} onClick={() => void saveEdit(message.id)}>Sauvegarder</button><button type="button" disabled={messageActionPending === message.id} onClick={() => { setEditingId(null); setEditDraft('') }}>Annuler</button></span></div> : <>
          <div className={`dm-message-bubble${message.deletedAt ? ' deleted' : ''}`} onClick={event => { if (!actionable || !isCoarsePointer() || (event.target as Element).closest('a, button')) return; setMessageActionsId(value => value === message.id ? null : message.id) }}>{message.content ? <p>{linkedText(message.content)}</p> : <p>Message supprimé</p>}{message.editedAt && !message.deletedAt && <small className="dm-message-edited">Modifié</small>}</div>
          {actionable && <div className="dm-message-actions">{message.deletedAt ? <button type="button" title="Restaurer" aria-label="Restaurer le message" disabled={messageActionPending === message.id} onClick={() => { setMessageActionsId(null); void mutateMessage({ kind: 'restore', messageId: message.id, key: crypto.randomUUID() }) }}>↶</button> : <><button type="button" title="Modifier" aria-label="Modifier le message" disabled={messageActionPending === message.id} onClick={() => { setEditingId(message.id); setEditDraft(message.content ?? ''); setMessageActionsId(null) }}>✎</button><button type="button" title="Supprimer" aria-label="Supprimer le message" disabled={messageActionPending === message.id} onClick={() => { setDeleteId(message.id); setMessageActionsId(null) }}>×</button></>}</div>}
          {deleteId === message.id && <div className="dm-message-delete-confirm" role="dialog" aria-label="Confirmer la suppression"><p>Supprimer ce message ?</p><button type="button" disabled={messageActionPending === message.id} onClick={() => { setDeleteId(null); void mutateMessage({ kind: 'delete', messageId: message.id, key: crypto.randomUUID() }) }}>Confirmer</button><button type="button" disabled={messageActionPending === message.id} onClick={() => setDeleteId(null)}>Annuler</button></div>}
        </>}
      </div>
    </article>
  }

  if (view === 'list' || view === 'archives') {
    const rows = view === 'archives' ? model.archived : model.normal
    return <section className="dm-panel" aria-label="Messages privés"><div className="dm-toolbar"><button type="button" className="dm-primary-action" onClick={() => { setView('new'); setTarget(null); setSearch(''); setCandidates([]); setDraft('') }}>Nouveau message</button><div className="dm-list-tabs" role="tablist" aria-label="Dossiers de messages privés"><button type="button" role="tab" aria-selected={view === 'list'} onClick={() => setView('list')}>Conversations</button><button type="button" role="tab" aria-selected={view === 'archives'} onClick={() => setView('archives')}>Archives</button></div></div>{model.error && <p className="dm-feedback error" role="alert">{model.error}</p>}<div className="dm-conversation-list">{!model.listLoaded ? <p className="dm-empty">Chargement des conversations…</p> : rows.length ? rows.map(conversation => <button type="button" className={`dm-conversation-row${conversation.unreadCount ? ' unread' : ''}`} onClick={() => openConversation(conversation)} key={conversation.id}><Avatar player={conversation.other} /><span className="dm-conversation-copy"><strong>{conversation.other.displayName}</strong><small>{conversation.request?.state === 'PENDING' ? conversation.request.senderPlayerId === playerId ? 'Demande envoyée' : 'Demande reçue' : conversation.lastMessage?.deletedAt ? 'Message supprimé' : conversation.lastMessage?.content ?? 'Conversation'}</small></span><span className="dm-conversation-meta"><time dateTime={conversation.lastMessageAt ?? undefined}>{usefulDate(conversation.lastMessageAt)}</time>{conversation.unreadCount > 0 && <span className="dm-badge">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>}</span></button>) : <p className="dm-empty">{view === 'archives' ? 'Aucune conversation archivée.' : 'Aucune conversation pour le moment.'}</p>}</div></section>
  }

  if (view === 'new') return <section className="dm-panel" aria-label="Nouveau message privé"><header className="dm-thread-header"><button type="button" className="dm-back" onClick={() => { setView('list'); setTarget(null); setDraft('') }} aria-label="Retour aux conversations">&lt;</button><div><strong>Nouveau message</strong><small>{target ? target.displayName : 'Choisir un joueur'}</small></div></header><div className="dm-new-body"><label htmlFor="dm-player-search">Rechercher un joueur</label><input id="dm-player-search" type="search" value={search} placeholder="Pseudo du joueur…" autoComplete="off" onChange={event => { setSearch(event.target.value); setTarget(null) }} />{searching && <p>Recherche…</p>}{searchError && <p role="alert" className="error">{searchError}</p>}{candidates.length > 0 && <div className="dm-player-results">{candidates.map(candidate => <button type="button" key={candidate.id} onClick={() => void chooseTarget(candidate)}><Avatar player={candidate} /><span><strong>{candidate.displayName}</strong><small>{candidate.elementKey ? elementLabels[candidate.elementKey] : 'Élément non choisi'}</small></span></button>)}</div>}{target && <p className="dm-new-hint">Écrivez le premier message.</p>}</div>{target && <Composer draft={draft} setDraft={setDraft} pending={sendPending} error={model.error} onClearError={model.clearError} onSubmit={send} composerRef={composer} />}</section>

  const other = selected?.other ?? target
  if (view === 'history' && selected && other) return <section className="dm-panel dm-history" aria-label={`Historique complet avec ${other.displayName}`}>
    <header className="dm-history-header"><button type="button" className="dm-back" onClick={closeHistory} aria-label="Retour aux messages récents">&lt;</button><div><strong>Historique complet</strong><small>MP › conversation avec {other.displayName}</small></div><button type="button" className="dm-history-recent" onClick={closeHistory}>Retour aux messages récents</button></header>
    <div className="dm-history-tools"><label><span className="sr-only">Rechercher dans l'historique</span><input type="search" value={historyQuery} placeholder="Rechercher dans l'historique…" maxLength={100} onChange={event => setHistoryQuery(event.target.value)} /></label><label className="dm-history-date"><span className="sr-only">Aller à une date</span><input type="date" value={historyDate} onChange={event => setHistoryDate(event.target.value)} /></label><button type="button" disabled={!historyDate || history.loading} onClick={() => void navigateHistoryDate()}>Aller</button></div>
    {history.error && <p className="dm-feedback error" role="alert"><span>{history.error}</span><button type="button" onClick={history.clearError} aria-label="Fermer l’erreur">×</button></p>}
    {messageActionError && <p className="dm-feedback error dm-message-action-error" role="alert"><span>{messageActionError}</span>{retryMutation && <button type="button" disabled={messageActionPending !== null} onClick={() => void mutateMessage(retryMutation)}>Réessayer</button>}<button type="button" onClick={() => { setMessageActionError(''); setRetryMutation(null); history.clearError() }} aria-label="Fermer l’erreur">×</button></p>}
    <div className="dm-history-body" ref={historyList} onScroll={onHistoryScroll}>{historyQuery.trim() ? <div className="dm-history-results">{history.searching && !history.results.length && <p className="dm-empty">Recherche…</p>}{!history.searching && !history.results.length && <p className="dm-empty">Aucun message trouvé.</p>}{history.results.map(message => <button type="button" key={message.id} onClick={() => void jumpHistory(message)}><strong>{message.own ? 'Vous' : other.displayName}</strong><span>{message.content}</span><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('fr-FR')}</time></button>)}{history.searching && history.results.length > 0 && <p className="dm-empty">Recherche…</p>}</div> : <>{!history.loaded && <p className="dm-empty">Chargement de l'historique…</p>}{history.olderCursor && history.loading && <p className="dm-history-loading">Chargement…</p>}{history.messages.map(renderMessage)}{history.newerCursor && history.loading && <p className="dm-history-loading">Chargement…</p>}</>}</div>
  </section>
  return <section className="dm-panel" aria-label={other ? `Conversation avec ${other.displayName}` : 'Conversation privée'}><header className="dm-thread-header"><button type="button" className="dm-back" onClick={returnToList} aria-label="Retour aux conversations">&lt;</button>{other && <><button type="button" className="dm-thread-identity" onClick={() => onOpenProfile(other.id)}><Avatar player={other} /><span><strong>{other.displayName}</strong><small>Voir le profil</small></span></button>{provisional?.state !== 'SENDING' && <button type="button" className="dm-menu-button" aria-label="Actions de conversation" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>⋯</button>}</>}{menuOpen && selected && <div className="dm-conversation-menu" role="menu"><button type="button" role="menuitem" onClick={openHistory}>Historique complet</button><label><input type="checkbox" checked={selected.readReceiptsEnabled} disabled={model.pending} onChange={event => { void model.receipts(selected.id, event.target.checked).catch(() => undefined) }} /> Accusés de lecture</label><button type="button" role="menuitem" disabled={model.pending} onClick={() => void act(selected.archived ? 'unarchive' : 'archive')}>{selected.archived ? 'Désarchiver' : 'Archiver'}</button>{selected.blockedByMe ? <button type="button" role="menuitem" disabled={model.pending} onClick={() => void act('unblock')}>Débloquer</button> : <button type="button" role="menuitem" className="danger" disabled={model.pending} onClick={() => setConfirmBlock(true)}>Bloquer</button>}<button type="button" role="menuitem" onClick={() => other && onOpenProfile(other.id)}>Profil</button></div>}</header>{confirmBlock && <div className="dm-confirm" role="dialog" aria-label="Confirmer le blocage"><p>Bloquer ce joueur et archiver la conversation ?</p><button type="button" disabled={model.pending} onClick={() => void act('block')}>Confirmer</button><button type="button" onClick={() => setConfirmBlock(false)}>Annuler</button></div>}{model.error && (!selected?.canSend || incomingPending) && <p className="dm-feedback error" role="alert"><span>{model.error}</span><button type="button" onClick={model.clearError} aria-label="Fermer l’erreur">×</button></p>}{messageActionError && <p className="dm-feedback error dm-message-action-error" role="alert"><span>{messageActionError}</span>{retryMutation && <button type="button" disabled={messageActionPending !== null} onClick={() => void mutateMessage(retryMutation)}>Réessayer</button>}<button type="button" onClick={() => { setMessageActionError(''); setRetryMutation(null); model.clearError() }} aria-label="Fermer l’erreur">×</button></p>}{incomingPending && <div className="dm-request"><strong>Demande de conversation</strong><p>Le premier message est visible. Souhaitez-vous poursuivre cet échange ?</p><div><button type="button" disabled={model.pending} onClick={() => void act('accept')}>Accepter</button><button type="button" disabled={model.pending} onClick={() => void act('ignore')}>Ignorer</button><button type="button" disabled={model.pending} onClick={() => setConfirmBlock(true)}>Bloquer</button></div></div>}{outgoingPending && <p className="dm-state">Demande envoyée</p>}<div className={`dm-message-list${scrollbarAtBottom ? ' dm-scrollbar-hidden' : ''}`} ref={list} onScroll={onScroll}>{model.cursor && <button type="button" className="dm-load-older" onClick={() => void model.loadOlder()}>Charger les messages précédents</button>}{!model.messagesLoaded && !provisional && <p className="dm-empty">Chargement de la conversation…</p>}{renderedMessages.map(renderMessage)}</div>{newCount > 0 && <button type="button" className="dm-new-messages" onClick={scrollBottom}>{newCount} nouveau{newCount > 1 ? 'x' : ''} message{newCount > 1 ? 's' : ''} ↓</button>}{latestOwn && !latestOwn.deletedAt && <small className="dm-latest-status" title={latestOwn.readByOtherAt ? new Date(latestOwn.readByOtherAt).toLocaleString('fr-FR') : undefined}>{latestOwn.id.startsWith('optimistic:') ? 'Envoi...' : latestOwn.readByOther ? directMessageReceiptLabel(latestOwn.readByOtherAt, now) : 'Envoyé'}</small>}{provisional?.state === 'SENDING' ? null : selected && incomingPending ? null : selected?.canSend ? <Composer draft={draft} setDraft={setDraft} pending={sendPending} error={model.error} onClearError={model.clearError} onSubmit={send} composerRef={composer} /> : <p className="dm-readonly">Cette conversation est disponible en lecture seule.</p>}</section>
}

function Composer({ draft, setDraft, pending, error, onClearError, onSubmit, composerRef }: { draft: string; setDraft: (value: string) => void; pending: boolean; error: string | null; onClearError: () => void; onSubmit: (event: FormEvent) => void; composerRef: RefObject<HTMLTextAreaElement | null> }) {
  const count = Array.from(draft).length
  return <div className="dm-composer-wrap">{error && <p className="dm-feedback error" role="alert"><span>{error}</span><button type="button" onClick={onClearError} aria-label="Fermer l’erreur">×</button></p>}<form className="dm-composer" onSubmit={onSubmit}><label className="sr-only" htmlFor="dm-message">Écrire un message privé</label><textarea ref={composerRef} id="dm-message" rows={1} value={draft} disabled={pending} placeholder="Écrire un message privé…" onChange={event => setDraft(Array.from(event.target.value).slice(0, 1000).join(''))} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />{count >= 900 && <span className="dm-character-count">{count} / 1 000</span>}<button type="submit" className="dm-send" aria-label="Envoyer le message privé" disabled={pending || !draft.trim() || count > 1000}>›</button></form></div>
}
