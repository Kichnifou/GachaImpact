import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import type { EventDto } from '../api/types'
import { eventCurrencyLabel, eventDailyDetail, eventHasActionableContentToday, eventPresentation } from './event-presentation'

const event = (joined: boolean, completedToday: boolean, states: readonly ('PAST' | 'ACTIVE' | 'FUTURE')[], canJoin = !joined): EventDto => ({
  businessDate: '2026-09-15', refreshAfterMs: 1000,
  festival: { key: 'harvest', month: 9, title: 'Festival des Récoltes', emoji: '', currency: { key: 'harvest-tokens', label: 'Jetons de Récolte', unit: 'Jeton de Récolte', emoji: '' }, collection: { key: 'harvest-sheaf', label: 'Gerbe de Récolte' } },
  edition: { id: 'edition', year: 2026, startsAt: '', endsAt: '' },
  participation: { joined, joinedAt: joined ? '2026-09-15T08:00:00.000Z' : null, points: 0 }, currency: { amount: '1' }, canJoin,
  dailyBonus: { claimedToday: true, canClaim: false }, milestones: { currentPoints: 0, thresholds: [] },
  gameA: { available: joined, theme: { key: 'recolte', label: 'Récolte' }, completedToday, attemptsToday: 0, windows: states.map((state, index) => ({ startAt: `${index}`, endAt: `${index + 1}`, state })), activeWindowIndex: null, canAttempt: false, cooldownRemainingMs: 0 },
  gameB: { available: joined, theme: { key: 'harvest', label: 'Festival des Récoltes' }, solvedToday: false, resolvedCode: null, discoveredBy: null, attemptsUsed: 0, attemptsRemaining: joined ? 3 : 0, testedCodes: [], remainingCodes: [], canAttempt: false },
  gameC: { available: joined, theme: { key: 'harvest', label: 'Panier' }, sentToday: false, canSend: false, receivedMessages: [], unviewedCount: 0 },
})

describe('Event presentation', () => {
  it('uses the authoritative singular or plural from the Festival projection', () => {
    expect(eventCurrencyLabel('1', event(true, false, []).festival.currency)).toBe('Jeton de Récolte')
    expect(eventCurrencyLabel('2', event(true, false, []).festival.currency)).toBe('Jetons de Récolte')
    expect(eventPresentation('harvest').games).toEqual(['Récolte', 'Grenier', 'Panier'])
  })

  it('exposes a daily CTA only while a real Event action remains', () => {
    expect(eventHasActionableContentToday(event(false, false, []))).toBe(true)
    expect(eventDailyDetail(event(false, false, []))).toBe('Participation disponible')
    expect(eventHasActionableContentToday(event(true, false, ['PAST', 'FUTURE']))).toBe(true)
    expect(eventDailyDetail(event(true, false, ['ACTIVE']))).toBe('Jeu du jour disponible')
    expect(eventHasActionableContentToday(event(true, true, ['FUTURE']))).toBe(false)
    expect(eventDailyDetail(event(true, true, ['FUTURE']))).toBe('Jeu du jour réussi')
    expect(eventHasActionableContentToday(event(true, false, ['PAST', 'PAST', 'PAST']))).toBe(false)
    expect(eventDailyDetail(event(true, false, ['PAST']))).toBe('Délai dépassé')
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
    expect(eventDailyDetail(withB(event(true, true, ['PAST'])))).toBe('Énigme du jour disponible')
    expect(eventHasActionableContentToday(withB(event(true, false, ['PAST'])))).toBe(true)
    expect(eventHasActionableContentToday(event(true, false, ['PAST']))).toBe(false)
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
