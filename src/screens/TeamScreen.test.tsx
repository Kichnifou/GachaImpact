import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { PlayerTeamDto, PlayerTeamsDto, TeamCharacterDto } from '../api/types'
import { canOpenNextTeamPage, filterTeamCharacters, insertTeamOrder, swapTeamOrder, swapTeamSlots, teamPageForPosition, teamPassiveStatusLabel } from '../team/team-presentation'
import TeamScreen, { CharacterSelector, TeamPassiveReferenceModal } from './TeamScreen'
import teamScreenSource from './TeamScreen.tsx?raw'


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

  it('uses a temporary visual order preview for reorders and clears it after settlement', () => {
    expect(teamScreenSource).toContain('const [teamOrderPreview, setTeamOrderPreview]')
    expect(teamScreenSource).toContain('const [slotOrderPreview, setSlotOrderPreview]')
    expect(teamScreenSource).toContain('setTeamOrderPreview(nextIds)')
    expect(teamScreenSource).toContain('setSlotOrderPreview(nextIds)')
    expect(teamScreenSource).toContain('() => setTeamOrderPreview(null)')
    expect(teamScreenSource).toContain('() => setSlotOrderPreview(null)')
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
