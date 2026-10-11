import 'dotenv/config';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { applyReleaseDatePlan, releaseDatePlan } from '../src/application/character-catalog/catalog-date-backfill.js';

const args = process.argv.slice(2), path=args[args.indexOf('--plan')+1];
if (!args.includes('--plan') || !path) throw new Error('--plan FILE required');
const body=await fs.readFile(path), hash=createHash('sha256').update(body).digest('hex');
const plan=releaseDatePlan.parse(JSON.parse(body.toString('utf8')));
if(!args.includes('--apply')) console.log(JSON.stringify({mode:'PLAN_ONLY',planSha256:hash,planned:plan.entries.length,sourceUrl:plan.sourceUrl,sourceSha256:plan.sourceSha256}));
else {
 if(args[args.indexOf('--expect-plan-sha')+1]!==hash||!args.includes('--expect-plan-sha')) throw new Error('Reviewed plan SHA256 required');
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env['DATABASE_URL']!,max:2})});
 try{console.log(JSON.stringify({mode:'APPLIED',planSha256:hash,...await applyReleaseDatePlan(db,plan)}));}finally{await db.$disconnect();}
}
