import 'dotenv/config';
import {createDatabase} from '../src/infrastructure/database/prisma-database.js';
import {losslessRetentionDomains,type LosslessRetentionDomain} from '../src/application/retention/retention-policy.js';
import {restoreStoredDetail} from '../src/application/retention/retention-transformations.js';

// Standalone operations: no HTTP listener, scheduler, gameplay or payload logging.
async function main() {
  const [command,domain,id,hash,...extra]=process.argv.slice(2);
  if(extra.length||!process.env['DATABASE_URL'])throw Error('ARGUMENTS');
  const db=createDatabase(process.env['DATABASE_URL']);
  try {
    if(command==='stop'&&!domain) {
      await db.$transaction(async tx=>{
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout='6000ms'");
        await tx.$executeRawUnsafe("UPDATE retention_job SET execution_enabled=FALSE WHERE id='retention-v1'");
      },{timeout:7000,maxWait:10000});
      console.info(JSON.stringify({executionEnabled:false}));
    } else if(command==='restore'&&domain&&id&&hash&&losslessRetentionDomains.includes(domain as LosslessRetentionDomain)) {
      console.info(JSON.stringify(await restoreStoredDetail(db,domain as LosslessRetentionDomain,id,hash)));
    } else throw Error('ARGUMENTS');
  } finally {await db.$disconnect();}
}
main().catch(()=>{console.error('RETENTION_MAINTENANCE_FAILED_CLOSED');process.exitCode=1;});
