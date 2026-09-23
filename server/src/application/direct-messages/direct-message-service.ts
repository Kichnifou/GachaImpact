import { Prisma, type PrismaClient, type PrivacyLevel } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { Clock } from '../../domain/time/business-date.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { GetCurrentPlayer } from '../player/get-current-player.js';
import { PlayerActivityRecorder } from '../player/player-activity-recorder.js';
import { PRIVATE_MESSAGES_CATEGORY } from '../social/contact-permission.js';
import { applyPlayerBlock, removePlayerBlock } from '../social/player-block-service.js';

const invalid = (message: string) => new AppError(message, 400, 'DIRECT_MESSAGE_INVALID');
const unavailable = () => new AppError('Cette conversation est indisponible.', 409, 'DIRECT_MESSAGE_UNAVAILABLE');
const forbidden = () => new AppError('Ce message ne peut pas être envoyé.', 403, 'DIRECT_MESSAGE_FORBIDDEN');
const conflict = () => new AppError('Cette clé appartient à une autre action.', 409, 'DIRECT_MESSAGE_IDEMPOTENCY_CONFLICT');
const rateLimited = () => new AppError('Trop de messages envoyés. Réessayez dans quelques secondes.', 429, 'DIRECT_MESSAGE_RATE_LIMIT');
const pair = (a: string, b: string) => { const values = [a, b].sort(); return { playerAId: values[0]!, playerBId: values[1]! }; };
export type DirectCursor = { createdAt: string; id: string };
type OperationResult = Record<string, Prisma.InputJsonValue | null>;
type OperationSummary = { fingerprint: string; result: OperationResult };
type InitiateResult = OperationResult & { conversationId: string; messageId: string; requestId: string | null; state: string };
type SendResult = OperationResult & { conversationId: string; messageId: string };
type ResolveResult = OperationResult & { conversationId: string; requestId: string; state: string };
type BlockResult = OperationResult & { conversationId: string; blocked: boolean; changed: boolean };
type ContactAccess = { allowed: boolean; friends: boolean; level: PrivacyLevel; blockedByActor: boolean; blockedByOther: boolean };

function normalizeContent(content: string) {
  if (typeof content !== 'string') throw invalid('Message invalide.');
  const value = content.trim();
  const length = Array.from(value).length;
  if (length < 1 || length > 1000) throw invalid('Le message doit contenir entre 1 et 1 000 caractères.');
  return value;
}

function validUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value); }

/** Authoritative two-person direct-message lifecycle. HTTP is its only current transport. */
export class DirectMessageService {
  constructor(
    private readonly database: PrismaClient,
    private readonly getCurrentPlayer: GetCurrentPlayer,
    private readonly clock: Clock,
    private readonly activity = new PlayerActivityRecorder(),
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
  private async createMessage(tx: Prisma.TransactionClient, playerId: string, conversationId: string, content: string, operationId: string, now: Date) {
    const message = await tx.directMessage.create({ data: { conversationId, authorPlayerId: playerId, content, operationId, createdAt: now } });
    await tx.directConversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
    await tx.directConversationParticipant.updateMany({ where: { conversationId }, data: { archivedAt: null } });
    return message;
  }

  async initiate(identity: AuthenticatedIdentity, targetPlayerId: string, rawContent: string, key: string): Promise<InitiateResult & { replayed: boolean }> {
    const actor = await this.actor(identity), content = normalizeContent(rawContent);
    if (actor.id === targetPlayerId || !validUuid(targetPlayerId)) throw unavailable();
    const fingerprint = `${targetPlayerId}:${content}`;
    return this.transaction(async tx => {
      await this.lockPlayers(tx, [actor.id, targetPlayerId]);
      const replay = await this.replay<InitiateResult>(tx, actor.id, key, 'direct-message.initiate', fingerprint);
      if (replay) return { ...replay, replayed: true };
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
      const message = await this.createMessage(tx, actor.id, conversation.id, content, operation.id, now);
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

  async send(identity: AuthenticatedIdentity, conversationId: string, rawContent: string, key: string): Promise<SendResult & { replayed: boolean }> {
    const actor = await this.actor(identity), content = normalizeContent(rawContent), fingerprint = `${conversationId}:${content}`;
    return this.transaction(async tx => {
      const initial = await this.requireConversation(tx, conversationId, actor.id), otherId = this.other(initial, actor.id);
      await this.lockPlayers(tx, [actor.id, otherId]);
      const replay = await this.replay<SendResult>(tx, actor.id, key, 'direct-message.send', fingerprint);
      if (replay) return { ...replay, replayed: true };
      const access = await this.permission(tx, actor.id, otherId);
      const latestRequest = await tx.directConversationRequest.findFirst({ where: { conversationId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      if (latestRequest?.state === 'PENDING' || latestRequest?.state === 'REFUSED' && !access.friends) throw unavailable();
      const now = this.clock.now(); await this.rate(tx, actor.id, now);
      const operation = await this.operation(tx, actor.id, key, 'direct-message.send', fingerprint, now);
      const message = await this.createMessage(tx, actor.id, conversationId, content, operation.id, now);
      const result: SendResult = { conversationId, messageId: message.id };
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
        messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
      }, orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    });
    const unreadRows = await this.database.$queryRaw<{ conversation_id: string; unread_count: number }[]>`SELECT p.conversation_id, count(m.id)::integer AS unread_count
      FROM direct_conversation_participants p JOIN direct_messages m ON m.conversation_id = p.conversation_id AND m.author_player_id <> p.player_id
      WHERE p.player_id = ${actor.id}::uuid AND (p.last_read_created_at IS NULL OR (m.created_at, m.id) > (p.last_read_created_at, p.last_read_message_id))
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
      conversations.push({ id: row.id, other, archived: effectivelyArchived, lastMessageAt: row.lastMessageAt?.toISOString() ?? null, lastMessage: row.messages[0] ? this.projectMessage(row.messages[0], actor.id, null) : null, request: latestRequest ? { id: latestRequest.id, state: latestRequest.state, senderPlayerId: latestRequest.senderPlayerId, retryAfter: latestRequest.retryAfter?.toISOString() ?? null } : null, unreadCount: unreadByConversation.get(row.id) ?? 0, readReceiptsEnabled: state.readReceiptsEnabled, canSend, blockedByMe: access.blockedByActor });
    }
    conversations.sort((left, right) => Number(right.unreadCount > 0) - Number(left.unreadCount > 0) || (right.lastMessageAt ?? '').localeCompare(left.lastMessageAt ?? '') || right.id.localeCompare(left.id));
    return { conversations };
  }

  private projectMessage(row: { id: string; conversationId: string; authorPlayerId: string; content: string | null; createdAt: Date; editedAt: Date | null; deletedAt: Date | null; restoredAt: Date | null }, viewerId: string, otherRead: { lastSharedReadCreatedAt: Date | null; lastSharedReadMessageId: string | null; lastSharedReadAt: Date | null } | null) {
    const readByOther = Boolean(otherRead?.lastSharedReadCreatedAt && (row.createdAt < otherRead.lastSharedReadCreatedAt || row.createdAt.getTime() === otherRead.lastSharedReadCreatedAt.getTime() && row.id <= otherRead.lastSharedReadMessageId!));
    return { id: row.id, conversationId: row.conversationId, authorPlayerId: row.authorPlayerId, own: row.authorPlayerId === viewerId, content: row.content, createdAt: row.createdAt.toISOString(), editedAt: row.editedAt?.toISOString() ?? null, deletedAt: row.deletedAt?.toISOString() ?? null, restoredAt: row.restoredAt?.toISOString() ?? null, readByOther, readByOtherAt: readByOther ? otherRead?.lastSharedReadAt?.toISOString() ?? null : null };
  }

  async messages(identity: AuthenticatedIdentity, conversationId: string, limit = 50, cursor?: DirectCursor) {
    const actor = await this.actor(identity);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid('Taille de page invalide.');
    const conversation = await this.requireConversation(this.database as unknown as Prisma.TransactionClient, conversationId, actor.id);
    const recent = await this.database.directMessage.findMany({ where: { conversationId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 500 });
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
    const otherState = await this.database.directConversationParticipant.findUniqueOrThrow({ where: { conversationId_playerId: { conversationId, playerId: this.other(conversation, actor.id) } }, select: { lastSharedReadCreatedAt: true, lastSharedReadMessageId: true, lastSharedReadAt: true } });
    return { messages: page.reverse().map(row => this.projectMessage(row, actor.id, otherState)), nextCursor: offset + limit < recent.length && last ? { id: last.id, createdAt: last.createdAt.toISOString() } : null, windowSize: recent.length };
  }

  async unread(identity: AuthenticatedIdentity) {
    const actor = await this.actor(identity);
    const rows = await this.database.$queryRaw<{ conversation_id: string; unread_count: number }[]>`SELECT p.conversation_id, count(m.id)::integer AS unread_count
      FROM direct_conversation_participants p JOIN direct_messages m ON m.conversation_id = p.conversation_id AND m.author_player_id <> p.player_id
      WHERE p.player_id = ${actor.id}::uuid AND (p.last_read_created_at IS NULL OR (m.created_at, m.id) > (p.last_read_created_at, p.last_read_message_id))
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
        last_shared_read_message_id = CASE WHEN read_receipts_enabled THEN ${target.id}::uuid ELSE last_shared_read_message_id END,
        last_shared_read_created_at = CASE WHEN read_receipts_enabled THEN ${target.createdAt} ELSE last_shared_read_created_at END,
        last_shared_read_at = CASE WHEN read_receipts_enabled THEN ${readAt} ELSE last_shared_read_at END,
        updated_at = ${readAt}
        WHERE conversation_id = ${conversationId}::uuid AND player_id = ${actor.id}::uuid
          AND (last_read_created_at IS NULL OR (last_read_created_at, last_read_message_id) < (${target.createdAt}, ${target.id}::uuid))
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
