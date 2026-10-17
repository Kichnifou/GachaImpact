import {useEffect,useRef,useState} from 'react'
import {ApiError,getGameApiClient} from '../api/game-api'
import AppButton from '../components/AppButton'
import GameAssetIcon from '../components/GameAssetIcon'
import {useModalDialog} from '../components/useModalDialog'
import {apiErrorMessage,formatResourceAmount} from '../utils/formatters'
import {pullResourcePresentation} from '../gacha/pull-result-presentation'
import {emptyProgress,explorationQuotas,usefulOpened,type ExplorationProgress} from '../../server/src/domain/exploration/rewards'
import type {ExplorationAction,ExplorationMutation,ExplorationPresence,ExplorationSnapshot} from '../../server/src/domain/exploration/types'
import ExplorationBoard from './ExplorationBoard'
import {elementKeys} from '../api/types'
import './exploration.css'

export type ExplorationApi={overview:()=>Promise<ExplorationSnapshot>;act:(input:ExplorationAction)=>Promise<ExplorationMutation>;presence:(id:string,input:ExplorationPresence)=>Promise<{active:boolean;expiresAt:string|null;serverNow:string}>}
const defaultApi:ExplorationApi={overview:()=>getGameApiClient().getExploration(),act:input=>getGameApiClient().actExploration(input),presence:(id,input)=>getGameApiClient().explorationPresence(id,input)}
const intentKey=(owner:string)=>`gacha:exploration:intent:${owner}`
function savedIntent(owner:string):ExplorationAction|null{try{const value=sessionStorage.getItem(intentKey(owner));return value?JSON.parse(value) as ExplorationAction:null}catch{return null}}

export default function ExplorationScreen({ownerKey,elementKey,api=defaultApi,onReward}:{ownerKey:string;elementKey?:string|null;api?:ExplorationApi;onReward?:()=>Promise<unknown>}) {
  const [snapshot,setSnapshot]=useState<ExplorationSnapshot|null>(null),[region,setRegion]=useState('mondstadt'),[details,setDetails]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[intent,setIntent]=useState<ExplorationAction|null>(()=>savedIntent(ownerKey))
  const lock=useRef(false),alive=useRef(true),tab=useRef(crypto.randomUUID()),sequence=useRef(0),presenceLifecycle=useRef(0),rewardCallback=useRef(onReward)
  rewardCallback.current=onReward
  const session=snapshot?.session,selected=snapshot?.regions.find(row=>row.key===(session?.regionKey??region))??snapshot?.regions[0],progress=session?.progress??selected?.progress??emptyProgress(),total=usefulOpened(progress)
  const refresh=async()=>{try{const value=await api.overview();if(alive.current){setSnapshot(value);setError('')}}catch(reason){if(alive.current)setError(apiErrorMessage(reason))}}
  const refreshRef=useRef(refresh);refreshRef.current=refresh
  useEffect(()=>{alive.current=true;void refreshRef.current();return()=>{alive.current=false}},[api,ownerKey])
  useEffect(()=>{
    if(!session)return
    const id=session.id,lifecycle=++presenceLifecycle.current;let current=true,timer:ReturnType<typeof setTimeout>|undefined,inFlight=false
    const presence=async(visible:boolean)=>{
      if(visible&&inFlight)return
      if(visible)inFlight=true
      try{const result=await api.presence(id,{tabKey:tab.current,sequence:++sequence.current,visible});if(current&&visible){if(!result.active)await refreshRef.current();else setSnapshot(value=>value?.session?.id===id?{...value,serverNow:result.serverNow,session:{...value.session,expiresAt:result.expiresAt}}:value)}}catch{/* The server deadline remains authoritative when disconnected. */}
      finally{if(visible){inFlight=false;if(current&&document.visibilityState==='visible')timer=setTimeout(()=>void presence(true),3000)}}
    }
    const visibility=()=>{if(timer)clearTimeout(timer);void presence(document.visibilityState==='visible')}
    const leave=()=>{if(timer)clearTimeout(timer);void presence(false)}
    void presence(document.visibilityState==='visible');document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',leave)
    return()=>{current=false;if(timer)clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',leave);queueMicrotask(()=>{if(presenceLifecycle.current===lifecycle)void presence(false)})}
  },[api,session?.id,session?.state])
  const remember=(value:ExplorationAction|null)=>{setIntent(value);try{if(value)sessionStorage.setItem(intentKey(ownerKey),JSON.stringify(value));else sessionStorage.removeItem(intentKey(ownerKey))}catch{/* A live retry still retains the same in-memory intent. */}}
  const execute=async(action:ExplorationAction)=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setError('');remember(action)
    try{
      const result=await api.act(action)
      if(alive.current){setSnapshot(result);remember(null)}
      if(action.kind==='OPEN')await rewardCallback.current?.().catch(()=>undefined)
    }catch(reason){
      if(alive.current){setError(apiErrorMessage(reason));if(reason instanceof ApiError&&reason.status!==null&&reason.status>=400&&reason.status<500){remember(null);try{setSnapshot(await api.overview())}catch{/* Retain the visible failure and explicit refresh. */}}}
    }finally{lock.current=false;if(alive.current)setBusy(false)}
  }
  const act=(action:Omit<Extract<ExplorationAction,{kind:'START'}>,'idempotencyKey'>|Omit<Extract<ExplorationAction,{kind:'OPEN'}>,'idempotencyKey'>|{kind:'NEXT'|'STOP'|'ABANDON';sessionId:string})=>{if(!intent)void execute({...action,idempotencyKey:crypto.randomUUID()} as ExplorationAction)}
  const loot=session?.reward?pullResourcePresentation(session.reward.resourceKey):null
  return <section className="screen-content exploration-screen" data-business-pending={busy}>
    <header className="exploration-heading"><div><span className="eyebrow">Au-delà des chemins connus</span><h1>Exploration</h1></div><AppButton disabled={!snapshot} onClick={()=>setDetails(true)}>Progression</AppButton></header>
    <div className="panel exploration-panel" data-region={session?.regionKey??selected?.key??''} style={session?.backgroundPath?{backgroundImage:`linear-gradient(#09122199,#091221b8),url("${session.backgroundPath}")`}:undefined}>
      <div className="exploration-region-heading"><strong>{session?.regionName??selected?.name??'Régions'}</strong><span>{total/10}% · {total} / 1 000</span><progress aria-label="Progression de la région" max={1000} value={total}/></div>
      {error&&<div className="exploration-error" role="alert"><span>{error}</span>{intent?<AppButton disabled={busy} onClick={()=>void execute(intent)}>Réessayer la même action</AppButton>:<AppButton disabled={busy} onClick={()=>void refresh()}>Actualiser</AppButton>}</div>}
      {!error&&intent&&!busy&&<div className="exploration-error" role="status">Une action attend confirmation. <AppButton onClick={()=>void execute(intent)}>Réessayer la même action</AppButton></div>}
      {!snapshot?<p role="status">Ouverture des cartes…</p>:session?<>
        <ExplorationBoard key={session.id} maze={session.maze} active={session.state==='ACTIVE'&&!intent} openedChest={session.openedChest} busy={busy} onOpen={(chestIndex,path)=>act({kind:'OPEN',sessionId:session.id,chestIndex,path})}/>
        <div className="exploration-outcome" role="status">{session.reward?session.reward.category==='empty'?<strong>Coffre vide</strong>:<strong>{loot?.assetPath&&<GameAssetIcon src={loot.assetPath} fallback={loot.fallback}/>}+{formatResourceAmount(session.reward.amount)} {loot?.label}</strong>:<span>Trois coffres, un choix. Rejoignez une sortie.</span>}</div>
        <div className="exploration-actions">{session.state==='OPENED'?<><AppButton disabled={busy||Boolean(intent)} onClick={()=>act({kind:'STOP',sessionId:session.id})}>Arrêter</AppButton><AppButton variant="primary" disabled={busy||Boolean(intent)} onClick={()=>act({kind:'NEXT',sessionId:session.id})}>Suivant</AppButton></>:<AppButton disabled={busy||Boolean(intent)} onClick={()=>act({kind:'ABANDON',sessionId:session.id})}>Abandonner</AppButton>}</div>
        {session.backgroundCredit&&<small className="exploration-credit"><a href={session.backgroundCredit.sourceUrl} target="_blank" rel="noopener noreferrer">{session.backgroundCredit.attribution}</a> · <a href={session.backgroundCredit.licenseUrl} target="_blank" rel="noopener noreferrer">Licence</a></small>}
      </>:<div className="exploration-departure"><div className="exploration-horizon" aria-hidden="true"><span>✦</span></div><h2>Choisissez votre prochaine destination</h2><p>Explorez un nouveau labyrinthe et ouvrez l'un de ses trois coffres.</p><label>Région<select aria-label="Région à explorer" value={selected?.key??''} onChange={event=>setRegion(event.target.value)}>{snapshot.regions.map(row=><option key={row.key} value={row.key}>{row.name}</option>)}</select></label><AppButton variant="primary" disabled={!selected||busy||Boolean(intent)} onClick={()=>selected&&act({kind:'START',regionKey:selected.key,sessionId:null})}>Démarrer</AppButton></div>}
    </div>
    {details&&snapshot&&<ExplorationDetails elementKey={elementKey} snapshot={snapshot} initialRegion={session?.regionKey??selected?.key??''} onClose={()=>setDetails(false)}/>}
  </section>
}
function ProgressRows({progress,elementKey}:{progress:ExplorationProgress;elementKey?:string|null}){
  const labels={primogems:'Primos · 500 par coffre',moras:'Moras · 20 000 par coffre',own:'Particules personnelles · 300 par coffre',other:'Autres particules · 100 par coffre'}
  return <dl className="exploration-progress-details">{(Object.keys(explorationQuotas) as (keyof ExplorationProgress)[]).map(key=>{const resources=key==='own'?[`particles_${elementKey}`]:key==='other'?elementKeys.filter(value=>value!==elementKey).map(value=>`particles_${value}`):[key];return <div key={key}><dt><span className="exploration-detail-icons">{resources.map(resource=>{const presentation=pullResourcePresentation(resource);return presentation.assetPath&&<GameAssetIcon key={resource} src={presentation.assetPath} fallback={presentation.fallback}/>})}</span>{labels[key]}</dt><dd>{progress[key]} / {explorationQuotas[key]}</dd><progress max={explorationQuotas[key]} value={progress[key]} aria-label={labels[key]}/></div>})}</dl>
}
function ExplorationDetails({snapshot,initialRegion,elementKey,onClose}:{snapshot:ExplorationSnapshot;initialRegion:string;elementKey?:string|null;onClose:()=>void}){
  const dialog=useModalDialog<HTMLDivElement>(onClose),[key,setKey]=useState(initialRegion),region=snapshot.regions.find(row=>row.key===key)??snapshot.regions[0]
  return <div className="modal-layer exploration-details-layer" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><div className="panel exploration-details" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="exploration-details-title"><header><h2 id="exploration-details-title">Progression de l'Exploration</h2><AppButton variant="icon" aria-label="Fermer la progression" onClick={onClose}>×</AppButton></header><select aria-label="Région de la progression" value={region?.key??''} onChange={event=>setKey(event.target.value)}>{snapshot.regions.map(row=><option key={row.key} value={row.key}>{row.name}</option>)}</select>{region&&<><strong>{usefulOpened(region.progress)} / 1 000 coffres utiles · {usefulOpened(region.progress)/10}%</strong><progress max={1000} value={usefulOpened(region.progress)} aria-label="Progression totale"/><ProgressRows elementKey={elementKey} progress={region.progress}/></>}<p>Après 100 %, chaque labyrinthe contient un coffre vide et deux coffres de 1 à 5 particules, personnelles ou d'un autre élément.</p><small>Après ouverture, quitter l'Exploration conserve votre choix pendant 10 secondes. Vos gains restent acquis.</small></div></div>
}
