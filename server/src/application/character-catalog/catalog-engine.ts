import { randomUUID, createHash } from 'node:crypto';
import { Prisma, type PrismaClient, type CatalogCandidate } from '../../../generated/prisma/client.js';
import { getBusinessDate } from '../../domain/time/business-date.js';
import { eligibility, mergeEvidence, normalizedIdentity, readFields, type CatalogFields } from './catalog-policy.js';
import { CatalogFetchError, RequestBudget, catalogHttp, type CatalogHttp } from '../../infrastructure/character-catalog/catalog-http.js';
import { CatalogSources, catalogFieldSources, officialReleaseEvidence, type SourceAttempt, type OfficialPost } from '../../infrastructure/character-catalog/catalog-sources.js';
import { CatalogImageStorage, validateImage } from '../../infrastructure/character-catalog/catalog-images.js';

type RunMode = 'daily' | 'retry' | 'audit';
const json = (value: unknown) => value as Prisma.InputJsonValue;
const leaseMs = 900_000;
const rolePath = { icon: 'iconPath', splash: 'splashPath', wish: 'wishPath', fullbody: 'fullbodyPath' } as const;
export type CatalogSettings = Readonly<{ enabled: boolean; publish: boolean; dryRun: boolean; storageUrl?: string; storageKey?: string }>;

export class CatalogEngine {
  readonly storage: CatalogImageStorage;
  constructor(private readonly db: PrismaClient, readonly settings: CatalogSettings,
    private readonly http: CatalogHttp = catalogHttp, private readonly now: () => Date = () => new Date()) {
    this.storage = new CatalogImageStorage(settings.storageUrl, settings.storageKey, http, async bytes => {
      const rows = await this.db.$queryRaw<{ bytes: bigint }[]>`SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)::bigint AS bytes FROM storage.objects`;
      if (!rows[0] || rows[0].bytes + BigInt(bytes) > 500n * 1024n * 1024n) throw new CatalogFetchError('STORAGE_CAPACITY_LIMIT');
    });
  }

  async run(mode: RunMode = 'daily', candidateId?: string, requestedRunId?: string) {
    const started = this.now(), businessDate = getBusinessDate(started), token = randomUUID();
    await this.db.catalogJob.upsert({ where: { id: 'R1051' }, create: { id: 'R1051' }, update: {} });
    const acquired = await this.db.catalogJob.updateMany({ where: { id: 'R1051', OR: [{ leaseUntil: null }, { leaseUntil: { lte: started } }] },
      data: { leaseToken: token, leaseUntil: new Date(started.getTime() + leaseMs) } });
    if (!acquired.count) return { skipped: 'LEASE_BUSY' };
    let runId: string | undefined;
    try {
      const cycleKey = mode === 'daily' ? `daily:${businessDate}` : `manual:${requestedRunId ?? token}`;
      let run = requestedRunId ? await this.db.catalogRun.findUniqueOrThrow({ where: { id: requestedRunId } }) : await this.db.catalogRun.upsert({
        where: { cycleKey }, create: { cycleKey }, update: {} });
      runId = run.id;
      if (run.status === 'COMPLETED') return { skipped: 'ALREADY_COMPLETED' };
      if (run.nextAttemptAt > this.now()) return { skipped: 'BACKOFF' };
      run = await this.db.catalogRun.update({ where: { id: run.id }, data: { status: 'RUNNING', completedAt: null } });
      const record = async (attempt: SourceAttempt, id?: string) => {
        await this.fenced(token, tx => tx.catalogAttempt.create({ data: { runId: run.id, candidateId: id, ...attempt,
          checkedAt: this.now(), nextCheckAt: new Date(this.now().getTime() + 86_400_000) } }));
      };
      const budget = new RequestBudget(async (url, options) => {
        const renewed = await this.db.catalogJob.updateMany({ where: { id: 'R1051', leaseToken: token, leaseUntil: { gt: this.now() } },
          data: { leaseUntil: new Date(this.now().getTime() + leaseMs) } });
        if (!renewed.count) throw new CatalogFetchError('LEASE_LOST');
        return this.http(url, options);
      });
      let attemptCandidateId: string | undefined;
      const sources = new CatalogSources(budget.request, attempt => record(attempt, attemptCandidateId), started);
      const posts = await sources.discover();
      if (mode === 'daily' && !this.settings.dryRun) {
        for (const post of posts.filter(row => row.name)) await this.discover(token, post);
        await this.seedHistorical(token);
      }
      const candidates = await this.db.catalogCandidate.findMany({ where: candidateId ? { id: candidateId } : { nextCheckAt: { lte: this.now() } },
        orderBy: [{ nextCheckAt: 'asc' }, { id: 'asc' }], take: mode === 'daily' ? 15 : 1, include: { character: true, assets: true, identities: true } });
      const reports: unknown[] = [];
      for (const candidate of candidates) {
        try {
          const fields = readFields(candidate.fields);
          const names = [candidate.name, fields.originalName?.value, fields.name?.value].filter((name): name is string => typeof name === 'string');
          attemptCandidateId = candidate.id;
          const structured = await sources.structured(names);
          for (const field of ['name', 'originalName', 'rarity', 'element', 'weapon', 'region', 'numericId'] as const) {
            if (fields[field]) continue;
            const value = structured?.fields[field];
            await record({ provider: value?.provider ?? 'genshin-db', field, outcome: value ? 'FOUND' : 'MISSING',
              ...(value ? { sourceUrl: value.url } : { errorCode: 'ABSENT' }) }, candidate.id);
          }
          let merged = fields;
          for (const [field, value] of Object.entries(structured?.fields ?? {})) if (value && catalogFieldSources[field as keyof CatalogFields].includes(value.provider)) merged = mergeEvidence(merged, field as keyof CatalogFields, value);
          for (const post of posts) {
            if (post.name && names.some(name => normalizedIdentity(name) === normalizedIdentity(post.name!)))
              for (const [field, value] of Object.entries(post.fields)) if (value) merged = mergeEvidence(merged, field as keyof CatalogFields, value);
            const release = officialReleaseEvidence(post, names, started);
            if (release) merged = mergeEvidence(merged, 'releaseDate', release);
          }
          reports.push({ candidateId: candidate.id, fields: merged, missing: eligibility(merged, candidate.assets.filter(row => row.status === 'AVAILABLE').map(row => row.role), started).missing });
          if (mode === 'audit' || this.settings.dryRun) continue;
          await this.fenced(token, async tx => {
            await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE id = ${candidate.id}::uuid FOR UPDATE`;
            const current = await tx.catalogCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
            let final = readFields(current.fields);
            for (const [field, value] of Object.entries(merged)) if (value) final = mergeEvidence(final, field as keyof CatalogFields, value);
            if (final.numericId) await this.attach(tx, candidate.id, 'genshin', String(final.numericId.value));
            await tx.catalogCandidate.update({ where: { id: candidate.id }, data: { fields: json(final), revision: { increment: 1 } } });
          });
          for (const role of ['icon', 'splash', 'wish', 'fullbody'] as const) {
            if (candidate.character?.[rolePath[role]] || candidate.assets.some(asset => asset.role === role && asset.status === 'AVAILABLE')) continue;
            const alternatives = structured?.images[role] ?? [];
            if (!alternatives.length) await record({ provider: 'technical-manifest', field: role, outcome: 'MISSING', errorCode: 'ABSENT' }, candidate.id);
            for (const asset of alternatives) {
              try {
                const response = await budget.request(asset.url);
                if (response.status !== 200) throw new CatalogFetchError(response.status === 404 ? 'HTTP_404' : 'UNAVAILABLE', response.status);
                const image = await validateImage(response.body, response.mime, role);
                // Validate independently of credentials; store only when the backend is configured.
                const url = await this.storage.store(candidate.id, role, image);
                await this.fenced(token, tx => tx.catalogAsset.upsert({ where: { candidateId_role_hash: { candidateId: candidate.id, role, hash: image.hash } },
                  create: { candidateId: candidate.id, role, hash: image.hash, provider: asset.provider, sourceUrl: asset.url, url,
                    mime: image.mime, width: image.width, height: image.height, bytes: image.bytes, sourceHash: image.sourceHash, sourceMime: response.mime, status: 'AVAILABLE', checkedAt: this.now() }, update: {} }));
                await record({ provider: asset.provider, field: role, outcome: 'AVAILABLE', sourceUrl: asset.url, httpStatus: 200 }, candidate.id);
                break;
              } catch (error) {
                const code = error instanceof CatalogFetchError ? error.code : 'UNAVAILABLE';
                if (['BUDGET_EXHAUSTED', 'LEASE_LOST'].includes(code)) throw error;
                await record({ provider: asset.provider, field: role, outcome: code === 'HTTP_404' ? 'MISSING' : 'ERROR', errorCode: code, sourceUrl: asset.url,
                  ...(error instanceof CatalogFetchError && error.httpStatus ? { httpStatus: error.httpStatus } : {}) }, candidate.id);
                if (code === 'STORAGE_NOT_CONFIGURED') break;
              }
            }
          }
          for (const promotion of candidate.assets.filter(row => row.role === 'promotion' && row.status === 'UNVERIFIED' && row.sourceUrl).slice(0, 3)) {
            try {
              const response = await budget.request(promotion.sourceUrl!);
              if (response.status !== 200) throw new CatalogFetchError(response.status === 404 ? 'HTTP_404' : 'UNAVAILABLE', response.status);
              const image = await validateImage(response.body, response.mime, 'promotion');
              await this.fenced(token, tx => tx.catalogAsset.update({ where: { id: promotion.id }, data: { hash: image.hash, sourceHash: image.sourceHash,
                sourceMime: response.mime, mime: image.mime, width: image.width, height: image.height, bytes: response.body.length,
                status: 'SOURCE_VALIDATED', checkedAt: this.now() } }));
              await record({ provider: 'hoyoverse', field: 'promotion', outcome: 'SOURCE_VALIDATED', sourceUrl: promotion.sourceUrl!, httpStatus: 200 }, candidate.id);
            } catch (error) {
              if (error instanceof CatalogFetchError && ['BUDGET_EXHAUSTED', 'LEASE_LOST'].includes(error.code)) throw error;
              await record({ provider: 'hoyoverse', field: 'promotion', outcome: 'ERROR', errorCode: error instanceof CatalogFetchError ? error.code : 'UNAVAILABLE', sourceUrl: promotion.sourceUrl! }, candidate.id);
            }
          }
          await this.finalize(token, candidate.id, started);
        } catch (error) {
          const code = error instanceof CatalogFetchError ? error.code : 'INTERVENTION';
          if (['BUDGET_EXHAUSTED', 'LEASE_LOST'].includes(code)) throw error;
          await record({ provider: 'pipeline', field: 'candidate', outcome: 'ERROR', errorCode: code }, candidate.id);
          if (mode !== 'audit' && !this.settings.dryRun) await this.fenced(token, tx => tx.catalogCandidate.update({ where: { id: candidate.id }, data: {
            status: code === 'IDENTITY_CONFLICT' ? 'CONFLICT' : 'TEMPORARY_ERROR', checkedAt: this.now(), nextCheckAt: new Date(this.now().getTime() + 3_600_000) } }));
        }
      }
      if (mode !== 'audit' && !this.settings.dryRun) await this.deliverNotifications();
      await this.fenced(token, async tx => {
        await tx.catalogRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', failureCount: 0, completedAt: this.now(), summary: json({ mode, dryRun: this.settings.dryRun, discovered: posts.filter(row => row.name).length, reports }) } });
        if (mode === 'daily') await tx.catalogJob.update({ where: { id: 'R1051' }, data: { lastSuccessDate: businessDate, lastSuccessAt: this.now() } });
      });
      return { runId: run.id, discovered: posts.filter(row => row.name).length, processed: candidates.length };
    } catch (error) {
      if (runId) await this.fenced(token, async tx => {
        const run = await tx.catalogRun.findUniqueOrThrow({ where: { id: runId } });
        const delay = Math.min(86_400_000, 60_000 * 2 ** Math.min(run.failureCount + 1, 10));
        // Keep manual mode/target durable across retries and restarts.
        await tx.catalogRun.update({ where: { id: runId }, data: { status: 'FAILED', failureCount: { increment: 1 }, nextAttemptAt: new Date(this.now().getTime() + delay),
          summary: { ...(run.summary as Prisma.InputJsonObject), errorCode: error instanceof CatalogFetchError ? error.code : 'PIPELINE_FAILED' } } });
      }).catch(() => undefined);
      throw error;
    } finally {
      await this.db.catalogJob.updateMany({ where: { id: 'R1051', leaseToken: token }, data: { leaseToken: null, leaseUntil: null } });
    }
  }

  private async fenced<T>(token: string, change: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM catalog_job WHERE id = 'R1051' AND lease_token = ${token}::uuid AND lease_until > CURRENT_TIMESTAMP FOR UPDATE`;
      if (rows.length !== 1) throw new CatalogFetchError('LEASE_LOST');
      return change(tx);
    }, { timeout: 15_000 });
  }
  private async attach(tx: Prisma.TransactionClient, candidateId: string, namespace: string, externalId: string) {
    const existing = await tx.catalogIdentity.findUnique({ where: { namespace_externalId: { namespace, externalId } } });
    if (existing && existing.candidateId !== candidateId) throw new CatalogFetchError('IDENTITY_CONFLICT');
    await tx.catalogIdentity.upsert({ where: { namespace_externalId: { namespace, externalId } }, create: { namespace, externalId, candidateId }, update: {} });
  }
  private async discover(token: string, post: OfficialPost) {
    const name = post.name!, normalized = normalizedIdentity(name);
    await this.fenced(token, async tx => {
      const identity = await tx.catalogIdentity.findUnique({ where: { namespace_externalId: { namespace: 'official-name', externalId: normalized } } });
      let candidate = identity ? await tx.catalogCandidate.findUniqueOrThrow({ where: { id: identity.candidateId } }) : null;
      if (!candidate) {
        const existing = await tx.character.findMany({ where: { name: { equals: name, mode: 'insensitive' } }, take: 2 });
        if (existing.length > 1) throw new CatalogFetchError('IDENTITY_CONFLICT');
        candidate = existing[0] ? await tx.catalogCandidate.upsert({ where: { characterId: existing[0].id }, create: { name, characterId: existing[0].id }, update: {} })
          : await tx.catalogCandidate.create({ data: { name } });
      }
      let fields = readFields(candidate.fields);
      for (const [key, value] of Object.entries(post.fields)) if (value) fields = mergeEvidence(fields, key as keyof CatalogFields, value);
      await this.attach(tx, candidate.id, 'official-name', normalized);
      await this.attach(tx, candidate.id, 'hoyolab-post', post.id);
      await tx.catalogCandidate.update({ where: { id: candidate.id }, data: { fields: json(fields) } });
      for (const url of post.promotion.slice(0, 3)) {
        if (await tx.catalogAsset.findFirst({ where: { candidateId: candidate.id, role: 'promotion', sourceUrl: url } })) continue;
        await tx.catalogAsset.create({ data: { candidateId: candidate.id, role: 'promotion', hash: `source:${createHash('sha256').update(url).digest('hex')}`,
          provider: 'hoyoverse', sourceUrl: url, status: 'UNVERIFIED' } });
      }
    });
  }
  private async seedHistorical(token: string) {
    const rows = await this.db.character.findMany({ where: { catalogCandidate: null }, take: 150, orderBy: { id: 'asc' } });
    for (const row of rows) await this.fenced(token, async tx => {
      const fields: CatalogFields = {};
      for (const [key, value] of [['name', row.name], ['rarity', row.rarity], ['element', row.elementKey], ['weapon', row.weaponType], ['region', row.region]] as const) {
        if (value !== null) fields[key] = { value, provider: 'catalog', url: `character:${row.id}`, fetchedAt: this.now().toISOString(), reliability: 'ADMIN', override: true };
      }
      const candidate = await tx.catalogCandidate.upsert({ where: { characterId: row.id }, create: { characterId: row.id, name: row.name, status: 'PUBLISHED', fields: json(fields), publishedAt: row.createdAt }, update: {} });
      await this.attach(tx, candidate.id, 'catalog', row.externalKey);
    });
  }
  private async finalize(token: string, id: string, started: Date) {
    const snapshot = await this.db.catalogCandidate.findUniqueOrThrow({ where: { id }, include: { assets: true } });
    const pending = eligibility(readFields(snapshot.fields), snapshot.assets.filter(row => row.status === 'AVAILABLE').map(row => row.role), started);
    const verified = !snapshot.characterId && pending.status === 'ELIGIBLE' && this.settings.publish && this.storage.configured ? await this.verifyPublication(id) : [];
    await this.fenced(token, async tx => {
      await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE id = ${id}::uuid FOR UPDATE`;
      const candidate = await tx.catalogCandidate.findUniqueOrThrow({ where: { id }, include: { assets: true, character: true } });
      const fields = readFields(candidate.fields);
      const available = candidate.assets.filter(row => row.status === 'AVAILABLE').map(row => row.role);
      if (candidate.character) for (const [role, path] of Object.entries(rolePath)) if (candidate.character[path as 'iconPath']) available.push(role);
      const result = eligibility(fields, available, started);
      await tx.catalogCandidate.update({ where: { id }, data: { status: candidate.characterId ? 'PUBLISHED' : result.status, missing: result.missing,
        officialReleaseDate: result.officialDate ? new Date(`${result.officialDate}T00:00:00Z`) : null, checkedAt: this.now(), nextCheckAt: new Date(started.getTime() + 86_400_000) } });
      if (candidate.characterId) {
        // Fill NULL only, retaining every existing ADMIN value and all gameplay relations.
        for (const [role, path] of Object.entries(rolePath)) {
          const asset = candidate.assets.find(row => row.role === role && row.status === 'AVAILABLE' && row.url);
          if (asset?.url) await tx.character.updateMany({ where: { id: candidate.characterId, [path]: null }, data: { [path]: asset.url } });
        }
        if (result.officialDate) await tx.character.updateMany({ where: { id: candidate.characterId, releaseDate: null }, data: { releaseDate: new Date(`${result.officialDate}T00:00:00Z`) } });
        if (fields.weapon) await tx.character.updateMany({ where: { id: candidate.characterId, weaponType: null }, data: { weaponType: String(fields.weapon.value) } });
        if (fields.region) await tx.character.updateMany({ where: { id: candidate.characterId, region: null }, data: { region: String(fields.region.value) } });
      } else if (result.status === 'ELIGIBLE' && this.settings.publish && this.storage.configured) await this.publish(tx, candidate, fields, false, verified);
    });
  }
  async verifyPublication(candidateId: string): Promise<string[]> {
    const rows = await this.db.catalogAsset.findMany({ where: { candidateId, status: 'AVAILABLE' }, orderBy: [{ checkedAt: 'desc' }, { id: 'asc' }] });
    const verified: string[] = [];
    for (const role of ['icon', 'splash']) {
      const asset = rows.find(row => row.role === role);
      if (!asset?.url || !this.storage.owns(asset.url, candidateId, role, asset.hash)) throw new CatalogFetchError('STORAGE_ASSET_INVALID');
      const response = await this.http(asset.url, { noRedirect: true });
      if (response.status !== 200 || response.mime !== 'image/png' || createHash('sha256').update(response.body).digest('hex') !== asset.hash)
        throw new CatalogFetchError('STORAGE_VERIFICATION_FAILED', response.status);
      verified.push(asset.id);
    }
    return verified;
  }
  async publish(tx: Prisma.TransactionClient, candidate: CatalogCandidate, fields: CatalogFields, overrideWindow = false, verified: readonly string[] = []) {
    const assets = await tx.catalogAsset.findMany({ where: { candidateId: candidate.id, status: 'AVAILABLE' }, orderBy: [{ checkedAt: 'desc' }, { id: 'asc' }] });
    const result = eligibility(fields, assets.map(row => row.role), this.now(), overrideWindow);
    if (result.status !== 'ELIGIBLE') throw new CatalogFetchError('NOT_ELIGIBLE');
    for (const role of ['icon', 'splash']) if (!verified.includes(assets.find(row => row.role === role)?.id ?? '')) throw new CatalogFetchError('STORAGE_VERIFICATION_REQUIRED');
    const numericId = String(fields.numericId!.value);
    const identity = await tx.catalogIdentity.findUnique({ where: { namespace_externalId: { namespace: 'genshin', externalId: numericId } } });
    if (identity?.candidateId !== candidate.id) throw new CatalogFetchError('IDENTITY_CONFLICT');
    const existing = await tx.character.findFirst({ where: { OR: [{ externalKey: `genshin:${numericId}` },
      ...[fields.name, fields.originalName].filter(Boolean).map(field => ({ name: { equals: String(field!.value), mode: 'insensitive' as const } }))] } });
    if (existing) throw new CatalogFetchError('IDENTITY_CONFLICT');
    const paths = Object.fromEntries(Object.entries(rolePath).map(([role, path]) => [path, assets.find(asset => asset.role === role)?.url ?? null]));
    const character = await tx.character.create({ data: { externalKey: `genshin:${numericId}`, name: String(fields.name?.value ?? fields.originalName!.value),
      rarity: Number(fields.rarity!.value), elementKey: String(fields.element!.value), weaponType: fields.weapon ? String(fields.weapon.value) : null,
      region: fields.region ? String(fields.region.value) : null,
      classKey: fields.classKey?.reliability === 'ADMIN' && fields.classKey.override ? String(fields.classKey.value) : null,
      displayOrder: fields.displayOrder?.reliability === 'ADMIN' && fields.displayOrder.override ? Number(fields.displayOrder.value) : null,
      releaseDate: new Date(`${result.officialDate}T00:00:00Z`), ...paths,
      sourceMetadata: { catalogCandidateId: candidate.id, genshinId: numericId } } });
    await tx.catalogCandidate.update({ where: { id: candidate.id }, data: { characterId: character.id, status: 'PUBLISHED', publishedAt: this.now() } });
    const missing = [...['weapon', 'region'].filter(field => !fields[field as keyof CatalogFields]),
      ...['wish', 'fullbody'].filter(role => !assets.some(asset => asset.role === role))];
    await tx.catalogImportOutbox.create({ data: { candidateId: candidate.id, characterId: character.id, name: character.name,
      payload: { title: `Nouveau personnage ajouté : ${character.name}`,
        message: `${character.rarity}★ · ${character.elementKey} · Sortie officielle : ${result.officialDate}.${missing.length ? ` À compléter : ${missing.join(', ')}.` : ''} Sources et détails dans Modération > Personnages.`,
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
