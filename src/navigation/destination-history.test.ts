import {describe,expect,it} from 'vitest'
import {DestinationHistory,destinationKey,type Destination} from './destination-history'
const destination=(screen:Destination['screen'],tabs:Destination['tabs']={}):Destination=>({screen,tabs})
const allowed=()=>true
describe('bounded destination history',()=>{
 it('moves back twice and forward twice without adding entries, deduplicates and branches',()=>{
  const h=new DestinationHistory('owner',destination('invocation'));
  h.visit(destination('inventory'));h.visit(destination('characters-box'));
  h.move(-1,allowed);expect(h.getSnapshot().current.screen).toBe('inventory');h.move(-1,allowed);expect(h.getSnapshot().current.screen).toBe('invocation');
  expect(h.move(-1,allowed)).toBe(false);h.move(1,allowed);h.move(1,allowed);expect(h.getSnapshot().entries).toHaveLength(3);
  expect(h.visit(destination('characters-box'))).toBe(false);h.move(-1,allowed);h.visit(destination('shop'));expect(h.move(1,allowed)).toBe(false);expect(h.getSnapshot().entries.map(e=>e.destination.screen)).toEqual(['invocation','inventory','shop']);
 });
 it('evicts the eleventh and keeps exactly ten destinations',()=>{const h=new DestinationHistory('owner',destination('home'));for(let i=0;i<10;i++)h.visit(destination(i%2?'inventory':'shop'));expect(h.getSnapshot().entries).toHaveLength(10);for(let i=0;i<9;i++)expect(h.move(-1,allowed)).toBe(true);expect(h.move(-1,allowed)).toBe(false)});
 it('restores functional paths and discards inactive child paths',()=>{
  const h=new DestinationHistory('owner',destination('activities-dailies',{dailies:'overview'}));h.tab('dailies','wheel');h.tab('dailies','challenge');h.move(-1,allowed);expect(h.getSnapshot().current.tabs.dailies).toBe('wheel');
  h.visit({screen:'profile',profileId:'owner',tabs:{profile:'Personnalisation',appearance:'AVATAR'}});h.tab('appearance','TITLE');h.tab('profile','Aperçu');expect(h.getSnapshot().current.tabs.appearance).toBeUndefined();h.move(-1,allowed);expect(h.getSnapshot().current.tabs.appearance).toBe('TITLE');
  h.visit(destination('moderation',{moderation:'characters',adminCharacters:'pipeline'}));h.tab('moderation','banners');h.move(-1,allowed);expect(h.getSnapshot().current.tabs).toEqual({moderation:'characters',adminCharacters:'pipeline'});
 });
 it('skips revoked destinations, fences owner instances and keeps native cursor movement idempotent',()=>{
  const h=new DestinationHistory('one',destination('home'));h.visit(destination('moderation',{moderation:'characters'}));h.visit(destination('inventory'));
  h.move(-1,d=>d.screen!=='moderation');expect(h.getSnapshot().current.screen).toBe('home');expect(h.index(1,d=>d.screen!=='moderation')).toBe(2);
  const entry=h.getSnapshot().entries[2]!;h.native(entry.destination,entry.id);h.native(entry.destination,entry.id);expect(h.getSnapshot().entries).toHaveLength(3);
  expect(new DestinationHistory('two',destination('home')).getSnapshot().entries).toHaveLength(1);
 });
 it('keeps profile identities separate and never stores business intents',()=>{
  const h=new DestinationHistory('owner',{screen:'profile',profileId:'other',tabs:{profile:'Box'}});h.visit({screen:'profile',profileId:'owner',tabs:{profile:'Personnalisation',appearance:'TITLE'}});h.move(-1,allowed);expect(h.getSnapshot().current.profileId).toBe('other');
  expect(destinationKey({screen:'profile',profileId:'other',tabs:{profile:'Box'}})).not.toBe(destinationKey({screen:'profile',profileId:'owner',tabs:{profile:'Box'}}));
  h.visit(destination('inventory',{inventory:'objects',appearance:'TITLE'}));expect(h.getSnapshot().current).toEqual({screen:'inventory',tabs:{inventory:'objects'}});
 });
});
