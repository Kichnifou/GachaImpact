import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { getElementAssetPath, isCharacterAssetPath } from './gameAssets'

describe('element assets', () => {
  it('resolves a real icon for all seven elements used by the Boss resistance', () => {
    for (const element of ['anemo', 'geo', 'electro', 'dendro', 'hydro', 'pyro', 'cryo']) {
      const publicPath = getElementAssetPath(element)
      expect(publicPath).toBe(`/assets/genshin/elements/${element}.png`)
      expect(existsSync(resolve(process.cwd(), 'public', publicPath.slice(1)))).toBe(true)
    }
  })
})

describe('catalogue image origins', () => {
  it('retains local assets and accepts only immutable images from our dedicated bucket', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://fixture.supabase.co')
    const path = '/storage/v1/object/public/character-catalog/characters/00000000-0000-4000-8000-000000000001/icon/' + 'a'.repeat(64) + '.png'
    try {
      expect(isCharacterAssetPath('/assets/characters/keqing-icon.png')).toBe(true)
      expect(isCharacterAssetPath('https://fixture.supabase.co' + path)).toBe(true)
      for (const value of ['//evil.example/a.png', '/\\evil.example/a.png', 'https://evil.example' + path,
        'https://fixture.supabase.co' + path + '?token=fixture', 'https://fixture.supabase.co/storage/v1/object/public/other/a.png', 'data:image/png;base64,AA'])
        expect(isCharacterAssetPath(value)).toBe(false)
    } finally { vi.unstubAllEnvs() }
  })
})
