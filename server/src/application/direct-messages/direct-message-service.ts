import { Prisma, type PrismaClient, type PrivacyLevel } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { Clock } from '../../domain/time/business-date.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { GetCurrentPlayer } from '../player/get-current-player.js';
import { PlayerActivityRecorder } from '../player/player-activity-recorder.js';
import { PRIVATE_MESSAGES_CATEGORY } from '../social/contact-permission.js';
import { applyPlayerBlock, removePlayerBlock } from '../social/player-block-service.js';
import { normalizePlayerSearch } from '../social/social-service.js';

const invalid = (message: string) => new AppError(message, 400, 'DIRECT_MESSAGE_INVALID');
const unavailable = () => new AppError('Cette conversation est indisponible.', 409, 'DIRECT_MESSAGE_UNAVAILABLE');
const forbidden = () => new AppError('Ce message ne peut pas être envoyé.', 403, 'DIRECT_MESSAGE_FORBIDDEN');
const conflict = () => new AppError('Cette clé appartient à une autre action.', 409, 'DIRECT_MESSAGE_IDEMPOTENCY_CONFLICT');
const rateLimited = () => new AppError('Trop de messages envoyés. Réessayez dans quelques secondes.', 429, 'DIRECT_MESSAGE_RATE_LIMIT');
const RESTORABLE_MESSAGE_WINDOW = 500;
const pair = (a: string, b: string) => { const values = [a, b].sort(); return { playerAId: values[0]!, playerBId: values[1]! }; };
export type DirectCursor = { createdAt: string; id: string };
export type DirectHistoryCursor = { beforeOrder?: string; afterOrder?: string; aroundOrder?: string };
type OperationResult = Record<string, Prisma.InputJsonValue | null>;
type OperationSummary = { fingerprint: string; result: OperationResult };
type InitiateResult = OperationResult & { conversationId: string; messageId: string; requestId: string | null; state: string };
type SendResult = OperationResult & { conversationId: string; messageId: string };
type MessageMutationProjection = { id: string; content: string | null; editedAt: string | null; deletedAt: string | null; restoredAt: string | null };
type MessageMutationResult = OperationResult & { conversationId: string; messageId: string; message: MessageMutationProjection };
type ResolveResult = OperationResult & { conversationId: string; requestId: string; state: string };
type BlockResult = OperationResult & { conversationId: string; blocked: boolean; changed: boolean };
type ContactAccess = { allowed: boolean; friends: boolean; level: PrivacyLevel; blockedByActor: boolean; blockedByOther: boolean };
const directMessageInclude = {
  operation: { select: { idempotencyKey: true } },
  replyToMessage: { select: { content: true, deletedAt: true, contentPurgedAt: true } },
} as const;

function normalizeContent(content: string) {
  if (typeof content !== 'string') throw invalid('Message invalide.');
  const value = content.trim();
  const length = Array.from(value).length;
  if (length < 1 || length > 1000) throw invalid('Le message doit contenir entre 1 et 1 000 caractères.');
  return value;
}

function validUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value); }
function mutationProjection(row: { id: string; content: string | null; editedAt: Date | null; deletedAt: Date | null; restoredAt: Date | null }): MessageMutationProjection {
  return { id: row.id, content: row.deletedAt ? null : row.content, editedAt: row.editedAt?.toISOString() ?? null, deletedAt: row.deletedAt?.toISOString() ?? null, restoredAt: row.restoredAt?.toISOString() ?? null };
}

/** Authoritative two-person direct-message lifecycle. HTTP is its only current transport. */
export class DirectMessageService {
  constructor(
    private readonly database: PrismaClient,
    private readonly getCurrentPlayer: GetCurrentPlayer,
    private readonly clock: Clock,
    private readonly activity = new PlayerActivityRecorder(),
    private readonly onSubmissionReserved?: (order: bigint) => Promise<void>,
  ) {}

  private async actor(identity: AuthenticatedIdentity) { return this.getCurrentPlayer.execute(identity); }
  private async transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.database.$transaction(async tx => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('social:friendship'))`;
          return run(tx);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 30_000 });
      } catch (error) { if (attempt < 5 && isPrismaConcurrencyCollision(error)) continue; throw error; }
    }
  }
  private async lockPlayers(tx: Prisma.TransactionClient, ids: string[]) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM players WHERE id IN (${Prisma.join([...new Set(ids)].sort().map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
  }
  private async replay<T extends OperationResult>(tx: Prisma.TransactionClient, playerId: string, key: string, type: string, fingerprint: string): Promise<T | null> {
    const row = await tx.businessOperation.findFirst({ where: { sourceChannel: 'UI', idempotencyKey: key } });
    if (!row) return null;
    const summary = row.resultSummary as OperationSummary | null;
    if (row.playerId !== playerId || row.operationType !== type || row.status !== 'COMPLETED' || summary?.fingerprint !== fingerprint || !summary.result) throw conflict();
    return summary.result as T;
  }
  private async operation(tx: Prisma.TransactionClient, playerId: string, key: string, type: string, fingerprint: string, now: Date) {
    return tx.businessOperation.create({ data: { playerId, idempotencyKey: key, sourceChannel: 'UI', operationType: type, status: 'COMPLETED', startedAt: now, completedAt: now, resultSummary: { fingerprint, result: {} } } });
  }
  private async finish(tx: Prisma.TransactionClient, operationId: string, fingerprint: string, result: OperationResult) {
    await tx.businessOperation.update({ where: { id: operationId }, data: { resultSummary: { fingerprint, result } } });
  }
  private async requireConversation(tx: Prisma.TransactionClient, conversationId: string, playerId: string) {
    const conversation = await tx.directConversation.findFirst({ where: { id: conversationId, participants: { some: { playerId } } } });
    if (!conversation) throw unavailable();
    return conversation;
  }
  private other(conversation: { playerAId: string; playerBId: string }, playerId: string) { return conversation.playerAId === playerId ? conversation.playerBId : conversation.playerAId; }
  private async contactAccess(tx: Prisma.TransactionClient | PrismaClient, senderId: string, recipientId: string): Promise<ContactAccess> {
    const [recipient, friendship, blocks] = await Promise.all([
      tx.player.findFirst({ where: { id: recipientId, status: 'ACTIVE' }, select: { privacySettings: { where: { categoryKey: PRIVATE_MESSAGES_CATEGORY }, select: { level: true }, take: 1 } } }),
      tx.friendship.findUnique({ where: { playerAId_playerBId: pair(senderId, recipientId) }, select: { state: true } }),
      tx.playerBlock.findMany({ where: { OR: [{ blockerPlayerId: senderId, blockedPlayerId: recipientId }, { blockerPlayerId: recipientId, blockedPlayerId: senderId }] }, select: { blockerPlayerId: true } }),
    ]);
    const level: PrivacyLevel = recipient?.privacySettings[0]?.level ?? 'PUBLIC';
    const friends = friendship?.state === 'ACTIVE';
    const blockedByActor = blocks.some(block => block.blockerPlayerId === senderId);
    const blockedByOther = blocks.some(block => block.blockerPlayerId === recipientId);
    return { allowed: Boolean(recipient) && !blockedByActor && !blockedByOther && level !== 'PRIVATE' && (level !== 'FRIENDS' || friends), friends, level, blockedByActor, blockedByOther };
  }
  private async permission(tx: Prisma.TransactionClient, senderId: string, recipientId: string) {
    const access = await this.contactAccess(tx, senderId, recipientId);
    if (!access.allowed) throw forbidden();
    return access;
  }
  private async rate(tx: Prisma.TransactionClient, playerId: string, now: Date) {
    if (await tx.directMessage.count({ where: { authorPlayerId: playerId, createdAt: { gt: new Date(now.getTime() - 10_000) } } }) >= 10) throw rateLimited();
  }

  async searchPlayers(identity: AuthenticatedIdentity, rawQuery: string) {
    const actor = await this.actor(identity), needle = normalizePlayerSearch(rawQuery);
    if (!needle || Array.from(rawQuery.trim()).length > 100) return { players: [] };
    const rows = await this.database.player.findMany({
      where: { status: 'ACTIVE', id: { not: actor.id } },
      select: { id: true, displayName: true, elementKey: true },
    });
    const players = rows.filter(row => normalizePlayerSearch(row.displayName).includes(needle));
    players.sort((left, right) => left.displayName.localeCompare(right.displayName, 'fr', { sensitivity: 'base', numeric: true }) || left.id.localeCompare(right.id));
    return { players: players.slice(0, 20) };
  }
  private async reserveSubmissionOrder(key: string) {
    const rows = await this.database.$queryRaw<{ submission_order: bigint | null }[]>`
      SELECT CASE WHEN EXISTS (
        SELECT 1 FROM business_operations WHERE source_channel = 'UI'::source_channel AND idempotency_key = ${key}
      ) THEN NULL ELSE nextval('direct_messages_submission_order_seq') END AS submission_order`;
    return rows[0]?.submission_order ?? null;
  }
  private async createMessage(tx: Prisma.TransactionClient, playerId: string, conversationId: string, content: string, operationId: string, now: Date, submissionOrder: bigint, replyToMessageId: string | null = null) {
    const message = await tx.directMessage.create({ data: { conversationId, authorPlayerId: playerId, content, operationId, createdAt: now, submissionOrder, replyToMessageId } });
    await tx.directConversation.updateMany({ where: { id: conversationId, OR: [{ lastMessageOrder: null }, { lastMessageOrder: { lt: submissionOrder } }] }, data: { lastMessageAt: now, lastMessageOrder: submissionOrder } });
    await tx.directConversationParticipant.updateMany({ where: { conversationId }, data: { archivedAt: null } });
    const boundary = await tx.directMessage.findFirst({ where: { conversationId }, orderBy: { submissionOrder: 'desc' }, skip: RESTORABLE_MESSAGE_WINDOW - 1, select: { submissionOrder: true } });
    if (boundary) await tx.directMessage.updateMany({
      where: { conversationId, submissionOrder: { lt: boundary.submissionOrder }, deletedAt: { not: null }, content: { not: null }, contentPurgedAt: null },
      data: { content: null, contentPurgedAt: now },
    });
    return message;
  }

  private async isOutsideRestorableWindow(tx: Prisma.TransactionClient, conversationId: string, submissionOrder: bigint) {
    const boundary = await tx.directMessage.findFirst({
      where: { conversationId, submissionOrder: { gt: submissionOrder } },
      orderBy: { submissionOrder: 'asc' },
      skip: RESTORABLE_MESSAGE_WINDOW - 1,
      select: { id: true },
    });
    return boundary !== null;
  }

  private async requireOwnMessage(tx: Prisma.TransactionClient, conversationId: string, messageId: string, playerId: string) {
    if (!validUuid(conversationId) || !validUuid(messageId)) throw unavailable();
    await this.requireConversation(tx, conversationId, playerId);
    await tx.$queryRaw`SELECT id FROM direct_messages WHERE id = ${messageId}::uuid AND conversation_id = ${conversationId}::uuid FOR UPDATE`;
    const message = await tx.directMessage.findFirst({ where: { id: messageId, conversationId, authorPlayerId: playerId } });
    if (!message) throw unavailable();
    return message;
  }

  async initiate(identity: AuthenticatedIdentity, targetPlayerId: string, rawContent: string, key: string): Promise<InitiateResult & { replayed: boolean }> {
    const content = normalizeContent(rawContent), submissionOrder = await this.reserveSubmissionOrder(key);
    if (submissionOrder !== null && this.onSubmissionReserved) await this.onSubmissionReserved(submissionOrder);
    const actor = await this.actor(identity);
    if (actor.id === targetPlayerId || !validUuid(targetPlayerId)) throw unavailable();
    const fingerprint = `${targetPlayerId}:${content}`;
    return this.transaction(async tx => {
      await this.lockPlayers(tx, [actor.id, targetPlayerId]);
      const replay = await this.replay<InitiateResult>(tx, actor.id, key, 'direct-message.initiate', fingerprint);
      if (replay) return { ...replay, replayed: true };
      if (submissionOrder === null) throw conflict();
      const access = await this.permission(tx, actor.id, targetPlayerId);
      const now = this.clock.now();
      await this.rate(tx, actor.id, now);
      const canonical = pair(actor.id, targetPlayerId);
      let conversation = await tx.directConversation.findUnique({ where: { playerAId_playerBId: canonical } });
      if (!conversation) conversation = await tx.directConversation.create({ data: { ...canonical, createdAt: now, participants: { create: [{ playerId: actor.id, joinedAt: now }, { playerId: targetPlayerId, joinedAt: now }] } } });
      const latestRequest = await tx.directConversationRequest.findFirst({ where: { conversationId: conversation.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      if (latestRequest?.state === 'PENDING') throw unavailable();
      if (latestRequest?.state === 'REFUSED' && latestRequest.retryAfter && latestRequest.retryAfter > now) throw new AppError('Une nouvelle demande pourra être envoyée après le délai de 24 h.', 429, 'DIRECT_MESSAGE_RETRY_LATER');
      const accepted = access.friends || latestRequest?.state === 'ACCEPTED';
      const operation = await this.operation(tx, actor.id, key, 'direct-message.initiate', fingerprint, now);
      const message = await this.createMessage(tx, actor.id, conversation.id, content, operation.id, now, submissionOrder);
      let requestId: string | null = null, state = 'ACCEPTED';
      if (!accepted) {
        const request = await tx.directConversationRequest.create({ data: { conversationId: conversation.id, senderPlayerId: actor.id, recipientPlayerId: targetPlayerId, firstMessageId: message.id, createdAt: now } });
        requestId = request.id; state = 'PENDING';
      }
      const result: InitiateResult = { conversationId: conversation.id, messageId: message.id, requestId, state };
      await this.finish(tx, operation.id, fingerprint, result);
      await this.activity.record(tx, actor.id, now, 'INTERNAL_CHAT');
      return { ...result, replayed: false };
    });
  }

  async send(identity: AuthenticatedIdentity, conversationId: string, rawContent: string, key: string, replyToMessageId: string | null = null): Promise<SendResult & { replayed: boolean }> {
    const content = normalizeContent(rawContent);
    if (replyToMessageId !== null && !validUuid(replyToMessageId)) throw unavailable();
    const fingerprint = replyToMessageId === null ? `${conversationId}:${content}` : JSON.stringify([conversationId, content, replyToMessageId]), submissionOrder = await this.reserveSubmissionOrder(key);
    if (submissionOrder !== null && this.onSubmissionReserved) await this.onSubmissionReserved(submissionOrder);
    const actor = await this.actor(identity);
    return this.transaction(async tx => {
      const initial = await this.requireConversation(tx, conversationId, actor.id), otherId = this.other(initial, actor.id);
      await this.lockPlayers(tx, [actor.id, otherId]);
      const replay = await this.replay<SendResult>(tx, actor.id, key, 'direct-message.send', fingerprint);
      if (replay) return { ...replay, replayed: true };
      if (submissionOrder === null) throw conflict();
      const access = await this.permission(tx, actor.id, otherId);
      const latestRequest = await tx.directConversationRequest.findFirst({ where: { conversationId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      if (latestRequest?.state === 'PENDING' || latestRequest?.state === 'REFUSED' && !access.friends) throw unavailable();
      if (replyToMessageId) {
        const target = await tx.directMessage.findFirst({ where: { id: replyToMessageId, conversationId }, select: { content: true, deletedAt: true, contentPurgedAt: true } });
        if (!target || target.deletedAt || target.content === null || target.contentPurgedAt) throw unavailable();
      }
      const now = this.clock.now(); await this.rate(tx, actor.id, now);
      const operation = await this.operation(tx, actor.id, key, 'direct-message.send', fingerprint, now);
      const message = await this.createMessage(tx, actor.id, conversationId, content, operation.id, now, submissionOrder, replyToMessageId);
      const result: SendResult = { conversationId, messageId: message.id };
      await this.finish(tx, operation.id, fingerprint, result);
      await this.activity.record(tx, actor.id, now, 'INTERNAL_CHAT');
      return { ...result, replayed: false };
    });
  }

  async editMessage(identity: AuthenticatedIdentity, conversationId: string, messageId: string, rawContent: string, key: string): Promise<MessageMutationResult & { replayed: boolean }> {
    const content = normalizeContent(rawContent), actor = await this.actor(identity), fingerprint = `${conversationId}:${messageId}:${content}`;
    return this.transaction(async tx => {
      await this.requireConversation(tx, conversationId, actor.id);
      const replay = await this.replay<MessageMutationResult>(tx, actor.id, key, 'direct-message.edit', fingerprint);
      if (replay) return { ...replay, replayed: true };
      const message = await this.requireOwnMessage(tx, conversationId, messageId, actor.id);
      if (message.deletedAt || message.content === null || message.contentPurgedAt) throw unavailable();
      const now = this.clock.now(), operation = await this.operation(tx, actor.id, key, 'direct-message.edit', fingerprint, now);
      const updated = await tx.directMessage.update({ where: { id: message.id }, data: { content, editedAt: now } });
      const result: MessageMutationResult = { conversationId, messageId, message: mutationProjection(updated) };
      await this.finish(tx, operation.id, fingerprint, result);
      await this.activity.record(tx, actor.id, now, 'INTERNAL_CHAT');
      return { ...result, replayed: false };
    });
  }

  async deleteMessage(identity: AuthenticatedIdentity, conversationId: string, messageId: string, key: string): Promise<MessageMutationResult & { replayed: boolean }> {
    const actor = await this.actor(identity), fingerprint = `${conversationId}:${messageId}`;
    return this.transaction(async tx => {
      await this.requireConversation(tx, conversationId, actor.id);
      const replay = await this.replay<MessageMutationResult>(tx, actor.id, key, 'direct-message.delete', fingerprint);
      if (replay) return { ...replay, replayed: true };
      const message = await this.requireOwnMessage(tx, conversationId, messageId, actor.id);
      if (message.deletedAt || message.content === null || message.contentPurgedAt) throw unavailable();
      const outsideWindow = await this.isOutsideRestorableWindow(tx, conversationId, message.submissionOrder);
      const now = this.clock.now(), operation = await this.operation(tx, actor.id, key, 'direct-message.delete', fingerprint, now);
      const updated = await tx.directMessage.update({ where: { id: message.id }, data: outsideWindow
        ? { deletedAt: now, restoredAt: null, content: null, contentPurgedAt: now }
        : { deletedAt: now, restoredAt: null, contentPurgedAt: null } });
      const result: MessageMutationResult = { conversationId, messageId, message: mutationProjection(updated) };
      await this.finish(tx, operation.id, fingerprint, result);
      await this.activity.record(tx, actor.id, now, 'INTERNAL_CHAT');
      return { ...result, replayed: false };
    });
  }

  async restoreMessage(identity: AuthenticatedIdentity, conversationId: string, messageId: string, key: string): Promise<MessageMutationResult & { replayed: boolean }> {
    const actor = await this.actor(identity), fingerprint = `${conversationId}:${messageId}`;
    return this.transaction(async tx => {
      await this.requireConversation(tx, conversationId, actor.id);
      const replay = await this.replay<MessageMutationResult>(tx, actor.id, key, 'direct-message.restore', fingerprint);
      if (replay) return { ...replay, replayed: true };
      const message = await this.requireOwnMessage(tx, conversationId, messageId, actor.id);
      if (!message.deletedAt || message.content === null || message.contentPurgedAt) throw unavailable();
      if (await this.isOutsideRestorableWindow(tx, conversationId, message.submissionOrder)) throw unavailable();
      const now = this.clock.now(), operation = await this.operation(tx, actor.id, key, 'direct-message.restore', fingerprint, now);
      const updated = await tx.directMessage.update({ where: { id: message.id }, data: { deletedAt: null, restoredAt: now } });
      const result: MessageMutationResult = { conversationId, messageId, message: mutationProjection(updated) };
      await this.finish(tx, operation.id, fingerprint, result);
      await this.activity.record(tx, actor.id, now, 'INTERNAL_CHAT');
      return { ...result, replayed: false };
    });
  }

  async resolve(identity: AuthenticatedIdentity, conversationId: string, requestId: string, action: 'ACCEPT' | 'IGNORE', key: string): Promise<ResolveResult & { replayed: boolean }> {
    const actor = await this.actor(identity), fingerprint = `${conversationId}:${requestId}:${action}`;
    return this.transaction(async tx => {
      const conversation = await this.requireConversation(tx, conversationId, actor.id), otherId = this.other(conversation, actor.id);
      await this.lockPlayers(tx, [actor.id, otherId]);
      const type = `direct-message.${action.toLowerCase()}`;
      const replay = await this.replay<ResolveResult>(tx, actor.id, key, type, fingerprint);
      if (replay) return { ...replay, replayed: true };
      const request = await tx.directConversationRequest.findFirst({ where: { id: requestId, conversationId, recipientPlayerId: actor.id, state: 'PENDING' } });
      if (!request) throw unavailable();
      if (action === 'ACCEPT') {
        const [active, blocked] = await Promise.all([
          tx.player.count({ where: { id: otherId, status: 'ACTIVE' } }),
          tx.playerBlock.count({ where: { OR: [{ blockerPlayerId: actor.id, blockedPlayerId: otherId }, { blockerPlayerId: otherId, blockedPlayerId: actor.id }] } }),
        ]);
        if (!active || blocked) throw forbidden();
      }
      const now = this.clock.now(), state = action === 'ACCEPT' ? 'ACCEPTED' : 'REFUSED';
      await tx.directConversationRequest.update({ where: { id: request.id }, data: { state, resolvedAt: now, retryAfter: action === 'IGNORE' ? new Date(now.getTime() + 86_400_000) : null } });
      const operation = await this.operation(tx, actor.id, key, type, fingerprint, now);
      const result: ResolveResult = { conversationId, requestId, state };
      await this.finish(tx, operation.id, fingerprint, result);
      await this.activity.record(tx, actor.id, now, 'APPLICATION');
      return { ...result, replayed: false };
    });
  }

  async block(identity: AuthenticatedIdentity, conversationId: string, key: string): Promise<BlockResult & { replayed: boolean }> {
    const actor = await this.actor(identity), fingerprint = conversationId;
    return this.transaction(async tx => {
      const conversation = await this.requireConversation(tx, conversationId, actor.id), otherId = this.other(conversation, actor.id);
      await this.lockPlayers(tx, [actor.id, otherId]);
      const replay = await this.replay<BlockResult>(tx, actor.id, key, 'direct-message.block', fingerprint);
      if (replay) return { ...replay, replayed: true };
      const now = this.clock.now();
      const result: BlockResult = { conversationId, ...(await applyPlayerBlock(tx, actor.id, otherId, now)) };
      await tx.directConversationParticipant.updateMany({ where: { conversationId }, data: { archivedAt: now, updatedAt: now } });
      const pending = await tx.directConversationRequest.findFirst({ where: { conversationId, state: 'PENDING' } });
      if (pending) await tx.directConversationRequest.update({ where: { id: pending.id }, data: { state: 'REFUSED', resolvedAt: now, retryAfter: new Date(now.getTime() + 86_400_000) } });
      const operation = await this.operation(tx, actor.id, key, 'direct-message.block', fingerprint, now);
      await this.finish(tx, operation.id, fingerprint, result);
      await this.activity.record(tx, actor.id, now, 'APPLICATION');
      return { ...result, replayed: false };
    });
  }

  async unblock(identity: AuthenticatedIdentity, conversationId: string, key: string): Promise<BlockResult & { replayed: boolean }> {
    const actor = await this.actor(identity), fingerprint = conversationId;
    return this.transaction(async tx => {
      const conversation = await this.requireConversation(tx, conversationId, actor.id), otherId = this.other(conversation, actor.id);
      await this.lockPlayers(tx, [actor.id, otherId]);
      const replay = await this.replay<BlockResult>(tx, actor.id, key, 'direct-message.unblock', fingerprint);
      if (replay) return { ...replay, replayed: true };
      const now = this.clock.now();
      const result: BlockResult = { conversationId, ...(await removePlayerBlock(tx, actor.id, otherId)) };
      const operation = await this.operation(tx, actor.id, key, 'direct-message.unblock', fingerprint, now);
      await this.finish(tx, operation.id, fingerprint, result);
      if (result.changed) await this.activity.record(tx, actor.id, now, 'APPLICATION');
      return { ...result, replayed: false };
    });
  }

  async list(identity: AuthenticatedIdentity, archived = false) {
    const actor = await this.actor(identity);
    const rows = await this.database.directConversation.findMany({
      where: { participants: { some: { playerId: actor.id } } },
      include: {
        playerA: { select: { id: true, displayName: true, elementKey: true } }, playerB: { select: { id: true, displayName: true, elementKey: true } },
        participants: true,
        requests: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
        messages: { orderBy: { submissionOrder: 'desc' }, take: 1, include: directMessageInclude },
      }, orderBy: [{ lastMessageOrder: 'desc' }, { id: 'desc' }],
    });
    const unreadRows = await this.database.$queryRaw<{ conversation_id: string; unread_count: number }[]>`SELECT p.conversation_id, count(m.id)::integer AS unread_count
      FROM direct_conversation_participants p JOIN direct_messages m ON m.conversation_id = p.conversation_id AND m.author_player_id <> p.player_id
      WHERE p.player_id = ${actor.id}::uuid AND (p.last_read_submission_order IS NULL OR m.submission_order > p.last_read_submission_order)
      GROUP BY p.conversation_id`;
    const unreadByConversation = new Map(unreadRows.map(row => [row.conversation_id, row.unread_count]));
    const conversations = [];
    for (const row of rows) {
      const other = row.playerAId === actor.id ? row.playerB : row.playerA;
      const state = row.participants.find(item => item.playerId === actor.id)!;
      const access = await this.contactAccess(this.database, actor.id, other.id);
      const latestRequest = row.requests[0] ?? null;
      const effectivelyArchived = Boolean(state.archivedAt) || access.blockedByActor || access.blockedByOther;
      if (effectivelyArchived !== archived) continue;
      const canSend = access.allowed && latestRequest?.state !== 'PENDING' && (latestRequest?.state !== 'REFUSED' || access.friends);
      conversations.push({ id: row.id, other, archived: effectivelyArchived, lastMessageAt: row.messages[0]?.createdAt.toISOString() ?? null, lastMessage: row.messages[0] ? this.projectMessage(row.messages[0], actor.id, null) : null, request: latestRequest ? { id: latestRequest.id, state: latestRequest.state, senderPlayerId: latestRequest.senderPlayerId, retryAfter: latestRequest.retryAfter?.toISOString() ?? null } : null, unreadCount: unreadByConversation.get(row.id) ?? 0, readReceiptsEnabled: state.readReceiptsEnabled, canSend, blockedByMe: access.blockedByActor });
    }
    conversations.sort((left, right) => {
      const unreadOrder = Number(right.unreadCount > 0) - Number(left.unreadCount > 0);
      if (unreadOrder) return unreadOrder;
      const leftOrder = BigInt(left.lastMessage?.submissionOrder ?? '0'), rightOrder = BigInt(right.lastMessage?.submissionOrder ?? '0');
      return rightOrder < leftOrder ? -1 : rightOrder > leftOrder ? 1 : right.id.localeCompare(left.id);
    });
    return { conversations };
  }

  private projectMessage(row: { id: string; conversationId: string; authorPlayerId: string; content: string | null; createdAt: Date; submissionOrder: bigint; editedAt: Date | null; deletedAt: Date | null; restoredAt: Date | null; replyToMessageId: string | null; operation?: { idempotencyKey: string | null }; replyToMessage?: { content: string | null; deletedAt: Date | null; contentPurgedAt: Date | null } | null }, viewerId: string, otherRead: { lastSharedReadSubmissionOrder: bigint | null; lastSharedReadAt: Date | null } | null) {
    const readByOther = Boolean(otherRead?.lastSharedReadSubmissionOrder && row.submissionOrder <= otherRead.lastSharedReadSubmissionOrder);
    const own = row.authorPlayerId === viewerId;
    const replyPreview = row.replyToMessageId === null ? null : row.replyToMessage && !row.replyToMessage.deletedAt && row.replyToMessage.content !== null && !row.replyToMessage.contentPurgedAt ? row.replyToMessage.content : 'Message supprimé';
    return { id: row.id, conversationId: row.conversationId, authorPlayerId: row.authorPlayerId, own, clientIntentKey: own ? row.operation?.idempotencyKey ?? null : null, content: row.deletedAt ? null : row.content, createdAt: row.createdAt.toISOString(), submissionOrder: row.submissionOrder.toString(), editedAt: row.editedAt?.toISOString() ?? null, deletedAt: row.deletedAt?.toISOString() ?? null, restoredAt: row.restoredAt?.toISOString() ?? null, replyToMessageId: row.replyToMessageId, replyPreview, readByOther, readByOtherAt: readByOther ? otherRead?.lastSharedReadAt?.toISOString() ?? null : null };
  }

  private async historyContext(conversationId: string, actorId: string, otherId: string) {
    const [boundary, otherState] = await Promise.all([
      this.database.directMessage.findFirst({ where: { conversationId }, orderBy: { submissionOrder: 'desc' }, skip: RESTORABLE_MESSAGE_WINDOW - 1, select: { submissionOrder: true } }),
      this.database.directConversationParticipant.findUniqueOrThrow({ where: { conversationId_playerId: { conversationId, playerId: otherId } }, select: { lastSharedReadSubmissionOrder: true, lastSharedReadAt: true } }),
    ]);
    return {
      boundary: boundary?.submissionOrder ?? null,
      project: (row: { id: string; conversationId: string; authorPlayerId: string; content: string | null; createdAt: Date; submissionOrder: bigint; editedAt: Date | null; deletedAt: Date | null; restoredAt: Date | null; contentPurgedAt: Date | null; replyToMessageId: string | null; operation?: { idempotencyKey: string | null }; replyToMessage?: { content: string | null; deletedAt: Date | null; contentPurgedAt: Date | null } | null }) => ({
        ...this.projectMessage(row, actorId, otherState),
        canRestore: row.authorPlayerId === actorId && row.deletedAt !== null && row.content !== null && row.contentPurgedAt === null && (boundary === null || row.submissionOrder >= boundary.submissionOrder),
      }),
    };
  }

  private historyOrder(value: string | undefined) {
    if (!value || !/^[1-9]\d*$/u.test(value)) throw invalid('Curseur historique invalide.');
    try { return BigInt(value); } catch { throw invalid('Curseur historique invalide.'); }
  }

  async history(identity: AuthenticatedIdentity, conversationId: string, limit = 50, cursor: DirectHistoryCursor = {}) {
    const actor = await this.actor(identity);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid('Taille de page invalide.');
    const conversation = await this.requireConversation(this.database as unknown as Prisma.TransactionClient, conversationId, actor.id);
    const modes = [cursor.beforeOrder, cursor.afterOrder, cursor.aroundOrder].filter(value => value !== undefined);
    if (modes.length > 1) throw invalid('Curseurs historiques incompatibles.');
    const include = directMessageInclude;
    let rows: Awaited<ReturnType<typeof this.database.directMessage.findMany>>, hasOlder = false, hasNewer = false;
    if (cursor.aroundOrder) {
      const order = this.historyOrder(cursor.aroundOrder), olderSize = Math.floor((limit - 1) / 2), newerSize = limit - olderSize - 1;
      const [left, right] = await Promise.all([
        this.database.directMessage.findMany({ where: { conversationId, submissionOrder: { lte: order } }, orderBy: { submissionOrder: 'desc' }, take: olderSize + 2, include }),
        this.database.directMessage.findMany({ where: { conversationId, submissionOrder: { gt: order } }, orderBy: { submissionOrder: 'asc' }, take: newerSize + 1, include }),
      ]);
      hasOlder = left.length > olderSize + 1; hasNewer = right.length > newerSize;
      rows = [...left.slice(0, olderSize + 1).reverse(), ...right.slice(0, newerSize)];
    } else if (cursor.beforeOrder) {
      const order = this.historyOrder(cursor.beforeOrder);
      const page = await this.database.directMessage.findMany({ where: { conversationId, submissionOrder: { lt: order } }, orderBy: { submissionOrder: 'desc' }, take: limit + 1, include });
      hasOlder = page.length > limit; hasNewer = true; rows = page.slice(0, limit).reverse();
    } else if (cursor.afterOrder) {
      const order = this.historyOrder(cursor.afterOrder);
      const page = await this.database.directMessage.findMany({ where: { conversationId, submissionOrder: { gt: order } }, orderBy: { submissionOrder: 'asc' }, take: limit + 1, include });
      hasOlder = true; hasNewer = page.length > limit; rows = page.slice(0, limit);
    } else {
      const page = await this.database.directMessage.findMany({ where: { conversationId }, orderBy: { submissionOrder: 'desc' }, take: limit + 1, include });
      hasOlder = page.length > limit; rows = page.slice(0, limit).reverse();
    }
    const context = await this.historyContext(conversationId, actor.id, this.other(conversation, actor.id));
    return {
      messages: rows.map(context.project),
      olderCursor: hasOlder ? rows[0]?.submissionOrder.toString() ?? null : null,
      newerCursor: hasNewer ? rows.at(-1)?.submissionOrder.toString() ?? null : null,
    };
  }

  async searchHistory(identity: AuthenticatedIdentity, conversationId: string, rawQuery: string, limit = 50, cursor?: string) {
    const actor = await this.actor(identity), query = rawQuery.trim();
    if (!query || Array.from(query).length > 100) throw invalid('Recherche historique invalide.');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid('Taille de page invalide.');
    const conversation = await this.requireConversation(this.database as unknown as Prisma.TransactionClient, conversationId, actor.id);
    const before = cursor ? this.historyOrder(cursor) : null;
    const rows = await this.database.directMessage.findMany({
      where: { conversationId, deletedAt: null, content: { not: null, contains: query, mode: 'insensitive' }, ...(before ? { submissionOrder: { lt: before } } : {}) },
      orderBy: { submissionOrder: 'desc' }, take: limit + 1, include: directMessageInclude,
    });
    const page = rows.slice(0, limit), context = await this.historyContext(conversationId, actor.id, this.other(conversation, actor.id));
    return { results: page.map(context.project), nextCursor: rows.length > limit ? page.at(-1)?.submissionOrder.toString() ?? null : null };
  }

  async historyDate(identity: AuthenticatedIdentity, conversationId: string, rawAt: string) {
    const actor = await this.actor(identity), at = new Date(rawAt);
    if (Number.isNaN(at.getTime())) throw invalid('Date historique invalide.');
    await this.requireConversation(this.database as unknown as Prisma.TransactionClient, conversationId, actor.id);
    const selected = await this.database.directMessage.findFirst({ where: { conversationId, createdAt: { gte: at } }, orderBy: [{ createdAt: 'asc' }, { submissionOrder: 'asc' }], select: { id: true, submissionOrder: true, createdAt: true } })
      ?? await this.database.directMessage.findFirst({ where: { conversationId, createdAt: { lt: at } }, orderBy: [{ createdAt: 'desc' }, { submissionOrder: 'desc' }], select: { id: true, submissionOrder: true, createdAt: true } });
    return { anchor: selected ? { messageId: selected.id, submissionOrder: selected.submissionOrder.toString(), createdAt: selected.createdAt.toISOString() } : null };
  }

  async messages(identity: AuthenticatedIdentity, conversationId: string, limit = 50, cursor?: DirectCursor) {
    const actor = await this.actor(identity);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid('Taille de page invalide.');
    const conversation = await this.requireConversation(this.database as unknown as Prisma.TransactionClient, conversationId, actor.id);
    const recent = await this.database.directMessage.findMany({ where: { conversationId }, orderBy: { submissionOrder: 'desc' }, take: 500, include: directMessageInclude });
    let offset = 0;
    if (cursor) {
      if (!validUuid(cursor.id)) throw invalid('Curseur invalide.');
      const date = new Date(cursor.createdAt);
      if (Number.isNaN(date.getTime())) throw invalid('Curseur invalide.');
      const index = recent.findIndex(item => item.id === cursor.id && item.createdAt.toISOString() === date.toISOString());
      if (index < 0) throw invalid('Curseur invalide.');
      offset = index + 1;
    }
    const page = recent.slice(offset, offset + limit), last = page.at(-1);
    const otherState = await this.database.directConversationParticipant.findUniqueOrThrow({ where: { conversationId_playerId: { conversationId, playerId: this.other(conversation, actor.id) } }, select: { lastSharedReadSubmissionOrder: true, lastSharedReadAt: true } });
    return { messages: page.reverse().map(row => this.projectMessage(row, actor.id, otherState)), nextCursor: offset + limit < recent.length && last ? { id: last.id, createdAt: last.createdAt.toISOString() } : null, windowSize: recent.length };
  }

  async unread(identity: AuthenticatedIdentity) {
    const actor = await this.actor(identity);
    const rows = await this.database.$queryRaw<{ conversation_id: string; unread_count: number }[]>`SELECT p.conversation_id, count(m.id)::integer AS unread_count
      FROM direct_conversation_participants p JOIN direct_messages m ON m.conversation_id = p.conversation_id AND m.author_player_id <> p.player_id
      WHERE p.player_id = ${actor.id}::uuid AND (p.last_read_submission_order IS NULL OR m.submission_order > p.last_read_submission_order)
      GROUP BY p.conversation_id`;
    return { unreadCount: rows.reduce((sum, row) => sum + row.unread_count, 0), conversations: rows.map(row => ({ conversationId: row.conversation_id, unreadCount: row.unread_count })) };
  }

  async markRead(identity: AuthenticatedIdentity, conversationId: string, messageId: string) {
    const actor = await this.actor(identity);
    return this.transaction(async tx => {
      await this.requireConversation(tx, conversationId, actor.id);
      const target = await tx.directMessage.findFirst({ where: { id: messageId, conversationId } });
      if (!target) throw unavailable();
      const readAt = this.clock.now();
      const rows = await tx.$queryRaw<{ last_read_message_id: string; last_shared_read_at: Date | null }[]>`UPDATE direct_conversation_participants SET
        last_read_message_id = ${target.id}::uuid, last_read_created_at = ${target.createdAt},
        last_read_submission_order = ${target.submissionOrder},
        last_shared_read_message_id = CASE WHEN read_receipts_enabled THEN ${target.id}::uuid ELSE last_shared_read_message_id END,
        last_shared_read_created_at = CASE WHEN read_receipts_enabled THEN ${target.createdAt} ELSE last_shared_read_created_at END,
        last_shared_read_submission_order = CASE WHEN read_receipts_enabled THEN ${target.submissionOrder} ELSE last_shared_read_submission_order END,
        last_shared_read_at = CASE WHEN read_receipts_enabled THEN ${readAt} ELSE last_shared_read_at END,
        updated_at = ${readAt}
        WHERE conversation_id = ${conversationId}::uuid AND player_id = ${actor.id}::uuid
          AND (last_read_submission_order IS NULL OR last_read_submission_order < ${target.submissionOrder})
        RETURNING last_read_message_id, last_shared_read_at`;
      const current = rows[0] ?? await tx.directConversationParticipant.findUniqueOrThrow({ where: { conversationId_playerId: { conversationId, playerId: actor.id } }, select: { lastReadMessageId: true, lastSharedReadAt: true } });
      return { lastReadMessageId: 'last_read_message_id' in current ? current.last_read_message_id : current.lastReadMessageId, sharedReadAt: ('last_shared_read_at' in current ? current.last_shared_read_at : current.lastSharedReadAt)?.toISOString() ?? null, changed: Boolean(rows[0]) };
    });
  }

  async setReadReceipts(identity: AuthenticatedIdentity, conversationId: string, enabled: boolean) {
    const actor = await this.actor(identity), now = this.clock.now();
    return this.transaction(async tx => {
      await this.requireConversation(tx, conversationId, actor.id);
      const previous = await tx.directConversationParticipant.findUniqueOrThrow({ where: { conversationId_playerId: { conversationId, playerId: actor.id } } });
      const changed = previous.readReceiptsEnabled !== enabled;
      if (changed) {
        await tx.directConversationParticipant.update({ where: { conversationId_playerId: { conversationId, playerId: actor.id } }, data: { readReceiptsEnabled: enabled, updatedAt: now } });
        await this.activity.record(tx, actor.id, now, 'APPLICATION');
      }
      return { conversationId, readReceiptsEnabled: enabled, changed };
    });
  }

  async archive(identity: AuthenticatedIdentity, conversationId: string, archived: boolean) {
    const actor = await this.actor(identity), now = this.clock.now();
    return this.transaction(async tx => {
      const conversation = await this.requireConversation(tx, conversationId, actor.id);
      if (!archived) {
        const otherId = this.other(conversation, actor.id);
        const blocked = await tx.playerBlock.count({ where: { OR: [{ blockerPlayerId: actor.id, blockedPlayerId: otherId }, { blockerPlayerId: otherId, blockedPlayerId: actor.id }] } });
        if (blocked) return { conversationId, archived: true, changed: false };
      }
      const previous = await tx.directConversationParticipant.findUniqueOrThrow({ where: { conversationId_playerId: { conversationId, playerId: actor.id } } });
      const changed = Boolean(previous.archivedAt) !== archived;
      if (changed) {
        await tx.directConversationParticipant.update({ where: { conversationId_playerId: { conversationId, playerId: actor.id } }, data: { archivedAt: archived ? now : null, updatedAt: now } });
        await this.activity.record(tx, actor.id, now, 'APPLICATION');
      }
      return { conversationId, archived, changed };
    });
  }
}
