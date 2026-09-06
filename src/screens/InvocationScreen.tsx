import BannerHero from '../components/BannerHero'
import type { CurrentGachaDto, GachaPullDto } from '../api/types'

function InvocationScreen({ gacha, onSetTarget, onPull }: { gacha: CurrentGachaDto; onSetTarget: (id: string) => Promise<void>; onPull: (count: 1 | 10, idempotencyKey: string) => Promise<GachaPullDto> }) {
  return (
    <div className="screen-content invocation-screen">
      <BannerHero showDetails gacha={gacha} onSetTarget={onSetTarget} onPull={onPull} />
    </div>
  )
}

export default InvocationScreen
