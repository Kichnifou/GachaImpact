import { mainIdForScreen, mainNavigation, type MainNavigationId } from '../navigation/navigation'
import type { ScreenId } from '../types'

function Navigation({ activeScreen, onNavigateMain }: { activeScreen: ScreenId; onNavigateMain: (id: MainNavigationId) => void }) {
  const activeMain = mainIdForScreen(activeScreen)
  return <nav className="game-navigation" aria-label="Navigation principale">{mainNavigation.map((item) => <button type="button" className={`navigation-tile${activeMain === item.id ? ' active' : ''}`} aria-current={activeMain === item.id ? 'page' : undefined} onClick={() => onNavigateMain(item.id)} key={item.id}><span aria-hidden="true">{item.icon}</span><strong>{item.label}</strong></button>)}</nav>
}
export default Navigation
