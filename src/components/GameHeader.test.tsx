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

  it('archives exactly one notification from a sibling icon button without reading or opening it', async () => {
    const onArchiveNotification = vi.fn(async () => ({ unreadCount: 0, notifications: [] }))
    const onReadNotification = vi.fn(async () => ({ unreadCount: 0, notifications: [] }))
    const onOpenNotification = vi.fn()
    const unread = { id: '11111111-1111-4111-8111-111111111111', domainKey: 'expedition', typeKey: 'ready', payload: { characterName: 'Furina' }, state: 'UNREAD' as const, actionKey: 'open-expedition-character', actionTargetId: 'character', createdAt: '2026-09-12T12:00:00Z', readAt: null }
    const container = mount({ notifications: { unreadCount: 1, notifications: [unread] }, onArchiveNotification, onReadNotification, onOpenNotification })
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Afficher les notifications"]')!.click())
    const row = container.querySelector<HTMLElement>('.notification-row')!
    const main = row.querySelector<HTMLButtonElement>('.notification-item')!
    const archive = row.querySelector<HTMLButtonElement>('[aria-label="Supprimer la notification"]')!
    expect(main.querySelector('button')).toBeNull()
    expect(archive.parentElement).toBe(row)
    await act(async () => { archive.click(); await Promise.resolve() })
    expect(onArchiveNotification).toHaveBeenCalledWith(unread.id)
    expect(onReadNotification).not.toHaveBeenCalled()
    expect(onOpenNotification).not.toHaveBeenCalled()
    expect(appCss).toMatch(/\.notification-row:hover \.notification-archive-button,[\s\S]*?opacity: 1; pointer-events: auto/)
    expect(appCss).toMatch(/@media \(hover: none\), \(pointer: coarse\)[\s\S]*?\.notification-row \.notification-archive-button \{ opacity: 1; pointer-events: auto; \}/)
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

  it('presents simultaneous Expedition, Code and Boss notifications distinctly and keeps unknown events honest', async () => {
    const onOpenNotification = vi.fn()
    const common = { state: 'UNREAD' as const, createdAt: '2026-09-14T12:00:00Z', readAt: null }
    const expedition = { ...common, id: '11111111-1111-4111-8111-111111111111', domainKey: 'expedition', typeKey: 'ready', payload: { characterName: 'Furina' }, actionKey: 'open-expedition-character', actionTargetId: 'character-1' }
    const giftCode = { ...common, id: '22222222-2222-4222-8222-222222222222', domainKey: 'gift-codes', typeKey: 'GIFT_CODE_AVAILABLE', payload: { title: 'Festival des Récoltes', token: 'FESTIVALRECOLTES' }, actionKey: 'OPEN_GIFT_CODE', actionTargetId: 'edition-1' }
    const boss = { ...common, id: '33333333-3333-4333-8333-333333333333', domainKey: 'monthly-boss', typeKey: 'MONTHLY_BOSS_DEFEATED', payload: { title: 'Boss vaincu', message: 'Le Dévoreur de Lune a été vaincu.', rewards: [{ resourceKey: 'primogems', amount: '16000' }, { resourceKey: 'moras', amount: '500000' }] }, actionKey: 'OPEN_MONTHLY_BOSS', actionTargetId: null }
    const unknown = { ...common, id: '44444444-4444-4444-8444-444444444444', domainKey: 'future-domain', typeKey: 'FUTURE_EVENT', payload: {}, actionKey: 'UNKNOWN_ACTION', actionTargetId: 'unknown' }
    const container = mount({ notifications: { unreadCount: 4, notifications: [expedition, giftCode, boss, unknown] }, onOpenNotification })
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Afficher les notifications"]')!.click())
    expect(container.textContent).toContain('Expédition terminée')
    expect(container.textContent).toContain('Furina est revenu.')
    expect(container.textContent).toContain('Code cadeau disponible')
    expect(container.textContent).toContain('Festival des Récoltes · FESTIVALRECOLTES')
    expect(container.textContent).toContain('Boss vaincu')
    expect(container.textContent).toContain('Le Dévoreur de Lune a été vaincu.')
    expect(container.textContent).toContain('+16 000 Primos · +500 000 Moras')
    expect(container.textContent).toContain('Une nouvelle information est disponible.')
    expect(container.textContent?.match(/Expédition terminée/g)).toHaveLength(1)
    const items = container.querySelectorAll<HTMLButtonElement>('.notification-item')
    expect(Array.from(items, (item) => item.dataset.actionable)).toEqual(['true', 'true', 'true', 'false'])
    await act(async () => { items[1]!.click(); await Promise.resolve() })
    expect(onOpenNotification).toHaveBeenCalledWith(giftCode)
  })

  it('keeps the legacy Boss message when structured rewards are absent', () => {
    const boss = { id: '33333333-3333-4333-8333-333333333333', domainKey: 'monthly-boss', typeKey: 'MONTHLY_BOSS_DEFEATED', payload: { title: 'Boss vaincu', message: 'Récompense déjà créditée.' }, state: 'READ' as const, actionKey: 'OPEN_MONTHLY_BOSS', actionTargetId: 'boss-id', createdAt: '2026-09-14T12:00:00Z', readAt: '2026-09-14T12:01:00Z' }
    const container = mount({ notifications: { unreadCount: 0, notifications: [boss] } })
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Afficher les notifications"]')!.click())
    expect(container.textContent).toContain('Récompense déjà créditée.')
    expect(container.querySelector('.notification-rewards')).toBeNull()
  })
})
