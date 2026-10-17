import 'dotenv/config';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../generated/prisma/client.js';
import {ExplorationBackgroundStock} from '../src/application/exploration/background-stock.js';
import sharp from 'sharp';

const args=process.argv.slice(2),argument=(name:string)=>{const index=args.indexOf(name);if(index<0||!args[index+1])throw Error(`Required argument: ${name}`);return args[index+1]!;};
if(args.includes('--help')){console.log('Private rehearsal only: --schema batch_test_UUID --candidate UUID --file landscape.png|jpg --rights-confirmed');process.exit(0);}
const schema=argument('--schema'),candidate=argument('--candidate'),source=path.resolve(argument('--file'));
if(!/^batch_test_[a-f0-9]{32}$/.test(schema)||!args.includes('--rights-confirmed')||!/^[a-f0-9-]{36}$/i.test(candidate))throw Error('Private schema and explicit rights confirmation required.');
const bytes=await readFile(source);if(bytes.length>10000000)throw Error('Background exceeds10MB.');
let width=0,height=0,extension='';
if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.length>=33&&bytes.toString('ascii',12,16)==='IHDR'){
  width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);extension='png';
}else if(bytes[0]===255&&bytes[1]===216){
  let offset=2;
  while(offset+9<bytes.length){if(bytes[offset]!==255)break;const marker=bytes[offset+1]!;if(marker===217||marker===218)break;const length=bytes.readUInt16BE(offset+2);if(length<2||offset+length+2>bytes.length)break;if([192,193,194].includes(marker)){height=bytes.readUInt16BE(offset+5);width=bytes.readUInt16BE(offset+7);extension='jpg';break;}offset+=length+2;}
}
if(!extension||width<800||height<400||width<=height||width>10000||height>10000)throw Error('A valid landscape PNG/JPEG is required.');
const image=sharp(bytes,{limitInputPixels:20000000}),metadata=await image.metadata();
if(!['png','jpeg'].includes(metadata.format??'')||metadata.width!==width||metadata.height!==height||(metadata.pages??1)>1||(metadata.orientation??1)!==1)throw Error('A static landscape with verified dimensions is required.');
await image.stats(); // Decode the complete image before accepting its header/hash.
const sha256=createHash('sha256').update(bytes).digest('hex'),localPath=`/assets/exploration/backgrounds/${sha256}.${extension}`;
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),destination=path.resolve(repository,'public'+localPath);
const permitted=path.resolve(repository,'public/assets/exploration/backgrounds');if(path.dirname(destination)!==permitted)throw Error('Unsafe background destination.');
const connectionString=process.env['DATABASE_URL'];if(!connectionString)throw Error('DATABASE_URL required.');
const pool=new pg.Pool({connectionString,options:`-c search_path=${schema},public`,max:1,connectionTimeoutMillis:10000});
const database=new PrismaClient({adapter:new PrismaPg(pool,{schema,disposeExternalPool:true})});
try{
  const rows=await database.$queryRaw<{schema:string}[]>`SELECT current_schema() AS schema`;if(rows[0]?.schema!==schema)throw Error('Private schema unavailable.');
  const row=await database.explorationBackground.findUniqueOrThrow({where:{id:candidate}});
  if(row.state!=='CANDIDATE'&&row.sha256!==sha256)throw Error('Candidate is not awaiting import.');
  await mkdir(permitted,{recursive:true});await writeFile(destination,bytes);
  const approved=await new ExplorationBackgroundStock(database).approve(candidate,{localPath,sha256,width,height,rightsConfirmed:true});
  console.log(JSON.stringify({region:approved.regionKey,path:approved.localPath,sha256:approved.sha256,state:approved.state}));
}finally{await database.$disconnect();}
