import { describe, expect, it } from 'vitest'
import { confirmedDailyDate, dailyIds, dailySuggestions, dailyActionableSuggestions, dailyOngoingItems, dailySummaryMessage, projectDailies, type DailyId, type DailySources } from './daily-summary'
import { dailySources, character, day, event, expedition } from './daily-test-fixtures'
import { createExpeditionClientSnapshot } from '../expedition/expedition-client-snapshot'
const item = (id: DailyId, sources: DailySources = dailySources()) => projectDailies(sources).find(row => row.id === id)!

describe('Shared daily business projection', () => {
  it.each([
    ['IDLE', false, false, true, 'available'],
    ['RUNNING', true, true, false, 'completed'],
    ['RUNNING', false, false, false, 'in_progress'],
    ['READY', true, true, false, 'available'],
    ['READY', false, false, false, 'available'],
    ['IDLE', true, true, false, 'completed'],
    ['IDLE', false, false, true, 'available'],
  ] as const)('projects expedition %s startedToday=%s usedToday=%s consistently for all daily surfaces', (operationalStatus, startedOnCurrentBusinessDate, departureUsedToday, canStartToday, state) => {
    const source = dailySources(), value = { ...expedition, operationalStatus, startedOnCurrentBusinessDate, departureUsedToday, canStartToday, activeCharacter: operationalStatus === 'IDLE' ? null : character }
    const projected = item('expedition', { ...source, expedition: createExpeditionClientSnapshot(value, 0) })
    expect(projected.state).toBe(state)
    expect(projected.actionable).toBe(state === 'available')
    if (operationalStatus === 'READY') expect(projected.status).toBe('À récupérer')
    if (operationalStatus === 'RUNNING' && startedOnCurrentBusinessDate) expect(projected.status).toBe('✅ Terminé')
    if (state === 'completed') expect(dailySuggestions([projected])).toEqual([])
  })
  it('keeps nine owners in canonical order, counts each actionable activity once, and gives reward then READY priority', () => {
    const source = dailySources(), items = projectDailies(source)
    expect(items.map(row => row.id)).toEqual(dailyIds)
    expect(dailySummaryMessage(items)).toBe('8 activités disponibles')
    const ready = projectDailies({ ...source, expedition: createExpeditionClientSnapshot({ ...expedition, operationalStatus: 'READY', activeCharacter: character, canStartToday: false }, 0) })
    expect(dailySuggestions(ready).slice(0, 3).map(row => row.id)).toEqual(['reward', 'expedition', 'wheel'])
    expect(dailySummaryMessage(ready, ['reward', 'wheel'])).toBe('6 activités disponibles')
  })
  it.each(dailyIds)('never treats missing %s as available or completed', id => {
    const source = { ...dailySources(), [id]: undefined }
    if (id === 'friendship') source.friendshipDate = undefined
    expect(item(id, source)).toMatchObject({ state: 'unknown', actionable: false })
  })
  it.each(dailyIds)('preserves confirmed content but excludes failed %s from the count', id => {
    const source = dailySources(), before = item(id, source), failed = item(id, { ...source, errors: { [id]: true } })
    expect(failed).toMatchObject({ state: 'error', actionable: false })
    expect(failed.detail).toBe(before.detail); expect(failed.obtained).toBe(before.obtained)
  })
  it('does not expose an unpurchased Challenge objective, while active and completed snapshots use real progress and gains', () => {
    const source = dailySources(), challenge = source.challenge!
    expect(item('challenge').detail).toBe('Objectif révélé après achat.')
    const objective = { externalKey: 'pulls', type: 'pulls' as const, displayName: 'Vœux', description: 'Invocations', progressLabel: 'Invocations effectuées', progress: '2', target: '5', rewardPrimogems: '800' }
    expect(item('challenge', { ...source, challenge: { ...challenge, assigned: true, status: 'ACTIVE', challenge: objective } })).toMatchObject({ state: 'in_progress', actionable: true, status: 'Vœux · 2 / 5' })
    expect(item('challenge', { ...source, challenge: { ...challenge, assigned: true, status: 'COMPLETED', challenge: { ...objective, progress: '5' } } })).toMatchObject({ state: 'completed', actionable: false, obtained: '+800 Primogemmes' })
  })
  it('keeps Faveur passive, including inactive and server presence still pending', () => {
    const source = dailySources(), favor = source.favor!
    expect(item('favor', { ...source, favor: { ...favor, active: false, claimStatus: 'UNAVAILABLE' } })).toMatchObject({ state: 'unavailable', actionable: false })
    expect(item('favor', { ...source, favor: { ...favor, claimedToday: false, claimStatus: 'AVAILABLE' } })).toMatchObject({ state: 'waiting', actionable: false })
  })
  it.each(['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'] as const)('uses Combat attempt state %s rather than formation as completion', status => {
    const source = dailySources(), row = item('combat', { ...source, combat: { ...source.combat!, status } })
    expect(row.state).toBe({ TODO: 'available', IN_PROGRESS: 'in_progress', BLOCKED: 'ineligible', COMPLETED: 'completed' }[status])
    expect(row.actionable).toBe(status === 'TODO' || status === 'IN_PROGRESS')
    if (status === 'TODO') expect(row.status).toBe('Formation à préparer')
  })
  it.each(['AVAILABLE', 'USED', 'DEFEATED'] as const)('uses the native Boss attack state %s and damage', attackState => {
    const source = dailySources(), row = item('boss', { ...source, boss: { ...source.boss!, attackState, todayDamage: '12345' } })
    expect(row.state).toBe(attackState === 'AVAILABLE' ? 'available' : 'completed')
    expect(row.damage).toBe('12 345')
    expect(item('boss', { ...source, boss: { ...source.boss!, availableCharacters: [] } }).actionable).toBe(false)
  })
  it('distinguishes running, ready, new departure and used departure, and never awards at countdown zero', () => {
    const source = dailySources(), running = { ...expedition, operationalStatus: 'RUNNING' as const, activeCharacter: character, remainingSeconds: 2, canStartToday: false, readyAt: '2026-10-02T12:00:00Z' }
    const zero = item('expedition', { ...source, expedition: createExpeditionClientSnapshot(running, 1000), monotonicNow: 9000 })
    expect(zero).toMatchObject({ state: 'in_progress', actionable: false, detail: 'Keqing · 00:00:00' }); expect(zero.obtained).toBeUndefined()
    expect(item('expedition', { ...source, expedition: createExpeditionClientSnapshot({ ...running, operationalStatus: 'READY' }, 1000) })).toMatchObject({ state: 'available', status: 'À récupérer' })
    expect(item('expedition').state).toBe('available')
    expect(item('expedition', { ...source, expedition: createExpeditionClientSnapshot({ ...expedition, departureUsedToday: true, canStartToday: false }, 0) }).state).toBe('completed')
    expect(item('expedition', { ...source, expedition: createExpeditionClientSnapshot({ ...expedition, canStartToday: false }, 0) }).state).toBe('ineligible')
  })
  it('uses only real friendship summary, including no friends, partial send and all sent', () => {
    const source = dailySources()
    expect(item('friendship')).toMatchObject({ state: 'available', status: '2 cœur(s) à envoyer', obtained: '+5 Primogemmes' })
    expect(item('friendship', { ...source, friendship: { activeFriends: 0, available: 0, alreadySent: 0 } }).state).toBe('unavailable')
    expect(item('friendship', { ...source, friendship: { activeFriends: 3, available: 0, alreadySent: 3 } }).state).toBe('completed')
  })
  it('keeps Event General → A → B → C priority and separates a future A window from an actionable attempt', () => {
    const source = dailySources(), joined = { ...event, canJoin: false, participation: { ...event.participation, joined: true } }
    expect(item('event').destination).toEqual({ kind: 'event', destination: { section: 'registration' } })
    expect(item('event', { ...source, event: joined })).toMatchObject({ state: 'waiting', actionable: false, destination: { kind: 'event', destination: { section: 'games', game: 0 } } })
    expect(item('event', { ...source, event: { ...joined, gameA: { ...joined.gameA, canAttempt: true } } }).actionable).toBe(true)
    const afterA = { ...joined, gameA: { ...joined.gameA, completedToday: true } }
    expect(item('event', { ...source, event: afterA }).destination).toEqual({ kind: 'event', destination: { section: 'games', game: 1 } })
    const afterB = { ...afterA, gameB: { ...afterA.gameB, solvedToday: true, canAttempt: false } }
    expect(item('event', { ...source, event: afterB }).destination).toEqual({ kind: 'event', destination: { section: 'games', game: 2 } })
    expect(item('event', { ...source, event: { ...afterB, gameC: { ...afterB.gameC, canSend: false, unviewedCount: 1 } } }).actionable).toBe(true)
    expect(item('event', { ...source, event: { ...afterB, gameC: { ...afterB.gameC, canSend: false } } }).state).toBe('completed')
  })
  it('changes masks only on a server confirmed business date and never reuses yesterday availability', () => {
    const source = dailySources()
    expect(confirmedDailyDate(source)).toBe(day)
    const next = { ...source, reward: { ...source.reward!, businessDate: '2026-10-03' } }
    expect(confirmedDailyDate(next)).toBe('2026-10-03')
    expect(item('wheel', next)).toMatchObject({ state: 'unknown', actionable: false })
    expect(dailySummaryMessage(projectDailies({}))).toBe('État du jour incomplet')
    expect(dailySummaryMessage(projectDailies(source), [...dailyIds])).toBe('Aucune activité affichée')
  })
  it('respects Event calendar priority, collective B completion and nonparticipant incoming messages', () => {
    const source = dailySources()
    const nonparticipant = { ...event, canJoin: false, gameC: { ...event.gameC, canSend: false, unviewedCount: 2 } }
    expect(item('event', { ...source, event: nonparticipant })).toMatchObject({ actionable: true, destination: { kind: 'event', destination: { section: 'games', game: 2 } } })
    const collective = { ...nonparticipant, participation: { ...event.participation, joined: true }, gameA: { ...event.gameA, completedToday: true }, gameB: { ...event.gameB, solvedToday: true, canAttempt: false } }
    expect(item('event', { ...source, event: collective }).destination).toEqual({ kind: 'event', destination: { section: 'games', game: 2 } })
    const calendar = { startsOn: day, endsOn: '2026-10-31', currentDay: 2, recap: false, canClaimToday: true, days: [] }
    expect(item('event', { ...source, event: { ...collective, calendar } }).destination).toEqual({ kind: 'event', destination: { section: 'registration' } })
    const waiting = { ...collective, gameA: { ...event.gameA, cooldownRemainingMs: 3000, windows: [{ index: 0, startAt: '2026-10-02T16:00:00Z', endAt: '2026-10-02T18:00:00Z', state: 'FUTURE' as const }] } }
    expect(item('event', { ...source, event: waiting })).toMatchObject({ state: 'waiting', actionable: false, deadline: '2026-10-02T16:00:00Z' })
  })
  it('distinguishes native ineligibility from completion and temporary unavailability', () => {
    const rows = projectDailies(dailySources()).map(row => ({ ...row, state: 'completed' as const, actionable: false }))
    expect(dailySummaryMessage(rows)).toBe('Terminé ✅')
    expect(dailySummaryMessage(rows.map(row => row.id === 'boss' ? { ...row, state: 'ineligible' } : row))).toBe('Aucune activité disponible pour le moment')
    expect(dailySummaryMessage(rows.map(row => row.id === 'favor' ? { ...row, state: 'unavailable' } : row))).toBe('Aucune activité disponible pour le moment')
  })
  it('separates masked Home actions from ongoing information while leaving sidebar suggestions mixed', () => {
    const source = dailySources(), running = createExpeditionClientSnapshot({ ...expedition, operationalStatus: 'RUNNING', canStartToday: false, activeCharacter: character, remainingSeconds: 13338 }, 0)
    const items = projectDailies({ ...source, expedition: running, event: { ...event, canJoin: false, participation: { ...event.participation, joined: true } } })
    expect(dailyActionableSuggestions(items).slice(0, 3).map(row => row.id)).toEqual(['reward', 'wheel', 'challenge'])
    expect(dailyOngoingItems(items).map(row => row.id)).toEqual(['expedition', 'event'])
    expect(dailyOngoingItems(items, ['expedition']).map(row => row.id)).toEqual(['event'])
    expect(dailyOngoingItems(items, [], ['expedition']).map(row => row.id)).toEqual(['event'])
    expect(dailySuggestions(items).map(row => row.id)).toContain('expedition')
    const progressing = items.map(row => row.id === 'combat' ? { ...row, state: 'in_progress' as const } : row)
    expect(dailyOngoingItems(progressing).map(row => row.id)).toContain('combat')
    expect(dailyOngoingItems(progressing, [], ['combat']).map(row => row.id)).not.toContain('combat')
    const invalid = items.map(row => row.id === 'reward' ? { ...row, state: 'unknown' as const, actionable: true } : row.id === 'wheel' ? { ...row, state: 'error' as const, actionable: true } : row)
    expect(dailyActionableSuggestions(invalid).map(row => row.id)).not.toContain('reward')
    expect(dailyActionableSuggestions(invalid).map(row => row.id)).not.toContain('wheel')
  })
})
