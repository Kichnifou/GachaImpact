// @vitest-environment happy-dom
/// <reference types="node" />

import { act } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GachaPullDto, GachaPullResultItemDto } from '../api/types'
import type { InvocationSequenceState } from '../gacha/invocation-sequence'
import InvocationSequence from './InvocationSequence'

const appCss = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8')

const playerState = { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: 'target', totalPulls: '1', totalFiveStars: '1', totalFourStars: '0', fiftyFiftyWon: '1', fiftyFiftyLost: '0', capturesTriggered: '0' }
const characterResult: GachaPullResultItemDto = { index: 1, resultType: 'character', character: { id: 'furina', externalKey: 'furina', name: 'Furina', rarity: 5, elementKey: 'hydro', weaponType: null, region: null, classKey: null, iconPath: '/icon.png', splashPath: '/splash.png', wishPath: null, fullbodyPath: null }, rarity: 5, resourceKey: null, resourceAmount: null, wasNewCharacter: true, constellationAfter: 0, copiesAfter: 1, wasFiftyFifty: true, wonFiftyFifty: true, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null, passiveEffects: [{ elementKey: 'cryo', type: 'xp', amount: '1', xpAfter: '30', levelsReached: [1], overflowRewardsGranted: 0 }] }
const resourceResult: GachaPullResultItemDto = { ...characterResult, resultType: 'resource', character: null, rarity: null, resourceKey: 'moras', resourceAmount: '5000', wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null }
const pull = (count: 1 | 10, results: readonly GachaPullResultItemDto[]): GachaPullDto => ({ operation: { id: `operation-${count}`, pullCount: count, primogemCost: count === 1 ? '160' : '1600', createdAt: '2026-09-07T10:00:00Z', alreadyProcessed: false }, results, playerState })

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => vi.useRealTimers())

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

  it('starts an x10 character reveal in full-bleed Focus without sequence controls', () => {
    const state: Exclude<InvocationSequenceState, { phase: 'idle' }> = { phase: 'reveal', count: 10, idempotencyKey: 'x10-focus', pull: pull(10, [characterResult]), bestRarity: 5, resultIndex: 0 }
    const html = renderToStaticMarkup(<InvocationSequence state={state} onAdvance={vi.fn()} onSkip={vi.fn()} onClose={vi.fn()} />)

    expect(html).toContain('character-reveal-focus')
    expect(html).toContain('src="/splash.png"')
    expect(html).toContain('Nouveau')
    expect(html).not.toContain('Résultat 1 / 1')
    expect(html).not.toContain('Cliquez pour continuer')
    expect(html).not.toContain('>Passer<')
    expect(html).not.toContain('Fermer les résultats')
    expect(html).not.toContain('role="button"')
    expect(html).toContain('character-reveal-focus')
    expect(html).toContain('pull-passive-effects')
  })

  it('starts an x1 character reveal in Focus without its close control', () => {
    const state: Exclude<InvocationSequenceState, { phase: 'idle' }> = { phase: 'reveal', count: 1, idempotencyKey: 'x1-focus', pull: pull(1, [characterResult]), bestRarity: 5, resultIndex: 0 }
    const html = renderToStaticMarkup(<InvocationSequence state={state} onAdvance={vi.fn()} onSkip={vi.fn()} onClose={vi.fn()} />)

    expect(html).toContain('character-reveal-focus')
    expect(html).not.toContain('Fermer les résultats')
    expect(html).not.toContain('Cliquez pour continuer')
  })

  it('keeps resource reveal controls immediately available', () => {
    const state: Exclude<InvocationSequenceState, { phase: 'idle' }> = { phase: 'reveal', count: 10, idempotencyKey: 'resource', pull: pull(10, [resourceResult]), bestRarity: 3, resultIndex: 0 }
    const html = renderToStaticMarkup(<InvocationSequence state={state} onAdvance={vi.fn()} onSkip={vi.fn()} onClose={vi.fn()} />)

    expect(html).not.toContain('character-reveal-focus')
    expect(html).toContain('Résultat 1 / 1')
    expect(html).toContain('Cliquez pour continuer')
    expect(html).toContain('>Passer<')
    expect(html).toContain('role="button"')
  })

  it('reveals a C6 stat feedback only after the character Focus phase', () => {
    vi.useFakeTimers()
    const c6Result: GachaPullResultItemDto = { ...characterResult, c6Progression: { type: 'stat', stat: 'charisma', valueAfter: 4 } }
    const state: Exclude<InvocationSequenceState, { phase: 'idle' }> = { phase: 'reveal', count: 1, idempotencyKey: 'c6-stat', pull: pull(1, [c6Result]), bestRarity: 5, resultIndex: 0 }
    const container = document.createElement('div')
    const root = createRoot(container)

    act(() => root.render(<InvocationSequence state={state} onAdvance={vi.fn()} onSkip={vi.fn()} onClose={vi.fn()} />))
    expect(container.textContent).not.toContain('Charisme +1')

    act(() => vi.runAllTimers())
    const feedback = container.querySelector('.reveal-c6-stat-feedback')
    expect(feedback?.textContent).toBe('Charisme +1')
    expect(feedback?.classList.contains('reveal-overlay-control')).toBe(true)

    act(() => root.unmount())
  })

  it('does not render a C6 stat overlay when the result has no stat progression', () => {
    const state: Exclude<InvocationSequenceState, { phase: 'idle' }> = { phase: 'reveal', count: 1, idempotencyKey: 'no-c6-stat', pull: pull(1, [characterResult]), bestRarity: 5, resultIndex: 0 }
    const html = renderToStaticMarkup(<InvocationSequence state={state} onAdvance={vi.fn()} onSkip={vi.fn()} onClose={vi.fn()} />)
    expect(html).not.toContain('reveal-c6-stat-feedback')
  })

  it('keeps the C6 glow stationary and disables it for reduced motion', () => {
    const glow = appCss.match(/@keyframes c6-stat-glow\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(glow).toContain('box-shadow')
    expect(glow).not.toMatch(/transform|translate|scale/)
    expect(appCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.reveal-c6-stat-feedback \{ animation: none !important; \}/)
    expect(appCss).toMatch(/\.character-reveal \.reveal-c6-stat-feedback\s*\{[\s\S]*?bottom: 80px;/)
  })

})
