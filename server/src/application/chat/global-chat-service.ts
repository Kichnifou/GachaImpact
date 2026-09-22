import { createHash } from 'node:crypto';
import { GlobalChatDeletionState, GlobalChatMessageType, Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { isElementKey } from '../../domain/economy/resources.js';
import type { Clock } from '../../domain/time/business-date.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import { PrismaPlayerXpService } from '../../infrastructure/database/prisma-player-xp-service.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { GetCurrentPlayer } from '../player/get-current-player.js';
import { PlayerActivityRecorder } from '../player/player-activity-recorder.js';

const invalid = (message: string) => new AppError(message, 400, 'CHAT_INVALID');
const unavailable = () => new AppError('Ce message est indisponible.', 404, 'CHAT_UNAVAILABLE');
const conflict = () => new AppError('Cette clé appartient à un autre message.', 409, 'CHAT_IDEMPOTENCY_CONFLICT');
export type ChatCursor = { createdAt: string; id: string };
type ChatOperationSummary = { fingerprint: string; messageId?: string; xpGranted?: number };
const messageInclude = { author: { select: { id: true, displayName: true } }, replyToMessage: { select: { id: true, content: true, deletionState: true } } } as const;

function normalize(content: string) {
  if (typeof content !== 'string' || /[\r\n\u2028\u2029]/u.test(content)) throw invalid('Un message doit tenir sur une seule ligne.');
  const value = content.trim();
  const length = Array.from(value).length;
  if (length < 1 || length > 500) throw invalid('Le message doit contenir entre 1 et 500 caractères.');
  return { value, length, type: value.startsWith('!') ? GlobalChatMessageType.COMMAND : GlobalChatMessageType.PLAYER };
}

function project(row: {
  id: string; authorPlayerId: string | null; sourceChannel: string; messageType: string; content: string;
  createdAt: Date; deletedAt: Date | null; deletionState: GlobalChatDeletionState;
  replyToMessageId: string | null; author: { id: string; displayName: string } | null;
  replyToMessage: { id: string; content: string; deletionState: GlobalChatDeletionState } | null;
}) {
  const deleted = row.deletionState !== GlobalChatDeletionState.ACTIVE;
  return {
    id: row.id, author: row.author, sourceChannel: row.sourceChannel, messageType: row.messageType,
    content: deleted ? null : row.content, createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null, deletionState: row.deletionState,
    replyToMessageId: row.replyToMessageId,
    replyPreview: row.replyToMessage ? (row.replyToMessage.deletionState === GlobalChatDeletionState.ACTIVE ? row.replyToMessage.content : 'Message supprimé') : null,
  };
}

/** Server only foundation. No route or UI uses this service in the current lot. */
export class GlobalChatService {
  constructor(
    private readonly database: PrismaClient,
    private readonly currentPlayer: GetCurrentPlayer,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly xp = new PrismaPlayerXpService(),
    private readonly activity = new PlayerActivityRecorder(),
  ) {}

  private async actor(identity: AuthenticatedIdentity) { return this.currentPlayer.execute(identity); }

  private async transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.database.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 30_000 });
      } catch (error) {
        if (attempt < 5 && isPrismaConcurrencyCollision(error)) continue;
        throw error;
      }
    }
  }

  private async lockPlayer(tx: Prisma.TransactionClient, playerId: string) {
    const rows = await tx.$queryRaw<{ id: string; status: string; element_key: string | null }[]>`SELECT id, status::text, element_key FROM players WHERE id = ${playerId}::uuid FOR UPDATE`;
    if (!rows[0] || rows[0].status !== 'ACTIVE') throw new AppError('Ce compte ne peut pas utiliser le Chat.', 403, 'CHAT_FORBIDDEN');
    return rows[0];
  }

  async send(identity: AuthenticatedIdentity, content: string, idempotencyKey: string, replyToMessageId?: string | null) {
    const player = await this.actor(identity);
    const normalized = normalize(content);
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 200) throw invalid('Clé de requête invalide.');
    const replyId = replyToMessageId ?? null;
    if (replyId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(replyId)) throw invalid('Réponse invalide.');
    const fingerprint = createHash('sha256').update(JSON.stringify([normalized.value, replyId])).digest('hex');
    return this.transaction(async tx => {
      const actor = await this.lockPlayer(tx, player.id);
      const existing = await tx.businessOperation.findFirst({ where: { sourceChannel: 'INTERNAL_CHAT', idempotencyKey } });
      if (existing) {
        const summary = existing.resultSummary as ChatOperationSummary | null;
        if (existing.playerId !== player.id || existing.operationType !== 'chat.send' || summary?.fingerprint !== fingerprint || existing.status !== 'COMPLETED' || !summary.messageId) throw conflict();
        const message = await tx.globalChatMessage.findUniqueOrThrow({ where: { id: summary.messageId }, include: messageInclude });
        return { message: project(message), xpGranted: summary.xpGranted ?? 0, replayed: true };
      }
      const now = this.clock.now();
      if (replyId) {
        const parent = await tx.$queryRaw<{ deletion_state: string }[]>`SELECT deletion_state::text FROM global_chat_messages WHERE id = ${replyId}::uuid FOR SHARE`;
        if (parent[0]?.deletion_state !== 'ACTIVE') throw unavailable();
      }
      const recent = await tx.globalChatMessage.count({ where: { authorPlayerId: player.id, messageType: { in: ['PLAYER', 'COMMAND'] }, createdAt: { gt: new Date(now.getTime() - 10_000) } } });
      if (recent >= 10) throw new AppError('Vous envoyez des messages trop rapidement.', 429, 'CHAT_RATE_LIMIT');
      const operation = await tx.businessOperation.create({ data: { playerId: player.id, operationType: 'chat.send', sourceChannel: 'INTERNAL_CHAT', idempotencyKey, status: 'PENDING', startedAt: now, resultSummary: { fingerprint } } });
      const message = await tx.globalChatMessage.create({ data: { authorPlayerId: player.id, sourceChannel: 'INTERNAL_CHAT', messageType: normalized.type, content: normalized.value, operationId: operation.id, replyToMessageId: replyId, createdAt: now }, include: messageInclude });
      const progression = await tx.playerProgression.findUniqueOrThrow({ where: { playerId: player.id } });
      await tx.playerProgression.update({ where: { playerId: player.id }, data: { totalMessages: { increment: 1n } } });
      let xpGranted = 0;
      if (normalized.type === GlobalChatMessageType.PLAYER && actor.element_key && isElementKey(actor.element_key)
        && (!progression.lastXpMessageAt || now.getTime() - progression.lastXpMessageAt.getTime() >= 2_000)) {
        xpGranted = normalized.length <= 100 ? 1 : normalized.length <= 200 ? 2 : 3;
        await this.xp.grant(tx, { playerId: player.id, playerElementKey: actor.element_key, amount: BigInt(xpGranted), source: 'chat.message', now, operationId: operation.id, sourceChannel: 'INTERNAL_CHAT', random: this.random });
        await tx.playerProgression.update({ where: { playerId: player.id }, data: { countedMessages: { increment: 1n }, lastXpMessageAt: now } });
      }
      await this.activity.record(tx, player.id, now, 'INTERNAL_CHAT');
      await tx.businessOperation.update({ where: { id: operation.id }, data: { status: 'COMPLETED', completedAt: now, resultSummary: { fingerprint, messageId: message.id, xpGranted } } });
      return { message: project(message), xpGranted, replayed: false };
    });
  }

  async list(identity: AuthenticatedIdentity, limit = 50, cursor?: ChatCursor) {
    await this.actor(identity);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid('Taille de page invalide.');
    if (cursor) {
      const date = new Date(cursor.createdAt);
      if (Number.isNaN(date.getTime()) || !/^[0-9a-f-]{36}$/i.test(cursor.id)) throw invalid('Curseur invalide.');
      const anchor = await this.database.globalChatMessage.findUnique({ where: { id: cursor.id }, select: { createdAt: true } });
      if (!anchor || anchor.createdAt.toISOString() !== date.toISOString()) throw invalid('Curseur invalide.');
    }
    const rows = await this.database.globalChatMessage.findMany({
      include: messageInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1,
      ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return { messages: page.reverse().map(project), nextCursor: rows.length > limit && last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null };
  }

  async unreadCount(identity: AuthenticatedIdentity) {
    const player = await this.actor(identity);
    // Compare database timestamps at full precision; JS Date would truncate microseconds.
    // Without a read state, every persisted message is unread until an explicit markRead.
    const rows = await this.database.$queryRaw<{ count: number }[]>`SELECT count(*)::integer AS count
      FROM global_chat_messages m LEFT JOIN global_chat_read_states s ON s.player_id = ${player.id}::uuid
      WHERE s.player_id IS NULL OR (m.created_at, m.id) > (s.last_read_created_at, s.last_read_message_id)`;
    return rows[0]?.count ?? 0;
  }

  async markRead(identity: AuthenticatedIdentity, messageId: string) {
    const player = await this.actor(identity);
    return this.transaction(async tx => {
      await this.lockPlayer(tx, player.id);
      const target = await tx.globalChatMessage.findUnique({ where: { id: messageId }, select: { id: true } });
      if (!target) throw unavailable();
      const now = this.clock.now();
      const updated = await tx.$queryRaw<{ last_read_message_id: string }[]>`INSERT INTO global_chat_read_states
        (player_id, last_read_message_id, last_read_created_at, updated_at)
        SELECT ${player.id}::uuid, id, created_at, ${now} FROM global_chat_messages WHERE id = ${target.id}::uuid
        ON CONFLICT (player_id) DO UPDATE SET
          last_read_message_id = EXCLUDED.last_read_message_id,
          last_read_created_at = EXCLUDED.last_read_created_at,
          updated_at = EXCLUDED.updated_at
        WHERE (global_chat_read_states.last_read_created_at, global_chat_read_states.last_read_message_id)
          < (EXCLUDED.last_read_created_at, EXCLUDED.last_read_message_id)
        RETURNING last_read_message_id`;
      if (updated[0]) return { lastReadMessageId: updated[0].last_read_message_id, changed: true };
      const previous = await tx.globalChatReadState.findUniqueOrThrow({ where: { playerId: player.id }, select: { lastReadMessageId: true } });
      return { lastReadMessageId: previous.lastReadMessageId, changed: false };
    });
  }

  async deleteOwn(identity: AuthenticatedIdentity, messageId: string) {
    const player = await this.actor(identity);
    return this.transaction(async tx => {
      await this.lockPlayer(tx, player.id);
      const row = await tx.globalChatMessage.findUnique({ where: { id: messageId } });
      if (!row || row.authorPlayerId !== player.id || !['PLAYER', 'COMMAND'].includes(row.messageType)) throw unavailable();
      if (row.deletionState === 'AUTHOR') return { id: row.id, deletedAt: row.deletedAt?.toISOString() ?? null, changed: false };
      if (row.deletionState !== 'ACTIVE') throw unavailable();
      const now = this.clock.now();
      await tx.globalChatMessage.update({ where: { id: row.id }, data: { deletedAt: now, deletionState: 'AUTHOR' } });
      return { id: row.id, deletedAt: now.toISOString(), changed: true };
    });
  }
}
