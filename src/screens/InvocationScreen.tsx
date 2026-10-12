import BannerHero from '../components/BannerHero'
import type { CurrentGachaDto, GachaHistoryDto, GachaPullDto, PlayerTeamsDto } from '../api/types'
import type { SharedInvocationController } from '../gacha/use-shared-invocations'
import { sharedGachaView, sharedSequenceView } from '../gacha/shared-invocation-presentation'
import SharedInvocationControls from '../components/SharedInvocationControls'
import SharedInvocationAudience from '../components/SharedInvocationAudience'

function InvocationScreen({ gacha, teams, onSetTarget, onPull, pendingPullCount, onPresentationDisclosed, onGetHistory, shared, onProfile }: { gacha: CurrentGachaDto; teams: PlayerTeamsDto; onSetTarget: (id: string) => Promise<void>; onPull: (count: 1 | 10) => Promise<GachaPullDto>; pendingPullCount: 1 | 10 | null; onPresentationDisclosed: (operationId: string) => void; onGetHistory: (page: number) => Promise<GachaHistoryDto>; shared?:SharedInvocationController; onProfile?:(id:string)=>void }) {
  const watched=shared?.state.watching, own=shared?.state.broadcasting, session=watched??own
  const presented=watched??(own?.snapshot.presentation.phase!=='idle'?own:undefined)
  const readOnly=!!watched||!!own&&!own.authoritative||shared?.personalReady===false
  const pull=async(count:1|10)=>{const result=await onPull(count);await shared?.sync();return result}
  return (
    <div className={`screen-content invocation-screen${watched?.status==='PAUSED'?' shared-is-paused':''}`}>
      <BannerHero sharedOverlay={shared&&session?<SharedInvocationAudience key={session.id} shared={shared} session={session} onProfile={onProfile}/>:undefined} key={watched?.id??own?.id??'personal'} showDetails gacha={presented?sharedGachaView(presented):gacha} teams={readOnly?undefined:teams} onSetTarget={onSetTarget} onPull={readOnly?undefined:pull} pendingPullCount={readOnly?null:pendingPullCount} onPresentationDisclosed={readOnly?undefined:onPresentationDisclosed} onGetHistory={readOnly?undefined:onGetHistory} sharing={shared?(presenting)=><SharedInvocationControls shared={shared} presenting={presenting}/>:undefined} sharedSequence={session?sharedSequenceView(session):undefined} onSharedSequenceAction={own?.authoritative?(action)=>void shared?.advance(action):undefined} readOnly={readOnly}/>
      {watched?.status==='PAUSED'&&<div className="shared-invocation-paused"><strong>Diffusion en pause</strong><p>Le diffuseur a quitté l’écran Invocation.</p></div>}
    </div>
  )
}

export default InvocationScreen
