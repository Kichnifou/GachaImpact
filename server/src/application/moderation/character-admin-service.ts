import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import { AdminOperation } from './admin-operation.js';

export type CharacterAdminPatch = Readonly<{ name?: string; rarity?: 4 | 5; elementKey?: string;
  weaponType?: string | null; region?: string | null; classKey?: string | null; displayOrder?: number | null; isActive?: boolean }>;
const select = { id: true, externalKey: true, name: true, rarity: true, elementKey: true, weaponType: true,
  region: true, classKey: true, iconPath: true, splashPath: true, wishPath: true, fullbodyPath: true,
  displayOrder: true, isActive: true, createdAt: true, updatedAt: true } as const;

export class CharacterAdminService {
  private readonly operation: AdminOperation;
  constructor(private readonly database: PrismaClient, getPlayer: GetCurrentPlayer) { this.operation = new AdminOperation(database, getPlayer); }

  async list(identity: AuthenticatedIdentity, query: { page: number; search?: string; rarity?: 4 | 5; elementKey?: string; active?: boolean; sort?: 'name' | 'rarity' | 'createdAt'; direction?: 'asc' | 'desc' }) {
    await this.operation.actor(identity, 'ADMIN');
    const where: Prisma.CharacterWhereInput = {
      ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { externalKey: { contains: query.search, mode: 'insensitive' } }] } : {}),
      ...(query.rarity ? { rarity: query.rarity } : {}), ...(query.elementKey ? { elementKey: query.elementKey } : {}),
      ...(query.active === undefined ? {} : { isActive: query.active }),
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
        const after = await tx.character.update({ where: { id: characterId }, data: { ...patch, ...(patch.name ? { name: patch.name.trim() } : {}) }, select });
        return { before: characterAudit(before), after: characterAudit(after) };
      } });
  }
}

function invalid() { return new AppError('Métadonnées personnage invalides.', 400, 'CHARACTER_INVALID'); }
function characterAudit(row: { id: string; externalKey: string; name: string; rarity: number; elementKey: string; isActive: boolean }) {
  return { characterId: row.id, externalKey: row.externalKey, name: row.name, rarity: row.rarity, elementKey: row.elementKey, isActive: row.isActive };
}
