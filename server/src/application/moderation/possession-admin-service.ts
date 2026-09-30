import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import { unlockCharacterAvatars } from '../appearance/character-avatar-unlocks.js';
import { PrismaC6ProgressionService } from '../../infrastructure/database/prisma-c6-progression-service.js';
import { AdminOperation } from './admin-operation.js';

export class PossessionAdminService {
  private readonly operation: AdminOperation;
  constructor(private readonly database: PrismaClient, getPlayer: GetCurrentPlayer) { this.operation = new AdminOperation(database, getPlayer); }

  async list(identity: AuthenticatedIdentity, playerId: string, query: { page: number; search?: string; rarity?: 4 | 5; elementKey?: string }) {
    await this.operation.actor(identity, 'ADMIN');
    const where: Prisma.PlayerCharacterWhereInput = { playerId,
      ...((query.search || query.rarity || query.elementKey) ? { character: {
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
        ...(query.rarity ? { rarity: query.rarity } : {}), ...(query.elementKey ? { elementKey: query.elementKey } : {}),
      } } : {}),
    };
    const total = await this.database.playerCharacter.count({ where });
    const page = Math.min(query.page, Math.max(1, Math.ceil(total / 20)));
    const rows = await this.database.playerCharacter.findMany({ where, include: { character: { select: { name: true, rarity: true, elementKey: true, externalKey: true, isActive: true } } }, orderBy: [{ firstObtainedAt: 'desc' }, { characterId: 'asc' }], skip: (page - 1) * 20, take: 20 });
    return { page, pageSize: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)), entries: rows };
  }

  async change(identity: AuthenticatedIdentity, playerId: string, characterId: string, input: { action: 'add' | 'remove' | 'constellation'; constellation?: number; idempotencyKey: string }) {
    if (input.action === 'constellation' && (!Number.isInteger(input.constellation) || input.constellation! < 0 || input.constellation! > 6)) throw invalid();
    return this.operation.run(identity, { scope: 'ADMIN', targetPlayerId: playerId, domain: 'possessions', action: input.action,
      idempotencyKey: input.idempotencyKey, request: { playerId, characterId, action: input.action, constellation: input.constellation ?? null },
      change: async tx => {
        await tx.$queryRaw`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`;
        const target = await tx.player.findUnique({ where: { id: playerId }, select: { status: true } });
        if (target?.status !== 'ACTIVE') throw new AppError('Joueur introuvable ou inactif.', 404, 'MODERATION_TARGET_NOT_FOUND');
        const character = await tx.character.findUnique({ where: { id: characterId }, select: { id: true, rarity: true, isActive: true } });
        if (!character) throw new AppError('Personnage absent du catalogue.', 404, 'CHARACTER_NOT_FOUND');
        const key = { playerId_characterId: { playerId, characterId } };
        const before = await tx.playerCharacter.findUnique({ where: key });
        if (input.action === 'add') {
          if (!character.isActive || ![4, 5].includes(character.rarity) || before) throw invalid();
          await tx.playerCharacter.create({ data: { playerId, characterId, constellation: 0, copies: 1,
            firstObtainedAt: new Date(), provenance: { source: 'admin-correction' } } });
          await unlockCharacterAvatars(tx, { playerId, characterIds: [characterId], now: new Date(), silent: true, unlockSource: 'admin-possession-correction' });
        } else if (input.action === 'constellation') {
          if (!before) throw invalid();
          if (input.constellation! < 6 && before.constellation === 6 && await tx.contestParticipant.count({ where: { playerId, characterId } })) {
            throw new AppError('Ce personnage possède un historique Concours C6.', 409, 'POSSESSION_CONTEST_DEPENDENCY');
          }
          await tx.playerCharacter.update({ where: key, data: { constellation: input.constellation!, copies: Math.max(before.copies, input.constellation! + 1) } });
          if (character.rarity === 5 && input.constellation === 6) await new PrismaC6ProgressionService().unlock(tx, playerId, characterId, new Date());
        } else {
          if (!before) throw invalid();
          if (before.favorite) throw new AppError('Retirez d’abord ce personnage des favoris.', 409, 'POSSESSION_FAVORITE_DEPENDENCY');
          const dependencies = await Promise.all([
            tx.teamMember.count({ where: { characterId, team: { playerId } } }),
            tx.playerDailyCombatLoadoutSlot.count({ where: { playerId, characterId } }),
            tx.playerBossLoadoutSlot.count({ where: { playerId, characterId } }),
            tx.playerExpedition.count({ where: { playerId, characterId } }),
            tx.contestParticipant.count({ where: { playerId, characterId } }),
            tx.c6CompetitionProgress.count({ where: { playerId, characterId } }),
            tx.playerCharacterCombatStats.count({ where: { playerId, characterId } }),
          ]);
          if (dependencies.some(Boolean)) throw new AppError('Retirez d’abord ce personnage de ses équipes ou états actifs ; son historique doit rester cohérent.', 409, 'POSSESSION_DEPENDENCY');
          await tx.playerCharacter.delete({ where: key });
        }
        const after = await tx.playerCharacter.findUnique({ where: key });
        const audit = (row: typeof before) => ({ playerId, characterId, owned: Boolean(row), constellation: row?.constellation ?? null, copies: row?.copies ?? null });
        return { before: audit(before), after: audit(after) };
      } });
  }
}
function invalid() { return new AppError('Correction de possession invalide.', 400, 'POSSESSION_INVALID'); }
