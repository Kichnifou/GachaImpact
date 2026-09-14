// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GameHeader from './GameHeader'

const appCss = readFileSync(`${process.cwd()}/src/App.css`, 'utf8')

const roots: Root[] = []
afterEach(() => { act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren() })

function mount(props: Partial<React.ComponentProps<typeof GameHeader>> = {}) {
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
  act(() => root.render(<GameHeader displayName="Test" onNavigateHome={vi.fn()} onOpenSidebar={vi.fn()} onSignOut={vi.fn()} showModeration={false} onOpenModeration={vi.fn()} onOpenMenu={vi.fn()} {...props} />))
  return container
}

describe('GameHeader moderation capability', () => {
  it('shows Modération immediately before Déconnexion only when authorized', () => {
    const authorized = renderToStaticMarkup(<GameHeader displayName="Test" onNavigateHome={vi.fn()} onOpenSidebar={vi.fn()} onSignOut={vi.fn()} showModeration onOpenModeration={vi.fn()} onOpenMenu={vi.fn()} />)
    const denied = renderToStaticMarkup(<GameHeader displayName="Test" onNavigateHome={vi.fn()} onOpenSidebar={vi.fn()} onSignOut={vi.fn()} showModeration={false} onOpenModeration={vi.fn()} onOpenMenu={vi.fn()} />)
    expect(authorized.indexOf('Modération')).toBeLessThan(authorized.indexOf('Déconnexion'))
    expect(denied).not.toContain('Modération')
  })

  it('renders the real empty notification state without legacy mock rows', () => {
    const container = mount(); act(() => container.querySelector<HTMLButtonElement>('[aria-label="Afficher les notifications"]')!.click())
    expect(container.textContent).toContain('Aucune notification.')
    expect(container.textContent).not.toContain('Expédition terminée')
  })

  it('exposes unread count, read, read-all, archive, and Expedition deep-link actions', async () => {
    const onReadNotification = vi.fn(async () => ({ unreadCount: 0, notifications: [] }))
    const onReadAllNotifications = vi.fn(async () => ({ unreadCount: 0, notifications: [] }))
    const onArchiveReadNotifications = vi.fn(async () => ({ unreadCount: 0, notifications: [] }))
    const onOpenNotification = vi.fn()
    const unread = { id: '11111111-1111-4111-8111-111111111111', domainKey: 'expedition', typeKey: 'ready', payload: { characterName: 'Furina' }, state: 'UNREAD' as const, actionKey: 'open-expedition-character', actionTargetId: 'character', createdAt: '2026-09-12T12:00:00Z', readAt: null }
    const container = mount({ notifications: { unreadCount: 1, notifications: [unread] }, onReadNotification, onReadAllNotifications, onArchiveReadNotifications, onOpenNotification })
    expect(container.querySelector('.header-count')?.textContent).toBe('1')
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Afficher les notifications"]')!.click())
    expect(container.textContent).toContain('Furina est revenu.')
    await act(async () => { container.querySelector<HTMLButtonElement>('.notification-item')!.click(); await Promise.resolve() })
    expect(onReadNotification).toHaveBeenCalledWith(unread.id); expect(onOpenNotification).toHaveBeenCalledWith(unread)

    const read = { ...unread, state: 'READ' as const, readAt: '2026-09-12T12:01:00Z' }
    act(() => roots[0]!.render(<GameHeader displayName="Test" onNavigateHome={vi.fn()} onOpenSidebar={vi.fn()} onSignOut={vi.fn()} showModeration={false} onOpenModeration={vi.fn()} onOpenMenu={vi.fn()} notifications={{ unreadCount: 0, notifications: [read] }} onReadAllNotifications={onReadAllNotifications} onArchiveReadNotifications={onArchiveReadNotifications} />))
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Afficher les notifications"]')!.click())
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Archiver les notifications lues')!.click(); await Promise.resolve() })
    expect(onArchiveReadNotifications).toHaveBeenCalledTimes(1)

    act(() => roots[0]!.render(<GameHeader displayName="Test" onNavigateHome={vi.fn()} onOpenSidebar={vi.fn()} onSignOut={vi.fn()} showModeration={false} onOpenModeration={vi.fn()} onOpenMenu={vi.fn()} notifications={{ unreadCount: 1, notifications: [unread] }} onReadAllNotifications={onReadAllNotifications} />))
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Tout marquer comme lu')!.click(); await Promise.resolve() })
    expect(onReadAllNotifications).toHaveBeenCalledTimes(1)
  })

  it('distinguishes navigable and informational notifications without a false hover affordance', async () => {
    const onReadNotification = vi.fn(async () => ({ unreadCount: 0, notifications: [] }))
    const onOpenNotification = vi.fn()
    const base = { id: '11111111-1111-4111-8111-111111111111', domainKey: 'expedition', typeKey: 'ready', payload: { characterName: 'Furina' }, state: 'UNREAD' as const, actionTargetId: 'character', createdAt: '2026-09-12T12:00:00Z', readAt: null }
    const navigable = { ...base, actionKey: 'open-expedition-character' }
    const informational = { ...base, id: '22222222-2222-4222-8222-222222222222', actionKey: null }
    const container = mount({ notifications: { unreadCount: 2, notifications: [navigable, informational] }, onReadNotification, onOpenNotification })
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Afficher les notifications"]')!.click())
    const items = container.querySelectorAll<HTMLButtonElement>('.notification-item')
    expect(items[0]?.classList.contains('actionable')).toBe(true)
    expect(items[0]?.dataset.actionable).toBe('true')
    expect(items[1]?.classList.contains('actionable')).toBe(false)
    expect(items[1]?.dataset.actionable).toBe('false')
    expect(appCss).toMatch(/\.notification-item\.actionable \{ cursor: pointer; \}/)
    expect(appCss).toMatch(/\.notification-item\.actionable:hover,[\s\S]*?border-color: rgba\(92, 217, 255, \.72\)/)
    await act(async () => { items[1]!.click(); await Promise.resolve() })
    expect(onReadNotification).toHaveBeenCalledWith(informational.id)
    expect(onOpenNotification).not.toHaveBeenCalled()
    expect(container.querySelector('.notifications-panel')).not.toBeNull()
  })
})
