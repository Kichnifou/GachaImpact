import type { NotificationDto } from '../api/types'
import { resolveNotificationPresentation, type NotificationDestination } from './notification-presentation'

export type NotificationNavigation = Readonly<{
  destination: NotificationDestination | null
  targetId: string | null
  archiveOnOpen: boolean
}>

/** The presentation registry validates domain, type and action before navigation. */
export function resolveNotificationNavigation(notification: NotificationDto): NotificationNavigation {
  const destination = resolveNotificationPresentation(notification).destination
  return {
    destination,
    targetId: destination === 'expedition' ? notification.actionTargetId : null,
    archiveOnOpen: destination !== null && (
      notification.typeKey === 'FRIEND_REQUEST_ACCEPTED' ||
      notification.typeKey === 'TRADE_ACCEPTED' ||
      notification.typeKey === 'CHARACTER_AVATARS_UNLOCKED'
    ),
  }
}
