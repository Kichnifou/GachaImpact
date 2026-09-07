import { useCallback, useEffect, useRef, useState } from 'react'

import type { BoxCharacterDto, CurrentGachaDto, DailyRewardClaimDto, DailyRewardTodayDto, GachaCharacterDto, GachaHistoryDto, GachaPullDto, PlayerBoxDto, PlayerDto, PlayerProgressionDto, PlayerResourcesDto, WheelSpinDto, WheelTodayDto } from '../api/types'
import type { ScreenId } from '../types'
import BoxScreen from '../screens/BoxScreen'
import CharactersScreen from '../screens/CharactersScreen'
import HomeScreen from '../screens/HomeScreen'
import InventoryScreen from '../screens/InventoryScreen'
import InvocationScreen from '../screens/InvocationScreen'
import ShopScreen from '../screens/ShopScreen'
import TeamScreen from '../screens/TeamScreen'
import ChatPanel from './ChatPanel'
import GameHeader from './GameHeader'
import Navigation from './Navigation'
import OnlinePlayersPanel from './OnlinePlayersPanel'
import PlayerSidebar from './PlayerSidebar'
import { BoxMemoryCache } from '../box/box-memory-cache'

const screenIds: ScreenId[] = ['home', 'invocation', 'box', 'characters', 'team', 'inventory', 'shop']

const getScreenFromHash = (): ScreenId => {
  const screen = window.location.hash.slice(1)
  return screenIds.includes(screen as ScreenId) ? (screen as ScreenId) : 'home'
}

type GameShellProps = {
  player: PlayerDto
  resources: PlayerResourcesDto
  progression: PlayerProgressionDto
  wheelToday: WheelTodayDto
  onSpinWheel: () => Promise<WheelSpinDto>
  dailyRewardToday: DailyRewardTodayDto
  onClaimDailyReward: () => Promise<DailyRewardClaimDto>
  onSignOut: () => Promise<void>
  gacha: CurrentGachaDto
  characters: readonly GachaCharacterDto[]
  onSetGachaTarget: (characterId: string) => Promise<void>
  onPullGacha: (count: 1 | 10) => Promise<GachaPullDto>
  pendingGachaPullCount: 1 | 10 | null
  onGachaPresentationDisclosed: (operationId: string) => void
  onGachaPresentationAbandoned: () => void
  onGetGachaHistory: (page: number) => Promise<GachaHistoryDto>
  onLoadBox: () => Promise<PlayerBoxDto>
  onSetBoxFavorite: (characterId: string, favorite: boolean) => Promise<BoxCharacterDto>
}

function GameShell({ player, resources, progression, wheelToday, onSpinWheel, dailyRewardToday, onClaimDailyReward, onSignOut, gacha, characters, onSetGachaTarget, onPullGacha, pendingGachaPullCount, onGachaPresentationDisclosed, onGachaPresentationAbandoned, onGetGachaHistory, onLoadBox, onSetBoxFavorite }: GameShellProps) {
  const [activeScreen, setActiveScreen] = useState<ScreenId>(getScreenFromHash)
  const activeScreenRef = useRef(activeScreen)
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isPlayersOpen, setIsPlayersOpen] = useState(false)
  const [boxCache] = useState(() => new BoxMemoryCache())

  const loadBox = useCallback(
    () => boxCache.revalidate(player.id, onLoadBox),
    [boxCache, onLoadBox, player.id],
  )
  const setBoxFavorite = useCallback(async (characterId: string, favorite: boolean) => {
    const character = await onSetBoxFavorite(characterId, favorite)
    boxCache.replaceCharacter(player.id, character)
    return character
  }, [boxCache, onSetBoxFavorite, player.id])
  const signOutAndClearBox = useCallback(async () => {
    boxCache.clear()
    await onSignOut()
  }, [boxCache, onSignOut])

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
    changeScreen(screen)
    window.location.hash = screen
    setIsSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'invocation':
        return <InvocationScreen gacha={gacha} onSetTarget={onSetGachaTarget} onPull={onPullGacha} pendingPullCount={pendingGachaPullCount} onPresentationDisclosed={onGachaPresentationDisclosed} onGetHistory={onGetGachaHistory} />
      case 'box':
        return <BoxScreen initialBox={boxCache.read(player.id)} onLoadBox={loadBox} onSetFavorite={setBoxFavorite} />
      case 'characters':
        return <CharactersScreen characters={characters} />
      case 'team':
        return <TeamScreen />
      case 'inventory':
        return <InventoryScreen />
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
        onSignOut={signOutAndClearBox}
      />

      <div className="game-layout">
        <PlayerSidebar
          playerData={player}
          resources={resources}
          progression={progression}
          gacha={gacha}
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
    </div>
  )
}

export default GameShell
