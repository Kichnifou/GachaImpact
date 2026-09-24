import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { GetCurrentPlayer } from '../player/get-current-player.js';

export type DirectMessageReportSnapshotLine = Readonly<{
  id: string;
  authorPlayerId: string;
  authorDisplayName: string;
  content: string | null;
  createdAt: string;
  submissionOrder: string;
  editedAt: string | null;
  deletedAt: string | null;
}>;

export type DirectMessageReportPreviewDto = Readonly<{
  message: DirectMessageReportSnapshotLine;
  context: readonly DirectMessageReportSnapshotLine[];
  snapshotFingerprint: string;
  alreadyReported: boolean;
}>;

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
type Snapshot = Readonly<{ message: DirectMessageReportSnapshotLine; context: readonly DirectMessageReportSnapshotLine[]; fingerprint: string }>;

const unavailable = () => new AppError('Ce message ne peut pas être signalé.', 409, 'DIRECT_MESSAGE_REPORT_UNAVAILABLE');
const stale = () => new AppError('Le contexte du signalement a changé.', 409, 'DIRECT_MESSAGE_REPORT_PREVIEW_STALE');
const moderationForbidden = () => new AppError('Vous n’avez pas accès à la modération communautaire.', 403, 'MODERATION_FORBIDDEN');
const reportNotFound = () => new AppError('Ce signalement est introuvable.', 404, 'DIRECT_MESSAGE_REPORT_NOT_FOUND');

const messageSelect = {
  id: true,
  authorPlayerId: true,
  content: true,
  createdAt: true,
  submissionOrder: true,
  editedAt: true,
  deletedAt: true,
  author: { select: { displayName: true } },
} as const;

type SelectedMessage = Prisma.DirectMessageGetPayload<{ select: typeof messageSelect }>;

function project(row: SelectedMessage): DirectMessageReportSnapshotLine {
  return {
    id: row.id,
    authorPlayerId: row.authorPlayerId,
    authorDisplayName: row.author.displayName,
    content: row.deletedAt ? null : row.content,
    createdAt: row.createdAt.toISOString(),
    submissionOrder: row.submissionOrder.toString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

function fingerprint(message: DirectMessageReportSnapshotLine, context: readonly DirectMessageReportSnapshotLine[]) {
  return createHash('sha256').update(JSON.stringify({ message, context }), 'utf8').digest('hex');
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class DirectMessageReportService {
  public constructor(private readonly database: PrismaClient, private readonly getCurrentPlayer: GetCurrentPlayer) {}

  private async actor(identity: AuthenticatedIdentity) { return this.getCurrentPlayer.execute(identity); }

  private async requireParticipant(client: DatabaseClient, conversationId: string, playerId: string) {
    const participant = await client.directConversationParticipant.findUnique({
      where: { conversationId_playerId: { conversationId, playerId } },
      select: { playerId: true },
    });
    if (!participant) throw unavailable();
  }

  private async snapshot(client: DatabaseClient, conversationId: string, messageId: string, reporterPlayerId: string): Promise<Snapshot> {
    await this.requireParticipant(client, conversationId, reporterPlayerId);
    const target = await client.directMessage.findFirst({ where: { id: messageId, conversationId }, select: messageSelect });
    if (!target || target.authorPlayerId === reporterPlayerId || target.deletedAt || target.content === null) throw unavailable();
    const [beforeDescending, after] = await Promise.all([
      client.directMessage.findMany({ where: { conversationId, submissionOrder: { lt: target.submissionOrder } }, orderBy: { submissionOrder: 'desc' }, take: 10, select: messageSelect }),
      client.directMessage.findMany({ where: { conversationId, submissionOrder: { gt: target.submissionOrder } }, orderBy: { submissionOrder: 'asc' }, take: 10, select: messageSelect }),
    ]);
    const message = project(target);
    const context = [...beforeDescending.reverse().map(project), message, ...after.map(project)];
    return { message, context, fingerprint: fingerprint(message, context) };
  }

  public async preview(identity: AuthenticatedIdentity, conversationId: string, messageId: string): Promise<DirectMessageReportPreviewDto> {
    const actor = await this.actor(identity);
    const [snapshot, report] = await Promise.all([
      this.snapshot(this.database, conversationId, messageId, actor.id),
      this.database.directMessageReport.findUnique({ where: { reporterPlayerId_messageId: { reporterPlayerId: actor.id, messageId } }, select: { id: true } }),
    ]);
    return { message: snapshot.message, context: snapshot.context, snapshotFingerprint: snapshot.fingerprint, alreadyReported: Boolean(report) };
  }

  public async report(identity: AuthenticatedIdentity, conversationId: string, messageId: string, snapshotFingerprint: string) {
    const actor = await this.actor(identity);
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.database.$transaction(async tx => {
          await this.requireParticipant(tx, conversationId, actor.id);
          const duplicate = await tx.directMessageReport.findUnique({ where: { reporterPlayerId_messageId: { reporterPlayerId: actor.id, messageId } }, select: { id: true } });
          if (duplicate) return { reported: true as const, duplicate: true as const };
          const snapshot = await this.snapshot(tx, conversationId, messageId, actor.id);
          if (snapshot.fingerprint !== snapshotFingerprint) throw stale();
          await tx.directMessageReport.create({ data: {
            reporterPlayerId: actor.id,
            reportedPlayerId: snapshot.message.authorPlayerId,
            conversationId,
            messageId,
            messageSnapshot: json(snapshot.message),
            contextSnapshot: json(snapshot.context),
            snapshotFingerprint: snapshot.fingerprint,
          } });
          return { reported: true as const, duplicate: false as const };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 30_000 });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { reported: true as const, duplicate: true as const };
        if (attempt < 5 && isPrismaConcurrencyCollision(error)) continue;
        throw error;
      }
    }
  }

  private async requireCommunityModerator(playerId: string) {
    const assignment = await this.database.playerRoleAssignment.findFirst({
      where: { playerId, revokedAt: null, role: { in: ['MODERATOR', 'ADMIN'] } },
      select: { id: true },
    });
    if (!assignment) throw moderationForbidden();
  }

  public async list(identity: AuthenticatedIdentity, page: number) {
    const actor = await this.actor(identity);
    await this.requireCommunityModerator(actor.id);
    const pageSize = 20 as const;
    const [total, rows] = await Promise.all([
      this.database.directMessageReport.count(),
      this.database.directMessageReport.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, createdAt: true, messageSnapshot: true, reporter: { select: { id: true, displayName: true } }, reported: { select: { id: true, displayName: true } } },
      }),
    ]);
    return {
      reports: rows.map(row => ({ id: row.id, createdAt: row.createdAt.toISOString(), source: 'MP' as const, reporter: row.reporter, reported: row.reported, message: row.messageSnapshot })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  public async detail(identity: AuthenticatedIdentity, reportId: string) {
    const actor = await this.actor(identity);
    await this.requireCommunityModerator(actor.id);
    const row = await this.database.directMessageReport.findUnique({
      where: { id: reportId },
      select: { id: true, createdAt: true, snapshotFingerprint: true, messageSnapshot: true, contextSnapshot: true, reporter: { select: { id: true, displayName: true } }, reported: { select: { id: true, displayName: true } } },
    });
    if (!row) throw reportNotFound();
    return { id: row.id, createdAt: row.createdAt.toISOString(), source: 'MP' as const, reporter: row.reporter, reported: row.reported, message: row.messageSnapshot, context: row.contextSnapshot, snapshotFingerprint: row.snapshotFingerprint };
  }
}
