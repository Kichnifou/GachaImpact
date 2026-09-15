import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./App.css', import.meta.url), 'utf8')

describe('shared application scrollbar theme', () => {
  it('themes every scroll owner while preserving intentionally hidden navigation strips', () => {
    expect(css).toMatch(/:where\(#root, #root \*\) \{[\s\S]*?scrollbar-color: var\(--scrollbar-thumb\) var\(--scrollbar-track\)/)
    expect(css).toMatch(/:where\(#root, #root \*\)::\-webkit-scrollbar-track \{[\s\S]*?background: var\(--scrollbar-track\)/)
    expect(css).toMatch(/:where\(#root, #root \*\)::\-webkit-scrollbar-thumb \{[\s\S]*?background: var\(--scrollbar-thumb\)/)
    expect(css).toMatch(/\.secondary-navigation::\-webkit-scrollbar,[\s\S]*?\.configuration-tabs::\-webkit-scrollbar \{ display: none; \}/)
    expect(css).toMatch(/\.gift-code-list-modal-body \{[^}]*overflow-y: auto/)
    expect(css).toMatch(/\.probability-panel \{[^}]*overflow: auto/)
  })
})
