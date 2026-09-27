// @vitest-environment happy-dom

import { readFileSync } from 'node:fs'
import { afterEach, expect, it } from 'vitest'

const globalCss = readFileSync('src/index.css', 'utf8')

afterEach(() => document.head.replaceChildren())

it('gives interactive controls a pointer and disabled controls a non-interactive cursor', () => {
  const style = document.createElement('style')
  style.textContent = `${globalCss}\n.local-pointer { cursor: pointer; }\n.local-grab { cursor: grab; }`
  document.head.append(style)

  const cases = [
    ['<button>Menu</button>', 'pointer'],
    ['<button disabled>Apparence</button>', 'not-allowed'],
    ['<a href="/history">Historique</a>', 'pointer'],
    ['<details><summary>Plus</summary></details>', 'pointer'],
    ['<div role="button">Ouvrir</div>', 'pointer'],
    ['<div role="tab">Compte</div>', 'pointer'],
    ['<div role="button" aria-disabled="true">Indisponible</div>', 'not-allowed'],
    ['<div role="tab" aria-disabled="true">Indisponible</div>', 'not-allowed'],
    ['<button class="local-pointer" disabled>Indisponible</button>', 'not-allowed'],
    ['<div class="local-pointer" role="tab" aria-disabled="true">Indisponible</div>', 'not-allowed'],
    ['<button class="local-grab">Déplacer</button>', 'grab'],
    ['<input type="text">', ''],
  ] as const

  for (const [markup, expectedCursor] of cases) {
    const host = document.createElement('div')
    host.innerHTML = markup
    const control = host.querySelector('summary, button, a, [role], input')!
    document.body.append(host)
    expect(window.getComputedStyle(control).cursor, markup).toBe(expectedCursor)
    host.remove()
  }
})
