import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import type { EventDto } from '../api/types'
import { eventCurrencyLabel, eventHasActionableContentToday, eventNextDailyDestination, eventPresentation } from './event-presentation'

const event = (joined: boolean, completedToday: boolean, states: readonly ('PAST' | 'ACTIVE' | 'FUTURE')[], canJoin = !joined): EventDto => ({
  businessDate: '2026-09-15', refreshAfterMs: 1000,
  festival: { key: 'harvest', month: 9, title: 'Festival des Récoltes', emoji: '', currency: { key: 'harvest-tokens', label: 'Jetons de Récolte', unit: 'Jeton de Récolte', emoji: '' }, collection: { key: 'harvest-sheaf', label: 'Gerbe de Récolte' } },
  edition: { id: 'edition', year: 2026, startsAt: '', endsAt: '' },
  participation: { joined, joinedAt: joined ? '2026-09-15T08:00:00.000Z' : null, points: 0 }, currency: { amount: '1' }, shop: { available: false, balance: '0', rates: { primogems: '160', moras: '20000' }, collection: { itemExternalKey: 'gerbe_de_recolte', label: 'Gerbe de Récolte', cost: '80', obtainedThisEdition: false, available: true } }, canJoin,
  dailyBonus: { claimedToday: true, canClaim: false }, milestones: { currentPoints: 0, thresholds: [] },
  gameA: { available: joined, theme: { key: 'recolte', label: 'Récolte' }, completedToday, attemptsToday: 0, windows: states.map((state, index) => ({ startAt: `${index}`, endAt: `${index + 1}`, state })), activeWindowIndex: null, canAttempt: false, cooldownRemainingMs: 0 },
  gameB: { available: joined, theme: { key: 'harvest', label: 'Festival des Récoltes' }, solvedToday: false, resolvedCode: null, discoveredBy: null, attemptsUsed: 0, attemptsRemaining: joined ? 3 : 0, testedCodes: [], remainingCodes: [], canAttempt: false },
  gameC: { available: joined, theme: { key: 'harvest', label: 'Panier' }, sentToday: false, canSend: false, receivedMessages: [], unviewedCount: 0 },
})

describe('Event presentation', () => {
  it.each(['ACTIVE', 'PAST', 'FUTURE'] as const)('keeps incomplete Game A before unread C with %s windows', state => {
    const base = event(true, false, [state], false)
    const value = { ...base, gameC: { ...base.gameC, unviewedCount: 1 } }
    expect(eventNextDailyDestination(value)).toEqual({ section: 'games', game: 0 })
    expect(eventHasActionableContentToday(value)).toBe(true)
  })
  it('skips a blocked Game B after A is complete and retains C', () => {
    const base = event(true, true, ['PAST'], false)
    const value = { ...base, gameB: { ...base.gameB, canAttempt: false, attemptsRemaining: 0 }, gameC: { ...base.gameC, canSend: true } }
    expect(eventNextDailyDestination(value)).toEqual({ section: 'games', game: 2 })
    expect(eventNextDailyDestination({ ...value, gameC: { ...value.gameC, canSend: false } })).toBeNull()
  })
  it('shares strict General/A/B/C incomplete priority', () => {
    const base = event(true, false, ['FUTURE'], false)
    const all = { ...base, canJoin: true, dailyBonus: { claimedToday: false, canClaim: true }, gameB: { ...base.gameB, canAttempt: true }, gameC: { ...base.gameC, canSend: true, unviewedCount: 2 } }
    expect(eventNextDailyDestination(all)).toEqual({ section: 'registration' })
    expect(eventNextDailyDestination({ ...all, canJoin: false })).toEqual({ section: 'registration' })
    const games = { ...all, canJoin: false, dailyBonus: { claimedToday: true, canClaim: false } }
    expect(eventNextDailyDestination(games)).toEqual({ section: 'games', game: 0 })
    const b = { ...games, gameA: { ...games.gameA, completedToday: true } }
    expect(eventNextDailyDestination(b)).toEqual({ section: 'games', game: 1 })
    const c = { ...b, gameB: { ...b.gameB, solvedToday: true } }
    expect(eventNextDailyDestination(c)).toEqual({ section: 'games', game: 2 })
    expect(eventNextDailyDestination({ ...c, gameC: { ...c.gameC, canSend: true, unviewedCount: 0 } })).toEqual({ section: 'games', game: 2 })
    const completed = { ...c, gameC: { ...c.gameC, canSend: false, unviewedCount: 0 } }
    expect(eventNextDailyDestination(completed)).toBeNull()
    expect(eventHasActionableContentToday(completed)).toBe(false)
    expect(eventNextDailyDestination({ ...b, gameA: { ...games.gameA, windows: [{ startAt: '', endAt: '', state: 'PAST' as const }] } })).toEqual({ section: 'games', game: 0 })
    expect(eventNextDailyDestination({ ...games, participation: { ...games.participation, joined: false }, gameC: { ...games.gameC, canSend: false, unviewedCount: 0 } })).toBeNull()
  })
  it('uses the authoritative singular or plural from the Festival projection', () => {
    expect(eventCurrencyLabel('1', event(true, false, []).festival.currency)).toBe('Jeton de Récolte')
    expect(eventCurrencyLabel('2', event(true, false, []).festival.currency)).toBe('Jetons de Récolte')
    expect(eventPresentation('harvest').games).toEqual(['Récolte', 'Grenier', 'Panier'])
  })

  it('exposes a daily CTA only while a real Event action remains', () => {
    expect(eventHasActionableContentToday(event(false, false, []))).toBe(true)
    expect(eventHasActionableContentToday(event(true, false, ['PAST', 'FUTURE']))).toBe(true)
    expect(eventHasActionableContentToday(event(true, true, ['FUTURE']))).toBe(false)
    expect(eventHasActionableContentToday(event(true, false, ['PAST', 'PAST', 'PAST']))).toBe(true)
  })

  it('lets a next-day server snapshot restore the daily CTA', () => {
    const completed = event(true, true, ['PAST', 'PAST', 'PAST'])
    const nextDay = { ...event(true, false, ['FUTURE']), businessDate: '2026-09-16' }
    expect(eventHasActionableContentToday(completed)).toBe(false)
    expect(eventHasActionableContentToday(nextDay)).toBe(true)
  })

  it('keeps the Event CTA for Game B when Game A is complete or expired', () => {
    const withB = (value: EventDto): EventDto => ({ ...value, gameB: { ...value.gameB, canAttempt: true, remainingCodes: ['00000'] } })
    expect(eventHasActionableContentToday(withB(event(true, true, ['PAST'])))).toBe(true)
    expect(eventHasActionableContentToday(withB(event(true, false, ['PAST'])))).toBe(true)
    expect(eventHasActionableContentToday(event(true, false, ['PAST']))).toBe(true)
    expect(eventHasActionableContentToday({ ...withB(event(true, true, ['PAST'])), gameB: { ...withB(event(true, true, ['PAST'])).gameB, solvedToday: true, canAttempt: false } })).toBe(false)
  })

  it('gives the shared primary button an explicit foreground and a neutral disabled state', () => {
    const css = readFileSync(new URL('../App.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\.small-primary-button\s*\{[^}]*color:\s*#eef7ff;/s)
    expect(css).toMatch(/\.small-primary-button:disabled\s*\{[^}]*background:\s*linear-gradient/s)
    expect(css).not.toMatch(/\.event-game-a-action\s+\.small-primary-button\s*\{[^}]*color:/s)
    expect(css).toMatch(/\.event-game-a-feedback\.success\s*\{[^}]*color:\s*#8df1c8;/s)
    expect(css).toMatch(/\.event-game-a-feedback\.failure\s*\{[^}]*color:\s*#f0a0a9;/s)
  })
})
