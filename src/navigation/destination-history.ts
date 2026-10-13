import type { ScreenId } from '../types'
import type { RankingCategory } from '../api/types'

export type DestinationTabs={
  dailies:'overview'|'wheel'|'challenge'; combat:'training'|'boss';
  event:'registration'|'games'|'shop'|'ranking'; eventGame:0|1|2;
  profile:'Aperçu'|'Team active'|'Box'|'Collection'|'Statistiques'|'Missions'|'Personnalisation'; appearance:'AVATAR'|'TITLE'|'BADGE';
  configuration:'menu'|'privacy'|'account'; social:'friends'|'requests'|'players';
  moderation:'system'|'characters'|'codes'|'banners'|'events'|'community'|'giveaway'|'audit';
  adminCharacters:'catalog'|'possessions'|'pipeline'; community:'chat'|'dm';
  inventory:'all'|'resources'|'objects'|'collection'; history:'invocations'|'banners'|'event'|'bank'|'shop'|'activity';
  trades:'create'|'received'|'sent'|'history'; missions:'B'|'A'|'S'|'Z'; profileMissions:'B'|'A'|'S'|'Z';
  rankings:RankingCategory;
  communityPanel:'chat'|'direct'; directMailbox:'list'|'archives';
}
export type Destination=Readonly<{screen:ScreenId;tabs:Readonly<Partial<DestinationTabs>>;profileId?:string}>
export const tabScreens:Record<keyof DestinationTabs,readonly ScreenId[]>={
  dailies:['activities-dailies'],combat:['activities-combat'],event:['activities-event'],eventGame:['activities-event'],
  profile:['profile'],appearance:['profile'],profileMissions:['profile'],configuration:['configuration'],social:['social'],
  moderation:['moderation'],adminCharacters:['moderation'],community:['moderation'],inventory:['inventory'],history:['history'],
  trades:['trades'],missions:['activities-missions'],rankings:['rankings'],
  communityPanel:[],directMailbox:[],
}
export function tabBelongsToScreen(key:keyof DestinationTabs,screen:ScreenId){return key==='communityPanel'||key==='directMailbox'||tabScreens[key].includes(screen)}
export function normalizeDestination(value:Destination):Destination{
  const tabs:Partial<DestinationTabs>={};
  for(const key of Object.keys(value.tabs) as (keyof DestinationTabs)[])if(tabScreens[key]&&tabBelongsToScreen(key,value.screen))Object.assign(tabs,{[key]:value.tabs[key]});
  if(tabs.profile!=='Personnalisation')delete tabs.appearance;
  if(tabs.profile!=='Missions')delete tabs.profileMissions;
  if(tabs.event!=='games')delete tabs.eventGame;
  if(tabs.moderation!=='characters')delete tabs.adminCharacters;
  if(tabs.moderation!=='community')delete tabs.community;
  if(tabs.communityPanel!=='direct')delete tabs.directMailbox;
  else tabs.directMailbox??='list';
  return {screen:value.screen,tabs,...(value.screen==='profile'&&value.profileId?{profileId:value.profileId}:{})};
}
export function destinationKey(value:Destination){const next=normalizeDestination(value);return JSON.stringify([next.screen,next.profileId??'',Object.entries(next.tabs).sort(([a],[b])=>a.localeCompare(b))])}
type Entry=Readonly<{id:number;destination:Destination}>
export type DestinationHistoryState=Readonly<{entries:readonly Entry[];cursor:number;current:Destination;restoration:number}>
/** Session-local owner. Only destinations enter this bounded timeline. */
export class DestinationHistory{
  readonly playerId:string;
  private listeners=new Set<()=>void>();private sequence=0;
  private state:DestinationHistoryState;
  constructor(playerId:string,initial:Destination){this.playerId=playerId;const destination=normalizeDestination(initial);this.state={entries:[{id:++this.sequence,destination}],cursor:0,current:destination,restoration:0}}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}};
  getSnapshot=()=>this.state;
  private publish(entries:readonly Entry[],cursor:number,restored=false){this.state={entries,cursor,current:entries[cursor]!.destination,restoration:this.state.restoration+Number(restored)};this.listeners.forEach(listener=>listener())}
  visit(destination:Destination){const next=normalizeDestination(destination);if(destinationKey(next)===destinationKey(this.state.current))return false;const entries=[...this.state.entries.slice(0,this.state.cursor+1),{id:++this.sequence,destination:next}].slice(-10);this.publish(entries,entries.length-1);return true}
  clear(){const destination:Destination={screen:'home',tabs:{}};this.publish([{id:++this.sequence,destination}],0)}
  initializeTab<K extends keyof DestinationTabs>(key:K,value:DestinationTabs[K]){if(this.state.current.tabs[key]!==undefined)return false;const next=normalizeDestination({...this.state.current,tabs:{...this.state.current.tabs,[key]:value}});if(destinationKey(next)===destinationKey(this.state.current))return false;const entries=[...this.state.entries];entries[this.state.cursor]={...entries[this.state.cursor]!,destination:next};this.publish(entries,this.state.cursor);return true}
  tab<K extends keyof DestinationTabs>(key:K,value:DestinationTabs[K]){return this.visit({...this.state.current,tabs:{...this.state.current.tabs,[key]:value}})}
  index(direction:-1|1,allowed:(destination:Destination)=>boolean){for(let index=this.state.cursor+direction;index>=0&&index<this.state.entries.length;index+=direction)if(allowed(this.state.entries[index]!.destination))return index;return null}
  move(direction:-1|1,allowed:(destination:Destination)=>boolean){const index=this.index(direction,allowed);if(index===null)return false;this.publish(this.state.entries,index,true);return true}
  native(destination:Destination,id?:number){const index=this.state.entries.findIndex(entry=>entry.id===id&&destinationKey(entry.destination)===destinationKey(destination));if(index>=0){if(index!==this.state.cursor)this.publish(this.state.entries,index,true)}else {this.visit(destination);this.publish(this.state.entries,this.state.cursor,true)}}
}
