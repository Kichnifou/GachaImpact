// @vitest-environment happy-dom

import { act } from 'react'
import { readFileSync } from 'node:fs'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ModerationPlayerListQuery, ModerationPlayerPageDto } from '../api/types'
import ModerationPlayerBrowser from './ModerationPlayerBrowser'
const cssSource = readFileSync('src/App.css', 'utf8')

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const roots: Root[] = []

afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()))
  document.body.replaceChildren()
})

function response(input: ModerationPlayerListQuery): ModerationPlayerPageDto {
  const page = input.page ?? 1
  return { players: [{ id: `player-${page}`, displayName: page === 1 ? 'Alpha' : 'Zeta', elementKey: 'geo', level: page, tester: page === 1, rank: page === 1 ? 'TESTER' : 'PLAYER' }], page, pageSize: 10, total: 12, totalPages: 2 }
}

describe('ModerationPlayerBrowser', () => {
  it('keeps a fixed viewport-bounded desktop height with fixed controls and a flexible results body', () => {
    expect(cssSource).toMatch(/\.moderation-player-browser \{[^}]*height: min\(760px, calc\(100dvh - 32px\)\)/)
    expect(cssSource).toContain('grid-template-rows: auto auto minmax(180px, 1fr) auto')
    expect(cssSource).toMatch(/\.moderation-browser-results \{[^}]*min-height: 0;[^}]*overflow-x: hidden; overflow-y: auto;/)
  })
  it('loads A-Z first, forwards combined filters and pages by ten', async () => {
    const onListPlayers = vi.fn(async (input: ModerationPlayerListQuery) => response(input))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container); roots.push(root)
    await act(async () => { root.render(<ModerationPlayerBrowser selectedPlayerId="player-1" onListPlayers={onListPlayers} onConfirm={vi.fn()} onClose={vi.fn()} />); await Promise.resolve(); await Promise.resolve() })
    expect(onListPlayers).toHaveBeenLastCalledWith({ query: '', elementKey: null, tester: 'all', sort: 'name', direction: 'asc', page: 1 })
    const selects = container.querySelectorAll('select')
    expect(Array.from(selects[0]!.options).map(({ value }) => value)).toEqual(['all', 'pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'])
    const search = container.querySelector<HTMLInputElement>('input[type="search"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'ce')
      search.dispatchEvent(new Event('input', { bubbles: true }))
      await Promise.resolve(); await Promise.resolve()
    })
    expect(onListPlayers).toHaveBeenLastCalledWith({ query: 'ce', elementKey: null, tester: 'all', sort: 'name', direction: 'asc', page: 1 })
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(selects[0], 'geo'); selects[0]!.dispatchEvent(new Event('change', { bubbles: true }))
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(selects[1], 'tester'); selects[1]!.dispatchEvent(new Event('change', { bubbles: true }))
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(selects[2], 'level'); selects[2]!.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve(); await Promise.resolve()
    })
    expect(onListPlayers).toHaveBeenLastCalledWith({ query: 'ce', elementKey: 'geo', tester: 'tester', sort: 'level', direction: 'asc', page: 1 })
    await act(async () => { container.querySelector<HTMLButtonElement>('.sort-direction-button')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(onListPlayers).toHaveBeenLastCalledWith({ query: 'ce', elementKey: 'geo', tester: 'tester', sort: 'level', direction: 'desc', page: 1 })
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Suivant')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(onListPlayers).toHaveBeenLastCalledWith({ query: 'ce', elementKey: 'geo', tester: 'tester', sort: 'level', direction: 'desc', page: 2 })
    expect(container.textContent).toContain('Page 2 / 2 · 12 joueurs')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Précédent')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(onListPlayers).toHaveBeenLastCalledWith({ query: 'ce', elementKey: 'geo', tester: 'tester', sort: 'level', direction: 'desc', page: 1 })
  })

  it('renders long names and an explicit empty result without selecting a player', async () => {
    const onConfirm = vi.fn()
    const onListPlayers = vi.fn(async (input: ModerationPlayerListQuery): Promise<ModerationPlayerPageDto> => input.query === 'absent'
      ? { players: [], page: 1, pageSize: 10, total: 0, totalPages: 1 }
      : { players: [{ id: 'long-player', displayName: 'Un pseudo volontairement très long pour le navigateur', elementKey: 'dendro', level: 99, tester: false, rank: 'PLAYER' }], page: 1, pageSize: 10, total: 1, totalPages: 1 })
    const container = document.createElement('div'); document.body.append(container)
    const root = createRoot(container); roots.push(root)
    await act(async () => { root.render(<ModerationPlayerBrowser selectedPlayerId="actor" onListPlayers={onListPlayers} onConfirm={onConfirm} onClose={vi.fn()} />); await Promise.resolve(); await Promise.resolve() })
    expect(container.textContent).toContain('Un pseudo volontairement très long pour le navigateur')
    const search = container.querySelector<HTMLInputElement>('input[type="search"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'absent')
      search.dispatchEvent(new Event('input', { bubbles: true }))
      await Promise.resolve(); await Promise.resolve()
    })
    expect(container.textContent).toContain('Aucun joueur trouvé.')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('closes through Escape', async () => {
    const onClose = vi.fn()
    const container = document.createElement('div'); document.body.append(container)
    const root = createRoot(container); roots.push(root)
    await act(async () => { root.render(<ModerationPlayerBrowser selectedPlayerId="player-1" onListPlayers={async (input) => response(input)} onConfirm={vi.fn()} onClose={onClose} />); await Promise.resolve() })
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
