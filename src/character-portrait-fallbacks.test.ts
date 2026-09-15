import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const characterSurfaces = [
  'src/components/BannerHero.tsx',
  'src/components/BoxCharacterCard.tsx',
  'src/components/BoxCharacterDetailModal.tsx',
  'src/components/CharacterCard.tsx',
  'src/components/CombatPlayerFormation.tsx',
  'src/components/PlayerSidebar.tsx',
  'src/components/PullResults.tsx',
  'src/screens/ContestScreen.tsx',
  'src/screens/DailyCombatScreen.tsx',
  'src/screens/TeamScreen.tsx',
] as const

describe('known character portrait fallbacks', () => {
  it('never derives a textual fallback from a Player or character initial', () => {
    for (const path of characterSurfaces) {
      const source = readFileSync(path, 'utf8')
      expect(source, path).not.toMatch(/fallback=\{[^\n]*slice\(0,\s*1\)/)
      expect(source, path).not.toMatch(/combat-card-fallback[^\n]*slice\(0,\s*1\)/)
    }
  })

  it('keeps only the explicit neutral BOT fallback in Contest', () => {
    const source = readFileSync('src/screens/ContestScreen.tsx', 'utf8')
    expect(source).toContain("item.kind === 'BOT' ? <span>◆</span> : null")
    expect(source).not.toContain('item.displayName.slice(0, 1)')
  })
})
