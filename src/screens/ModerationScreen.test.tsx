// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModerationPlayerDto, ModerationStateDto } from '../api/types'
import ModerationScreen from './ModerationScreen'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const roots: Root[] = []
const player = (id: string, displayName: string, tester = false, level = 2): ModerationPlayerDto => ({ id, displayName, elementKey: 'hydro', level, tester, rank: id === 'self' ? 'SUPER' : tester ? 'TESTER' : 'PLAYER' })
const actors = {
  self: player('self', 'Kichnifou', true, 8),
  a: player('player-a', 'Mynonyme', false, 4),
  b: player('player-b', 'MynonymeTest1', true, 6),
}

function state(target = actors.self, superTools = true, stella = target.id === 'self' ? '0' : target.id === 'player-a' ? '17' : '29'): ModerationStateDto {
  return {
    player: target.id === 'self' && !superTools ? { ...target, rank: 'TESTER' } : target,
    permissions: {
      roles: superTools ? ['ADMIN', 'TESTER'] : ['TESTER'],
      capabilities: { moderationAccess: true, selfResourceTools: true, selfGameplayTools: true, superTools, canSelectPlayers: superTools, canManageTesters: superTools },
    },
    resources: { primogems: '1000', moras: '1000', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } },
    progression: { totalXp: target.id === 'player-b' ? '181' : '89', level: target.level, xpIntoCurrentStep: '29', xpPerStep: '30', isMaxLevel: false, level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0' },
    gachaState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' },
    stella: { quantity: stella },
  }
}

afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()))
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function change(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function search(container: HTMLElement, query: string) {
  change(container.querySelector<HTMLInputElement>('.moderation-target-search input')!, query)
  await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 140)) })
}

function stellaInput(container: HTMLElement) {
  return Array.from(container.querySelectorAll('label')).find((label) => label.textContent?.includes('Masterless Stella Fortuna'))!.querySelector('input')!
}

async function mount(superTools = true) {
  const states = new Map([
    ['self', state(actors.self, superTools)],
    ['player-a', state(actors.a, superTools)],
    ['player-b', state(actors.b, superTools)],
  ])
  const onLoad = vi.fn(async (targetPlayerId?: string) => states.get(targetPlayerId ?? 'self')!)
  const onListPlayers = vi.fn(async ({ query = '' }: { query?: string }) => {
    const players = Object.values(actors).filter(({ displayName }) => displayName.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')))
    return { players, page: 1, pageSize: 10 as const, total: players.length, totalPages: 1 }
  })
  const onTester = vi.fn(async (targetPlayerId: string, enabled: boolean) => {
    const current = states.get(targetPlayerId)!
    const updated = { ...current, player: { ...current.player, tester: enabled } }
    states.set(targetPlayerId, updated)
    return updated
  })
  const props: React.ComponentProps<typeof ModerationScreen> = {
    actorPlayerId: 'self', capabilities: state(actors.self, superTools).permissions.capabilities,
    onLoad, onListPlayers, onResource: vi.fn(async (target) => states.get(target)!),
    onXp: vi.fn(async (target) => states.get(target)!), onGacha: vi.fn(async (target) => states.get(target)!),
    onStella: vi.fn(async (target, quantity) => {
      const updated = state(states.get(target)!.player, superTools, quantity)
      states.set(target, updated)
      return updated
    }), onTester, onApplied: vi.fn(),
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => { root.render(<ModerationScreen {...props} />); await Promise.resolve(); await Promise.resolve() })
  return { container, onLoad, onListPlayers, onTester, props, root }
}

describe('ModerationScreen', () => {
  it('gives a Testeur all self preparation tools without player selection or role management', async () => {
    const { container } = await mount(false)
    expect(container.textContent).toContain('Rang : Testeur')
    for (const label of ['Joueur ciblé', 'Ressources', 'Progression', 'Gacha', 'Objets']) expect(container.textContent).toContain(label)
    expect(container.querySelector('.moderation-target-search')).toBeNull()
    expect(container.textContent).not.toContain('Choisir')
    expect(container.textContent).not.toContain('Moi')
    expect(container.querySelector('.moderation-role')).toBeNull()
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(0)
  })

  it('starts with the targeted-player panel and renders a readable Super quick search', async () => {
    const { container, onListPlayers } = await mount()
    expect(container.querySelector('.moderation-screen-heading')).toBeNull()
    expect(container.querySelector('.scrollable-screen-panel-controls')?.firstElementChild?.classList.contains('moderation-target')).toBe(true)
    expect(container.querySelector('.scrollable-screen-panel-body .moderation-grid')).not.toBeNull()
    expect(container.textContent).toContain('Rang : Super')
    expect(container.querySelector('.moderation-target-heading strong')?.textContent).toBe('Kichnifou')
    await search(container, 'myno')
    expect(onListPlayers).toHaveBeenCalledWith({ query: 'myno', page: 1, sort: 'name', direction: 'asc' })
    const listbox = container.querySelector('[role="listbox"]')!
    expect(listbox.textContent).toContain('Mynonyme')
    expect(listbox.textContent).toContain('Niveau 6')
    expect(listbox.textContent).toContain('Testeur')
  })

  it('keeps player A selected and preserves a multi-digit Stella draft across parent rerenders', async () => {
    const { container, onLoad, props, root } = await mount()
    expect(stellaInput(container).value).toBe('0')
    change(stellaInput(container), '1')
    expect(stellaInput(container).value).toBe('1')
    change(stellaInput(container), '7')
    expect(stellaInput(container).value).toBe('7')
    await search(container, 'Mynonyme')
    const optionA = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]')).find((button) => button.textContent?.includes('Mynonyme') && !button.textContent.includes('Test1'))!
    await act(async () => { optionA.click(); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector('.moderation-target-heading strong')?.textContent).toBe('Mynonyme')
    expect(stellaInput(container).value).toBe('17')

    change(stellaInput(container), '')
    change(stellaInput(container), '123')
    expect(stellaInput(container).value).toBe('123')

    await act(async () => {
      root.render(<ModerationScreen {...props} capabilities={{ ...props.capabilities }} onLoad={async (id) => props.onLoad(id)} onApplied={vi.fn()} />)
      await Promise.resolve()
    })
    expect(container.querySelector('.moderation-target-heading strong')?.textContent).toBe('Mynonyme')
    expect(stellaInput(container).value).toBe('123')
    expect(onLoad.mock.calls.map(([id]) => id)).toEqual([undefined, 'player-a'])
  })

  it('hydrates each explicit switch A → B → self without falling back implicitly', async () => {
    const { container, onLoad } = await mount()
    await search(container, 'Mynonyme')
    let options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'))
    await act(async () => { options.find((button) => button.textContent?.includes('Mynonyme') && !button.textContent.includes('Test1'))!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(stellaInput(container).value).toBe('17')

    await search(container, 'Test1')
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'))
    await act(async () => { options[0]!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector('.moderation-target-heading strong')?.textContent).toBe('MynonymeTest1')
    expect(stellaInput(container).value).toBe('29')

    await act(async () => { container.querySelector<HTMLButtonElement>('.moderation-self-button')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector('.moderation-target-heading strong')?.textContent).toBe('Kichnifou')
    expect(stellaInput(container).value).toBe('0')
    expect(onLoad.mock.calls.map(([id]) => id)).toEqual([undefined, 'player-a', 'player-b', 'self'])
  })

  it('keeps browser selection temporary until confirmation and cancels without changing the target', async () => {
    const { container, onLoad, onListPlayers } = await mount()
    const choose = () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Choisir')!
    await act(async () => { choose().click(); await Promise.resolve(); await Promise.resolve() })
    expect(onListPlayers).toHaveBeenCalledWith({ query: '', elementKey: null, tester: 'all', sort: 'name', direction: 'asc', page: 1 })
    const browserRows = Array.from(container.querySelectorAll<HTMLButtonElement>('.moderation-browser-results > button'))
    act(() => browserRows.find((button) => button.textContent?.includes('MynonymeTest1'))!.click())
    expect(container.querySelector('.moderation-target-heading strong')?.textContent).toBe('Kichnifou')
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('.moderation-browser-actions button')).find((button) => button.textContent === 'Annuler')!.click())
    expect(onLoad).toHaveBeenCalledTimes(1)

    await act(async () => { choose().click(); await Promise.resolve(); await Promise.resolve() })
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('.moderation-browser-results > button')).find((button) => button.textContent?.includes('Mynonyme'))!.click())
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('.moderation-browser-actions button')).find((button) => button.textContent === 'Choisir ce joueur')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(onLoad.mock.calls.map(([id]) => id)).toEqual([undefined, 'player-a'])
    expect(container.querySelector('.moderation-target-heading strong')?.textContent).toBe('Mynonyme')
  })

  it('persists the intended Stella quantity and accepts the returned snapshot', async () => {
    const { container, props } = await mount()
    change(stellaInput(container), '7')
    const objectForm = Array.from(container.querySelectorAll<HTMLFormElement>('.moderation-tool')).find((form) => form.querySelector('h2')?.textContent === 'Objets')!
    await act(async () => { objectForm.requestSubmit(); await Promise.resolve(); await Promise.resolve() })
    expect(props.onStella).toHaveBeenCalledWith('self', '7')
    expect(stellaInput(container).value).toBe('7')
  })

  it('grants and revokes Testeur on the selected external player while keeping that target', async () => {
    const { container, onTester } = await mount()
    await search(container, 'Mynonyme')
    const optionA = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]')).find((button) => button.textContent?.includes('Mynonyme') && !button.textContent.includes('Test1'))!
    await act(async () => { optionA.click(); await Promise.resolve(); await Promise.resolve() })
    const roleButton = () => container.querySelector<HTMLButtonElement>('.moderation-role button')!
    expect(roleButton().textContent).toBe('Attribuer Testeur')
    await act(async () => { roleButton().click(); await Promise.resolve(); await Promise.resolve() })
    expect(onTester).toHaveBeenLastCalledWith('player-a', true)
    expect(roleButton().textContent).toBe('Retirer Testeur')
    expect(container.querySelector('.moderation-target-heading strong')?.textContent).toBe('Mynonyme')
    await act(async () => { roleButton().click(); await Promise.resolve(); await Promise.resolve() })
    expect(onTester).toHaveBeenLastCalledWith('player-a', false)
    expect(roleButton().textContent).toBe('Attribuer Testeur')
  })
})
