import type { NotificationDto } from '../api/types'
import { formatResourceAmount } from '../utils/formatters'

export type NotificationDestination = 'expedition' | 'gift-code' | 'monthly-boss' | 'event-messages'
export type NotificationRewardPresentation = Readonly<{ resourceKey: string; label: string; amount: string }>
export type NotificationPresentation = Readonly<{ title: string; message: string; rewards?: readonly NotificationRewardPresentation[]; destination: NotificationDestination | null }>
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
    rewards: rewardPresentation(notification.payload.rewards),
    destination: notification.actionKey === 'OPEN_MONTHLY_BOSS' ? 'monthly-boss' : null,
  }),
  'event:EVENT_MESSAGES_PENDING': (notification) => {
    const count = typeof notification.payload.count === 'number' && Number.isInteger(notification.payload.count) && notification.payload.count > 0 ? notification.payload.count : 1
    return { title: 'Messages du Festival', message: `Vous avez ${count} message${count > 1 ? 's' : ''} du Festival à consulter.`, destination: notification.actionKey === 'OPEN_EVENT_MESSAGES' ? 'event-messages' : null }
  },
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

function rewardPresentation(value: unknown): readonly NotificationRewardPresentation[] | undefined {
  if (!Array.isArray(value)) return undefined
  const rewards = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const resourceKey = 'resourceKey' in entry && typeof entry.resourceKey === 'string' ? entry.resourceKey : ''
    const amount = 'amount' in entry && typeof entry.amount === 'string' && /^\d+$/.test(entry.amount) ? entry.amount : ''
    if (!resourceKey || !amount) return []
    const label = resourceKey === 'primogems' ? 'Primos' : resourceKey === 'moras' ? 'Moras' : resourceKey
    return [{ resourceKey, label, amount: formatResourceAmount(amount) }]
  })
  return rewards.length ? rewards : undefined
}
