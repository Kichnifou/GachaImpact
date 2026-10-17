import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { ExplorationBackgroundStock } from '../src/application/exploration/background-stock.js';
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('Private rehearsal metadata only: --schema batch_test_UUID. No image download or automatic approval.');process.exit(0);}
const schema=args[args.indexOf('--schema')+1];
if(args.length!==2||args[0]!=='--schema'||!schema||!/^batch_test_[a-f0-9]{32}$/.test(schema))throw Error('Private schema required.');
const connectionString=process.env['DATABASE_URL'];if(!connectionString)throw Error('DATABASE_URL required.');
const pool=new pg.Pool({connectionString,options:`-c search_path=${schema},public`,max:1,connectionTimeoutMillis:10000});
const db=new PrismaClient({adapter:new PrismaPg(pool,{schema,disposeExternalPool:true})});
try{
  if((await db.$queryRaw<{schema:string}[]>`SELECT current_schema() AS schema`)[0]?.schema!==schema)throw Error('Private schema unavailable.');
  await new ExplorationBackgroundStock(db).tick();
  const queue=await db.explorationBackgroundSearch.findMany({select:{regionKey:true,regionName:true,lastResult:true,searchedDay:true},orderBy:{regionKey:'asc'}});
  const candidates=await db.explorationBackground.findMany({where:{state:'CANDIDATE'},select:{id:true,regionKey:true,sourceUrl:true,licenseUrl:true,licenseName:true,attribution:true,width:true,height:true},orderBy:{regionKey:'asc'}});
  console.log(JSON.stringify({metadataOnly:true,queue,candidates},null,2));
}finally{await db.$disconnect();}
