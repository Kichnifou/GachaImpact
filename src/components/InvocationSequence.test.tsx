import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { InvocationSequenceState } from '../gacha/invocation-sequence'
import InvocationSequence from './InvocationSequence'

describe('InvocationSequence player-facing copy', () => {
  it('uses immersive waiting copy without exposing implementation details', () => {
    const state: Exclude<InvocationSequenceState, { phase: 'idle' }> = {
      phase: 'submitting',
      count: 1,
      idempotencyKey: 'intent',
    }
    const html = renderToStaticMarkup(<InvocationSequence state={state} onAdvance={vi.fn()} onSkip={vi.fn()} onClose={vi.fn()} />)

    expect(html).toContain('Les astres se rassemblent')
    expect(html).toContain('Le destin se met en mouvement')
    expect(html).not.toMatch(/serveur|backend|API|sauvegarde|idempotence/i)
  })
})
