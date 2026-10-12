import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {SharedSpectators,SharedSession} from '../api/shared-invocations-types';
import type {SharedInvocationController} from '../gacha/use-shared-invocations';
import {useModalDialog} from './useModalDialog';
import CharacterAssetImage from './CharacterAssetImage';
import {apiErrorMessage} from '../utils/formatters';

export default function SharedInvocationAudience({shared,session,onProfile}:{shared:SharedInvocationController;session:SharedSession;onProfile?:(id:string)=>void}){
 const [data,setData]=useState<SharedSpectators|null>(null),[error,setError]=useState(''),[open,setOpen]=useState(false),[preview,setPreview]=useState<{left:number;top:number}|null>(null),[page,setPage]=useState(1),[retry,setRetry]=useState(0);
 const counter=useRef<HTMLButtonElement>(null),hide=useRef<ReturnType<typeof setTimeout>|null>(null);
 const status=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const node=status.current,panel=node?.closest<HTMLElement>('.invocation-panel');if(!node||!panel)return;
  const measure=()=>panel.style.setProperty('--shared-status-height',`${node.getBoundingClientRect().height}px`);
  measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);observer?.observe(node);
  return()=>{observer?.disconnect();panel.style.removeProperty('--shared-status-height')};
 },[]);
 useEffect(()=>{
  let disposed=false,timer:ReturnType<typeof setTimeout>;
  setData(null);setError('');
  const read=async()=>{try{const next=await shared.api?.spectators?.(open?page:1);if(!disposed&&next?.sessionId===session.id){setData(next);setError('')}}catch(cause){if(!disposed){setData(null);setError(apiErrorMessage(cause))}}finally{if(!disposed)timer=setTimeout(read,5000)}};
  void read();return()=>{disposed=true;clearTimeout(timer)};
 },[shared.api,session.id,shared.state.watchingToken,open,page,retry]);
 useEffect(()=>()=>{if(hide.current)clearTimeout(hide.current)},[]);
 const showPreview=()=>{if(hide.current)clearTimeout(hide.current);const r=counter.current?.getBoundingClientRect();if(r)setPreview({left:Math.max(8,Math.min(r.left,window.innerWidth-240)),top:Math.max(8,Math.min(r.bottom+5,window.innerHeight-210))})};
 const leave=()=>{hide.current=setTimeout(()=>setPreview(null),150)};
 const modal=()=>{setPreview(null);setOpen(true)};
 return <>
  <div ref={status} className="shared-invocation-status">
   <button ref={counter} type="button" className="shared-spectator-count" aria-label={data?`${data.total} ${data.total===1?'spectateur':'spectateurs'}`:'Spectateurs'} aria-haspopup="dialog" aria-expanded={open} onPointerEnter={e=>{if(e.pointerType!=='touch')showPreview()}} onPointerLeave={leave} onFocus={showPreview} onBlur={leave} onClick={modal}><span aria-hidden="true">◉</span> {data?`${data.total} ${data.total===1?'spectateur':'spectateurs'}`:'Spectateurs…'}</button>
   <span className="shared-live-label" title={`${session.status==='PAUSED'?'En pause':'En direct'} · ${session.snapshot.displayName}`}><span aria-hidden="true">●</span> {session.status==='PAUSED'?'En pause':'En direct'} · {session.snapshot.displayName}</span>
   {shared.state.broadcasting&&!session.authoritative&&<span className="shared-authority-label" title="Contrôle dans un autre onglet">Contrôle dans un autre onglet</span>}
  </div>
  {preview&&createPortal(<div className="shared-spectator-preview" style={preview} onPointerEnter={()=>{if(hide.current)clearTimeout(hide.current)}} onPointerLeave={leave} onFocus={()=>{if(hide.current)clearTimeout(hide.current)}} onBlur={leave} role="region" aria-label="Aperçu des spectateurs">{error?<p>{error}</p>:!data?<p>Chargement…</p>:data.total===0?<p>Aucun spectateur.</p>:data.preview.map(p=><div key={p.playerId}>{p.displayName}</div>)}{data&&data.total>5&&<button type="button" className="shared-recovery-link" onClick={modal}>Voir plus</button>}</div>,document.body)}
  {open&&createPortal(<SpectatorDialog data={data} error={error} onClose={()=>{setOpen(false);counter.current?.focus()}} onRetry={()=>setRetry(x=>x+1)} onPage={setPage} onProfile={id=>{setOpen(false);onProfile?.(id)}}/>,document.body)}
  <div className="shared-reaction-layer" aria-hidden="true">{session.reactions.map(r=><span key={r.id}><i>{r.emoji}</i></span>)}</div>
 </>;
}
function SpectatorDialog({data,error,onClose,onRetry,onPage,onProfile}:{data:SharedSpectators|null;error:string;onClose:()=>void;onRetry:()=>void;onPage:(page:number)=>void;onProfile:(id:string)=>void}){
 const ref=useModalDialog<HTMLElement>(onClose);
 return <div className="history-modal-overlay" onMouseDown={onClose}><section ref={ref} tabIndex={-1} className="panel shared-invocation-picker" role="dialog" aria-modal="true" aria-labelledby="shared-spectator-title" onMouseDown={e=>e.stopPropagation()}><header><h2 id="shared-spectator-title">Spectateurs</h2><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}>×</button></header><div className="shared-invocation-picker-body">{error?<p role="alert">{error} <button className="shared-recovery-link" onClick={onRetry}>Réessayer</button></p>:!data?<p>Chargement…</p>:!data.total?<p>Aucun spectateur.</p>:data.players.map(p=><button className="shared-invocation-session" type="button" key={p.playerId} onClick={()=>onProfile(p.playerId)}><CharacterAssetImage characterName={p.displayName} assetPaths={[p.avatarPath]} alt="" className="shared-avatar" fallback={<span aria-hidden="true">✦</span>}/><span>{p.displayName}</span></button>)}</div>{data&&data.totalPages>1&&<footer className="shared-spectator-pages"><button className="banner-change-button" disabled={data.page<=1} onClick={()=>onPage(data.page-1)}>Précédent</button><span>{data.page} / {data.totalPages}</span><button className="banner-change-button" disabled={data.page>=data.totalPages} onClick={()=>onPage(data.page+1)}>Suivant</button></footer>}</section></div>;
}
