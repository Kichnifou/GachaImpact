import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import { AdminOperation } from '../moderation/admin-operation.js';
import { readFields, type CatalogFields, type AssetRole } from './catalog-policy.js';
import type { CatalogEngine } from './catalog-engine.js';
import { validateImage, maxImageBytes } from '../../infrastructure/character-catalog/catalog-images.js';
import { normalizedIdentity, eligibility } from './catalog-policy.js';
import type { CharacterAdminPatch } from '../moderation/character-admin-service.js';

export class CatalogAdminService {
  private readonly operation: AdminOperation;
  constructor(private readonly db: PrismaClient, getPlayer: GetCurrentPlayer, private readonly engine: CatalogEngine) {
    this.operation = new AdminOperation(db, getPlayer);
  }
  async create(identity: AuthenticatedIdentity, input: CharacterAdminPatch & { externalKey: string; name: string; rarity: 4 | 5; elementKey: string; idempotencyKey: string }) {
    const { idempotencyKey, ...values } = input;
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'character-catalog', action: 'create-candidate', idempotencyKey,
      request: values as Prisma.InputJsonValue, change: async tx => {
        if (input.isActive === false) throw new AppError('Créer une fiche candidate sans activation ; le statut actif sera déterminé par les contrôles de publication.', 400, 'CATALOG_VALIDATION_FAILED');
        if (await tx.character.findFirst({ where: { OR: [{ externalKey: input.externalKey }, { name: { equals: input.name, mode: 'insensitive' } }] } }) ||
          await tx.catalogIdentity.findUnique({ where: { namespace_externalId: { namespace: 'official-name', externalId: normalizedIdentity(input.name) } } }))
          throw new AppError('Cette identité existe déjà. Ouvrir sa fiche pour la compléter.', 409, 'CATALOG_DUPLICATE');
        const fields: CatalogFields = {};
        for (const [field, value] of [['name', input.name], ['originalName', input.name], ['rarity', input.rarity], ['element', input.elementKey],
          ['weapon', input.weaponType], ['region', input.region], ['classKey', input.classKey], ['displayOrder', input.displayOrder]] as const) {
          if (value !== undefined && value !== null) fields[field] = { value, provider: 'admin', url: `admin-operation:${idempotencyKey}`,
            fetchedAt: new Date().toISOString(), reliability: 'ADMIN', override: true };
        }
        const state = eligibility(fields, [], new Date());
        const row = await tx.catalogCandidate.create({ data: { name: input.name, fields: fields as Prisma.InputJsonValue, status: state.status, missing: state.missing,
          identities: { create: [{ namespace: 'manual', externalId: input.externalKey }, { namespace: 'official-name', externalId: normalizedIdentity(input.name) }] } } });
        return { before: { exists: false }, after: { candidateId: row.id, published: false } };
      } });
  }
  async overview(identity: AuthenticatedIdentity, search = '') {
    await this.operation.actor(identity, 'ADMIN');
    const entries = await this.db.catalogCandidate.findMany({ where: search ? { name: { contains: search, mode: 'insensitive' } } : {},
      include: { assets: true, identities: true, character: { select: { iconPath: true, splashPath: true, wishPath: true, fullbodyPath: true } } }, orderBy: [{ discoveredAt: 'desc' }, { id: 'asc' }], take: 150 });
    const runs = await this.db.catalogRun.findMany({ orderBy: { startedAt: 'desc' }, take: 5 });
    return { entries, runs, job: await this.db.catalogJob.findUnique({ where: { id: 'R1051' }, select: { lastSuccessAt: true, lastSuccessDate: true, leaseUntil: true } }),
      enabled: this.engine.settings.enabled, dryRun: this.engine.settings.dryRun, publicationEnabled: this.engine.settings.publish,
      storageConfigured: this.engine.storage.configured };
  }
  async detail(identity: AuthenticatedIdentity, id: string) {
    await this.operation.actor(identity, 'ADMIN');
    const candidate = await this.db.catalogCandidate.findUnique({ where: { id }, include: { assets: true, identities: true, character: true,
      attempts: { orderBy: { checkedAt: 'desc' }, take: 40 } } });
    if (!candidate) throw new AppError('Fiche candidate introuvable.', 404, 'CATALOG_NOT_FOUND');
    return candidate;
  }
  async edit(identity: AuthenticatedIdentity, id: string, values: Partial<Record<'name' | 'originalName' | 'rarity' | 'element' | 'weapon' | 'region', string | number>>, key: string) {
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'character-catalog', action: 'metadata', idempotencyKey: key, request: { id, values },
      change: async tx => {
        await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE id = ${id}::uuid FOR UPDATE`;
        const candidate = await tx.catalogCandidate.findUniqueOrThrow({ where: { id } });
        const fields = { ...readFields(candidate.fields) };
        // Live Character metadata still goes through CharacterAdminService and its reference guards.
        if (candidate.characterId) throw new AppError('Modifier la fiche du catalogue actif pour ces métadonnées.', 409, 'CATALOG_USE_CHARACTER_EDITOR');
        for (const name of [values.name, values.originalName]) if (typeof name === 'string') {
          const externalId = normalizedIdentity(name);
          const alias = await tx.catalogIdentity.findUnique({ where: { namespace_externalId: { namespace: 'official-name', externalId } } });
          if (alias && alias.candidateId !== id) throw new AppError('Ce nom appartient déjà à une autre fiche.', 409, 'CATALOG_DUPLICATE');
          await tx.catalogIdentity.upsert({ where: { namespace_externalId: { namespace: 'official-name', externalId } }, create: { namespace: 'official-name', externalId, candidateId: id }, update: {} });
        }
        for (const [field, value] of Object.entries(values)) fields[field as keyof CatalogFields] = { value, provider: 'admin', url: `admin-operation:${key}`,
          fetchedAt: new Date().toISOString(), reliability: 'ADMIN', override: true };
        await tx.catalogCandidate.update({ where: { id }, data: { ...(typeof values.name === 'string' ? { name: values.name } : {}), fields: fields as Prisma.InputJsonValue, revision: { increment: 1 }, nextCheckAt: new Date() } });
        return { before: { candidateId: id, fields: candidate.fields }, after: { candidateId: id, fields: fields as Prisma.InputJsonValue } };
      } });
  }
  async queue(identity: AuthenticatedIdentity, id: string, mode: 'audit' | 'retry', key: string) {
    if (!this.engine.settings.enabled) throw new AppError('Le scheduler Catalogue est désactivé.', 503, 'CATALOG_DISABLED');
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'character-catalog', action: mode, idempotencyKey: key, request: { id, mode }, change: async tx => {
      await tx.catalogCandidate.findUniqueOrThrow({ where: { id } });
      const queued = await tx.catalogRun.count({ where: { status: { in: ['QUEUED', 'RUNNING', 'FAILED'] }, cycleKey: { startsWith: 'manual:' } } });
      if (queued >= 10) throw new AppError('Des vérifications sont déjà en attente. Réessayer après leur traitement.', 429, 'CATALOG_QUEUE_FULL');
      await tx.catalogRun.create({ data: { cycleKey: `manual:${key}`, status: 'QUEUED', summary: { mode, candidateId: id } } });
      return { before: { candidateId: id }, after: { candidateId: id, mode, queued: true } };
    } });
  }
  async upload(identity: AuthenticatedIdentity, id: string, role: Exclude<AssetRole, 'promotion'>, body: Buffer, mime: string, key: string) {
    await this.operation.actor(identity, 'ADMIN');
    const candidate = await this.db.catalogCandidate.findUniqueOrThrow({ where: { id }, include: { character: true } });
    const path = { icon: 'iconPath', splash: 'splashPath', wish: 'wishPath', fullbody: 'fullbodyPath' } as const;
    if (candidate.character?.[path[role]]) throw new AppError('Cette image existe déjà dans le catalogue. L’upload complète uniquement les images absentes.', 409, 'CATALOG_VALIDATION_FAILED');
    if (body.length > maxImageBytes) throw new AppError('Image trop volumineuse.', 400, 'CATALOG_IMAGE_TOO_LARGE');
    const image = await validateImage(body, mime, role);
    const url = await this.engine.storage.store(id, role, image);
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'character-catalog', action: 'upload', idempotencyKey: key,
      request: { id, role, hash: image.hash }, change: async tx => {
        const before = await tx.catalogAsset.findMany({ where: { candidateId: id, role, status: 'AVAILABLE' }, select: { hash: true } });
        await tx.catalogAsset.upsert({ where: { candidateId_role_hash: { candidateId: id, role, hash: image.hash } },
          create: { candidateId: id, role, hash: image.hash, provider: 'admin', sourceUrl: `admin-operation:${key}`, url, mime: image.mime,
            width: image.width, height: image.height, bytes: image.bytes, sourceHash: image.sourceHash, sourceMime: mime, status: 'AVAILABLE' }, update: {} });
        await tx.catalogCandidate.update({ where: { id }, data: { revision: { increment: 1 }, nextCheckAt: new Date() } });
        if (this.engine.settings.enabled && !this.engine.settings.dryRun) await tx.catalogRun.create({ data: {
          cycleKey: `manual:upload:${key}`, status: 'QUEUED', summary: { mode: 'retry', candidateId: id } } });
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
