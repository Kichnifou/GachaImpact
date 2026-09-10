import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import ModerationScreen from './ModerationScreen'

describe('ModerationScreen', () => {
  it('offers only compact self-test sections without another-player targeting', () => {
    const html = renderToStaticMarkup(<ModerationScreen onLoad={vi.fn()} onResource={vi.fn()} onXp={vi.fn()} onGacha={vi.fn()} onStella={vi.fn()} onApplied={vi.fn()} />)
    for (const label of ['Ressources', 'Progression', 'Gacha', 'Objets', 'Préparer prochain niveau']) expect(html).toContain(label)
    expect(html).not.toContain('targetPlayerId')
    expect(html).not.toContain('Joueur cible')
  })
})
