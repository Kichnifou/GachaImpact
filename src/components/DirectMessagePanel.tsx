import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { getGameApiClient } from '../api/game-api'
import type { DirectConversationDto, DirectMessagePlayerDto } from '../api/types'
import { directMessageReceiptLabel } from '../direct-messages/receipt-label'
import { useDirectMessages } from '../direct-messages/use-direct-messages'
import { elementLabels } from '../utils/formatters'

export type DirectMessageOpenIntent = Readonly<{ playerId: string; token: string; player?: DirectMessagePlayerDto }>
type View = 'list' | 'archives' | 'conversation' | 'new'
type SendIntent = { signature: string; key: string }

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

export default function DirectMessagePanel({ playerId, isActive, intent, resetToken, onIntentConsumed, onUnreadChange, onOpenProfile }: { playerId: string; isActive: boolean; intent: DirectMessageOpenIntent | null; resetToken?: string | null; onIntentConsumed: (token: string) => void; onUnreadChange: (count: number) => void; onOpenProfile: (id: string) => void }) {
  const [view, setView] = useState<View>('list'), [selectedId, setSelectedId] = useState<string | null>(null), [target, setTarget] = useState<DirectMessagePlayerDto | null>(null)
  const [draft, setDraft] = useState(''), [search, setSearch] = useState(''), [candidates, setCandidates] = useState<DirectMessagePlayerDto[]>([])
  const [searchError, setSearchError] = useState(''), [searching, setSearching] = useState(false), [menuOpen, setMenuOpen] = useState(false), [confirmBlock, setConfirmBlock] = useState(false)
  const [newCount, setNewCount] = useState(0), [sendPending, setSendPending] = useState(false), [now, setNow] = useState(() => Date.now()), [scrollbarAtBottom, setScrollbarAtBottom] = useState(true)
  const intentRef = useRef<SendIntent | null>(null), list = useRef<HTMLDivElement>(null), composer = useRef<HTMLTextAreaElement>(null), atBottom = useRef(true), initialScroll = useRef(false), forceBottom = useRef(false), seenIds = useRef(new Set<string>()), prepend = useRef<{ top: number; height: number } | null>(null), readId = useRef<string | null>(null), sendBusy = useRef(false), readBusy = useRef(false), queuedRead = useRef<{ conversationId: string; messageId: string } | null>(null)
  const model = useDirectMessages(playerId, isActive, selectedId, view === 'archives', onUnreadChange)
  const selected = model.selected
  const latestEvent = model.messages.at(-1)
  const latestOwn = latestEvent?.own ? latestEvent : null
  const incomingPending = selected?.request?.state === 'PENDING' && selected.request.senderPlayerId !== playerId
  const outgoingPending = selected?.request?.state === 'PENDING' && selected.request.senderPlayerId === playerId

  const openConversation = (conversation: DirectConversationDto) => { model.markConversationSeen(conversation.id); setSelectedId(conversation.id); setTarget(null); setView('conversation'); setMenuOpen(false); setConfirmBlock(false); setNewCount(0); setScrollbarAtBottom(true); seenIds.current.clear(); readId.current = null; queuedRead.current = null; initialScroll.current = true; atBottom.current = true }
  const openTarget = async (targetPlayerId: string, fallback?: DirectMessagePlayerDto) => {
    try {
      const existing = await model.openTarget(targetPlayerId)
      if (existing) openConversation(existing)
      else { setSelectedId(null); setTarget(fallback ?? { id: targetPlayerId, displayName: 'Joueur', elementKey: null }); setView('new'); setDraft(''); intentRef.current = null }
    } catch (reason) { setSearchError(reason instanceof Error ? reason.message : 'Joueur indisponible.') }
  }
  // oxlint-disable-next-line react/set-state-in-effect -- a shell navigation intent deliberately changes the internal panel route
  useEffect(() => { if (!intent) return; void openTarget(intent.playerId, intent.player).finally(() => onIntentConsumed(intent.token)) }, [intent?.token]) // eslint-disable-line react-hooks/exhaustive-deps
  // oxlint-disable-next-line react/set-state-in-effect -- an explicit click on the already mounted MP tab resets its internal route
  useLayoutEffect(() => { if (!resetToken) return; setView('list'); setSelectedId(null); setTarget(null); setDraft(''); setMenuOpen(false); setConfirmBlock(false); setNewCount(0); setScrollbarAtBottom(true) }, [resetToken])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- leaving or clearing the search immediately clears obsolete suggestions
    if (view !== 'new' || !search.trim()) { setCandidates([]); setSearching(false); return }
    let alive = true; setSearching(true)
    const timer = window.setTimeout(() => void getGameApiClient().social.directory({ q: search, page: 1 }).then(result => { if (alive) { setCandidates(result.players.filter(candidate => candidate.id !== playerId).map(candidate => ({ id: candidate.id, displayName: candidate.displayName, elementKey: candidate.elementKey }))); setSearchError('') } }).catch(reason => { if (alive) setSearchError(reason instanceof Error ? reason.message : 'Recherche indisponible.') }).finally(() => { if (alive) setSearching(false) }), 220)
    return () => { alive = false; window.clearTimeout(timer) }
  }, [playerId, search, view])

  useLayoutEffect(() => {
    if (!composer.current) return
    composer.current.style.height = '0px'; const height = Math.min(Math.max(composer.current.scrollHeight, 42), 132); composer.current.style.height = `${height}px`; composer.current.style.overflowY = composer.current.scrollHeight > 132 ? 'auto' : 'hidden'
  }, [draft, view])
  useLayoutEffect(() => {
    const listElement = list.current
    if (!listElement || view !== 'conversation') return
    if (initialScroll.current && model.messagesLoaded) { listElement.scrollTop = listElement.scrollHeight; initialScroll.current = false; atBottom.current = true; setScrollbarAtBottom(true); seenIds.current = new Set(model.messages.map(message => message.id)); setNewCount(0) }
    else if (prepend.current) { listElement.scrollTop = prepend.current.top + listElement.scrollHeight - prepend.current.height; prepend.current = null }
    else if (forceBottom.current) { listElement.scrollTop = listElement.scrollHeight; forceBottom.current = false; atBottom.current = true; setScrollbarAtBottom(true); setNewCount(0) }
    else {
      const fresh = model.messages.filter(message => !seenIds.current.has(message.id) && !message.own)
      fresh.forEach(message => seenIds.current.add(message.id))
      if (fresh.length && atBottom.current) { listElement.scrollTop = listElement.scrollHeight; setScrollbarAtBottom(true) }
      else if (fresh.length) setNewCount(value => value + fresh.length)
    }
    if (isActive && atBottom.current) {
      const last = [...model.messages].reverse().find(message => !message.id.startsWith('optimistic:'))
      if (last) markConversationRead(selectedId!, last.id)
    }
  }, [isActive, model.messages, model.messagesLoaded, selectedId, view]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const scrollBottom = () => { if (!list.current) return; list.current.scrollTop = list.current.scrollHeight; atBottom.current = true; setScrollbarAtBottom(true); setNewCount(0); const last = [...model.messages].reverse().find(message => !message.id.startsWith('optimistic:')); if (isActive && selectedId && last) markConversationRead(selectedId, last.id) }
  const onScroll = () => {
    if (!list.current || initialScroll.current) return
    const remaining = list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight; atBottom.current = remaining < 70; setScrollbarAtBottom(remaining <= 2)
    if (atBottom.current) { setNewCount(0); const last = [...model.messages].reverse().find(message => !message.id.startsWith('optimistic:')); if (isActive && selectedId && last) markConversationRead(selectedId, last.id) }
    if (list.current.scrollTop < 70 && model.cursor) { prepend.current = { top: list.current.scrollTop, height: list.current.scrollHeight }; void model.loadOlder() }
  }
  const returnToList = () => { setView(selected?.archived ? 'archives' : 'list'); setSelectedId(null); setTarget(null); setDraft(''); setMenuOpen(false); setConfirmBlock(false); intentRef.current = null }
  const send = async (event: FormEvent) => {
    event.preventDefault(); const content = draft.trim(); if (!content || Array.from(content).length > 1_000 || sendBusy.current) return
    const signature = `${selectedId ?? target?.id}:${content}`
    if (intentRef.current?.signature !== signature) intentRef.current = { signature, key: crypto.randomUUID() }
    const currentIntent = intentRef.current; sendBusy.current = true; setSendPending(true); model.clearError()
    const previousDraft = draft; setDraft(''); forceBottom.current = true
    try {
      if (selectedId) await model.send(selectedId, content, currentIntent.key)
      else if (target) { const result = await model.initiate(target.id, content, currentIntent.key); setSelectedId(result!.conversationId); setView('conversation'); initialScroll.current = true }
      intentRef.current = null
    } catch { setDraft(current => current || previousDraft) }
    finally { sendBusy.current = false; setSendPending(false) }
  }
  const chooseTarget = async (candidate: DirectMessagePlayerDto) => { setTarget(candidate); setSearch(candidate.displayName); setCandidates([]); await openTarget(candidate.id, candidate) }
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

  if (view === 'list' || view === 'archives') {
    const rows = view === 'archives' ? model.archived : model.normal
    return <section className="dm-panel" aria-label="Messages privés"><div className="dm-toolbar"><button type="button" className="dm-primary-action" onClick={() => { setView('new'); setTarget(null); setSearch(''); setCandidates([]); setDraft('') }}>Nouveau message</button><div className="dm-list-tabs" role="tablist" aria-label="Dossiers de messages privés"><button type="button" role="tab" aria-selected={view === 'list'} onClick={() => setView('list')}>Conversations</button><button type="button" role="tab" aria-selected={view === 'archives'} onClick={() => setView('archives')}>Archives</button></div></div>{model.error && <p className="dm-feedback error" role="alert">{model.error}</p>}<div className="dm-conversation-list">{!model.listLoaded ? <p className="dm-empty">Chargement des conversations…</p> : rows.length ? rows.map(conversation => <button type="button" className={`dm-conversation-row${conversation.unreadCount ? ' unread' : ''}`} onClick={() => openConversation(conversation)} key={conversation.id}><Avatar player={conversation.other} /><span className="dm-conversation-copy"><strong>{conversation.other.displayName}</strong><small>{conversation.request?.state === 'PENDING' ? conversation.request.senderPlayerId === playerId ? 'Demande envoyée' : 'Demande reçue' : conversation.lastMessage?.content ?? 'Conversation'}</small></span><span className="dm-conversation-meta"><time dateTime={conversation.lastMessageAt ?? undefined}>{usefulDate(conversation.lastMessageAt)}</time>{conversation.unreadCount > 0 && <span className="dm-badge">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>}</span></button>) : <p className="dm-empty">{view === 'archives' ? 'Aucune conversation archivée.' : 'Aucune conversation pour le moment.'}</p>}</div></section>
  }

  if (view === 'new') return <section className="dm-panel" aria-label="Nouveau message privé"><header className="dm-thread-header"><button type="button" className="dm-back" onClick={() => { setView('list'); setTarget(null); setDraft('') }} aria-label="Retour aux conversations">&lt;</button><div><strong>Nouveau message</strong><small>{target ? target.displayName : 'Choisir un joueur'}</small></div></header><div className="dm-new-body"><label htmlFor="dm-player-search">Rechercher un joueur</label><input id="dm-player-search" type="search" value={search} placeholder="Pseudo du joueur…" autoComplete="off" onChange={event => { setSearch(event.target.value); setTarget(null) }} />{searching && <p>Recherche…</p>}{searchError && <p role="alert" className="error">{searchError}</p>}{candidates.length > 0 && <div className="dm-player-results">{candidates.map(candidate => <button type="button" key={candidate.id} onClick={() => void chooseTarget(candidate)}><Avatar player={candidate} /><span><strong>{candidate.displayName}</strong><small>{candidate.elementKey ? elementLabels[candidate.elementKey] : 'Élément non choisi'}</small></span></button>)}</div>}{target && <p className="dm-new-hint">Écrivez le premier message. La conversation ne sera créée qu’à son envoi.</p>}</div>{target && <Composer draft={draft} setDraft={setDraft} pending={sendPending} error={model.error} onClearError={model.clearError} onSubmit={send} composerRef={composer} />}</section>

  const other = selected?.other ?? target
  return <section className="dm-panel" aria-label={other ? `Conversation avec ${other.displayName}` : 'Conversation privée'}><header className="dm-thread-header"><button type="button" className="dm-back" onClick={returnToList} aria-label="Retour aux conversations">&lt;</button>{other && <><button type="button" className="dm-thread-identity" onClick={() => onOpenProfile(other.id)}><Avatar player={other} /><span><strong>{other.displayName}</strong><small>Voir le profil</small></span></button><button type="button" className="dm-menu-button" aria-label="Actions de conversation" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>⋯</button></>}{menuOpen && selected && <div className="dm-conversation-menu" role="menu"><label><input type="checkbox" checked={selected.readReceiptsEnabled} disabled={model.pending} onChange={event => { void model.receipts(selected.id, event.target.checked).catch(() => undefined) }} /> Accusés de lecture</label><button type="button" role="menuitem" disabled={model.pending} onClick={() => void act(selected.archived ? 'unarchive' : 'archive')}>{selected.archived ? 'Désarchiver' : 'Archiver'}</button>{selected.blockedByMe ? <button type="button" role="menuitem" disabled={model.pending} onClick={() => void act('unblock')}>Débloquer</button> : <button type="button" role="menuitem" className="danger" disabled={model.pending} onClick={() => setConfirmBlock(true)}>Bloquer</button>}<button type="button" role="menuitem" onClick={() => other && onOpenProfile(other.id)}>Profil</button></div>}</header>{confirmBlock && <div className="dm-confirm" role="dialog" aria-label="Confirmer le blocage"><p>Bloquer ce joueur et archiver la conversation ?</p><button type="button" disabled={model.pending} onClick={() => void act('block')}>Confirmer</button><button type="button" onClick={() => setConfirmBlock(false)}>Annuler</button></div>}{model.error && (!selected?.canSend || incomingPending) && <p className="dm-feedback error" role="alert"><span>{model.error}</span><button type="button" onClick={model.clearError} aria-label="Fermer l’erreur">×</button></p>}{incomingPending && <div className="dm-request"><strong>Demande de conversation</strong><p>Le premier message est visible. Souhaitez-vous poursuivre cet échange ?</p><div><button type="button" disabled={model.pending} onClick={() => void act('accept')}>Accepter</button><button type="button" disabled={model.pending} onClick={() => void act('ignore')}>Ignorer</button><button type="button" disabled={model.pending} onClick={() => setConfirmBlock(true)}>Bloquer</button></div></div>}{outgoingPending && <p className="dm-state">Demande envoyée</p>}<div className={`dm-message-list${scrollbarAtBottom ? ' dm-scrollbar-hidden' : ''}`} ref={list} onScroll={onScroll}>{model.cursor && <button type="button" className="dm-load-older" onClick={() => void model.loadOlder()}>Charger les messages précédents</button>}{!model.messagesLoaded && <p className="dm-empty">Chargement de la conversation…</p>}{model.messages.map(message => <article className={`dm-message ${message.own ? 'own' : 'other'}${message.id.startsWith('optimistic:') ? ' pending' : ''}`} data-message-id={message.id} key={message.id}><div>{message.content ? <p>{linkedText(message.content)}</p> : <p>Message supprimé</p>}</div></article>)}</div>{newCount > 0 && <button type="button" className="dm-new-messages" onClick={scrollBottom}>{newCount} nouveau{newCount > 1 ? 'x' : ''} message{newCount > 1 ? 's' : ''} ↓</button>}{latestOwn && <small className="dm-latest-status" title={latestOwn.readByOtherAt ? new Date(latestOwn.readByOtherAt).toLocaleString('fr-FR') : undefined}>{latestOwn.id.startsWith('optimistic:') ? 'Envoi...' : latestOwn.readByOther ? directMessageReceiptLabel(latestOwn.readByOtherAt, now) : 'Envoyé'}</small>}{selected && incomingPending ? null : selected?.canSend ? <Composer draft={draft} setDraft={setDraft} pending={sendPending} error={model.error} onClearError={model.clearError} onSubmit={send} composerRef={composer} /> : <p className="dm-readonly">Cette conversation est disponible en lecture seule.</p>}</section>
}

function Composer({ draft, setDraft, pending, error, onClearError, onSubmit, composerRef }: { draft: string; setDraft: (value: string) => void; pending: boolean; error: string | null; onClearError: () => void; onSubmit: (event: FormEvent) => void; composerRef: RefObject<HTMLTextAreaElement | null> }) {
  const count = Array.from(draft).length
  return <div className="dm-composer-wrap">{error && <p className="dm-feedback error" role="alert"><span>{error}</span><button type="button" onClick={onClearError} aria-label="Fermer l’erreur">×</button></p>}<form className="dm-composer" onSubmit={onSubmit}><label className="sr-only" htmlFor="dm-message">Écrire un message privé</label><textarea ref={composerRef} id="dm-message" rows={1} value={draft} disabled={pending} placeholder="Écrire un message privé…" onChange={event => setDraft(Array.from(event.target.value).slice(0, 1000).join(''))} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />{count >= 900 && <span className="dm-character-count">{count} / 1 000</span>}<button type="submit" className="dm-send" aria-label="Envoyer le message privé" disabled={pending || !draft.trim() || count > 1000}>›</button></form></div>
}
