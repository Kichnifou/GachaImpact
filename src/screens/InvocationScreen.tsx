import BannerHero from '../components/BannerHero'
import type { CurrentGachaDto, GachaHistoryDto, GachaPullDto, PlayerTeamsDto } from '../api/types'

function InvocationScreen({ gacha, teams, onSetTarget, onPull, pendingPullCount, onPresentationDisclosed, onGetHistory }: { gacha: CurrentGachaDto; teams: PlayerTeamsDto; onSetTarget: (id: string) => Promise<void>; onPull: (count: 1 | 10) => Promise<GachaPullDto>; pendingPullCount: 1 | 10 | null; onPresentationDisclosed: (operationId: string) => void; onGetHistory: (page: number) => Promise<GachaHistoryDto> }) {
  return (
    <div className="screen-content invocation-screen">
      <BannerHero showDetails gacha={gacha} teams={teams} onSetTarget={onSetTarget} onPull={onPull} pendingPullCount={pendingPullCount} onPresentationDisclosed={onPresentationDisclosed} onGetHistory={onGetHistory} />
    </div>
  )
}

export default InvocationScreen
