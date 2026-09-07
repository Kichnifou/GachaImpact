import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { BoxCharacterDto, PlayerBoxDto } from '../api/types'
import { initialBoxFilters, presentBoxCharacters, replaceFavorite, type BoxFilters } from '../box/box-presentation'
import BoxCharacterCard from '../components/BoxCharacterCard'
import BoxCharacterDetailModal from '../components/BoxCharacterDetailModal'
import BoxScreen, { BoxStatus, BoxView } from './BoxScreen'
import boxScreenSource from './BoxScreen.tsx?raw'

const character = (overrides: Partial<BoxCharacterDto>): BoxCharacterDto => ({
  id: 'furina', externalKey: 'legacy:20', name: 'Furina', rarity: 5, elementKey: 'hydro', weaponType: 'sword', region: 'fontaine',
  iconPath: '/furina-icon.png', splashPath: '/furina-splash.png', wishPath: '/furina-wish.png', fullbodyPath: '/furina-fullbody.png',
  constellation: 1, copies: 2, firstObtainedAt: '2026-08-15T10:30:00.000Z', favorite: false, ...overrides,
})
const records = [
  character({ id: 'five-normal', name: 'Émilie', rarity: 5, elementKey: 'dendro', constellation: 6, copies: 20, favorite: false, firstObtainedAt: '2026-08-03T00:00:00Z' }),
  character({ id: 'four-favorite', name: 'Collei', rarity: 4, elementKey: 'dendro', constellation: 0, copies: 1, favorite: true, firstObtainedAt: '2026-08-02T00:00:00Z' }),
  character({ id: 'five-favorite', name: 'Furina', rarity: 5, elementKey: 'hydro', constellation: 2, copies: 3, favorite: true, firstObtainedAt: '2026-08-01T00:00:00Z' }),
  character({ id: 'four-normal', name: 'Bennett', rarity: 4, elementKey: 'pyro', constellation: 4, copies: 5, favorite: false, firstObtainedAt: '2026-08-04T00:00:00Z' }),
]
const box: PlayerBoxDto = { characters: records, summary: { totalOwned: 4, fiveStars: 2, fourStars: 2, c6: 1 } }
const renderView = (filters: BoxFilters = initialBoxFilters, overrides: Partial<Parameters<typeof BoxView>[0]> = {}) => renderToStaticMarkup(<BoxView box={box} filters={filters} error={null} favoritePendingId={null} selected={null} onFilters={vi.fn()} onSelect={vi.fn()} onToggleFavorite={vi.fn()} onCloseDetail={vi.fn()} {...overrides} />)

describe('real personal Box', () => {
  it('does not import mockData and refreshes authoritative possessions on each mount', () => {
    expect(boxScreenSource).not.toContain("from '../data/mockData'")
    expect(boxScreenSource).toContain('await onLoadBox()')
    expect(renderToStaticMarkup(<BoxScreen onLoadBox={vi.fn()} onSetFavorite={vi.fn()} />)).toContain('Ouverture de votre Box')
  })
  it('renders API values, summary, tabs, seven elements including Dendro, and C0 through C6', () => {
    const html = renderView()
    expect(html).toContain('Émilie')
    expect(html).toContain('<strong>4</strong> obtenus')
    for (const label of ['Tous', '5★', '4★', 'Pyro', 'Hydro', 'Cryo', 'Électro', 'Anémo', 'Géo', 'Dendro']) expect(html).toContain(label)
    for (let constellation = 0; constellation <= 6; constellation += 1) expect(html).toContain(`C${constellation}`)
  })
  it('groups favorites before rarity and sorts inside each group', () => {
    expect(presentBoxCharacters(records, initialBoxFilters).map(({ id }) => id)).toEqual(['five-favorite', 'four-favorite', 'five-normal', 'four-normal'])
    expect(presentBoxCharacters(records, { ...initialBoxFilters, tab: 4 }).map(({ id }) => id)).toEqual(['four-favorite', 'four-normal'])
  })
  it('combines accent-insensitive search, rarity, element and constellation filters', () => {
    expect(presentBoxCharacters(records, { ...initialBoxFilters, search: 'emilie', tab: 5, element: 'dendro', constellation: 6 }).map(({ id }) => id)).toEqual(['five-normal'])
    expect(presentBoxCharacters(records, { ...initialBoxFilters, search: 'emilie', element: 'hydro' })).toEqual([])
  })
  it('supports all four sorts in both directions', () => {
    const unfavorited = records.map((item) => ({ ...item, favorite: false }))
    const sorted = (sort: BoxFilters['sort'], direction: BoxFilters['direction']) => presentBoxCharacters(unfavorited, { ...initialBoxFilters, sort, direction }).map(({ id }) => id)
    expect(sorted('alphabetical', 'asc')).toEqual(['five-normal', 'five-favorite', 'four-normal', 'four-favorite'])
    expect(sorted('obtainedAt', 'desc')).toEqual(['five-normal', 'five-favorite', 'four-normal', 'four-favorite'])
    expect(sorted('constellation', 'asc')).toEqual(['five-favorite', 'five-normal', 'four-favorite', 'four-normal'])
    expect(sorted('element', 'asc')).toHaveLength(4)
    expect(sorted('element', 'desc')).toHaveLength(4)
  })
  it('shows constellation but never copies on a card', () => {
    const html = renderToStaticMarkup(<BoxCharacterCard character={records[0]!} onOpen={vi.fn()} onToggleFavorite={vi.fn()} />)
    expect(html).toContain('C6')
    expect(html).not.toContain('20')
    expect(html).toContain('aria-pressed="false"')
  })
  it('shows copies, first-obtained date and favorite state in the detail sheet', () => {
    const html = renderToStaticMarkup(<BoxCharacterDetailModal character={records[0]!} favoritePending={false} onToggleFavorite={vi.fn()} onClose={vi.fn()} />)
    expect(html).toContain('Copies obtenues')
    expect(html).toContain('<dd>20</dd>')
    expect(html).toContain('3 août 2026')
    expect(html).toContain('<dt>Favori</dt><dd>Non</dd>')
  })
  it('applies an immediate immutable favorite update and reorders the Box', () => {
    const updated = replaceFavorite(records, 'four-normal', true)
    expect(updated.find(({ id }) => id === 'four-normal')?.favorite).toBe(true)
    expect(records.find(({ id }) => id === 'four-normal')?.favorite).toBe(false)
    expect(presentBoxCharacters(updated, initialBoxFilters).map(({ id }) => id)).toEqual(['five-favorite', 'four-normal', 'four-favorite', 'five-normal'])
  })
  it('renders empty, no-result, loading and exploitable error states', () => {
    expect(renderView(initialBoxFilters, { box: { characters: [], summary: { totalOwned: 0, fiveStars: 0, fourStars: 0, c6: 0 } } })).toContain('Votre Box est encore vide')
    expect(renderView({ ...initialBoxFilters, search: 'introuvable' })).toContain('Aucun personnage trouvé')
    expect(renderToStaticMarkup(<BoxStatus kind="loading" title="Chargement" detail="Patientez" />)).toContain('loading')
    const error = renderToStaticMarkup(<BoxStatus kind="error" title="Erreur" detail="Serveur indisponible" onRetry={vi.fn()} />)
    expect(error).toContain('role="alert"')
    expect(error).toContain('Réessayer')
  })
  it('starts every fresh Box on Tous with alphabetical ascending sort', () => {
    expect(initialBoxFilters).toEqual({ tab: 'all', search: '', element: 'all', constellation: 'all', sort: 'alphabetical', direction: 'asc' })
  })
})
