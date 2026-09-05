import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TeamScreen from './TeamScreen'

describe('TeamScreen character cards', () => {
  it('keeps four compact actionable cards with the shared character hierarchy', () => {
    const html = renderToStaticMarkup(<TeamScreen />)

    expect((html.match(/class="large-team-card /g) ?? [])).toHaveLength(4)
    expect((html.match(/class="large-element character-element-badge"/g) ?? [])).toHaveLength(4)
    expect((html.match(/class="team-slot-number"/g) ?? [])).toHaveLength(4)
    expect((html.match(/class="character-display-meta"/g) ?? [])).toHaveLength(4)
    expect(html).toContain('Équipe 1')
    expect(html).toContain('Équipe principale')
    expect(html).toContain('Équipe active')
    expect(html).toContain('Furina')
    expect(html).toContain('★★★★★')
    expect(html).toContain('Niveau 90')
    expect(html).toContain('C1')
    expect(html).not.toContain('Cryo · Dégâts')
    expect(html).not.toContain('Hydro · Soutien')
    expect((html.match(/>Fiche</g) ?? [])).toHaveLength(4)
    expect((html.match(/>Changer</g) ?? [])).toHaveLength(4)
    expect((html.match(/>Retirer</g) ?? [])).toHaveLength(4)
  })
})
