import { describe, it, expect } from 'vitest';
import { mergeEvidence, type CatalogFields, type Evidence, normalizedIdentity } from '../src/application/character-catalog/catalog-policy.js';
import { resolveConsensus } from '../src/application/character-catalog/catalog-consensus.js';
import { adminCandidateProjection, progressiveEligibility, publicPreparation } from '../src/application/character-catalog/catalog-progressive.js';
import { officialPlayableEvidence, parseOfficialPost } from '../src/infrastructure/character-catalog/catalog-sources.js';
import { parseSecondaryMetadata, CatalogSecondarySources, secondaryProviders } from '../src/infrastructure/character-catalog/catalog-secondary.js';
const now=new Date('2026-10-11T10:00:00Z');
const proof=(value:string|number,reliability:Evidence['reliability']='OFFICIAL'):Evidence=>({value,reliability,provider:'hoyoverse',url:'https://www.hoyolab.com/article/123',fetchedAt:now.toISOString()});
const editor=(publisher:string,value=4,extra:Partial<NonNullable<Evidence['consensusSource']>>={}):Evidence=>({...proof(value,'PROVISIONAL'),provider:publisher,url:`https://${publisher}.test/profile`,consensusSource:{publisher,identity:'private',qualified:true,observedAt:now.toISOString(),...extra}});
const fields:CatalogFields={originalName:proof('Private'),rarity:proof(4),element:proof('electro'),releaseDate:proof('2026-10-18')};
function combine(values:Evidence[]){return values.reduce((result,entry)=>mergeEvidence(result,'rarity',entry),{} as CatalogFields).rarity!;}
describe('progressive catalogue authorization',()=>{
  it.each(['https://www.icy-veins.com/original','https://origin.example/article'])('collapses unnamed attribution links to a common upstream %s', upstream=>{
    let collected:CatalogFields={originalName:proof('Private'),releaseDate:fields.releaseDate};
    for(const [provider,url] of [['icy-veins','https://www.icy-veins.com/profile'],['game8','https://game8.co/profile'],['sephijin','https://sephijin.fr/profile']]){
      const html=`<h1>Private Guide</h1><p>Private is a 4-Star Electro Sword character.</p><p>Article original : <a href="${upstream}">Consulter les données originales</a></p><script type="application/ld+json">${JSON.stringify({'@type':'Article',headline:'Private Guide',url,dateModified:now.toISOString()})}</script>`;
      for(const [key,value] of Object.entries(parseSecondaryMetadata(html,url!,provider!,['Private'],now)))collected=mergeEvidence(collected,key as keyof CatalogFields,value!);
    }
    const state=progressiveEligibility(collected,now);
    expect(state.status).toBe('INCOMPLETE');
    expect(state.fields.rarity?.consensus?.editors).toBe(1);
    expect(state.missing).toContain('rarityConfirmation');
  });
  it('exposes a partial J-7 preparation without creating any invented combat field',()=>{
    const row={id:'private',name:'Private',characterId:null,progressivePolicy:true,fields:{originalName:fields.originalName,releaseDate:fields.releaseDate},assets:[]};
    expect(publicPreparation(row,now)).toMatchObject({status:'PREPARATION',rarity:null,elementKey:null,releaseDate:'2026-10-18',iconPath:null});
    expect(progressiveEligibility(row.fields,now)).toMatchObject({status:'INCOMPLETE',publicVisible:true,missing:expect.arrayContaining(['rarity','element'])});
    expect(publicPreparation({...row,fields:{...row.fields,releaseDate:proof('2026-10-19')}},now)).toBeNull();
    expect(publicPreparation({...row,progressivePolicy:false},now)).toBeNull();
  });
  it('activates with complete safe combat fields without optional IDs/images/weapon/region',()=>{
    expect(progressiveEligibility(fields,now)).toMatchObject({status:'ELIGIBLE',missing:[]});
    expect(progressiveEligibility({...fields,rarity:proof(0)},now).missing).toContain('rarity');
    expect(progressiveEligibility({...fields,element:proof('unknown')},now).missing).toContain('element');
    expect(progressiveEligibility({...fields,releaseDate:proof('2026-02-31')},now).missing).toContain('availabilityEvidence');
  });
  it('projects current ADMIN minimums without rewriting the old worker diagnosis or optional gaps',()=>{
    const row={characterId:null,progressivePolicy:true,fields,status:'INCOMPLETE',missing:['icon','splash','numericId'],assets:[]};
    const projection=adminCandidateProjection(row,now);
    expect(projection).toMatchObject({status:'ELIGIBLE',missing:[],optionalMissing:expect.arrayContaining(['icon','splash','numericId']),lastCycleStatus:'INCOMPLETE'});
    expect(row.missing).toEqual(['icon','splash','numericId']);
    expect(adminCandidateProjection({...row,progressivePolicy:false},now).missing).toEqual(row.missing);
  });
  it('normalizes known optional weapons while retaining raw provenance and never requiring an unknown weapon',()=>{
    expect(mergeEvidence({},'weapon',{...proof('Sword','PROVISIONAL'),provider:'icy-veins'}).weapon).toMatchObject({value:'Épée',rawValue:'Sword',reliability:'PROVISIONAL'});
    expect(progressiveEligibility({...fields,weapon:proof('unknown','PROVISIONAL')},now).status).toBe('ELIGIBLE');
  });
  it('accepts nominal actual playable proof without fabricating a release date; rejects future/rumor/fan',()=>{
    const post={id:'123',url:'https://www.hoyolab.com/article/123',date:now.toISOString(),name:null,fields:{},promotion:[],text:'Private is now available as a playable character.'};
    const playable=officialPlayableEvidence(post,['Private'],now)!;
    expect(progressiveEligibility({...fields,releaseDate:undefined,playable},now)).toMatchObject({status:'ELIGIBLE',officialDate:null});
    for(const text of ['Private will be available soon.','Other is now available.','Private is now available on the beta test server.','Private is not now playable.','Private is now available in an Event Wish not yet open.','Private n’est pas maintenant disponible comme personnage jouable.','Private n’est plus maintenant disponible comme personnage jouable.'])expect(officialPlayableEvidence({...post,text},['Private'],now)).toBeNull();
    expect(()=>parseOfficialPost({post:{post_id:'123',uid:'fan',game_id:2,created_at:1,subject:'Fake',structured_content:'[]',is_deleted:0},user:{uid:'fan',certification:{type:1,desc:'Official Big Boss'}}},now)).toThrow('AUTHOR_NOT_OFFICIAL');
  });
  it('requires three independent editors and a clear two-thirds majority; keeps dissent',()=>{
    const mixed=combine([editor('icy-veins'),editor('game8'),editor('sephijin',5)]);
    expect(resolveConsensus(mixed,'private',now)).toMatchObject({value:4,reliability:'PROVISIONAL',qualification:'PROVISIONAL_CONSENSUS',conflict:true,consensus:{editors:3,supportingEditors:2},alternatives:expect.arrayContaining([expect.objectContaining({value:5})])});
    expect(resolveConsensus(combine([editor('icy-veins'),editor('game8',5)]),'private',now).qualification).toBe('CONFLICT');
    expect(progressiveEligibility({...fields,rarity:resolveConsensus(mixed,'private',now)},now).status).toBe('ELIGIBLE');
  });
  it('shows actual availability despite a future official date, but blocks contradictory activation',()=>{
    const contradictory={...fields,releaseDate:proof('2026-11-01'),playable:proof('available')};
    expect(progressiveEligibility(contradictory,now)).toMatchObject({status:'CONFLICT',publicVisible:true,availabilityConflict:true,missing:['availabilityConflict']});
    expect(publicPreparation({id:'private',name:'Private',characterId:null,progressivePolicy:true,fields:contradictory,assets:[]},now)).toMatchObject({status:'PREPARATION',releaseDate:null});
  });
  it('binds editor freshness to a named Article instead of website or unrelated structured metadata',()=>{
    const page=(record:object)=>`<h1>Private Guide</h1><p>Private is a 4-Star Electro Sword character.</p><script type="application/ld+json">${JSON.stringify(record)}</script>`;
    const parse=(record:object)=>parseSecondaryMetadata(page(record),'https://game8.co/profile','game8',['Private'],now).rarity?.consensusSource;
    expect(parse({'@type':'WebSite',name:'Private',dateModified:now.toISOString()})?.qualified).toBe(false);
    expect(parse({'@type':'Article',headline:'Other guide',dateModified:now.toISOString()})?.qualified).toBe(false);
    expect(parse({'@type':'Article',headline:'Private Guide',url:'https://game8.co/other',dateModified:now.toISOString()})?.qualified).toBe(false);
    expect(parse({'@type':'Article',headline:'Private Guide',url:'https://game8.co/profile',dateModified:now.toISOString()})?.qualified).toBe(true);
  });
  it('counts same publisher URLs once, copied upstream once, and ambiguous publisher zero',()=>{
    const same=combine([editor('icy-veins'),{...editor('icy-veins'),url:'https://icy-veins.test/another'},editor('game8')]);
    expect(resolveConsensus(same,'private',now).consensus?.editors).toBe(2);
    const copies=combine(['icy-veins','game8','sephijin'].map(publisher=>editor(publisher,4,{upstream:'same-leaker'})));
    expect(resolveConsensus(copies,'private',now).qualification).toBe('PROVISIONAL');
    expect(resolveConsensus(copies,'private',now).consensus?.editors).toBe(1);
    const ambiguous=combine([editor('icy-veins'),{...editor('icy-veins',5),url:'https://icy-veins.test/cartouche'},editor('game8'),editor('sephijin')]);
    expect(resolveConsensus(ambiguous,'private',now)).toMatchObject({qualification:'CONFLICT',consensus:{editors:2}});
  });
  it('does not vote stale, withdrawn, different identity, or unqualified leak evidence',()=>{
    for(const extra of [{observedAt:'2026-01-01'},{observedAt:'invalid'},{publisher:'wrong'},{withdrawn:true},{identity:'other'},{qualified:false}]) {
      const combined=combine([editor('icy-veins',4,extra),editor('game8'),editor('sephijin')]);
      expect(resolveConsensus(combined,'private',now).qualification).toBe('PROVISIONAL');
    }
    const html='<h1>Private Guide</h1><script type="application/ld+json">{"dateModified":"2026-10-10"}</script><p>Private is a 4-Star Electro Sword character. Leaks from the same leaker.</p>';
    expect(parseSecondaryMetadata(html,'https://game8.co/profile','game8',['Private'],now).rarity?.consensusSource?.qualified).toBe(false);
  });
  it('official and ADMIN priority survives consensus, preserving opposing provenance',()=>{
    const provisional=combine([editor('icy-veins'),editor('game8'),editor('sephijin')]);
    const official=mergeEvidence({rarity:provisional},'rarity',proof(5)).rarity!;
    expect(resolveConsensus(official,'private',now)).toMatchObject({value:5,reliability:'OFFICIAL',conflict:true});
    const locked={...proof(5,'ADMIN'),locked:true,override:true};
    expect(mergeEvidence({rarity:locked},'rarity',provisional).rarity).toBe(locked);
  });
  it('refreshes same-value alternative attestations and retires an older vote after withdrawal',()=>{
    const stale={...editor('game8',4,{observedAt:'2026-08-01'}),fetchedAt:'2026-08-01T10:00:00Z'};
    const refreshed=combine([editor('icy-veins'),stale,editor('sephijin'),editor('game8')]);
    expect(resolveConsensus(refreshed,'private',now).qualification).toBe('PROVISIONAL_CONSENSUS');
    const withdrawn=combine([refreshed,{...editor('game8',4,{withdrawn:true}),fetchedAt:'2026-10-11T10:01:00Z'}]);
    expect(resolveConsensus(withdrawn,'private',new Date('2026-10-11T10:02:00Z')).consensus?.editors).toBe(2);
  });
  it('collector retains same-value provenance for all independent publishers',async()=>{
    const sources=new CatalogSecondarySources(async url=>({url,status:200,mime:'text/html',body:Buffer.from(secondaryProviders.some(provider=>provider.index===url)?'<a href="/private-guide">Private Guide</a>':'<h1>Private Guide</h1><p>Private is a 4-Star Electro Sword character.</p><script type="application/ld+json">{"@type":"Article","headline":"Private Guide","dateModified":"2026-10-10"}</script>')}),async()=>{},now);
    const collected=await sources.collect(['Private'],['rarity']);
    expect(resolveConsensus(collected.rarity!,normalizedIdentity('Private'),now)).toMatchObject({qualification:'PROVISIONAL_CONSENSUS',consensus:{editors:3}});
  });
  it('binds playable availability to the exact nominal subject and predicate, up to the activation gate',()=>{
    const post={id:'123',url:'https://www.hoyolab.com/article/123',date:now.toISOString(),name:null,fields:{},promotion:[],text:''};
    for(const text of ['Private gets a character trailer. Other is now available as a playable character.','NotPrivate is now available as a playable character.','Private gets a character trailer; Other is now playable.','Other is now playable, while Private gets a trailer.','Private gets a trailer and Other is now playable.']){
      const playable=officialPlayableEvidence({...post,text},['Private'],now);
      expect(playable).toBeNull();
      expect(progressiveEligibility({...fields,releaseDate:undefined,...(playable?{playable}:{})},now)).toMatchObject({status:'INCOMPLETE',publicVisible:false,missing:['availabilityEvidence']});
    }
    for(const text of ['Private is now available as a playable character.','The new 4-Star character “Private” is now playable.','Private is now available in the Event Wish.','Private est désormais disponible comme personnage jouable.'])expect(officialPlayableEvidence({...post,text},['Private'],now)).toMatchObject({value:'available',reliability:'OFFICIAL'});
    expect(officialPlayableEvidence({...post,text:'Private is now available as a playable character?'},['Private'],now)).toBeNull();
  });
  it('retires facts removed from fresh nominal profiles through collect, merge, qualification and eligibility',async()=>{
    const page=(mode:string)=>`<h1>${mode==='wrongIdentity'?'Other':'Private'} Guide</h1>${mode==='full'?'<p>Private is a 4-Star Electro Sword character.</p>':'<p>The previous rarity claim has been removed pending confirmation.</p>'}${mode==='undated'?'':'<script type="application/ld+json">{"@type":"Article","headline":"Private Guide","dateModified":"2026-10-10"}</script>'}`;
    const collect=(mode:string,at=now)=>new CatalogSecondarySources(async url=>{
      const index=secondaryProviders.some(provider=>provider.index===url);
      const affected=url.startsWith('https://game8.co');
      if(affected&&!index&&mode==='timeout')throw new Error('synthetic timeout');
      return {url,status:affected&&!index&&mode==='403'?403:200,mime:'text/html',body:Buffer.from(index?(affected&&mode==='indexAbsent'?'<p>No profile link</p>':'<a href="/private-guide">Private Guide</a>'):page(affected?mode:'full'))};
    },async()=>{},at).collect(['Private'],['rarity','element']);
    const first=await collect('full');
    expect(progressiveEligibility({...fields,rarity:first.rarity,element:first.element},now).status).toBe('ELIGIBLE');
    const refreshed=await collect('removed');
    const merged=mergeEvidence(mergeEvidence(first,'rarity',refreshed.rarity!),'element',refreshed.element!);
    const state=progressiveEligibility({...fields,rarity:merged.rarity,element:merged.element},now);
    expect(state).toMatchObject({status:'INCOMPLETE',missing:['rarityConfirmation','elementConfirmation']});
    expect(state.fields.rarity).toMatchObject({value:4,qualification:'PROVISIONAL',conflict:false,consensus:{editors:2},alternatives:expect.arrayContaining([expect.objectContaining({provider:'game8',value:4}),expect.objectContaining({provider:'game8',consensusSource:expect.objectContaining({withdrawn:true})})])});
    const preparation=publicPreparation({id:'private',name:'Private',characterId:null,progressivePolicy:true,fields:state.fields,assets:[]},now)!;
    expect(preparation).toMatchObject({rarity:null,elementKey:null,provisional:true});
    expect(JSON.stringify(preparation)).not.toContain('SOURCE_WITHDRAWN');
    for(const mode of ['403','timeout','indexAbsent','undated','wrongIdentity']){
      const unavailable=await collect(mode);
      expect(resolveConsensus(mergeEvidence(first,'rarity',unavailable.rarity!).rarity!,'private',now)).toMatchObject({qualification:'PROVISIONAL_CONSENSUS',consensus:{editors:3}});
    }
    const later=new Date(now.getTime()+60_000),reasserted=await collect('full',later);
    expect(resolveConsensus(mergeEvidence(merged,'rarity',reasserted.rarity!).rarity!,'private',later).qualification).toBe('PROVISIONAL_CONSENSUS');
  });
  it('requires exact Unicode nominal boundaries in secondary descriptions, including the three-editor activation circuit',async()=>{
    const page=(name:string,subject:string)=>`<h1>${name} Guide</h1><p>${subject} is a 4-Star Electro Sword character.</p><script type="application/ld+json">${JSON.stringify({'@type':'Article',headline:`${name} Guide`,dateModified:'2026-10-10'})}</script>`;
    for(const subject of ['NotPrivate','ÉPrivate','界Private','_Private','Not-Private',"Not'Private",'PrivateOther','Privateé']){
      const parsed=parseSecondaryMetadata(page('Private',subject),'https://game8.co/profile','game8',['Private'],now);
      expect(parsed.rarity?.consensusSource?.withdrawn).toBe(true);
      expect(parsed.rarity?.value).not.toBe(4);
    }
    for(const name of ['Private','Kaedehara Kazuha','Émilie','Émilie Étoile','Jean-Pierre']){
      const parsed=parseSecondaryMetadata(page(name,name.normalize('NFD')),'https://game8.co/profile','game8',[name],now);
      expect(parsed.rarity).toMatchObject({value:4,consensusSource:{qualified:true,identity:normalizedIdentity(name)}});
      expect(parsed.element?.value).toBe('electro');
    }
    const collected=await new CatalogSecondarySources(async url=>({url,status:200,mime:'text/html',body:Buffer.from(secondaryProviders.some(provider=>provider.index===url)?'<a href="/private-guide">Private Guide</a>':page('Private','NotPrivate'))}),async()=>{},now).collect(['Private'],['rarity','element']);
    const state=progressiveEligibility({...fields,rarity:collected.rarity,element:collected.element},now);
    expect(state).toMatchObject({status:'INCOMPLETE',missing:['rarity','element']});
    expect(state.fields.rarity?.consensus?.editors).toBe(0);
    expect(publicPreparation({id:'private',name:'Private',characterId:null,progressivePolicy:true,fields:state.fields,assets:[]},now)).toMatchObject({rarity:null,elementKey:null});
  });
});
