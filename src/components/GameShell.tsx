import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BannerVoteCache } from '../characters/banner-vote-cache'
import { useFriendships } from '../social/use-friendships'
import type { SocialTab } from '../screens/SocialScreen'
import type { SocialActions } from '../social/types'
import { usePresence } from '../social/use-presence'
import SocialScreen from '../screens/SocialScreen'
import ProfileScreen from '../screens/ProfileScreen'
import type { BannerVoteActions } from '../characters/use-banner-votes'

import type { BankHistoryDto, BankTransferDto, BoxCharacterDto, BoxSortPreferenceDto, ContestDto, ContestHistoryDto, ContestSnapshotDto, CurrentGachaDto, DailyChallengeDto, DailyChallengeMutationDto, DailyCombatDto, DailyCombatFightDto, DailyRewardClaimDto, DailyRewardTodayDto, EventDto, EventRankingDto, EventGameAAttemptDto, EventJoinDto, ExpeditionClaimDto, ExpeditionDto, ExpeditionStartDto, GachaCharacterDto, GachaHistoryDto, GachaPullDto, GiftCodeClaimDto, InventoryItemDetailDto, ModerationPermissionsDto, ModerationPlayerListQuery, ModerationPlayerPageDto, ModerationStateDto, MonthlyBossAttackDto, MonthlyBossDto, MonthlyBossHistoryDto, NavigationMenuPreferenceDto, NotificationsDto, PlayerBankDto, PlayerBoxDto, PlayerDto, PlayerGiftCodesDto, PlayerInventoryDto, PlayerProgressionDto, PlayerResourcesDto, PlayerShopDto, PlayerTeamsDto, ShopHistoryDto, ShopPurchaseDto, StellaUseDto, WheelSpinDto, WheelTodayDto } from '../api/types'
import type { ScreenId } from '../types'
import type { EventDailyBonusClaimDto, EventCalendarClaimDto, EventGameBAttemptDto, EventGameCRecipientQuery, EventGameCRecipientsDto, EventGameCSendDto } from '../api/types'
import BoxScreen from '../screens/BoxScreen'
import CharactersScreen from '../screens/CharactersScreen'
import HomeScreen from '../screens/HomeScreen'
import InventoryScreen from '../screens/InventoryScreen'
import TradesScreen, { type TradeOpenIntent } from '../screens/TradesScreen'
import type { TradeActions, TradeSnapshot } from '../trades/types'
import InvocationScreen from '../screens/InvocationScreen'
import ShopScreen from '../screens/ShopScreen'
import TeamScreen from '../screens/TeamScreen'
import BankScreen from '../screens/BankScreen'
import GiftCodesScreen from '../screens/GiftCodesScreen'
import ModerationScreen from '../screens/ModerationScreen'
import ChatPanel from './ChatPanel'
import GameHeader from './GameHeader'
import Navigation from './Navigation'
import OnlinePlayersPanel from './OnlinePlayersPanel'
import PlayerSidebar from './PlayerSidebar'
import { BoxMemoryCache } from '../box/box-memory-cache'
import { StellaIntentCoordinator } from '../box/stella-intent-coordinator'
import { BankTransferIntentCoordinator, type BankTransferDirection } from '../bank/bank-transfer-intent-coordinator'
import { BankMemoryCache } from '../bank/bank-memory-cache'
import type { LevelUpFeedbackEvent } from '../progression/level-up-feedback'
import { useProfileLevelUpFeedback } from '../progression/use-profile-level-up-feedback'
import LevelUpFeedback from './LevelUpFeedback'
import { InventoryMemoryCache } from '../inventory/inventory-memory-cache'
import { ModerationIntentCoordinator, type ModerationGachaInput, type ModerationResourceInput, type ModerationXpInput } from '../moderation/moderation-intent-coordinator'
import { ShopMemoryCache } from '../shop/shop-memory-cache'
import { ShopPurchaseIntentCoordinator } from '../shop/shop-purchase-intent-coordinator'
import { applyModerationResultToActor } from '../moderation/apply-moderation-result'
import ActivitiesScreen from '../screens/ActivitiesScreen'
import ConfigurationScreen from '../screens/ConfigurationScreen'
import ParticleConversionModal from './ParticleConversionModal'
import DailyChallengeCompletionFeedback from './DailyChallengeCompletionFeedback'
import { isDailyChallengeCompletionTransition } from '../daily-challenge/presentation'
import SecondaryNavigation from './SecondaryNavigation'
import GlobalMenu from './GlobalMenu'
import { activityTabs, characterTabs, defaultNavigationPreference, hashForScreen, parseNavigationHash, type MainNavigationId } from '../navigation/navigation'
import type { ExpeditionClientSnapshot } from '../expedition/expedition-client-snapshot'
import type { ChatRefreshScope } from '../api/types'
import { runChatRefreshScopes } from '../chat/refresh-scopes'

const getScreenFromHash = (): ScreenId => parseNavigationHash(window.location.hash)
const chatCacheScopesByScreen: Partial<Record<ScreenId, readonly ChatRefreshScope[]>> = {
  'characters-box': ['box'],
  'characters-team': ['box'],
  'activities-combat': ['box'],
  inventory: ['inventory', 'box'],
  bank: ['bank'],
  shop: ['shop'],
  'characters-catalog': ['bannerVotes'],
  trades: ['trades'],
  codes: ['giftCodes'],
}

type GameShellProps = {
  onRefreshChatScopes: (scopes: readonly ChatRefreshScope[]) => Promise<void>
  player: PlayerDto
  resources: PlayerResourcesDto
  progression: PlayerProgressionDto
  levelUpFeedbacks: readonly LevelUpFeedbackEvent[]
  onLevelUpFeedbackFinished: (id: string) => void
  wheelToday: WheelTodayDto
  onSpinWheel: () => Promise<WheelSpinDto>
  dailyRewardToday: DailyRewardTodayDto
  onClaimDailyReward: () => Promise<DailyRewardClaimDto>
  dailyChallenge: DailyChallengeDto
  onPurchaseDailyChallenge: (idempotencyKey: string) => Promise<DailyChallengeMutationDto>
  onSwitchDailyChallenge: (idempotencyKey: string) => Promise<DailyChallengeMutationDto>
  dailyCombat: DailyCombatDto
  monthlyBoss: MonthlyBossDto
  onLoadMonthlyBoss?: () => Promise<MonthlyBossDto>
  contest: ContestDto
  event: EventDto
  onLoadEvent: () => Promise<EventDto>
  onJoinEvent: (key: string) => Promise<EventJoinDto>
  onClaimEventCalendar?: (key: string) => Promise<EventCalendarClaimDto>
  onClaimEventDailyBonus?: (key: string) => Promise<EventDailyBonusClaimDto>
  onLoadEventRanking?: () => Promise<EventRankingDto>
  onConvertEventShop?: (target: 'PRIMOGEMS' | 'MORAS', quantity: number, key: string) => Promise<EventDto>
  onPurchaseEventCollection?: (key: string) => Promise<EventDto>
  onAttemptEventGameA: (key: string) => Promise<EventGameAAttemptDto>
  onAttemptEventGameB: (code: string, key: string) => Promise<EventGameBAttemptDto>
  onSearchEventGameCRecipients: (query: EventGameCRecipientQuery) => Promise<EventGameCRecipientsDto>
  onSendEventGameC: (recipientPlayerId: string, message: string, key: string) => Promise<EventGameCSendDto>
  onConsultEventGameCMessages: () => Promise<EventDto>
  onRefreshContest: () => Promise<ContestDto>
  onLoadContestHistory: (page: number) => Promise<ContestHistoryDto>
  onLoadContestHistoryDetail: (contestId: string) => Promise<ContestSnapshotDto>
  onOpenContest: (characterId: string, key: string) => Promise<ContestDto>
  onJoinContest: (characterId: string, key: string) => Promise<ContestDto>
  onSelectContestLegend: (characterId: string, key: string) => Promise<ContestDto>
  onSetContestReady: (ready: boolean, key: string) => Promise<ContestDto>
  onStartContest: (key: string) => Promise<ContestDto>
  onSpectateContest: (key: string) => Promise<ContestDto>
  onLeaveContest: (key: string) => Promise<ContestDto>
  onCancelContest: (key: string) => Promise<ContestDto>
  onPlayContest: (action: 'BASIC' | 'RISK', key: string) => Promise<ContestDto>
  onSupportContest: (slot: number, key: string) => Promise<ContestDto>
  onRemoveContestParticipant: (playerId: string, key: string) => Promise<ContestDto>
  onRemoveContestSpectator: (playerId: string, key: string) => Promise<ContestDto>
  expedition: ExpeditionClientSnapshot
  expeditionMonotonicNow: number
  notifications: NotificationsDto
  onLoadExpedition: () => Promise<ExpeditionDto>
  onStartExpedition: (characterId: string, idempotencyKey: string) => Promise<ExpeditionStartDto>
  onClaimExpedition: (idempotencyKey: string) => Promise<ExpeditionClaimDto>
  onLoadNotifications: () => Promise<NotificationsDto>
  onReadNotification: (id: string) => Promise<NotificationsDto>
  onArchiveNotification: (id: string) => Promise<NotificationsDto>
  onReadAllNotifications: () => Promise<NotificationsDto>
  onArchiveReadNotifications: () => Promise<NotificationsDto>
  onLoadDailyCombat: () => Promise<DailyCombatDto>
  onSetDailyCombatSlot: (position: number, characterId: string) => Promise<DailyCombatDto>
  onRemoveDailyCombatSlot: (position: number) => Promise<DailyCombatDto>
  onCopyActiveTeamToDailyCombat: () => Promise<DailyCombatDto>
  onAutoSelectDailyCombat: () => Promise<DailyCombatDto>
  onClearDailyCombatLoadout: () => Promise<DailyCombatDto>
  onFightDailyCombat: (idempotencyKey: string) => Promise<DailyCombatFightDto>
  onSetMonthlyBossSlot: (position: number, characterId: string) => Promise<MonthlyBossDto>
  onRemoveMonthlyBossSlot: (position: number) => Promise<MonthlyBossDto>
  onCopyActiveTeamToMonthlyBoss: () => Promise<MonthlyBossDto>
  onClearMonthlyBossLoadout: () => Promise<MonthlyBossDto>
  onAttackMonthlyBoss: (bossId: string, idempotencyKey: string) => Promise<MonthlyBossAttackDto>
  onLoadMonthlyBossHistory: (page: number) => Promise<MonthlyBossHistoryDto>
  onSignOut: () => Promise<void>
  gacha: CurrentGachaDto
  characters: readonly GachaCharacterDto[]
  tradeActions?: TradeActions
  onTradeSnapshot?: (value: TradeSnapshot) => void
  socialActions?: SocialActions
  bannerVoteActions?: BannerVoteActions
  teams: PlayerTeamsDto
  onLoadTeams: () => Promise<PlayerTeamsDto>
  onActivateTeam: (teamId: string) => Promise<PlayerTeamsDto>
  onRenameTeam: (teamId: string, name: string | null) => Promise<PlayerTeamsDto>
  onCreateNextTeam: (expectedPosition: number) => Promise<PlayerTeamsDto>
  onDeleteTeam: (teamId: string) => Promise<PlayerTeamsDto>
  onReorderTeams: (teamIds: readonly string[]) => Promise<PlayerTeamsDto>
  onSetTeamSlot: (teamId: string, position: number, characterId: string) => Promise<PlayerTeamsDto>
  onReorderTeamSlots: (teamId: string, characterIds: readonly (string | null)[]) => Promise<PlayerTeamsDto>
  onRemoveTeamSlot: (teamId: string, position: number) => Promise<PlayerTeamsDto>
  onClearTeam: (teamId: string) => Promise<PlayerTeamsDto>
  onSetGachaTarget: (characterId: string) => Promise<void>
  onPullGacha: (count: 1 | 10) => Promise<GachaPullDto>
  pendingGachaPullCount: 1 | 10 | null
  onGachaPresentationDisclosed: (operationId: string) => void
  onGachaPresentationAbandoned: () => void
  onGetGachaHistory: (page: number) => Promise<GachaHistoryDto>
  onLoadBox: () => Promise<PlayerBoxDto>
  onSetBoxFavorite: (characterId: string, favorite: boolean) => Promise<BoxCharacterDto>
  onSetBoxSortPreference: (preference: BoxSortPreferenceDto) => Promise<BoxSortPreferenceDto>
  onUseStella: (characterId: string, idempotencyKey: string) => Promise<StellaUseDto>
  onLoadBank: () => Promise<PlayerBankDto>
  onLoadBankHistory: (page: number) => Promise<BankHistoryDto>
  onDepositBank: (amount: string, idempotencyKey: string) => Promise<BankTransferDto>
  onWithdrawBank: (amount: string, idempotencyKey: string) => Promise<BankTransferDto>
  onLoadShop: () => Promise<PlayerShopDto>
  onLoadShopHistory: (page: number) => Promise<ShopHistoryDto>
  onPurchaseShop: (itemId: string, quantity: string, idempotencyKey: string) => Promise<ShopPurchaseDto>
  onLoadGiftCodes: () => Promise<PlayerGiftCodesDto>
  onClaimGiftCode: (editionId: string, idempotencyKey: string) => Promise<GiftCodeClaimDto>
  onLoadInventory: () => Promise<PlayerInventoryDto>
  onLoadInventoryItemDetail: (itemId: string, page?: number) => Promise<InventoryItemDetailDto>
  onConvertParticles: (amount: string, idempotencyKey: string) => Promise<DailyChallengeMutationDto>
  permissions: ModerationPermissionsDto
  onLoadModeration: (targetPlayerId?: string) => Promise<ModerationStateDto>
  onListModerationPlayers: (query: ModerationPlayerListQuery) => Promise<ModerationPlayerPageDto>
  onModerationResource: (targetPlayerId: string, input: { resourceKey: string; amount: string; direction: 'add' | 'remove'; idempotencyKey: string }) => Promise<ModerationStateDto>
  onModerationXp: (targetPlayerId: string, input: { totalXp?: string; prepareNextLevel?: true; idempotencyKey: string }) => Promise<ModerationStateDto>
  onModerationGacha: (targetPlayerId: string, input: { pity5?: number; pity4?: number; guaranteedFeatured5?: boolean; captureProgress?: number; idempotencyKey: string }) => Promise<ModerationStateDto>
  onModerationStella: (targetPlayerId: string, quantity: string, idempotencyKey: string) => Promise<ModerationStateDto>
  onModerationTester: (targetPlayerId: string, enabled: boolean, idempotencyKey: string) => Promise<ModerationStateDto>
  onModerationApplied: (state: ModerationStateDto, targetIsSelf: boolean) => void
  onLoadAdminGiftCodes: NonNullable<Parameters<typeof ModerationScreen>[0]['onLoadGiftCodes']>
  onCreateGiftCode: Parameters<typeof ModerationScreen>[0]['onCreateGiftCode']
  onPublishGiftCode: NonNullable<Parameters<typeof ModerationScreen>[0]['onPublishGiftCode']>
  onUpdateGiftCode: Parameters<typeof ModerationScreen>[0]['onUpdateGiftCode']
  onGiftCodeClaimants: NonNullable<Parameters<typeof ModerationScreen>[0]['onGiftCodeClaimants']>
  onLoadNavigationPreferences: () => Promise<NavigationMenuPreferenceDto>
  onSaveNavigationPreferences: (value: NavigationMenuPreferenceDto) => Promise<NavigationMenuPreferenceDto>
}

function GameShell({ onRefreshChatScopes, player, resources, progression, levelUpFeedbacks, onLevelUpFeedbackFinished, wheelToday, onSpinWheel, dailyRewardToday, onClaimDailyReward, dailyChallenge, onPurchaseDailyChallenge, onSwitchDailyChallenge, dailyCombat, monthlyBoss, onLoadMonthlyBoss, contest, event, onLoadEvent, onLoadEventRanking, onJoinEvent, onClaimEventCalendar, onClaimEventDailyBonus, onConvertEventShop, onPurchaseEventCollection, onAttemptEventGameA, onAttemptEventGameB, onSearchEventGameCRecipients, onSendEventGameC, onConsultEventGameCMessages, onRefreshContest, onLoadContestHistory, onLoadContestHistoryDetail, onOpenContest, onJoinContest, onSelectContestLegend, onSetContestReady, onStartContest, onSpectateContest, onLeaveContest, onCancelContest, onPlayContest, onSupportContest, onRemoveContestParticipant, onRemoveContestSpectator, expedition, expeditionMonotonicNow, notifications, onLoadExpedition, onStartExpedition, onClaimExpedition, onLoadNotifications, onReadNotification, onArchiveNotification, onReadAllNotifications, onArchiveReadNotifications, onLoadDailyCombat, onSetDailyCombatSlot, onRemoveDailyCombatSlot, onCopyActiveTeamToDailyCombat, onAutoSelectDailyCombat, onClearDailyCombatLoadout, onFightDailyCombat, onSetMonthlyBossSlot, onRemoveMonthlyBossSlot, onCopyActiveTeamToMonthlyBoss, onClearMonthlyBossLoadout, onAttackMonthlyBoss, onLoadMonthlyBossHistory, onSignOut, gacha, characters, bannerVoteActions, socialActions, tradeActions, onTradeSnapshot, teams, onLoadTeams, onActivateTeam, onRenameTeam, onCreateNextTeam, onDeleteTeam, onReorderTeams, onSetTeamSlot, onReorderTeamSlots, onRemoveTeamSlot, onClearTeam, onSetGachaTarget, onPullGacha, pendingGachaPullCount, onGachaPresentationDisclosed, onGachaPresentationAbandoned, onGetGachaHistory, onLoadBox, onSetBoxFavorite, onSetBoxSortPreference, onUseStella, onLoadBank, onLoadBankHistory, onDepositBank, onWithdrawBank, onLoadShop, onLoadShopHistory, onPurchaseShop, onLoadGiftCodes, onClaimGiftCode, onLoadInventory, onLoadInventoryItemDetail, onConvertParticles, permissions, onLoadModeration, onListModerationPlayers, onModerationResource, onModerationXp, onModerationGacha, onModerationStella, onModerationTester, onModerationApplied, onLoadAdminGiftCodes, onCreateGiftCode, onPublishGiftCode, onUpdateGiftCode, onGiftCodeClaimants, onLoadNavigationPreferences, onSaveNavigationPreferences }: GameShellProps) {
  const [socialTab, setSocialTab] = useState<SocialTab>('friends')
  const { close: closePresence, ...presence } = usePresence(player.id, socialActions)
  const [profileId, setProfileId] = useState(player.id)
  const [configurationTab, setConfigurationTab] = useState<'menu' | 'privacy'>('menu')
  const openProfile = (id: string) => { setProfileId(id); setIsPlayersOpen(false); setIsSidebarOpen(false); navigate('profile') }
  const voteCache = useMemo(() => new BannerVoteCache(player.id), [player.id])
  useEffect(() => () => voteCache.clear(), [voteCache])
  const refreshMonthlyBoss = useCallback(() => onLoadMonthlyBoss ? onLoadMonthlyBoss() : Promise.resolve(monthlyBoss), [monthlyBoss, onLoadMonthlyBoss])
  const [activeScreen, setActiveScreen] = useState<ScreenId>(getScreenFromHash)
  const activeScreenRef = useRef(activeScreen)
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const [chatOwnerRevision, setChatOwnerRevision] = useState(0)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isPlayersOpen, setIsPlayersOpen] = useState(false)
  const friendship = useFriendships(socialActions, activeScreen === 'social' || activeScreen === 'profile' || isPlayersOpen)
  const clearFriendshipFeedback = friendship.clearFeedback
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isParticleConversionOpen, setIsParticleConversionOpen] = useState(false)
  const previousDailyChallengeStatus = useRef(dailyChallenge.status)
  const [completedChallengeFeedback, setCompletedChallengeFeedback] = useState<NonNullable<DailyChallengeDto['challenge']> | null>(null)
  const [menuPage, setMenuPage] = useState(1)
  const [menuPreference, setMenuPreference] = useState<NavigationMenuPreferenceDto>(defaultNavigationPreference)
  const [lastCharacterScreen, setLastCharacterScreen] = useState<ScreenId>(() => activeScreen.startsWith('characters-') ? activeScreen : 'characters-box')
  const [lastActivityScreen, setLastActivityScreen] = useState<ScreenId>(() => activeScreen.startsWith('activities-') ? activeScreen : 'activities-dailies')
  const [dailiesOverviewRequestToken, setDailiesOverviewRequestToken] = useState(0)
  const [bossRequestToken, setBossRequestToken] = useState(0)
  const [eventMessagesRequestToken, setEventMessagesRequestToken] = useState(0)
  const [eventShopRequestToken, setEventShopRequestToken] = useState(0)
  const [boxOpenIntent, setBoxOpenIntent] = useState<{ characterId: string; token: string } | null>(null)
  const [boxCache] = useState(() => new BoxMemoryCache())
  const [stellaIntents] = useState(() => new StellaIntentCoordinator())
  const [bankTransferIntents] = useState(() => new BankTransferIntentCoordinator())
  const [bankCache] = useState(() => new BankMemoryCache())
  const [inventoryCache] = useState(() => new InventoryMemoryCache())
  const [moderationIntents] = useState(() => new ModerationIntentCoordinator())
  const [shopCache] = useState(() => new ShopMemoryCache())
  const [shopIntents] = useState(() => new ShopPurchaseIntentCoordinator())
  const [tradeIntent, setTradeIntent] = useState<TradeOpenIntent>()
  const activeLevelUpFeedback = levelUpFeedbacks[0] ?? null
  const [profileLevelUpEvent, setProfileLevelUpEvent] = useState<LevelUpFeedbackEvent | null>(null)
  const [closedLevelUpModalId, setClosedLevelUpModalId] = useState<string | null>(null)
  const finishProfileLevelUp = useCallback((id: string) => {
    setProfileLevelUpEvent(null)
    onLevelUpFeedbackFinished(id)
  }, [onLevelUpFeedbackFinished])
  const profileLevelUp = useProfileLevelUpFeedback(profileLevelUpEvent, finishProfileLevelUp)
  useEffect(() => {
    const previous = previousDailyChallengeStatus.current
    previousDailyChallengeStatus.current = dailyChallenge.status
    if (isDailyChallengeCompletionTransition(previous, dailyChallenge)) setCompletedChallengeFeedback(dailyChallenge.challenge)
  }, [dailyChallenge])
  useEffect(() => { let active = true; void onLoadNavigationPreferences().then((value) => { if (active) setMenuPreference(value) }).catch(() => undefined); return () => { active = false } }, [onLoadNavigationPreferences, player.id])
  const finishLevelUpModal = useCallback((id: string) => {
    const event = levelUpFeedbacks.find((candidate) => candidate.id === id)
    if (!event || profileLevelUpEvent) return
    setClosedLevelUpModalId(id)
    setProfileLevelUpEvent(event)
  }, [levelUpFeedbacks, profileLevelUpEvent])

  const loadBox = useCallback(
    () => boxCache.revalidate(player.id, onLoadBox),
    [boxCache, onLoadBox, player.id],
  )
  const setBoxFavorite = useCallback(async (characterId: string, favorite: boolean) => {
    const character = await onSetBoxFavorite(characterId, favorite)
    boxCache.replaceCharacter(player.id, character)
    return character
  }, [boxCache, onSetBoxFavorite, player.id])
  const setBoxSortPreference = useCallback(async (preference: BoxSortPreferenceDto) => {
    const persisted = await onSetBoxSortPreference(preference)
    boxCache.replacePreference(player.id, persisted)
    return persisted
  }, [boxCache, onSetBoxSortPreference, player.id])
  const useStella = useCallback((characterId: string) => stellaIntents.execute(
    player.id,
    characterId,
    async (idempotencyKey) => {
      const result = await onUseStella(characterId, idempotencyKey)
      boxCache.applyStella(player.id, result)
      inventoryCache.applyStella(player.id, result)
      await refreshMonthlyBoss()
      return result
    },
  ), [boxCache, inventoryCache, onUseStella, player.id, refreshMonthlyBoss, stellaIntents])
  const loadInventory = useCallback(
    () => inventoryCache.revalidate(player.id, onLoadInventory),
    [inventoryCache, onLoadInventory, player.id],
  )
  const purchaseEventCollection = useCallback(async (key: string) => {
    if (!onPurchaseEventCollection) throw new Error('Boutique du Festival indisponible.')
    const result = await onPurchaseEventCollection(key)
    inventoryCache.clear()
    return result
  }, [inventoryCache, onPurchaseEventCollection])
  const convertParticles = useCallback(async (amount: string, idempotencyKey: string) => {
    const result = await onConvertParticles(amount, idempotencyKey)
    inventoryCache.applyParticleConversion(player.id, player.elementKey!, result.resources.particles[player.elementKey!], result.resources.primogems)
    return result
  }, [inventoryCache, onConvertParticles, player.elementKey, player.id])
  const loadBank = useCallback(
    () => bankCache.revalidate(player.id, onLoadBank),
    [bankCache, onLoadBank, player.id],
  )
  const transferBank = useCallback((direction: BankTransferDirection, amount: string) => bankTransferIntents.execute(
    player.id,
    direction,
    amount,
    async (idempotencyKey) => bankCache.writeConfirmed(player.id, await (direction === 'deposit'
      ? onDepositBank(amount, idempotencyKey)
      : onWithdrawBank(amount, idempotencyKey))),
  ), [bankCache, bankTransferIntents, onDepositBank, onWithdrawBank, player.id])
  const loadShop = useCallback(() => shopCache.revalidate(player.id, onLoadShop), [onLoadShop, player.id, shopCache])
  const refreshChatScopes = useCallback(async (scopes: readonly ChatRefreshScope[]) => {
    const results = await Promise.allSettled([onRefreshChatScopes(scopes), runChatRefreshScopes(scopes, {
      box: loadBox,
      inventory: loadInventory,
      bank: loadBank,
      shop: loadShop,
      teams: onLoadTeams,
      social: () => friendship.refresh(true),
      ...(tradeActions ? { trades: () => tradeActions.snapshot().then(value => onTradeSnapshot?.(value)) } : {}),
      ...(bannerVoteActions?.onLoadVotes ? { bannerVotes: () => voteCache.revalidate(bannerVoteActions.onLoadVotes!) } : {}),
      giftCodes: onLoadGiftCodes,
    })])
    if (scopes.some(scope => chatCacheScopesByScreen[activeScreenRef.current]?.includes(scope))) setChatOwnerRevision(value => value + 1)
    if (results.some(result => result.status === 'rejected')) throw new Error('Une projection n’a pas pu être rechargée.')
  }, [bannerVoteActions, friendship, loadBank, loadBox, loadInventory, loadShop, onLoadGiftCodes, onLoadTeams, onRefreshChatScopes, onTradeSnapshot, tradeActions, voteCache])
  const purchaseShop = useCallback((itemId: string, quantity: string) => shopIntents.execute(player.id, itemId, quantity, async (idempotencyKey) => shopCache.writeConfirmed(player.id, await onPurchaseShop(itemId, quantity, idempotencyKey))), [onPurchaseShop, player.id, shopCache, shopIntents])
  const moderateResource = useCallback((targetPlayerId: string, input: ModerationResourceInput) => moderationIntents.execute(
    targetPlayerId,
    { type: 'resource', payload: input },
    (idempotencyKey) => onModerationResource(targetPlayerId, { ...input, idempotencyKey }),
  ), [moderationIntents, onModerationResource])
  const moderateXp = useCallback((targetPlayerId: string, input: ModerationXpInput) => moderationIntents.execute(
    targetPlayerId,
    { type: 'xp', payload: input },
    (idempotencyKey) => onModerationXp(targetPlayerId, { ...input, idempotencyKey }),
  ), [moderationIntents, onModerationXp])
  const moderateGacha = useCallback((targetPlayerId: string, input: ModerationGachaInput) => moderationIntents.execute(
    targetPlayerId,
    { type: 'gacha', payload: input },
    (idempotencyKey) => onModerationGacha(targetPlayerId, { ...input, idempotencyKey }),
  ), [moderationIntents, onModerationGacha])
  const moderateStella = useCallback((targetPlayerId: string, quantity: string) => moderationIntents.execute(
    targetPlayerId,
    { type: 'stella', payload: { quantity } },
    (idempotencyKey) => onModerationStella(targetPlayerId, quantity, idempotencyKey),
  ), [moderationIntents, onModerationStella])
  const moderateTester = useCallback((targetPlayerId: string, enabled: boolean) => moderationIntents.execute(
    targetPlayerId,
    { type: 'tester-role', payload: { enabled } },
    (idempotencyKey) => onModerationTester(targetPlayerId, enabled, idempotencyKey),
  ), [moderationIntents, onModerationTester])
  const applyModerationResult = useCallback((next: ModerationStateDto) => {
    applyModerationResultToActor({
      actorPlayerId: player.id,
      result: next,
      syncActorStella: (quantity) => {
        boxCache.setStellaQuantity(player.id, quantity)
        inventoryCache.setStellaQuantity(player.id, quantity)
      },
      onApplied: onModerationApplied,
    })
  }, [boxCache, inventoryCache, onModerationApplied, player.id])
  const signOutAndClearCaches = useCallback(async () => {
    voteCache.clear()
    boxCache.clear()
    bankCache.clear()
    inventoryCache.clear()
    moderationIntents.clear()
    shopCache.clear()
    shopIntents.clear()
    await closePresence()
    await onSignOut()
  }, [bankCache, boxCache, inventoryCache, moderationIntents, onSignOut, shopCache, shopIntents, voteCache, closePresence])

  const changeScreen = useCallback((screen: ScreenId) => {
    if (activeScreenRef.current === 'invocation' && screen !== 'invocation') onGachaPresentationAbandoned()
    if (screen !== 'configuration') setConfigurationTab('menu')
    if (screen !== 'trades') setTradeIntent(undefined)
    activeScreenRef.current = screen
    setActiveScreen(screen)
    if (screen !== 'activities-combat') setBossRequestToken(0)
    if (screen !== 'activities-event') { setEventMessagesRequestToken(0); setEventShopRequestToken(0) }
    if (screen.startsWith('characters-')) setLastCharacterScreen(screen)
    if (screen.startsWith('activities-')) setLastActivityScreen(screen)
    clearFriendshipFeedback()
  }, [clearFriendshipFeedback, onGachaPresentationAbandoned, setConfigurationTab, setBossRequestToken, setEventMessagesRequestToken, setEventShopRequestToken, setTradeIntent])

  useEffect(() => {
    const syncScreenWithHash = () => changeScreen(getScreenFromHash())
    window.addEventListener('hashchange', syncScreenWithHash)
    return () => window.removeEventListener('hashchange', syncScreenWithHash)
  }, [changeScreen])

  const navigate = (screen: ScreenId) => {
    if (screen === 'moderation' && !permissions.capabilities.moderationAccess) return
    changeScreen(screen)
    window.location.hash = hashForScreen(screen)
    setIsSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const navigateMain = (id: MainNavigationId) => { if (id === 'configuration') setConfigurationTab('menu'); navigate(id === 'characters' ? lastCharacterScreen : id === 'activities' ? lastActivityScreen : id) }
  const saveMenuPreference = async (value: NavigationMenuPreferenceDto) => { const saved = await onSaveNavigationPreferences(value); setMenuPreference(saved) }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'invocation':
        return <InvocationScreen gacha={gacha} teams={teams} onSetTarget={onSetGachaTarget} onPull={onPullGacha} pendingPullCount={pendingGachaPullCount} onPresentationDisclosed={onGachaPresentationDisclosed} onGetHistory={onGetGachaHistory} />
      case 'characters-box':
        return <BoxScreen initialBox={boxCache.read(player.id)} refreshToken={chatOwnerRevision} dailyCombat={dailyCombat} expedition={expedition} expeditionMonotonicNow={expeditionMonotonicNow} openCharacterIntent={boxOpenIntent} onOpenCharacterIntentConsumed={(token) => setBoxOpenIntent((current) => current?.token === token ? null : current)} onLoadExpedition={onLoadExpedition} onStartExpedition={onStartExpedition} onClaimExpedition={onClaimExpedition} onNotificationsChanged={onLoadNotifications} onLoadBox={loadBox} onSetFavorite={setBoxFavorite} onSetSortPreference={setBoxSortPreference} onUseStella={useStella} stellaRetryCharacterId={stellaIntents.getIntent(player.id)?.characterId ?? null} />
      case 'characters-catalog':
        return <CharactersScreen key={player.id} characters={characters} voteCache={voteCache} refreshToken={chatOwnerRevision} {...bannerVoteActions} />
      case 'characters-team':
        return <TeamScreen teams={teams} dailyCombat={dailyCombat} initialBox={boxCache.read(player.id)} refreshToken={chatOwnerRevision} stellaRetryCharacterId={stellaIntents.getIntent(player.id)?.characterId ?? null} onLoad={onLoadTeams} onActivate={onActivateTeam} onRename={onRenameTeam} onCreateNext={onCreateNextTeam} onDelete={onDeleteTeam} onReorderTeams={onReorderTeams} onSetSlot={onSetTeamSlot} onReorderSlots={onReorderTeamSlots} onRemoveSlot={onRemoveTeamSlot} onClear={onClearTeam} onLoadBox={loadBox} onSetBoxFavorite={setBoxFavorite} onUseStella={useStella} />
      case 'inventory':
        return <InventoryScreen key={player.id} initialInventory={inventoryCache.read(player.id)} refreshToken={chatOwnerRevision} resources={resources} elementKey={player.elementKey!} dailyCombat={dailyCombat} onLoad={loadInventory} onLoadItemDetail={onLoadInventoryItemDetail} onConvertParticles={convertParticles} onNavigateShop={() => navigate('shop')} onNavigateBank={() => navigate('bank')} onNavigateTrades={() => navigate('trades')} onLoadBox={loadBox} onSetBoxFavorite={setBoxFavorite} onUseStella={useStella} stellaRetryCharacterId={stellaIntents.getIntent(player.id)?.characterId ?? null} onLoadTeams={onLoadTeams} />
      case 'bank':
        return <BankScreen initialBank={bankCache.read(player.id)} refreshToken={chatOwnerRevision} onLoad={loadBank} onLoadHistory={onLoadBankHistory} onTransfer={transferBank} />
      case 'moderation':
        return permissions.capabilities.moderationAccess ? <ModerationScreen actorPlayerId={player.id} capabilities={permissions.capabilities} onLoad={onLoadModeration} onListPlayers={onListModerationPlayers} onResource={moderateResource} onXp={moderateXp} onGacha={moderateGacha} onStella={moderateStella} onTester={moderateTester} onApplied={applyModerationResult} onLoadGiftCodes={onLoadAdminGiftCodes} onCreateGiftCode={onCreateGiftCode} onPublishGiftCode={onPublishGiftCode} onUpdateGiftCode={onUpdateGiftCode} onGiftCodeClaimants={onGiftCodeClaimants} /> : <HomeScreen onNavigate={navigate} gacha={gacha} onSetGachaTarget={onSetGachaTarget} />
      case 'codes':
        return <GiftCodesScreen refreshToken={chatOwnerRevision} onLoad={onLoadGiftCodes} onClaim={onClaimGiftCode} />
      case 'shop':
        return <ShopScreen initialShop={shopCache.read(player.id)} refreshToken={chatOwnerRevision} onLoad={loadShop} onLoadHistory={onLoadShopHistory} onPurchase={purchaseShop} onNavigateBank={() => navigate('bank')} />
      case 'activities-dailies':
      case 'activities-missions':
      case 'activities-combat':
      case 'activities-event':
      case 'activities-contest':
return <ActivitiesScreen friendship={friendship.value?.summary} friendshipError={friendship.error} onOpenFriends={() => { setSocialTab('friends'); navigate('social') }} sessionUserId={player.id} screen={activeScreen} event={event} onLoadEvent={onLoadEvent} onLoadEventRanking={onLoadEventRanking} onJoinEvent={onJoinEvent} onClaimEventCalendar={onClaimEventCalendar} onClaimEventDailyBonus={onClaimEventDailyBonus} onConvertEventShop={onConvertEventShop} onPurchaseEventCollection={purchaseEventCollection} onAttemptEventGameA={onAttemptEventGameA} onAttemptEventGameB={onAttemptEventGameB} onSearchEventGameCRecipients={onSearchEventGameCRecipients} onSendEventGameC={onSendEventGameC} onConsultEventGameCMessages={onConsultEventGameCMessages} eventMessagesRequestToken={eventMessagesRequestToken} eventShopRequestToken={eventShopRequestToken} dailiesOverviewRequestToken={dailiesOverviewRequestToken} bossRequestToken={bossRequestToken} wheelToday={wheelToday} onSpinWheel={onSpinWheel} dailyRewardToday={dailyRewardToday} dailyChallenge={dailyChallenge} dailyCombat={dailyCombat} monthlyBoss={monthlyBoss} contest={contest} onRefreshContest={onRefreshContest} onLoadContestHistory={onLoadContestHistory} onLoadContestHistoryDetail={onLoadContestHistoryDetail} onOpenContest={onOpenContest} onJoinContest={onJoinContest} onSelectContestLegend={onSelectContestLegend} onSetContestReady={onSetContestReady} onStartContest={onStartContest} onSpectateContest={onSpectateContest} onLeaveContest={onLeaveContest} onCancelContest={onCancelContest} onPlayContest={onPlayContest} onSupportContest={onSupportContest} onRemoveContestParticipant={onRemoveContestParticipant} onRemoveContestSpectator={onRemoveContestSpectator} expedition={expedition} expeditionMonotonicNow={expeditionMonotonicNow} dailyCombatBox={{ initialBox: boxCache.read(player.id), refreshToken: chatOwnerRevision, onLoadBox: loadBox, onSetFavorite: setBoxFavorite, onUseStella: useStella, stellaRetryCharacterId: stellaIntents.getIntent(player.id)?.characterId ?? null, onCharacterProgressed: () => Promise.all([onLoadTeams(), onLoadDailyCombat()]) }} elementKey={player.elementKey!} onClaimDailyReward={onClaimDailyReward} onPurchaseDailyChallenge={onPurchaseDailyChallenge} onSwitchDailyChallenge={onSwitchDailyChallenge} onSetDailyCombatSlot={onSetDailyCombatSlot} onRemoveDailyCombatSlot={onRemoveDailyCombatSlot} onCopyActiveTeamToDailyCombat={onCopyActiveTeamToDailyCombat} onAutoSelectDailyCombat={onAutoSelectDailyCombat} onClearDailyCombatLoadout={onClearDailyCombatLoadout} onFightDailyCombat={onFightDailyCombat} onSetMonthlyBossSlot={onSetMonthlyBossSlot} onRemoveMonthlyBossSlot={onRemoveMonthlyBossSlot} onCopyActiveTeamToMonthlyBoss={onCopyActiveTeamToMonthlyBoss} onClearMonthlyBossLoadout={onClearMonthlyBossLoadout} onAttackMonthlyBoss={onAttackMonthlyBoss} onLoadMonthlyBossHistory={onLoadMonthlyBossHistory} onOpenParticleConversion={() => setIsParticleConversionOpen(true)} onOpenBoss={() => { setBossRequestToken((value) => value + 1); navigate('activities-combat') }} onOpenExpedition={() => { if (expedition.value.activeCharacter && expedition.value.operationalStatus !== 'IDLE') { setBoxOpenIntent({ characterId: expedition.value.activeCharacter.id, token: crypto.randomUUID() }); navigate('characters-box') } else { setBoxOpenIntent(null); navigate('characters-box') } }} onNavigate={navigate} />
      case 'trades':
        return tradeActions ? <TradesScreen key={player.id} intent={tradeIntent} refreshToken={chatOwnerRevision} actions={tradeActions} playerId={player.id} onSnapshot={value => { inventoryCache.applyTradeStocks(player.id, value.stocks); onTradeSnapshot?.(value) }} /> : null
      case 'social':
        return socialActions ? <SocialScreen actions={socialActions} onProfile={openProfile} controller={friendship} selectedTab={socialTab} onTabChange={setSocialTab} /> : null
      case 'profile':
        return socialActions ? <ProfileScreen key={profileId} playerId={profileId} ownerPlayerId={player.id} actions={socialActions} controller={friendship} onTrade={partner => { setTradeIntent({ token: crypto.randomUUID(), partner }); navigate('trades') }} onDirectory={() => { setSocialTab('players'); navigate('social') }} onPrivacy={() => { setConfigurationTab('privacy'); navigate('configuration') }} /> : null
      case 'configuration':
        return <ConfigurationScreen socialActions={socialActions} initialTab={configurationTab} preference={menuPreference} onSave={saveMenuPreference} onReset={() => saveMenuPreference(defaultNavigationPreference)} />
      default:
        return <HomeScreen onNavigate={navigate} gacha={gacha} onSetGachaTarget={onSetGachaTarget} />
    }
  }

  return (
    <div className={`game-shell${isChatCollapsed ? ' chat-is-collapsed' : ''}`}>
      <GameHeader
        displayName={player.displayName}
        onNavigateHome={() => navigate('home')}
        onOpenSidebar={() => setIsSidebarOpen(true)}
        showModeration={permissions.capabilities.moderationAccess}
        onOpenModeration={() => navigate('moderation')}
        onOpenMenu={() => setIsMenuOpen(true)}
        onSignOut={signOutAndClearCaches}
        notifications={notifications}
        pollSessionKey={player.id}
        onRefreshNotifications={onLoadNotifications}
        onReadNotification={onReadNotification}
        onArchiveNotification={onArchiveNotification}
        onReadAllNotifications={onReadAllNotifications}
        onArchiveReadNotifications={onArchiveReadNotifications}
        onOpenNotification={(notification) => { if (notification.actionKey === 'open-expedition-character' && notification.actionTargetId) { setBoxOpenIntent({ characterId: notification.actionTargetId, token: crypto.randomUUID() }); navigate('characters-box') } else if (notification.actionKey === 'OPEN_MONTHLY_BOSS') { setBossRequestToken((value) => value + 1); navigate('activities-combat') } else if (notification.actionKey === 'OPEN_EVENT_MESSAGES') { setEventMessagesRequestToken((value) => value + 1); navigate('activities-event') } else if (notification.actionKey === 'OPEN_EVENT_SHOP') { setEventShopRequestToken((value) => value + 1); navigate('activities-event') } else if (notification.actionKey === 'OPEN_EVENT') { setEventMessagesRequestToken(0); setEventShopRequestToken(0); navigate('activities-event') } else if (notification.actionKey === 'OPEN_GIFT_CODE') navigate('codes'); else if (notification.actionKey === 'OPEN_SOCIAL_REQUESTS') { void friendship.refresh(true); setSocialTab('requests'); navigate('social') } else if (notification.actionKey === 'OPEN_TRADES_HISTORY' && notification.domainKey === 'trades' && notification.typeKey === 'TRADE_ACCEPTED') { setTradeIntent({ token: crypto.randomUUID(), tab: 'history' }); navigate('trades') } else if (notification.actionKey === 'OPEN_TRADES' && notification.domainKey === 'trades' && notification.typeKey === 'TRADES_PENDING') { setTradeIntent({ token: crypto.randomUUID(), tab: 'received' }); navigate('trades') } else if (notification.actionKey === 'OPEN_SOCIAL_FRIENDS') { void friendship.refresh(true); setSocialTab('friends'); navigate('social') } }}
      />

      <div className="game-layout">
        <PlayerSidebar
          onOpenProfile={() => openProfile(player.id)}
          playerData={player}
          resources={resources}
          progression={progression}
          levelUpDelta={profileLevelUp.levelsGained}
          profileLevelUpActive={profileLevelUp.visible}
          gacha={gacha}
          teams={teams}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onNavigate={navigate}
          onOpenDailiesOverview={() => { setDailiesOverviewRequestToken((value) => value + 1); navigate('activities-dailies') }}
          onOpenParticleConversion={() => { setIsSidebarOpen(false); setIsParticleConversionOpen(true) }}
        />

        <main className="main-panel" id="main-content">
          <Navigation activeScreen={activeScreen} onNavigateMain={navigateMain} />
          {activeScreen.startsWith('characters-') && <SecondaryNavigation label="Sections Personnages" tabs={characterTabs} activeScreen={activeScreen} onNavigate={navigate} />}
          {activeScreen.startsWith('activities-') && <SecondaryNavigation label="Sections Activités" tabs={activityTabs} activeScreen={activeScreen} onNavigate={navigate} />}
          <div className="screen-stage" key={activeScreen}>{renderScreen()}</div>
        </main>

        <ChatPanel playerId={player.id} connectedCount={presence.value?.total ?? null}
          isCollapsed={isChatCollapsed}
          onToggle={() => setIsChatCollapsed((current) => !current)}
          onOpenPlayers={() => setIsPlayersOpen(true)}
          onOpenProfile={openProfile}
          onRefreshScopes={refreshChatScopes}
        />
      </div>

      {isSidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Fermer les informations du joueur"
        />
      )}

      {isPlayersOpen && <OnlinePlayersPanel value={presence.value} error={presence.error} ownerPlayerId={player.id} controller={friendship} onProfile={openProfile} onDirectory={() => { setIsPlayersOpen(false); setSocialTab('players'); navigate('social') }} onClose={() => { friendship.clearFeedback(); setIsPlayersOpen(false) }} />}
      {isMenuOpen && <GlobalMenu preference={menuPreference} page={menuPage} onPageChange={setMenuPage} onNavigate={screen => { if (screen === 'social') setSocialTab('friends'); navigate(screen) }} onActivities={() => navigateMain('activities')} onClose={() => setIsMenuOpen(false)} />}
      {isParticleConversionOpen && player.elementKey && <ParticleConversionModal elementKey={player.elementKey} stock={resources.particles[player.elementKey]} onClose={() => setIsParticleConversionOpen(false)} onOpenTrades={() => { setTradeIntent(undefined); navigate('trades') }} onConvert={convertParticles} />}
      {activeLevelUpFeedback && activeLevelUpFeedback.id !== closedLevelUpModalId && <LevelUpFeedback key={activeLevelUpFeedback.id} event={activeLevelUpFeedback} onFinished={finishLevelUpModal} />}
      {completedChallengeFeedback && !activeLevelUpFeedback && pendingGachaPullCount === null && !isParticleConversionOpen && <DailyChallengeCompletionFeedback challenge={completedChallengeFeedback} onFinished={() => setCompletedChallengeFeedback(null)} />}
    </div>
  )
}

export default GameShell
