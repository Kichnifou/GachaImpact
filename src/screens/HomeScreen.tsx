import BannerHero from '../components/BannerHero'
import type { ScreenId } from '../types'

type HomeScreenProps = {
  onNavigate: (screen: ScreenId) => void
}

const shortcuts: Array<{ screen: ScreenId; label: string; description: string; icon: string; tone: string }> = [
  { screen: 'characters', label: 'Personnages', description: 'Découvrir le catalogue', icon: '♙', tone: 'cyan' },
  { screen: 'box', label: 'Box', description: 'Voir vos personnages', icon: '▦', tone: 'violet' },
  { screen: 'team', label: 'Équipe', description: 'Préparer votre groupe', icon: '♟', tone: 'gold' },
  { screen: 'inventory', label: 'Sac', description: 'Consulter vos ressources', icon: '◇', tone: 'blue' },
  { screen: 'shop', label: 'Boutique', description: 'Parcourir les échanges', icon: '♢', tone: 'pink' },
]

function HomeScreen({ onNavigate }: HomeScreenProps) {
  return (
    <div className="screen-content home-screen">
      <BannerHero compact />

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

      <section className="notice-panel">
        <span className="notice-icon" aria-hidden="true">⌁</span>
        <div><strong>Un monde en construction</strong><p>Explorez les premiers écrans statiques de GachaImpact.</p></div>
        <span className="notice-badge">Prototype V0</span>
      </section>
    </div>
  )
}

export default HomeScreen
