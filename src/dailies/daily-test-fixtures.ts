import type { DailyCombatDto, EventDto, ExpeditionDto, MonthlyBossCharacterDto } from '../api/types'
import { unavailableMonthlyBoss } from '../combat/monthly-boss-unavailable'
import { createExpeditionClientSnapshot } from '../expedition/expedition-client-snapshot'
import type { DailySources } from './daily-summary'

export const day = '2026-10-02'
export const character: MonthlyBossCharacterDto = { id: 'character', externalKey: 'keqing', name: 'Keqing', rarity: 5, elementKey: 'electro', weaponType: 'Épée', region: 'Liyue', iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null, constellation: 0, copies: 1, firstObtainedAt: `${day}T10:00:00Z`, favorite: false, displayOrder: null }
export const combat: DailyCombatDto = { businessDate: day, status: 'TODO', encounter: { id: 'encounter', enemies: [] }, loadout: { nextAttemptMode: 'MANUAL', slots: [] }, availableCharacters: [], koCharacterIds: [], availableCharacterCount: 4, preview: null, canFight: false, reward: { primogems: '800', moras: '20000' }, lastAttempt: null, playerStats: { totalFights: '0', totalWins: '0', totalLosses: '0', totalManualWins: '0' } }
export const expedition: ExpeditionDto = { businessDate: day, operationalStatus: 'IDLE', departureUsedToday: false, canStartToday: true, activeCharacter: null, departedAt: null, readyAt: null, remainingSeconds: 0, startedOnCurrentBusinessDate: false, totalCompleted: '0' }
export const event: EventDto = {
  businessDate: day, refreshAfterMs: 3600000, festival: { key: 'harvest', month: 10, title: 'Festival de Test', emoji: '🌾', currency: { key: 'tokens', label: 'Jetons', unit: 'Jeton', emoji: '🌾' }, collection: { key: 'collection', label: 'Collection' } },
  edition: { id: 'edition', year: 2026, startsAt: '2026-09-30T22:00:00Z', endsAt: '2026-10-31T23:00:00Z' }, participation: { joined: false, joinedAt: null, points: 0 }, currency: { amount: '7' }, canJoin: true,
  shop: { available: false, balance: '7', rates: { primogems: '160', moras: '20000' }, collection: { itemExternalKey: 'collection', label: 'Collection', cost: '80', obtainedThisEdition: false, available: true } }, dailyBonus: { claimedToday: false, canClaim: false }, milestones: { currentPoints: 0, thresholds: [] },
  gameA: { available: true, theme: { key: 'harvest', label: 'Jeu A' }, completedToday: false, attemptsToday: 0, windows: [], activeWindowIndex: null, canAttempt: false, cooldownRemainingMs: 0 },
  gameB: { available: true, theme: { key: 'harvest', label: 'Jeu B' }, solvedToday: false, resolvedCode: null, discoveredBy: null, attemptsUsed: 0, attemptsRemaining: 3, testedCodes: [], remainingCodes: [], canAttempt: true },
  gameC: { available: true, theme: { key: 'harvest', label: 'Jeu C' }, sentToday: false, canSend: true, receivedMessages: [], unviewedCount: 0 },
}
export function dailySources(): DailySources {
  return { elementKey: 'electro', favor: { businessDate: day, active: true, daysRemaining: 2, maxDays: 180, dailyPrimogems: '800', claimedToday: true, claimStatus: 'CLAIMED' }, reward: { businessDate: day, claimed: false, rewards: { primogems: '800', moras: '50000', mainElementParticles: '500' } }, wheel: { businessDate: day, spun: false, result: null }, challenge: { businessDate: day, status: 'AVAILABLE', assigned: false, purchaseCost: '10000', challenge: null, switchCount: 0, nextSwitchCost: null, canSwitch: false, completedAt: null }, combat, boss: { ...unavailableMonthlyBoss, businessDate: day, attackState: 'AVAILABLE', availableCharacters: Array.from({ length: 4 }, (_, i) => ({ ...character, id: `character-${i}` })) }, expedition: createExpeditionClientSnapshot(expedition, 1000), monotonicNow: 1000, friendship: { activeFriends: 3, available: 2, alreadySent: 1, earnedPrimogemsToday: '5' }, friendshipDate: day, event }
}
