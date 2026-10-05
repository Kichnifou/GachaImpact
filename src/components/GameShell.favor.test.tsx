// @vitest-environment happy-dom

import { act, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import type { BoxCharacterDto, DailyCombatDto, ExpeditionDto, MonthlyBossDto, PlayerBoxDto } from '../api/types'
import { createExpeditionClientSnapshot } from '../expedition/expedition-client-snapshot'
import { defaultNavigationPreference, hashForScreen } from '../navigation/navigation'
import GameShell from './GameShell'


vi.mock('./ChatPanel', () => ({ default: () => <aside className="chat-panel" /> }))
const control = vi.hoisted(() => ({ finish: vi.fn() }))
vi.mock('../favor/use-favor-presence', () => ({ useFavorPresence: () => ({ favor: null, error: false, feedbacks: [{ id: 'today' }], finish: control.finish }) }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: ReturnType<typeof createRoot>, container: HTMLDivElement
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Network disabled in component tests') })); window.location.hash = hashForScreen('activities-dailies'); container = document.createElement('div'); document.body.append(container); root = createRoot(container); control.finish.mockClear() })
afterEach(() => { act(() => root.unmount()); document.body.replaceChildren(); vi.useRealTimers(); vi.unstubAllGlobals() })
function makeProps() {
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
      permissions: { roles: [], capabilities: { moderationAccess: false, selfResourceTools: false, selfGameplayTools: false, superTools: false, canSelectPlayers: false } },
      onLoadModeration: vi.fn(), onListModerationPlayers: vi.fn(), onModerationResource: vi.fn(), onModerationXp: vi.fn(), onModerationGacha: vi.fn(), onModerationStella: vi.fn(), onModerationApplied: vi.fn(),
      onLoadNavigationPreferences: vi.fn(async () => defaultNavigationPreference), onSaveNavigationPreferences: vi.fn(async (value) => value),
    } as unknown as ComponentProps<typeof GameShell>


return props
}
const render = async (props: ComponentProps<typeof GameShell>) => { await act(async () => root.render(<GameShell {...props} />)) }
it('waits behind Gacha, Level-up and Challenge, then resumes its queue entry', async () => {
 const props = makeProps()
 await render({ ...props, pendingGachaPullCount: 10 }); expect(container.querySelector('[aria-label="Faveur de l’Astre — récompense quotidienne"]')).toBeNull()
 await render({ ...props, levelUpFeedbacks: [{ id: 'level', levelsGained: 1, rewards: [] }] }); expect(container.querySelector('[aria-label="Faveur de l’Astre — récompense quotidienne"]')).toBeNull(); expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1)
 const challenge = { ...props.dailyChallenge, status: 'ACTIVE' as const, assigned: true, challenge: { externalKey: 'daily', type: 'pulls' as const, displayName: 'Vœux', description: '', progressLabel: 'Invocations', progress: '0', target: '5', rewardPrimogems: '800' } }
 await render({ ...props, dailyChallenge: challenge }); await render({ ...props, dailyChallenge: { ...challenge, status: 'COMPLETED', challenge: { ...challenge.challenge, progress: '5' } } })
 expect(container.querySelector('[aria-label="Défi du jour terminé"]')).not.toBeNull(); expect(container.querySelector('[aria-label="Faveur de l’Astre — récompense quotidienne"]')).toBeNull()
 await act(async () => vi.advanceTimersByTime(5400)); expect(container.querySelector('[aria-label="Faveur de l’Astre — récompense quotidienne"]')).not.toBeNull()
 await act(async () => vi.advanceTimersByTime(5400)); expect(control.finish).toHaveBeenCalledExactlyOnceWith('today')
})
it('waits behind conversion and resumes after it closes', async () => {
 await render(makeProps()); await act(async () => container.querySelector<HTMLButtonElement>('.sidebar-particle-convert')!.click()); expect(container.querySelector('[aria-label="Faveur de l’Astre — récompense quotidienne"]')).toBeNull()
 await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Fermer la conversion"]')!.click()); expect(container.querySelector('[aria-label="Faveur de l’Astre — récompense quotidienne"]')).not.toBeNull()
})
it('defers behind global event feedback', async () => { await render({ ...makeProps(), externalFeedbackPending: true }); expect(container.querySelector('[aria-label="Faveur de l’Astre — récompense quotidienne"]')).toBeNull() })

it('refreshes the shared Player on return and reloads the mounted Box without resetting its search', async () => {
  window.location.hash = hashForScreen('characters-box')
  const props = makeProps(), refresh = vi.fn(async () => undefined)
  await render({ ...props, onRefreshPlayerState: refresh })
  const before = vi.mocked(props.onLoadBox).mock.calls.length
  const box = await props.onLoadBox()
  vi.mocked(props.onLoadBox).mockResolvedValue({ ...box, characters: box.characters.map(character => ({ ...character, constellation: 1 })) })
  const search = container.querySelector<HTMLInputElement>('input[type="search"]')!
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Keq'); search.dispatchEvent(new Event('input', { bubbles: true })) })
  expect(container.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('Keq')
  await act(async () => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')) })
  expect(refresh).toHaveBeenCalledOnce()
  expect(props.onLoadBox).toHaveBeenCalledTimes(before + 2)
  expect(container.querySelector('.character-card-meta strong')?.textContent).toBe('C1')
  expect(container.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('Keq')
  expect(props.onPullGacha).not.toHaveBeenCalled()
})

it('does not replay Challenge completion feedback after an authoritative shared reread', async () => {
  const props = makeProps()
  const challenge = { ...props.dailyChallenge, status: 'ACTIVE' as const, assigned: true, challenge: { externalKey: 'daily', type: 'pulls' as const, displayName: 'Vœux', description: '', progressLabel: 'Invocations', progress: '0', target: '5', rewardPrimogems: '800' } }
  await render({ ...props, dailyChallenge: challenge, playerStateReadRevision: 0 })
  await render({ ...props, dailyChallenge: { ...challenge, status: 'COMPLETED', challenge: { ...challenge.challenge, progress: '5' } }, playerStateReadRevision: 1 })
  expect(container.querySelector('[aria-label="Défi du jour terminé"]')).toBeNull()
})
