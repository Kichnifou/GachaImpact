import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import BannerHero from '../components/BannerHero'
import type { CurrentGachaDto } from '../api/types'
import HomeScreen from './HomeScreen'

const gacha = {
  banner: { id: 'banner', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-08T00:00:00Z', featuredFiveStars: [], featuredFourStars: [] },
  playerState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' },
} satisfies CurrentGachaDto

describe('HomeScreen Invocation preview', () => {
  it('delegates the whole compact preview to Invocation navigation', () => {
    const onNavigate = vi.fn()
    const onSetGachaTarget = vi.fn()
    const tree = HomeScreen({
      onNavigate,
      wheelToday: { spun: false, businessDate: '2026-09-06', result: null },
      onSpinWheel: vi.fn(),
      gacha,
      onSetGachaTarget,
    })
    const banner = (tree.props.children as ReactElement<{ compact: boolean; onOpen: () => void }>[])[0]

    expect(banner.type).toBe(BannerHero)
    expect(banner.props.compact).toBe(true)
    banner.props.onOpen()
    expect(onNavigate).toHaveBeenCalledWith('invocation')
    expect(onSetGachaTarget).not.toHaveBeenCalled()
  })
})
