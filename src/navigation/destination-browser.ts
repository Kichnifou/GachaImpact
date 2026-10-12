import { DestinationHistory,normalizeDestination,type Destination,type DestinationTabs } from './destination-history'
import { hashForScreen,parseNavigationHash } from './navigation'
const values:{[K in keyof DestinationTabs]:readonly DestinationTabs[K][]}={
  dailies:['overview','wheel','challenge'],combat:['training','boss'],event:['registration','games','shop','ranking'],eventGame:[0,1,2],
  profile:['Aperçu','Team active','Box','Collection','Statistiques','Missions','Personnalisation'],appearance:['AVATAR','TITLE'],
  configuration:['menu','privacy','account'],social:['friends','requests','players'],moderation:['system','characters','codes','banners','events','community','giveaway','audit'],
  adminCharacters:['catalog','possessions','pipeline'],community:['chat','dm'],inventory:['all','resources','objects','collection'],history:['invocations','banners','event','bank','shop'],
  trades:['create','received','sent','history'],missions:['B','A','S','Z'],profileMissions:['B','A','S','Z'],rankings:['PROGRESSION','GACHA','RESSOURCES','COLLECTION','ACTIVITE'],
  communityPanel:['chat','direct'],directMailbox:['list','archives'],
}
export function readBrowserDestination(playerId:string):{destination:Destination;id?:number;index?:number;segment?:string}{
  const screen=parseNavigationHash(window.location.hash),stored=window.history.state?.gachaDestination;
  if(/^#moderation\/(?:candidates|characters)\/[a-f0-9-]{36}$/i.test(window.location.hash))return {destination:{screen,tabs:{moderation:'characters',adminCharacters:window.location.hash.startsWith('#moderation/candidates/')?'pipeline':'catalog',...(stored?.playerId===playerId?{communityPanel:stored.destination?.tabs?.communityPanel,directMailbox:stored.destination?.tabs?.directMailbox}:{})}}};
  if(stored?.playerId===playerId&&stored.destination?.screen===screen&&stored.destination.tabs&&typeof stored.destination.tabs==='object'){
    const tabs:Partial<DestinationTabs>={};for(const key of Object.keys(values) as (keyof DestinationTabs)[]){const value=stored.destination.tabs[key];if((values[key] as readonly unknown[]).includes(value))Object.assign(tabs,{[key]:value})}
    const profileId=typeof stored.destination.profileId==='string'&&stored.destination.profileId.length<=100?stored.destination.profileId:undefined;
    return {destination:normalizeDestination({screen,tabs,profileId}),...(Number.isSafeInteger(stored.id)?{id:stored.id}:{}),...(Number.isSafeInteger(stored.index)?{index:stored.index}:{}),...(typeof stored.segment==='string'?{segment:stored.segment}:{})};
  }
  const tabs:Partial<DestinationTabs>={};
  if(/^#moderation\/(?:candidates|characters)\/[a-f0-9-]{36}$/i.test(window.location.hash)){tabs.moderation='characters';tabs.adminCharacters=window.location.hash.startsWith('#moderation/candidates/')?'pipeline':'catalog'}
  return {destination:{screen,tabs}};
}
const positions=new WeakMap<DestinationHistory,{index:number;segment:string;entries:Map<number,number>}>();
export function rememberBrowserPosition(history:DestinationHistory,index?:number){
  let value=positions.get(history);if(!value){const stored=window.history.state?.gachaDestination;value={index:stored?.playerId===history.playerId&&Number.isSafeInteger(stored.index)?stored.index:0,segment:stored?.playerId===history.playerId&&typeof stored.segment==='string'?stored.segment:crypto.randomUUID(),entries:new Map()};positions.set(history,value)}
  if(index!==undefined)value.index=index;return value;
}
/** Offsets from separate native-history segments must never be combined. */
export function synchronizeBrowserPosition(history:DestinationHistory,index?:number,segment?:string){
  const value=rememberBrowserPosition(history);
  if(index===undefined||segment!==value.segment){value.index=0;value.segment=crypto.randomUUID();value.entries.clear()}
  else value.index=index;
}
export function requestBrowserMove(history:DestinationHistory,direction:-1|1,allowed:(destination:Destination)=>boolean){
  const target=history.index(direction,allowed);if(target===null)return false;
  const value=rememberBrowserPosition(history),entry=history.getSnapshot().entries[target]!,index=value.entries.get(entry.id);
  if(index!==undefined&&index!==value.index){window.history.go(index-value.index);return true}
  // A destination imported from an older untracked hash has no trustworthy
  // browser offset. Canonical replacement still creates no browser entry.
  history.move(direction,allowed);writeBrowserDestination(history,'replace');return false;
}
export function writeBrowserDestination(history:DestinationHistory,mode:'push'|'replace',preserveIntent=false){
  const state=history.getSnapshot(),id=state.entries[state.cursor]!.id;
  const position=rememberBrowserPosition(history);if(mode==='push')position.index++;position.entries.set(id,position.index);
  const hash=preserveIntent&&/^#moderation\/(?:characters|candidates)\/[a-f0-9-]{36}$/i.test(window.location.hash)?window.location.hash:'#'+hashForScreen(state.current.screen);
  window.history[mode==='push'?'pushState':'replaceState']({...window.history.state,gachaDestination:{playerId:history.playerId,id,index:position.index,segment:position.segment,destination:state.current}},'',hash);
}
