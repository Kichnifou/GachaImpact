// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModerationPlayerDto, ModerationStateDto } from '../api/types'
const moderationReports = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), remove: vi.fn() }))
vi.mock('../api/game-api', () => ({ getGameApiClient: () => ({ getDirectMessageReports: moderationReports.list, getDirectMessageReport: moderationReports.detail, deleteDirectMessageReport: moderationReports.remove }) }))
import ModerationScreen from './ModerationScreen'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const roots: Root[] = []
const player = (id: string, displayName: string, tester = false, level = 2): ModerationPlayerDto => ({ id, displayName, elementKey: 'hydro', avatarAssetPath: id === 'player-a' ? '/assets/fixture/mod.png' : null, level, tester, rank: id === 'self' ? 'SUPER' : tester ? 'TESTER' : 'PLAYER' })
const actors = {
  self: player('self', 'Kichnifou', true, 8),
  a: player('player-a', 'Mynonyme', false, 4),
  b: player('player-b', 'MynonymeTest1', true, 6),
}

function state(target = actors.self, superTools = true, stella = target.id === 'self' ? '0' : target.id === 'player-a' ? '17' : '29'): ModerationStateDto {
  const seed = target.id === 'self' ? 1 : target.id === 'player-a' ? 2 : 3
  return {
    player: target.id === 'self' && !superTools ? { ...target, rank: 'TESTER' } : target,
    permissions: {
      roles: superTools ? ['ADMIN', 'TESTER'] : ['TESTER'],
      capabilities: { moderationAccess: true, communityModeration: superTools, selfResourceTools: true, selfGameplayTools: true, superTools, canSelectPlayers: superTools, canManageTesters: superTools },
    },
    resources: { primogems: seed === 1 ? '783880' : String(seed * 1000), moras: seed === 1 ? '5625992' : String(seed * 2000), particles: { pyro: String(seed), hydro: String(seed * 2), cryo: seed === 1 ? '12422' : String(seed * 3), electro: String(seed * 4), anemo: String(seed * 5), geo: String(seed * 6), dendro: String(seed * 7) } },
    progression: { totalXp: target.id === 'player-b' ? '181' : '89', level: target.level, xpIntoCurrentStep: '29', xpPerStep: '30', isMaxLevel: false, level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0' },
    gachaState: { pity5: seed * 10, pity4: seed, guaranteedFeatured5: seed === 1, captureProgress: seed - 1, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' },
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

function changeSelect(select: HTMLSelectElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function tool(container: HTMLElement, title: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('.moderation-tool')).find((entry) => entry.querySelector('h2')?.textContent === title)!
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
  const onResource = vi.fn(async (target: string, input: { resourceKey: string; amount: string; direction: 'add' | 'remove' }) => {
    const current = states.get(target)!
    const delta = BigInt(input.amount) * (input.direction === 'add' ? 1n : -1n)
    const resources = input.resourceKey === 'primogems' || input.resourceKey === 'moras'
      ? { ...current.resources, [input.resourceKey]: String(BigInt(current.resources[input.resourceKey]) + delta) }
      : { ...current.resources, particles: { ...current.resources.particles, [input.resourceKey.replace('particles_', '')]: String(BigInt(current.resources.particles[input.resourceKey.replace('particles_', '') as keyof typeof current.resources.particles]) + delta) } }
    const updated = { ...current, resources }
    states.set(target, updated)
    return updated
  })
  const onXp = vi.fn(async (target: string, input: { totalXp?: string; prepareNextLevel?: true }) => {
    const current = states.get(target)!
    const updated = { ...current, progression: { ...current.progression, totalXp: input.totalXp ?? current.progression.totalXp } }
    states.set(target, updated)
    return updated
  })
  const onGacha = vi.fn(async (target: string, input: { pity5?: number; pity4?: number; guaranteedFeatured5?: boolean; captureProgress?: number }) => {
    const current = states.get(target)!
    const updated = { ...current, gachaState: { ...current.gachaState, ...input } }
    states.set(target, updated)
    return updated
  })
  const props: React.ComponentProps<typeof ModerationScreen> = {
    actorPlayerId: 'self', capabilities: state(actors.self, superTools).permissions.capabilities,
    onLoad, onListPlayers, onResource, onXp, onGacha,
    onStella: vi.fn(async (target, quantity) => {
      const updated = state(states.get(target)!.player, superTools, quantity)
      states.set(target, updated)
      return updated
    }), onTester, onApplied: vi.fn(),
    ...(superTools ? {
      onLoadGiftCodes: vi.fn(async () => ({ actorPlayerId: 'self', page: 1, pageSize: 20 as const, total: 0, totalPages: 1, codes: [] })),
      onCreateGiftCode: vi.fn(async () => { throw new Error('not used') }),
      onPublishGiftCode: vi.fn(async () => { throw new Error('not used') }),
      onUpdateGiftCode: vi.fn(async () => { throw new Error('not used') }),
      onGiftCodeClaimants: vi.fn(async () => { throw new Error('not used') }),
    } : {}),
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
    expect(container.querySelector('.scrollable-screen-panel-controls')?.firstElementChild?.classList.contains('moderation-tabs')).toBe(true)
    expect(container.querySelector('.scrollable-screen-panel-controls .moderation-target')).not.toBeNull()
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

  it('keeps player targeting inside Système de jeu and mounts Codes only for a Super who selects that tab', async () => {
    const { container, props } = await mount()
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('.moderation-tabs [role="tab"]'))
    expect(tabs.map((tab) => [tab.textContent, tab.disabled])).toEqual([['Système de jeu', false], ['Codes', false], ['Bannières', true], ['Événements', true], ['Communauté', false]])
    expect(props.onLoadGiftCodes).not.toHaveBeenCalled()
    tabs[0]!.focus()
    await act(async () => { tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await Promise.resolve(); await Promise.resolve() })
    expect(document.activeElement).toBe(tabs[1])
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('.moderation-target')).toBeNull()
    expect(container.querySelector('.gift-code-admin')).not.toBeNull()
    expect(props.onLoadGiftCodes).not.toHaveBeenCalled()
    act(() => tabs[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
    expect(document.activeElement).toBe(tabs[0])
    expect(container.querySelector('.moderation-target')).not.toBeNull()

    const tester = await mount(false)
    const testerCodes = Array.from(tester.container.querySelectorAll<HTMLButtonElement>('.moderation-tabs [role="tab"]')).find((tab) => tab.textContent === 'Codes')!
    expect(testerCodes.disabled).toBe(true)
  })

  it('opens a moderator-only account directly on Community and renders frozen detail without free browse', async () => {
    const line = { id: 'message-1', authorPlayerId: 'reported', authorDisplayName: 'Reported', content: 'Preuve figée', createdAt: '2026-09-23T08:00:00.000Z', submissionOrder: '4', editedAt: null, deletedAt: null }
    const summary = { id: 'report-1', createdAt: '2026-09-24T08:00:00.000Z', source: 'MP' as const, reporter: { id: 'reporter', displayName: 'Reporter' }, reported: { id: 'reported', displayName: 'Reported' }, message: line }
    moderationReports.list.mockImplementation(async (page: number) => ({ reports: [summary], page, pageSize: 20, total: 21, totalPages: 2 }))
    moderationReports.detail.mockResolvedValue({ ...summary, snapshotFingerprint: 'a'.repeat(64), context: [{ ...line, id: 'before', content: 'Avant' }, line] })
    const seeded = await mount(); const props = seeded.props
    act(() => seeded.root.unmount()); roots.splice(roots.indexOf(seeded.root), 1)
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
    const onLoad = vi.fn(async () => state(actors.self))
    await act(async () => { root.render(<ModerationScreen {...props} capabilities={{ moderationAccess: true, communityModeration: true, selfResourceTools: false, selfGameplayTools: false, superTools: false, canSelectPlayers: false, canManageTesters: false }} onLoad={onLoad} />); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Communauté')
    expect(onLoad).not.toHaveBeenCalled(); expect(container.textContent).toContain('Signalements MP'); expect(container.textContent).toContain('Preuve figée'); expect(container.textContent).toContain('Page 1 / 2')
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.moderation-tabs button')).find(button => button.textContent === 'Système de jeu')?.disabled).toBe(true)
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-reports-panel > footer button')).find(button => button.textContent === 'Suivant'))!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(moderationReports.list).toHaveBeenCalledWith(2); expect(container.textContent).toContain('Page 2 / 2')
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-reports-list button')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(moderationReports.detail).toHaveBeenCalledWith('report-1'); expect(container.querySelector('.dm-moderation-context article.target')?.textContent).toContain('Preuve figée')
    for (const forbidden of ['Voir la conversation', 'Ouvrir les MP', 'Voir plus de contexte', 'Rechercher dans les MP']) expect(container.textContent).not.toContain(forbidden)
  })

  it('confirms report deletion from list and detail, closes immediately and revalidates the list', async () => {
    const line = { id: 'message-delete', authorPlayerId: 'reported', authorDisplayName: 'Reported', content: 'Preuve privée', createdAt: '2026-09-23T08:00:00.000Z', submissionOrder: '4', editedAt: null, deletedAt: null }
    const summary = { id: 'report-delete', createdAt: '2026-09-24T08:00:00.000Z', source: 'MP' as const, reporter: { id: 'reporter', displayName: 'Reporter' }, reported: { id: 'reported', displayName: 'Reported' }, message: line }
    moderationReports.list.mockResolvedValue({ reports: [summary], page: 1, pageSize: 20, total: 1, totalPages: 1 })
    moderationReports.detail.mockResolvedValue({ ...summary, context: [line], snapshotFingerprint: 'a'.repeat(64) })
    moderationReports.remove.mockResolvedValue({ deleted: true })
    const { container } = await mount()
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.moderation-tabs button')).find(button => button.textContent === 'Communauté'))!.click(); await Promise.resolve(); await Promise.resolve() })
    const remove = container.querySelector<HTMLButtonElement>('[aria-label="Supprimer le signalement de Reported"]')!
    await act(async () => { remove.click() })
    expect(container.textContent).toContain('Supprimer ce signalement ?')
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.moderation-delete-confirm button')).find(button => button.textContent === 'Annuler'))!.click() })
    expect(moderationReports.remove).not.toHaveBeenCalled()
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Supprimer le signalement de Reported"]')!.click() })
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.moderation-delete-confirm button')).find(button => button.textContent === 'Confirmer'))!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector('.moderation-delete-confirm')).toBeNull(); expect(moderationReports.remove).toHaveBeenCalledWith('report-delete')

    moderationReports.list.mockResolvedValue({ reports: [summary], page: 1, pageSize: 20, total: 1, totalPages: 1 })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-report-open')!.click(); await Promise.resolve(); await Promise.resolve() })
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-report-detail-actions button')).find(button => button.textContent === 'Supprimer'))!.click() })
    expect(container.textContent).toContain('Supprimer ce signalement ?')
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.moderation-delete-confirm button')).find(button => button.textContent === 'Confirmer'))!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector('.moderation-delete-confirm')).toBeNull()
    expect(container.querySelector('.dm-report-detail')).toBeNull()
    expect(container.textContent).toContain('Signalements MP')
    expect(moderationReports.remove).toHaveBeenCalledTimes(2)
  })

  it('keeps enabled report and pagination controls pointer-only in production CSS', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8')
    expect(css).toContain('.dm-report-open {')
    expect(css).toMatch(/\.dm-report-open \{[^}]*cursor: pointer;/u)
    expect(css).toMatch(/\.dm-reports-panel header button, \.dm-reports-panel > footer button \{[^}]*cursor: pointer;/u)
    expect(css).toMatch(/\.dm-reports-panel button:disabled \{ cursor: default;/u)
  })

  it('shows authoritative current values and changes the resource summary with its selector', async () => {
    const { container } = await mount()
    expect(tool(container, 'Ressources').querySelector('.moderation-current')?.textContent).toBe('783 880 Primos')
    expect(tool(container, 'Progression').querySelector('.moderation-current')?.textContent).toBe('89 XP · Niveau 8')
    expect(tool(container, 'Gacha').querySelector('.moderation-current')?.textContent).toBe('Pity 5★ 10 · Pity 4★ 1 · Capture 0/3 · Garantie Oui')
    expect(tool(container, 'Objets').querySelector('.moderation-current')?.textContent).toBe('0 Stella')
    changeSelect(tool(container, 'Ressources').querySelector('select')!, 'particles_cryo')
    expect(tool(container, 'Ressources').querySelector('.moderation-current')?.textContent).toBe('12 422 particules Cryo')
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
    expect(options.find((button) => button.textContent?.includes('Mynonyme') && !button.textContent.includes('Test1'))?.querySelector('img')?.getAttribute('src')).toBe('/assets/fixture/mod.png')
    await act(async () => { options.find((button) => button.textContent?.includes('Mynonyme') && !button.textContent.includes('Test1'))!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(stellaInput(container).value).toBe('17')
    expect(tool(container, 'Ressources').querySelector('.moderation-current')?.textContent).toBe('2 000 Primos')
    expect(tool(container, 'Progression').querySelector('.moderation-current')?.textContent).toBe('89 XP · Niveau 4')
    expect(tool(container, 'Gacha').querySelector('.moderation-current')?.textContent).toContain('Pity 5★ 20')

    await search(container, 'Test1')
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'))
    await act(async () => { options[0]!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector('.moderation-target-heading strong')?.textContent).toBe('MynonymeTest1')
    expect(stellaInput(container).value).toBe('29')
    expect(tool(container, 'Ressources').querySelector('.moderation-current')?.textContent).toBe('3 000 Primos')
    expect(tool(container, 'Progression').querySelector('.moderation-current')?.textContent).toBe('181 XP · Niveau 6')
    expect(tool(container, 'Gacha').querySelector('.moderation-current')?.textContent).toContain('Pity 5★ 30')

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
    expect(tool(container, 'Objets').querySelector('.moderation-current')?.textContent).toBe('7 Stella')
  })

  it('updates resource, XP and Gacha current values from each returned mutation snapshot', async () => {
    const { container } = await mount()
    const resourceForm = tool(container, 'Ressources') as HTMLFormElement
    await act(async () => { resourceForm.requestSubmit(); await Promise.resolve(); await Promise.resolve() })
    expect(resourceForm.querySelector('.moderation-current')?.textContent).toBe('784 040 Primos')

    const progressionForm = tool(container, 'Progression') as HTMLFormElement
    change(progressionForm.querySelector('input')!, '240')
    await act(async () => { progressionForm.requestSubmit(); await Promise.resolve(); await Promise.resolve() })
    expect(progressionForm.querySelector('.moderation-current')?.textContent).toBe('240 XP · Niveau 8')

    const gachaForm = tool(container, 'Gacha') as HTMLFormElement
    const inputs = gachaForm.querySelectorAll<HTMLInputElement>('input')
    change(inputs[0]!, '42'); change(inputs[1]!, '6'); change(inputs[2]!, '2')
    await act(async () => { gachaForm.requestSubmit(); await Promise.resolve(); await Promise.resolve() })
    expect(gachaForm.querySelector('.moderation-current')?.textContent).toBe('Pity 5★ 42 · Pity 4★ 6 · Capture 2/3 · Garantie Oui')
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
