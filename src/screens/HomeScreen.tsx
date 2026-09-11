import BannerHero from '../components/BannerHero'
import type { CurrentGachaDto } from '../api/types'
import type { ScreenId } from '../types'

type HomeScreenProps = {
  onNavigate: (screen: ScreenId) => void
  gacha: CurrentGachaDto
  onSetGachaTarget: (id: string) => Promise<void>
}

const shortcuts: Array<{ screen: ScreenId; label: string; description: string; icon: string; tone: string }> = [
  { screen: 'characters-box', label: 'Box', description: 'Voir vos personnages', icon: '▦', tone: 'violet' },
  { screen: 'characters-catalog', label: 'Personnages', description: 'Découvrir le catalogue', icon: '♙', tone: 'cyan' },
  { screen: 'characters-team', label: 'Équipe', description: 'Préparer votre groupe', icon: '♟', tone: 'gold' },
  { screen: 'inventory', label: 'Sac', description: 'Consulter vos ressources', icon: '◇', tone: 'blue' },
  { screen: 'shop', label: 'Boutique', description: 'Parcourir les échanges', icon: '♢', tone: 'pink' },
]

function HomeScreen({ onNavigate, gacha, onSetGachaTarget }: HomeScreenProps) {
  return (
    <div className="screen-content home-screen">
      <BannerHero compact gacha={gacha} onSetTarget={onSetGachaTarget} onOpen={() => onNavigate('invocation')} />

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
