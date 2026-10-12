// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest'
import {DestinationHistory} from './destination-history'
import {readBrowserDestination,requestBrowserMove,synchronizeBrowserPosition,writeBrowserDestination} from './destination-browser'
afterEach(()=>{vi.restoreAllMocks();window.history.replaceState(null,'','#home')})
const allowed=()=>true
it('uses native traversal for known positions without adding a browser entry',()=>{
 const h=new DestinationHistory('owner',{screen:'home',tabs:{}});writeBrowserDestination(h,'replace');
 h.visit({screen:'inventory',tabs:{}});writeBrowserDestination(h,'push');h.visit({screen:'shop',tabs:{}});writeBrowserDestination(h,'push');
 const go=vi.spyOn(window.history,'go').mockImplementation(()=>{}),push=vi.spyOn(window.history,'pushState');
 expect(requestBrowserMove(h,-1,allowed)).toBe(true);expect(go).toHaveBeenCalledWith(-1);expect(push).not.toHaveBeenCalled();expect(h.getSnapshot().current.screen).toBe('shop');
});
it('invalidates offsets across an untracked hash segment and never gets stuck on the old Shop entry',()=>{
 const h=new DestinationHistory('owner',{screen:'home',tabs:{}});writeBrowserDestination(h,'replace');
 for(const screen of ['inventory','shop'] as const){h.visit({screen,tabs:{}});writeBrowserDestination(h,'push')}
 synchronizeBrowserPosition(h);h.native({screen:'profile',tabs:{}});writeBrowserDestination(h,'replace');
 h.visit({screen:'bank',tabs:{}});writeBrowserDestination(h,'push');const bank=window.history.state.gachaDestination;
 const go=vi.spyOn(window.history,'go').mockImplementation(()=>{});expect(requestBrowserMove(h,-1,allowed)).toBe(true);expect(go).toHaveBeenCalledWith(-1);
 const profile=h.getSnapshot().entries[3]!;synchronizeBrowserPosition(h,bank.index-1,bank.segment);h.native(profile.destination,profile.id);writeBrowserDestination(h,'replace');go.mockClear();
 expect(requestBrowserMove(h,-1,allowed)).toBe(false);expect(h.getSnapshot().current.screen).toBe('shop');expect(requestBrowserMove(h,-1,allowed)).toBe(false);expect(h.getSnapshot().current.screen).toBe('inventory');expect(go).not.toHaveBeenCalled();
});
it('sanitizes persisted paths, never imports a different Player, and captures only the candidate destination',()=>{
 window.history.replaceState({gachaDestination:{playerId:'other',destination:{screen:'profile',tabs:{profile:'Personnalisation',appearance:'TITLE'}},id:5,index:5}},'','#profile');
 expect(readBrowserDestination('owner').destination.tabs).toEqual({});
 window.history.replaceState(null,'','#moderation/candidates/11111111-1111-4111-8111-111111111111');
 expect(readBrowserDestination('owner').destination).toEqual({screen:'moderation',tabs:{moderation:'characters',adminCharacters:'pipeline'}});
});
