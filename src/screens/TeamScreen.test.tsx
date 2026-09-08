import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { PlayerTeamDto, PlayerTeamsDto, TeamCharacterDto } from '../api/types'
import { filterTeamCharacters } from '../team/team-presentation'
import TeamScreen, { CharacterSelector } from './TeamScreen'
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

const teams = (count: number): PlayerTeamsDto => ({
  teams: Array.from({ length: 10 }, (_, index) => team(index + 1, index === 0 ? count : 0)),
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
  onLoad: vi.fn(async () => teams(4)),
  onActivate: vi.fn(async () => teams(4)),
  onSetSlot: vi.fn(async () => teams(4)),
  onRemoveSlot: vi.fn(async () => teams(3)),
  onClear: vi.fn(async () => teams(0)),
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
})
