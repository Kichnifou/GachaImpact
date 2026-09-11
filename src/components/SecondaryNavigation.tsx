import type { ScreenId } from '../types'

function SecondaryNavigation({ label, tabs, activeScreen, onNavigate }: { label: string; tabs: readonly Readonly<{ screen: ScreenId; label: string }>[]; activeScreen: ScreenId; onNavigate: (screen: ScreenId) => void }) {
  return <nav className="secondary-navigation panel" aria-label={label}>{tabs.map((tab) => <button type="button" key={tab.screen} className={tab.screen === activeScreen ? 'active' : ''} aria-current={tab.screen === activeScreen ? 'page' : undefined} onClick={() => onNavigate(tab.screen)}>{tab.label}</button>)}</nav>
}
export default SecondaryNavigation
