import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import WheelCard from './WheelCard'
import type { WheelTodayDto } from '../api/types'

describe('compact daily Wheel card', () => {
  it('restores the historical result on a new mount without celebrating or spinning', () => {
    const onSpin = vi.fn()
    const today: WheelTodayDto = {
      spun: true,
      businessDate: '2026-09-05',
      result: { resultType: 'particles', resourceKey: 'particles_cryo', amount: '500' },
    }

    const markup = renderToStaticMarkup(createElement(WheelCard, { today, onSpin }))

    expect(markup).toContain('Déjà utilisée aujourd’hui')
    expect(markup).toContain('+500 particules Cryo')
    expect(markup).not.toContain('Félicitations')
    expect(markup).not.toContain('Tourner la Roue')
    expect(onSpin).not.toHaveBeenCalled()
  })

  it('offers the compact shortcut without spinning on mount', () => {
    const onSpin = vi.fn()
    const today: WheelTodayDto = { spun: false, businessDate: '2026-09-05', result: null }

    const markup = renderToStaticMarkup(createElement(WheelCard, { today, onSpin }))

    expect(markup).toContain('Tourner la Roue')
    expect(markup).not.toContain('Déjà utilisée')
    expect(onSpin).not.toHaveBeenCalled()
  })
})
