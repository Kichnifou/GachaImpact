import { readFileSync } from 'node:fs'

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import AppButton from './AppButton'

describe('AppButton', () => {
  it('owns its explicit variant and defaults to a non-submit button', () => {
    const html = renderToStaticMarkup(<>
      <AppButton>Secondaire</AppButton>
      <AppButton variant="primary">Primaire</AppButton>
      <AppButton variant="danger">Danger</AppButton>
      <AppButton variant="icon" aria-label="Fermer">×</AppButton>
    </>)

    expect(html).toContain('type="button" class="app-button app-button-secondary"')
    expect(html).toContain('type="button" class="app-button app-button-primary"')
    expect(html).toContain('type="button" class="app-button app-button-danger"')
    expect(html).toContain('type="button" class="app-button app-button-icon"')
  })

  it('keeps legacy parent selectors away from the shared primitive appearance', () => {
    const css = readFileSync(new URL('../App.css', import.meta.url), 'utf8')

    for (const obsoleteSelector of [
      '.contest-toolbar button',
      '.contest-inline-actions button',
      '.contest-footer-actions button {',
      '.contest-confirmation .primary-button',
      '.contest-confirmation .danger-button',
      '.gift-code-admin-form-heading button',
      '.gift-code-admin-actions button',
      '.gift-code-admin-form > .primary-button',
      '.gift-code-edit-modal header button',
      '.gift-code-claimants-modal header button',
      '.moderation-tabs .app-button:disabled',
    ]) expect(css).not.toContain(obsoleteSelector)

    expect(css).toMatch(/\.app-button-primary \{[^}]*background:/)
    expect(css).toMatch(/\.app-button-danger \{[^}]*background:/)
    expect(css).toMatch(/\.app-button-icon \{[^}]*display: inline-grid/)
  })
})
