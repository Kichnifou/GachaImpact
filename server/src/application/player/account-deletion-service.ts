import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AccountAuthAdmin } from '../../infrastructure/auth/supabase-account-admin.js';
import type { AuthIdentityVerifier } from '../auth/auth-identity-verifier.js';
import type { AccountDeletion, DeletionIdentity, DeletionResult } from './account-deletion-contract.js';
import { authSubjectHash, erasureDigest, lockAuthSubject } from './account-erasure-markers.js';
import { assertErasureResponsibilities, checkErasureSchema, erasePlayerData } from './erase-player-data.js';
import { lockTwitchNativeAdmission } from '../twitch/twitch-native-admission.js';
import { AppError } from '../../api/errors.js';
import { captureTargetedPlayerRows, assertTargetedDeletionSafe } from '../migration/targeted-player-rows.js';
import { deletionOwnedTables } from './account-deletion-schema.js';
import { assessTwitchOperationsInFlight } from '../twitch/twitch-operations-in-flight.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import {accountAccessVerifier} from './account-access-verifier.js';
import {accountDeletionScope} from './account-deletion-scope.js';

type BackupPolicy = 'WAIT_FOR_OFFLINE_ERASURE' | 'RETENTION_30_DAYS';

export class AccountDeletionService implements AccountDeletion {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private work?: Promise<void>;
  constructor(private readonly db: PrismaClient, private readonly admin: AccountAuthAdmin,
    public readonly resumeIdentityVerifier: AuthIdentityVerifier, private readonly markerKey: string,
    private readonly backupPolicy: BackupPolicy = 'WAIT_FOR_OFFLINE_ERASURE', private readonly onFailure?: (error:unknown)=>void) {}

  guardedVerifier(): AuthIdentityVerifier {
    return accountAccessVerifier(this.db,this.admin,this.resumeIdentityVerifier);
  }

  async execute(identity: DeletionIdentity, proof: { confirmation: 'SUPPRIMER'; reauthenticationToken: string }): Promise<DeletionResult> {
    const subjectHash = authSubjectHash(identity.subject);
    let job = await this.db.accountDeletion.findUnique({where:{subjectHash}});
    if (!job) {
      if (proof.confirmation!=='SUPPRIMER') throw new AppError('Saisis SUPPRIMER pour confirmer.',400,'ACCOUNT_DELETION_CONFIRMATION');
      await this.admin.verifyFresh(proof.reauthenticationToken,identity.subject);
      const accept = () => this.db.$transaction(async tx => {
        await lockAuthSubject(tx,identity.subject);
        const prior=await tx.accountDeletion.findUnique({where:{subjectHash}});if(prior)return prior;
        const web=await tx.webIdentity.findUnique({where:{provider_providerSubject:{provider:'supabase',providerSubject:identity.subject}},include:{player:{include:{twitchIdentity:true}}}});
        if(!web||web.player.status!=='ACTIVE')throw new AppError('Ce compte ne peut pas être supprimé dans son état actuel.',409,'ACCOUNT_DELETION_ACCOUNT_STATE');
        const scope=await accountDeletionScope(tx,web.id,web.playerId);
        for(const twitchId of scope.twitchIds)await lockTwitchNativeAdmission(tx,twitchId);
        // The draw takes Edition -> Player. Match that order so deletion cannot
        // strand a frozen winner or race the population freeze.
        await tx.$queryRaw`SELECT e.id FROM event_editions e JOIN event_participants p ON p.event_edition_id=e.id
          WHERE p.player_id=ANY(${scope.playerIds}::uuid[]) ORDER BY e.id FOR UPDATE OF e`;
        await tx.$queryRaw`SELECT id FROM players WHERE id=ANY(${scope.playerIds}::uuid[]) ORDER BY id FOR UPDATE`;
        await checkErasureSchema(tx);
        for(const playerId of scope.playerIds)await assertErasureResponsibilities(tx,playerId);
        const storage=await tx.$queryRaw<{unsafe:boolean}[]>`SELECT current_schema()='public' AND EXISTS(
          SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND cmd IN ('ALL','INSERT','UPDATE')
          AND roles && ARRAY['public','anon','authenticated']::name[]) AS unsafe`;
        if(storage[0]?.unsafe)throw new AppError('La suppression des fichiers nécessite une vérification du service.',503,'ACCOUNT_DELETION_STORAGE_POLICY');
        if(web.player.twitchIdentity&&(await assessTwitchOperationsInFlight(tx,web.player.twitchIdentity.twitchUserId,web.playerId)).blocked)
          throw new AppError('Une opération Twitch est encore en cours. Réessaie après sa fin.',409,'ACCOUNT_DELETION_RESPONSIBILITY');
        await tx.sharedInvocationSession.updateMany({where:{ownerId:web.playerId},data:{status:'STOPPED'}});
        await tx.sharedInvocationMember.updateMany({where:{watching:{ownerId:web.playerId}},data:{watchingId:null,viewerPresences:[]}});
        const graph=await captureTargetedPlayerRows(tx,scope.playerIds,deletionOwnedTables);
        await assertTargetedDeletionSafe(tx,graph,new Set(deletionOwnedTables));
        // now() is the transaction start, potentially before a long lock wait.
        // The cutoff must be taken after admission and all refusal gates.
        const [cutoff]=await tx.$queryRaw<{at:Date}[]>`SELECT clock_timestamp() AS at`;
        if(!cutoff)throw new Error('ACCOUNT_ERASURE_ACCEPTANCE_CLOCK_MISSING');
        const accepted=await tx.accountDeletion.create({data:{id:randomUUID(),playerId:web.playerId,scopePlayerIds:scope.playerIds,scopeTwitchIds:scope.twitchIds,subjectHash,authSubject:identity.subject,acceptedAt:cutoff.at,
          requiresOfflineErasure:this.backupPolicy==='WAIT_FOR_OFFLINE_ERASURE'}});
        for(const playerId of scope.playerIds)await tx.accountErasureMarker.upsert({where:{kind_digest:{kind:'PLAYER',digest:erasureDigest('PLAYER',playerId,this.markerKey)}},
          create:{kind:'PLAYER',digest:erasureDigest('PLAYER',playerId,this.markerKey)},update:{}});
        for(const twitchId of scope.twitchIds)await tx.accountErasureMarker.upsert({where:{kind_digest:{kind:'TWITCH',digest:erasureDigest('TWITCH',twitchId,this.markerKey)}},
          create:{kind:'TWITCH',digest:erasureDigest('TWITCH',twitchId,this.markerKey),createdAt:accepted.acceptedAt},update:{createdAt:accepted.acceptedAt}});
        await tx.player.update({where:{id:web.playerId},data:{status:'ARCHIVED'}});
        return accepted;
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30_000});
      for(let attempt=0;attempt<3;attempt++) {
        try{job=await accept();break;}catch(error){if(attempt===2||!isPrismaConcurrencyCollision(error))throw error;}
      }
      if(!job)throw new Error('ACCOUNT_DELETION_ACCEPTANCE_UNRESOLVED');
    }
    if(job.status!=='COMPLETED')await this.process(job.id);
    const current=await this.db.accountDeletion.findUniqueOrThrow({where:{id:job.id}});
    return {status:current.status==='COMPLETED'?'COMPLETED':'PENDING'};
  }

  private async eraseStorage(subject: string) {
    // Production Storage lives outside the application schema. Private test schemas never reach it.
    const schema=await this.db.$queryRaw<{name:string}[]>`SELECT current_schema() AS name`;
    if(schema[0]?.name!=='public')return;
    const objects=await this.db.$queryRaw<{bucket:string;name:string}[]>`SELECT bucket_id AS bucket,name FROM storage.objects
      WHERE owner_id=${subject} OR owner::text=${subject} ORDER BY bucket_id,name`;
    const buckets=new Set(objects.map(x=>x.bucket));
    for(const bucket of buckets)await this.admin.removeStorage(bucket,objects.filter(x=>x.bucket===bucket).map(x=>x.name));
    const residual=await this.db.$queryRaw<{count:bigint}[]>`SELECT count(*) FROM storage.objects WHERE owner_id=${subject} OR owner::text=${subject}`;
    if(residual[0]?.count!==0n)throw new Error('ACCOUNT_ERASURE_STORAGE_REMAINS');
  }

  async process(id: string) {
    const leaseToken=randomUUID();
    const claimed=await this.db.accountDeletion.updateMany({where:{id,status:{not:'COMPLETED'},OR:[{leaseUntil:null},{leaseUntil:{lt:new Date()}}]},
      data:{leaseUntil:new Date(Date.now()+300_000),leaseToken,attempts:{increment:1}}});
    if(!claimed.count)return;
    let stage='LOAD';
    try {
      let job=await this.db.accountDeletion.findUniqueOrThrow({where:{id}});
      if(job.status==='ACCEPTED') {
        if(!job.authSubject)throw new Error('ACCOUNT_ERASURE_SUBJECT_MISSING');
        stage='STORAGE';await this.eraseStorage(job.authSubject);
        const subject=job.authSubject;
        stage='DATABASE';await this.db.$transaction(async tx=>{
          await tx.$queryRaw`SELECT set_config('app.account_deletion_job',${id},true)`;
          await tx.$queryRaw`SELECT set_config('app.account_deletion_token',${leaseToken},true)`;
          await tx.$queryRaw`SELECT id FROM players WHERE id=ANY(${job.scopePlayerIds}::uuid[]) ORDER BY id FOR UPDATE`;
          const web=await tx.webIdentity.findUniqueOrThrow({where:{provider_providerSubject:{provider:'supabase',providerSubject:subject}}});
          const aliases=await accountDeletionScope(tx,web.id,job.playerId);
          for(const playerId of [...job.scopePlayerIds.filter(p=>p!==job.playerId),job.playerId])
            await erasePlayerData(tx,playerId,subject,job.scopeTwitchIds,this.markerKey,aliases);
          if((await tx.accountDeletion.updateMany({where:{id,leaseToken,leaseUntil:{gt:new Date()}},data:{status:'DATABASE_ERASED',scopeTwitchIds:[]}})).count!==1)
            throw new Error('ACCOUNT_ERASURE_LEASE_LOST');
        },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:120_000});
        job=await this.db.accountDeletion.findUniqueOrThrow({where:{id}});
      }
      if(job.authSubject) {
        stage='AUTH';await this.admin.deleteUser(job.authSubject);
        stage='STORAGE';
        await this.eraseStorage(job.authSubject);
        if((await this.db.accountDeletion.updateMany({where:{id,leaseToken},data:{authSubject:null}})).count!==1)return;
      }
      await this.db.accountDeletion.updateMany({where:{id,leaseToken,leaseUntil:{gt:new Date()}},data:job.requiresOfflineErasure?{status:'BACKUP_PENDING',lastFailureStage:null}:{status:'COMPLETED',completedAt:new Date(),lastFailureStage:null}});
    } catch (error) {
      this.onFailure?.(error);
      await this.db.accountDeletion.updateMany({where:{id,leaseToken},data:{lastFailureStage:stage}});
      // A retry resumes the durable step; never expose provider errors, identifiers or a false success.
    } finally {await this.db.accountDeletion.updateMany({where:{id,leaseToken},data:{leaseUntil:null,leaseToken:null}});}
  }

  async resumePending() {
    if(this.running)return;this.running=true;
    try {const jobs=await this.db.accountDeletion.findMany({where:{status:{in:['ACCEPTED','DATABASE_ERASED']}},orderBy:{acceptedAt:'asc'},take:3});
      for(const job of jobs)await this.process(job.id);
      // Bound the retry lookup to seven days after completion. The raw subject
      // is already gone; live Auth checks continue rejecting the deleted user.
      await this.db.accountDeletion.updateMany({where:{status:'COMPLETED',completedAt:{lt:new Date(Date.now()-7*86400000)},subjectHash:{not:null}},data:{subjectHash:null}});
    }finally{this.running=false;}
  }
  start() {this.timer=setInterval(()=>{if(!this.running)this.work=this.resumePending().catch(()=>undefined);},15_000);this.timer.unref();}
  async stop() {if(this.timer)clearInterval(this.timer);await this.work;}
}
