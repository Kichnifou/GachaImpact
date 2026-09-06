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
      iconPath: '/icon/catalog.png', splashPath: null, wishPath: null, fullbodyPath: null,
    }
    const html = renderToStaticMarkup(<CharacterCard character={catalog} />)

    expect(html).toContain('Épée · Fontaine')
    expect(html).toContain('character-portrait-frame')
    expect(html).toContain('character-portrait-image')
    expect(html).toContain('src="/icon/catalog.png"')
    expect(html).toContain('character-portrait-badge')
    expect(html).not.toContain('character-card-meta')
    expect(html).not.toContain('Niv.')
    expect(html).not.toMatch(/>C\d+</)
  })

})
