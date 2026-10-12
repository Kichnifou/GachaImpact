import { useRef } from 'react'
import BannerHero from '../components/BannerHero'
import type { CurrentGachaDto, GachaHistoryDto, GachaPullDto, PlayerTeamsDto } from '../api/types'
import type { SharedInvocationController } from '../gacha/use-shared-invocations'
import { sharedGachaView, sharedSequenceView } from '../gacha/shared-invocation-presentation'
import SharedInvocationControls from '../components/SharedInvocationControls'
import SharedInvocationAudience, { type SharedAudienceConfirmation } from '../components/SharedInvocationAudience'

function InvocationScreen({ gacha, teams, onSetTarget, onPull, pendingPullCount, onPresentationDisclosed, onGetHistory, shared, onProfile, ownerKey }: { gacha: CurrentGachaDto; teams: PlayerTeamsDto; onSetTarget: (id: string) => Promise<void>; onPull: (count: 1 | 10) => Promise<GachaPullDto>; pendingPullCount: 1 | 10 | null; onPresentationDisclosed: (operationId: string) => void; onGetHistory: (page: number) => Promise<GachaHistoryDto>; shared?:SharedInvocationController; onProfile?:(id:string)=>void; ownerKey?:string }) {
  const watched=shared?.state.watching, own=shared?.state.broadcasting, session=watched??own
  const audienceCache=useRef<SharedAudienceConfirmation|null>(null)
  const presented=watched??(own?.snapshot.presentation.phase!=='idle'?own:undefined)
  const personalHistoryAllowed=!watched&&(!own||own.authoritative)
  const readOnly=!personalHistoryAllowed||shared?.personalReady===false||!!own?.pendingPull
  // Preserve the loaded personal idle scene across own start/stop. Other owners
  // and committed shared receipts still have distinct reset boundaries.
  const sceneKey=watched?`watch:${watched.id}`:own&&!own.authoritative?`other-tab:${own.id}`:own&&own.snapshot.presentation.phase!=='idle'?`receipt:${own.id}:${own.snapshot.presentation.pull?.operation.id}`:`personal:${ownerKey??'current'}`
  const pull=async(count:1|10)=>{const result=await onPull(count);await shared?.sync();return result}
  return (
    <div className={`screen-content invocation-screen${watched?.status==='PAUSED'?' shared-is-paused':''}`}>
      <BannerHero sharedOverlay={shared&&session?<SharedInvocationAudience cache={audienceCache} key={session.id} shared={shared} session={session} onProfile={onProfile}/>:undefined} key={sceneKey} showDetails gacha={presented?sharedGachaView(presented):gacha} teams={personalHistoryAllowed?teams:undefined} onSetTarget={onSetTarget} onPull={readOnly?undefined:pull} pendingPullCount={readOnly?null:pendingPullCount} pendingSharedPull={shared&&own?.authoritative&&own.pendingPull&&shared.personalReady!==false?{count:own.pendingPull.count,busy:shared.pending,resume:shared.resume}:undefined} onPresentationDisclosed={readOnly?undefined:onPresentationDisclosed} onGetHistory={personalHistoryAllowed?onGetHistory:undefined} sharing={shared?(presenting)=><SharedInvocationControls shared={shared} presenting={presenting}/>:undefined} sharedSequence={session?sharedSequenceView(session):undefined} onSharedSequenceAction={own?.authoritative?(action)=>void shared?.advance(action):undefined} readOnly={readOnly}/>
    </div>
  )
}

export default InvocationScreen
