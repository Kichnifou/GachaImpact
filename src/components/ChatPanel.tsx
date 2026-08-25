import { chatMessages } from '../data/mockData'

type ChatPanelProps = {
  isCollapsed: boolean
  onToggle: () => void
  onOpenPlayers: () => void
}

function ChatPanel({ isCollapsed, onToggle, onOpenPlayers }: ChatPanelProps) {
  if (isCollapsed) {
    return (
      <aside className="chat-panel collapsed" aria-label="Chat global replié">
        <button type="button" className="chat-expand-button" onClick={onToggle} aria-label="Afficher le chat global">
          <span aria-hidden="true">‹</span>
          <strong>Chat</strong>
          <span className="unread-count">3</span>
        </button>
      </aside>
    )
  }

  return (
    <aside className="chat-panel panel" aria-label="Aperçu du chat global">
      <div className="chat-header">
        <div><span className="eyebrow">Communauté</span><h2>Chat global</h2></div>
        <button type="button" className="icon-button" onClick={onToggle} aria-label="Replier le chat global"><span className="icon-glyph">›</span></button>
      </div>

      <button type="button" className="chat-presence" onClick={onOpenPlayers}>
        <span className="status-dot" />
        28 joueurs en ligne
        <span aria-hidden="true">›</span>
      </button>

      <div className="message-list" aria-live="off">
        {chatMessages.map((message, index) => (
          <article className="chat-message" key={`${message.author}-${message.time}-${index}`}>
            <div className={`message-avatar ${message.tone}`} aria-hidden="true">{message.author.slice(0, 1)}</div>
            <div className="message-content">
              <div className="message-meta">
                <strong className={message.tone}>{message.author}</strong>
                <time>{message.time}</time>
              </div>
              <p>{message.text}</p>
            </div>
          </article>
        ))}
      </div>

      <form className="chat-composer" onSubmit={(event) => event.preventDefault()}>
        <label className="sr-only" htmlFor="chat-message">Écrire un message</label>
        <input id="chat-message" type="text" placeholder="Écrire un message…" />
        <button type="submit" aria-label="Envoyer le message"><span className="icon-glyph">➤</span></button>
      </form>
      <p className="prototype-note">Aperçu visuel — aucun message ne sera envoyé.</p>
    </aside>
  )
}

export default ChatPanel
