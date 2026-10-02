import BannerHero from '../components/BannerHero'
import type { ReactNode } from 'react'
import type { CurrentGachaDto } from '../api/types'
import type { ScreenId } from '../types'

type HomeScreenProps = {
  dailySummary?: ReactNode
  onNavigate: (screen: ScreenId) => void
  gacha: CurrentGachaDto
  onSetGachaTarget: (id: string) => Promise<void>
}

function HomeScreen({ onNavigate, gacha, onSetGachaTarget, dailySummary }: HomeScreenProps) {
  return (
    <div data-tutorial-anchor="home" className="screen-content home-screen">
      <BannerHero compact gacha={gacha} onSetTarget={onSetGachaTarget} onOpen={() => onNavigate('invocation')} />

      {dailySummary}
    </div>
  )
}

export default HomeScreen
