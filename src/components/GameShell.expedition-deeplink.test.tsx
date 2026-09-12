// @vitest-environment happy-dom

import { act, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BoxCharacterDto, DailyCombatDto, ExpeditionDto, PlayerBoxDto } from '../api/types'
import { createExpeditionClientSnapshot } from '../expedition/expedition-client-snapshot'
import { defaultNavigationPreference, hashForScreen } from '../navigation/navigation'
import GameShell from './GameShell'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  document.body.replaceChildren()
  window.location.hash = ''
})

describe('GameShell Expedition deep-link', () => {
  it('opens the RUNNING character once, stays closed on a normal Box return, and reopens for a second intent', async () => {
    const keqing: BoxCharacterDto = { id: 'keqing-id', externalKey: 'keqing', name: 'Keqing', rarity: 5, elementKey: 'electro', weaponType: 'Épée', region: 'Liyue', iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null, constellation: 0, copies: 1, firstObtainedAt: '2026-09-12T12:00:00Z', favorite: false, c6CompetitionStats: null }
    const box: PlayerBoxDto = { characters: [keqing], summary: { totalOwned: 1, fiveStars: 1, fourStars: 0, c6: 0 }, preference: { sortKey: 'alphabetical', direction: 'asc' }, stella: { quantity: '0' } }
    const expedition: ExpeditionDto = { businessDate: '2026-09-12', operationalStatus: 'RUNNING', departureUsedToday: true, canStartToday: false, activeCharacter: keqing, departedAt: '2026-09-12T01:00:00Z', readyAt: '2026-09-12T21:00:00Z', remainingSeconds: 72_000, startedOnCurrentBusinessDate: true, totalCompleted: '0' }
    const dailyCombat: DailyCombatDto = { businessDate: '2026-09-12', status: 'TODO', encounter: { id: 'encounter', enemies: [] }, loadout: { nextAttemptMode: 'MANUAL', slots: [1, 2, 3, 4].map((position) => ({ position: position as 1 | 2 | 3 | 4, character: null, ko: false })) }, availableCharacters: [], koCharacterIds: [], availableCharacterCount: 1, preview: null, canFight: false, reward: { primogems: '800', moras: '20000' }, lastAttempt: null, playerStats: { totalFights: '0', totalWins: '0', totalLosses: '0', totalManualWins: '0' } }
    const props = {
      player: { id: 'player-id', displayName: 'Synthetic Player', elementKey: 'electro', status: 'ACTIVE' },
      resources: { primogems: '0', moras: '0', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } },
      progression: { totalXp: '0', level: 1, xpIntoCurrentStep: '0', xpPerStep: '30', isMaxLevel: false, level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0' },
      levelUpFeedbacks: [], onLevelUpFeedbackFinished: vi.fn(),
      wheelToday: { spun: false, businessDate: '2026-09-12', result: null }, onSpinWheel: vi.fn(),
      dailyRewardToday: { claimed: false, businessDate: '2026-09-12', rewards: { primogems: '800', moras: '50000', mainElementParticles: '500' } }, onClaimDailyReward: vi.fn(),
      dailyChallenge: { businessDate: '2026-09-12', status: 'AVAILABLE', assigned: false, purchaseCost: '10000', challenge: null, switchCount: 0, nextSwitchCost: null, canSwitch: false, completedAt: null }, onPurchaseDailyChallenge: vi.fn(), onSwitchDailyChallenge: vi.fn(),
      dailyCombat,
      expedition: createExpeditionClientSnapshot(expedition, 0), expeditionMonotonicNow: 0,
      notifications: { unreadCount: 0, notifications: [] },
      onLoadExpedition: vi.fn(async () => expedition), onStartExpedition: vi.fn(), onClaimExpedition: vi.fn(),
      onLoadNotifications: vi.fn(async () => ({ unreadCount: 0, notifications: [] })), onReadNotification: vi.fn(), onReadAllNotifications: vi.fn(), onArchiveReadNotifications: vi.fn(),
      onLoadDailyCombat: vi.fn(async () => dailyCombat), onSetDailyCombatSlot: vi.fn(), onRemoveDailyCombatSlot: vi.fn(), onCopyActiveTeamToDailyCombat: vi.fn(), onAutoSelectDailyCombat: vi.fn(), onClearDailyCombatLoadout: vi.fn(), onFightDailyCombat: vi.fn(),
      onSignOut: vi.fn(),
      gacha: { banner: { id: 'banner', startsAt: '', endsAt: '', featuredFiveStars: [], featuredFourStars: [] }, playerState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' } },
      characters: [], teams: { teams: [], availableCharacters: [], passiveReference: [] },
      onLoadTeams: vi.fn(), onActivateTeam: vi.fn(), onRenameTeam: vi.fn(), onCreateNextTeam: vi.fn(), onDeleteTeam: vi.fn(), onReorderTeams: vi.fn(), onSetTeamSlot: vi.fn(), onReorderTeamSlots: vi.fn(), onRemoveTeamSlot: vi.fn(), onClearTeam: vi.fn(),
      onSetGachaTarget: vi.fn(), onPullGacha: vi.fn(), pendingGachaPullCount: null, onGachaPresentationDisclosed: vi.fn(), onGachaPresentationAbandoned: vi.fn(), onGetGachaHistory: vi.fn(),
      onLoadBox: vi.fn(async () => box), onSetBoxFavorite: vi.fn(), onSetBoxSortPreference: vi.fn(), onUseStella: vi.fn(),
      onLoadBank: vi.fn(), onLoadBankHistory: vi.fn(), onDepositBank: vi.fn(), onWithdrawBank: vi.fn(),
      onLoadShop: vi.fn(), onLoadShopHistory: vi.fn(), onPurchaseShop: vi.fn(), onLoadInventory: vi.fn(), onConvertParticles: vi.fn(),
      permissions: { roles: [], capabilities: { moderationAccess: false, selfResourceTools: false, selfGameplayTools: false, superTools: false, canSelectPlayers: false, canManageTesters: false } },
      onLoadModeration: vi.fn(), onListModerationPlayers: vi.fn(), onModerationResource: vi.fn(), onModerationXp: vi.fn(), onModerationGacha: vi.fn(), onModerationStella: vi.fn(), onModerationTester: vi.fn(), onModerationApplied: vi.fn(),
      onLoadNavigationPreferences: vi.fn(async () => defaultNavigationPreference), onSaveNavigationPreferences: vi.fn(async (value) => value),
    } as unknown as ComponentProps<typeof GameShell>

    window.location.hash = hashForScreen('activities-dailies')
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => { root.render(<GameShell {...props} />); await Promise.resolve() })

    await clickExpeditionAccess(container)
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toContain('Keqing')

    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Fermer la fiche"]')!.click())
    await navigateByHash('home')
    await navigateByHash('characters-box')
    expect(container.querySelector('[role="dialog"]')).toBeNull()

    await navigateByHash('activities-dailies')
    await clickExpeditionAccess(container)
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toContain('Keqing')
    act(() => root.unmount())
  })
})

async function clickExpeditionAccess(container: HTMLElement) {
  await act(async () => {
    container.querySelector<HTMLElement>('[data-daily-activity="Expédition"]')!.querySelector<HTMLButtonElement>('button')!.click()
    await Promise.resolve()
  })
}

async function navigateByHash(screen: Parameters<typeof hashForScreen>[0]) {
  await act(async () => {
    window.location.hash = hashForScreen(screen)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await Promise.resolve()
  })
}
