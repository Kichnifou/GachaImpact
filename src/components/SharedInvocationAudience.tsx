import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {SharedSpectators,SharedSession} from '../api/shared-invocations-types';
import type {SharedInvocationController} from '../gacha/use-shared-invocations';
import {useModalDialog} from './useModalDialog';
import CharacterAssetImage from './CharacterAssetImage';
import {apiErrorMessage} from '../utils/formatters';
import type {CSSProperties,MutableRefObject} from 'react';
export type SharedAudienceConfirmation={api:SharedInvocationController['api'];sessionId:string;token:string|undefined;value:SharedSpectators;at:number};

// The event ID fixes both the lane and wave phase for the event's lifetime.
function reactionStyle(id:string):CSSProperties{
 let hash=0;for(const character of id)hash=(Math.imul(hash,31)+character.charCodeAt(0))>>>0;
 return {'--shared-reaction-lane':hash%2?'1.7rem':'.7rem','--shared-reaction-wave-delay':hash%3===0?'-.6s':'0s'} as CSSProperties;
}

export default function SharedInvocationAudience({shared,session,onProfile,cache}:{shared:SharedInvocationController;session:SharedSession;onProfile?:(id:string)=>void;cache?:MutableRefObject<SharedAudienceConfirmation|null>}){
 const [confirmed,setConfirmed]=useState<SharedAudienceConfirmation|null>(()=>cache?.current??null),[error,setError]=useState(''),[open,setOpen]=useState(false),[preview,setPreview]=useState<{left:number;top:number}|null>(null),[page,setPage]=useState(1),[retry,setRetry]=useState(0);
 const data=confirmed?.api===shared.api&&confirmed?.sessionId===session.id&&confirmed?.token===shared.state.watchingToken&&Date.now()-confirmed.at<15000?confirmed.value:null;
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
  setError('');
  const read=async()=>{try{const next=await shared.api?.spectators?.(open?page:1);if(!disposed&&next?.sessionId===session.id){const value={api:shared.api,sessionId:session.id,token:shared.state.watchingToken,value:next,at:Date.now()};if(cache)cache.current=value;setConfirmed(value);setError('')}}catch(cause){if(!disposed)setError(apiErrorMessage(cause))}finally{if(!disposed)timer=setTimeout(read,5000)}};
  void read();return()=>{disposed=true;clearTimeout(timer)};
 },[shared.api,session.id,shared.state.watchingToken,open,page,retry,cache]);
 // Keep a confirmed count through silent refreshes, but expire it even when a
 // transport hangs indefinitely. Ownership is checked synchronously above.
 useEffect(()=>{if(!confirmed)return;const timer=setTimeout(()=>setConfirmed(value=>value===confirmed?null:value),Math.max(0,confirmed.at+15000-Date.now()));return()=>clearTimeout(timer)},[confirmed]);
 useEffect(()=>()=>{if(hide.current)clearTimeout(hide.current)},[]);
 const showPreview=()=>{if(hide.current)clearTimeout(hide.current);const r=counter.current?.getBoundingClientRect();if(r)setPreview({left:Math.max(8,Math.min(r.left,window.innerWidth-240)),top:Math.max(8,Math.min(r.bottom+5,window.innerHeight-210))})};
 const leave=()=>{hide.current=setTimeout(()=>setPreview(null),150)};
 const modal=()=>{setPreview(null);setOpen(true)};
 return <>
  <div ref={status} className="shared-invocation-status">
   <button ref={counter} type="button" className="shared-spectator-count" aria-label={data?`${data.total} ${data.total===1?'spectateur':'spectateurs'}`:'Spectateurs'} aria-haspopup="dialog" aria-expanded={open} onPointerEnter={e=>{if(e.pointerType!=='touch')showPreview()}} onPointerLeave={leave} onFocus={showPreview} onBlur={leave} onClick={modal}><svg aria-hidden="true" viewBox="0 0 24 20" fill="currentColor"><circle cx="12" cy="5" r="3"/><circle cx="4" cy="7" r="2.5"/><circle cx="20" cy="7" r="2.5"/><path d="M6 18v-3a6 6 0 0 1 12 0v3H6ZM0 18v-3a4 4 0 0 1 5-3.9A8 8 0 0 0 4 15v3H0Zm20 0v-3a8 8 0 0 0-1-3.9 4 4 0 0 1 5 3.9v3h-4Z"/></svg> {data?`${data.total} ${data.total===1?'spectateur':'spectateurs'}`:'Spectateurs…'}</button>
   <span className={`shared-live-label${session.status==='PAUSED'?' is-paused':''}`} title={`${session.status==='PAUSED'?'En pause':'En direct'} · ${session.snapshot.displayName}`}>{session.status==='PAUSED'?<svg aria-hidden="true" viewBox="0 0 10 12" fill="currentColor"><path d="M1 1h3v10H1zm5 0h3v10H6z"/></svg>:<span aria-hidden="true">●</span>} {session.status==='PAUSED'?'En pause':'En direct'} · {session.snapshot.displayName}</span>
   {shared.state.broadcasting&&!session.authoritative&&<span className="shared-authority-label" title="Contrôle dans un autre onglet">Contrôle dans un autre onglet</span>}
  </div>
  {preview&&createPortal(<div className="shared-spectator-preview" style={preview} onPointerEnter={()=>{if(hide.current)clearTimeout(hide.current)}} onPointerLeave={leave} onFocus={()=>{if(hide.current)clearTimeout(hide.current)}} onBlur={leave} role="region" aria-label="Aperçu des spectateurs">{error?<p>{error}</p>:!data?<p>Chargement…</p>:data.total===0?<p>Aucun spectateur.</p>:data.preview.map(p=><div key={p.playerId}>{p.displayName}</div>)}{data&&data.total>5&&<button type="button" className="shared-recovery-link" onClick={modal}>Voir plus</button>}</div>,document.body)}
  {open&&createPortal(<SpectatorDialog data={data} error={error} onClose={()=>{setOpen(false);counter.current?.focus()}} onRetry={()=>setRetry(x=>x+1)} onPage={setPage} onProfile={id=>{setOpen(false);onProfile?.(id)}}/>,document.body)}
  <div className="shared-reaction-layer" aria-hidden="true">{session.reactions.map(r=><span key={r.id} style={reactionStyle(r.id)}><i>{r.emoji}</i></span>)}</div>
 </>;
}
function SpectatorDialog({data,error,onClose,onRetry,onPage,onProfile}:{data:SharedSpectators|null;error:string;onClose:()=>void;onRetry:()=>void;onPage:(page:number)=>void;onProfile:(id:string)=>void}){
 const ref=useModalDialog<HTMLElement>(onClose);
 return <div className="history-modal-overlay" onMouseDown={onClose}><section ref={ref} tabIndex={-1} className="panel shared-invocation-picker" role="dialog" aria-modal="true" aria-labelledby="shared-spectator-title" onMouseDown={e=>e.stopPropagation()}><header><h2 id="shared-spectator-title">Spectateurs</h2><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}>×</button></header><div className="shared-invocation-picker-body">{error?<p role="alert">{error} <button className="shared-recovery-link" onClick={onRetry}>Réessayer</button></p>:!data?<p>Chargement…</p>:!data.total?<p>Aucun spectateur.</p>:data.players.map(p=><button className="shared-invocation-session" type="button" key={p.playerId} onClick={()=>onProfile(p.playerId)}><CharacterAssetImage characterName={p.displayName} assetPaths={[p.avatarPath]} alt="" className="shared-avatar" fallback={<span aria-hidden="true">✦</span>}/><span>{p.displayName}</span></button>)}</div>{data&&data.totalPages>1&&<footer className="shared-spectator-pages"><button className="banner-change-button" disabled={data.page<=1} onClick={()=>onPage(data.page-1)}>Précédent</button><span>{data.page} / {data.totalPages}</span><button className="banner-change-button" disabled={data.page>=data.totalPages} onClick={()=>onPage(data.page+1)}>Suivant</button></footer>}</section></div>;
}
