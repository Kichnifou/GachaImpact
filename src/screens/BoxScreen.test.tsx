import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { BoxCharacterDto, PlayerBoxDto } from '../api/types'
import { initialBoxFilters, initialBoxFiltersWithPreference, presentBoxCharacters, replaceFavorite, type BoxFilters } from '../box/box-presentation'
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
const box: PlayerBoxDto = { characters: records, summary: { totalOwned: 4, fiveStars: 2, fourStars: 2, c6: 1 }, preference: { sortKey: 'alphabetical', direction: 'asc' }, stella: { quantity: '0' } }
const modalProps = { stellaQuantity: '0', favoritePending: false, stellaPending: false, stellaFeedback: null, onToggleFavorite: vi.fn(), onUseStella: vi.fn(), onClose: vi.fn() }
const renderView = (filters: BoxFilters = initialBoxFilters, overrides: Partial<Parameters<typeof BoxView>[0]> = {}) => renderToStaticMarkup(<BoxView box={box} filters={filters} error={null} favoritePendingId={null} stellaPendingId={null} stellaFeedback={null} selected={null} onFilters={vi.fn()} onSelect={vi.fn()} onToggleFavorite={vi.fn()} onUseStella={vi.fn()} onCloseDetail={vi.fn()} {...overrides} />)

describe('real personal Box', () => {
  it('does not import mockData and refreshes authoritative possessions on each mount', () => {
    expect(boxScreenSource).not.toContain("from '../data/mockData'")
    expect(boxScreenSource).toContain('await onLoadBox()')
    expect(renderToStaticMarkup(<BoxScreen initialBox={null} onLoadBox={vi.fn()} onSetFavorite={vi.fn()} onSetSortPreference={vi.fn()} onUseStella={vi.fn()} />)).toContain('Ouverture de votre Box')
    const cached = renderToStaticMarkup(<BoxScreen initialBox={box} onLoadBox={vi.fn()} onSetFavorite={vi.fn()} onSetSortPreference={vi.fn()} onUseStella={vi.fn()} />)
    expect(cached).toContain('Furina')
    expect(cached).not.toContain('Ouverture de votre Box')
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
  it('uses the requested detail hierarchy without duplicated element or constellation information', () => {
    const html = renderToStaticMarkup(<BoxCharacterDetailModal character={records[0]!} {...modalProps} />)
    const header = html.match(/<header class="floating-panel-heading">.*?<\/header>/)?.[0] ?? ''
    expect(header).toContain('Personnage possédé')
    expect(header).not.toContain('Émilie')
    expect(html).toContain('<h2 class="box-detail-character-name">Émilie</h2>')
    expect(html).toContain('<strong class="box-detail-constellation">C6</strong>')
    expect(html).toContain('★★★★★')
    expect(html).toContain('box-detail-element-icon')
    expect(html).not.toContain('>Dendro<')
    expect(html).not.toContain('<dt>Constellation</dt>')
    expect(html).toContain('Copies obtenues')
    expect(html).toContain('<dd>20</dd>')
    expect(html).toContain('3 août 2026')
    expect(html).toContain('<dt>Favori</dt><dd>Non</dd>')
    expect(html).toContain('Ajouter aux favoris')
  })
  it('prioritizes the icon in detail, falls back to an existing asset and renders no element badge', () => {
    const withIcon = renderToStaticMarkup(<BoxCharacterDetailModal character={records[0]!} {...modalProps} />)
    expect(withIcon).toContain('src="/furina-icon.png"')
    expect(withIcon).not.toContain('character-portrait-badge')
    const withoutIcon = renderToStaticMarkup(<BoxCharacterDetailModal character={{ ...records[0]!, iconPath: null }} {...modalProps} />)
    expect(withoutIcon).toContain('src="/furina-fullbody.png"')
    expect(withoutIcon).not.toContain('character-portrait-badge')
  })
  it('applies an immediate immutable favorite update and reorders the Box', () => {
    const updated = replaceFavorite(records, 'four-normal', true)
    expect(updated.find(({ id }) => id === 'four-normal')?.favorite).toBe(true)
    expect(records.find(({ id }) => id === 'four-normal')?.favorite).toBe(false)
    expect(presentBoxCharacters(updated, initialBoxFilters).map(({ id }) => id)).toEqual(['five-favorite', 'four-normal', 'four-favorite', 'five-normal'])
  })
  it('renders empty, no-result, loading and exploitable error states', () => {
    expect(renderView(initialBoxFilters, { box: { ...box, characters: [], summary: { totalOwned: 0, fiveStars: 0, fourStars: 0, c6: 0 } } })).toContain('Votre Box est encore vide')
    expect(renderView({ ...initialBoxFilters, search: 'introuvable' })).toContain('Aucun personnage trouvé')
    expect(renderToStaticMarkup(<BoxStatus kind="loading" title="Chargement" detail="Patientez" />)).toContain('loading')
    const error = renderToStaticMarkup(<BoxStatus kind="error" title="Erreur" detail="Serveur indisponible" onRetry={vi.fn()} />)
    expect(error).toContain('role="alert"')
    expect(error).toContain('Réessayer')
    expect(renderView(initialBoxFilters, { error: 'Actualisation impossible' })).toContain('box-inline-error')
  })
  it('starts every fresh Box on Tous with alphabetical ascending sort', () => {
    expect(initialBoxFilters).toEqual({ tab: 'all', search: '', element: 'all', constellation: 'all', sort: 'alphabetical', direction: 'asc' })
  })
  it('restores only the server sort while resetting tabs, search and filters', () => {
    expect(initialBoxFiltersWithPreference({ sortKey: 'obtainedAt', direction: 'desc' })).toEqual({
      tab: 'all', search: '', element: 'all', constellation: 'all', sort: 'obtainedAt', direction: 'desc',
    })
    expect(boxScreenSource).toContain('await onSetSortPreference(preference)')
    expect(boxScreenSource).toContain('Tri appliqué, mais non sauvegardé')
  })
  it('shows Stella only for five-stars, keeps zero visible and requires confirmation', () => {
    const five = renderToStaticMarkup(<BoxCharacterDetailModal character={records[0]!} {...modalProps} />)
    expect(five).toContain('Masterless Stella Fortuna × 0')
    expect(five).toContain('Utiliser une Stella')
    expect(five).toContain('disabled=""')
    const four = renderToStaticMarkup(<BoxCharacterDetailModal character={records[1]!} {...modalProps} stellaQuantity="2" />)
    expect(four).not.toContain('Masterless Stella Fortuna')
    expect(boxScreenSource).toContain('crypto.randomUUID()')
  })
})
