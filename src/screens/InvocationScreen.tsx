import BannerHero from '../components/BannerHero'
import type { CurrentGachaDto, GachaHistoryDto, GachaPullDto } from '../api/types'

function InvocationScreen({ gacha, onSetTarget, onPull, onGetHistory }: { gacha: CurrentGachaDto; onSetTarget: (id: string) => Promise<void>; onPull: (count: 1 | 10, idempotencyKey: string) => Promise<GachaPullDto>; onGetHistory: (page: number) => Promise<GachaHistoryDto> }) {
  return (
    <div className="screen-content invocation-screen">
      <BannerHero showDetails gacha={gacha} onSetTarget={onSetTarget} onPull={onPull} onGetHistory={onGetHistory} />
    </div>
  )
}

export default InvocationScreen
