import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type CSSProperties } from 'react'
import { ApiError, getGameApiClient } from '../api/game-api'
import type { ChatMentionDto, ChatMessageDto, ChatRefreshScope } from '../api/types'
import { elementColors } from '../utils/elementTheme'

type Props = { playerId: string; playerDisplayName?: string; playerElementKey?: string | null; connectedCount?: number | null; isCollapsed: boolean; onToggle: () => void; onOpenPlayers: () => void; onOpenProfile: (id: string) => void; onRefreshScopes: (scopes: readonly ChatRefreshScope[]) => Promise<void> }
type Intent = { key: string; content: string; replyId: string | null; mentions: ChatMentionDto[] }

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

const orderMessages = (items: ChatMessageDto[]) => items.sort((a, b) => {
  if (a.id.startsWith('optimistic:')) return b.id.startsWith('optimistic:') ? a.createdAt.localeCompare(b.createdAt) : 1
  if (b.id.startsWith('optimistic:')) return -1
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
})

function ChatPanel({ playerId, playerDisplayName = 'Vous', playerElementKey = null, isCollapsed, onToggle, onOpenPlayers, onOpenProfile, onRefreshScopes, connectedCount = null }: Props) {
  const api = getGameApiClient().chat
  const [messages, setMessages] = useState<ChatMessageDto[]>([])
  const [cursor, setCursor] = useState<{ createdAt: string; id: string } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [unread, setUnread] = useState(0)
  const [newCount, setNewCount] = useState(0)
  const [draft, setDraft] = useState('')
  const [reply, setReply] = useState<ChatMessageDto | null>(null)
  const [mentions, setMentions] = useState<ChatMentionDto[]>([])
  const [suggestions, setSuggestions] = useState<{ id: string; displayName: string; elementKey: string | null }[]>([])
  const [pending, setPending] = useState(false)
  const [ambiguousIntents, setAmbiguousIntents] = useState<Intent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
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
  const deferredLatest = useRef(false)
  const unseenIds = useRef(new Set<string>())

  const unreadNow = useCallback(async () => {
    const value = await api.unread()
    if (generation.current !== null && value.generation < generation.current) return
    setUnread(value.unreadCount)
    if (generation.current !== null && value.generation !== generation.current) {
      generation.current = value.generation
      messagesRef.current = []
      setMessages([]); setCursor(null); setLoaded(false); setNewCount(0); readId.current = null; unseenIds.current.clear(); deferredLatest.current = false; atBottom.current = true
      setAmbiguousIntents([])
    }
  }, [api])
  const messagesNow = useCallback(async (initial: boolean) => {
    const page = await api.messages()
    if (generation.current !== null && page.generation < generation.current) return
    const changed = generation.current !== null && generation.current !== page.generation
    generation.current = page.generation
    if (changed) {
      messagesRef.current = page.messages
      setMessages(page.messages); setCursor(page.nextCursor); setLoaded(true)
      unseenIds.current.clear(); deferredLatest.current = false; setNewCount(0); setUnread(0); readId.current = null
      setAmbiguousIntents([])
      atBottom.current = true
      requestAnimationFrame(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight })
      return
    }
    const current = messagesRef.current
    const previous = new Set(current.filter(item => !item.id.startsWith('optimistic:')).map(item => item.id))
    const fresh = initial ? [] : page.messages.filter(item => !previous.has(item.id) && item.author?.id !== playerId)
    const updates = new Map(page.messages.map(item => [item.id, item]))
    const byIntent = new Map(page.messages.filter(item => item.clientIntentKey).map(item => [item.clientIntentKey, item]))
    if (byIntent.size) setAmbiguousIntents(items => items.filter(item => !byIntent.has(item.key)))
    const retain = (item: ChatMessageDto) => item.id.startsWith('optimistic:') ? byIntent.get(item.clientIntentKey) ?? item : updates.get(item.id) ?? item
    const newlySeen = fresh.filter(item => !unseenIds.current.has(item.id))
    if (newlySeen.length && !atBottom.current) setNewCount(count => count + newlySeen.length)
    if (!initial && !atBottom.current && current.length >= 350) {
      newlySeen.forEach(item => unseenIds.current.add(item.id))
      deferredLatest.current = true
      const next = orderMessages(current.map(retain).filter((item, index, all) => all.findIndex(other => other.id === item.id) === index))
      messagesRef.current = next
      setMessages(next)
      return
    }
    const next = initial ? orderMessages([...page.messages, ...current.filter(item => item.id.startsWith('optimistic:') && !byIntent.has(item.clientIntentKey))]) : orderMessages([...current.map(retain), ...page.messages.filter(item => !previous.has(item.id) && !current.some(old => old.clientIntentKey && old.clientIntentKey === item.clientIntentKey))].filter((item, index, all) => all.findIndex(other => other.id === item.id) === index)).slice(-350)
    if (initial) { deferredLatest.current = false; unseenIds.current.clear(); setNewCount(0) }
    messagesRef.current = next
    setMessages(next)
    if (initial) { atBottom.current = false; setCursor(page.nextCursor); setLoaded(true); requestAnimationFrame(() => { if (list.current) { list.current.scrollTop = list.current.scrollHeight; atBottom.current = true; const id = page.messages.at(-1)?.id; if (id && readId.current !== id) { readId.current = id; void api.read(id).then(() => setUnread(0)).catch(() => { readId.current = null }) } } }) }
  }, [api, playerId])

  useEffect(() => {
    let cancelled = false, busy = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      if (cancelled || busy || document.hidden) return
      busy = true
      try { if (isCollapsed) await unreadNow(); else { await messagesNow(!loaded); await unreadNow() } }
      catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Chat indisponible.') }
      finally { busy = false }
    }
    const schedule = () => { clearTimeout(timer); if (!cancelled && !document.hidden) timer = setTimeout(async () => { await tick(); schedule() }, isCollapsed ? 5000 : 2500) }
    const visible = () => { if (document.hidden) clearTimeout(timer); else { void tick(); schedule() } }
    void tick().then(schedule)
    document.addEventListener('visibilitychange', visible); window.addEventListener('focus', visible)
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', visible) }
  }, [isCollapsed, loaded, messagesNow, playerId, unreadNow])

  useEffect(() => {
    if (isCollapsed || document.hidden || !atBottom.current || !messages.length) return
    const id = [...messages].reverse().find(message => !message.id.startsWith('optimistic:'))?.id
    if (!id) return
    if (readId.current === id) return
    readId.current = id
    void api.read(id).then(() => setUnread(0)).catch(() => { readId.current = null })
  }, [api, isCollapsed, messages])

  useLayoutEffect(() => {
    if (!list.current) return
    messagesRef.current = messages
    if (prepend.current) { list.current.scrollTop = prepend.current.top + list.current.scrollHeight - prepend.current.height; prepend.current = null }
    else if (atBottom.current && lastRenderedId.current && messages.at(-1)?.id !== lastRenderedId.current) list.current.scrollTop = list.current.scrollHeight
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
      setMessages(current => [...page.messages.filter(item => !current.some(old => old.id === item.id)), ...current].slice(0, 350))
      setCursor(page.nextCursor)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Historique indisponible.') }
    finally { olderBusy.current = false }
  }
  const markRecent = () => { const id = [...messagesRef.current].reverse().find(item => !item.id.startsWith('optimistic:'))?.id; if (id && !document.hidden && !isCollapsed && readId.current !== id) { readId.current = id; void api.read(id).then(() => setUnread(0)).catch(() => { readId.current = null }) } }
  const scrollBottom = () => { if (deferredLatest.current) { void messagesNow(true).catch(cause => setError(cause instanceof Error ? cause.message : 'Chat indisponible.')); return } if (list.current) list.current.scrollTop = list.current.scrollHeight; atBottom.current = true; setNewCount(0); markRecent() }
  const onScroll = () => { if (!list.current) return; atBottom.current = list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 80; if (atBottom.current) { if (deferredLatest.current) scrollBottom(); else { setNewCount(0); markRecent() } } if (list.current.scrollTop < 90) void loadOlder() }

  useEffect(() => {
    const match = draft.match(/(?:^|\s)@([^\s@]+)$/u), version = ++searchVersion.current
    if (!match) return
    const timer = setTimeout(() => { void api.mentions(match[1]!).then(value => { if (version === searchVersion.current) setSuggestions(value.players) }).catch(() => { if (version === searchVersion.current) setSuggestions([]) }) }, 220)
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
    setPending(true); setError(null)
    try {
      const result = await api.send(next.content, next.key, next.replyId, next.mentions)
      setAmbiguousIntents(current => current.filter(item => item.key !== next.key))
      if (result.cleared) {
        if (generation.current === null || result.generation >= generation.current) {
          generation.current = result.generation; messagesRef.current = []; setMessages([]); setCursor(null); setNewCount(0); setUnread(0); readId.current = null; unseenIds.current.clear(); deferredLatest.current = false
          void messagesNow(true).catch(cause => setError(cause instanceof Error ? cause.message : 'Chat indisponible.'))
        }
      } else {
        if (generation.current === null) generation.current = result.generation
        setMessages(current => {
          const without = current.filter(item => item.clientIntentKey !== next.key && item.id !== result.message.id)
          const confirmed = result.generation === generation.current ? [result.message, ...result.results].filter(item => !without.some(old => old.id === item.id)) : []
          const merged = orderMessages([...without, ...confirmed]).slice(-350)
          messagesRef.current = merged
          return merged
        })
        if (result.refreshScopes.length) void onRefreshScopes(result.refreshScopes).catch(() => setFeedback('Certaines données se mettront à jour au prochain chargement.'))
        if (result.dailyChallengeCompleted) setFeedback('Défi Messages terminé !')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Envoi indisponible.')
      if (cause instanceof ApiError && cause.status !== null && cause.status < 500) {
        setMessages(current => current.filter(item => item.clientIntentKey !== next.key))
        setDraft(current => current || next.content); setReply(current => current || messagesRef.current.find(item => item.id === next.replyId) || null)
      } else setAmbiguousIntents(current => current.some(item => item.key === next.key) ? current : [...current, next])
    } finally { setPending(false) }
  }

  const send = (event: FormEvent) => {
    event.preventDefault()
    if (pending || !draft.trim() || Array.from(draft.trim()).length > 500) return
    const next: Intent = { key: crypto.randomUUID(), content: draft.trim(), replyId: reply?.id ?? null, mentions: mentions.filter(item => draft.includes(`@${item.displayName}`)) }
    const provisional: ChatMessageDto = { id: `optimistic:${next.key}`, clientIntentKey: next.key, author: { id: playerId, displayName: playerDisplayName, elementKey: playerElementKey }, authorLabel: playerDisplayName, sourceChannel: 'INTERNAL_CHAT', messageType: next.content.startsWith('!') ? 'COMMAND' : 'PLAYER', content: next.content, createdAt: new Date().toISOString(), deletedAt: null, deletionState: 'ACTIVE', replyToMessageId: next.replyId, replyPreview: reply?.content ?? null, mentionedMe: false, repliedToMe: false }
    setDraft(''); setReply(null); setSuggestions([]); setMentions([]); setError(null)
    messagesRef.current = [...messagesRef.current, provisional].slice(-350)
    setMessages(messagesRef.current)
    requestAnimationFrame(() => { if (atBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight })
    queueMicrotask(() => void submitIntent(next))
  }

  const remove = async (id: string) => { setMenuId(null); try { await api.remove(id); setMessages(current => current.map(message => message.id === id ? { ...message, deletionState: 'AUTHOR', content: null } : message.replyToMessageId === id ? { ...message, replyPreview: 'Message supprimé' } : message)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Suppression indisponible.') } }
  const report = async (id: string) => { try { await api.report(id); setReportId(null); setFeedback('Signalement envoyé.'); setTimeout(() => setFeedback(null), 3000) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Signalement indisponible.') } }
  const hide = (id: string) => { const next = [...new Set([...hidden, id])]; setHidden(next); sessionStorage.setItem(`chat.hidden.${playerId}`, JSON.stringify(next)); setMenuId(null) }
  const unhide = (id: string) => { const next = hidden.filter(item => item !== id); setHidden(next); setRevealed(value => value.filter(messageId => !messages.some(item => item.id === messageId && item.author?.id === id))); sessionStorage.setItem(`chat.hidden.${playerId}`, JSON.stringify(next)); setMenuId(null) }
  const mention = (person: { id: string; displayName: string }) => { setDraft(value => value.replace(/@[^\s@]*$/u, `@${person.displayName} `)); setMentions(value => [...value.filter(item => item.playerId !== person.id), { playerId: person.id, displayName: person.displayName }]); setSuggestions([]) }

  if (isCollapsed) return <aside className="chat-panel collapsed" aria-label="Chat global replié"><button type="button" className="chat-expand-button" onClick={onToggle} aria-label={`Afficher le chat global, ${unread} non lus`}><span aria-hidden="true">‹</span><strong>Chat</strong>{unread > 0 && <span className="unread-count">{unread > 99 ? '99+' : unread}</span>}</button></aside>
  return <aside className="chat-panel panel" aria-label="Chat global">
    <div className="chat-header"><div><span className="eyebrow">Communauté</span><h2>Chat global</h2></div><button type="button" className="icon-button" onClick={onToggle} aria-label="Replier le chat global"><span className="icon-glyph">›</span></button></div>
    <button type="button" className="chat-presence" onClick={onOpenPlayers}><span className="status-dot" />{connectedCount === null ? 'Joueurs connectés' : `${connectedCount} joueur${connectedCount > 1 ? 's' : ''} connecté${connectedCount > 1 ? 's' : ''}`}<span aria-hidden="true">›</span></button>
    {!!hidden.length && <details className="chat-hidden-players"><summary>{hidden.length} joueur{hidden.length > 1 ? 's' : ''} masqué{hidden.length > 1 ? 's' : ''}</summary><div>{hidden.map(id => <button type="button" key={id} onClick={() => unhide(id)}>Ne plus masquer {messages.find(item => item.author?.id === id)?.author?.displayName ?? 'ce joueur'}</button>)}</div></details>}
    <div className="message-list" ref={list} onScroll={onScroll} aria-live="off">{!loaded && <p className="chat-status">Chargement du Chat…</p>}{loaded && !messages.length && <p className="chat-status">Aucun message pour le moment.</p>}
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
        const avatarStyle = message.author?.elementKey && message.author.elementKey in elementColors ? { '--chat-avatar-color': elementColors[message.author.elementKey as keyof typeof elementColors] } as CSSProperties : undefined
        const replyTo = () => { setReply(message); setMenuId(null) }
        const mentionAuthor = () => { if (!message.author) return; setDraft(value => `${value}${value && !value.endsWith(' ') ? ' ' : ''}@${message.author!.displayName} `); setMentions(value => [...value, { playerId: message.author!.id, displayName: message.author!.displayName }]); setMenuId(null) }
        return <article className={`chat-message${message.mentionedMe || message.repliedToMe ? ' chat-message-mentioned' : ''}${optimistic ? ' chat-message-optimistic' : ''}`} key={message.id}>
          {game ? <div className="message-avatar chat-game-avatar" aria-hidden="true">✦</div> : <button type="button" className="message-avatar chat-avatar-button" style={avatarStyle} aria-label={`Profil de ${message.authorLabel}`} onClick={() => message.author && onOpenProfile(message.author.id)}>{message.authorLabel?.slice(0, 1).toLocaleUpperCase('fr-FR')}</button>}
          <div className="message-content"><div className="message-meta">{game ? <strong className="chat-game-label">GachaImpact</strong> : <button type="button" className="chat-author-button" onClick={() => message.author && onOpenProfile(message.author.id)}>{message.authorLabel}</button>}<time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</time></div>
            {message.replyToMessageId && <div className="chat-reply-preview">↳ {message.replyPreview ?? 'Message supprimé'}</div>}
            <p>{masked ? <>Message masqué — <button type="button" onClick={() => setRevealed(value => [...value, message.id])}>Afficher</button></> : message.deletionState === 'AUTHOR' ? 'Message supprimé' : message.deletionState === 'MODERATION' ? 'Message supprimé par la modération' : linkChatText(message.content ?? '')}</p>
            {canAct && <><div className="chat-message-actions" aria-label={`Actions pour le message de ${message.authorLabel}`}>
              {canReply && <button type="button" title="Répondre" aria-label="Répondre" onClick={replyTo}>↩</button>}
              {canMention && <button type="button" title="Mentionner" aria-label="Mentionner" onClick={mentionAuthor}>@</button>}
              {canReport && <button type="button" title="Signaler" aria-label="Signaler" onClick={() => setReportId(message.id)}>⚑</button>}
              {canMask && <button type="button" title="Masquer ce joueur" aria-label="Masquer ce joueur" onClick={() => hide(message.author!.id)}>◌</button>}
              {canDelete && <button type="button" title="Supprimer" aria-label="Supprimer" onClick={() => void remove(message.id)}>×</button>}
            </div>
            <button type="button" className="chat-message-menu-button" aria-label={`Actions pour le message de ${message.authorLabel}`} aria-expanded={menuId === message.id} onClick={() => setMenuId(value => value === message.id ? null : message.id)}>⋯</button>
            {menuId === message.id && <div className="chat-message-menu" role="menu">{canReply && <button type="button" role="menuitem" onClick={replyTo}>Répondre</button>}{canMention && <button type="button" role="menuitem" onClick={mentionAuthor}>Mentionner</button>}{canReport && <button type="button" role="menuitem" onClick={() => { setReportId(message.id); setMenuId(null) }}>Signaler</button>}{canMask && <button type="button" role="menuitem" onClick={() => hide(message.author!.id)}>Masquer les messages de ce joueur</button>}{canDelete && <button type="button" role="menuitem" onClick={() => void remove(message.id)}>Supprimer</button>}</div>}</>}
          </div>
        </article>
      })}</div>
    {newCount > 0 && <button type="button" className="chat-new-messages" onClick={scrollBottom}>{newCount} nouveau{newCount > 1 ? 'x' : ''} message{newCount > 1 ? 's' : ''} ↓</button>}
    <div className="chat-composer-wrap">
      {reportId && <div className="chat-report-confirm" role="dialog" aria-label="Confirmer le signalement"><p>Signaler ce message ?</p><button type="button" onClick={() => void report(reportId)}>Confirmer</button><button type="button" onClick={() => setReportId(null)}>Annuler</button></div>}
      {!!suggestions.length && <div className="chat-mention-suggestions" role="listbox" aria-label="Joueurs à mentionner">{suggestions.map(person => <button type="button" role="option" aria-selected={false} key={person.id} onClick={() => mention(person)}>{person.displayName}</button>)}</div>}
      <div className="chat-composer-accessory">{reply && <div className="chat-composer-reply">Réponse à {reply.authorLabel}<button type="button" onClick={() => setReply(null)} aria-label="Annuler la réponse">×</button></div>}
        {!!ambiguousIntents.length && <div className="chat-status">{ambiguousIntents.length === 1 ? 'Envoi non confirmé.' : `${ambiguousIntents.length} envois non confirmés.`} <button type="button" disabled={pending} onClick={() => void submitIntent(ambiguousIntents[0]!)}>Réessayer</button></div>}
        {error && !ambiguousIntents.length && <p className="chat-status chat-error" role="alert">{error}</p>}{feedback && !error && !ambiguousIntents.length && <p className="chat-status" role="status">{feedback}</p>}
      </div>
      <form className="chat-composer" autoComplete="off" onSubmit={send}><label className="sr-only" htmlFor="chat-message">Écrire un message</label><input id="chat-message" name="chat-composer-current-message" autoComplete="off" type="text" value={draft} onChange={event => { const value = Array.from(event.target.value).slice(0, 500).join(''); setDraft(value); setSuggestions([]); setMentions(current => current.filter(item => value.includes(`@${item.displayName}`))) }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} maxLength={1000} placeholder="Écrire un message…" /><button type="submit" disabled={pending || !draft.trim()} aria-label="Envoyer le message"><span className="icon-glyph">➤</span></button></form>
    </div>
  </aside>
}
export default ChatPanel
