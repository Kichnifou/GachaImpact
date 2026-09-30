import type { PrismaClient, Prisma } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import { AdminOperation } from './admin-operation.js';

const secretKey = /token|secret|password|cookie|credential|authorization|providerSubject|authSubject|email|database.?url|private.?key|payload/i;
const secretValue = /(?:bearer\s+\S+|postgres(?:ql)?:\/\/\S+|(?:refresh|access)_token\s*[=:]|\bsk-[A-Za-z0-9_-]{12,}\b|\boauth:[A-Za-z0-9]+\b|\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b)/i;

export function sanitizeAudit(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[détail masqué]';
  if (Array.isArray(value)) return value.slice(0, 50).map(entry => sanitizeAudit(entry, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, entry]) => [key, secretKey.test(key) ? '[masqué]' : sanitizeAudit(entry, depth + 1)]));
  if (typeof value === 'string') return secretValue.test(value) ? '[masqué]' : value.slice(0, 500);
  return value;
}

export class AdminAuditQueryService {
  private readonly operation: AdminOperation;
  constructor(private readonly database: PrismaClient, getPlayer: GetCurrentPlayer) { this.operation = new AdminOperation(database, getPlayer); }

  async list(identity: AuthenticatedIdentity, input: { page: number; domain?: string; action?: string; actorId?: string; targetId?: string }) {
    await this.operation.actor(identity, 'ADMIN');
    const where: Prisma.AdminAuditEntryWhereInput = { ...(input.domain ? { domain: input.domain } : {}), ...(input.action ? { action: input.action } : {}),
      ...(input.actorId ? { actorPlayerId: input.actorId } : {}), ...(input.targetId ? { targetPlayerId: input.targetId } : {}) };
    const total = await this.database.adminAuditEntry.count({ where });
    const page = Math.min(input.page, Math.max(1, Math.ceil(total / 20)));
    const rows = await this.database.adminAuditEntry.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 20, take: 20,
      include: { actor: { select: { displayName: true } }, target: { select: { displayName: true } } } });
    return { page, pageSize: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)), entries: rows.map(row => ({
      id: row.id, actorPlayerId: row.actorPlayerId, actorName: row.actor.displayName, targetPlayerId: row.targetPlayerId,
      targetName: row.target.displayName, domain: row.domain, action: row.action, operationId: row.operationId, createdAt: row.createdAt,
      before: sanitizeAudit(row.before), after: sanitizeAudit(row.after),
    })) };
  }

  async detail(identity: AuthenticatedIdentity, id: string) {
    await this.operation.actor(identity, 'ADMIN');
    const row = await this.database.adminAuditEntry.findUnique({ where: { id }, include: { actor: { select: { displayName: true } }, target: { select: { displayName: true } } } });
    if (!row) throw new AppError('Entrée introuvable.', 404, 'ADMIN_AUDIT_NOT_FOUND');
    return { id: row.id, actorPlayerId: row.actorPlayerId, actorName: row.actor.displayName, targetPlayerId: row.targetPlayerId,
      targetName: row.target.displayName, domain: row.domain, action: row.action, operationId: row.operationId, createdAt: row.createdAt,
      before: sanitizeAudit(row.before), after: sanitizeAudit(row.after) };
  }
}
