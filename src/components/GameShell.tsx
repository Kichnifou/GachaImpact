import { useCallback, useEffect, useRef, useState } from 'react'

import type { BankHistoryDto, BankTransferDto, BoxCharacterDto, BoxSortPreferenceDto, CurrentGachaDto, DailyRewardClaimDto, DailyRewardTodayDto, GachaCharacterDto, GachaHistoryDto, GachaPullDto, ModerationPermissionsDto, ModerationPlayerDto, ModerationStateDto, PlayerBankDto, PlayerBoxDto, PlayerDto, PlayerInventoryDto, PlayerProgressionDto, PlayerResourcesDto, PlayerTeamsDto, StellaUseDto, WheelSpinDto, WheelTodayDto } from '../api/types'
import type { ScreenId } from '../types'
import BoxScreen from '../screens/BoxScreen'
import CharactersScreen from '../screens/CharactersScreen'
import HomeScreen from '../screens/HomeScreen'
import InventoryScreen from '../screens/InventoryScreen'
import InvocationScreen from '../screens/InvocationScreen'
import ShopScreen from '../screens/ShopScreen'
import TeamScreen from '../screens/TeamScreen'
import BankScreen from '../screens/BankScreen'
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

const screenIds: ScreenId[] = ['home', 'invocation', 'box', 'characters', 'team', 'bank', 'inventory', 'shop', 'moderation']

const getScreenFromHash = (): ScreenId => {
  const screen = window.location.hash.slice(1)
  return screenIds.includes(screen as ScreenId) ? (screen as ScreenId) : 'home'
}

type GameShellProps = {
  player: PlayerDto
  resources: PlayerResourcesDto
  progression: PlayerProgressionDto
  levelUpFeedbacks: readonly LevelUpFeedbackEvent[]
  onLevelUpFeedbackFinished: (id: string) => void
  wheelToday: WheelTodayDto
  onSpinWheel: () => Promise<WheelSpinDto>
  dailyRewardToday: DailyRewardTodayDto
  onClaimDailyReward: () => Promise<DailyRewardClaimDto>
  onSignOut: () => Promise<void>
  gacha: CurrentGachaDto
  characters: readonly GachaCharacterDto[]
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
  onLoadInventory: () => Promise<PlayerInventoryDto>
  permissions: ModerationPermissionsDto
  onLoadModeration: (targetPlayerId?: string) => Promise<ModerationStateDto>
  onSearchModerationPlayers: (query: string) => Promise<readonly ModerationPlayerDto[]>
  onModerationResource: (targetPlayerId: string, input: { resourceKey: string; amount: string; direction: 'add' | 'remove'; idempotencyKey: string }) => Promise<ModerationStateDto>
  onModerationXp: (targetPlayerId: string, input: { totalXp?: string; prepareNextLevel?: true; idempotencyKey: string }) => Promise<ModerationStateDto>
  onModerationGacha: (targetPlayerId: string, input: { pity5?: number; pity4?: number; guaranteedFeatured5?: boolean; captureProgress?: number; idempotencyKey: string }) => Promise<ModerationStateDto>
  onModerationStella: (targetPlayerId: string, quantity: string, idempotencyKey: string) => Promise<ModerationStateDto>
  onModerationTester: (targetPlayerId: string, enabled: boolean, idempotencyKey: string) => Promise<ModerationStateDto>
  onModerationApplied: (state: ModerationStateDto, targetIsSelf: boolean) => void
}

function GameShell({ player, resources, progression, levelUpFeedbacks, onLevelUpFeedbackFinished, wheelToday, onSpinWheel, dailyRewardToday, onClaimDailyReward, onSignOut, gacha, characters, teams, onLoadTeams, onActivateTeam, onRenameTeam, onCreateNextTeam, onDeleteTeam, onReorderTeams, onSetTeamSlot, onReorderTeamSlots, onRemoveTeamSlot, onClearTeam, onSetGachaTarget, onPullGacha, pendingGachaPullCount, onGachaPresentationDisclosed, onGachaPresentationAbandoned, onGetGachaHistory, onLoadBox, onSetBoxFavorite, onSetBoxSortPreference, onUseStella, onLoadBank, onLoadBankHistory, onDepositBank, onWithdrawBank, onLoadInventory, permissions, onLoadModeration, onSearchModerationPlayers, onModerationResource, onModerationXp, onModerationGacha, onModerationStella, onModerationTester, onModerationApplied }: GameShellProps) {
  const [activeScreen, setActiveScreen] = useState<ScreenId>(getScreenFromHash)
  const activeScreenRef = useRef(activeScreen)
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isPlayersOpen, setIsPlayersOpen] = useState(false)
  const [boxCache] = useState(() => new BoxMemoryCache())
  const [stellaIntents] = useState(() => new StellaIntentCoordinator())
  const [bankTransferIntents] = useState(() => new BankTransferIntentCoordinator())
  const [bankCache] = useState(() => new BankMemoryCache())
  const [inventoryCache] = useState(() => new InventoryMemoryCache())
  const [moderationIntents] = useState(() => new ModerationIntentCoordinator())
  const activeLevelUpFeedback = levelUpFeedbacks[0] ?? null
  const [profileLevelUpEvent, setProfileLevelUpEvent] = useState<LevelUpFeedbackEvent | null>(null)
  const [closedLevelUpModalId, setClosedLevelUpModalId] = useState<string | null>(null)
  const finishProfileLevelUp = useCallback((id: string) => {
    setProfileLevelUpEvent(null)
    onLevelUpFeedbackFinished(id)
  }, [onLevelUpFeedbackFinished])
  const profileLevelUp = useProfileLevelUpFeedback(profileLevelUpEvent, finishProfileLevelUp)
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
      return result
    },
  ), [boxCache, inventoryCache, onUseStella, player.id, stellaIntents])
  const loadInventory = useCallback(
    () => inventoryCache.revalidate(player.id, onLoadInventory),
    [inventoryCache, onLoadInventory, player.id],
  )
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
  const signOutAndClearCaches = useCallback(async () => {
    boxCache.clear()
    bankCache.clear()
    inventoryCache.clear()
    moderationIntents.clear()
    await onSignOut()
  }, [bankCache, boxCache, inventoryCache, moderationIntents, onSignOut])

  const changeScreen = useCallback((screen: ScreenId) => {
    if (activeScreenRef.current === 'invocation' && screen !== 'invocation') onGachaPresentationAbandoned()
    activeScreenRef.current = screen
    setActiveScreen(screen)
  }, [onGachaPresentationAbandoned])

  useEffect(() => {
    const syncScreenWithHash = () => changeScreen(getScreenFromHash())
    window.addEventListener('hashchange', syncScreenWithHash)
    return () => window.removeEventListener('hashchange', syncScreenWithHash)
  }, [changeScreen])

  const navigate = (screen: ScreenId) => {
    if (screen === 'moderation' && !permissions.capabilities.moderationAccess) return
    changeScreen(screen)
    window.location.hash = screen
    setIsSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'invocation':
        return <InvocationScreen gacha={gacha} teams={teams} onSetTarget={onSetGachaTarget} onPull={onPullGacha} pendingPullCount={pendingGachaPullCount} onPresentationDisclosed={onGachaPresentationDisclosed} onGetHistory={onGetGachaHistory} />
      case 'box':
        return <BoxScreen key={player.id} initialBox={boxCache.read(player.id)} onLoadBox={loadBox} onSetFavorite={setBoxFavorite} onSetSortPreference={setBoxSortPreference} onUseStella={useStella} stellaRetryCharacterId={stellaIntents.getIntent(player.id)?.characterId ?? null} />
      case 'characters':
        return <CharactersScreen characters={characters} />
      case 'team':
        return <TeamScreen teams={teams} initialBox={boxCache.read(player.id)} stellaRetryCharacterId={stellaIntents.getIntent(player.id)?.characterId ?? null} onLoad={onLoadTeams} onActivate={onActivateTeam} onRename={onRenameTeam} onCreateNext={onCreateNextTeam} onDelete={onDeleteTeam} onReorderTeams={onReorderTeams} onSetSlot={onSetTeamSlot} onReorderSlots={onReorderTeamSlots} onRemoveSlot={onRemoveTeamSlot} onClear={onClearTeam} onLoadBox={loadBox} onSetBoxFavorite={setBoxFavorite} onUseStella={useStella} />
      case 'inventory':
        return <InventoryScreen key={player.id} initialInventory={inventoryCache.read(player.id)} resources={resources} onLoad={loadInventory} onNavigateBank={() => navigate('bank')} onLoadBox={loadBox} onSetBoxFavorite={setBoxFavorite} onUseStella={useStella} stellaRetryCharacterId={stellaIntents.getIntent(player.id)?.characterId ?? null} onLoadTeams={onLoadTeams} />
      case 'bank':
        return <BankScreen initialBank={bankCache.read(player.id)} onLoad={loadBank} onLoadHistory={onLoadBankHistory} onTransfer={transferBank} />
      case 'moderation':
        return permissions.capabilities.moderationAccess ? <ModerationScreen actorPlayerId={player.id} capabilities={permissions.capabilities} onLoad={onLoadModeration} onSearchPlayers={onSearchModerationPlayers} onResource={moderateResource} onXp={moderateXp} onGacha={moderateGacha} onStella={moderateStella} onTester={moderateTester} onApplied={(next) => { const self = next.player.id === player.id; if (self) { boxCache.setStellaQuantity(player.id, next.stella.quantity); inventoryCache.setStellaQuantity(player.id, next.stella.quantity) }; onModerationApplied(next, self) }} /> : <HomeScreen onNavigate={navigate} wheelToday={wheelToday} onSpinWheel={onSpinWheel} gacha={gacha} onSetGachaTarget={onSetGachaTarget} />
      case 'shop':
        return <ShopScreen />
      default:
        return <HomeScreen onNavigate={navigate} wheelToday={wheelToday} onSpinWheel={onSpinWheel} gacha={gacha} onSetGachaTarget={onSetGachaTarget} />
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
        onSignOut={signOutAndClearCaches}
      />

      <div className="game-layout">
        <PlayerSidebar
          playerData={player}
          resources={resources}
          progression={progression}
          levelUpDelta={profileLevelUp.levelsGained}
          profileLevelUpActive={profileLevelUp.visible}
          gacha={gacha}
          teams={teams}
          dailyRewardToday={dailyRewardToday}
          onClaimDailyReward={onClaimDailyReward}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onNavigate={navigate}
        />

        <main className="main-panel" id="main-content">
          <Navigation activeScreen={activeScreen} onNavigate={navigate} />
          <div className="screen-stage" key={activeScreen}>{renderScreen()}</div>
        </main>

        <ChatPanel
          isCollapsed={isChatCollapsed}
          onToggle={() => setIsChatCollapsed((current) => !current)}
          onOpenPlayers={() => setIsPlayersOpen(true)}
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

      {isPlayersOpen && <OnlinePlayersPanel onClose={() => setIsPlayersOpen(false)} />}
      {activeLevelUpFeedback && activeLevelUpFeedback.id !== closedLevelUpModalId && <LevelUpFeedback key={activeLevelUpFeedback.id} event={activeLevelUpFeedback} onFinished={finishLevelUpModal} />}
    </div>
  )
}

export default GameShell
