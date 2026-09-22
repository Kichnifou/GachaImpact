import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, getGameApiClient } from '../api/game-api'
import type { ChatMentionDto, ChatMessageDto, ChatRefreshScope } from '../api/types'

type Props = { playerId: string; connectedCount?: number | null; isCollapsed: boolean; onToggle: () => void; onOpenPlayers: () => void; onOpenProfile: (id: string) => void; onRefreshScopes: (scopes: readonly ChatRefreshScope[]) => Promise<void> }
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

function ChatPanel({ playerId, isCollapsed, onToggle, onOpenPlayers, onOpenProfile, onRefreshScopes, connectedCount = null }: Props) {
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
  const [ambiguous, setAmbiguous] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [hidden, setHidden] = useState<string[]>(() => { try { return JSON.parse(sessionStorage.getItem(`chat.hidden.${playerId}`) ?? '[]') as string[] } catch { return [] } })
  const [revealed, setRevealed] = useState<string[]>([])
  const intent = useRef<Intent | null>(null)
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

  const unreadNow = useCallback(async () => setUnread((await api.unread()).unreadCount), [api])
  const messagesNow = useCallback(async (initial: boolean) => {
    const page = await api.messages()
    const current = messagesRef.current
    const previous = new Set(current.map(item => item.id))
    const fresh = initial ? [] : page.messages.filter(item => !previous.has(item.id))
    const updates = new Map(page.messages.map(item => [item.id, item]))
    const newlySeen = fresh.filter(item => !unseenIds.current.has(item.id))
    if (newlySeen.length && !atBottom.current) setNewCount(count => count + newlySeen.length)
    if (!initial && !atBottom.current && current.length >= 350) {
      newlySeen.forEach(item => unseenIds.current.add(item.id))
      deferredLatest.current = true
      const next = current.map(item => updates.get(item.id) ?? item)
      messagesRef.current = next
      setMessages(next)
      return
    }
    const next = initial ? page.messages : [...current.map(item => updates.get(item.id) ?? item), ...fresh].slice(-350)
    if (initial) { deferredLatest.current = false; unseenIds.current.clear(); setNewCount(0) }
    messagesRef.current = next
    setMessages(next)
    if (initial) { atBottom.current = false; setCursor(page.nextCursor); setLoaded(true); requestAnimationFrame(() => { if (list.current) { list.current.scrollTop = list.current.scrollHeight; atBottom.current = true; const id = page.messages.at(-1)?.id; if (id && readId.current !== id) { readId.current = id; void api.read(id).then(() => setUnread(0)).catch(() => { readId.current = null }) } } }) }
  }, [api])

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
    const id = messages.at(-1)!.id
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
      prepend.current = anchor
      setMessages(current => [...page.messages.filter(item => !current.some(old => old.id === item.id)), ...current].slice(0, 350))
      setCursor(page.nextCursor)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Historique indisponible.') }
    finally { olderBusy.current = false }
  }
  const markRecent = () => { const id = messagesRef.current.at(-1)?.id; if (id && !document.hidden && !isCollapsed && readId.current !== id) { readId.current = id; void api.read(id).then(() => setUnread(0)).catch(() => { readId.current = null }) } }
  const scrollBottom = () => { if (deferredLatest.current) { void messagesNow(true).catch(cause => setError(cause instanceof Error ? cause.message : 'Chat indisponible.')); return } if (list.current) list.current.scrollTop = list.current.scrollHeight; atBottom.current = true; setNewCount(0); markRecent() }
  const onScroll = () => { if (!list.current) return; atBottom.current = list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 80; if (atBottom.current) { if (deferredLatest.current) scrollBottom(); else { setNewCount(0); markRecent() } } if (list.current.scrollTop < 90) void loadOlder() }

  useEffect(() => {
    const match = draft.match(/(?:^|\s)@([^\s@]+)$/u), version = ++searchVersion.current
    if (!match) return
    const timer = setTimeout(() => { void api.mentions(match[1]!).then(value => { if (version === searchVersion.current) setSuggestions(value.players) }).catch(() => { if (version === searchVersion.current) setSuggestions([]) }) }, 220)
    return () => clearTimeout(timer)
  }, [api, draft])
  useEffect(() => { const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuId(null); setReportId(null); setSuggestions([]) } }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape) }, [])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (pending || !draft.trim() || Array.from(draft.trim()).length > 500) return
    const next = intent.current ?? { key: crypto.randomUUID(), content: draft.trim(), replyId: reply?.id ?? null, mentions: mentions.filter(item => draft.includes(`@${item.displayName}`)) }
    intent.current = next; setPending(true); setError(null)
    try {
      const result = await api.send(next.content, next.key, next.replyId, next.mentions)
      intent.current = null; setAmbiguous(false); setDraft(''); setReply(null); setMentions([]); setSuggestions([])
      setMessages(current => { const known = new Set(current.map(item => item.id)); return [...current, ...[result.message, ...result.results].filter(item => !known.has(item.id))].slice(-350) })
      requestAnimationFrame(scrollBottom)
      if (result.refreshScopes.length) void onRefreshScopes(result.refreshScopes).catch(() => setFeedback('Message envoyé. Certaines données se mettront à jour au prochain chargement.'))
      if (result.dailyChallengeCompleted) setFeedback('Défi Messages terminé !')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Envoi indisponible.')
      if (cause instanceof ApiError && cause.status !== null && cause.status < 500) { intent.current = null; setAmbiguous(false) }
      else setAmbiguous(true)
    } finally { setPending(false) }
  }

  const remove = async (id: string) => { setMenuId(null); try { await api.remove(id); setMessages(current => current.map(message => message.id === id ? { ...message, deletionState: 'AUTHOR', content: null } : message.replyToMessageId === id ? { ...message, replyPreview: 'Message supprimé' } : message)); setFeedback('Message supprimé.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Suppression indisponible.') } }
  const report = async (id: string) => { try { await api.report(id); setReportId(null); setFeedback('Message signalé.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Signalement indisponible.') } }
  const hide = (id: string) => { const next = [...new Set([...hidden, id])]; setHidden(next); sessionStorage.setItem(`chat.hidden.${playerId}`, JSON.stringify(next)); setMenuId(null) }
  const mention = (person: { id: string; displayName: string }) => { setDraft(value => value.replace(/@[^\s@]*$/u, `@${person.displayName} `)); setMentions(value => [...value.filter(item => item.playerId !== person.id), { playerId: person.id, displayName: person.displayName }]); setSuggestions([]) }

  if (isCollapsed) return <aside className="chat-panel collapsed" aria-label="Chat global replié"><button type="button" className="chat-expand-button" onClick={onToggle} aria-label={`Afficher le chat global, ${unread} non lus`}><span aria-hidden="true">‹</span><strong>Chat</strong>{unread > 0 && <span className="unread-count">{unread > 99 ? '99+' : unread}</span>}</button></aside>
  return <aside className="chat-panel panel" aria-label="Chat global">
    <div className="chat-header"><div><span className="eyebrow">Communauté</span><h2>Chat global</h2></div><button type="button" className="icon-button" onClick={onToggle} aria-label="Replier le chat global"><span className="icon-glyph">›</span></button></div>
    <button type="button" className="chat-presence" onClick={onOpenPlayers}><span className="status-dot" />{connectedCount === null ? 'Joueurs connectés' : `${connectedCount} joueur${connectedCount > 1 ? 's' : ''} connecté${connectedCount > 1 ? 's' : ''}`}<span aria-hidden="true">›</span></button>
    <div className="message-list" ref={list} onScroll={onScroll} aria-live="off">{!loaded && <p className="chat-status">Chargement du Chat…</p>}{loaded && !messages.length && <p className="chat-status">Aucun message pour le moment.</p>}
      {messages.map(message => {
        const own = message.author?.id === playerId, game = message.messageType === 'GAME_RESULT' || message.messageType === 'SYSTEM'
        const masked = !!message.author && hidden.includes(message.author.id) && !revealed.includes(message.id)
        return <article className={`chat-message${message.mentionedMe ? ' chat-message-mentioned' : ''}`} key={message.id}>
          {game ? <div className="message-avatar chat-game-avatar" aria-hidden="true">✦</div> : <button type="button" className="message-avatar chat-avatar-button" aria-label={`Profil de ${message.authorLabel}`} onClick={() => message.author && onOpenProfile(message.author.id)}>{message.authorLabel?.slice(0, 1).toLocaleUpperCase('fr-FR')}{message.author?.elementKey && <small>{message.author.elementKey.slice(0, 2)}</small>}</button>}
          <div className="message-content"><div className="message-meta">{game ? <strong className="chat-game-label">GachaImpact</strong> : <button type="button" className="chat-author-button" onClick={() => message.author && onOpenProfile(message.author.id)}>{message.authorLabel}</button>}<time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</time></div>
            {message.replyToMessageId && <div className="chat-reply-preview">↳ {message.replyPreview ?? 'Message supprimé'}</div>}
            <p>{masked ? <>Message masqué — <button type="button" onClick={() => setRevealed(value => [...value, message.id])}>Afficher</button></> : message.deletionState === 'AUTHOR' ? 'Message supprimé' : message.deletionState === 'MODERATION' ? 'Message supprimé par la modération' : linkChatText(message.content ?? '')}</p>
            {message.mentionedMe && <span className="chat-mention-label">Vous êtes mentionné</span>}
            <button type="button" className="chat-message-menu-button" aria-label={`Actions pour le message de ${message.authorLabel}`} aria-expanded={menuId === message.id} onClick={() => setMenuId(value => value === message.id ? null : message.id)}>⋯</button>
            {menuId === message.id && <div className="chat-message-menu" role="menu">{message.deletionState === 'ACTIVE' && <button type="button" role="menuitem" onClick={() => { setReply(message); setMenuId(null) }}>Répondre</button>}{own ? message.deletionState === 'ACTIVE' && <button type="button" role="menuitem" onClick={() => void remove(message.id)}>Supprimer</button> : !game && message.author && <><button type="button" role="menuitem" onClick={() => { setDraft(value => `${value}${value && !value.endsWith(' ') ? ' ' : ''}@${message.author!.displayName} `); setMentions(value => [...value, { playerId: message.author!.id, displayName: message.author!.displayName }]); setMenuId(null) }}>Mentionner</button>{message.deletionState === 'ACTIVE' && <button type="button" role="menuitem" onClick={() => { setReportId(message.id); setMenuId(null) }}>Signaler</button>}<button type="button" role="menuitem" onClick={() => hide(message.author!.id)}>Masquer les messages de ce joueur</button></>}</div>}
          </div>
        </article>
      })}</div>
    {newCount > 0 && <button type="button" className="chat-new-messages" onClick={scrollBottom}>{newCount} nouveau{newCount > 1 ? 'x' : ''} message{newCount > 1 ? 's' : ''} ↓</button>}
    {reportId && <div className="chat-report-confirm" role="dialog" aria-label="Confirmer le signalement"><p>Signaler ce message ?</p><button type="button" onClick={() => void report(reportId)}>Confirmer</button><button type="button" onClick={() => setReportId(null)}>Annuler</button></div>}
    {reply && <div className="chat-composer-reply">Réponse à {reply.authorLabel} : {reply.deletionState === 'ACTIVE' ? reply.content : 'Message supprimé'} <button type="button" onClick={() => setReply(null)} aria-label="Annuler la réponse">×</button></div>}
    {!!suggestions.length && <div className="chat-mention-suggestions" role="listbox" aria-label="Joueurs à mentionner">{suggestions.map(person => <button type="button" role="option" aria-selected={false} key={person.id} onClick={() => mention(person)}>{person.displayName}</button>)}</div>}
    <form className="chat-composer" onSubmit={event => void send(event)}><label className="sr-only" htmlFor="chat-message">Écrire un message</label><input id="chat-message" type="text" value={draft} onChange={event => { const value = Array.from(event.target.value).slice(0, 500).join(''); setDraft(value); setSuggestions([]); setMentions(current => current.filter(item => value.includes(`@${item.displayName}`))) }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} maxLength={1000} readOnly={ambiguous} placeholder="Écrire un message…" /><button type="submit" disabled={pending || !draft.trim()} aria-label="Envoyer le message"><span className="icon-glyph">➤</span></button></form>
    {pending && <p className="chat-status" role="status">Envoi en cours…</p>}{ambiguous && <p className="chat-status">Envoi non confirmé. Réessayez avec la même clé.</p>}{error && <p className="chat-status chat-error" role="alert">{error}</p>}{feedback && <p className="chat-status" role="status">{feedback}</p>}
  </aside>
}
export default ChatPanel
