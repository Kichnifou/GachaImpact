import { describe, expect, it } from 'vitest'
import type { NotificationDto } from '../api/types'
import { resolveNotificationNavigation } from './notification-navigation'

const base: NotificationDto = {
  id: 'n', domainKey: 'missions', typeKey: 'PERMANENT_MISSION_COMPLETED',
  payload: { missionExternalKey: 'messages_b', rank: 'B', displayName: 'Bavard du jour', rewardPrimogems: '160' },
  actionKey: 'OPEN_MISSIONS', actionTargetId: 'messages_b', state: 'UNREAD', createdAt: '2026-09-30T12:00:00Z', readAt: null,
}

describe('notification navigation registry', () => {
  it('opens and archives only Arcade invitations, including stale links, while refusal stays informational', () => {
    const invite = { ...base, domainKey: 'arcade', typeKey: 'ARCADE_INVITE', actionKey: 'OPEN_ARCADE_INVITE', actionTargetId: 'old-invitation', payload: { invitationId: 'old-invitation', message: 'Axel vous invite à jouer à Memory.' } }
    expect(resolveNotificationNavigation(invite)).toEqual({ destination: 'arcade-invite', targetId: 'old-invitation', archiveOnOpen: true })
    expect(resolveNotificationNavigation({ ...invite, typeKey: 'ARCADE_INVITE_REFUSED' })).toEqual({ destination: null, targetId: null, archiveOnOpen: false })
    expect(resolveNotificationNavigation({ ...invite, actionKey: 'OPEN_SOCIAL_REQUESTS' }).destination).toBeNull()
  })
  it('routes a Mission to Missions without automatic archive', () => {
    expect(resolveNotificationNavigation(base)).toEqual({ destination: 'missions', targetId: null, archiveOnOpen: false })
  })

  it.each([
    ['expedition', 'ready', 'open-expedition-character', 'expedition'],
    ['gift-codes', 'GIFT_CODE_AVAILABLE', 'OPEN_GIFT_CODE', 'gift-code'],
    ['monthly-boss', 'MONTHLY_BOSS_DEFEATED', 'OPEN_MONTHLY_BOSS', 'monthly-boss'],
    ['event', 'EVENT_MESSAGES_PENDING', 'OPEN_EVENT_MESSAGES', 'event-messages'],
    ['event', 'EVENT_EDITION_AVAILABLE', 'OPEN_EVENT', 'event'],
    ['event', 'EVENT_EDITION_LAST_DAY', 'OPEN_EVENT_SHOP', 'event-shop'],
    ['social', 'FRIEND_REQUEST_RECEIVED', 'OPEN_SOCIAL_REQUESTS', 'social-requests'],
    ['social', 'FRIEND_REQUEST_ACCEPTED', 'OPEN_SOCIAL_FRIENDS', 'social-friends'],
    ['trades', 'TRADES_PENDING', 'OPEN_TRADES', 'trades'],
    ['trades', 'TRADE_ACCEPTED', 'OPEN_TRADES_HISTORY', 'trades-history'],
    ['appearance', 'CHARACTER_AVATARS_UNLOCKED', 'OPEN_PROFILE_PERSONALIZATION', 'profile-personalization'],
    ['appearance', 'COSMETIC_UNLOCKED', 'OPEN_PROFILE_PERSONALIZATION', 'profile-personalization'],
  ])('keeps %s:%s destination', (domainKey, typeKey, actionKey, destination) => {
    expect(resolveNotificationNavigation({ ...base, domainKey, typeKey, actionKey, actionTargetId: 'target' }).destination).toBe(destination)
  })

  it('rejects an action that does not match its physical type', () => {
    expect(resolveNotificationNavigation({ ...base, actionKey: 'OPEN_EVENT' }).destination).toBeNull()
  })

  it.each([
    ['social', 'FRIEND_REQUEST_ACCEPTED', 'OPEN_SOCIAL_FRIENDS'],
    ['trades', 'TRADE_ACCEPTED', 'OPEN_TRADES_HISTORY'],
    ['appearance', 'CHARACTER_AVATARS_UNLOCKED', 'OPEN_PROFILE_PERSONALIZATION'],
  ])('preserves %s:%s auto archive', (domainKey, typeKey, actionKey) => {
    expect(resolveNotificationNavigation({ ...base, domainKey, typeKey, actionKey }).archiveOnOpen).toBe(true)
  })
})
