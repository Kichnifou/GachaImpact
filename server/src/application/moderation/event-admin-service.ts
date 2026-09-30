import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import { parseEventConfig, resolveCurrentEventPeriod } from '../event/event-service.js';
import { collectionItemExternalKey } from '../../domain/event/shop.js';
import { AdminOperation } from './admin-operation.js';

type Config = ReturnType<typeof parseEventConfig>;

export class EventAdminService {
  private readonly operation: AdminOperation;
  constructor(private readonly database: PrismaClient, getPlayer: GetCurrentPlayer) { this.operation = new AdminOperation(database, getPlayer); }

  async list(identity: AuthenticatedIdentity) {
    await this.operation.actor(identity, 'ADMIN');
    const rows = await this.database.eventDefinition.findMany({ orderBy: [{ calendarMonth: 'asc' }, { id: 'asc' }],
      include: { editions: { orderBy: [{ year: 'desc' }], take: 2,
        select: { id: true, year: true, startsAt: true, endsAt: true, status: true, _count: { select: { participants: true } } } } } });
    return { entries: rows };
  }

  async update(identity: AuthenticatedIdentity, definitionId: string, input: { isActive?: boolean; config?: Config; idempotencyKey: string }) {
    if (input.isActive === undefined && input.config === undefined) throw new AppError('Aucune modification.', 400, 'EVENT_ADMIN_INVALID');
    let config: Config | undefined;
    if (input.config !== undefined) {
      try { config = parseEventConfig(input.config); }
      catch { throw new AppError('Configuration Festival invalide.', 400, 'EVENT_ADMIN_INVALID'); }
      if ([config.emoji, config.currency.label, config.currency.emoji, config.collection.key, config.collection.label].some(v => !v.trim() || v.length > 100)) throw new AppError('Configuration Festival invalide.', 400, 'EVENT_ADMIN_INVALID');
    }
    return this.operation.run(identity, { scope: 'ADMIN', domain: 'event', action: 'update-definition', idempotencyKey: input.idempotencyKey,
      request: { definitionId, isActive: input.isActive ?? null, config: config ?? null },
      change: async tx => {
        const before = await tx.eventDefinition.findUnique({ where: { id: definitionId } });
        if (!before) throw new AppError('Festival introuvable.', 404, 'EVENT_ADMIN_NOT_FOUND');
        if (config) {
          if (before.calendarMonth === resolveCurrentEventPeriod(new Date()).month) throw new AppError('La définition du mois courant est figée.', 409, 'EVENT_ADMIN_SNAPSHOT_LOCKED');
          const item = await tx.itemDefinition.findUnique({ where: { externalKey: collectionItemExternalKey(config.collection.key) }, select: { id: true } });
          if (!item) throw new AppError('Objet Collection introuvable pour cette configuration.', 409, 'EVENT_ADMIN_COLLECTION_MISSING');
          const now = new Date();
          const scheduledOrActive = await tx.eventEdition.count({ where: { eventDefinitionId: definitionId,
            OR: [{ startsAt: { gt: now } }, { startsAt: { lte: now }, endsAt: { gt: now } }] } });
          if (scheduledOrActive) throw new AppError('Une édition en cours ou déjà programmée fige sa configuration.', 409, 'EVENT_ADMIN_SNAPSHOT_LOCKED');
        }
        if (input.isActive === true) {
          try { parseEventConfig(before.config); }
          catch { throw new AppError('Configuration actuelle invalide : réactivation refusée.', 409, 'EVENT_ADMIN_INVALID'); }
        }
        const after = await tx.eventDefinition.update({ where: { id: definitionId }, data: { ...(config ? { config } : {}), ...(input.isActive === undefined ? {} : { isActive: input.isActive }) } });
        const audit = (row: typeof before) => ({ definitionId: row.id, externalKey: row.externalKey, isActive: row.isActive, config: row.config });
        return { before: audit(before), after: audit(after) };
      } });
  }
}
