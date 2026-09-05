import BannerHero from '../components/BannerHero'
import WheelCard from '../components/WheelCard'
import type { CurrentGachaDto, WheelSpinDto, WheelTodayDto } from '../api/types'
import type { ScreenId } from '../types'

type HomeScreenProps = {
  onNavigate: (screen: ScreenId) => void
  wheelToday: WheelTodayDto
  onSpinWheel: () => Promise<WheelSpinDto>
  gacha: CurrentGachaDto
  onSetGachaTarget: (id: string) => Promise<void>
}

const shortcuts: Array<{ screen: ScreenId; label: string; description: string; icon: string; tone: string }> = [
  { screen: 'box', label: 'Box', description: 'Voir vos personnages', icon: '▦', tone: 'violet' },
  { screen: 'characters', label: 'Personnages', description: 'Découvrir le catalogue', icon: '♙', tone: 'cyan' },
  { screen: 'team', label: 'Équipe', description: 'Préparer votre groupe', icon: '♟', tone: 'gold' },
  { screen: 'inventory', label: 'Sac', description: 'Consulter vos ressources', icon: '◇', tone: 'blue' },
  { screen: 'shop', label: 'Boutique', description: 'Parcourir les échanges', icon: '♢', tone: 'pink' },
]

function HomeScreen({ onNavigate, wheelToday, onSpinWheel, gacha, onSetGachaTarget }: HomeScreenProps) {
  return (
    <div className="screen-content home-screen">
      <BannerHero compact gacha={gacha} onSetTarget={onSetGachaTarget} />

      <WheelCard today={wheelToday} onSpin={onSpinWheel} />

      <section className="home-shortcuts" aria-label="Raccourcis principaux">
        {shortcuts.map((shortcut) => (
          <button
            type="button"
            className={`shortcut-card ${shortcut.tone}`}
            onClick={() => onNavigate(shortcut.screen)}
            key={shortcut.screen}
          >
            <span className="shortcut-icon" aria-hidden="true">{shortcut.icon}</span>
            <span><strong>{shortcut.label}</strong><small>{shortcut.description}</small></span>
            <i aria-hidden="true">›</i>
          </button>
        ))}
      </section>
    </div>
  )
}

export default HomeScreen
