import { useEffect, useRef, useState } from 'react'
import type { NotificationDto, NotificationsDto } from '../api/types'
import { resolveNotificationPresentation } from '../notifications/notification-presentation'
import AppButton from './AppButton'

type GameHeaderProps = {
  displayName: string
  onNavigateHome: () => void
  onOpenSidebar: () => void
  onSignOut: () => Promise<void>
  showModeration: boolean
  onOpenModeration: () => void
  onOpenMenu: () => void
  notifications?: NotificationsDto
  pollSessionKey?: string
  onRefreshNotifications?: () => Promise<unknown>
  onReadNotification?: (id: string) => Promise<NotificationsDto>
  onArchiveNotification?: (id: string) => Promise<NotificationsDto>
  onReadAllNotifications?: () => Promise<NotificationsDto>
  onArchiveReadNotifications?: () => Promise<NotificationsDto>
  onOpenNotification?: (notification: NotificationDto) => void
}

const emptyNotifications: NotificationsDto = { unreadCount: 0, notifications: [] }
function GameHeader({ displayName, onNavigateHome, onOpenSidebar, onSignOut, showModeration, onOpenModeration, onOpenMenu, notifications = emptyNotifications, pollSessionKey, onRefreshNotifications = async () => undefined, onReadNotification = async () => emptyNotifications, onArchiveNotification = async () => emptyNotifications, onReadAllNotifications = async () => emptyNotifications, onArchiveReadNotifications = async () => emptyNotifications, onOpenNotification = () => undefined }: GameHeaderProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [archivingNotificationId, setArchivingNotificationId] = useState<string | null>(null)
  const notificationAnchorRef = useRef<HTMLDivElement>(null)
  const refreshNowRef = useRef<() => void>(() => undefined)
  useEffect(() => {
    if (!isNotificationsOpen) return
    const close = (event: PointerEvent) => { if (!notificationAnchorRef.current?.contains(event.target as Node)) setIsNotificationsOpen(false) }
    document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close)
  }, [isNotificationsOpen])
  useEffect(() => {
    let active = true
    let inFlight = false
    let timer: number | undefined
    const schedule = () => { if (active && document.visibilityState === 'visible') timer = window.setTimeout(refresh, isNotificationsOpen ? 3_000 : 15_000) }
    const refresh = () => {
      if (!active || inFlight || document.visibilityState !== 'visible') return
      window.clearTimeout(timer)
      inFlight = true
      void onRefreshNotifications().catch(() => undefined).finally(() => { inFlight = false; schedule() })
    }
    const visible = () => { window.clearTimeout(timer); if (document.visibilityState === 'visible') refresh() }
    refreshNowRef.current = refresh
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visible)
    schedule()
    return () => { active = false; refreshNowRef.current = () => undefined; window.clearTimeout(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible) }
  }, [onRefreshNotifications, pollSessionKey, isNotificationsOpen])
  const open = (notification: NotificationDto) => {
    const presentation = resolveNotificationPresentation(notification)
    if (presentation.destination === null) {
      if (notification.state === 'UNREAD') void onReadNotification(notification.id).catch(() => undefined)
      return
    }
    setIsNotificationsOpen(false)
    onOpenNotification(notification)
    if ((notification.domainKey === 'social' && notification.typeKey === 'FRIEND_REQUEST_ACCEPTED' && notification.actionKey === 'OPEN_SOCIAL_FRIENDS') ||
      (notification.domainKey === 'trades' && notification.typeKey === 'TRADE_ACCEPTED' && notification.actionKey === 'OPEN_TRADES_HISTORY')) {
      void onArchiveNotification(notification.id).catch(() => undefined)
      return
    }
    if (notification.state === 'UNREAD') void onReadNotification(notification.id).catch(() => undefined)
  }
  const archive = async (notificationId: string) => {
    setArchivingNotificationId(notificationId)
    try { await onArchiveNotification(notificationId) } finally { setArchivingNotificationId((current) => current === notificationId ? null : current) }
  }
  return <header className="game-header">
    <button type="button" className="brand" onClick={onNavigateHome} aria-label="GachaImpact — accueil"><span className="brand-mark" aria-hidden="true">✦</span><span><strong>Gacha<span>Impact</span></strong><small>Chroniques astrales</small></span></button>
    <div className="header-actions">
      <button type="button" className="mobile-player-button" onClick={onOpenSidebar}><span aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span><strong>{displayName}</strong></button>
      <button type="button" className="menu-header-button" onClick={onOpenMenu}>Menu</button>
      {showModeration && <button type="button" className="moderation-header-button" onClick={onOpenModeration}>Modération</button>}
      <button type="button" className="sign-out-button" onClick={() => void onSignOut()}>Déconnexion</button>
      <div className="notification-anchor" ref={notificationAnchorRef}>
        <button type="button" className={`header-icon-button${isNotificationsOpen ? ' active' : ''}`} onClick={() => { setIsNotificationsOpen(value => !value); refreshNowRef.current() }} aria-label="Afficher les notifications" aria-expanded={isNotificationsOpen}><span aria-hidden="true">♢</span>{notifications.unreadCount > 0 && <span className="header-count">{notifications.unreadCount}</span>}</button>
        {isNotificationsOpen && <section className="floating-panel notifications-panel" aria-label="Notifications">
          <div className="floating-panel-heading"><div><span className="eyebrow">Activité</span><h2>Notifications</h2></div>{notifications.unreadCount > 0 && <button type="button" className="text-action" onClick={() => void onReadAllNotifications()}>Tout marquer comme lu</button>}</div>
          <div className="notification-list">{notifications.notifications.length === 0 ? <p className="notification-empty">Aucune notification.</p> : notifications.notifications.map(notification => { const presentation = resolveNotificationPresentation(notification); const actionable = presentation.destination !== null; const archiving = archivingNotificationId === notification.id; return <div className="notification-row" key={notification.id}><button type="button" className={`notification-item${notification.state === 'UNREAD' ? ' unread' : ''}${actionable ? ' actionable' : ''}`} data-actionable={actionable ? 'true' : 'false'} onClick={() => void open(notification)}><span className="notification-symbol" aria-hidden="true">✦</span><span><strong>{presentation.title}</strong><p>{presentation.message}</p>{presentation.rewards && <span className="notification-rewards">{presentation.rewards.map((reward) => `+${reward.amount} ${reward.label}`).join(' · ')}</span>}<small>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(notification.createdAt))}</small></span>{notification.state === 'UNREAD' && <span className="notification-dot" aria-label="Non lue" />}</button><AppButton variant="icon" className="notification-archive-button" aria-label="Supprimer la notification" aria-busy={archiving} disabled={archiving} onClick={() => void archive(notification.id)}>×</AppButton></div> })}</div>
          {notifications.notifications.some(item => item.state === 'READ') && <div className="floating-panel-footer"><button type="button" onClick={() => void onArchiveReadNotifications()}>Archiver les notifications lues</button></div>}
        </section>}
      </div>
    </div>
  </header>
}
export default GameHeader
