import BannerHero from '../components/BannerHero'
import type { CurrentGachaDto, GachaHistoryDto, GachaPullDto } from '../api/types'

function InvocationScreen({ gacha, onSetTarget, onPull, pendingPullCount, onPresentationDisclosed, onGetHistory }: { gacha: CurrentGachaDto; onSetTarget: (id: string) => Promise<void>; onPull: (count: 1 | 10) => Promise<GachaPullDto>; pendingPullCount: 1 | 10 | null; onPresentationDisclosed: (operationId: string) => void; onGetHistory: (page: number) => Promise<GachaHistoryDto> }) {
  return (
    <div className="screen-content invocation-screen">
      <BannerHero showDetails gacha={gacha} onSetTarget={onSetTarget} onPull={onPull} pendingPullCount={pendingPullCount} onPresentationDisclosed={onPresentationDisclosed} onGetHistory={onGetHistory} />
    </div>
  )
}

export default InvocationScreen
