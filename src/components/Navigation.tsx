import type { ScreenId } from '../types'

type NavigationProps = {
  activeScreen: ScreenId
  onNavigate: (screen: ScreenId) => void
}

const navigationItems: Array<{ id: ScreenId; label: string; icon: string }> = [
  { id: 'home', label: 'Accueil', icon: '⌂' },
  { id: 'invocation', label: 'Invocation', icon: '✦' },
  { id: 'box', label: 'Box', icon: '▦' },
  { id: 'characters', label: 'Personnages', icon: '♙' },
  { id: 'team', label: 'Équipe', icon: '♟' },
  { id: 'inventory', label: 'Sac', icon: '◇' },
  { id: 'shop', label: 'Boutique', icon: '♢' },
]

function Navigation({ activeScreen, onNavigate }: NavigationProps) {
  return (
    <nav className="game-navigation" aria-label="Navigation principale">
      {navigationItems.map((item) => (
        <button
          type="button"
          className={`navigation-tile${activeScreen === item.id ? ' active' : ''}`}
          aria-current={activeScreen === item.id ? 'page' : undefined}
          onClick={() => onNavigate(item.id)}
          key={item.id}
        >
          <span aria-hidden="true">{item.icon}</span>
          <strong>{item.label}</strong>
        </button>
      ))}
    </nav>
  )
}

export default Navigation
