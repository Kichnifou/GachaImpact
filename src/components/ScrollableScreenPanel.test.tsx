import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import boxSource from '../screens/BoxScreen.tsx?raw'
import charactersSource from '../screens/CharactersScreen.tsx?raw'
import moderationSource from '../screens/ModerationScreen.tsx?raw'
import ScrollableScreenPanel from './ScrollableScreenPanel'

const cssSource = readFileSync(new URL('../App.css', import.meta.url), 'utf8')

describe('long screen and elemental visual patterns', () => {
  it('uses one reusable framed internal-scroll panel on Moderation, Box and Characters', () => {
    expect(renderToStaticMarkup(<ScrollableScreenPanel><span>Contenu</span></ScrollableScreenPanel>)).toContain('panel scrollable-screen-panel')
    for (const source of [moderationSource, boxSource, charactersSource]) {
      expect(source).toContain('ScrollableScreenPanel')
      expect(source).toContain('long-screen-layout')
    }
    expect(cssSource).toContain('.scrollable-screen-panel-content')
    expect(cssSource).toContain('overflow-y: auto')
    expect(cssSource).toContain('@media (max-width: 1120px)')
  })

  it('defines a coherent inventory border color for all seven canonical elements', () => {
    for (const element of ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro']) expect(cssSource).toContain(`.item-icon.${element}`)
    expect(cssSource).toContain('background: color-mix(in srgb, currentColor 10%, transparent)')
  })

  it('keeps the shared detail base tall and fills its artwork without distortion', () => {
    expect(cssSource).toMatch(/\.box-detail-content \{ min-height: 370px;/)
    expect(cssSource).toContain('object-fit: cover')
    expect(cssSource).toContain('transform: scale(1.035)')
  })
})
