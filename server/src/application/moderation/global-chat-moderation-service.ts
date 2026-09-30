import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import { AdminOperation } from './admin-operation.js';

export class GlobalChatModerationService {
  private readonly operation: AdminOperation;
  constructor(private readonly database: PrismaClient, getPlayer: GetCurrentPlayer) { this.operation = new AdminOperation(database, getPlayer); }

  async list(identity: AuthenticatedIdentity, page: number) {
    await this.operation.actor(identity, 'COMMUNITY');
    const total = await this.database.globalChatReport.count();
    const currentPage = Math.min(page, Math.max(1, Math.ceil(total / 20)));
    const rows = await this.database.globalChatReport.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (currentPage - 1) * 20, take: 20,
      select: { id: true, messageId: true, reporterPlayerId: true, reportedPlayerId: true, messageSnapshot: true, createdAt: true,
        reporter: { select: { displayName: true } }, reported: { select: { displayName: true } }, message: { select: { deletionState: true } } } });
    return { page: currentPage, pageSize: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)), entries: rows };
  }

  async detail(identity: AuthenticatedIdentity, reportId: string) {
    await this.operation.actor(identity, 'COMMUNITY');
    const row = await this.database.globalChatReport.findUnique({ where: { id: reportId },
      select: { id: true, messageId: true, reporterPlayerId: true, reportedPlayerId: true, messageSnapshot: true, contextSnapshot: true, createdAt: true,
        reporter: { select: { displayName: true } }, reported: { select: { displayName: true } }, message: { select: { deletionState: true } } } });
    if (!row) throw new AppError('Signalement introuvable.', 404, 'CHAT_REPORT_NOT_FOUND');
    return row;
  }

  async moderate(identity: AuthenticatedIdentity, reportId: string, idempotencyKey: string) {
    await this.operation.actor(identity, 'COMMUNITY');
    const report = await this.database.globalChatReport.findUnique({ where: { id: reportId }, select: { reportedPlayerId: true } });
    const prior = report ? null : await this.database.businessOperation.findFirst({ where: { sourceChannel: 'ADMIN', idempotencyKey }, select: { playerId: true } });
    const targetPlayerId = report?.reportedPlayerId ?? prior?.playerId;
    if (!targetPlayerId) throw new AppError('Signalement introuvable.', 404, 'CHAT_REPORT_NOT_FOUND');
    return this.operation.run(identity, { scope: 'COMMUNITY', targetPlayerId, domain: 'global-chat', action: 'moderate-message',
      idempotencyKey, request: { reportId }, change: async tx => {
        const current = await tx.globalChatReport.findUnique({ where: { id: reportId }, include: { message: true } });
        if (!current) throw new AppError('Signalement introuvable.', 404, 'CHAT_REPORT_NOT_FOUND');
        const message = current.message;
        if (message.deletionState === 'ACTIVE') await tx.globalChatMessage.update({ where: { id: message.id }, data: { deletionState: 'MODERATION', deletedAt: new Date() } });
        return { before: { reportId, messageId: message.id, reportedPlayerId: current.reportedPlayerId, deletionState: message.deletionState },
          after: { reportId, messageId: message.id, reportedPlayerId: current.reportedPlayerId,
            deletionState: message.deletionState === 'ACTIVE' ? 'MODERATION' : message.deletionState } };
      } });
  }

  async deleteReport(identity: AuthenticatedIdentity, reportId: string, idempotencyKey: string) {
    await this.operation.actor(identity, 'COMMUNITY');
    const report = await this.database.globalChatReport.findUnique({ where: { id: reportId }, select: { reportedPlayerId: true } });
    const prior = report ? null : await this.database.businessOperation.findFirst({ where: { sourceChannel: 'ADMIN', idempotencyKey }, select: { playerId: true } });
    const targetPlayerId = report?.reportedPlayerId ?? prior?.playerId;
    if (!targetPlayerId) throw new AppError('Signalement introuvable.', 404, 'CHAT_REPORT_NOT_FOUND');
    return this.operation.run(identity, { scope: 'COMMUNITY', targetPlayerId, domain: 'global-chat', action: 'delete-report',
      idempotencyKey, request: { reportId }, change: async tx => {
        const current = await tx.globalChatReport.findUnique({ where: { id: reportId }, select: { id: true, messageId: true, reportedPlayerId: true, reporterPlayerId: true } });
        if (!current) throw new AppError('Signalement introuvable.', 404, 'CHAT_REPORT_NOT_FOUND');
        await tx.globalChatReport.delete({ where: { id: reportId } });
        return { before: { ...current, exists: true }, after: { reportId, messageId: current.messageId, reportedPlayerId: current.reportedPlayerId, exists: false } };
      } });
  }
}
