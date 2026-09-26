// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import PlayerSelectionBrowser, { type PlayerBrowserPage } from './PlayerSelectionBrowser'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const roots: Root[] = []
afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()))
  document.body.replaceChildren()
})

type Candidate = Readonly<{ id: string; displayName: string; level: number; elementKey: 'hydro' }>
const result = (page: number): PlayerBrowserPage<Candidate> => ({
  players: [{ id: `player-${page}`, displayName: `Player ${page}`, level: page, elementKey: 'hydro' }],
  page,
  pageSize: 10,
  total: 11,
  totalPages: 2,
})

describe('PlayerSelectionBrowser loader stability', () => {
  it('keeps the avatar and player text together before a moderation badge', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(<PlayerSelectionBrowser
        eyebrow="Modération"
        title="Choisir"
        selectedPlayerId=""
        onListPlayers={async () => result(1)}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
        showTesterFilter
        renderBadge={() => <span className="tester-badge">Testeur</span>}
      />)
      await Promise.resolve()
      await Promise.resolve()
    })
    const row = container.querySelector('.moderation-browser-results > button')!
    const identity = row.querySelector('.player-identity-inline')!
    expect(identity.querySelector('.player-avatar')).not.toBeNull()
    expect(identity.querySelector('.moderation-player-identity')?.textContent).toContain('Player 1')
    expect(row.lastElementChild?.className).toBe('tester-badge')
  })

  it('ignores callback identity churn and loads a requested page exactly once', async () => {
    const onListPlayers = vi.fn(async ({ page }: { page: number }) => result(page))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    const render = () => root.render(<PlayerSelectionBrowser
      eyebrow="Test"
      title="Choisir"
      selectedPlayerId=""
      onListPlayers={(query) => onListPlayers(query)}
      onConfirm={vi.fn()}
      onClose={vi.fn()}
    />)

    await act(async () => { render(); await Promise.resolve(); await Promise.resolve() })
    expect(onListPlayers).toHaveBeenCalledTimes(1)
    for (let tick = 0; tick < 3; tick += 1) await act(async () => { render(); await Promise.resolve() })
    expect(onListPlayers).toHaveBeenCalledTimes(1)
    const next = Array.from(container.querySelectorAll<HTMLButtonElement>('.moderation-browser-pagination button')).at(-1)!
    expect(next.disabled).toBe(false)
    await act(async () => { next.click(); await Promise.resolve(); await Promise.resolve() })
    expect(onListPlayers).toHaveBeenCalledTimes(2)
    expect(onListPlayers.mock.calls[1]![0]).toMatchObject({ page: 2 })
    expect(container.textContent).toContain('Page 2 / 2')
  })
})
