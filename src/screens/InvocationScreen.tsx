import BannerHero from '../components/BannerHero'
import type { CurrentGachaDto } from '../api/types'

function InvocationScreen({ gacha, onSetTarget }: { gacha: CurrentGachaDto; onSetTarget: (id: string) => Promise<void> }) {
  return (
    <div className="screen-content invocation-screen">
      <BannerHero showDetails gacha={gacha} onSetTarget={onSetTarget} />
    </div>
  )
}

export default InvocationScreen
