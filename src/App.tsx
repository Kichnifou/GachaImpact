import { useEffect, useState } from 'react'
import ChatPanel from './components/ChatPanel'
import GameHeader from './components/GameHeader'
import Navigation from './components/Navigation'
import OnlinePlayersPanel from './components/OnlinePlayersPanel'
import PlayerSidebar from './components/PlayerSidebar'
import BoxScreen from './screens/BoxScreen'
import CharactersScreen from './screens/CharactersScreen'
import HomeScreen from './screens/HomeScreen'
import InventoryScreen from './screens/InventoryScreen'
import InvocationScreen from './screens/InvocationScreen'
import ShopScreen from './screens/ShopScreen'
import TeamScreen from './screens/TeamScreen'
import type { ScreenId } from './types'
import './App.css'

const screenIds: ScreenId[] = ['home', 'invocation', 'box', 'characters', 'team', 'inventory', 'shop']

const getScreenFromHash = (): ScreenId => {
  const screen = window.location.hash.slice(1)
  return screenIds.includes(screen as ScreenId) ? (screen as ScreenId) : 'home'
}

function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>(getScreenFromHash)
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isPlayersOpen, setIsPlayersOpen] = useState(false)

  useEffect(() => {
    const syncScreenWithHash = () => setActiveScreen(getScreenFromHash())
    window.addEventListener('hashchange', syncScreenWithHash)
    return () => window.removeEventListener('hashchange', syncScreenWithHash)
  }, [])

  const navigate = (screen: ScreenId) => {
    setActiveScreen(screen)
    window.location.hash = screen
    setIsSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'invocation':
        return <InvocationScreen />
      case 'box':
        return <BoxScreen />
      case 'characters':
        return <CharactersScreen />
      case 'team':
        return <TeamScreen />
      case 'inventory':
        return <InventoryScreen />
      case 'shop':
        return <ShopScreen />
      default:
        return <HomeScreen onNavigate={navigate} />
    }
  }

  return (
    <div className={`game-shell${isChatCollapsed ? ' chat-is-collapsed' : ''}`}>
      <GameHeader
        onNavigateHome={() => navigate('home')}
        onOpenSidebar={() => setIsSidebarOpen(true)}
      />

      <div className="game-layout">
        <PlayerSidebar
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

export default App
