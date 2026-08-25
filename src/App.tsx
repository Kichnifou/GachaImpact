import { useState } from 'react'
import ChatPanel from './components/ChatPanel'
import MainPanel from './components/MainPanel'
import PlayerSidebar from './components/PlayerSidebar'
import './App.css'

function App() {
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)

  return (
    <div className={`game-shell${isChatCollapsed ? ' chat-is-collapsed' : ''}`}>
      <header className="game-header">
        <a className="brand" href="#main-content" aria-label="GachaImpact — accueil">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>
            <strong>Gacha<span>Impact</span></strong>
            <small>Chroniques astrales</small>
          </span>
        </a>

        <div className="development-banner">
          <span aria-hidden="true">◆</span>
          Version de développement
        </div>

        <div className="header-status" aria-label="Statut des joueurs">
          <span className="status-dot" />
          28 voyageurs en ligne
        </div>
      </header>

      <div className="game-layout">
        <PlayerSidebar />
        <MainPanel />
        <ChatPanel
          isCollapsed={isChatCollapsed}
          onToggle={() => setIsChatCollapsed((current) => !current)}
        />
      </div>
    </div>
  )
}

export default App
