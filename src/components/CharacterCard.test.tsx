import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { GachaCharacterDto } from '../api/types'
import { characters } from '../data/mockData'
import CharacterCard from './CharacterCard'

describe('CharacterCard contexts', () => {
  it('shows separate level and constellation metadata without a role for an owned character', () => {
    const character = characters[0]!
    const html = renderToStaticMarkup(<CharacterCard character={character} compact onClick={vi.fn()} />)

    expect(html).toContain('character-card-meta')
    expect(html).toContain(`<span>Niv. ${character.level}</span>`)
    expect(html).toContain(`<span>C${character.constellation}</span>`)
    expect(html).not.toContain(character.role)
  })

  it('keeps catalog metadata and does not invent possession metadata', () => {
    const catalog: GachaCharacterDto = {
      id: 'catalog', externalKey: 'legacy:catalog', name: 'Catalog', rarity: 5,
      elementKey: 'hydro', weaponType: 'Épée', region: 'Fontaine', classKey: null,
      iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null,
    }
    const html = renderToStaticMarkup(<CharacterCard character={catalog} />)

    expect(html).toContain('Épée · Fontaine')
    expect(html).not.toContain('character-card-meta')
    expect(html).not.toContain('Niv.')
    expect(html).not.toMatch(/>C\d+</)
  })

  it('reuses the Box card family for a featured character without catalog metadata', () => {
    const catalog: GachaCharacterDto = {
      id: 'featured', externalKey: 'legacy:featured', name: 'Featured', rarity: 4,
      elementKey: 'hydro', weaponType: 'Épée', region: 'Fontaine', classKey: null,
      iconPath: '/icon/featured.png', splashPath: null, wishPath: null, fullbodyPath: '/fullbody/featured.png',
    }
    const html = renderToStaticMarkup(<CharacterCard character={catalog} variant="featured" />)

    expect(html).toContain('character-card hydro featured-four-card featured-character-card')
    expect(html).toContain('class="character-card-topline"')
    expect(html).toContain('class="character-portrait"')
    expect(html).toContain('src="/icon/featured.png"')
    expect(html).toContain('<h3>Featured</h3>')
    expect(html).toContain('★★★★')
    expect(html).not.toContain('Épée')
    expect(html).not.toContain('Fontaine')
    expect(html).not.toContain('character-card-meta')
  })
})
