import { ADMIN_OPENING_INTENT_EVENT } from '../navigation/navigation'
import { DestinationHistory,type Destination,type DestinationTabs } from '../navigation/destination-history'
import { DestinationContext } from '../navigation/destination-context'
import { readBrowserDestination,writeBrowserDestination,synchronizeBrowserPosition,requestBrowserMove } from '../navigation/destination-browser'
import type { SharedInvocationApi } from '../api/shared-invocations-types'
import { useSharedInvocations } from '../gacha/use-shared-invocations'
import type { ContestAvailability } from '../contest/contest-request-coordinator'
import HelpGuide from '../help/HelpGuide'
import type { EventDailyOpenIntent } from '../event/event-presentation'
import { getGameApiClient } from '../api/game-api'
import { useFavorPresence } from '../favor/use-favor-presence'
import FavorDailyFeedback from './FavorDailyFeedback'
import { getTutorialStep } from '../tutorial/tutorial-catalog'
import { TutorialPresentationContext } from '../tutorial/tutorial-presentation'
import { waitForTutorialTarget } from '../tutorial/tutorial-target'
import type { TutorialStepId } from '../api/types'
import type { CharacterPreparationDto } from '../api/types'
import TutorialOverlay from '../tutorial/TutorialOverlay'
import { useTutorialAutostart, tutorialLaunchBlockedReason } from '../tutorial/use-tutorial-autostart'
import { TutorialController, type TutorialApi } from '../tutorial/tutorial-controller'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { BannerVoteCache } from '../characters/banner-vote-cache'
import { useFriendships } from '../social/use-friendships'
import type { SocialTab } from '../screens/SocialScreen'
import type { SocialActions } from '../social/types'
import { usePresence } from '../social/use-presence'
import SocialScreen from '../screens/SocialScreen'
import ProfileScreen from '../screens/ProfileScreen'
import RankingsScreen from '../screens/RankingsScreen'
import HistoryScreen, { type HistoryCategory } from '../screens/HistoryScreen'
import type { RankingPageDto, BannerHistoryDto, EventHistoryDto } from '../api/types'
import type { BannerVoteActions } from '../characters/use-banner-votes'

import type { BankHistoryDto, BankTransferDto, BoxCharacterDto, BoxSortPreferenceDto, ContestDto, ContestHistoryDto, ContestSnapshotDto, CurrentGachaDto, DailyChallengeDto, DailyChallengeMutationDto, DailyCombatDto, DailyCombatFightDto, DailyRewardClaimDto, DailyRewardTodayDto, EventDto, EventRankingDto, EventGameAAttemptDto, EventJoinDto, ExpeditionClaimDto, ExpeditionDto, ExpeditionStartDto, GachaCharacterDto, GachaHistoryDto, GachaPullDto, GiftCodeClaimDto, InventoryItemDetailDto, ModerationPermissionsDto, ModerationPlayerListQuery, ModerationPlayerPageDto, ModerationStateDto, MonthlyBossAttackDto, MonthlyBossDto, MonthlyBossHistoryDto, NavigationMenuPreferenceDto, NotificationsDto, PlayerBankDto, PlayerBoxDto, PlayerDto, PlayerGiftCodesDto, PlayerInventoryDto, PlayerMissionsDto, PlayerProgressionDto, PlayerResourcesDto, PlayerShopDto, PlayerTeamsDto, ShopHistoryDto, ShopPurchaseDto, StellaUseDto, WheelSpinDto, WheelTodayDto } from '../api/types'
import type { ScreenId } from '../types'
import type { ArcadeMutation } from '../api/arcade-types'
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
import { useCommunityLayout } from '../hooks/use-community-layout'
import type { DirectMessageOpenIntent } from './DirectMessagePanel'
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
import MissionsScreen from '../screens/MissionsScreen'
import ConfigurationScreen from '../screens/ConfigurationScreen'
import ParticleConversionModal from './ParticleConversionModal'
import DailyChallengeCompletionFeedback from './DailyChallengeCompletionFeedback'
import { isDailyChallengeCompletionTransition } from '../daily-challenge/presentation'
import SecondaryNavigation from './SecondaryNavigation'
import GlobalMenu from './GlobalMenu'
import { activityTabs, characterTabs, defaultNavigationPreference, hashForScreen, type MainNavigationId } from '../navigation/navigation'
import type { ExpeditionClientSnapshot } from '../expedition/expedition-client-snapshot'
import type { ChatRefreshScope } from '../api/types'
import { runChatRefreshScopes } from '../chat/refresh-scopes'
import { resolveNotificationNavigation } from '../notifications/notification-navigation'
import { confirmedDailyDate, projectDailies, type DailyId, type DailyItem } from '../dailies/daily-summary'
import { dailyTrackerEnvironment, useDailyTracker } from '../dailies/use-daily-tracker'
import { useDailyClaim } from '../dailies/use-daily-claim'
import { useDailyRevalidation } from '../dailies/use-daily-revalidation'
import DailyTrackerCard from '../dailies/DailyTrackerCard'
import HomeDailySummary from '../dailies/HomeDailySummary'
import type { FavorDto } from '../api/types'

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

const defaultTutorialApi: TutorialApi = { claimAutostart: () => getGameApiClient().claimTutorialAutostart(), get: () => getGameApiClient().getTutorial(), put: value => getGameApiClient().putTutorial(value) }

type GameShellProps = {
  sharedInvocationApi?: SharedInvocationApi
  tutorialApi?: TutorialApi
  dailyRefresh?: { refresh: () => Promise<unknown>; refreshing: boolean; errors: Partial<Record<DailyId, boolean>>; favor: FavorDto | null }
  onRefreshResources?: () => Promise<unknown>
  externalFeedbackPending?: boolean
  onArcadeMutation?: (value: ArcadeMutation, playerId: string) => void

  onRefreshChatScopes: (scopes: readonly ChatRefreshScope[]) => Promise<void>
  onRefreshPlayerState?: () => Promise<void>
  canRefreshPlayerState?: () => boolean
  playerStateReadRevision?: number
  player: PlayerDto
  onRefreshPlayer?: () => Promise<void>
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
  onLoadMissions: () => Promise<PlayerMissionsDto>
  monthlyBoss: MonthlyBossDto
  onLoadMonthlyBoss?: () => Promise<MonthlyBossDto>
  contest: ContestDto | null
  contestAvailability?: ContestAvailability
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
  onArchiveAllNotifications?: () => Promise<NotificationsDto>
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
  preparations?: readonly CharacterPreparationDto[]
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
  onLoadBankHistory: (page: number, type?: 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST') => Promise<BankHistoryDto>
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
  onModerationApplied: (state: ModerationStateDto, targetIsSelf: boolean) => void
  onLoadAdminGiftCodes: NonNullable<Parameters<typeof ModerationScreen>[0]['onLoadGiftCodes']>
  onCreateGiftCode: Parameters<typeof ModerationScreen>[0]['onCreateGiftCode']
  onPublishGiftCode: NonNullable<Parameters<typeof ModerationScreen>[0]['onPublishGiftCode']>
  onUpdateGiftCode: Parameters<typeof ModerationScreen>[0]['onUpdateGiftCode']
  onGiftCodeClaimants: NonNullable<Parameters<typeof ModerationScreen>[0]['onGiftCodeClaimants']>
  onLoadNavigationPreferences: () => Promise<NavigationMenuPreferenceDto>
  onLoadRanking: (metric: string, page: number) => Promise<RankingPageDto>
  onLoadHistory: (category: 'banners' | 'event', page: number) => Promise<BannerHistoryDto | EventHistoryDto>
  onSaveNavigationPreferences: (value: NavigationMenuPreferenceDto) => Promise<NavigationMenuPreferenceDto>
}

function GameShell({ sharedInvocationApi, tutorialApi = defaultTutorialApi, dailyRefresh, onArcadeMutation, onRefreshResources, externalFeedbackPending = false, onRefreshChatScopes, onRefreshPlayerState, canRefreshPlayerState, playerStateReadRevision = 0, player, onRefreshPlayer, resources, progression, levelUpFeedbacks, onLevelUpFeedbackFinished, wheelToday, onSpinWheel, dailyRewardToday, onClaimDailyReward, dailyChallenge, onPurchaseDailyChallenge, onSwitchDailyChallenge, dailyCombat, onLoadMissions, monthlyBoss, onLoadMonthlyBoss, contest, contestAvailability, event, onLoadEvent, onLoadEventRanking, onJoinEvent, onClaimEventCalendar, onClaimEventDailyBonus, onConvertEventShop, onPurchaseEventCollection, onAttemptEventGameA, onAttemptEventGameB, onSearchEventGameCRecipients, onSendEventGameC, onConsultEventGameCMessages, onRefreshContest, onLoadContestHistory, onLoadContestHistoryDetail, onOpenContest, onJoinContest, onSelectContestLegend, onSetContestReady, onStartContest, onSpectateContest, onLeaveContest, onCancelContest, onPlayContest, onSupportContest, onRemoveContestParticipant, onRemoveContestSpectator, expedition, expeditionMonotonicNow, notifications, onLoadExpedition, onStartExpedition, onClaimExpedition, onLoadNotifications, onReadNotification, onArchiveNotification, onReadAllNotifications, onArchiveAllNotifications, onArchiveReadNotifications, onLoadDailyCombat, onSetDailyCombatSlot, onRemoveDailyCombatSlot, onCopyActiveTeamToDailyCombat, onAutoSelectDailyCombat, onClearDailyCombatLoadout, onFightDailyCombat, onSetMonthlyBossSlot, onRemoveMonthlyBossSlot, onCopyActiveTeamToMonthlyBoss, onClearMonthlyBossLoadout, onAttackMonthlyBoss, onLoadMonthlyBossHistory, onSignOut, gacha, characters, preparations = [], bannerVoteActions, socialActions, tradeActions, onTradeSnapshot, teams, onLoadTeams, onActivateTeam, onRenameTeam, onCreateNextTeam, onDeleteTeam, onReorderTeams, onSetTeamSlot, onReorderTeamSlots, onRemoveTeamSlot, onClearTeam, onSetGachaTarget, onPullGacha, pendingGachaPullCount, onGachaPresentationDisclosed, onGachaPresentationAbandoned, onGetGachaHistory, onLoadBox, onSetBoxFavorite, onSetBoxSortPreference, onUseStella, onLoadBank, onLoadBankHistory, onDepositBank, onWithdrawBank, onLoadShop, onLoadShopHistory, onPurchaseShop, onLoadGiftCodes, onClaimGiftCode, onLoadInventory, onLoadInventoryItemDetail, onConvertParticles, permissions, onLoadModeration, onListModerationPlayers, onModerationResource, onModerationXp, onModerationGacha, onModerationStella, onModerationApplied, onLoadAdminGiftCodes, onCreateGiftCode, onPublishGiftCode, onUpdateGiftCode, onGiftCodeClaimants, onLoadNavigationPreferences, onSaveNavigationPreferences, onLoadRanking, onLoadHistory }: GameShellProps) {
  const [socialTab, setSocialTab] = useState<SocialTab>('friends')
  const [historyIntent, setHistoryIntent] = useState<{ category: HistoryCategory; token: string } | null>(null)
  const { close: closePresence, ...presence } = usePresence(player.id, socialActions)
  const [profileId, setProfileId] = useState(player.id)
  const [configurationTab, setConfigurationTab] = useState<'menu' | 'privacy' | 'account'>(() => new URLSearchParams(window.location.search).has('twitch') ? 'account' : 'menu')
  const openProfile = (id: string) => { setProfileId(id);  setIsPlayersOpen(false); setIsSidebarOpen(false); navigate('profile',{profile:'Aperçu'},id) }
  const voteCache = useMemo(() => new BannerVoteCache(player.id), [player.id])
  useEffect(() => () => voteCache.clear(), [voteCache])
  const refreshMonthlyBoss = useCallback(() => onLoadMonthlyBoss ? onLoadMonthlyBoss() : Promise.resolve(monthlyBoss), [monthlyBoss, onLoadMonthlyBoss])
  const destinationHistory=useMemo(()=>{const initial=readBrowserDestination(player.id).destination;return new DestinationHistory(player.id,destinationAllowed(initial)?initial:{screen:'home',tabs:{}})},[player.id])
  const destinationState=useSyncExternalStore(destinationHistory.subscribe,destinationHistory.getSnapshot)
  const navigationPlayer=useRef(player.id);navigationPlayer.current=player.id
  const browserMovePending=useRef(false)
  const browserMoveTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const [browserMoving,setBrowserMoving]=useState(false)
  useEffect(()=>()=>{if(browserMoveTimer.current)clearTimeout(browserMoveTimer.current)},[destinationHistory])
  const [activeScreen, setActiveScreen] = useState<ScreenId>(()=>destinationHistory.getSnapshot().current.screen)
  const sharedInvocations = useSharedInvocations(sharedInvocationApi, activeScreen === 'invocation', onRefreshPlayerState, player.id)
  const previousSharedMode = useRef({broadcasting:false,watching:false})
  useEffect(() => {
    const next={broadcasting:!!sharedInvocations.state.broadcasting,watching:!!sharedInvocations.state.watching}
    if ((!previousSharedMode.current.watching && next.watching) || (previousSharedMode.current.broadcasting && !next.broadcasting)) onGachaPresentationAbandoned()
    previousSharedMode.current=next
  }, [sharedInvocations.state.broadcasting,sharedInvocations.state.watching,onGachaPresentationAbandoned])
  const activeScreenRef = useRef(activeScreen)
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const communityLayout = useCommunityLayout(player.id)
  const [directMessageIntent, setDirectMessageIntent] = useState<DirectMessageOpenIntent | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [presentationStepId, setPresentationStepId] = useState<TutorialStepId | null>(null)
  const prepareTutorial = useCallback(async (id: TutorialStepId, signal: AbortSignal) => {
    if (signal.aborted) throw new DOMException('Annulé', 'AbortError')
    const step = getTutorialStep(id)
    setPresentationStepId(id)
    activeScreenRef.current = step.screen
    setActiveScreen(step.screen)
    window.history.replaceState(window.history.state, '', '#' + hashForScreen(step.screen))
    return waitForTutorialTarget(step, signal)
  }, [])
  const tutorial = useMemo(() => new TutorialController(tutorialApi, prepareTutorial), [player.id, tutorialApi, prepareTutorial])
  const tutorialState = useSyncExternalStore(tutorial.subscribe, tutorial.getSnapshot)
  const tutorialSidebar = tutorialState.active && ['profile', 'resources', 'active-team', 'objective', 'daily-tracker'].includes(presentationStepId ?? '')
  useEffect(() => { tutorial.activate(); return tutorial.dispose }, [tutorial])
  const sidebarBeforeTutorial = useRef(false)
  const wasTutorialActive = useRef(false)
  useEffect(() => {
    if (wasTutorialActive.current && !tutorialState.active) {
      setIsSidebarOpen(sidebarBeforeTutorial.current)
      const before=destinationHistory.getSnapshot().current,screen=activeScreenRef.current
      const destination:Destination={screen,tabs:screen===before.screen?before.tabs:{},...(screen==='profile'?{profileId}: {})}
      // Internal preparations only replace the URL. At the user's exit, restore
      // the original browser entry before recording the single final destination.
      writeBrowserDestination(destinationHistory,'replace')
      if(allowedRef.current(destination)&&destinationHistory.visit(destination))writeBrowserDestination(destinationHistory,'push')
    }
    wasTutorialActive.current = tutorialState.active
  }, [tutorialState.active,destinationHistory,profileId])
  const [chatOwnerRevision, setChatOwnerRevision] = useState(0)
  const [isPlayersOpen, setIsPlayersOpen] = useState(false)
  const openDirectMessage = (target: DirectMessageOpenIntent['player']) => { if (!target) return; setIsChatCollapsed(false); setDirectMessageIntent({ playerId: target.id, player: target, token: crypto.randomUUID() }) }
  const friendship = useFriendships(socialActions, activeScreen === 'social' || activeScreen === 'profile' || activeScreen === 'activities-dailies' || isPlayersOpen)
  const clearFriendshipFeedback = friendship.clearFeedback
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [tutorialUnavailable, setTutorialUnavailable] = useState('')
  const [isParticleConversionOpen, setIsParticleConversionOpen] = useState(false)
  const previousDailyChallengeStatus = useRef(dailyChallenge.status)
  const previousPlayerStateReadRevision = useRef(playerStateReadRevision)
  const [completedChallengeFeedback, setCompletedChallengeFeedback] = useState<NonNullable<DailyChallengeDto['challenge']> | null>(null)
  const [menuPage, setMenuPage] = useState(1)
  const [menuPreference, setMenuPreference] = useState<NavigationMenuPreferenceDto>(defaultNavigationPreference)
  const [lastCharacterScreen, setLastCharacterScreen] = useState<ScreenId>(() => activeScreen.startsWith('characters-') ? activeScreen : 'characters-box')
  const [lastActivityScreen, setLastActivityScreen] = useState<ScreenId>(() => activeScreen.startsWith('activities-') ? activeScreen : 'activities-dailies')
  const [dailiesRequestedTab, setDailiesRequestedTab] = useState<'overview' | 'wheel' | 'challenge'>('overview')
  const [dailiesOverviewRequestToken, setDailiesOverviewRequestToken] = useState(0)
  const [bossRequestToken, setBossRequestToken] = useState(0)
  const [eventMessagesRequestToken, setEventMessagesRequestToken] = useState(0)
  const [eventShopRequestToken, setEventShopRequestToken] = useState(0)
  const [eventDailyIntent, setEventDailyIntent] = useState<EventDailyOpenIntent | null>(null)
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
  const recordFavor = useCallback(() => getGameApiClient().recordFavorPresence(), [])
  const refreshFavorResources = useCallback(() => onRefreshResources ? onRefreshResources() : Promise.resolve(), [onRefreshResources])
  const favorPresence = useFavorPresence(player.id, recordFavor, refreshFavorResources)
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
    const reread = previousPlayerStateReadRevision.current !== playerStateReadRevision
    previousPlayerStateReadRevision.current = playerStateReadRevision
    if (!reread && isDailyChallengeCompletionTransition(previous, dailyChallenge)) setCompletedChallengeFeedback(dailyChallenge.challenge)
  }, [dailyChallenge, playerStateReadRevision])
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
  const claimGiftCode = useCallback(async (editionId: string, key: string) => {
    const result = await onClaimGiftCode(editionId, key)
    boxCache.clear()
    inventoryCache.clear()
    return result
  }, [boxCache, inventoryCache, onClaimGiftCode])
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
  const refreshSharedPlayerState = useCallback(async () => {
    if (!onRefreshPlayerState) return
    await onRefreshPlayerState()
    boxCache.clear()
    inventoryCache.clear()
    bankCache.clear()
    shopCache.clear()
    voteCache.clear()
    setChatOwnerRevision(value => value + 1)
  }, [onRefreshPlayerState, boxCache, inventoryCache, bankCache, shopCache, voteCache])
  const refreshAfterSnapshotImport = useCallback(async () => {
    await refreshSharedPlayerState()
  }, [refreshSharedPlayerState])
  const refreshChatScopes = useCallback(async (scopes: readonly ChatRefreshScope[]) => {
    const results = await Promise.allSettled([onRefreshChatScopes(scopes), runChatRefreshScopes(scopes, {
      box: loadBox,
      inventory: loadInventory,
      bank: loadBank,
      shop: loadShop,
      social: () => friendship.refresh(true),
      ...(tradeActions ? { trades: () => tradeActions.snapshot().then(value => onTradeSnapshot?.(value)) } : {}),
      ...(bannerVoteActions?.onLoadVotes ? { bannerVotes: () => voteCache.revalidate(bannerVoteActions.onLoadVotes!) } : {}),
      giftCodes: onLoadGiftCodes,
    })])
    if (scopes.some(scope => chatCacheScopesByScreen[activeScreenRef.current]?.includes(scope))) setChatOwnerRevision(value => value + 1)
    if (results.some(result => result.status === 'rejected')) throw new Error('Une projection n’a pas pu être rechargée.')
  }, [bannerVoteActions, friendship, loadBank, loadBox, loadInventory, loadShop, onLoadGiftCodes, onRefreshChatScopes, onTradeSnapshot, tradeActions, voteCache])
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
  const notificationNavigationRevision = useRef(0)
  useEffect(()=>()=>{notificationNavigationRevision.current++},[])
  const signOutAndClearCaches = useCallback(async () => {
    notificationNavigationRevision.current++
    voteCache.clear()
    boxCache.clear()
    bankCache.clear()
    inventoryCache.clear()
    moderationIntents.clear()
    shopCache.clear()
    shopIntents.clear()
    await closePresence()
    await onSignOut()
    destinationHistory.clear()
    const {gachaDestination: _destination, ...browserState} = window.history.state ?? {}
    void _destination
    window.history.replaceState(browserState, '', '#home')
  }, [bankCache, boxCache, inventoryCache, moderationIntents, onSignOut, shopCache, shopIntents, voteCache, closePresence, destinationHistory])

  const changeScreen = useCallback((screen: ScreenId) => {
    notificationNavigationRevision.current++
    if (activeScreenRef.current === 'invocation' && screen !== 'invocation') onGachaPresentationAbandoned()
    if (screen !== 'configuration') setConfigurationTab('menu')
    if (screen !== 'trades') setTradeIntent(undefined)
    activeScreenRef.current = screen
    setActiveScreen(screen)
    if (screen !== 'activities-combat') setBossRequestToken(0)
    if (screen !== 'activities-event') { setEventMessagesRequestToken(0); setEventShopRequestToken(0); setEventDailyIntent(null) }
    if (screen.startsWith('characters-')) setLastCharacterScreen(screen)
    if (screen.startsWith('activities-')) setLastActivityScreen(screen)
    clearFriendshipFeedback()
  }, [clearFriendshipFeedback, onGachaPresentationAbandoned, setConfigurationTab, setBossRequestToken, setEventMessagesRequestToken, setEventShopRequestToken, setEventDailyIntent, setTradeIntent])

  function destinationAllowed(destination:Destination){
    if(destination.screen==='moderation'){
      const caps=permissions.capabilities,tab=destination.tabs.moderation;
      if(!caps.moderationAccess)return false;
      if(tab&&['characters','codes','banners','events','audit'].includes(tab)&&!caps.superTools)return false;
      if(tab&&['community','giveaway'].includes(tab)&&!caps.communityModeration)return false;
      if(tab==='system'&&!caps.selfResourceTools&&!caps.selfGameplayTools&&!caps.superTools)return false;
    }
    if(destination.screen==='profile'&&destination.tabs.profile==='Personnalisation'&&destination.profileId&&destination.profileId!==player.id)return false;
    if(destination.screen==='activities-event'&&destination.tabs.event==='games'){
      if(!event)return false;
      if(!event.participation.joined&&!event.gameC.available)return false;
      if(!event.participation.joined&&destination.tabs.eventGame!==2)return false;
    }
    return true;
  }
  const allowedRef=useRef(destinationAllowed);allowedRef.current=destinationAllowed;
  const restoreDestination=(destination:Destination)=>{
    setHistoryIntent(null);setBoxOpenIntent(null);setTradeIntent(undefined);
    if(destination.screen==='profile')setProfileId(destination.profileId??player.id);
    changeScreen(destination.screen);
  }
  const restoreRef=useRef(restoreDestination);restoreRef.current=restoreDestination;
  const communityLayoutRef=useRef(communityLayout);communityLayoutRef.current=communityLayout;
  useEffect(()=>{
    const next=destinationHistory.getSnapshot().current;
    if(!allowedRef.current(next))destinationHistory.visit({screen:'home',tabs:{}});
    restoreRef.current(destinationHistory.getSnapshot().current);
    writeBrowserDestination(destinationHistory,'replace',true);
  },[destinationHistory]);
  useEffect(()=>{
    if(tutorialState.active)return;
    const current=destinationHistory.getSnapshot().current;
    if(!allowedRef.current(current)){
      destinationHistory.visit({screen:'home',tabs:{communityPanel:current.tabs.communityPanel,directMailbox:current.tabs.directMailbox}});
      restoreRef.current(destinationHistory.getSnapshot().current);writeBrowserDestination(destinationHistory,'replace');
    }
  },[permissions,event,tutorialState.active,destinationHistory]);
  useEffect(() => {
    const syncScreenWithHash = () => {
      browserMovePending.current=false;setBrowserMoving(false);if(browserMoveTimer.current)clearTimeout(browserMoveTimer.current)
      if(tutorial.getSnapshot().active){window.history.replaceState(window.history.state,'','#'+hashForScreen(activeScreenRef.current));return}
      communityLayoutRef.current.setExpanded(false)
      const native=readBrowserDestination(player.id);
      synchronizeBrowserPosition(destinationHistory,native.index,native.segment);
      if(!allowedRef.current(native.destination)){destinationHistory.visit({screen:'home',tabs:{}});restoreRef.current(destinationHistory.getSnapshot().current);writeBrowserDestination(destinationHistory,'replace');return}
      destinationHistory.native(native.destination,native.id);
      restoreRef.current(destinationHistory.getSnapshot().current);
      writeBrowserDestination(destinationHistory,'replace',true);
    }
    window.addEventListener('hashchange',syncScreenWithHash);window.addEventListener('popstate',syncScreenWithHash);
    return()=>{window.removeEventListener('hashchange',syncScreenWithHash);window.removeEventListener('popstate',syncScreenWithHash)};
  },[destinationHistory,tutorial,player.id]);

  const navigate = (screen:ScreenId,tabs?:Partial<DestinationTabs>,targetProfileId?:string) => {
    if(tutorial.getSnapshot().active||browserMovePending.current||destinationHistory.playerId!==navigationPlayer.current)return false;
    const same=destinationHistory.getSnapshot().current.screen===screen;
    const previousTabs=destinationHistory.getSnapshot().current.tabs;
    const destination:Destination={screen,tabs:{communityPanel:previousTabs.communityPanel,directMailbox:previousTabs.directMailbox,...(tabs??(same?previousTabs:{}))},...(screen==='profile'?{profileId:targetProfileId??profileId}:{})};
    if(!allowedRef.current(destination))return false;
    if (communityLayout.expanded) communityLayout.setExpanded(false)
    const changed=destinationHistory.visit(destination);
    changeScreen(screen);
    if(changed)writeBrowserDestination(destinationHistory,'push');
    setIsSidebarOpen(false);window.scrollTo({top:0,behavior:'smooth'});
    return true;
  }
  const moveDestination=(direction:-1|1)=>{
    if(tutorial.getSnapshot().active||browserMovePending.current||destinationHistory.index(direction,destinationAllowed)===null)return;
    if (communityLayout.expanded) communityLayout.setExpanded(false)
    if(requestBrowserMove(destinationHistory,direction,destinationAllowed)){
      browserMovePending.current=true;setBrowserMoving(true)
      browserMoveTimer.current=setTimeout(()=>{browserMovePending.current=false;setBrowserMoving(false)},1000)
    }else restoreDestination(destinationHistory.getSnapshot().current);
    setIsSidebarOpen(false);
  }
  const tabNavigation=(mode:'push'|'replace')=>{if(!tutorial.getSnapshot().active)writeBrowserDestination(destinationHistory,mode,mode==='replace')};



  const beforeTutorialLaunch = () => {
    setTutorialUnavailable(''); sidebarBeforeTutorial.current = isSidebarOpen; setIsMenuOpen(false); setIsHelpOpen(false)
  }

  const launchTutorial = () => {
    if (tutorial.getSnapshot().active) return
    if (tutorialLaunchBlockedReason(tutorialBusy)) {
      if (!isHelpOpen) setIsMenuOpen(true); setTutorialUnavailable('Terminez l’action ou la présentation en cours avant de lancer le Tutoriel.'); return
    }
    setTutorialUnavailable('')
    sidebarBeforeTutorial.current = isSidebarOpen
    setIsMenuOpen(false)
    setIsHelpOpen(false)
    void tutorial.launch()
  }

  const openHistory = (category: HistoryCategory) => { setHistoryIntent({ category, token: crypto.randomUUID() }); navigate('history',{history:category}) }
  const navigateMain = (id: MainNavigationId) => { if (id === 'configuration') {setConfigurationTab('menu');navigate('configuration',{configuration:'menu'});return} navigate(id === 'characters' ? lastCharacterScreen : id === 'activities' ? lastActivityScreen : id) }
  const saveMenuPreference = async (value: NavigationMenuPreferenceDto) => { const saved = await onSaveNavigationPreferences(value); setMenuPreference(saved) }

  const presenceFavor = favorPresence.favor
  const readFavor = dailyRefresh?.favor
  const favor = readFavor && (!presenceFavor || readFavor.businessDate > presenceFavor.businessDate || readFavor.businessDate === presenceFavor.businessDate && readFavor.claimedToday && !presenceFavor.claimedToday) ? readFavor : presenceFavor
  const dailySources = { elementKey: player.elementKey ?? undefined, favor, reward: dailyRewardToday, wheel: wheelToday, challenge: dailyChallenge,
    combat: dailyCombat, boss: monthlyBoss, expedition, monotonicNow: expeditionMonotonicNow, event,
    friendship: friendship.value?.summary, friendshipDate: friendship.value?.businessDate,
    errors: { ...dailyRefresh?.errors, favor: Boolean(favorPresence.error || dailyRefresh?.errors.favor), friendship: Boolean(friendship.readError || friendship.error || dailyRefresh?.errors.friendship) } }
  const dailyItems = projectDailies(dailySources)
  const dailyTracker = useDailyTracker(dailyItems, player.id, confirmedDailyDate(dailySources), dailyTrackerEnvironment())
  const dailyClaim = useDailyClaim(onClaimDailyReward, player.id)
  const tutorialBusy = Boolean(pendingGachaPullCount !== null || activeLevelUpFeedback || externalFeedbackPending || profileLevelUpEvent || completedChallengeFeedback || favorPresence.feedbacks.length || dailyClaim.locked || isParticleConversionOpen)
  useTutorialAutostart(player.id, Boolean(player.elementKey), tutorialApi, tutorial, tutorialBusy, beforeTutorialLaunch)
  useDailyRevalidation(player.id, dailyRefresh?.refresh ?? (() => Promise.resolve()), () => friendship.refresh(), onRefreshPlayerState ? { refresh: refreshSharedPlayerState, canRefresh: canRefreshPlayerState } : undefined)
  const openDailies = (tab: 'overview' | 'wheel' | 'challenge') => { setDailiesRequestedTab(tab); setDailiesOverviewRequestToken(value => value + 1); navigate('activities-dailies',{dailies:tab}) }
  const openDailiesOverview = () => openDailies('overview')
  const openDaily = (item: DailyItem) => {
    if (!item.destination) return
    switch (item.destination.kind) {
      case 'overview': openDailiesOverview(); break
      case 'wheel': case 'challenge': openDailies(item.destination.kind); break
      case 'combat': setBossRequestToken(0); navigate('activities-combat'); break
      case 'boss': setBossRequestToken(value => value + 1); navigate('activities-combat',{combat:'boss'}); break
      case 'expedition': setBoxOpenIntent(expedition.value.activeCharacter && expedition.value.operationalStatus !== 'IDLE' ? { characterId: expedition.value.activeCharacter.id, token: crypto.randomUUID() } : null); navigate('characters-box'); break
      case 'friends': setSocialTab('friends'); navigate('social',{social:'friends'}); break
      case 'event': setEventMessagesRequestToken(0); setEventShopRequestToken(0); setEventDailyIntent({ ...item.destination.destination, token: crypto.randomUUID() }); navigate('activities-event'); break
    }
  }
  const compactDailyProps = { items: dailyItems, tracker: dailyTracker, claim: dailyClaim, onOpen: openDaily, onOverview: openDailiesOverview, refreshing: dailyRefresh?.refreshing }

  const renderScreen = () => {
    if (activeScreen === 'activities-missions') return <MissionsScreen onLoad={onLoadMissions} refreshToken={chatOwnerRevision} />
    switch (activeScreen) {
      case 'invocation':
        return <InvocationScreen ownerKey={player.id} onProfile={openProfile} shared={sharedInvocations} gacha={gacha} teams={teams} onSetTarget={onSetGachaTarget} onPull={onPullGacha} pendingPullCount={pendingGachaPullCount} onPresentationDisclosed={onGachaPresentationDisclosed} onGetHistory={onGetGachaHistory} />
      case 'characters-box':
        return <BoxScreen initialBox={boxCache.read(player.id)} refreshToken={chatOwnerRevision} dailyCombat={dailyCombat} expedition={expedition} expeditionMonotonicNow={expeditionMonotonicNow} openCharacterIntent={boxOpenIntent} onOpenCharacterIntentConsumed={(token) => setBoxOpenIntent((current) => current?.token === token ? null : current)} onLoadExpedition={onLoadExpedition} onStartExpedition={onStartExpedition} onClaimExpedition={onClaimExpedition} onNotificationsChanged={onLoadNotifications} onLoadBox={loadBox} onSetFavorite={setBoxFavorite} onSetSortPreference={setBoxSortPreference} onUseStella={useStella} stellaRetryCharacterId={stellaIntents.getIntent(player.id)?.characterId ?? null} />
      case 'characters-catalog':
        return <CharactersScreen key={player.id} characters={characters} preparations={preparations} voteCache={voteCache} refreshToken={chatOwnerRevision} {...bannerVoteActions} />
      case 'characters-team':
        return <TeamScreen teams={teams} dailyCombat={dailyCombat} initialBox={boxCache.read(player.id)} refreshToken={chatOwnerRevision} stellaRetryCharacterId={stellaIntents.getIntent(player.id)?.characterId ?? null} onLoad={onLoadTeams} onActivate={onActivateTeam} onRename={onRenameTeam} onCreateNext={onCreateNextTeam} onDelete={onDeleteTeam} onReorderTeams={onReorderTeams} onSetSlot={onSetTeamSlot} onReorderSlots={onReorderTeamSlots} onRemoveSlot={onRemoveTeamSlot} onClear={onClearTeam} onLoadBox={loadBox} onSetBoxFavorite={setBoxFavorite} onUseStella={useStella} />
      case 'inventory':
        return <InventoryScreen key={player.id} initialInventory={inventoryCache.read(player.id)} refreshToken={chatOwnerRevision} resources={resources} elementKey={player.elementKey!} dailyCombat={dailyCombat} onLoad={loadInventory} onLoadItemDetail={onLoadInventoryItemDetail} onConvertParticles={convertParticles} onNavigateShop={() => navigate('shop')} onNavigateBank={() => navigate('bank')} onNavigateTrades={() => navigate('trades')} onLoadBox={loadBox} onSetBoxFavorite={setBoxFavorite} onUseStella={useStella} stellaRetryCharacterId={stellaIntents.getIntent(player.id)?.characterId ?? null} onLoadTeams={onLoadTeams} />
      case 'bank':
        return <BankScreen initialBank={bankCache.read(player.id)} refreshToken={chatOwnerRevision} onLoad={loadBank} onLoadHistory={onLoadBankHistory} onOpenGlobalHistory={() => openHistory('bank')} onTransfer={transferBank} />
      case 'moderation':
        return permissions.capabilities.moderationAccess ? <ModerationScreen actorPlayerId={player.id} capabilities={permissions.capabilities} onLoad={onLoadModeration} onListPlayers={onListModerationPlayers} onResource={moderateResource} onXp={moderateXp} onGacha={moderateGacha} onStella={moderateStella} onApplied={applyModerationResult} onLoadGiftCodes={onLoadAdminGiftCodes} onCreateGiftCode={onCreateGiftCode} onPublishGiftCode={onPublishGiftCode} onUpdateGiftCode={onUpdateGiftCode} onGiftCodeClaimants={onGiftCodeClaimants} /> : <HomeScreen onPersonalize={() => { setProfileId(player.id); navigate('profile',{profile:'Personnalisation',appearance:'AVATAR'},player.id) }} ownerPlayerId={player.id} onNavigate={navigate} gacha={gacha} onSetGachaTarget={onSetGachaTarget} dailySummary={<HomeDailySummary {...compactDailyProps} />} />
      case 'codes':
        return <GiftCodesScreen refreshToken={chatOwnerRevision} onLoad={onLoadGiftCodes} onClaim={claimGiftCode} />
      case 'shop':
        return <ShopScreen initialShop={shopCache.read(player.id)} refreshToken={chatOwnerRevision} onLoad={loadShop} onLoadHistory={onLoadShopHistory} onOpenGlobalHistory={() => openHistory('shop')} onPurchase={purchaseShop} onNavigateBank={() => navigate('bank')} />
      case 'activities-dailies':
      case 'activities-combat':
      case 'activities-event':
      case 'activities-arcade':
      case 'activities-contest':
return <ActivitiesScreen dailyItems={dailyItems} dailyClaim={dailyClaim} dailiesRequestedTab={dailiesRequestedTab} onArcadeMutation={onArcadeMutation} arcadeFeedbackPending={Boolean(activeLevelUpFeedback || externalFeedbackPending || favorPresence.feedbacks[0] || completedChallengeFeedback)} favor={favorPresence.favor} favorError={favorPresence.error} friendship={friendship.value?.summary} friendshipError={friendship.error} onOpenFriends={() => { setSocialTab('friends'); navigate('social',{social:'friends'}) }} sessionUserId={player.id} screen={activeScreen} event={event} onLoadEvent={onLoadEvent} onLoadEventRanking={onLoadEventRanking} onJoinEvent={onJoinEvent} onClaimEventCalendar={onClaimEventCalendar} onClaimEventDailyBonus={onClaimEventDailyBonus} onConvertEventShop={onConvertEventShop} onPurchaseEventCollection={purchaseEventCollection} onAttemptEventGameA={onAttemptEventGameA} onAttemptEventGameB={onAttemptEventGameB} onSearchEventGameCRecipients={onSearchEventGameCRecipients} onSendEventGameC={onSendEventGameC} onConsultEventGameCMessages={onConsultEventGameCMessages} eventDailyIntent={eventDailyIntent} onEventDailyIntentConsumed={token => setEventDailyIntent(current => current?.token === token ? null : current)} onOpenDailyEvent={destination => { setEventMessagesRequestToken(0); setEventShopRequestToken(0); setEventDailyIntent({ ...destination, token: crypto.randomUUID() }); navigate('activities-event',{event:destination.section,...(destination.section==='games'?{eventGame:destination.game}:{})}) }} eventMessagesRequestToken={eventMessagesRequestToken} eventShopRequestToken={eventShopRequestToken} dailiesOverviewRequestToken={dailiesOverviewRequestToken} bossRequestToken={bossRequestToken} wheelToday={wheelToday} onSpinWheel={onSpinWheel} dailyRewardToday={dailyRewardToday} dailyChallenge={dailyChallenge} dailyCombat={dailyCombat} monthlyBoss={monthlyBoss} contest={contest} contestAvailability={contestAvailability} onRefreshContest={onRefreshContest} onLoadContestHistory={onLoadContestHistory} onLoadContestHistoryDetail={onLoadContestHistoryDetail} onOpenContest={onOpenContest} onJoinContest={onJoinContest} onSelectContestLegend={onSelectContestLegend} onSetContestReady={onSetContestReady} onStartContest={onStartContest} onSpectateContest={onSpectateContest} onLeaveContest={onLeaveContest} onCancelContest={onCancelContest} onPlayContest={onPlayContest} onSupportContest={onSupportContest} onRemoveContestParticipant={onRemoveContestParticipant} onRemoveContestSpectator={onRemoveContestSpectator} expedition={expedition} expeditionMonotonicNow={expeditionMonotonicNow} dailyCombatBox={{ initialBox: boxCache.read(player.id), refreshToken: chatOwnerRevision, onLoadBox: loadBox, onSetFavorite: setBoxFavorite, onUseStella: useStella, stellaRetryCharacterId: stellaIntents.getIntent(player.id)?.characterId ?? null, onCharacterProgressed: () => Promise.all([onLoadTeams(), onLoadDailyCombat()]) }} elementKey={player.elementKey!} onClaimDailyReward={dailyClaim.run} onPurchaseDailyChallenge={onPurchaseDailyChallenge} onSwitchDailyChallenge={onSwitchDailyChallenge} onSetDailyCombatSlot={onSetDailyCombatSlot} onRemoveDailyCombatSlot={onRemoveDailyCombatSlot} onCopyActiveTeamToDailyCombat={onCopyActiveTeamToDailyCombat} onAutoSelectDailyCombat={onAutoSelectDailyCombat} onClearDailyCombatLoadout={onClearDailyCombatLoadout} onFightDailyCombat={onFightDailyCombat} onSetMonthlyBossSlot={onSetMonthlyBossSlot} onRemoveMonthlyBossSlot={onRemoveMonthlyBossSlot} onCopyActiveTeamToMonthlyBoss={onCopyActiveTeamToMonthlyBoss} onClearMonthlyBossLoadout={onClearMonthlyBossLoadout} onAttackMonthlyBoss={onAttackMonthlyBoss} onLoadMonthlyBossHistory={onLoadMonthlyBossHistory} onOpenParticleConversion={() => setIsParticleConversionOpen(true)} onOpenBoss={() => { setBossRequestToken((value) => value + 1); navigate('activities-combat',{combat:'boss'}) }} onOpenExpedition={() => { if (expedition.value.activeCharacter && expedition.value.operationalStatus !== 'IDLE') { setBoxOpenIntent({ characterId: expedition.value.activeCharacter.id, token: crypto.randomUUID() }); navigate('characters-box') } else { setBoxOpenIntent(null); navigate('characters-box') } }} onOpenEventHistory={() => openHistory('event')} onNavigate={navigate} />
      case 'trades':
        return tradeActions ? <TradesScreen key={player.id} intent={tradeIntent} refreshToken={chatOwnerRevision} actions={tradeActions} playerId={player.id} onSnapshot={value => { inventoryCache.applyTradeStocks(player.id, value.stocks); onTradeSnapshot?.(value) }} /> : null
      case 'social':
        return socialActions ? <SocialScreen actions={socialActions} onProfile={openProfile} controller={friendship} selectedTab={socialTab} onTabChange={setSocialTab} /> : null
      case 'profile':
        return socialActions ? <ProfileScreen key={tutorialState.active ? player.id : profileId} refreshToken={chatOwnerRevision} playerId={tutorialState.active ? player.id : profileId} ownerPlayerId={player.id} actions={socialActions} controller={friendship} onMessage={openDirectMessage} onTrade={partner => { setTradeIntent({ token: crypto.randomUUID(), partner }); navigate('trades',{trades:'create'}) }} onDirectory={() => { setSocialTab('players'); navigate('social',{social:'players'}) }} onRankings={() => navigate('rankings')} onPrivacy={() => { setConfigurationTab('privacy'); navigate('configuration',{configuration:'privacy'}) }} onAppearanceChanged={onRefreshPlayer} /> : null
      case 'rankings':
        return <RankingsScreen onLoad={onLoadRanking} onProfile={openProfile} />
      case 'history':
        return <HistoryScreen key={player.id} initialCategory={historyIntent?.category ?? 'invocations'} onInvocations={onGetGachaHistory} onActivity={getGameApiClient().getActivityHistory} onBannersOrEvent={onLoadHistory} onBank={onLoadBankHistory} onShop={onLoadShopHistory} />
      case 'configuration':
        return <ConfigurationScreen onRefreshPlayerState={refreshAfterSnapshotImport} socialActions={socialActions} initialTab={configurationTab} preference={menuPreference} onSave={saveMenuPreference} onReset={() => saveMenuPreference(defaultNavigationPreference)} />
      default:
        return <HomeScreen onPersonalize={() => { setProfileId(player.id); navigate('profile',{profile:'Personnalisation',appearance:'AVATAR'},player.id) }} ownerPlayerId={player.id} onNavigate={navigate} gacha={gacha} onSetGachaTarget={onSetGachaTarget} dailySummary={<HomeDailySummary {...compactDailyProps} />} />
    }
  }

  void destinationState
  const presentationStep = tutorialState.active && presentationStepId ? getTutorialStep(presentationStepId) : null
  const revealCommunity = tutorialState.active && (presentationStep?.chapter === 'Communauté' || presentationStep?.id === 'community')
  return (
    <DestinationContext.Provider value={{history:destinationHistory,disabled:browserMoving||tutorialState.active||destinationState.current.screen!==activeScreen,onTab:tabNavigation}}>
    <TutorialPresentationContext.Provider value={{ active: tutorialState.active, step: presentationStep }}>
    <div className={`game-shell${isChatCollapsed && !revealCommunity ? ' chat-is-collapsed' : ''}${communityLayout.expanded && communityLayout.available && !isChatCollapsed && !tutorialState.active ? ' community-is-expanded' : ''}${tutorialSidebar ? ' tutorial-sidebar' : ''}`}>
      <GameHeader navigationHistory={{back:!browserMoving&&!tutorialState.active&&destinationHistory.index(-1,destinationAllowed)!==null,forward:!browserMoving&&!tutorialState.active&&destinationHistory.index(1,destinationAllowed)!==null,onBack:()=>moveDestination(-1),onForward:()=>moveDestination(1)}}
        elementKey={player.elementKey}
        avatarAssetPath={player.avatarAssetPath}
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
        onArchiveAllNotifications={onArchiveAllNotifications}
        onArchiveReadNotifications={onArchiveReadNotifications}
        onOpenNotification={(notification) => {
          const intent = resolveNotificationNavigation(notification)
          const revision=notificationNavigationRevision.current
          switch (intent.destination) {
            case 'admin-candidate': if (!permissions.capabilities.superTools || !intent.targetId) return false; return getGameApiClient().getCatalogCandidate(intent.targetId).then(()=>{if(revision!==notificationNavigationRevision.current)return false;if(!navigate('moderation',{moderation:'characters',adminCharacters:'pipeline'}))return false; window.history.replaceState(window.history.state,'',`#moderation/candidates/${intent.targetId}`); window.dispatchEvent(new Event(ADMIN_OPENING_INTENT_EVENT));return true})
            case 'admin-character': if (!permissions.capabilities.superTools || !intent.targetId) return false; return getGameApiClient().getAdminCharacter(intent.targetId).then(()=>{if(revision!==notificationNavigationRevision.current)return false;if(!navigate('moderation',{moderation:'characters',adminCharacters:'catalog'}))return false; window.history.replaceState(window.history.state,'',`#moderation/characters/${intent.targetId}`); window.dispatchEvent(new Event(ADMIN_OPENING_INTENT_EVENT));return true})
            case 'arcade-invite': navigate('activities-arcade'); window.dispatchEvent(new Event('arcade:refresh')); break
            case 'profile-personalization': setProfileId(player.id); navigate('profile',{profile:'Personnalisation',appearance:'AVATAR'},player.id); break
            case 'expedition': if (intent.targetId) { setBoxOpenIntent({ characterId: intent.targetId, token: crypto.randomUUID() }); navigate('characters-box') } break
            case 'monthly-boss': setBossRequestToken(value => value + 1); navigate('activities-combat',{combat:'boss'}); break
            case 'event-messages': setEventDailyIntent(null); setEventShopRequestToken(0); setEventMessagesRequestToken(value => value + 1); navigate('activities-event',{event:'games',eventGame:2}); break
            case 'event-shop': setEventDailyIntent(null); setEventMessagesRequestToken(0); setEventShopRequestToken(value => value + 1); navigate('activities-event',{event:'shop'}); break
            case 'event': setEventDailyIntent(null); setEventMessagesRequestToken(0); setEventShopRequestToken(0); navigate('activities-event',{event:'registration'}); break
            case 'gift-code': navigate('codes'); break
            case 'social-requests': void friendship.refresh(true); setSocialTab('requests'); navigate('social',{social:'requests'}); break
            case 'social-friends': void friendship.refresh(true); setSocialTab('friends'); navigate('social',{social:'friends'}); break
            case 'trades-history': setTradeIntent({ token: crypto.randomUUID(), tab: 'history' }); navigate('trades',{trades:'history'}); break
            case 'trades': setTradeIntent({ token: crypto.randomUUID(), tab: 'received' }); navigate('trades',{trades:'received'}); break
            case 'missions': navigate('activities-missions'); break
          }
        }}
      />

      <div className="game-layout">
        <PlayerSidebar
          dailyTracker={<DailyTrackerCard {...compactDailyProps} />}
          onOpenProfile={() => openProfile(player.id)}
          playerData={player}
          resources={resources}
          progression={progression}
          levelUpDelta={profileLevelUp.levelsGained}
          profileLevelUpActive={profileLevelUp.visible}
          gacha={gacha}
          teams={teams}
          isOpen={tutorialState.active ? tutorialSidebar : isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onNavigate={navigate}
          onOpenDailiesOverview={openDailiesOverview}
          onOpenParticleConversion={() => { setIsSidebarOpen(false); setIsParticleConversionOpen(true) }}
        />

        <main className="main-panel" id="main-content">
          <Navigation activeScreen={activeScreen} onNavigateMain={navigateMain} />
          {activeScreen.startsWith('characters-') && <SecondaryNavigation label="Sections Personnages" tabs={characterTabs} activeScreen={activeScreen} onNavigate={navigate} />}
          {activeScreen.startsWith('activities-') && <SecondaryNavigation label="Sections Activités" tabs={activityTabs} activeScreen={activeScreen} onNavigate={navigate} />}
          <div className="screen-stage" data-tutorial-screen={activeScreen} data-tutorial-step={presentationStep?.id} key={activeScreen}>{renderScreen()}</div>
        </main>

        <ChatPanel key={player.id} playerId={player.id} playerDisplayName={player.displayName} playerElementKey={player.elementKey} playerAvatarAssetPath={player.avatarAssetPath} playerBadgeSymbol={player.badgeSymbol} connectedCount={presence.value?.total ?? null}
          isExpanded={communityLayout.expanded && communityLayout.available && !tutorialState.active}
          onToggleExpanded={communityLayout.available && !tutorialState.active ? () => communityLayout.setExpanded(!communityLayout.expanded) : undefined}
          isCollapsed={revealCommunity ? false : isChatCollapsed}
          onToggle={() => setIsChatCollapsed((current) => !current)}
          onOpenPlayers={() => setIsPlayersOpen(true)}
          onOpenProfile={openProfile}
          onRefreshScopes={refreshChatScopes}
          directMessageIntent={directMessageIntent}
          onDirectMessageIntentConsumed={token => setDirectMessageIntent(current => current?.token === token ? null : current)}
        />
      </div>

      {isSidebarOpen && !tutorialState.active && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Fermer les informations du joueur"
        />
      )}

      {isHelpOpen && !tutorialState.active && <HelpGuide notice={tutorialUnavailable} onTutorial={launchTutorial} onClose={() => { setIsHelpOpen(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-menu-trigger]')?.focus()) }} />}
      {tutorialState.active && <TutorialOverlay key={player.id} {...tutorialState} onPrevious={() => { void tutorial.previous() }} onNext={() => { void tutorial.next() }} onPause={tutorial.pause} onFinish={() => { void tutorial.finish() }} />}
      {(isPlayersOpen || presentationStep?.panel === 'players') && <OnlinePlayersPanel value={presence.value} error={presence.error} ownerPlayerId={player.id} controller={friendship} onProfile={openProfile} onDirectory={() => { setIsPlayersOpen(false); setSocialTab('players'); navigate('social',{social:'players'}) }} onClose={() => { friendship.clearFeedback(); setIsPlayersOpen(false) }} />}
      {(isMenuOpen || presentationStep?.panel === 'menu') && <GlobalMenu notice={tutorialUnavailable} onHelp={() => { setTutorialUnavailable(''); setIsMenuOpen(false); setIsHelpOpen(true) }} onTutorial={launchTutorial} preference={menuPreference} page={menuPage} onPageChange={setMenuPage} onNavigate={screen => { if (screen === 'profile') { openProfile(player.id); return } if (screen === 'social') {setSocialTab('friends');navigate('social',{social:'friends'});return} if (screen === 'history') setHistoryIntent(null); navigate(screen) }} onClose={() => setIsMenuOpen(false)} />}
      {(isParticleConversionOpen || presentationStep?.panel === 'conversion') && player.elementKey && <ParticleConversionModal elementKey={player.elementKey} stock={resources.particles[player.elementKey]} onClose={() => setIsParticleConversionOpen(false)} onOpenTrades={() => { setTradeIntent(undefined); navigate('trades') }} onConvert={convertParticles} />}
      {!tutorialState.active && activeLevelUpFeedback && activeLevelUpFeedback.id !== closedLevelUpModalId && <LevelUpFeedback key={activeLevelUpFeedback.id} event={activeLevelUpFeedback} onFinished={finishLevelUpModal} />}
      {!tutorialState.active && completedChallengeFeedback && !externalFeedbackPending && !activeLevelUpFeedback && pendingGachaPullCount === null && !isParticleConversionOpen && <DailyChallengeCompletionFeedback challenge={completedChallengeFeedback} onFinished={() => setCompletedChallengeFeedback(null)} />}
      {!tutorialState.active && favorPresence.feedbacks[0] && !externalFeedbackPending && !activeLevelUpFeedback && !completedChallengeFeedback && pendingGachaPullCount === null && !isParticleConversionOpen && <FavorDailyFeedback key={favorPresence.feedbacks[0].id} id={favorPresence.feedbacks[0].id} onFinished={favorPresence.finish} />}
    </div>
    </TutorialPresentationContext.Provider>
    </DestinationContext.Provider>
  )
}

export default GameShell
