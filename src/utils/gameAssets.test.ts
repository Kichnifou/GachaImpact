import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getElementAssetPath } from './gameAssets'

describe('element assets', () => {
  it('resolves a real icon for all seven elements used by the Boss resistance', () => {
    for (const element of ['anemo', 'geo', 'electro', 'dendro', 'hydro', 'pyro', 'cryo']) {
      const publicPath = getElementAssetPath(element)
      expect(publicPath).toBe(`/assets/genshin/elements/${element}.png`)
      expect(existsSync(resolve(process.cwd(), 'public', publicPath.slice(1)))).toBe(true)
    }
  })
})
