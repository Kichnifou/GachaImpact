// @vitest-environment happy-dom

import { act, useState, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PlayerTeamDto, PlayerTeamsDto, TeamCharacterDto } from '../api/types'
import { canOpenNextTeamPage, filterTeamCharacters, insertTeamOrder, swapTeamOrder, swapTeamSlots, teamPageForPosition } from '../team/team-presentation'
import TeamScreen, { CharacterSelector, TeamPassiveReferenceModal } from './TeamScreen'
import teamScreenSource from './TeamScreen.tsx?raw'
import { TutorialPresentationContext } from '../tutorial/tutorial-presentation'
import { getTutorialStep } from '../tutorial/tutorial-catalog'
import { ApiError } from '../api/game-api'
import { compositionIds, pinOpeningCharacters, toggleComposition } from '../team/quick-composition'


it('anchors the full passive reference and highlights only the real guided formation', () => {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); mountedRoots.push(root)
  act(() => root.render(<TutorialPresentationContext.Provider value={{ active: true, step: getTutorialStep('team-passives') }}><TeamScreen teams={teams(4)} {...callbacks} /></TutorialPresentationContext.Provider>))
  const target = container.querySelector('[data-tutorial-anchor="team-passives"]')!
  expect(target.classList.contains('team-passive-modal')).toBe(true)
  expect(target.querySelectorAll('.team-passive-reference article')).toHaveLength(7)
  expect(target.querySelectorAll('h2[data-tutorial-anchor]')).toHaveLength(0)
  expect(target.querySelectorAll('.active-passive')).toHaveLength(1)
  expect(target.querySelector('.active-passive')?.textContent).toContain('Hydro · Actif II')
  expect(container.querySelector('[data-tutorial-anchor="team-management"]')?.textContent).toBe('Vider')
})

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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
    return <TeamScreen {...callbacks} {...overrides} teams={snapshot} onLoad={overrides.onLoad ?? loadForever} onReorderTeams={applyTeamReorder} onReorderSlots={applySlotReorder} />
  }

  act(() => root.render(<Harness />))
  return container
}

function buttonByLabel(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.getAttribute('aria-label') === label)
  if (!button) throw new Error(`Button not found: ${label}`)
  return button
}

function quickButton(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll('button')).find(button => button.textContent === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

function quickCard(container: HTMLElement, name: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('.selector-character-grid button')).find(button => button.querySelector('h3')?.textContent === name)
  if (!button) throw new Error(`Card not found: ${name}`)
  return button
}

describe('quick composition', () => {
  it('preserves holes, pins opening characters outside filters and keeps their order after deselection', () => {
    const partial = { ...team(1), slots: [{ position: 1 as const, character: null }, { position: 2 as const, character: catalog[2]! }, { position: 3 as const, character: null }, { position: 4 as const, character: catalog[0]! }] }
    const ids = compositionIds(partial)
    expect(ids).toEqual([null, 'keqing', null, 'furina'])
    expect(toggleComposition(ids, 'emilie')).toEqual(['emilie', 'keqing', null, 'furina'])
    expect(toggleComposition(ids, 'keqing')).toEqual([null, null, null, 'furina'])
    const opening = partial.slots.flatMap(slot => slot.character ? [slot.character] : [])
    expect(pinOpeningCharacters(opening, [catalog[1]!, catalog[0]!]).map(character => character.id)).toEqual(['keqing', 'furina', 'emilie'])
    expect(toggleComposition(['furina', 'keqing', 'emilie', 'hutao'], 'fifth')).toEqual(['furina', 'keqing', 'emilie', 'hutao'])
  })

  it('abandons local selections and submits no mutation for an unchanged confirmation', async () => {
    const replace = vi.fn(async () => teams(2))
    const container = mountTeamScreen(teams(2), { onReplaceComposition: replace })
    act(() => quickButton(container, 'Composition rapide').click())
    expect(container.querySelectorAll('.quick-composition-position')).toHaveLength(2)
    act(() => quickCard(container, 'Keqing').click())
    expect(container.querySelector('.quick-composition-summary')?.textContent).toContain('3/4')
    expect(replace).not.toHaveBeenCalled()
    act(() => quickButton(container, 'Annuler').click())
    act(() => quickButton(container, 'Composition rapide').click())
    expect(container.querySelector('.quick-composition-summary')?.textContent).toContain('2/4')
    await act(async () => quickButton(container, 'Confirmer').click())
    expect(replace).not.toHaveBeenCalled()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('keeps the opening members pinned outside an element filter even after deselection', () => {
    const container = mountTeamScreen(teams(2), { onReplaceComposition: vi.fn() })
    act(() => quickButton(container, 'Composition rapide').click())
    const filter = container.querySelector<HTMLSelectElement>('.team-selector-filters select')!
    act(() => { filter.value = 'pyro'; filter.dispatchEvent(new Event('change', { bubbles: true })) })
    const names = () => Array.from(container.querySelectorAll('.selector-character-grid h3')).map(node => node.textContent)
    expect(names()).toEqual(['Furina', 'Émilie', 'Hu Tao'])
    act(() => quickCard(container, 'Furina').click())
    expect(names()).toEqual(['Furina', 'Émilie', 'Hu Tao'])
    expect(quickCard(container, 'Furina').querySelector('.quick-composition-position')).toBeNull()
    act(() => quickCard(container, 'Hu Tao').click())
    expect(names()).toEqual(['Furina', 'Émilie', 'Hu Tao'])
    expect(quickCard(container, 'Hu Tao').querySelector('.quick-composition-position')?.textContent).toBe('1')
  })

  it('fills the first free slot, refuses a fifth and permits accessible removal of filtered selections', () => {
    const initial = { ...teams(4), availableCharacters: [...catalog, character({ id: 'fifth', name: 'Fifth' })] }
    const container = mountTeamScreen(initial, { onReplaceComposition: vi.fn() })
    act(() => quickButton(container, 'Composition rapide').click())
    expect(quickCard(container, 'Fifth').disabled).toBe(true)
    act(() => buttonByLabel(container, 'Désélectionner Émilie de la place 2').click())
    expect(quickCard(container, 'Fifth').disabled).toBe(false)
    act(() => quickCard(container, 'Fifth').click())
    expect(quickCard(container, 'Fifth').querySelector('.quick-composition-position')?.textContent).toBe('2')
    expect(quickCard(container, 'Émilie').disabled).toBe(true)
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('guards double confirmation and retries an ambiguous write with the same target payload and key', async () => {
    const first = deferred<PlayerTeamsDto>()
    const replace = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(teams(1))
    const container = mountTeamScreen(teams(0), { onReplaceComposition: replace })
    act(() => teamButton(container, 2).click())
    act(() => quickButton(container, 'Composition rapide').click())
    act(() => quickCard(container, 'Keqing').click())
    act(() => { const confirm = quickButton(container, 'Confirmer'); confirm.click(); confirm.click() })
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace.mock.calls[0]!.slice(0, 3)).toEqual([team(2).id, ['keqing', null, null, null], [null, null, null, null]])
    await act(async () => first.reject(new Error('network lost')))
    expect(quickCard(container, 'Furina').disabled).toBe(true)
    expect(quickButton(container, 'Annuler').disabled).toBe(true)
    await act(async () => quickButton(container, 'Réessayer la confirmation').click())
    expect(replace.mock.calls[1]).toEqual(replace.mock.calls[0])
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('keeps the draft on conflict and rebases only after an explicit authoritative reload', async () => {
    const replace = vi.fn().mockRejectedValueOnce(new ApiError('TEAM_COMPOSITION_CHANGED', 'Composition modifiée', 409)).mockResolvedValueOnce(teams(1))
    const initialLoad = deferred<PlayerTeamsDto>()
    const onLoad = vi.fn().mockReturnValueOnce(initialLoad.promise).mockResolvedValueOnce(teams(1))
    const container = mountTeamScreen(teams(0), { onReplaceComposition: replace, onLoad })
    act(() => quickButton(container, 'Composition rapide').click())
    act(() => quickCard(container, 'Keqing').click())
    await act(async () => quickButton(container, 'Confirmer').click())
    expect(container.querySelector('.quick-composition-summary')?.textContent).toContain('Keqing')
    expect(quickButton(container, 'Confirmer').disabled).toBe(true)
    await act(async () => quickButton(container, 'Recharger la Team et conserver le brouillon').click())
    expect(container.querySelector('.quick-composition-summary')?.textContent).toContain('Keqing')
    expect(container.textContent).toContain('Furina')
    await act(async () => quickButton(container, 'Confirmer').click())
    expect(replace.mock.calls[1]!.slice(0, 3)).toEqual([team(1).id, ['keqing', null, null, null], ['furina', null, null, null]])
    expect(replace.mock.calls[0]![3]).not.toEqual(replace.mock.calls[1]![3])
  })

  it('does not apply a late response to a newly selected Team or a replacement mounted screen', async () => {
    const flight = deferred<PlayerTeamsDto>()
    const replace = vi.fn<NonNullable<TeamScreenProps['onReplaceComposition']>>(() => flight.promise)
    const container = mountTeamScreen(teams(0), { onReplaceComposition: replace })
    act(() => quickButton(container, 'Composition rapide').click())
    act(() => quickCard(container, 'Furina').click())
    act(() => quickButton(container, 'Confirmer').click())
    // Programmatic selection models an external navigation while the write is in flight.
    act(() => teamButton(container, 2).click())
    expect(replace.mock.calls[0]![0]).toBe(team(1).id)
    act(() => mountedRoots.pop()!.unmount())
    const replacement = mountTeamScreen(teams(0), { onReplaceComposition: vi.fn() })
    act(() => quickButton(replacement, 'Composition rapide').click())
    act(() => quickCard(replacement, 'Keqing').click())
    await act(async () => flight.resolve(teams(1)))
    expect(replacement.querySelector('.quick-composition-summary')?.textContent).toContain('Keqing')
    expect(replacement.querySelector('[role="dialog"]')).not.toBeNull()
  })
})

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
  it.each([1, 2, 3, 4])('reserves the four-effect footprint from the real reference without exposing extra active effects (%i)', count => {
    const snapshot = teams(4)
    const references = snapshot.passiveReference.map(passive => passive.elementKey === 'dendro'
      ? { ...passive, levelOne: '1 chance sur 25 : 40 Primos, 1 000 Moras et 5 particules de chaque élément', levelTwo: '1 chance sur 15 : 40 Primos, 1 000 Moras et 5 particules de chaque élément' }
      : passive)
    const formation = { ...snapshot.teams[0]!, passives: references.slice(0, count).map(passive => ({ ...passive, stacks: 1 as const, description: passive.levelOne })) }
    const container = mountTeamScreen({ ...snapshot, passiveReference: references, teams: [formation, ...snapshot.teams.slice(1)] })
    const sizing = container.querySelectorAll('.team-passive-layout-size')
    expect(sizing).toHaveLength(4)
    const reserve = container.querySelector('.team-passive-reserve')!
    expect(reserve.getAttribute('aria-hidden')).toBe('true')
    expect(reserve.hasAttribute('inert')).toBe(true)
    for (const reference of sizing) {
      expect(reference.querySelector('button')).toBeNull()
    }
    expect(sizing[3]!.textContent).toContain('Dendro I — 1 chance sur 25 : 40 Primos, 1 000 Moras')
    expect(container.querySelectorAll('.bonus-grid article')).toHaveLength(count)
  })

  it('opens the selected possession from a native surface without nested buttons', () => {
    const container = mountTeamScreen(teams(4), { onLoadBox: () => new Promise(() => undefined) })
    const surface = buttonByLabel(container, 'Ouvrir la fiche de Émilie')
    expect(surface.tagName).toBe('BUTTON')
    expect(surface.querySelector('button')).toBeNull()
    expect(container.querySelectorAll('button button')).toHaveLength(0)
    act(() => surface.click())
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Ouverture de la fiche')
  })

  it('keeps selection, removal and movement separate from the detail surface', async () => {
    const remove = vi.fn(async () => teams(3)), move = vi.fn(async () => teams(4))
    const container = mountTeamScreen(teams(4), { onRemoveSlot: remove, onReorderSlots: move })
    const actions = container.querySelector('.team-card-actions')!
    await act(async () => (actions.querySelector('.danger-action') as HTMLButtonElement).click())
    expect(remove).toHaveBeenCalledExactlyOnceWith(teams(4).teams[0]!.id, 1)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    await act(async () => buttonByLabel(container, 'Déplacer Furina vers la droite').click())
    expect(move).toHaveBeenCalledOnce()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    act(() => (actions.querySelector('.team-card-primary-actions button') as HTMLButtonElement).click())
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Choisir un personnage')
    expect(container.textContent).not.toContain('Ouverture de la fiche')
  })

  it('suppresses the click following a drag and permits the next pointer activation', () => {
    const container = mountTeamScreen(teams(4), { onLoadBox: () => new Promise(() => undefined) })
    const wrapper = container.querySelector<HTMLElement>('.team-slot-drag-wrapper')!
    const surface = container.querySelector<HTMLButtonElement>('.team-detail-surface')!
    act(() => startDrag(wrapper))
    act(() => wrapper.dispatchEvent(new DragEvent('dragend', { bubbles: true })))
    act(() => surface.click())
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    act(() => surface.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
    act(() => surface.click())
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('opens the same passive reference from the heading link', () => {
    const container = mountTeamScreen(teams(4))
    const link = container.querySelector<HTMLButtonElement>('.section-heading .team-reference-toggle')!
    expect(link.textContent).toBe('Voir les passifs →')
    act(() => link.click())
    expect(container.querySelector('.team-passive-modal h2')?.textContent).toBe('Les sept passifs')
  })
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
    expect((html.match(/<article class="[^"]*character-showcase-team/g) ?? [])).toHaveLength(count)
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
    expect(html).toMatch(/team-card-primary-actions"><button[^>]*>Changer<\/button><button[^>]*>Retirer<\/button>/)
    expect(html).toMatch(/team-card-move-actions"><button[^>]*disabled=""[^>]*>←<\/button><button[^>]*>→<\/button>/)
  })

  it('uses native disabled movement controls and never exposes the former loading cursor', () => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(4)} {...callbacks} />)
    expect(html).toContain('aria-label="Déplacer Furina vers la gauche" disabled=""')
    expect(html).not.toMatch(/aria-label="Déplacer Furina vers la gauche"[^>]*cursor:wait/)
  })

  it('shows derived passives without a secondary status label', () => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(4)} {...callbacks} />)
    expect(html).toContain('Hydro II')
    expect(html).not.toContain('>Team active<')
    expect(html).not.toContain('>Aperçu<')
    expect(html).not.toContain('Actifs pour le gameplay')
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

  it('keeps the selector header and footer outside its grid scroll and supports keyboard focus/close', () => {
    const previous = document.createElement('button'); document.body.append(previous); previous.focus()
    const container = document.createElement('div'); document.body.append(container)
    const root = createRoot(container); mountedRoots.push(root)
    const onClose = vi.fn(), onConfirm = vi.fn(), onSelect = vi.fn()
    const props = { team: team(1, 1), characters: catalog, presentIds: new Set<string>(), search: '', elementFilter: 'all' as const, selectedId: 'keqing', pending: false, onSearch: vi.fn(), onElement: vi.fn(), onSelect, onClose, onConfirm }
    act(() => root.render(<CharacterSelector {...props} />))
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!, scroll = dialog.querySelector('.selector-character-scroll')!
    expect(scroll.querySelector('.selector-character-grid')).not.toBeNull()
    expect(scroll.querySelector('.team-selector-filters, .selector-footer, .floating-panel-heading')).toBeNull()
    expect(document.activeElement).toBe(dialog.querySelector('input[type="search"]'))
    const confirm = dialog.querySelector<HTMLButtonElement>('.selector-footer button')!, close = dialog.querySelector<HTMLButtonElement>('[aria-label="Fermer"]')!
    act(() => { confirm.focus(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })) })
    expect(document.activeElement).toBe(close)
    act(() => { close.focus(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })) })
    expect(document.activeElement).toBe(confirm)
    act(() => confirm.click()); expect(onConfirm).toHaveBeenCalledOnce()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))); expect(onClose).toHaveBeenCalledOnce()
    act(() => root.render(<CharacterSelector {...props} pending />))
    expect(confirm.disabled).toBe(true); expect(close.disabled).toBe(true)
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))); expect(onClose).toHaveBeenCalledOnce()
    act(() => root.render(null)); expect(document.activeElement).toBe(previous)
  })

  it('renders a clean unavailable state and mutation errors are player-facing', () => {
    expect(renderToStaticMarkup(<TeamScreen teams={{ teams: [], availableCharacters: [], passiveReference: [] }} {...callbacks} />)).toContain('Aucune équipe disponible')
    expect(teamScreenSource).toContain('setError(apiErrorMessage(reason))')
    expect(teamScreenSource).toContain('role="alert"')
  })

  it('keeps empty slots full-card actionable without the old permanent empty copy', () => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(0)} {...callbacks} />)
    expect((html.match(/<button[^>]*class="large-team-card empty-team-card[^"]*"/g) ?? [])).toHaveLength(4)
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

  it('places the passive reference in the heading, before the adaptive effects grid', () => {
    const html = renderToStaticMarkup(<TeamScreen teams={teams(4)} {...callbacks} />)
    expect(html.indexOf('class="team-reference-toggle"')).toBeGreaterThan(html.indexOf('class="section-heading"'))
    expect(html.indexOf('class="team-reference-toggle"')).toBeLessThan(html.indexOf('class="bonus-grid'))

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
    expect(html).toContain('>Voir les passifs \u2192<')
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
