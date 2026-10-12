import { createContext,useContext,useLayoutEffect,useState,type Dispatch,type SetStateAction } from 'react'
import { tabBelongsToScreen,type DestinationHistory,type DestinationTabs } from './destination-history'

export const DestinationContext=createContext<{history:DestinationHistory;disabled:boolean;onTab:(mode:'push'|'replace')=>void}|null>(null)
export function useDestinationScreen(){return useContext(DestinationContext)?.history.getSnapshot().current.screen}
export function useDestinationRestoration(){return useContext(DestinationContext)?.history.getSnapshot().restoration??0}
/** Explicit tab owner; standalone surfaces retain their existing local behavior. */
export function useDestinationTab<K extends keyof DestinationTabs>(key:K,initial:DestinationTabs[K]|(()=>DestinationTabs[K])):[DestinationTabs[K],Dispatch<SetStateAction<DestinationTabs[K]>>,boolean]{
  const context=useContext(DestinationContext),[local,setLocal]=useState(initial);
  const current=context?.history.getSnapshot().current;
  const enabled=!!context&&!context.disabled&&!!current&&tabBelongsToScreen(key,current.screen);
  const value=enabled?(current.tabs[key]??local):local;
  useLayoutEffect(()=>{if(enabled&&current.tabs[key]===undefined&&context.history.initializeTab(key,local))context.onTab('replace')},[context,enabled,current,key,local]);
  const change:Dispatch<SetStateAction<DestinationTabs[K]>>=next=>{if(context?.disabled)return;const valueNext=typeof next==='function'?next(value):next;setLocal(valueNext);if(enabled&&context.history.tab(key,valueNext))context.onTab('push')};
  return [value,change,enabled];
}
