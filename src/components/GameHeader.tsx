import { useEffect, useRef, useState } from 'react'
import type { NotificationDto, NotificationsDto } from '../api/types'

type GameHeaderProps = {
  displayName: string
  onNavigateHome: () => void
  onOpenSidebar: () => void
  onSignOut: () => Promise<void>
  showModeration: boolean
  onOpenModeration: () => void
  onOpenMenu: () => void
  notifications?: NotificationsDto
  onRefreshNotifications?: () => Promise<void>
  onReadNotification?: (id: string) => Promise<NotificationsDto>
  onReadAllNotifications?: () => Promise<NotificationsDto>
  onArchiveReadNotifications?: () => Promise<NotificationsDto>
  onOpenNotification?: (notification: NotificationDto) => void
}

const emptyNotifications: NotificationsDto = { unreadCount: 0, notifications: [] }
function GameHeader({ displayName, onNavigateHome, onOpenSidebar, onSignOut, showModeration, onOpenModeration, onOpenMenu, notifications = emptyNotifications, onRefreshNotifications = async () => undefined, onReadNotification = async () => emptyNotifications, onReadAllNotifications = async () => emptyNotifications, onArchiveReadNotifications = async () => emptyNotifications, onOpenNotification = () => undefined }: GameHeaderProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const notificationAnchorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isNotificationsOpen) return
    const close = (event: PointerEvent) => { if (!notificationAnchorRef.current?.contains(event.target as Node)) setIsNotificationsOpen(false) }
    document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close)
  }, [isNotificationsOpen])
  useEffect(() => {
    const refresh = () => void onRefreshNotifications().catch(() => undefined)
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible)
    const timer = window.setInterval(refresh, 60_000)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); window.clearInterval(timer) }
  }, [onRefreshNotifications])
  const open = async (notification: NotificationDto) => { if (notification.state === 'UNREAD') await onReadNotification(notification.id); setIsNotificationsOpen(false); onOpenNotification(notification) }
  return <header className="game-header">
    <button type="button" className="brand" onClick={onNavigateHome} aria-label="GachaImpact — accueil"><span className="brand-mark" aria-hidden="true">✦</span><span><strong>Gacha<span>Impact</span></strong><small>Chroniques astrales</small></span></button>
    <div className="header-actions">
      <button type="button" className="mobile-player-button" onClick={onOpenSidebar}><span aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span><strong>{displayName}</strong></button>
      <button type="button" className="menu-header-button" onClick={onOpenMenu}>Menu</button>
      {showModeration && <button type="button" className="moderation-header-button" onClick={onOpenModeration}>Modération</button>}
      <button type="button" className="sign-out-button" onClick={() => void onSignOut()}>Déconnexion</button>
      <div className="notification-anchor" ref={notificationAnchorRef}>
        <button type="button" className={`header-icon-button${isNotificationsOpen ? ' active' : ''}`} onClick={() => { setIsNotificationsOpen(value => !value); void onRefreshNotifications().catch(() => undefined) }} aria-label="Afficher les notifications" aria-expanded={isNotificationsOpen}><span aria-hidden="true">♢</span>{notifications.unreadCount > 0 && <span className="header-count">{notifications.unreadCount}</span>}</button>
        {isNotificationsOpen && <section className="floating-panel notifications-panel" aria-label="Notifications">
          <div className="floating-panel-heading"><div><span className="eyebrow">Activité</span><h2>Notifications</h2></div>{notifications.unreadCount > 0 && <button type="button" className="text-action" onClick={() => void onReadAllNotifications()}>Tout marquer comme lu</button>}</div>
          <div className="notification-list">{notifications.notifications.length === 0 ? <p className="notification-empty">Aucune notification.</p> : notifications.notifications.map(notification => <button type="button" className={`notification-item${notification.state === 'UNREAD' ? ' unread' : ''}`} onClick={() => void open(notification)} key={notification.id}><span className="notification-symbol" aria-hidden="true">✦</span><span><strong>Expédition terminée</strong><p>{String(notification.payload.characterName ?? 'Votre personnage')} est revenu.</p><small>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(notification.createdAt))}</small></span>{notification.state === 'UNREAD' && <span className="notification-dot" aria-label="Non lue" />}</button>)}</div>
          {notifications.notifications.some(item => item.state === 'READ') && <div className="floating-panel-footer"><button type="button" onClick={() => void onArchiveReadNotifications()}>Archiver les notifications lues</button></div>}
        </section>}
      </div>
    </div>
  </header>
}
export default GameHeader
