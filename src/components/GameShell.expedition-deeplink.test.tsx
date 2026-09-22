// @vitest-environment happy-dom

import { act, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BoxCharacterDto, DailyCombatDto, ExpeditionDto, MonthlyBossDto, PlayerBankDto, PlayerBoxDto } from '../api/types'
import { createExpeditionClientSnapshot } from '../expedition/expedition-client-snapshot'
import { defaultNavigationPreference, hashForScreen } from '../navigation/navigation'
import GameShell from './GameShell'

vi.mock('./ChatPanel', () => ({ default: ({ onRefreshScopes }: { onRefreshScopes: (scopes: string[]) => Promise<void> }) => <div><button data-chat-refresh="xp" onClick={() => void onRefreshScopes(['progression', 'dailyChallenge', 'resources'])}>Bonjour</button><button data-chat-refresh="bank" onClick={() => void onRefreshScopes(['bank', 'resources'])}>!banque deposer 1000</button><button data-chat-refresh="pull" onClick={() => void onRefreshScopes(['resources', 'gacha', 'box', 'inventory', 'dailyChallenge', 'progression', 'teams', 'dailyCombat', 'monthlyBoss', 'contest'])}>!pull 1</button></div> }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  document.body.replaceChildren()
  window.location.hash = ''
})

describe('GameShell Expedition deep-link', () => {
  it('opens the READY character once, stays closed on a normal Box return, and reopens for a second intent', async () => {
    const keqing: BoxCharacterDto = { id: 'keqing-id', externalKey: 'keqing', name: 'Keqing', rarity: 5, elementKey: 'electro', weaponType: 'Épée', region: 'Liyue', iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null, constellation: 0, copies: 1, firstObtainedAt: '2026-09-12T12:00:00Z', favorite: false, c6CompetitionStats: null }
    const box: PlayerBoxDto = { characters: [keqing], summary: { totalOwned: 1, fiveStars: 1, fourStars: 0, c6: 0 }, preference: { sortKey: 'alphabetical', direction: 'asc' }, stella: { quantity: '0' } }
    const expedition: ExpeditionDto = { businessDate: '2026-09-12', operationalStatus: 'READY', departureUsedToday: true, canStartToday: false, activeCharacter: keqing, departedAt: '2026-09-12T01:00:00Z', readyAt: '2026-09-12T21:00:00Z', remainingSeconds: 0, startedOnCurrentBusinessDate: true, totalCompleted: '0' }
    const dailyCombat: DailyCombatDto = { businessDate: '2026-09-12', status: 'TODO', encounter: { id: 'encounter', enemies: [] }, loadout: { nextAttemptMode: 'MANUAL', slots: [1, 2, 3, 4].map((position) => ({ position: position as 1 | 2 | 3 | 4, character: null, ko: false })) }, availableCharacters: [], koCharacterIds: [], availableCharacterCount: 1, preview: null, canFight: false, reward: { primogems: '800', moras: '20000' }, lastAttempt: null, playerStats: { totalFights: '0', totalWins: '0', totalLosses: '0', totalManualWins: '0' } }
    const monthlyBoss: MonthlyBossDto = { businessDate: '2026-09-13', boss: { id: 'boss-id', monthStart: '2026-09-01', name: 'Seigneur des Ruines Oubliées', baseHp: '1500000', hpVariationPercent: 0, maxHp: '1500000', currentHp: '1490000', resistanceElementKey: 'anemo', defeatedAt: null, finalBlowPlayer: null, nextBaseAdjustment: null }, status: 'ALIVE', attackState: 'AVAILABLE', canAttack: false, availableCharacters: [], loadout: { slots: [1, 2, 3, 4].map((position) => ({ position: position as 1 | 2 | 3 | 4, character: null })) }, preview: null, reward: { primogems: '16000', moras: '500000' }, participation: null, ranking: [], defeatedSummary: null, playerStats: { totalDamage: '0', totalAttacks: '0', totalParticipated: '0', totalRewarded: '0', finalBlows: '0', bestHit: '0' } }
    const props = {
      player: { id: 'player-id', displayName: 'Synthetic Player', elementKey: 'electro', status: 'ACTIVE' },
      resources: { primogems: '0', moras: '0', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } },
      progression: { totalXp: '0', level: 1, xpIntoCurrentStep: '0', xpPerStep: '30', isMaxLevel: false, level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0' },
      levelUpFeedbacks: [], onLevelUpFeedbackFinished: vi.fn(),
      wheelToday: { spun: false, businessDate: '2026-09-12', result: null }, onSpinWheel: vi.fn(),
      dailyRewardToday: { claimed: false, businessDate: '2026-09-12', rewards: { primogems: '800', moras: '50000', mainElementParticles: '500' } }, onClaimDailyReward: vi.fn(),
      dailyChallenge: { businessDate: '2026-09-12', status: 'AVAILABLE', assigned: false, purchaseCost: '10000', challenge: null, switchCount: 0, nextSwitchCost: null, canSwitch: false, completedAt: null }, onPurchaseDailyChallenge: vi.fn(), onSwitchDailyChallenge: vi.fn(),
      dailyCombat,
      monthlyBoss,
      expedition: createExpeditionClientSnapshot(expedition, 0), expeditionMonotonicNow: 0,
      notifications: { unreadCount: 0, notifications: [] },
      onLoadExpedition: vi.fn(async () => expedition), onStartExpedition: vi.fn(), onClaimExpedition: vi.fn(),
      onLoadNotifications: vi.fn(async () => ({ unreadCount: 0, notifications: [] })), onReadNotification: vi.fn(), onArchiveNotification: vi.fn(), onReadAllNotifications: vi.fn(), onArchiveReadNotifications: vi.fn(),
      onLoadDailyCombat: vi.fn(async () => dailyCombat), onSetDailyCombatSlot: vi.fn(), onRemoveDailyCombatSlot: vi.fn(), onCopyActiveTeamToDailyCombat: vi.fn(), onAutoSelectDailyCombat: vi.fn(), onClearDailyCombatLoadout: vi.fn(), onFightDailyCombat: vi.fn(),
      onLoadMonthlyBoss: vi.fn(async () => monthlyBoss), onSetMonthlyBossSlot: vi.fn(), onRemoveMonthlyBossSlot: vi.fn(), onCopyActiveTeamToMonthlyBoss: vi.fn(), onClearMonthlyBossLoadout: vi.fn(), onAttackMonthlyBoss: vi.fn(), onLoadMonthlyBossHistory: vi.fn(),
      onSignOut: vi.fn(),
      gacha: { banner: { id: 'banner', startsAt: '', endsAt: '', featuredFiveStars: [], featuredFourStars: [] }, playerState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' } },
      characters: [], teams: { teams: [], availableCharacters: [], passiveReference: [] },
      onLoadTeams: vi.fn(), onActivateTeam: vi.fn(), onRenameTeam: vi.fn(), onCreateNextTeam: vi.fn(), onDeleteTeam: vi.fn(), onReorderTeams: vi.fn(), onSetTeamSlot: vi.fn(), onReorderTeamSlots: vi.fn(), onRemoveTeamSlot: vi.fn(), onClearTeam: vi.fn(),
      onSetGachaTarget: vi.fn(), onPullGacha: vi.fn(), pendingGachaPullCount: null, onGachaPresentationDisclosed: vi.fn(), onGachaPresentationAbandoned: vi.fn(), onGetGachaHistory: vi.fn(),
      onLoadBox: vi.fn(async () => box), onSetBoxFavorite: vi.fn(), onSetBoxSortPreference: vi.fn(), onUseStella: vi.fn(),
      onLoadBank: vi.fn(), onLoadBankHistory: vi.fn(), onDepositBank: vi.fn(), onWithdrawBank: vi.fn(),
      onLoadShop: vi.fn(), onLoadShopHistory: vi.fn(), onPurchaseShop: vi.fn(), onLoadInventory: vi.fn(), onLoadInventoryItemDetail: vi.fn(), onConvertParticles: vi.fn(),
      permissions: { roles: [], capabilities: { moderationAccess: false, selfResourceTools: false, selfGameplayTools: false, superTools: false, canSelectPlayers: false, canManageTesters: false } },
      onLoadModeration: vi.fn(), onListModerationPlayers: vi.fn(), onModerationResource: vi.fn(), onModerationXp: vi.fn(), onModerationGacha: vi.fn(), onModerationStella: vi.fn(), onModerationTester: vi.fn(), onModerationApplied: vi.fn(),
      onLoadNavigationPreferences: vi.fn(async () => defaultNavigationPreference), onSaveNavigationPreferences: vi.fn(async (value) => value),
    } as unknown as ComponentProps<typeof GameShell>

    window.location.hash = hashForScreen('activities-dailies')
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => { root.render(<GameShell {...props} />); await Promise.resolve() })
    expect(props.onLoadNavigationPreferences).toHaveBeenCalledTimes(1)
    await act(async () => { root.render(<GameShell {...props} expeditionMonotonicNow={1_000} />); await Promise.resolve() })
    expect(props.onLoadNavigationPreferences).toHaveBeenCalledTimes(1)

    await clickExpeditionAccess(container)
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toContain('Keqing')

    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Fermer la fiche"]')!.click())
    await navigateByHash('home')
    await navigateByHash('characters-box')
    expect(container.querySelector('[role="dialog"]')).toBeNull()

    await navigateByHash('activities-dailies')
    await clickExpeditionAccess(container)
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toContain('Keqing')

    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Fermer la fiche"]')!.click())
    await navigateByHash('activities-dailies')
    await act(async () => { container.querySelector<HTMLElement>('[data-daily-activity="Boss"]')!.querySelector<HTMLButtonElement>('button')!.click(); await Promise.resolve() })
    expect(window.location.hash).toBe(`#${hashForScreen('activities-combat')}`)
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.combat-tabs button')).find((button) => button.classList.contains('active'))?.textContent).toBe('Boss')
    const pullRefresh = vi.fn(async () => undefined)
    const combatScreen = container.querySelector('.combat-shell')
    const updatedBoss: MonthlyBossDto = { ...monthlyBoss, preview: { totalDamage: '5000', contributions: [{ characterId: keqing.id, characterName: keqing.name, rarity: 5, constellation: 6, elementKey: 'electro', damageBeforeResistance: '5000', resistanceApplied: false, damage: '5000' }] } }
    const updatedCombat: DailyCombatDto = { ...dailyCombat, preview: { baseHalfPoints: 100, rarityBonusHalfPoints: 0, constellationBonusHalfPoints: 12, favorableMatchups: 0, favorableBonusHalfPoints: 0, unfavorableMatchups: 0, unfavorableMalusHalfPoints: 0, rawHalfPoints: 112, clamp: null, finalHalfPoints: 112, memberContributions: [{ characterId: keqing.id, halfPoints: 12 }] } }
    await act(async () => { root.render(<GameShell {...props} onRefreshChatScopes={pullRefresh} />); await Promise.resolve() })
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-chat-refresh="pull"]')!.click(); await Promise.resolve() })
    expect(pullRefresh).toHaveBeenCalledWith(['resources', 'gacha', 'box', 'inventory', 'dailyChallenge', 'progression', 'teams', 'dailyCombat', 'monthlyBoss', 'contest'])
    await act(async () => { root.render(<GameShell {...props} onRefreshChatScopes={pullRefresh} monthlyBoss={updatedBoss} dailyCombat={updatedCombat} />); await Promise.resolve() })
    expect(container.querySelector('.combat-shell')).toBe(combatScreen)
    expect(container.querySelector('.combat-tabs .active')?.textContent).toBe('Boss')
    expect(container.querySelector('.boss-preview')?.textContent).toContain('5\u202f000')
    await act(async () => { container.querySelector<HTMLButtonElement>('.boss-preview button')!.click() })
    expect(container.querySelector('.boss-details')?.textContent).toContain('Keqing · C6')
    await act(async () => { container.querySelector<HTMLButtonElement>('.combat-tabs button')!.click(); await Promise.resolve() })
    expect(container.querySelector('[aria-label="Chance de victoire : 56 pour cent"]')).not.toBeNull()
    const c5Character = { ...keqing, classKey: null, constellation: 5 }
    const teamC5 = { teams: [{ id: 'team', position: 1, name: null, active: true, slots: [1, 2, 3, 4].map((position) => ({ position: position as 1 | 2 | 3 | 4, character: position === 1 ? c5Character : null })), passives: [] }], availableCharacters: [c5Character], passiveReference: [] }
    const readTeamC5 = vi.fn(async () => teamC5)
    await act(async () => { root.render(<GameShell {...props} teams={teamC5} onLoadTeams={readTeamC5} onRefreshChatScopes={pullRefresh} />); await Promise.resolve() })
    await navigateByHash('characters-team')
    const teamScreen = container.querySelector('.team-screen')
    expect(teamScreen?.textContent).toContain('C5')
    const c6Character = { ...c5Character, constellation: 6 }
    const teamC6 = { ...teamC5, teams: teamC5.teams.map(team => ({ ...team, slots: team.slots.map(slot => ({ ...slot, character: slot.character ? c6Character : null })) })), availableCharacters: [c6Character] }
    await act(async () => { root.render(<GameShell {...props} teams={teamC6} onLoadTeams={readTeamC5} onRefreshChatScopes={pullRefresh} />); await Promise.resolve() })
    expect(container.querySelector('.team-screen')).toBe(teamScreen)
    expect(teamScreen?.textContent).toContain('C6')
    await navigateByHash('activities-dailies')

    const bossNotification = { id: 'boss-notification', domainKey: 'monthly-boss', typeKey: 'MONTHLY_BOSS_DEFEATED', payload: { title: 'Boss vaincu', message: 'Récompense versée automatiquement.', rewards: [{ resourceKey: 'primogems', amount: '16000' }, { resourceKey: 'moras', amount: '500000' }] }, state: 'UNREAD' as const, actionKey: 'OPEN_MONTHLY_BOSS', actionTargetId: 'boss-id', createdAt: '2026-09-13T12:00:00Z', readAt: null }
    await act(async () => { root.render(<GameShell {...props} notifications={{ unreadCount: 1, notifications: [bossNotification] }} />); await Promise.resolve() })
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Afficher les notifications"]')!.click(); await Promise.resolve() })
    expect(container.textContent).toContain('Boss vaincu')
    expect(container.textContent).toContain('Récompense versée automatiquement.')
    expect(container.textContent).toContain('+16 000 Primos · +500 000 Moras')
    await act(async () => { container.querySelector<HTMLButtonElement>('.notification-item')!.click(); await Promise.resolve() })
    expect(window.location.hash).toBe(`#${hashForScreen('activities-combat')}`)
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.combat-tabs button')).find((button) => button.classList.contains('active'))?.textContent).toBe('Boss')
    const event = {
      businessDate: '2026-09-15', refreshAfterMs: 3600000,
      festival: { key: 'harvest', month: 9, title: 'Festival des Récoltes', emoji: '🌾', currency: { key: 'harvest-tokens', label: 'Jetons de Récolte', unit: 'Jeton de Récolte', emoji: '🌾' }, collection: { key: 'harvest-sheaf', label: 'Gerbe de Récolte' } },
      edition: { id: 'event-edition', year: 2026, startsAt: '2026-08-31T22:00:00Z', endsAt: '2026-09-30T22:00:00Z' },
      participation: { joined: false, joinedAt: null, points: 0 }, currency: { amount: '0' }, shop: { available: false, balance: '0', rates: { primogems: '160', moras: '20000' }, collection: { itemExternalKey: 'gerbe_de_recolte', label: 'Gerbe de Récolte', cost: '80', obtainedThisEdition: false, available: true } }, canJoin: true,
      dailyBonus: { claimedToday: false, canClaim: false }, milestones: { currentPoints: 0, thresholds: [] },
      gameA: { available: false, theme: { key: 'harvest', label: 'Récolte' }, completedToday: false, attemptsToday: 0, windows: [], activeWindowIndex: null, canAttempt: false, cooldownRemainingMs: 0 },
      gameB: { available: false, theme: { key: 'harvest', label: 'Grenier' }, solvedToday: false, resolvedCode: null, discoveredBy: null, attemptsUsed: 0, attemptsRemaining: 0, testedCodes: [], remainingCodes: [], canAttempt: false },
      gameC: { available: true, theme: { key: 'harvest', label: 'Panier' }, sentToday: false, canSend: false, receivedMessages: [{ id: 'message-1', sender: { id: 'friend-1', displayName: 'Ami' }, message: 'Bon Festival !', createdAt: '2026-09-15T12:00:00Z', viewed: false }], unviewedCount: 1 },
    }
    const eventNotification = { id: 'event-notification', domainKey: 'event', typeKey: 'EVENT_MESSAGES_PENDING', payload: { count: 1 }, state: 'UNREAD' as const, actionKey: 'OPEN_EVENT_MESSAGES', actionTargetId: 'event-edition', createdAt: '2026-09-15T12:00:00Z', readAt: null }
    const onConsultEventGameCMessages = vi.fn(async () => ({ ...event, gameC: { ...event.gameC, unviewedCount: 0, receivedMessages: event.gameC.receivedMessages.map((message) => ({ ...message, viewed: true })) } }))
    await act(async () => { root.render(<GameShell {...props} event={event} onLoadEvent={vi.fn(async () => event)} onJoinEvent={vi.fn()} onAttemptEventGameA={vi.fn()} onConsultEventGameCMessages={onConsultEventGameCMessages} notifications={{ unreadCount: 1, notifications: [eventNotification] }} />); await Promise.resolve() })
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Afficher les notifications"]')!.click(); await Promise.resolve() })
    expect(container.textContent).toContain('1 message du Festival à consulter')
    await act(async () => { container.querySelector<HTMLButtonElement>('.notification-item')!.click(); await Promise.resolve() })
    expect(window.location.hash).toBe(`#${hashForScreen('activities-event')}`)
    expect(container.querySelector('.event-tabs .active')?.textContent).toBe('Jeux')
    expect(container.querySelector('.event-game-tabs .active')?.textContent).toBe('Panier')
    expect(container.querySelector('.event-game-c-inbox')?.textContent).toContain('Bon Festival !')
    expect(onConsultEventGameCMessages).toHaveBeenCalledOnce()
    const eventScreen = container.querySelector('.screen-stage')?.firstElementChild
    const refreshOwners = vi.fn(async () => undefined)
    const eventBankRead = vi.fn(async () => ({ walletMoras: '10000', bankMoras: '0', totalWealth: '10000', estimatedInterest: '0', interestRatePercent: 3 as const, nextInterestAt: '2099-01-01T00:00:00Z', recentOperations: [] }))
    await act(async () => { root.render(<GameShell {...props} event={event} onLoadEvent={vi.fn(async () => event)} onJoinEvent={vi.fn()} onAttemptEventGameA={vi.fn()} onConsultEventGameCMessages={onConsultEventGameCMessages} onRefreshChatScopes={refreshOwners} onLoadBank={eventBankRead} notifications={{ unreadCount: 0, notifications: [] }} />); await Promise.resolve() })
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-chat-refresh="xp"]')!.click(); await Promise.resolve() })
    expect(refreshOwners).toHaveBeenCalledWith(['progression', 'dailyChallenge', 'resources'])
    expect(eventBankRead).not.toHaveBeenCalled()
    expect(container.querySelector('.screen-stage')?.firstElementChild).toBe(eventScreen)
    expect(container.querySelector('.event-game-tabs .active')?.textContent).toBe('Panier')
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-chat-refresh="bank"]')!.click(); await Promise.resolve() })
    expect(container.querySelector('.screen-stage')?.firstElementChild).toBe(eventScreen)
    expect(container.querySelector('.event-game-tabs .active')?.textContent).toBe('Panier')
    await navigateByHash('activities-dailies')
    await navigateByHash('activities-event')
    expect(container.querySelector('.event-tabs .active')?.textContent).toBe('Inscription')
    const acceptedTrade = { id: 'trade-accepted', domainKey: 'trades', typeKey: 'TRADE_ACCEPTED', actionKey: 'OPEN_TRADES_HISTORY', actionTargetId: 'request', state: 'UNREAD' as const, createdAt: '2026-09-21T12:00:00Z', readAt: null, payload: { accepterDisplayName: 'Céo' } }
    const tradeActions = { snapshot: vi.fn(async () => ({ stocks: [], received: [], sent: [], history: [] })), partners: vi.fn(async () => ({ partners: [], page: 1, pageSize: 10 as const, total: 0, totalPages: 1 })), create: vi.fn(), mutate: vi.fn(), all: vi.fn() }
    const onReadNotification = vi.fn(async () => ({ unreadCount: 0, notifications: [] })), onArchiveNotification = vi.fn()
    await act(async () => root.render(<GameShell {...props} tradeActions={tradeActions} onReadNotification={onReadNotification} onArchiveNotification={onArchiveNotification} notifications={{ unreadCount: 1, notifications: [acceptedTrade] }} />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Afficher les notifications"]')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('.notification-item')!.click())
    expect(window.location.hash).toBe('#trades')
    expect(container.querySelector('.trade-tabs [aria-current="page"]')?.textContent).toBe('Historique')
    expect(onReadNotification).toHaveBeenCalledExactlyOnceWith(acceptedTrade.id)
    expect(onArchiveNotification).not.toHaveBeenCalled()
    expect(tradeActions.partners).not.toHaveBeenCalled()
    const bankBefore: PlayerBankDto = { walletMoras: '10000', bankMoras: '0', totalWealth: '10000', estimatedInterest: '0', interestRatePercent: 3, nextInterestAt: '2099-01-01T00:00:00Z', recentOperations: [] }
    const bankAfter: PlayerBankDto = { ...bankBefore, walletMoras: '9000', bankMoras: '1000', recentOperations: [{ id: 'operation', type: 'DEPOSIT', amount: '1000', bankBalanceAfter: '1000', walletBalanceAfter: '9000', businessDate: '2026-09-22', createdAt: '2026-09-22T12:00:00Z' }] }
    let bankView: PlayerBankDto = bankBefore
    const onLoadBank = vi.fn(async () => bankView)
    await act(async () => { root.render(<GameShell {...props} onRefreshChatScopes={refreshOwners} onLoadBank={onLoadBank} />); await Promise.resolve() })
    await navigateByHash('bank')
    const bankScreen = container.querySelector('.bank-screen')
    await act(async () => { container.querySelector<HTMLButtonElement>('.bank-transfer-form.deposit .bank-max-button')!.click() })
    expect(container.querySelector<HTMLInputElement>('.bank-transfer-form.deposit input')?.value).toBe('10000')
    bankView = bankAfter
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-chat-refresh="bank"]')!.click(); await Promise.resolve() })
    expect(container.querySelector('.bank-screen')).toBe(bankScreen)
    expect(container.querySelector<HTMLInputElement>('.bank-transfer-form.deposit input')?.value).toBe('10000')
    expect(container.querySelector('.bank-balance-card.vault')?.textContent).toContain('1\u202f000')
    expect(container.querySelectorAll('.bank-history-list li')).toHaveLength(1)
    expect(onLoadBank).toHaveBeenCalled()
    expect(props.onDepositBank).not.toHaveBeenCalled()
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
