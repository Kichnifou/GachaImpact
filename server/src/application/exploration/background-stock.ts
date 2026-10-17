import {Prisma,type PrismaClient} from '../../../generated/prisma/client.js';
import {getBusinessDate} from '../../domain/time/business-date.js';
import {activeExplorationRegions} from './regions.js';

export type BackgroundCandidate={sourceUrl:string;imageUrl:string;licenseUrl:string;licenseName:string;attribution:string;width:number;height:number};
export type BackgroundDiscovery=(region:string)=>Promise<readonly BackgroundCandidate[]>;
export const isLocalExplorationBackground=(path:string)=>/^\/assets\/exploration\/backgrounds\/[a-f0-9]{64}\.(png|jpg)$/.test(path);
const reusableLicense=(url:string)=>/^https:\/\/creativecommons\.org\/(?:licenses\/by(?:-sa)?\/\d\.\d|publicdomain\/(?:zero|mark)\/1\.0)\/?$/.test(url);
const plain=(value:unknown)=>typeof value==='string'?value.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,1000):'';
/** Discovery is metadata only. Search results never become approved assets. */
export const discoverCommonsBackgrounds:BackgroundDiscovery=async(region)=>{
  const url=new URL('https://commons.wikimedia.org/w/api.php');
  url.search=new URLSearchParams({action:'query',format:'json',generator:'search',gsrnamespace:'6',gsrlimit:'5',gsrsearch:`${region} Genshin landscape`,prop:'imageinfo',iiprop:'url|size|extmetadata'}).toString();
  const response=await fetch(url,{headers:{'User-Agent':'GachaImpact-landscape-review/1.0'},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('BACKGROUND_DISCOVERY_UNAVAILABLE');
  const payload=await response.json() as {query?:{pages?:Record<string,{imageinfo?:{url?:string;descriptionurl?:string;width?:number;height?:number;extmetadata?:Record<string,{value?:string}>}[]}>}};
  const values:BackgroundCandidate[]=[];
  for(const page of Object.values(payload.query?.pages??{})){
    const image=page.imageinfo?.[0];if(!image||!Number.isSafeInteger(image.width)||!Number.isSafeInteger(image.height)||image.width!<800||image.height!<400||image.width!<=image.height!)continue;
    if(!image.url?.startsWith('https://upload.wikimedia.org/')||!image.descriptionurl?.startsWith('https://commons.wikimedia.org/wiki/File:'))continue;
    const metadata=image.extmetadata??{};
    values.push({sourceUrl:image.descriptionurl,imageUrl:image.url,licenseUrl:plain(metadata['LicenseUrl']?.value),licenseName:plain(metadata['LicenseShortName']?.value)||'Droits à vérifier',attribution:plain(metadata['Artist']?.value)||'Auteur à vérifier',width:image.width!,height:image.height!});
  }
  return values;
};

export class ExplorationBackgroundStock {
  constructor(private readonly db:PrismaClient,private readonly now:()=>Date=()=>new Date(),private readonly discover:BackgroundDiscovery=discoverCommonsBackgrounds){}
  async tick(){
    const now=this.now(),regions=await activeExplorationRegions(this.db);
    for(const region of regions)await this.db.explorationBackgroundSearch.upsert({where:{regionKey:region.key},create:{regionKey:region.key,regionName:region.name},update:{regionName:region.name}});
    const hour=Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Paris',hour:'numeric',hourCycle:'h23'}).format(now));
    if(hour<3)return; // One nightly cycle/catch-up, never all missed days.
    const day=getBusinessDate(now);
    for(const region of regions){
      const claimed=await this.db.$transaction(async tx=>{
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`exploration-background:${region.key}`}))`;
        const count=await tx.explorationBackground.count({where:{regionKey:region.key,state:'APPROVED'}});
        if(count>=5)return false;
        const job=await tx.explorationBackgroundSearch.findUniqueOrThrow({where:{regionKey:region.key}});
        if(job.searchedDay===day||job.leaseUntil&&job.leaseUntil>now)return false;
        await tx.explorationBackgroundSearch.update({where:{regionKey:region.key},data:{searchedDay:day,leaseUntil:new Date(+now+300000),lastResult:'SEARCHING'}});return true;
      });
      if(!claimed)continue;
      try{
        const candidates=await this.discover(region.name);
        for(const candidate of candidates.slice(0,5))await this.db.explorationBackground.upsert({where:{regionKey_sourceUrl:{regionKey:region.key,sourceUrl:candidate.sourceUrl}},create:{regionKey:region.key,...candidate},update:{}});
        await this.db.explorationBackgroundSearch.update({where:{regionKey:region.key},data:{leaseUntil:null,lastResult:candidates.length?'AWAITING_RIGHTS_REVIEW':'NO_QUALIFIED_CANDIDATE'}});
      }catch{await this.db.explorationBackgroundSearch.update({where:{regionKey:region.key},data:{leaseUntil:null,lastResult:'DISCOVERY_UNAVAILABLE'}});}
    }
  }
  async approve(candidateId:string,asset:{localPath:string;sha256:string;width:number;height:number;rightsConfirmed:boolean}){
    if(!asset.rightsConfirmed||!isLocalExplorationBackground(asset.localPath)||!/^[a-f0-9]{64}$/.test(asset.sha256)||!asset.localPath.includes(asset.sha256)||asset.width<=asset.height||asset.height<400)throw Error('BACKGROUND_IMPORT_INVALID');
    return this.db.$transaction(async tx=>{
      const anchor=await tx.explorationBackground.findUniqueOrThrow({where:{id:candidateId},select:{regionKey:true}});
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`exploration-background:${anchor.regionKey}`}))`;
      const candidate=await tx.explorationBackground.findUniqueOrThrow({where:{id:candidateId}});
      if(candidate.regionKey!==anchor.regionKey)throw Error('BACKGROUND_REGION_CHANGED');
      if(candidate.state==='APPROVED'){if(candidate.sha256!==asset.sha256)throw Error('BACKGROUND_ALREADY_IMPORTED');return candidate;}
      if(candidate.state!=='CANDIDATE'||!reusableLicense(candidate.licenseUrl)||!candidate.attribution||candidate.attribution==='Auteur à vérifier'||!candidate.sourceUrl.startsWith('https://'))throw Error('BACKGROUND_RIGHTS_UNVERIFIED');
      const existing=await tx.explorationBackground.findMany({where:{regionKey:candidate.regionKey,state:'APPROVED'}});
      if(existing.length>=5)throw Error('BACKGROUND_STOCK_FULL');if(existing.some(row=>row.sha256===asset.sha256))throw Error('BACKGROUND_DUPLICATE');
      return tx.explorationBackground.update({where:{id:candidateId},data:{state:'APPROVED',localPath:asset.localPath,sha256:asset.sha256,width:asset.width,height:asset.height}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }
}
