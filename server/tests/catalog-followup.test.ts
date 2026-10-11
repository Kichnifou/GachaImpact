import {describe,it,expect} from 'vitest';
import {mergeEvidence,eligibility,type Evidence} from '../src/application/character-catalog/catalog-policy.js';
import {canCollect,shouldStopAtRelease,sameEditorialValue} from '../src/application/character-catalog/catalog-followup.js';
import {parseSecondaryMetadata,linkedCharacterPages,CatalogSecondarySources} from '../src/infrastructure/character-catalog/catalog-secondary.js';
import {releaseDatePlan} from '../src/application/character-catalog/catalog-date-backfill.js';
import {catalogReviewPayload} from '../src/application/character-catalog/catalog-notifications.js';
const now=new Date('2026-10-11T23:30:00Z');
const proof=(value:string|number,reliability:Evidence['reliability']='PROVISIONAL'):Evidence=>({value,reliability,provider:'icy-veins',url:'https://www.icy-veins.com/genshin-impact/private-profile',fetchedAt:now.toISOString()});
describe('field follow-up and provisional provenance',()=>{
 it('summarizes all unread changes without duplicating fields and prioritizes a current conflict',()=>{
   const first=catalogReviewPayload('fixture','Candidat',['rarity : nouvelle information'],false);
   const second=catalogReviewPayload('fixture','Candidat',['icon : image disponible','rarity : nouvelle information'],false,first.fields);
   expect(second.fields).toEqual(['Rareté','Portrait']);expect(second.message).toContain('Rareté, Portrait');
   expect(catalogReviewPayload('fixture','Candidat',['icon : image disponible'],true,second.fields).title).toContain('Conflit');
 });
 it('retains a newly reported same-value source conflict and deduplicates its alternatives on replay',()=>{
  const incoming={...proof(4),conflict:true,alternatives:[proof(5)]};
  const result=mergeEvidence({rarity:proof(4)},'rarity',incoming);
  expect(result.rarity).toMatchObject({value:4,conflict:true,alternatives:[{value:5}]});
  expect(mergeEvidence(result,'rarity',incoming)).toEqual(result);
 });
 it('requires both scope permission and an unlocked non-ADMIN field',()=>{
  const row={trackingState:'ACTIVE',trackingElements:['icon','rarity'],fields:{rarity:{...proof(5),locked:true}}};
  expect(canCollect(row,'icon')).toBe(true);expect(canCollect(row,'rarity')).toBe(false);expect(canCollect(row,'element')).toBe(false);
  expect(canCollect({...row,trackingState:'PROTECTED'},'icon')).toBe(false);
  expect(canCollect({...row,fields:{rarity:{...proof(5),override:true}}},'rarity')).toBe(false);
 });
 it('retains contradictions as alternatives without replacing trusted evidence',()=>{
  const result=mergeEvidence({rarity:proof(5,'OFFICIAL')},'rarity',proof(4));
  expect(result.rarity).toMatchObject({value:5,reliability:'OFFICIAL',conflict:true,alternatives:[{value:4,reliability:'PROVISIONAL'}]});
  expect(mergeEvidence({rarity:{...proof(5),locked:true}},'rarity',proof(4,'OFFICIAL')).rarity?.value).toBe(5);
 });
 it('requires an actual stronger proof for provisional promotion and excludes timestamp-only changes',()=>{
  const first=proof(5),later={...first,fetchedAt:'2026-10-12T10:00:00Z'};
  expect(sameEditorialValue(first,later)).toBe(true);
  expect(sameEditorialValue(first,{...later,provider:'game8',url:'https://game8.co/another-source',alternatives:[{...first,provider:'sephijin'}]})).toBe(true);
  expect(sameEditorialValue(first,{...first,conflict:true,alternatives:[proof(4)]})).toBe(false);
  expect(sameEditorialValue(first,{...first,editorialStatus:'VALIDATED'})).toBe(false);
  expect(sameEditorialValue(first,JSON.parse(JSON.stringify({reliability:first.reliability,fetchedAt:later.fetchedAt,url:first.url,provider:first.provider,value:first.value})))).toBe(true);
  expect(mergeEvidence({rarity:first},'rarity',later).rarity?.reliability).toBe('PROVISIONAL');
  expect(mergeEvidence({rarity:first},'rarity',proof(5,'OFFICIAL')).rarity?.reliability).toBe('OFFICIAL');
  expect(eligibility({rarity:{...first,adminValidated:true}},['icon','splash'],now).missing).toContain('rarityConfirmation');
 });
 it('stops only published official releases, uses the Paris day and honors an explicit targeted resumption',()=>{
  const fields={releaseDate:proof('2026-10-12','OFFICIAL')};
  expect(shouldStopAtRelease('character',fields,now)).toBe(true);
  expect(shouldStopAtRelease(null,fields,now)).toBe(false);
  expect(shouldStopAtRelease('character',fields,now,true)).toBe(false);
  expect(shouldStopAtRelease('character',{releaseDate:proof('2026-02-31','OFFICIAL')},now)).toBe(false);
  expect(shouldStopAtRelease('character',{releaseDate:proof('2026-10-12')},now)).toBe(false);
 });
 it('extracts secondary facts only for the exact profile and keeps leak reservations',()=>{
  const html='<h1>Private Profile</h1><p>Private is a 5-Star Electro Catalyst character. Beta leaks.</p>';
  const parsed=parseSecondaryMetadata(html,'https://www.icy-veins.com/genshin-impact/private-profile','icy-veins',['Private'],now);
  expect(parsed).toMatchObject({rarity:{value:5,reliability:'PROVISIONAL'},element:{value:'electro'},weapon:{value:'Catalyst',reason:expect.stringContaining('leak')}});
  expect(parseSecondaryMetadata(html,'https://game8.co/a','game8',['Other'],now)).toEqual({});
  expect(linkedCharacterPages('<a href="/mitya-guide">Mitya Guide</a><a href="https://evil.test/mitya">Mitya Guide</a>','https://www.icy-veins.com/genshin-impact/',['Mitya'])).toEqual(['https://www.icy-veins.com/mitya-guide']);
 });
 it('rejects invalid date plans before opening a transaction',()=>{
  expect(releaseDatePlan.safeParse({version:1,operation:'R1051_RELEASE_DATE_NULL_ONLY',sourceUrl:'https://evil.test',fetchedAt:now.toISOString(),sourceSha256:'a'.repeat(64),entries:[]}).success).toBe(false);
 });
 it('uses a dated provisional reading cache during HTTP403 without refreshing its age or widening field scope',async()=>{
  const blocked=async(url:string)=>({url,status:403,mime:'text/html',body:Buffer.from('Forbidden')});
  const source=new CatalogSecondarySources(blocked,async()=>{},new Date('2026-10-11T11:00:00Z'));
  const fields=await source.collect(['Mitya'],['weapon']);
  expect(fields).toEqual({weapon:expect.objectContaining({value:'Catalyseur',rawValue:'Catalyst',reliability:'PROVISIONAL',fetchedAt:'2026-10-11T10:14:23.000Z'})});
  expect(await new CatalogSecondarySources(blocked,async()=>{},new Date('2026-10-20T10:00:00Z')).collect(['Mitya'],['weapon'])).toEqual({});
 });
 it('retains an earlier reviewed contradiction when direct collection recovers with the same primary value',async()=>{
  const at=new Date('2026-10-11T11:00:00Z');
  const live=async(url:string)=>({url,status:200,mime:'text/html',body:Buffer.from(url.includes('icy-veins.com')?'<h1>Valeriy Profile</h1><p>Valeriy is a 4-Star Electro Sword character.</p>':'<h1>Other</h1>')});
  const fields=await new CatalogSecondarySources(live,async()=>{},at).collect(['Valeriy'],['rarity']);
  expect(fields.rarity).toMatchObject({value:4,conflict:true,fetchedAt:at.toISOString(),alternatives:[{value:5,fetchedAt:'2026-10-11T10:14:23.000Z'}]});
  expect(eligibility(fields,[],at).status).toBe('CONFLICT');
 });
});
