import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TeamScreen from './TeamScreen'

describe('TeamScreen character cards', () => {
  it('keeps all four established team cards and their element badges', () => {
    const html = renderToStaticMarkup(<TeamScreen />)

    expect((html.match(/class="large-team-card /g) ?? [])).toHaveLength(4)
    expect((html.match(/class="large-element"/g) ?? [])).toHaveLength(4)
    expect(html).toContain('Équipe active')
  })
})
