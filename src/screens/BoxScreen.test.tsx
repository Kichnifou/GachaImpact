import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { characters } from '../data/mockData'
import BoxScreen from './BoxScreen'

describe('BoxScreen owned character cards', () => {
  it('uses level and constellation without owned-character roles', () => {
    const html = renderToStaticMarkup(<BoxScreen />)
    const owned = characters.filter((character) => character.owned)

    expect((html.match(/character-card-meta/g) ?? [])).toHaveLength(owned.length)
    for (const character of owned) {
      expect(html).toContain(`Niv. ${character.level}`)
      expect(html).toContain(`C${character.constellation}`)
      expect(html).not.toContain(character.role)
    }
  })
})
