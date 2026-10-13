import { useState } from 'react'
import type { EventDto } from '../api/types'
import AppButton from '../components/AppButton'

const time = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })

export default function EventMessageInbox({ messages }: { messages: EventDto['gameC']['receivedMessages'] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const index = Math.max(0, messages.findIndex(message => message.id === selectedId))
  const message = messages[index]
  return <div className="event-game-c-inbox">
    <header className="event-message-heading"><h3>Messages reçus aujourd’hui</h3>
      {messages.length > 1 && <nav aria-label="Messages du Festival">
        <AppButton aria-label="Message précédent" disabled={index === 0} onClick={() => setSelectedId(messages[index - 1].id)}>‹</AppButton>
        <span aria-live="polite">{index + 1} / {messages.length}</span>
        <AppButton aria-label="Message suivant" disabled={index === messages.length - 1} onClick={() => setSelectedId(messages[index + 1].id)}>›</AppButton>
      </nav>}
    </header>
    {message ? <article><div><strong>{message.sender.displayName}</strong><time dateTime={message.createdAt}>{time.format(new Date(message.createdAt))}</time></div><p>{message.message}</p></article> : <p>Aucun message reçu aujourd’hui.</p>}
  </div>
}
