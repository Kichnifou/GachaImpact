import type { Prisma } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';

type Journal = { writer:string; batchSnapshot:string; batchStatus:string; runSnapshot:string; runStatus:string;
  summary:Prisma.JsonValue; importSnapshot:string|null; backupHash:string|null; importStatus:string|null; ownsOperation:boolean };
const object=(value:Prisma.JsonValue|undefined|null):Prisma.JsonObject|null=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const refuse=()=>{throw new AppError('La preuve de cette ancienne opération doit être vérifiée avant tout rejeu.',409,'HISTORICAL_REPLAY_PROOF_INVALID');};

/** Exact retained membership, with separately qualified v2 and v3 journal formats.
 * An ambiguous replacement proof cannot fall through into a new economic action.
 */
export async function isRetainedHistoricalOperation(tx: Prisma.TransactionClient, playerId: string, operationId: string) {
  const rows=await tx.$queryRaw<Journal[]>`SELECT b.migrator_version AS writer,b.snapshot_hash AS "batchSnapshot",b.status AS "batchStatus",
    r.snapshot_hash AS "runSnapshot",r.status AS "runStatus",b.summary,
    i.snapshot_hash AS "importSnapshot",i.backup_hash AS "backupHash",i.status AS "importStatus",
    EXISTS(SELECT 1 FROM business_operations o WHERE o.id=${operationId}::uuid AND o.player_id=${playerId}::uuid) AS "ownsOperation"
    FROM migration_runs r JOIN migration_batches b ON b.id=r.batch_id
    LEFT JOIN twitch_canary_imports i ON i.player_id=r.player_id AND i.snapshot_hash=r.snapshot_hash
      AND i.backup_hash=b.summary#>>'{historicalOperationRetention,backupHash}' AND i.rolled_back_at IS NULL
    WHERE r.player_id=${playerId}::uuid AND r.source='STREAMERBOT_SNAPSHOT'
      AND b.status<>'ROLLED_BACK' AND r.status<>'ROLLED_BACK'
      AND (b.summary->>'kind'='TARGETED_CANARY' OR b.migrator_version LIKE 'targeted-canary-%')`;
  let retained=false;
  for(const row of rows){
    const summary=object(row.summary),proof=object(summary?.historicalOperationRetention);
    // v1's strict FK deletion contract could not retain any operation. Its
    // original journal has neither proof; post-import operations stay ordinary.
    if(row.writer==='targeted-canary-v1'&&summary?.kind==='TARGETED_CANARY'
      &&summary.historicalOperationRetention===undefined&&summary.socialRestoration===undefined)continue;
    if(!proof||!Array.isArray(proof.operationIds)||!proof.operationIds.every(uuid))refuse();
    if(!(proof!.operationIds as string[]).includes(operationId))continue;
    if(!row.ownsOperation||row.batchStatus!=='COMPLETED'||row.runStatus!=='COMPLETED'||summary?.kind!=='TARGETED_CANARY'
      ||proof!.version!==1||!hash(proof!.backupHash)||proof!.backupHash!==row.backupHash||row.importStatus!=='DATA_IMPORTED'
      ||!hash(row.batchSnapshot)||row.batchSnapshot!==row.runSnapshot||row.runSnapshot!==row.importSnapshot)refuse();
    if(row.writer==='targeted-canary-v3'){
      const social=object(summary?.socialRestoration);
      // v3 retains the v1 operation proof and adds a committed social postimage.
      if(social?.version!==1||social.backupHash!==proof!.backupHash||!hash(social.postHash))refuse();
    }else if(row.writer!=='targeted-canary-v2')refuse();
    retained=true;
  }
  return retained;
}
