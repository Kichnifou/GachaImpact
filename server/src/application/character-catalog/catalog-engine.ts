import { randomUUID, createHash } from 'node:crypto';
import { Prisma, type PrismaClient, type CatalogCandidate } from '../../../generated/prisma/client.js';
import { getBusinessDate, getNextBusinessResetAt } from '../../domain/time/business-date.js';
import { eligibility, mergeEvidence, normalizedIdentity, readFields, type CatalogFields } from './catalog-policy.js';
import { CatalogFetchError, RequestBudget, catalogHttp, type CatalogHttp } from '../../infrastructure/character-catalog/catalog-http.js';
import { CatalogSources, catalogFieldSources, officialReleaseEvidence, officialPlayableEvidence, type SourceAttempt, type OfficialPost } from '../../infrastructure/character-catalog/catalog-sources.js';
import { CatalogImageStorage, validateImage } from '../../infrastructure/character-catalog/catalog-images.js';
import { canCollect, isTracked, shouldStopAtRelease, sameEditorialValue, editorialFingerprint, meaningfulEvidence } from './catalog-followup.js';
import { recordImageVersion } from './catalog-image-version.js';
import { activeCatalogStates, lockCatalogJob } from './catalog-control.js';
import { notifyCatalogReview } from './catalog-notifications.js';
import { progressiveEligibility, trustedEvidence, unresolvedEvidence } from './catalog-progressive.js';
import { optionalWeapon } from './catalog-metadata.js';

type RunMode = 'daily' | 'retry' | 'audit';
const json = (value: unknown) => value as Prisma.InputJsonValue;
const leaseMs = 900_000;
const rolePath = { icon: 'iconPath', splash: 'splashPath', wish: 'wishPath', fullbody: 'fullbodyPath' } as const;
export type CatalogSettings = Readonly<{ enabled: boolean; publish: boolean; dryRun: boolean; storageUrl?: string; storageKey?: string }>;

export class CatalogEngine {
  readonly storage: CatalogImageStorage;
  private activeRunId?: string;
  private controller?: AbortController;
  private readonly publicationAssetFailures=new Map<string,string>();
  constructor(private readonly db: PrismaClient, readonly settings: CatalogSettings,
    private readonly http: CatalogHttp = catalogHttp, private readonly now: () => Date = () => new Date()) {
    this.storage = new CatalogImageStorage(settings.storageUrl, settings.storageKey, (url, options) => http(url, {...options, signal:this.controller?.signal}), async bytes => {
      const rows = await this.db.$queryRaw<{ bytes: bigint }[]>`SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)::bigint AS bytes FROM storage.objects`;
      if (!rows[0] || rows[0].bytes + BigInt(bytes) > 500n * 1024n * 1024n) throw new CatalogFetchError('STORAGE_CAPACITY_LIMIT');
    });
  }

  async run(mode: RunMode = 'daily', candidateId?: string, requestedRunId?: string) {
    const started = this.now(), businessDate = getBusinessDate(started), token = randomUUID();
    const admitted = await this.db.$transaction(async tx => {
      await lockCatalogJob(tx);
      const cycleKey = mode === 'daily' ? `daily:${businessDate}` : `manual:${requestedRunId ?? token}`;
      const existing = requestedRunId ? await tx.catalogRun.findUniqueOrThrow({where:{id:requestedRunId}}) : await tx.catalogRun.findUnique({where:{cycleKey}});
      const job = await tx.catalogJob.findUniqueOrThrow({where:{id:'R1051'}});
      if (job.leaseUntil && job.leaseUntil > started) return {skipped:'LEASE_BUSY'};
      if (job.leaseToken || job.leaseUntil) await tx.catalogJob.update({where:{id:'R1051'},data:{leaseToken:null,leaseUntil:null}});
      if (existing && ['COMPLETED','CANCELLED','SUPERSEDED'].includes(existing.status)) return {skipped:'ALREADY_COMPLETED'};
      const active = await tx.catalogRun.findFirst({where:{status:{in:activeCatalogStates},...(existing?{id:{not:existing.id}}:{})},orderBy:{startedAt:'asc'}});
      if (active) return {skipped:'ACTIVE_RUN',runId:active.id};
      if (existing?.cancelRequestedAt) {
        await tx.catalogRun.update({where:{id:existing.id},data:{status:'CANCELLED',completedAt:this.now()}});
        return {skipped:'CANCELLED',runId:existing.id};
      }
      if (existing && existing.nextAttemptAt > this.now()) return {skipped:'BACKOFF'};
      const run = existing ? await tx.catalogRun.update({where:{id:existing.id},data:{status:'RUNNING',completedAt:null}}) : await tx.catalogRun.create({data:{cycleKey,status:'RUNNING'}});
      await tx.catalogJob.update({where:{id:'R1051'},data:{leaseToken:token,leaseUntil:new Date(started.getTime()+leaseMs)}});
      return {run};
    });
    if (!admitted.run) return admitted;
    let run = admitted.run;
    const runId = run.id;
    this.activeRunId = runId;
    const controller = new AbortController();
    this.controller = controller;
    let checking = false;
    const cancellationTimer = setInterval(() => {
      if (checking) return;
      checking = true;
      void this.db.catalogRun.findUnique({where:{id:runId}}).then(value => {
        if (value?.cancelRequestedAt || value?.status === 'CANCELLED') controller.abort();
      }).catch(() => undefined).finally(() => {checking=false});
    },500);
    cancellationTimer.unref?.();
    try {
      const request = run.summary as Prisma.InputJsonObject;
      const dryRun = mode === 'audit' || (this.settings.dryRun && !(requestedRunId && request['apply'] === true && mode === 'retry'));
      const batched = mode === 'daily' || !candidateId;
      run = await this.fenced(token,tx=>tx.catalogRun.update({where:{id:run.id},data:{summary:json({...request,mode,dryRun,apply:mode==='retry'&&!dryRun,...(candidateId?{candidateId}:{})})}}));
      if (candidateId) {
        const target = await this.db.catalogCandidate.findUniqueOrThrow({ where: { id: candidateId } });
        if (!isTracked(target) || (!target.progressivePolicy && shouldStopAtRelease(target.characterId, readFields(target.fields), started, target.releaseFollowupAuthorized))) {
          await this.fenced(token, async tx => {
            if (!dryRun) await this.protectReleased(tx, target.id, target.revision, started);
            await tx.catalogRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', completedAt: this.now(), summary: { mode, candidateId, processed: 0, changed: 0, reason: 'FICHE_PROTEGEE' } } });
          });
          return { runId: run.id, processed: 0, changed: 0, remaining: 0 };
        }
      }
      const record = async (attempt: SourceAttempt, id?: string) => {
        await this.fenced(token, tx => tx.catalogAttempt.create({ data: { runId: run.id, candidateId: id, ...attempt,
          checkedAt: this.now(), nextCheckAt: getNextBusinessResetAt(this.now()) } }));
      };
      const budget = new RequestBudget(async (url, options) => {
        const renewed = await this.db.catalogJob.updateMany({ where: { id: 'R1051', leaseToken: token, leaseUntil: { gt: this.now() } },
          data: { leaseUntil: new Date(this.now().getTime() + leaseMs) } });
        if (!renewed.count) throw new CatalogFetchError('LEASE_LOST');
        await this.checkCancellation();
        return this.http(url, {...options, signal:this.controller?.signal});
      });
      let attemptCandidateId: string | undefined;
      const sources = new CatalogSources(budget.request, attempt => record(attempt, attemptCandidateId), started);
      const posts = await sources.discover();
      let discoveryChanges = 0;
      if (!candidateId && !dryRun) {
        for (const post of posts.filter(row => row.name)) discoveryChanges += await this.discover(token, post, run.id);
        await this.seedHistorical(token);
      }
      const previous = (await this.db.catalogRun.findUniqueOrThrow({where:{id:runId}})).summary as Prisma.InputJsonObject;
      const dailyCutoff = batched && typeof previous['dailyCutoff'] === 'string' ? new Date(previous['dailyCutoff']) : this.now();
      const processedIds = batched && Array.isArray(previous['processedCandidateIds']) ?
        previous['processedCandidateIds'].filter((id): id is string => typeof id === 'string') : [];
      const dailyWhere = () => ({ trackingState: 'ACTIVE', trackingElements: { isEmpty: false }, ...(mode === 'daily' ? { nextCheckAt: { lte: dailyCutoff } } : {}), id: { notIn: processedIds } });
      const checkpoint = () => ({ ...previous, mode, dryRun, selectionPolicy: 'protected-v1', scopeRecalculationRequired: false, dailyCutoff: dailyCutoff.toISOString(), processedCandidateIds: processedIds });
      if (batched) await this.fenced(token, tx => this.saveCheckpoint(tx, run.id, checkpoint()));
      const candidates = await this.db.catalogCandidate.findMany({ where: candidateId ? { id: candidateId } : dailyWhere(),
        orderBy: [{ nextCheckAt: 'asc' }, { id: 'asc' }], take: batched ? 15 : 1, include: { character: true, assets: true, identities: true } });
      const reports: unknown[] = [];
      let changed = discoveryChanges;
      for (const candidate of candidates) {
        try {
          const fields = readFields(candidate.fields);
          if (!isTracked(candidate) || (!candidate.progressivePolicy && shouldStopAtRelease(candidate.characterId, fields, started, candidate.releaseFollowupAuthorized))) {
            if (!dryRun) await this.fenced(token, tx => this.protectReleased(tx, candidate.id, candidate.revision, started));
            if (batched) processedIds.push(candidate.id);
            continue;
          }
          const names = [candidate.name, fields.originalName?.value, fields.name?.value].filter((name): name is string => typeof name === 'string');
          attemptCandidateId = candidate.id;
          const structured = await sources.structured(names, candidate.trackingElements.filter(field => canCollect(candidate, field)));
          for (const field of ['name', 'originalName', 'rarity', 'element', 'weapon', 'region', 'numericId'] as const) {
            if (!canCollect(candidate, field) || fields[field]) continue;
            const value = structured?.fields[field];
            await record({ provider: value?.provider ?? 'genshin-db', field, outcome: value ? 'FOUND' : 'MISSING',
              ...(value ? { sourceUrl: value.url } : { errorCode: 'ABSENT' }) }, candidate.id);
          }
          let merged = fields;
          for (const [field, value] of Object.entries(structured?.fields ?? {})) if (value && canCollect(candidate, field) && catalogFieldSources[field as keyof CatalogFields].includes(value.provider)) merged = mergeEvidence(merged, field as keyof CatalogFields, value);
          for (const post of posts) {
            if (post.name && names.some(name => normalizedIdentity(name) === normalizedIdentity(post.name!)))
              for (const [field, value] of Object.entries(post.fields)) if (value && canCollect(candidate, field)) merged = mergeEvidence(merged, field as keyof CatalogFields, value);
            const release = officialReleaseEvidence(post, names, started);
            if (release && canCollect(candidate, 'releaseDate')) merged = mergeEvidence(merged, 'releaseDate', release);
            const playable = officialPlayableEvidence(post,names,started);
            if(playable && canCollect(candidate,'releaseDate')) merged=mergeEvidence(merged,'playable',playable);
          }
          if(candidate.progressivePolicy) merged=progressiveEligibility(merged,started).fields;
          reports.push({ candidateId: candidate.id, fields: merged, missing: (candidate.progressivePolicy ? progressiveEligibility(merged,started) : eligibility(merged, candidate.assets.filter(row => row.status === 'AVAILABLE').map(row => row.role), started)).missing });
          if (dryRun) {
            if (batched) {
              processedIds.push(candidate.id);
              await this.fenced(token, tx => this.saveCheckpoint(tx, run.id, checkpoint()));
            }
            continue;
          }
          let expectedRevision = candidate.revision;
          let released = false;
          const fieldChanges = await this.fenced(token, async tx => {
            await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE id = ${candidate.id}::uuid FOR UPDATE`;
            const current = await tx.catalogCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
            if (current.revision !== expectedRevision || !isTracked(current)) throw new CatalogFetchError('REVISION_CHANGED');
            let final = readFields(current.fields);
            const updates: string[] = [];
            // The unchanged revision proves merged was computed from this snapshot.
            // Merging that result a second time would discard fresh conflicts when
            // the retained primary value equals the previous value.
            for (const [field, value] of Object.entries(merged)) if (value && canCollect(current, field==='playable'?'releaseDate':field)) final = { ...final, [field]: value };
            if (final.numericId && /^1\d{7}$/.test(String(final.numericId.value)) && final.numericId.reliability!=='PROVISIONAL' && !unresolvedEvidence(final.numericId)) await this.attach(tx, candidate.id, 'genshin', String(final.numericId.value));
            for (const [field, value] of Object.entries(final)) if (!sameEditorialValue(readFields(current.fields)[field as keyof CatalogFields], value)) {
              updates.push(`${field}${value!.conflict ? ' : conflit' : ' : nouvelle information'}`);
              await tx.catalogAttempt.create({ data: { runId: run.id, candidateId: candidate.id, provider: value!.provider, field,
                outcome: value!.conflict ? 'CONFLICT' : readFields(current.fields)[field as keyof CatalogFields] ? 'UPDATED' : 'ADDED', sourceUrl: value!.url, checkedAt: this.now() } });
            }
            await tx.catalogCandidate.update({ where: { id: candidate.id }, data: { fields: json(final), revision: { increment: 1 } } });
            if (updates.length) await this.notifyReview(tx, candidate.id, candidate.name, updates, editorialFingerprint(final));
            await this.addChanges(tx,runId,updates.length);
            expectedRevision++;
            released = await this.protectReleased(tx, candidate.id, expectedRevision, started);
            return updates.length;
          });
          changed += fieldChanges;
          if (released) {
            if (batched) processedIds.push(candidate.id);
            continue;
          }
          for (const role of ['icon', 'splash', 'wish', 'fullbody'] as const) {
            if (!canCollect(candidate, role) || candidate.assets.some(asset => asset.role === role && asset.autoLocked)) continue;
            const alternatives = structured?.images[role] ?? [];
            if (!alternatives.length) await record({ provider: 'technical-manifest', field: role, outcome: 'MISSING', errorCode: 'ABSENT' }, candidate.id);
            for (const asset of alternatives) {
              try {
                const previous = candidate.assets.filter(item=>item.role===role&&item.status==='AVAILABLE').sort((a,b)=>b.checkedAt.getTime()-a.checkedAt.getTime())[0];
                if (previous?.editorialStatus === 'VALIDATED' && asset.editorialStatus === 'PROVISIONAL') {
                  await record({provider:asset.provider,field:role,outcome:'REJECTED',errorCode:'EDITORIAL_DOWNGRADE',sourceUrl:asset.url},candidate.id);
                  continue;
                }
                const response = await budget.request(asset.url);
                if (response.status !== 200) throw new CatalogFetchError(response.status === 404 ? 'HTTP_404' : 'UNAVAILABLE', response.status);
                const image = await validateImage(response.body, response.mime, role);
                // Validate independently of credentials; store only when the backend is configured.
                if (asset.sourceHash && image.sourceHash !== asset.sourceHash) throw new CatalogFetchError('SOURCE_IMAGE_CHANGED');
                const url = this.storage.configured ? await this.storage.store(candidate.id, role, image) : null;
                const imageChanged = await this.fenced(token, async tx => {
                  await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE id = ${candidate.id}::uuid FOR UPDATE`;
                  const current = await tx.catalogCandidate.findUniqueOrThrow({ where: { id: candidate.id }, include: { assets: true } });
                  if (current.revision !== expectedRevision || !canCollect(current, role) || current.assets.some(item => item.role === role && item.autoLocked)) throw new CatalogFetchError('REVISION_CHANGED');
                  const saved = await recordImageVersion(tx, { candidateId: candidate.id, role, image, provider: asset.provider,
                    sourceUrl: asset.url, sourceMime: response.mime, url, editorialStatus: asset.editorialStatus ?? 'VALIDATED', now: this.now() });
                  if (saved.changed) await this.notifyReview(tx,candidate.id,candidate.name,[`${role} : ${url?'image disponible':'source image qualifiée, stockage en attente'}`],`${role}:${image.hash}:${saved.asset.status}:${saved.asset.editorialStatus}`);
                  await this.addChanges(tx,runId,saved.changed?1:0);
                  return saved.changed;
                });
                if (imageChanged) changed++;
                await record({ provider: asset.provider, field: role, outcome: url ? 'AVAILABLE' : 'SOURCE_VALIDATED', sourceUrl: asset.url, httpStatus: 200,
                  ...(!url ? { errorCode: 'STORAGE_NOT_CONFIGURED' } : {}) }, candidate.id);
                break;
              } catch (error) {
                const code = error instanceof CatalogFetchError ? error.code : 'UNAVAILABLE';
                if (['BUDGET_EXHAUSTED', 'LEASE_LOST', 'REVISION_CHANGED'].includes(code)) throw error;
                await record({ provider: asset.provider, field: role, outcome: code === 'HTTP_404' ? 'MISSING' : 'ERROR', errorCode: code, sourceUrl: asset.url,
                  ...(error instanceof CatalogFetchError && error.httpStatus ? { httpStatus: error.httpStatus } : {}) }, candidate.id);
                if (code === 'STORAGE_NOT_CONFIGURED') break;
              }
            }
          }
          for (const promotion of candidate.assets.filter(row => canCollect(candidate, 'promotion') && !row.autoLocked && row.role === 'promotion' && row.status === 'UNVERIFIED' && row.sourceUrl).slice(0, 3)) {
            try {
              const response = await budget.request(promotion.sourceUrl!);
              if (response.status !== 200) throw new CatalogFetchError(response.status === 404 ? 'HTTP_404' : 'UNAVAILABLE', response.status);
              const image = await validateImage(response.body, response.mime, 'promotion');
              const promotionChanges = await this.fenced(token, async tx => {
                await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE id = ${candidate.id}::uuid FOR UPDATE`;
                const current = await tx.catalogCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
                if (current.revision !== expectedRevision || !canCollect(current, 'promotion')) throw new CatalogFetchError('REVISION_CHANGED');
                const saved = await tx.catalogAsset.updateMany({ where: { id: promotion.id, autoLocked: false, status: 'UNVERIFIED' }, data: { hash: image.hash, sourceHash: image.sourceHash,
                sourceMime: response.mime, mime: image.mime, width: image.width, height: image.height, bytes: response.body.length,
                status: 'SOURCE_VALIDATED', officialConfirmed: true, checkedAt: this.now() } });
                if (saved.count) await this.notifyReview(tx,candidate.id,candidate.name,['promotion : source décodée, distincte des images du jeu'],`promotion:${image.hash}:SOURCE_VALIDATED`);
                await this.addChanges(tx,runId,saved.count);
                return saved.count;
              });
              changed += promotionChanges;
              await record({ provider: 'hoyoverse', field: 'promotion', outcome: 'SOURCE_VALIDATED', sourceUrl: promotion.sourceUrl!, httpStatus: 200 }, candidate.id);
            } catch (error) {
              if (error instanceof CatalogFetchError && ['BUDGET_EXHAUSTED', 'LEASE_LOST', 'REVISION_CHANGED'].includes(error.code)) throw error;
              await record({ provider: 'hoyoverse', field: 'promotion', outcome: 'ERROR', errorCode: error instanceof CatalogFetchError ? error.code : 'UNAVAILABLE', sourceUrl: promotion.sourceUrl! }, candidate.id);
            }
          }
          await this.finalize(token, candidate.id, started, expectedRevision);
        } catch (error) {
          const code = error instanceof CatalogFetchError ? error.code : 'INTERVENTION';
          if (['BUDGET_EXHAUSTED', 'LEASE_LOST', 'CANCELLED'].includes(code)) throw error;
          await record({ provider: 'pipeline', field: 'candidate', outcome: 'ERROR', errorCode: code }, candidate.id);
          if (!dryRun && code !== 'REVISION_CHANGED') await this.fenced(token, tx => tx.catalogCandidate.updateMany({ where: { id: candidate.id, trackingState: 'ACTIVE', revision: candidate.revision }, data: {
            status: code === 'IDENTITY_CONFLICT' ? 'CONFLICT' : 'TEMPORARY_ERROR', checkedAt: this.now(), nextCheckAt: getNextBusinessResetAt(this.now()) } }));
        }
        if (batched) {
          processedIds.push(candidate.id);
          await this.fenced(token, tx => this.saveCheckpoint(tx, run.id, checkpoint()));
        }
      }
      if (!dryRun) await this.deliverNotifications();
      const remaining = batched ? await this.db.catalogCandidate.count({ where: dailyWhere() }) : 0;
      await this.fenced(token, async tx => {
        const committed = (await tx.catalogRun.findUniqueOrThrow({where:{id:runId}})).summary as Prisma.InputJsonObject;
        await tx.catalogRun.update({ where: { id: run.id }, data: { status: remaining ? 'QUEUED' : 'COMPLETED', failureCount: 0,
          completedAt: remaining ? null : this.now(), nextAttemptAt: new Date(this.now().getTime() + (remaining ? 60_000 : 0)),
          summary: json({ ...checkpoint(), discovered: posts.filter(row => row.name).length, processed: batched ? processedIds.length : candidates.length,
            changed: committed['changed'] ?? 0, remaining, reports }) } });
        if (mode === 'daily' && !remaining) await tx.catalogJob.update({ where: { id: 'R1051' }, data: { lastSuccessDate: run.cycleKey.slice('daily:'.length), lastSuccessAt: this.now() } });
      });
      return { runId: run.id, discovered: posts.filter(row => row.name).length, processed: candidates.length, changed, remaining };
    } catch (error) {
      const cancellation = await this.db.catalogRun.findUnique({where:{id:runId}});
      if (cancellation?.cancelRequestedAt) {
        await this.db.$transaction(async tx => {
          const rows=await tx.$queryRaw<{id:string}[]>`SELECT id FROM catalog_job WHERE id = 'R1051' AND lease_token = ${token}::uuid FOR UPDATE`;
          if (!rows.length) return;
          await tx.catalogRun.updateMany({where:{id:runId,status:{in:activeCatalogStates}},data:{status:'CANCELLED',completedAt:this.now()}});
        });
        return {runId,cancelled:true};
      }
      if (runId) await this.fenced(token, async tx => {
        const run = await tx.catalogRun.findUniqueOrThrow({ where: { id: runId } });
        const delay = Math.min(86_400_000, 60_000 * 2 ** Math.min(run.failureCount + 1, 10));
        // Keep manual mode/target durable across retries and restarts.
        await tx.catalogRun.update({ where: { id: runId }, data: { status: 'FAILED', failureCount: { increment: 1 }, nextAttemptAt: new Date(this.now().getTime() + delay),
          summary: { ...(run.summary as Prisma.InputJsonObject), errorCode: error instanceof CatalogFetchError ? error.code : 'PIPELINE_FAILED' } } });
      }).catch(() => undefined);
      throw error;
    } finally {
      clearInterval(cancellationTimer);
      this.activeRunId=undefined;
      this.controller=undefined;
      await this.db.catalogJob.updateMany({ where: { id: 'R1051', leaseToken: token }, data: { leaseToken: null, leaseUntil: null } });
    }
  }

  private async addChanges(tx: Prisma.TransactionClient, runId: string, count: number) {
    if (!count) return;
    await tx.$executeRaw`UPDATE catalog_runs SET summary = jsonb_set(summary, '{changed}', to_jsonb(COALESCE((summary->>'changed')::int,0) + ${count}::int)) WHERE id = ${runId}::uuid`;
  }
  private async saveCheckpoint(tx: Prisma.TransactionClient, runId: string, summary: Prisma.InputJsonObject) {
    const current=(await tx.catalogRun.findUniqueOrThrow({where:{id:runId}})).summary as Prisma.InputJsonObject;
    return tx.catalogRun.update({where:{id:runId},data:{summary:{...summary,changed:current['changed']??0}}});
  }

  private async checkCancellation(tx: Prisma.TransactionClient | PrismaClient = this.db) {
    if (!this.activeRunId) return;
    const run=await tx.catalogRun.findUniqueOrThrow({where:{id:this.activeRunId}});
    if (run.cancelRequestedAt || run.status==='CANCELLED') throw new CatalogFetchError('CANCELLED');
  }

  private async fenced<T>(token: string, change: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM catalog_job WHERE id = 'R1051' AND lease_token = ${token}::uuid AND lease_until > CURRENT_TIMESTAMP FOR UPDATE`;
      if (rows.length !== 1) throw new CatalogFetchError('LEASE_LOST');
      await this.checkCancellation(tx);
      return change(tx);
    }, { timeout: 15_000 });
  }
  private async attach(tx: Prisma.TransactionClient, candidateId: string, namespace: string, externalId: string) {
    const existing = await tx.catalogIdentity.findUnique({ where: { namespace_externalId: { namespace, externalId } } });
    if (existing && existing.candidateId !== candidateId) throw new CatalogFetchError('IDENTITY_CONFLICT');
    await tx.catalogIdentity.upsert({ where: { namespace_externalId: { namespace, externalId } }, create: { namespace, externalId, candidateId }, update: {} });
  }
  private async notifyReview(tx: Prisma.TransactionClient, id: string, name: string, changes: string[], signature: string) {
    await notifyCatalogReview(tx,id,name,changes,signature,this.now());
  }
  private async protectReleased(tx: Prisma.TransactionClient, id: string, revision: number, now: Date) {
    await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE id = ${id}::uuid FOR UPDATE`;
    const current = await tx.catalogCandidate.findUniqueOrThrow({ where: { id } });
    if (current.progressivePolicy || current.revision !== revision || !isTracked(current) || !shouldStopAtRelease(current.characterId, readFields(current.fields), now, current.releaseFollowupAuthorized)) return false;
    await tx.catalogCandidate.update({ where: { id }, data: { trackingState: 'PROTECTED', trackingElements: [], trackingReason: 'Sortie officielle confirmée.', revision: { increment: 1 } } });
    await tx.catalogAsset.updateMany({ where: { candidateId: id }, data: { autoLocked: true } });
    return true;
  }
  private async discover(token: string, post: OfficialPost, runId: string) {
    const name = post.name!, normalized = normalizedIdentity(name);
    return this.fenced(token, async tx => {
      let created = false;
      const identity = await tx.catalogIdentity.findUnique({ where: { namespace_externalId: { namespace: 'official-name', externalId: normalized } } });
      let candidate = identity ? await tx.catalogCandidate.findUniqueOrThrow({ where: { id: identity.candidateId } }) : null;
      if (!candidate) {
        const existing = await tx.character.findMany({ where: { name: { equals: name, mode: 'insensitive' } }, take: 2 });
        if (existing.length > 1) throw new CatalogFetchError('IDENTITY_CONFLICT');
        candidate = existing[0] ? await tx.catalogCandidate.upsert({ where: { characterId: existing[0].id }, create: { name, characterId: existing[0].id, progressivePolicy:false, trackingState: 'PROTECTED', trackingElements: [], trackingReason: 'Fiche historique protégée.' }, update: {} })
          : await tx.catalogCandidate.create({ data: { name, progressivePolicy:true } });
        created = !existing[0];
      }
      await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE id = ${candidate.id}::uuid FOR UPDATE`;
      candidate = await tx.catalogCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
      if (!isTracked(candidate)) return 0;
      if (await this.protectReleased(tx, candidate.id, candidate.revision, this.now())) return 0;
      let fields = readFields(candidate.fields);
      for (const [key, value] of Object.entries(post.fields)) if (value && canCollect(candidate, key)) fields = mergeEvidence(fields, key as keyof CatalogFields, value);
      await this.attach(tx, candidate.id, 'official-name', normalized);
      await this.attach(tx, candidate.id, 'hoyolab-post', post.id);
      const updates=Object.entries(fields).filter(([key,value])=>!sameEditorialValue(readFields(candidate.fields)[key as keyof CatalogFields],value));
      for (const [field,value] of updates) await tx.catalogAttempt.create({data:{runId,candidateId:candidate.id,provider:value!.provider,field,
        outcome:readFields(candidate.fields)[field as keyof CatalogFields]?'UPDATED':'ADDED',sourceUrl:value!.url,checkedAt:this.now()}});
      await tx.catalogCandidate.update({ where: { id: candidate.id }, data: { fields: json(fields),...(updates.length?{revision:{increment:1}}:{}) } });
      if(created||updates.length) await this.notifyReview(tx,candidate.id,candidate.name,[created?'Nouvelle annonce':updates.map(([key])=>`${key} : nouvelle information`).join(' ; ')],`announcement:${post.id}:${updates.map(([key,value])=>`${key}:${value?.value}`).join('|')}`);
      for (const url of canCollect(candidate, 'promotion') ? post.promotion.slice(0, 3) : []) {
        if (await tx.catalogAsset.findFirst({ where: { candidateId: candidate.id, role: 'promotion', sourceUrl: url } })) continue;
        await tx.catalogAsset.create({ data: { candidateId: candidate.id, role: 'promotion', hash: `source:${createHash('sha256').update(url).digest('hex')}`,
          provider: 'hoyoverse', sourceUrl: url, status: 'UNVERIFIED' } });
      }
      await this.addChanges(tx,runId,created?1:updates.length);
      return created ? 1 : updates.length;
    });
  }
  private async seedHistorical(token: string) {
    const rows = await this.db.character.findMany({ where: { catalogCandidate: null }, take: 150, orderBy: { id: 'asc' } });
    for (const row of rows) await this.fenced(token, async tx => {
      const fields: CatalogFields = {};
      for (const [key, value] of [['name', row.name], ['rarity', row.rarity], ['element', row.elementKey], ['weapon', row.weaponType], ['region', row.region]] as const) {
        if (value !== null) fields[key] = { value, provider: 'catalog', url: `character:${row.id}`, fetchedAt: this.now().toISOString(), reliability: 'ADMIN', override: true };
      }
      const candidate = await tx.catalogCandidate.upsert({ where: { characterId: row.id }, create: { characterId: row.id, name: row.name, status: 'PUBLISHED', fields: json(fields), publishedAt: row.createdAt,
        progressivePolicy:false, trackingState: 'PROTECTED', trackingElements: [], trackingReason: 'Fiche historique protégée.' }, update: {} });
      await this.attach(tx, candidate.id, 'catalog', row.externalKey);
    });
  }
  private async finalize(token: string, id: string, started: Date, expectedRevision: number) {
    const snapshot = await this.db.catalogCandidate.findUniqueOrThrow({ where: { id }, include: { assets: true } });
    const pending = snapshot.progressivePolicy ? progressiveEligibility(readFields(snapshot.fields),started) : eligibility(readFields(snapshot.fields), snapshot.assets.filter(row => row.status === 'AVAILABLE').map(row => row.role), started);
    const canPublish = this.settings.enabled && !this.settings.dryRun && this.settings.publish && (snapshot.progressivePolicy || this.storage.configured);
    const verified = !snapshot.characterId && pending.status === 'ELIGIBLE' && canPublish ? await this.verifyPublication(id) : [];
    await this.fenced(token, async tx => {
      await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE id = ${id}::uuid FOR UPDATE`;
      const candidate = await tx.catalogCandidate.findUniqueOrThrow({ where: { id }, include: { assets: true, character: true } });
      if (candidate.revision !== expectedRevision || !isTracked(candidate)) throw new CatalogFetchError('REVISION_CHANGED');
      const fields = readFields(candidate.fields);
      if(!candidate.characterId&&candidate.progressivePolicy&&pending.status==='ELIGIBLE'&&canPublish){
        for(const asset of candidate.assets.filter(asset=>asset.status==='AVAILABLE'&&Object.keys(rolePath).includes(asset.role)&&!verified.includes(asset.id))){
          await tx.catalogAsset.update({where:{id:asset.id},data:{status:'UNVERIFIED',checkedAt:this.now()}});
          await tx.catalogAttempt.create({data:{runId:this.activeRunId!,candidateId:id,provider:'storage',field:asset.role,outcome:'ERROR',errorCode:this.publicationAssetFailures.get(asset.id)??'STORAGE_VERIFICATION_FAILED',sourceUrl:asset.url,checkedAt:this.now()}});
        }
      }
      const available = candidate.assets.filter(row => row.status === 'AVAILABLE').map(row => row.role);
      if (candidate.character) for (const [role, path] of Object.entries(rolePath)) if (candidate.character[path as 'iconPath']) available.push(role);
      const result = candidate.progressivePolicy ? progressiveEligibility(fields,started) : eligibility(fields, available, started);
      await tx.catalogCandidate.update({ where: { id }, data: { status: candidate.characterId ? 'PUBLISHED' : result.status, missing: result.missing,
        officialReleaseDate: result.officialDate ? new Date(`${result.officialDate}T00:00:00Z`) : null, checkedAt: this.now(), nextCheckAt: getNextBusinessResetAt(this.now()) } });
      if(candidate.progressivePolicy){
        const state=progressiveEligibility(fields,started);
        const critical=['name','originalName','rarity','element','releaseDate','playable'].filter(key=>unresolvedEvidence(fields[key as keyof CatalogFields]));
        if(state.availabilityConflict)critical.push('availabilityConflict');
        const economicMismatch=candidate.character&&(['rarity','element'] as const).filter(key=>fields[key]&&String(fields[key]?.value)!==String(key==='rarity'?candidate.character!.rarity:candidate.character!.elementKey));
        const reasons=critical.length?`Arbitrer les preuves contradictoires : ${critical.join(', ')}.`:economicMismatch&&economicMismatch.length?`Confirmer la contradiction avec le personnage actif (${economicMismatch.join(', ')}) ; aucune correction économique automatique.`:!candidate.characterId&&state.publicVisible&&state.missing.length?`Confirmer les minimums de jeu : ${state.missing.join(', ')}.`:null;
        if(!candidate.characterId&&state.publicVisible)await this.notifyReview(tx,id,candidate.name,['preparation : visible'],`preparation:${id}`);
        if(reasons)await this.notifyReview(tx,id,candidate.name,[`intervention : ${reasons}`],`intervention:${reasons}:${editorialFingerprint(Object.fromEntries(['name','originalName','rarity','element','releaseDate','playable'].map(key=>[key,meaningfulEvidence(fields[key as keyof CatalogFields])])) )}`);
        if(!reasons&&!candidate.characterId&&state.missing.some(key=>['stableIdentity','rarity','rarityConfirmation','element','elementConfirmation'].includes(key))){
          const attempts=await tx.catalogAttempt.findMany({where:{candidateId:id,field:{in:['metadata','coverage','candidate','secondary-page']},outcome:'ERROR'},orderBy:{checkedAt:'desc'},take:60});
          const failedRuns=[...new Set(attempts.filter(attempt=>['SCHEMA_CHANGED','AUTHOR_NOT_OFFICIAL','IDENTITY_CONFLICT'].includes(attempt.errorCode??'')).map(attempt=>attempt.runId))];
          if(failedRuns.length>=3)await this.notifyReview(tx,id,candidate.name,['intervention : Vérifier les sources des minimums de jeu après trois recherches en échec de qualification.'],`retry-exhausted:${[...new Set(attempts.map(attempt=>attempt.errorCode))].sort().join(',')}:${state.missing.join(',')}`);
        }
      }
      if (candidate.characterId) {
        // Only explicitly opened image roles may change. Previous immutable objects remain stored.
        for (const [role, path] of Object.entries(rolePath)) {
          const asset = candidate.assets.filter(row => row.role === role && row.status === 'AVAILABLE' && row.url).sort((a,b) => b.checkedAt.getTime()-a.checkedAt.getTime() || a.id.localeCompare(b.id))[0];
          if (asset?.url && canCollect(candidate, role) && !candidate.assets.some(row => row.role === role && row.autoLocked))
            await tx.character.updateMany({ where: { id: candidate.characterId, [path]: candidate.character?.[path as 'iconPath'] ?? null }, data: { [path]: asset.url } });
        }
        if (result.officialDate && canCollect(candidate, 'releaseDate')) await tx.character.updateMany({ where: { id: candidate.characterId, releaseDate: null }, data: { releaseDate: new Date(`${result.officialDate}T00:00:00Z`) } });
        if (fields.weapon && canCollect(candidate, 'weapon') && fields.weapon.reliability !== 'PROVISIONAL' && optionalWeapon(fields.weapon.value)) await tx.character.updateMany({ where: { id: candidate.characterId, weaponType: null }, data: { weaponType: optionalWeapon(fields.weapon.value) } });
        if (fields.region && canCollect(candidate, 'region') && fields.region.reliability !== 'PROVISIONAL') await tx.character.updateMany({ where: { id: candidate.characterId, region: null }, data: { region: String(fields.region.value) } });
        if (!candidate.progressivePolicy && shouldStopAtRelease(candidate.characterId, fields, started, candidate.releaseFollowupAuthorized)) await tx.catalogCandidate.update({ where: { id }, data: {
          trackingState: 'PROTECTED', trackingElements: [], trackingReason: 'Sortie officielle confirmée.', revision: { increment: 1 } } });
      } else if (result.status === 'ELIGIBLE' && canPublish) await this.publish(tx, candidate, fields, false, verified);
    });
  }
  async verifyPublication(candidateId: string): Promise<string[]> {
    this.publicationAssetFailures.clear();
    const rows = await this.db.catalogAsset.findMany({ where: { candidateId, status: 'AVAILABLE' }, orderBy: [{ checkedAt: 'desc' }, { id: 'asc' }] });
    const verified: string[] = [];
    const candidate = await this.db.catalogCandidate.findUniqueOrThrow({where:{id:candidateId}});
    for (const role of candidate.progressivePolicy ? Object.keys(rolePath) : ['icon', 'splash']) {
      const asset = rows.find(row => row.role === role);
      if(!asset && candidate.progressivePolicy)continue;
      try{
      if (!asset?.url || !this.storage.owns(asset.url, candidateId, role, asset.hash)) throw new CatalogFetchError('STORAGE_ASSET_INVALID');
      await this.checkCancellation();
      const response = await this.http(asset.url, { noRedirect: true, signal:this.controller?.signal });
      if (response.status !== 200 || response.mime !== 'image/png' || createHash('sha256').update(response.body).digest('hex') !== asset.hash)
        throw new CatalogFetchError('STORAGE_VERIFICATION_FAILED', response.status);
      verified.push(asset.id);
      }catch(error){
        if(!candidate.progressivePolicy||error instanceof CatalogFetchError&&['CANCELLED','BUDGET_EXHAUSTED','LEASE_LOST'].includes(error.code))throw error;
        if(asset)this.publicationAssetFailures.set(asset.id,error instanceof CatalogFetchError?error.code:'STORAGE_VERIFICATION_FAILED');
      }
    }
    return verified;
  }
  async publish(tx: Prisma.TransactionClient, candidate: CatalogCandidate, fields: CatalogFields, overrideWindow = false, verified: readonly string[] = []) {
    if (!isTracked(candidate)) throw new CatalogFetchError('FICHE_PROTEGEE');
    if(candidate.characterId)throw new CatalogFetchError('ALREADY_PUBLISHED');
    const assets = await tx.catalogAsset.findMany({ where: { candidateId: candidate.id, status: 'AVAILABLE' }, orderBy: [{ checkedAt: 'desc' }, { id: 'asc' }] });
    const result = candidate.progressivePolicy ? progressiveEligibility(fields,this.now()) : eligibility(fields, assets.map(row => row.role), this.now(), overrideWindow);
    if (result.status !== 'ELIGIBLE') throw new CatalogFetchError('NOT_ELIGIBLE');
    if(!candidate.progressivePolicy)for (const role of ['icon', 'splash']) if (!verified.includes(assets.find(row => row.role === role)?.id ?? '')) throw new CatalogFetchError('STORAGE_VERIFICATION_REQUIRED');
    const numericId = /^1\d{7}$/.test(String(fields.numericId?.value)) && fields.numericId?.reliability!=='PROVISIONAL' && !unresolvedEvidence(fields.numericId) ? String(fields.numericId!.value) : null;
    const identities=await tx.catalogIdentity.findMany({where:{candidateId:candidate.id}});
    const nameIdentity=identities.find(row=>row.namespace==='official-name'&&row.externalId===normalizedIdentity(String(fields.originalName?.value??fields.name?.value)));
    const officialProof=fields.originalName?.reliability==='OFFICIAL'&&fields.originalName.provider==='hoyoverse'&& /^https:\/\/www\.hoyolab\.com\/article\/\d+$/.test(fields.originalName.url)&&identities.some(row=>row.namespace==='hoyolab-post'&&fields.originalName!.url.endsWith(`/${row.externalId}`));
    const numericIdentity=numericId&&identities.some(row=>row.namespace==='genshin'&&row.externalId===numericId);
    const manualIdentity=identities.some(row=>row.namespace==='manual')&&(fields.originalName??fields.name)?.reliability==='ADMIN';
    if(!numericIdentity && !(candidate.progressivePolicy&&nameIdentity&&(officialProof||manualIdentity)))throw new CatalogFetchError('IDENTITY_CONFLICT');
    const externalKey=numericId?`genshin:${numericId}`:`catalog:${candidate.id}`;
    // Serialize global alias checks with concurrent activation, including name-only identities.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(70422473)`;
    const existing = await tx.character.findFirst({ where: { OR: [{ externalKey },
      ...[fields.name, fields.originalName].filter(field=>field&&trustedEvidence(field)&&!unresolvedEvidence(field)).map(field => ({ name: { equals: String(field!.value), mode: 'insensitive' as const } }))] } });
    if (existing) throw new CatalogFetchError('IDENTITY_CONFLICT');
    const safeAssets=candidate.progressivePolicy?assets.filter(asset=>verified.includes(asset.id)):assets;
    const paths = Object.fromEntries(Object.entries(rolePath).map(([role, path]) => [path, safeAssets.find(asset => asset.role === role)?.url ?? null]));
    const resolved=candidate.progressivePolicy?progressiveEligibility(fields,this.now()).fields:fields;
    const safeName=trustedEvidence(fields.name)&&!unresolvedEvidence(fields.name)?fields.name:fields.originalName??fields.name;
    const character = await tx.character.create({ data: { externalKey, name: String(safeName!.value),
      rarity: Number(resolved.rarity!.value), elementKey: String(resolved.element!.value), weaponType: optionalWeapon(fields.weapon?.value),
      region: fields.region ? String(fields.region.value) : null,
      classKey: fields.classKey?.reliability === 'ADMIN' && fields.classKey.override ? String(fields.classKey.value) : null,
      displayOrder: fields.displayOrder?.reliability === 'ADMIN' && fields.displayOrder.override ? Number(fields.displayOrder.value) : null,
      releaseDate: result.officialDate ? new Date(`${result.officialDate}T00:00:00Z`) : null, ...paths,
      sourceMetadata: { catalogCandidateId: candidate.id, genshinId: numericId } } });
    await tx.catalogCandidate.update({ where: { id: candidate.id }, data: { characterId: character.id, status: 'PUBLISHED', publishedAt: this.now(),
      ...(!candidate.progressivePolicy&&shouldStopAtRelease(character.id, fields, this.now()) ? { trackingState: 'PROTECTED', trackingElements: [], trackingReason: 'Premier import effectué ; personnage officiellement sorti.' } : {}) } });
    const missing = [...['weapon', 'region'].filter(field => !fields[field as keyof CatalogFields]),
      ...['wish', 'fullbody'].filter(role => !assets.some(asset => asset.role === role))];
    await tx.catalogImportOutbox.create({ data: { candidateId: candidate.id, characterId: character.id, name: character.name,
      payload: { title: `Nouveau personnage ajouté : ${character.name}`,
        message: `${character.rarity}★ · ${character.elementKey}${result.officialDate?` · Sortie officielle : ${result.officialDate}`:' · Disponibilité jouable confirmée'}.${resolved.rarity?.reliability==='PROVISIONAL'||resolved.element?.reliability==='PROVISIONAL'?' Informations de jeu provisoires (consensus qualifié).':''}${missing.length ? ` À compléter : ${missing.join(', ')}.` : ''} Sources et détails dans Modération > Personnages.`,
        candidateId: candidate.id, found: { name: character.name, rarity: character.rarity, element: character.elementKey, releaseDate: result.officialDate }, missing } } });
  }
  async deliverNotifications() {
    for (const item of await this.db.catalogImportOutbox.findMany({ where: { deliveredAt: null }, take: 25 })) {
      await this.db.$transaction(async tx => {
        await tx.$queryRaw`SELECT candidate_id FROM catalog_import_outbox WHERE candidate_id = ${item.candidateId}::uuid FOR UPDATE`;
        const current = await tx.catalogImportOutbox.findUniqueOrThrow({ where: { candidateId: item.candidateId } });
        if (current.deliveredAt) return;
        const admins = await tx.playerRoleAssignment.findMany({ where: { role: 'ADMIN', revokedAt: null, player: { status: 'ACTIVE' } }, select: { playerId: true } });
        for (const admin of admins) await tx.notification.upsert({ where: { deduplicationKey: `catalog-import:${item.characterId}:${admin.playerId}` },
          create: { playerId: admin.playerId, domainKey: 'character-catalog', typeKey: 'CHARACTER_IMPORTED_ADMIN', payload: item.payload as Prisma.InputJsonValue,
            actionKey: 'OPEN_ADMIN_CHARACTER', actionTargetId: item.characterId, deduplicationKey: `catalog-import:${item.characterId}:${admin.playerId}` }, update: {} });
        await tx.catalogImportOutbox.update({ where: { candidateId: item.candidateId }, data: { deliveredAt: this.now() } });
      });
    }
  }
}
