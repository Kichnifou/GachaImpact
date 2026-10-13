import BannerHero from '../components/BannerHero'
import type { ReactNode } from 'react'
import type { CurrentGachaDto } from '../api/types'
import type { ScreenId } from '../types'
import type { DestinationTabs } from '../navigation/destination-history'
import AppButton from '../components/AppButton'
import '../home/home-shortcuts.css'

type HomeScreenProps = {
  dailySummary?: ReactNode
  onNavigate: (screen: ScreenId, tabs?: Partial<DestinationTabs>, profileId?: string) => void
  ownerPlayerId?: string
  onPersonalize?: () => void
  gacha: CurrentGachaDto
  onSetGachaTarget: (id: string) => Promise<void>
}

function HomeScreen({ onNavigate, gacha, onSetGachaTarget, dailySummary, ownerPlayerId, onPersonalize }: HomeScreenProps) {
  return (
    <div data-tutorial-anchor="home" data-fit-screen className="screen-content home-screen">
      <BannerHero compact gacha={gacha} onSetTarget={onSetGachaTarget} onOpen={() => onNavigate('invocation')} />

      <nav className="home-shortcuts" aria-label="Raccourcis Accueil">
        {([
          { title: 'Équipe', icon: '♟', screen: 'characters-team' },
          { title: 'Événement', icon: '✦', screen: 'activities-event' },
          { title: 'Concours', icon: '♛', screen: 'activities-contest' },
          { title: 'Arcade', icon: '◇', screen: 'activities-arcade' },
          { title: 'Personnalisation', icon: '✧', screen: 'profile' },
          { title: 'Missions', icon: '▤', screen: 'activities-missions' },
        ] satisfies { title: string; icon: string; screen: ScreenId }[]).map(item => <AppButton className="home-shortcut" key={item.screen} onClick={() => item.screen === 'profile' && onPersonalize ? onPersonalize() : onNavigate(item.screen, item.screen === 'profile' ? { profile: 'Personnalisation', appearance: 'AVATAR' } : undefined, item.screen === 'profile' ? ownerPlayerId : undefined)}><span className="home-shortcut-icon" aria-hidden="true">{item.icon}</span><strong>{item.title}</strong><span className="home-shortcut-arrow" aria-hidden="true">›</span></AppButton>)}
      </nav>
      {dailySummary}
    </div>
  )
}

export default HomeScreen
