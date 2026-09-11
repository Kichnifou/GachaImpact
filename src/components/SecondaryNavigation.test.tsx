import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { activityTabs, characterTabs } from '../navigation/navigation'
import SecondaryNavigation from './SecondaryNavigation'

const appCss = readFileSync(new URL('../App.css', import.meta.url), 'utf8')

describe('SecondaryNavigation', () => {
  it('renders every character and activity tab once and identifies the current page', () => {
    const characters = renderToStaticMarkup(<SecondaryNavigation label="Personnages" tabs={characterTabs} activeScreen="characters-team" onNavigate={vi.fn()} />)
    const activities = renderToStaticMarkup(<SecondaryNavigation label="Activités" tabs={activityTabs} activeScreen="activities-dailies" onNavigate={vi.fn()} />)
    characterTabs.forEach(({ label }) => expect(characters.match(new RegExp(`>${label}<`, 'g'))).toHaveLength(1))
    activityTabs.forEach(({ label }) => expect(activities.match(new RegExp(`>${label}<`, 'g'))).toHaveLength(1))
    expect(characters).toContain('aria-current="page"')
    expect(activities).toContain('aria-current="page"')
  })
  it('keeps the shared bar vertically closed and hides native tab scrollbars', () => {
    expect(appCss).toMatch(/\.secondary-navigation\s*\{[^}]*flex:\s*0 0 auto[^}]*overflow-y:\s*hidden[^}]*scrollbar-width:\s*none/s)
    expect(appCss).toContain('.secondary-navigation::-webkit-scrollbar')
    expect(appCss).toMatch(/@media \(max-width: 760px\)[\s\S]*\.secondary-navigation\s*\{[^}]*overflow-x:\s*auto[^}]*touch-action:\s*pan-x/)
  })
})
