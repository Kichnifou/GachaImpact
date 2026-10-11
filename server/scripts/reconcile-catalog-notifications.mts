import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { planCatalogNotificationReconcile,reconcileCatalogNotifications } from '../src/application/character-catalog/catalog-notification-reconcile.js';
const args=process.argv.slice(2);
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env['DATABASE_URL']!,max:2})});
try{
  if(args.includes('--apply')){
    const sha=args[args.indexOf('--expect-plan-sha')+1];
    if(!args.includes('--expect-plan-sha')||!sha?.match(/^[a-f0-9]{64}$/))throw new Error('Reviewed notification plan SHA256 required');
    console.log(JSON.stringify({mode:'APPLIED',...await reconcileCatalogNotifications(db,sha)}));
  }else{
    const plan=await planCatalogNotificationReconcile(db);
    console.log(JSON.stringify({mode:'PLAN_ONLY',planSha256:plan.fingerprint,legacyRows:plan.legacyRows,groups:plan.entries.length}));
  }
}finally{await db.$disconnect();}
