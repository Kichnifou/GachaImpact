import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GachaCharacterDto } from '../api/types'
import CharactersScreen from './CharactersScreen'

const character: GachaCharacterDto = {
  id: 'catalog', externalKey: 'legacy:catalog', name: 'Catalog', rarity: 5,
  elementKey: 'hydro', weaponType: 'Épée', region: 'Fontaine', classKey: null,
  iconPath: '/icon.png', splashPath: '/splash.png', wishPath: '/wish.png', fullbodyPath: '/fullbody.png',
}

describe('CharactersScreen catalog cards', () => {
  it('keeps catalog metadata while using the shared responsive portrait primitive', () => {
    const html = renderToStaticMarkup(<CharactersScreen characters={[character]} />)

    expect(html).toContain('Épée · Fontaine')
    expect(html).toContain('character-portrait-frame')
    expect(html).toContain('character-portrait-image')
    expect(html).toContain('character-portrait-badge')
    expect(html).not.toContain('character-card-meta')
    expect(html).not.toContain('Niv.')
    expect(html).not.toMatch(/>C\d+</)
  })
})
