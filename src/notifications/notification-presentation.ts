import type { NotificationDto } from '../api/types'
import { formatResourceAmount } from '../utils/formatters'

export type NotificationDestination = 'arcade-invite' | 'expedition' | 'gift-code' | 'monthly-boss' | 'event-messages' | 'event' | 'event-shop' | 'social-requests' | 'social-friends' | 'trades' | 'trades-history' | 'profile-personalization' | 'missions'
export type NotificationRewardPresentation = Readonly<{ resourceKey: string; label: string; amount: string }>
export type NotificationPresentation = Readonly<{ title: string; message: string; rewards?: readonly NotificationRewardPresentation[]; destination: NotificationDestination | null }>
type Resolver = (notification: NotificationDto) => NotificationPresentation

const resolvers: Readonly<Record<string, Resolver>> = {
  'arcade:ARCADE_INVITE': notification => ({ title: 'Invitation Arcade', message: text(notification.payload.message, 'Vous avez reçu une invitation Arcade.'), destination: notification.actionKey === 'OPEN_ARCADE_INVITE' ? 'arcade-invite' : null }),
  'arcade:ARCADE_INVITE_REFUSED': notification => ({ title: 'Invitation refusée', message: text(notification.payload.message, 'Votre invitation Arcade a été refusée.'), destination: null }),
  'missions:PERMANENT_MISSION_COMPLETED': notification => ({ title: 'Mission terminée', message: text(notification.payload.displayName, 'Mission permanente'), rewards: [{ resourceKey: 'primogems', label: 'Primogemmes', amount: formatResourceAmount(text(notification.payload.rewardPrimogems, '0')) }], destination: notification.actionKey === 'OPEN_MISSIONS' ? 'missions' : null }),
  'giveaway:GIVEAWAY_REWARD': notification => ({ title: text(notification.payload.title, '🎉 Récompense Giveaway'),
    message: text(notification.payload.message, 'Votre récompense Giveaway a déjà été créditée.'), destination: null }),
  'gift-supreme:GIFT_SUPREME_RECEIVED': notification => ({ title: '🎁 Gift Suprême reçu', message: text(notification.payload.message, 'Un Gift Suprême vous a été offert.'), destination: null }),
  'appearance:CHARACTER_AVATARS_UNLOCKED': notification => {
    const count = typeof notification.payload.count === 'number' && Number.isSafeInteger(notification.payload.count) && notification.payload.count > 0 ? notification.payload.count : 1
    return { title: count === 1 ? 'Nouvel avatar débloqué' : `${count} nouveaux avatars débloqués`, message: 'Disponibles dans Profil > Personnalisation.', destination: notification.actionKey === 'OPEN_PROFILE_PERSONALIZATION' ? 'profile-personalization' : null }
  },
  'appearance:COSMETIC_UNLOCKED': notification => ({ title: 'Cosmétique débloqué', message: `${text(notification.payload.displayName, 'Un cosmétique')} est disponible dans votre Profil.`, destination: notification.actionKey === 'OPEN_PROFILE_PERSONALIZATION' ? 'profile-personalization' : null }),
  'trades:TRADE_ACCEPTED': notification => ({ title: 'Échange accepté', message: `${text(notification.payload.accepterDisplayName, 'Un joueur')} a accepté votre échange de particules.`, destination: notification.actionKey === 'OPEN_TRADES_HISTORY' ? 'trades-history' : null }),
  'trades:TRADES_PENDING': notification => ({ title: 'Échanges de particules', message: `${typeof notification.payload.count === 'number' ? notification.payload.count : 0} demande(s) d’échange en attente`, destination: notification.actionKey === 'OPEN_TRADES' ? 'trades' : null }),
  'social:FRIEND_REQUEST_RECEIVED': (notification) => ({ title: 'Demande d\u2019ami', message: `${text(notification.payload.senderDisplayName, 'Un joueur')} vous a envoy\u00e9 une demande d\u2019ami.`, destination: notification.actionKey === 'OPEN_SOCIAL_REQUESTS' ? 'social-requests' : null }),
  'social:FRIEND_REQUEST_ACCEPTED': (notification) => ({ title: 'Nouvel ami', message: `${text(notification.payload.acceptorDisplayName, 'Un joueur')} a accept\u00e9 votre demande d\u2019ami.`, destination: notification.actionKey === 'OPEN_SOCIAL_FRIENDS' ? 'social-friends' : null }),
  'event:EVENT_EDITION_AVAILABLE': (notification) => ({ title: text(notification.payload.title, 'Festival du mois'), message: text(notification.payload.message, 'Le Festival du mois est disponible.'), destination: notification.actionKey === 'OPEN_EVENT' ? 'event' : null }),
  'event:EVENT_EDITION_LAST_DAY': (notification) => ({ title: text(notification.payload.title, 'Festival du mois'), message: text(notification.payload.message, 'Le Festival se termine aujourd’hui !'), destination: notification.actionKey === 'OPEN_EVENT_SHOP' ? 'event-shop' : null }),
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
