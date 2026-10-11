import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import { AdminOperation } from '../moderation/admin-operation.js';
import { readFields, type CatalogFields, type AssetRole } from './catalog-policy.js';
import type { CatalogEngine } from './catalog-engine.js';
import { validateImage, maxImageBytes } from '../../infrastructure/character-catalog/catalog-images.js';
import { normalizedIdentity } from './catalog-policy.js';
import type { CharacterAdminPatch } from '../moderation/character-admin-service.js';
import { trackingElements, type TrackingElement, shouldStopAtRelease } from './catalog-followup.js';
import { recordImageVersion } from './catalog-image-version.js';
import { activeCatalogStates, lockCatalogJob, admitCatalogRun } from './catalog-control.js';
import { canonicalRegion, normalizeWeapon } from './catalog-metadata.js';
import { adminCandidateProjection, progressiveEligibility } from './catalog-progressive.js';

export class CatalogAdminService {
  private readonly operation: AdminOperation;
  constructor(private readonly db: PrismaClient, getPlayer: GetCurrentPlayer, private readonly engine: CatalogEngine) {
    this.operation = new AdminOperation(db, getPlayer);
  }
  async create(identity: AuthenticatedIdentity, input: CharacterAdminPatch & { externalKey: string; name: string; rarity: 4 | 5; elementKey: string; idempotencyKey: string }) {
    const { idempotencyKey, ...values } = input;
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'character-catalog', action: 'create-candidate', idempotencyKey,
      request: values as Prisma.InputJsonValue, change: async tx => {
        if (typeof input.weaponType === 'string') input = { ...input, weaponType: input.weaponType.trim() ? normalizeWeapon(input.weaponType) : null };
        if (typeof input.region === 'string') input = { ...input, region: input.region.trim() ? await canonicalRegion(tx, input.region) : null };
        if (input.isActive === false) throw new AppError('Créer une fiche candidate sans activation ; le statut actif sera déterminé par les contrôles de publication.', 400, 'CATALOG_VALIDATION_FAILED');
        if (await tx.character.findFirst({ where: { OR: [{ externalKey: input.externalKey }, { name: { equals: input.name, mode: 'insensitive' } }] } }) ||
          await tx.catalogIdentity.findUnique({ where: { namespace_externalId: { namespace: 'official-name', externalId: normalizedIdentity(input.name) } } }))
          throw new AppError('Cette identité existe déjà. Ouvrir sa fiche pour la compléter.', 409, 'CATALOG_DUPLICATE');
        const fields: CatalogFields = {};
        for (const [field, value] of [['name', input.name], ['originalName', input.name], ['rarity', input.rarity], ['element', input.elementKey],
          ['weapon', input.weaponType], ['region', input.region], ['classKey', input.classKey], ['displayOrder', input.displayOrder]] as const) {
          if (value !== undefined && value !== null) fields[field] = { value, provider: 'admin', url: `admin-operation:${idempotencyKey}`,
            fetchedAt: new Date().toISOString(), reliability: 'ADMIN', override: true, locked: true, adminValidated: true, editorialStatus: 'VALIDATED' };
        }
        const state = progressiveEligibility(fields, new Date());
        const row = await tx.catalogCandidate.create({ data: { name: input.name, progressivePolicy:true, fields: fields as Prisma.InputJsonValue, status: state.status, missing: state.missing,
          identities: { create: [{ namespace: 'manual', externalId: input.externalKey }, { namespace: 'official-name', externalId: normalizedIdentity(input.name) }] } } });
        return { before: { exists: false }, after: { candidateId: row.id, published: false } };
      } });
  }
  async overview(identity: AuthenticatedIdentity, search = '', page = 1, filter = 'tracked') {
    await this.operation.actor(identity, 'ADMIN');
    const where = { ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(filter === 'tracked' ? { trackingState: 'ACTIVE', trackingElements: { isEmpty: false } } : filter === 'protected' ? { trackingState: 'PROTECTED' } : filter === 'all' ? {} : { status: filter }) };
    const total = await this.db.catalogCandidate.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / 20)), currentPage = Math.min(page, totalPages);
    const entries = await this.db.catalogCandidate.findMany({ where,
      include: { assets: true, identities: true, character: { select: { iconPath: true, splashPath: true, wishPath: true, fullbodyPath: true } } }, orderBy: [{ discoveredAt: 'desc' }, { id: 'asc' }], take: 20, skip: (currentPage - 1) * 20 });
    const runs = await this.db.catalogRun.findMany({ orderBy: { startedAt: 'desc' }, take: 5 });
    return { entries:entries.map(row=>adminCandidateProjection(row,new Date())), runs, total, page: currentPage, totalPages, activeRun: await this.db.catalogRun.findFirst({where:{status:{in:activeCatalogStates}},orderBy:{startedAt:'asc'}}), job: await this.db.catalogJob.findUnique({ where: { id: 'R1051' }, select: { lastSuccessAt: true, lastSuccessDate: true, leaseUntil: true } }),
      enabled: this.engine.settings.enabled, dryRun: this.engine.settings.dryRun, publicationEnabled: this.engine.settings.publish,
      storageConfigured: this.engine.storage.configured };
  }
  async detail(identity: AuthenticatedIdentity, id: string) {
    await this.operation.actor(identity, 'ADMIN');
    const candidate = await this.db.catalogCandidate.findUnique({ where: { id }, include: { assets: true, identities: true, character: true,
      attempts: { orderBy: { checkedAt: 'desc' }, take: 40 } } });
    if (!candidate) throw new AppError('Fiche candidate introuvable.', 404, 'CATALOG_NOT_FOUND');
    return adminCandidateProjection(candidate,new Date());
  }
  async edit(identity: AuthenticatedIdentity, id: string, values: Partial<Record<'name' | 'originalName' | 'rarity' | 'element' | 'weapon' | 'region', string | number>>, key: string) {
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'character-catalog', action: 'metadata', idempotencyKey: key, request: { id, values },
      change: async tx => {
        await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE id = ${id}::uuid FOR UPDATE`;
        const candidate = await tx.catalogCandidate.findUniqueOrThrow({ where: { id } });
        const fields = { ...readFields(candidate.fields) };
        // Live Character metadata still goes through CharacterAdminService and its reference guards.
        if (candidate.characterId) throw new AppError('Modifier la fiche du catalogue actif pour ces métadonnées.', 409, 'CATALOG_USE_CHARACTER_EDITOR');
        values = { ...values, ...(typeof values.weapon === 'string' ? { weapon: normalizeWeapon(values.weapon) } : {}),
          ...(typeof values.region === 'string' ? { region: await canonicalRegion(tx, values.region) } : {}) };
        for (const name of [values.name, values.originalName]) if (typeof name === 'string') {
          const externalId = normalizedIdentity(name);
          const alias = await tx.catalogIdentity.findUnique({ where: { namespace_externalId: { namespace: 'official-name', externalId } } });
          if (alias && alias.candidateId !== id) throw new AppError('Ce nom appartient déjà à une autre fiche.', 409, 'CATALOG_DUPLICATE');
          await tx.catalogIdentity.upsert({ where: { namespace_externalId: { namespace: 'official-name', externalId } }, create: { namespace: 'official-name', externalId, candidateId: id }, update: {} });
        }
        for (const [field, value] of Object.entries(values)) fields[field as keyof CatalogFields] = { value, provider: 'admin', url: `admin-operation:${key}`,
          fetchedAt: new Date().toISOString(), reliability: 'ADMIN', override: true, locked: true, adminValidated: true, editorialStatus: 'VALIDATED' };
        await tx.catalogCandidate.update({ where: { id }, data: { ...(typeof values.name === 'string' ? { name: values.name } : {}), fields: fields as Prisma.InputJsonValue, revision: { increment: 1 }, nextCheckAt: new Date() } });
        return { before: { candidateId: id, fields: candidate.fields }, after: { candidateId: id, fields: fields as Prisma.InputJsonValue } };
      } });
  }
  async tracking(identity: AuthenticatedIdentity, id: string, action: 'protect' | 'pause' | 'resume' | 'validate', elements: readonly TrackingElement[], reason: string, expectedRevision: number, key: string) {
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'character-catalog', action: `tracking-${action}`, idempotencyKey: key,
      request: { id, action, elements: [...elements], reason, expectedRevision }, change: async tx => {
        await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE id = ${id}::uuid FOR UPDATE`;
        const candidate = await tx.catalogCandidate.findUniqueOrThrow({ where: { id }, include: { assets: true } });
        if (candidate.revision !== expectedRevision) throw new AppError('La fiche a changé. Actualiser avant de confirmer.',409,'CATALOG_REVISION_CONFLICT');
        const selected = [...new Set(elements)];
        if ((action === 'resume' || action === 'validate') && (!selected.length || selected.some(value=>!trackingElements.includes(value)))) throw new AppError('Choisir les éléments concernés.',400,'CATALOG_INVALID_SCOPE');
        const fields = {...readFields(candidate.fields)};
        for (const element of selected) {
          const field = element as keyof CatalogFields;
          if (fields[field]) fields[field] = {...fields[field]!, locked: action !== 'resume', ...(action === 'validate'?{adminValidated:true,editorialStatus:'VALIDATED' as const}:{})};
          else if (action === 'validate' && !candidate.assets.some(asset=>asset.role===element&&asset.status==='AVAILABLE')) throw new AppError('Un élément absent ne peut pas être validé.',409,'CATALOG_ELEMENT_MISSING');
          await tx.catalogAsset.updateMany({where:{candidateId:id,role:element},data:{autoLocked:action!=='resume',...(action==='validate'?{adminValidated:true,editorialStatus:'VALIDATED'}:{})}});
        }
        const remaining = action === 'resume' ? selected : action === 'validate' ? candidate.trackingElements.filter(value=>!selected.includes(value as TrackingElement)) : [];
        const state = action === 'pause' ? 'PAUSED' : action === 'protect' || !remaining.length ? 'PROTECTED' : 'ACTIVE';
        const after = await tx.catalogCandidate.update({where:{id},data:{trackingState:state,trackingElements:remaining,trackingReason:reason,fields:fields as Prisma.InputJsonValue,
          ...(action==='resume'?{progressivePolicy:true}:{}),
          releaseFollowupAuthorized:action==='resume'?shouldStopAtRelease(candidate.characterId,fields,new Date()):action==='validate'?candidate.releaseFollowupAuthorized:false,revision:{increment:1},...(action==='resume'?{nextCheckAt:new Date()}:{})}});
        if (state!=='ACTIVE') await tx.catalogAsset.updateMany({where:{candidateId:id},data:{autoLocked:true}});
        return {before:{candidateId:id,trackingState:candidate.trackingState,elements:candidate.trackingElements},after:{candidateId:id,trackingState:after.trackingState,elements:after.trackingElements,reason}};
      }});
  }
  async queue(identity: AuthenticatedIdentity, id: string | null, mode: 'audit' | 'retry', key: string) {
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'character-catalog', action: mode, idempotencyKey: key, request: { id, mode }, change: async tx => {
      await lockCatalogJob(tx);
      await admitCatalogRun(tx);
      if(id) {
        const candidate=await tx.catalogCandidate.findUniqueOrThrow({ where: { id } });
        if(candidate.trackingState!=='ACTIVE'||!candidate.trackingElements.length) throw new AppError('Cette fiche est protégée. Reprendre explicitement les seuls éléments concernés.',409,'CATALOG_PROTECTED');
      }
      await tx.catalogRun.create({ data: { cycleKey: `manual:${key}`, status: 'QUEUED', summary: { mode, ...(id?{candidateId:id}:{}), apply:mode==='retry' } } });
      return { before: { candidateId: id }, after: { candidateId: id, mode, queued: true } };
    } });
  }
  async cancel(identity: AuthenticatedIdentity, runId: string, key: string) {
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'character-catalog', action: 'cancel', idempotencyKey: key, request: {runId}, change: async tx => {
      await lockCatalogJob(tx);
      const run = await tx.catalogRun.findUnique({where:{id:runId}});
      if (!run) throw new AppError('Recherche introuvable.',404,'CATALOG_NOT_FOUND');
      if (!activeCatalogStates.includes(run.status)) return {before:{runId,status:run.status},after:{runId,status:run.status}};
      const job = await tx.catalogJob.findUniqueOrThrow({where:{id:'R1051'}});
      const running = run.status === 'RUNNING' && !!job.leaseUntil && job.leaseUntil > new Date();
      const updated = await tx.catalogRun.update({where:{id:runId},data:{cancelRequestedAt:run.cancelRequestedAt??new Date(),...(!running?{status:'CANCELLED',completedAt:new Date()}:{})}});
      return {before:{runId,status:run.status},after:{runId,status:updated.status,cancellationRequested:true}};
    }});
  }
  async upload(identity: AuthenticatedIdentity, id: string, role: Exclude<AssetRole, 'promotion'>, body: Buffer, mime: string, key: string) {
    await this.operation.actor(identity, 'ADMIN');
    const candidate = await this.db.catalogCandidate.findUniqueOrThrow({ where: { id }, include: { character: true } });
    const path = { icon: 'iconPath', splash: 'splashPath', wish: 'wishPath', fullbody: 'fullbodyPath' } as const;
    if (body.length > maxImageBytes) throw new AppError('Image trop volumineuse.', 400, 'CATALOG_IMAGE_TOO_LARGE');
    const image = await validateImage(body, mime, role);
    const url = await this.engine.storage.store(id, role, image);
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'character-catalog', action: 'upload', idempotencyKey: key,
      request: { id, role, hash: image.hash }, change: async tx => {
        await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE id = ${id}::uuid FOR UPDATE`;
        const current=await tx.catalogCandidate.findUniqueOrThrow({where:{id},include:{character:true}});
        if(current.revision!==candidate.revision) throw new AppError('La fiche a changé. Actualiser avant de remplacer son image.',409,'CATALOG_REVISION_CONFLICT');
        const before = await tx.catalogAsset.findMany({ where: { candidateId: id, role, status: 'AVAILABLE' }, select: { hash: true } });
        await recordImageVersion(tx, { candidateId:id, role, image, provider:'admin', sourceUrl:`admin-operation:${key}`,
          sourceMime:mime, url, editorialStatus:'VALIDATED', manual:true, now:new Date() });
        await tx.catalogAsset.updateMany({where:{candidateId:id,role},data:{autoLocked:true}});
        if(current.characterId) await tx.character.update({where:{id:current.characterId},data:{[path[role]]:url}});
        await tx.catalogCandidate.update({ where: { id }, data: { revision: { increment: 1 }, trackingElements:{set:current.trackingElements.filter(element=>element!==role)} } });
        // Upload does not silently enqueue another collection. ADMIN can request
        // a new check explicitly through the shared admission gate.
        return { before: { candidateId: id, role, hashes: before.map(row => row.hash) }, after: { candidateId: id, role, hash: image.hash } };
      } });
  }
  async override(identity: AuthenticatedIdentity, id: string, key: string, reason: string, expectedRevision: number) {
    await this.operation.actor(identity, 'ADMIN');
    if (!this.engine.settings.enabled || !this.engine.settings.publish || this.engine.settings.dryRun || !this.engine.storage.configured)
      throw new AppError('Publication bloquée : configuration et validation du stockage requises.', 503, 'CATALOG_PUBLICATION_DISABLED');
    const verified = await this.engine.verifyPublication(id);
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'character-catalog', action: 'override-window', idempotencyKey: key,
      request: { id, reason, expectedRevision }, change: async tx => {
        await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE id = ${id}::uuid FOR UPDATE`;
        const candidate = await tx.catalogCandidate.findUniqueOrThrow({ where: { id } });
        if (candidate.characterId || candidate.revision !== expectedRevision) throw new AppError('La fiche a changé. Recharger avant de confirmer.', 409, 'CATALOG_REVISION_CONFLICT');
        await this.engine.publish(tx, candidate, readFields(candidate.fields), true, verified);
        return { before: { candidateId: id, status: candidate.status }, after: { candidateId: id, overrideWindow: true, reason } };
      } });
  }
}
