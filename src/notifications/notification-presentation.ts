import type { NotificationDto } from '../api/types'

export type NotificationDestination = 'expedition' | 'gift-code' | 'monthly-boss'
export type NotificationPresentation = Readonly<{ title: string; message: string; destination: NotificationDestination | null }>
type Resolver = (notification: NotificationDto) => NotificationPresentation

const resolvers: Readonly<Record<string, Resolver>> = {
  'expedition:ready': (notification) => ({
    title: 'Expédition terminée',
    message: `${text(notification.payload.characterName, 'Votre personnage')} est revenu.`,
    destination: notification.actionKey === 'open-expedition-character' && Boolean(notification.actionTargetId) ? 'expedition' : null,
  }),
  'gift-codes:GIFT_CODE_AVAILABLE': (notification) => ({
    title: 'Code cadeau disponible',
    message: giftCodeMessage(notification),
    destination: notification.actionKey === 'OPEN_GIFT_CODE' && Boolean(notification.actionTargetId) ? 'gift-code' : null,
  }),
  'monthly-boss:MONTHLY_BOSS_DEFEATED': (notification) => ({
    title: text(notification.payload.title, 'Boss vaincu'),
    message: text(notification.payload.message, 'Votre récompense a été versée automatiquement.'),
    destination: notification.actionKey === 'OPEN_MONTHLY_BOSS' ? 'monthly-boss' : null,
  }),
}

export function resolveNotificationPresentation(notification: NotificationDto): NotificationPresentation {
  return resolvers[`${notification.domainKey}:${notification.typeKey}`]?.(notification) ?? {
    title: 'Notification',
    message: text(notification.payload.message, 'Une nouvelle information est disponible.'),
    destination: null,
  }
}

function giftCodeMessage(notification: NotificationDto) {
  const title = text(notification.payload.title, '')
  const token = text(notification.payload.token, '')
  if (title && token) return `${title} · ${token}`
  return title || token || 'Un nouveau code peut être récupéré.'
}

function text(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}
