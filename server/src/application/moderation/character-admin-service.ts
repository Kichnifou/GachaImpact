import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import { AdminOperation } from './admin-operation.js';
import { readFields, type CatalogFields } from '../character-catalog/catalog-policy.js';
import { canonicalRegion, catalogRegions, normalizeWeapon } from '../character-catalog/catalog-metadata.js';

export type CharacterAdminPatch = Readonly<{ name?: string; rarity?: 4 | 5; elementKey?: string;
  weaponType?: string | null; region?: string | null; classKey?: string | null; displayOrder?: number | null; isActive?: boolean }>;
const select = { id: true, externalKey: true, name: true, rarity: true, elementKey: true, weaponType: true,
  region: true, classKey: true, iconPath: true, splashPath: true, wishPath: true, fullbodyPath: true,
  displayOrder: true, isActive: true, releaseDate: true, createdAt: true, updatedAt: true } as const;

export class CharacterAdminService {
  private readonly operation: AdminOperation;
  constructor(private readonly database: PrismaClient, getPlayer: GetCurrentPlayer) { this.operation = new AdminOperation(database, getPlayer); }

  async options(identity: AuthenticatedIdentity) {
    await this.operation.actor(identity, 'ADMIN');
    return { regions: await catalogRegions(this.database) };
  }

  async get(identity: AuthenticatedIdentity, id: string) {
    await this.operation.actor(identity, 'ADMIN');
    const row = await this.database.character.findUnique({ where: { id }, select });
    if (!row) throw new AppError('Personnage introuvable.', 404, 'CHARACTER_NOT_FOUND');
    return row;
  }

  async list(identity: AuthenticatedIdentity, query: { page: number; search?: string; rarity?: 4 | 5; elementKey?: string; active?: boolean; missingAssets?: boolean; sort?: 'name' | 'rarity' | 'createdAt'; direction?: 'asc' | 'desc' }) {
    await this.operation.actor(identity, 'ADMIN');
    const where: Prisma.CharacterWhereInput = {
      ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { externalKey: { contains: query.search, mode: 'insensitive' } }] } : {}),
      ...(query.rarity ? { rarity: query.rarity } : {}), ...(query.elementKey ? { elementKey: query.elementKey } : {}),
      ...(query.active === undefined ? {} : { isActive: query.active }),
      ...(query.missingAssets ? { AND: [{ OR: [{ iconPath: null }, { splashPath: null }, { wishPath: null }, { fullbodyPath: null }] }] } : {}),
    };
    const total = await this.database.character.count({ where });
    const page = Math.min(query.page, Math.max(1, Math.ceil(total / 20)));
    const rows = await this.database.character.findMany({ where, select, orderBy: [{ [query.sort ?? 'name']: query.direction ?? 'asc' }, { id: 'asc' }], skip: (page - 1) * 20, take: 20 });
    return { page, pageSize: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)), entries: rows };
  }

  async create(identity: AuthenticatedIdentity, input: CharacterAdminPatch & { externalKey: string; name: string; rarity: 4 | 5; elementKey: string; idempotencyKey: string }) {
    const { idempotencyKey, ...data } = input;
    if (!/^[a-z0-9][a-z0-9_-]{1,79}$/.test(data.externalKey) || !data.name.trim() || data.name.length > 100) throw invalid();
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'characters', action: 'create', idempotencyKey,
      request: data as Prisma.InputJsonValue, change: async (tx) => {
        if (!(await tx.element.findUnique({ where: { key: data.elementKey }, select: { key: true } }))) throw invalid();
        if (await tx.character.findUnique({ where: { externalKey: data.externalKey }, select: { id: true } })) throw new AppError('Clé personnage déjà utilisée.', 409, 'CHARACTER_DUPLICATE');
        const row = await tx.character.create({ data: { ...data, name: data.name.trim() }, select });
        return { before: { characterId: row.id, exists: false }, after: characterAudit(row) };
      } });
  }

  async update(identity: AuthenticatedIdentity, characterId: string, input: CharacterAdminPatch & { idempotencyKey: string }) {
    const { idempotencyKey, ...patch } = input;
    if (!Object.keys(patch).length || (patch.name !== undefined && (!patch.name.trim() || patch.name.length > 100))) throw invalid();
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'characters', action: 'update', idempotencyKey,
      request: { characterId, patch } as Prisma.InputJsonValue, change: async tx => {
        await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE character_id = ${characterId}::uuid FOR UPDATE`;
        const before = await tx.character.findUnique({ where: { id: characterId }, select });
        if (!before) throw new AppError('Personnage introuvable.', 404, 'CHARACTER_NOT_FOUND');
        if (patch.elementKey && !(await tx.element.findUnique({ where: { key: patch.elementKey }, select: { key: true } }))) throw invalid();
        if ((patch.rarity !== undefined && patch.rarity !== before.rarity) || (patch.elementKey !== undefined && patch.elementKey !== before.elementKey)) {
          const referenced = await Promise.all([
            tx.bannerFeaturedCharacter.count({ where: { characterId } }), tx.bannerVote.count({ where: { characterId } }),
            tx.playerCharacter.count({ where: { characterId } }), tx.pullResult.count({ where: { characterId } }),
            tx.pullOperation.count({ where: { targetCharacterId: characterId } }),
          ]);
          if (referenced.some(Boolean)) throw new AppError('Rareté et élément figés pour un personnage référencé.', 409, 'CHARACTER_IDENTITY_LOCKED');
        }
        if (typeof patch.weaponType === 'string') patch.weaponType = patch.weaponType.trim() ? normalizeWeapon(patch.weaponType) : null;
        if (typeof patch.region === 'string') patch.region = patch.region.trim() ? await canonicalRegion(tx, patch.region) : null;
        const after = await tx.character.update({ where: { id: characterId }, data: { ...patch, ...(patch.name ? { name: patch.name.trim() } : {}) }, select });
        const candidate=await tx.catalogCandidate.findUnique({where:{characterId}});
        if(candidate){
          const fields={...readFields(candidate.fields)};
          const map={name:'name',rarity:'rarity',elementKey:'element',weaponType:'weapon',region:'region',classKey:'classKey',displayOrder:'displayOrder'} as const;
          const touched:string[]=[];
          for(const [source,target] of Object.entries(map)) if(source in patch){
            touched.push(target); const value=patch[source as keyof CharacterAdminPatch];
            if(typeof value==='string'||typeof value==='number') fields[target as keyof CatalogFields]={value,provider:'admin',url:`admin-operation:${idempotencyKey}`,fetchedAt:new Date().toISOString(),reliability:'ADMIN',override:true,locked:true,adminValidated:true,editorialStatus:'VALIDATED'};
            else delete fields[target as keyof CatalogFields];
          }
          await tx.catalogCandidate.update({where:{id:candidate.id},data:{fields:fields as Prisma.InputJsonValue,name:after.name,trackingElements:{set:candidate.trackingElements.filter(element=>!touched.includes(element))},revision:{increment:1}}});
        }
        return { before: characterAudit(before), after: characterAudit(after) };
      } });
  }
}

function invalid() { return new AppError('Métadonnées personnage invalides.', 400, 'CHARACTER_INVALID'); }
function characterAudit(row: { id: string; externalKey: string; name: string; rarity: number; elementKey: string;
  weaponType: string | null; region: string | null; classKey: string | null; displayOrder: number | null; isActive: boolean }) {
  return { characterId: row.id, externalKey: row.externalKey, name: row.name, rarity: row.rarity, elementKey: row.elementKey,
    weaponType: row.weaponType, region: row.region, classKey: row.classKey, displayOrder: row.displayOrder, isActive: row.isActive };
}
