import { mergeEvidence, normalizedIdentity, type CatalogFields, type Evidence } from '../../application/character-catalog/catalog-policy.js';
import type { CatalogHttp } from './catalog-http.js';
import { CatalogFetchError } from './catalog-http.js';
import type { AttemptSink } from './catalog-sources.js';

export const secondaryProviders = [
  { id: 'icy-veins', index: 'https://www.icy-veins.com/genshin-impact/', bookmarks: [
    'https://www.icy-veins.com/genshin-impact/mitya-guide-best-builds',
    'https://www.icy-veins.com/genshin-impact/mitya-profile-talents-constellations',
    'https://www.icy-veins.com/genshin-impact/valeriy-profile-talents-constellations'] },
  { id: 'game8', index: 'https://game8.co/games/Genshin-Impact', bookmarks: [] },
  { id: 'sephijin', index: 'https://sephijin.fr/genshin-impact-personnages/', bookmarks: ['https://sephijin.fr/mitya-farm/','https://sephijin.fr/valeriy-farm/'] },
] as const;
/** Binary references exposed by a real profile and visually reviewed on this date.
 * Review qualifies the role/provenance, never rarity, release or publication. */
export const reviewedSecondaryImages = [{ name:'Mitya', role:'icon' as const, provider:'icy-veins',
  sourcePage:'https://www.icy-veins.com/genshin-impact/mitya-profile-talents-constellations', reviewedAt:'2026-10-11',
  url:'https://static.icy-veins.com/images/genshin-impact/characters/mitya.webp', editorialStatus:'PROVISIONAL' as const,
  sourceHash:'fe5a5d08ab1b1c59e9775770b27f9c31442e8c5601d3bc5c5a54af6f4baa365d' },
 { name:'Valeriy', role:'icon' as const, provider:'icy-veins',
  sourcePage:'https://www.icy-veins.com/genshin-impact/valeriy-profile-talents-constellations', reviewedAt:'2026-10-11',
  url:'https://static.icy-veins.com/images/genshin-impact/characters/valeriy.webp', editorialStatus:'PROVISIONAL' as const,
  sourceHash:'aceb91df588ff45aa1b427bbcedf9fe142e30f9ccb3e624cbb4e4d17682fe321' }];
// Explicit, short-lived reading cache after the direct collector returned 403.
// Original consultation dates survive replays; this never masquerades as a live fetch.
export const reviewedSecondaryProfiles = [
  {name:'Mitya',url:'https://www.icy-veins.com/genshin-impact/mitya-profile-talents-constellations',
    reviewedAt:'2026-10-11T10:14:23.000Z',rarity:5,weapon:'Catalyst',contradictoryRarity:null},
  {name:'Valeriy',url:'https://www.icy-veins.com/genshin-impact/valeriy-profile-talents-constellations',
    reviewedAt:'2026-10-11T10:14:23.000Z',rarity:4,weapon:'Sword',contradictoryRarity:5},
] as const;
export function htmlText(html: string) {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => { const point = code[0]?.toLowerCase() === 'x' ? parseInt(code.slice(1),16) : Number(code); return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' '; })
    .replace(/&nbsp;|&amp;|&quot;|&#39;/g, value => ({'&nbsp;':' ','&amp;':'&','&quot;':'"','&#39;':"'"})[value]!).replace(/\s+/g,' ').trim();
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function articleObservedAt(html:string,name:string,url:string):string {
  for(const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{
      const parsed:unknown=JSON.parse(script[1]!);
      const records=(value:unknown):Record<string,unknown>[]=>Array.isArray(value)?value.flatMap(records):value&&typeof value==='object'?[value as Record<string,unknown>,...records((value as Record<string,unknown>)['@graph'])]:[];
      for(const record of records(parsed)){
        if(![record['@type']].flat().some(type=>['Article','NewsArticle','BlogPosting'].includes(String(type))))continue;
        const title=String(record['headline']??record['name']??'');
        if(!new RegExp(`\\b${escape(name)}\\b`,'iu').test(title))continue;
        const articleUrl=record['url'];if(articleUrl&&articleUrl!==url)continue;
        const date=record['dateModified']??record['datePublished'];if(typeof date==='string')return date;
      }
    }catch{/* Malformed/unbound structured metadata cannot qualify an editor. */}
  }
  return '';
}
export function linkedCharacterPages(html: string, index: string, names: readonly string[]) {
  const paths = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = htmlText(match[2]!);
    if (!names.some(name => new RegExp(`^${escape(name)}(?:\\s+(?:Rating|Guide|Build|Profile|Best|–|—|\\|)|$)`, 'i').test(label))) continue;
    try { const url = new URL(match[1]!,index); if (url.origin === new URL(index).origin && url.protocol === 'https:' && !url.hash && !url.search && !url.username && !url.password) paths.add(url.href); } catch { /* invalid link */ }
  }
  return [...paths].slice(0,2);
}
/** Secondary facts are preparation only; never official publication evidence. */
export function parseSecondaryMetadata(html: string, url: string, provider: string, names: readonly string[], now: Date): CatalogFields {
  const heading = htmlText(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? '');
  const name = names.find(value => new RegExp(`\\b${escape(value)}\\b`,'i').test(heading));
  if (!name || !['icy-veins','game8','sephijin'].includes(provider)) return {};
  const text = htmlText(html);
  const description = new RegExp(`${escape(name)}\\s+(?:is|est)\\s+(?:a[n]?|un[e]?)\\s+(?:new\\s+)?([45])(?:[- ]?(?:Star|étoiles)|★)\\s+(Pyro|Hydro|Cryo|Electro|Électro|Anemo|Geo|Dendro)(?:\\s+(?:character|personnage))?(?:\\s+(?:who uses|using|de type))?\\s*(Catalyst|Sword|Claymore|Polearm|Bow|Catalyseur|Épée|Lance|Arc)?`, 'iu').exec(text);
  const fields: CatalogFields = {};
  const reason = /\b(leaks?|beta|bêta|datamin)/i.test(text) ? 'Source secondaire contenant des informations de leak/bêta ; confirmation officielle absente.' : 'Source secondaire ; confirmation officielle indépendante absente.';
  const observedAt = articleObservedAt(html,name,url);
  const observed = new Date(observedAt).getTime();
  const qualified = Number.isFinite(observed) && observed <= now.getTime() && now.getTime()-observed <= 30*86_400_000 && !/\b(leaks?|beta|bêta|datamin|rumou?r|speculat|according to|d'après|source\s*:|credits?\s*:|via\s)/i.test(text);
  // Attribution to another publisher collapses its vote with that upstream.
  const upstream = secondaryProviders.find(source=>source.id!==provider && text.toLowerCase().includes(source.id.replace('-',' ')))?.id;
  const add = (field: keyof CatalogFields, value: string | number) => { fields[field] = { value, provider, url, fetchedAt: now.toISOString(), reliability:'PROVISIONAL', editorialStatus:'PROVISIONAL', reason,
    consensusSource:{publisher:provider,...(upstream?{upstream}:{}),identity:normalizedIdentity(name),qualified,observedAt} } satisfies Evidence; };
  if(!description){
    // Private control attestations only: a current, dated nominal article no longer supports these facts.
    // Outages, an absent index link and an unqualified/ambiguous page never imply withdrawal.
    if(qualified)for(const field of ['rarity','element'] as const){add(field,'SOURCE_WITHDRAWN');fields[field]={...fields[field]!,reason:'Attestation retirée : fait absent du profil nominal daté relu avec succès.',consensusSource:{...fields[field]!.consensusSource!,qualified:false,withdrawn:true}};}
    return fields;
  }
  add('rarity',Number(description[1])); add('element',description[2]!.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
  const ratings = [...text.matchAll(/(?:Rarity\s*[:：]?\s*|Rating\s*[:：]?\s*)([45])\s*(?:Stars?|★|étoiles)/giu)].map(match=>Number(match[1]));
  if (ratings.some(rarity=>rarity!==Number(description[1]))) fields.rarity = {...fields.rarity!,conflict:true,alternatives:ratings.filter(rarity=>rarity!==Number(description[1])).map(value=>({...fields.rarity!,value}))};
  if (description[3]) add('weapon',description[3]);
  return fields;
}
export class CatalogSecondarySources {
  private readonly cache = new Map<string, Promise<string | null>>();
  constructor(private readonly http: CatalogHttp, private readonly attempt: AttemptSink, private readonly now: Date) {}
  private page(url: string, provider: string) {
    let cached = this.cache.get(url);
    if (!cached) {
      cached = (async () => {
        try { const response = await this.http(url,{maxBytes:2*1024*1024});
          if (response.status !== 200) throw new CatalogFetchError(response.status===404?'HTTP_404':'UNAVAILABLE',response.status);
          if (!response.mime.startsWith('text/html')) throw new CatalogFetchError('SCHEMA_CHANGED');
          await this.attempt({provider,field:'secondary-page',outcome:'FOUND',sourceUrl:url,httpStatus:200}); return response.body.toString('utf8');
        } catch(error) {if(error instanceof CatalogFetchError && ['BUDGET_EXHAUSTED','LEASE_LOST'].includes(error.code)) throw error;
          await this.attempt({provider,field:'secondary-page',outcome:'ERROR',sourceUrl:url,errorCode:error instanceof CatalogFetchError?error.code:'UNAVAILABLE',...(error instanceof CatalogFetchError&&error.httpStatus?{httpStatus:error.httpStatus}:{})}); return null; }
      })(); this.cache.set(url,cached);
    }
    return cached;
  }
  async collect(names: readonly string[], requested: readonly string[]) {
    const fields: CatalogFields = {};
    if (!requested.some(field=>['rarity','element','weapon','name','originalName','icon','splash','wish','fullbody'].includes(field))) return fields;
    for (const provider of secondaryProviders) {
      const index = await this.page(provider.index,provider.id);
      const pages = index ? linkedCharacterPages(index,provider.index,names) : [];
      for (const bookmark of provider.bookmarks) if (names.some(name=>bookmark.includes(`/${normalizedIdentity(name).replaceAll(' ','-')}-`))) pages.push(bookmark);
      if (!pages.length) await this.attempt({provider:provider.id,field:'secondary-coverage',outcome:'MISSING',errorCode:index?'NOT_LISTED_IN_INDEX':'UNAVAILABLE',sourceUrl:provider.index});
      for (const url of [...new Set(pages)].slice(0,2)) {
        const html = await this.page(url,provider.id); if (!html) continue;
        for (const [field,value] of Object.entries(parseSecondaryMetadata(html,url,provider.id,names,this.now))) {
          if (!value || !requested.includes(field)) continue;
          Object.assign(fields,mergeEvidence(fields,field as keyof CatalogFields,value));
          await this.attempt({provider:provider.id,field,outcome:'PROVISIONAL',sourceUrl:url,httpStatus:200});
        }
      }
    }
    for (const profile of reviewedSecondaryProfiles) {
      const age=this.now.getTime()-new Date(profile.reviewedAt).getTime();
      if(age<0||age>7*86_400_000||!names.some(name=>normalizedIdentity(name)===normalizedIdentity(profile.name)))continue;
      for(const [field,value] of [['rarity',profile.rarity],['weapon',profile.weapon]] as const){
        if(!requested.includes(field)||(fields[field]&&!(field==='rarity'&&profile.contradictoryRarity)))continue;
        const evidence:Evidence={value,provider:'icy-veins',url:profile.url,fetchedAt:profile.reviewedAt,reliability:'PROVISIONAL',editorialStatus:'PROVISIONAL',
          reason:'Lecture web examinée le 11/10/2026 ; accès direct HTTP403 lors de cette lecture. Source secondaire liée à la préparation bêta/leaks, sans confirmation officielle. Cache de lecture limité à sept jours.'};
        const reviewed=field==='rarity'&&profile.contradictoryRarity?{...evidence,conflict:true,alternatives:[{...evidence,value:profile.contradictoryRarity,reason:'Cartouche cinq étoiles relevé lors de la lecture datée, contrairement au texte introductif quatre étoiles. Réserve historique à résoudre explicitement ; ce ne sont pas deux sources indépendantes.'}]}:evidence;
        // A recovered live fetch supplies the primary value, but cannot silently
        // erase a contradiction already reviewed on this same source.
        Object.assign(fields,mergeEvidence(fields,field,reviewed));
        await this.attempt({provider:'icy-veins',field,outcome:'REVIEWED_PROVISIONAL',sourceUrl:profile.url});
      }
    }
    return fields;
  }
}
