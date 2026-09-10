import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import GameHeader from './GameHeader'

describe('GameHeader moderation capability', () => {
  it('shows Modération immediately before Déconnexion only when authorized', () => {
    const authorized = renderToStaticMarkup(<GameHeader displayName="Test" onNavigateHome={vi.fn()} onOpenSidebar={vi.fn()} onSignOut={vi.fn()} showModeration onOpenModeration={vi.fn()} />)
    const denied = renderToStaticMarkup(<GameHeader displayName="Test" onNavigateHome={vi.fn()} onOpenSidebar={vi.fn()} onSignOut={vi.fn()} showModeration={false} onOpenModeration={vi.fn()} />)
    expect(authorized.indexOf('Modération')).toBeLessThan(authorized.indexOf('Déconnexion'))
    expect(denied).not.toContain('Modération')
  })
})
