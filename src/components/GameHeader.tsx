import { useEffect, useRef, useState } from 'react'
import { notifications } from '../data/mockData'

type GameHeaderProps = {
  displayName: string
  onNavigateHome: () => void
  onOpenSidebar: () => void
  onSignOut: () => Promise<void>
}

function GameHeader({ displayName, onNavigateHome, onOpenSidebar, onSignOut }: GameHeaderProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const notificationAnchorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isNotificationsOpen) return

    const closeNotificationsOnOutsideClick = (event: PointerEvent) => {
      if (!notificationAnchorRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeNotificationsOnOutsideClick)

    return () => document.removeEventListener('pointerdown', closeNotificationsOnOutsideClick)
  }, [isNotificationsOpen])

  return (
    <header className="game-header">
      <button type="button" className="brand" onClick={onNavigateHome} aria-label="GachaImpact — accueil">
        <span className="brand-mark" aria-hidden="true">✦</span>
        <span>
          <strong>Gacha<span>Impact</span></strong>
          <small>Chroniques astrales</small>
        </span>
      </button>

      <div className="header-actions">
        <button type="button" className="mobile-player-button" onClick={onOpenSidebar}>
          <span aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
          <strong>{displayName}</strong>
        </button>

        <button type="button" className="sign-out-button" onClick={() => void onSignOut()}>
          Déconnexion
        </button>

        <div className="notification-anchor" ref={notificationAnchorRef}>
          <button
            type="button"
            className={`header-icon-button${isNotificationsOpen ? ' active' : ''}`}
            onClick={() => setIsNotificationsOpen((current) => !current)}
            aria-label="Afficher les notifications"
            aria-expanded={isNotificationsOpen}
          >
            <span aria-hidden="true">♢</span>
            <span className="header-count">3</span>
          </button>

          {isNotificationsOpen && (
            <section className="floating-panel notifications-panel" aria-label="Notifications fictives">
              <div className="floating-panel-heading">
                <div><span className="eyebrow">Activité</span><h2>Notifications</h2></div>
                <button type="button" className="text-action">Tout marquer comme lu</button>
              </div>
              <div className="notification-list">
                {notifications.map((notification) => (
                  <article className="notification-item" key={notification.id}>
                    <span className="notification-symbol" aria-hidden="true">{notification.icon}</span>
                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.detail}</p>
                      <small>{notification.time}</small>
                    </div>
                    {notification.unread && <span className="notification-dot" aria-label="Non lue" />}
                  </article>
                ))}
              </div>
              <div className="floating-panel-footer">
                <button type="button">Archiver les notifications lues</button>
                <button type="button">Voir toutes les notifications →</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </header>
  )
}

export default GameHeader
