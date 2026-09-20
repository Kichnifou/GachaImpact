import { describe, expect, it } from 'vitest'
import type { NotificationDto } from '../api/types'
import { resolveNotificationPresentation } from './notification-presentation'

const pending: NotificationDto = {
  id: 'event-notification', domainKey: 'event', typeKey: 'EVENT_MESSAGES_PENDING',
  payload: { count: 3 }, state: 'UNREAD', actionKey: 'OPEN_EVENT_MESSAGES',
  actionTargetId: 'edition-id', createdAt: '2026-09-16T12:00:00Z', readAt: null,
}

describe('Event message notification presentation', () => {
  it('presents a received friend request as a Social requests destination', () => {
    expect(resolveNotificationPresentation({ ...pending, domainKey: 'social', typeKey: 'FRIEND_REQUEST_RECEIVED', actionKey: 'OPEN_SOCIAL_REQUESTS', actionTargetId: 'sender-id', payload: { senderDisplayName: 'Mynonyme' } })).toEqual({ title: 'Demande d’ami', message: 'Mynonyme vous a envoyé une demande d’ami.', destination: 'social-requests' })
  })
  it('routes lifecycle announcements and last-day reminders without exposing balances', () => {
    expect(resolveNotificationPresentation({ ...pending, typeKey: 'EVENT_EDITION_AVAILABLE', actionKey: 'OPEN_EVENT', payload: { title: 'Festival', message: 'Disponible' } })).toMatchObject({ title: 'Festival', message: 'Disponible', destination: 'event' })
    expect(resolveNotificationPresentation({ ...pending, typeKey: 'EVENT_EDITION_LAST_DAY', actionKey: 'OPEN_EVENT_SHOP', payload: { title: 'Festival', message: 'Dernier jour' } })).toMatchObject({ destination: 'event-shop' })
  })
  it('shows one aggregate count with a typed Panier destination', () => {
    expect(resolveNotificationPresentation(pending)).toEqual({ title: 'Messages du Festival', message: 'Vous avez 3 messages du Festival à consulter.', destination: 'event-messages' })
    expect(resolveNotificationPresentation({ ...pending, payload: { count: 1 } }).message).toContain('1 message du Festival')
  })

  it('does not infer navigation from notification text', () => {
    expect(resolveNotificationPresentation({ ...pending, actionKey: null }).destination).toBeNull()
  })
})
