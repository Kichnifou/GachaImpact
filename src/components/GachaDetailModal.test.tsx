import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import GachaDetailModal from './GachaDetailModal'

describe('GachaDetailModal', () => {
  it('renders as an internal overlay with accessible tabs and close control', () => {
    const html = renderToStaticMarkup(<GachaDetailModal onClose={vi.fn()} onGetHistory={vi.fn()} />)
    expect(html).toContain('gacha-detail-overlay')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('>Historique<')
    expect(html).toContain('>Probabilités<')
    expect(html).toContain('>Passifs<')
    expect(html).toContain('aria-label="Fermer le détail"')
    expect(html).toContain('Chargement de l’historique')
  })
})
