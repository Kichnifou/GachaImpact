// @vitest-environment happy-dom

import { act, useState, type ComponentProps } from 'react'
import { readFileSync } from 'node:fs'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PlayerTeamDto, PlayerTeamsDto, TeamCharacterDto } from '../api/types'
import { canOpenNextTeamPage, filterTeamCharacters, insertTeamOrder, swapTeamOrder, swapTeamSlots, teamPageForPosition, teamPassiveStatusLabel } from '../team/team-presentation'
import TeamScreen, { CharacterSelector, TeamPassiveReferenceModal } from './TeamScreen'
import teamScreenSource from './TeamScreen.tsx?raw'

const appCssSource = readFileSync('src/App.css', 'utf8');

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const character = (overrides: Partial<TeamCharacterDto> = {}): TeamCharacterDto => ({
  id: 'furina', externalKey: 'legacy:20', name: 'Furina', rarity: 5, elementKey: 'hydro',
  classKey: 'support', weaponType: 'sword', region: 'fontaine', iconPath: '/furina.png',
  splashPath: null, wishPath: null, fullbodyPath: '/furina-fullbody.png', constellation: 1,
  ...overrides,
})

const catalog = [
  character(),
  character({ id: 'emilie', externalKey: 'legacy:21', name: 'Émilie', elementKey: 'dendro', constellation: 0 }),
  character({ id: 'keqing', externalKey: 'legacy:22', name: 'Keqing', elementKey: 'electro', constellation: 4 }),
  character({ id: 'hutao', externalKey: 'legacy:23', name: 'Hu Tao', elementKey: 'pyro', constellation: 2 }),
]

const slots = (count: number) => Array.from({ length: 4 }, (_, index) => ({
  position: (index + 1) as 1 | 2 | 3 | 4,
  character: catalog[index] && index < count ? catalog[index]! : null,
}))

const team = (position: number, count = 0, active = position === 1): PlayerTeamDto => ({
  id: `00000000-0000-4000-8000-${String(position).padStart(12, '0')}`,
  position,
  name: position === 1 ? 'Équipe principale' : null,
  active,
  slots: slots(count),
  passives: count > 0 ? [{ elementKey: 'hydro', displayName: 'Hydro', levelOne: 'Bonus I', levelTwo: 'Bonus II', stacks: Math.min(2, count) as 1 | 2, description: count > 1 ? 'Bonus II' : 'Bonus I' }] : [],
})

const teams = (count: number, total = 10, activePosition = 1): PlayerTeamsDto => ({
  teams: Array.from({ length: total }, (_, index) => team(index + 1, index + 1 === activePosition ? count : 0, index + 1 === activePosition)),
  availableCharacters: catalog,
  passiveReference: [
    { elementKey: 'pyro', displayName: 'Pyro', levelOne: 'Pyro I', levelTwo: 'Pyro II' },
    { elementKey: 'hydro', displayName: 'Hydro', levelOne: 'Hydro I', levelTwo: 'Hydro II' },
    { elementKey: 'cryo', displayName: 'Cryo', levelOne: 'Cryo I', levelTwo: 'Cryo II' },
    { elementKey: 'electro', displayName: 'Électro', levelOne: 'Electro I', levelTwo: 'Electro II' },
    { elementKey: 'anemo', displayName: 'Anémo', levelOne: 'Anemo I', levelTwo: 'Anemo II' },
    { elementKey: 'geo', displayName: 'Géo', levelOne: 'Geo I', levelTwo: 'Geo II' },
    { elementKey: 'dendro', displayName: 'Dendro', levelOne: 'Dendro I', levelTwo: 'Dendro II' },
  ],
})

const callbacks = {
  initialBox: null,
  stellaRetryCharacterId: null,
  onLoad: vi.fn(async () => teams(4)),
  onActivate: vi.fn(async () => teams(4)),
  onRename: vi.fn(async () => teams(4)),
  onCreateNext: vi.fn(async () => teams(4)),
  onDelete: vi.fn(async () => teams(4)),
  onReorderTeams: vi.fn(async () => teams(4)),
  onSetSlot: vi.fn(async () => teams(4)),
  onReorderSlots: vi.fn(async () => teams(4)),
  onRemoveSlot: vi.fn(async () => teams(3)),
  onClear: vi.fn(async () => teams(0)),
  onLoadBox: vi.fn(),
  onSetBoxFavorite: vi.fn(),
  onUseStella: vi.fn(),
}

type TeamScreenProps = ComponentProps<typeof TeamScreen>

const mountedRoots: Root[] = []

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach((root) => root.unmount()))
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function withTeamCharacters(source: PlayerTeamsDto, byPosition: Readonly<Record<number, readonly TeamCharacterDto[]>>) {
  return {
    ...source,
    teams: source.teams.map((entry) => {
      const characters = byPosition[entry.position]
      if (!characters) return entry
      return {
        ...entry,
        slots: Array.from({ length: 4 }, (_, index) => ({
          position: (index + 1) as 1 | 2 | 3 | 4,
          character: characters[index] ?? null,
        })),
      }
    }),
  }
}

function mountTeamScreen(initialTeams: PlayerTeamsDto, overrides: Partial<TeamScreenProps> = {}) {
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  const loadForever = vi.fn(() => new Promise<PlayerTeamsDto>(() => undefined))
  const reorderTeams = overrides.onReorderTeams ?? callbacks.onReorderTeams
  const reorderSlots = overrides.onReorderSlots ?? callbacks.onReorderSlots

  function Harness() {
    const [snapshot, setSnapshot] = useState(initialTeams)
    const applyTeamReorder = async (teamIds: readonly string[]) => {
      const next = await reorderTeams(teamIds)
      setSnapshot(next)
      return next
    }
    const applySlotReorder = async (teamId: string, characterIds: readonly (string | null)[]) => {
      const next = await reorderSlots(teamId, characterIds)
      setSnapshot(next)
      return next
    }
    return <TeamScreen {...callbacks} {...overrides} teams={snapshot} onLoad={loadForever} onReorderTeams={applyTeamReorder} onReorderSlots={applySlotReorder} />
  }

  act(() => root.render(<Harness />))
  return container
}

function buttonByLabel(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.getAttribute('aria-label') === label)
  if (!button) throw new Error(`Button not found: ${label}`)
  return button
}

function teamButton(container: HTMLElement, position: number) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('.team-page-track button')).find((candidate) => candidate.querySelector('span')?.textContent === `Team ${position}`)
  if (!button) throw new Error(`Team button not found: ${position}`)
  return button
}

function displayedCharacterNames(container: HTMLElement) {
  const grid = container.querySelector('.large-team-grid')
  if (!grid) throw new Error('Team grid not found')
  return Array.from(grid.children).map((slot) => catalog.find(({ name }) => slot.textContent?.includes(name))?.name ?? null)
}

function startDrag(element: HTMLElement) {
  const event = new DragEvent('dragstart', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: { effectAllowed: 'none' } })
  element.dispatchEvent(event)
}

function dropOn(element: HTMLElement) {
  element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }))
}

function enterDrag(element: HTMLElement) {
  element.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true }))
}

describe('real Team screen', () => {
  it('has no Team mock source and renders the ten authoritative base Teams', () => {
    expect(teamScreenSource).not.toContain("from '../data/mockData'")
    expect(teamScreenSource).not.toContain('Puissance fictive')
    const html = renderToStaticMarkup(<TeamScreen teams={teams(4)} {...callbacks} />)
    for (let position = 1; position <= 10; position += 1) expect(html).toContain(`Team ${position}`)
    expect(html).toContain('Équipe principale')
    expect(html).toContain('Team 1 · Active')
  })

  it.each([0, 1, 4])('renders a genuine %i/4 ordered composition', (count) => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(count)} {...callbacks} />)
    expect((html.match(/class="team-slot-number"/g) ?? [])).toHaveLength(4)
    expect((html.match(/character-showcase-team/g) ?? [])).toHaveLength(count)
    expect((html.match(/empty-team-card/g) ?? [])).toHaveLength(4 - count)
    expect(html).not.toContain('Niveau 90')
    if (count > 0) expect(html).toContain('C1')
  })

  it('exposes direct add/change/remove/clear controls and real derived passives', () => {
    const full = renderToStaticMarkup(<TeamScreen teams={teams(4)} {...callbacks} />)
    expect((full.match(/>Changer</g) ?? [])).toHaveLength(4)
    expect((full.match(/>Retirer</g) ?? [])).toHaveLength(4)
    expect(full).toContain('>Vider<')
    expect(full).toContain('Hydro II')
    const empty = renderToStaticMarkup(<TeamScreen teams={teams(0)} {...callbacks} />)
    expect((empty.match(/>Ajouter</g) ?? [])).toHaveLength(4)
    expect(empty).toContain('Aucun passif actif')
  })

  it('keeps occupied Team cards compact and groups their hover actions into primary then movement rows', () => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(4)} {...callbacks} />)
    expect((html.match(/team-card-primary-actions/g) ?? [])).toHaveLength(4)
    expect((html.match(/team-card-move-actions/g) ?? [])).toHaveLength(4)
    expect(html).toMatch(/team-card-primary-actions"><button[^>]*>Fiche<\/button><button[^>]*>Changer<\/button><button[^>]*>Retirer<\/button>/)
    expect(html).toMatch(/team-card-move-actions"><button[^>]*disabled=""[^>]*>←<\/button><button[^>]*>→<\/button>/)
  })

  it('uses native disabled movement controls and never exposes the former loading cursor', () => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(4)} {...callbacks} />)
    expect(html).toContain('aria-label="Déplacer Furina vers la gauche" disabled=""')
    expect(html).not.toMatch(/aria-label="Déplacer Furina vers la gauche"[^>]*cursor:wait/)
  })

  it('labels derived passives as the active Team or a preview without claiming gameplay activation', () => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(4)} {...callbacks} />)
    expect(html).toContain('>Team active<')
    expect(html).toContain('Hydro II')
    expect(html).not.toContain('Actifs pour le gameplay')
    expect(teamPassiveStatusLabel(false)).toBe('Aperçu')
  })

  it('filters real possessions by accent-insensitive contiguous substring and element', () => {
    expect(filterTeamCharacters(catalog, 'emil', 'all').map(({ name }) => name)).toEqual(['Émilie'])
    expect(filterTeamCharacters(catalog, 'tao', 'pyro').map(({ name }) => name)).toEqual(['Hu Tao'])
    expect(filterTeamCharacters(catalog, 'fur', 'electro')).toEqual([])
    expect(filterTeamCharacters(catalog, 'fna', 'all')).toEqual([])
  })

  it('keeps characters already present visible but disabled in the selector', () => {
    const html = renderToStaticMarkup(<CharacterSelector
      team={team(1, 1)} characters={catalog} presentIds={new Set(['furina'])}
      search="" elementFilter="all" selectedId="keqing" pending={false}
      onSearch={vi.fn()} onElement={vi.fn()} onSelect={vi.fn()} onClose={vi.fn()} onConfirm={vi.fn()}
    />)
    expect(html).toContain('Furina')
    expect(html).toMatch(/character-card hydro compact disabled[^>]*disabled=""/)
    expect(html).toContain('Keqing')
    expect(html).toContain('Sélection : <strong>Keqing</strong>')
    expect(html).toContain('Confirmer')
  })

  it('renders a clean unavailable state and mutation errors are player-facing', () => {
    expect(renderToStaticMarkup(<TeamScreen teams={{ teams: [], availableCharacters: [], passiveReference: [] }} {...callbacks} />)).toContain('Aucune équipe disponible')
    expect(teamScreenSource).toContain('setError(apiErrorMessage(reason))')
    expect(teamScreenSource).toContain('role="alert"')
  })

  it('keeps empty slots full-card actionable without the old permanent empty copy', () => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(0)} {...callbacks} />)
    expect((html.match(/<button[^>]*class="large-team-card empty-team-card"/g) ?? [])).toHaveLength(4)
    expect((html.match(/class="empty-team-hover-action">Ajouter/g) ?? [])).toHaveLength(4)
    expect(html).not.toContain('Emplacement libre')
    expect(html).not.toContain('Ajouter un personnage</button>')
  })

  it.each([1, 3, 4])('keeps the same four external slot wrappers for a genuine %i/4 Team', (count) => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(count)} {...callbacks} />)
    expect(html).toContain(`large-team-grid team-count-${count}`)
    expect((html.match(/team-slot-drag-wrapper/g) ?? [])).toHaveLength(4)
    expect((html.match(/empty-team-slot/g) ?? [])).toHaveLength(4 - count)
  })

  it('keeps the passive reference action compact and the rename pencil centered and accessible', () => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(4)} {...callbacks} />)
    expect(html).toContain('class="team-reference-toggle"')
    expect(html).toContain('aria-label="Renommer cette Team"')
  })

  it.each([1, 2, 3, 4])('marks a %i-passive layout without changing the other passive cases', (count) => {
    const snapshot = teams(4)
    const passiveTeam = {
      ...snapshot.teams[0]!,
      passives: snapshot.passiveReference.slice(0, count).map((passive) => ({
        ...passive,
        stacks: 1 as const,
        description: passive.levelOne,
      })),
    }
    const html = renderToStaticMarkup(<TeamScreen teams={{ ...snapshot, teams: [passiveTeam, ...snapshot.teams.slice(1)] }} {...callbacks} />)
    expect(html).toContain(`bonus-grid passive-count-${count}`)
  })

  it('keeps the passive action outside the adaptive grid and reserves only its natural width', () => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(4)} {...callbacks} />)
    const contentEnd = html.indexOf('</div><button type="button" class="team-reference-toggle"')
    expect(html.indexOf('class="team-bonus-content"')).toBeGreaterThanOrEqual(0)
    expect(html.indexOf('class="bonus-grid')).toBeLessThan(contentEnd)
    expect(contentEnd).toBeGreaterThanOrEqual(0)
    expect(appCssSource).toContain('grid-template-columns: minmax(0, 1fr) max-content')
    expect(appCssSource).toContain('.team-reference-toggle { align-self: center; margin-top: 0; white-space: nowrap; }')
    expect(appCssSource).not.toContain('.team-reference-toggle { align-self: center; margin-top: 23px;')
    expect(appCssSource).toContain('.team-bonuses .bonus-grid.passive-count-3 article:nth-child(3)')
    expect(appCssSource).toContain('justify-self: center')
  })

  it('lays out exactly four passives as a desktop 2x2 grid while retaining the mobile column', () => {
    const snapshot = teams(4)
    const passiveTeam = {
      ...snapshot.teams[0]!,
      passives: snapshot.passiveReference.slice(0, 4).map((passive) => ({ ...passive, stacks: 1 as const, description: passive.levelOne })),
    }
    const html = renderToStaticMarkup(<TeamScreen teams={{ ...snapshot, teams: [passiveTeam, ...snapshot.teams.slice(1)] }} {...callbacks} />)
    expect(html).toContain('bonus-grid passive-count-4')
  })

  it('places the team switcher before the compact selected-team heading', () => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(2)} {...callbacks} />)
    expect(html.indexOf('team-switcher panel')).toBeLessThan(html.indexOf('team-screen-heading'))
  })

  it('shows an explicit swap destination on occupied and empty character slots without insertion feedback', () => {
    const container = mountTeamScreen(teams(3))
    const slotWrappers = container.querySelectorAll<HTMLElement>('.team-slot-drag-wrapper')

    act(() => startDrag(slotWrappers[0]!))
    act(() => enterDrag(slotWrappers[1]!))
    expect(slotWrappers[1]!.classList.contains('drag-slot-target')).toBe(true)
    expect(slotWrappers[1]!.querySelector('.slot-swap-indicator')?.textContent).toBe('Échanger')

    act(() => enterDrag(slotWrappers[3]!))
    expect(slotWrappers[3]!.classList.contains('drag-slot-target')).toBe(true)
    expect(slotWrappers[3]!.querySelector('.slot-swap-indicator')?.textContent).toBe('Échanger')
    expect(container.querySelector('.team-between-drop.drag-insert-target')).toBeNull()
  })

  it('opens the seven-passive reference as a dismissible modal instead of inline content', () => {
    const html = renderToStaticMarkup(<TeamPassiveReferenceModal passives={teams(0).passiveReference} onClose={vi.fn()} />)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('Les sept passifs')
    expect((html.match(/class="bonus-element-icon"/g) ?? [])).toHaveLength(7)
    expect(html).toContain('aria-label="Fermer les passifs"')
  })

  it('uses the shorter passive-reference wording while preserving the modal title', () => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(0)} {...callbacks} />)
    expect(html).toContain('>Voir les passifs<')
    expect(html).not.toContain('>Voir les sept passifs<')
    expect(renderToStaticMarkup(<TeamPassiveReferenceModal passives={teams(0).passiveReference} onClose={vi.fn()} />)).toContain('Les sept passifs')
  })

  it('reuses the exact Box detail component and shared Box collection coordinator', () => {
    expect(teamScreenSource).toContain('<BoxCharacterDetailModal')
    expect(teamScreenSource).toContain('useBoxCollection')
    expect(teamScreenSource).not.toContain('function TeamCharacterDetail')
  })

  it('groups Teams by ten and gates only the next sequential page', () => {
    expect(teamPageForPosition(1)).toBe(0)
    expect(teamPageForPosition(10)).toBe(0)
    expect(teamPageForPosition(11)).toBe(1)
    expect(teamPageForPosition(21)).toBe(2)
    expect(canOpenNextTeamPage(10, 0)).toBe(true)
    expect(canOpenNextTeamPage(10, 1)).toBe(false)
    expect(canOpenNextTeamPage(20, 1)).toBe(true)
    expect(canOpenNextTeamPage(20, 2)).toBe(false)

    const firstPage = renderToStaticMarkup(<TeamScreen teams={teams(0)} {...callbacks} />)
    expect(firstPage).toContain('aria-label="Teams suivantes"')
    expect(firstPage).not.toContain('aria-label="Teams précédentes"')

    const incompleteSecondPage = renderToStaticMarkup(<TeamScreen teams={teams(3, 11, 11)} {...callbacks} />)
    expect(incompleteSecondPage).toContain('aria-label="Teams précédentes"')
    expect(incompleteSecondPage).not.toContain('aria-label="Teams suivantes"')
    expect(incompleteSecondPage).toContain('Team 12')
    expect(incompleteSecondPage).toContain('＋ Créer')
    expect(incompleteSecondPage).toContain('Team 13 verrouillée')

    const completeSecondPage = renderToStaticMarkup(<TeamScreen teams={teams(4, 20, 11)} {...callbacks} />)
    expect(completeSecondPage).toContain('aria-label="Teams suivantes"')
  })

  it('keeps ten separated Team cards and eleven insertion targets on each page', () => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(0)} {...callbacks} />)
    expect(html).toContain('class="team-page-track team-page-track-spaced"')
    expect((html.match(/class="team-switch-item"/g) ?? [])).toHaveLength(10)
    expect((html.match(/class="team-between-drop/g) ?? [])).toHaveLength(11)
  })

  it('defines stable swap, insertion and character-slot reorder semantics', () => {
    expect(swapTeamOrder(['a', 'b', 'c'], 'a', 'c')).toEqual(['c', 'b', 'a'])
    expect(insertTeamOrder(['a', 'b', 'c', 'd'], 'a', 3)).toEqual(['b', 'c', 'a', 'd'])
    expect(insertTeamOrder(['a', 'b', 'c', 'd'], 'd', 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(swapTeamSlots(['a', null, 'c', 'd'], 0, 1)).toEqual([null, 'a', 'c', 'd'])
  })

  it('exposes distinct Team swap, Team insertion and character drop feedback states', () => {
    expect(teamScreenSource).toContain("' drag-swap-target'")
    expect(teamScreenSource).toContain("' drag-insert-target'")
    expect(teamScreenSource).toContain("' drag-slot-target'")
  })

  it('blocks a second Team reorder and disables every drag surface while the first one is pending', async () => {
    const pending = deferred<PlayerTeamsDto>()
    const onReorderTeams = vi.fn(() => pending.promise)
    const container = mountTeamScreen(teams(4), { onReorderTeams })

    act(() => startDrag(teamButton(container, 1)))
    act(() => dropOn(teamButton(container, 2)))

    expect(onReorderTeams).toHaveBeenCalledTimes(1)
    expect(teamButton(container, 1).textContent).toContain('0/4')
    expect(teamButton(container, 2).textContent).toContain('4/4')
    expect(Array.from(container.querySelectorAll<HTMLElement>('.team-page-track button, .team-slot-drag-wrapper')).every((element) => element.getAttribute('draggable') === 'false')).toBe(true)

    act(() => startDrag(teamButton(container, 3)))
    act(() => dropOn(teamButton(container, 4)))

    expect(onReorderTeams).toHaveBeenCalledTimes(1)
    expect(teamButton(container, 1).textContent).toContain('0/4')
    expect(teamButton(container, 2).textContent).toContain('4/4')

    await act(async () => { pending.reject({ code: 'NETWORK_ERROR' }); await Promise.resolve() })

    expect(teamButton(container, 1).textContent).toContain('4/4')
    expect(teamButton(container, 2).textContent).toContain('0/4')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('momentanément inaccessible')
  })

  it('shows the slot preview immediately, then adopts the authoritative server snapshot on success', async () => {
    const initial = withTeamCharacters(teams(0), { 1: catalog })
    const authoritative = withTeamCharacters(initial, { 1: [catalog[2]!, catalog[0]!, catalog[1]!, catalog[3]!] })
    const pending = deferred<PlayerTeamsDto>()
    const onReorderSlots = vi.fn(() => pending.promise)
    const container = mountTeamScreen(initial, { onReorderSlots })

    act(() => buttonByLabel(container, 'Déplacer Furina vers la droite').click())

    expect(onReorderSlots).toHaveBeenCalledTimes(1)
    expect(displayedCharacterNames(container)).toEqual(['Émilie', 'Furina', 'Keqing', 'Hu Tao'])
    expect(Array.from(container.querySelectorAll<HTMLElement>('.team-slot-drag-wrapper')).every((element) => element.getAttribute('draggable') === 'false')).toBe(true)

    act(() => startDrag(container.querySelector<HTMLElement>('.team-slot-drag-wrapper')!))
    act(() => dropOn(container.querySelectorAll<HTMLElement>('.team-slot-drag-wrapper')[2]!))
    expect(onReorderSlots).toHaveBeenCalledTimes(1)
    expect(displayedCharacterNames(container)).toEqual(['Émilie', 'Furina', 'Keqing', 'Hu Tao'])

    await act(async () => { pending.resolve(authoritative); await pending.promise })

    expect(displayedCharacterNames(container)).toEqual(['Keqing', 'Furina', 'Émilie', 'Hu Tao'])
    expect(Array.from(container.querySelectorAll<HTMLElement>('.team-slot-drag-wrapper')).every((element) => element.getAttribute('draggable') === 'true')).toBe(true)
  })

  it('rolls a slot preview back and exposes the server error', async () => {
    const initial = withTeamCharacters(teams(0), { 1: catalog })
    const pending = deferred<PlayerTeamsDto>()
    const container = mountTeamScreen(initial, { onReorderSlots: vi.fn(() => pending.promise) })

    act(() => buttonByLabel(container, 'Déplacer Furina vers la droite').click())
    expect(displayedCharacterNames(container)).toEqual(['Émilie', 'Furina', 'Keqing', 'Hu Tao'])

    await act(async () => { pending.reject({ code: 'NETWORK_ERROR' }); await Promise.resolve() })

    expect(displayedCharacterNames(container)).toEqual(['Furina', 'Émilie', 'Keqing', 'Hu Tao'])
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('momentanément inaccessible')
  })

  it('never leaks Team A slot preview into Team B while the request resolves', async () => {
    const initial = withTeamCharacters(teams(0), {
      1: [catalog[0]!, catalog[1]!],
      2: [catalog[2]!, catalog[3]!],
    })
    const authoritative = withTeamCharacters(initial, {
      1: [catalog[1]!, catalog[0]!],
      2: [catalog[2]!, catalog[3]!],
    })
    const pending = deferred<PlayerTeamsDto>()
    const container = mountTeamScreen(initial, { onReorderSlots: vi.fn(() => pending.promise) })

    act(() => buttonByLabel(container, 'Déplacer Furina vers la droite').click())
    expect(displayedCharacterNames(container)).toEqual(['Émilie', 'Furina', null, null])

    act(() => teamButton(container, 2).click())
    expect(displayedCharacterNames(container)).toEqual(['Keqing', 'Hu Tao', null, null])

    await act(async () => { pending.resolve(authoritative); await pending.promise })

    expect(displayedCharacterNames(container)).toEqual(['Keqing', 'Hu Tao', null, null])
    expect(container.querySelector('.team-screen-heading')?.textContent).toContain('Team 2')
  })

  it('offers compact inline rename and touch-safe reorder controls', () => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(4)} {...callbacks} />)
    expect(html).toContain('aria-label="Renommer cette Team"')
    expect(html).toContain('aria-label="Déplacer cette Team vers la droite"')
    expect(teamScreenSource).toContain("event.key === 'Enter'")
    expect(teamScreenSource).toContain("event.key === 'Escape'")
    expect(teamScreenSource).toContain('maxLength={20}')
  })
})
