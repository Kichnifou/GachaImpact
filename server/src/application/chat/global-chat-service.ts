import { createHash } from 'node:crypto';
import { GlobalChatDeletionState, GlobalChatMessageType, Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { isElementKey } from '../../domain/economy/resources.js';
import type { Clock } from '../../domain/time/business-date.js';
import { getBusinessDate } from '../../domain/time/business-date.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import { PrismaPlayerXpService } from '../../infrastructure/database/prisma-player-xp-service.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { GetCurrentPlayer } from '../player/get-current-player.js';
import { PlayerActivityRecorder } from '../player/player-activity-recorder.js';
import { PrismaDailyChallengeStore } from '../../infrastructure/database/prisma-daily-challenge-store.js';
import { normalizePlayerSearch } from '../social/social-service.js';
import { scopesForOperation, type ChatRefreshScope } from './chat-refresh-scopes.js';

const invalid = (message: string) => new AppError(message, 400, 'CHAT_INVALID');
const unavailable = () => new AppError('Ce message est indisponible.', 404, 'CHAT_UNAVAILABLE');
const conflict = () => new AppError('Cette clé appartient à un autre message.', 409, 'CHAT_IDEMPOTENCY_CONFLICT');
export type ChatCursor = { createdAt: string; id: string };
type ChatOperationSummary = { fingerprint: string; messageId?: string; xpGranted?: number; refreshScopes?: string[]; dailyChallengeCompleted?: boolean; resolvedQuantity?: string; targetId?: string; action?: string };
export type ChatMentionInput = { playerId: string; displayName: string };
const messageInclude = { author: { select: { id: true, displayName: true, elementKey: true } }, operation: { select: { idempotencyKey: true } }, replyToMessage: { select: { id: true, content: true, deletionState: true, authorPlayerId: true } }, mentions: { select: { mentionedPlayerId: true, mentionedPlayer: { select: { displayName: true } } } } } as const;

function normalize(content: string) {
  if (typeof content !== 'string' || /[\r\n\u2028\u2029]/u.test(content)) throw invalid('Un message doit tenir sur une seule ligne.');
  const value = content.trim();
  const length = Array.from(value).length;
  if (length < 1 || length > 500) throw invalid('Le message doit contenir entre 1 et 500 caractères.');
  return { value, length, type: value.startsWith('!') ? GlobalChatMessageType.COMMAND : GlobalChatMessageType.PLAYER };
}

function splitGameResult(content: string): string[] {
  const parts: string[] = [];
  let remaining = content;
  while (Array.from(remaining).length > 500) {
    const characters = Array.from(remaining);
    let boundary = characters.slice(0, 500).lastIndexOf(' ');
    if (boundary < 1) boundary = 500;
    parts.push(characters.slice(0, boundary).join('').trimEnd());
    remaining = characters.slice(boundary).join('').trimStart();
  }
  parts.push(remaining);
  return parts;
}

function project(row: {
  id: string; authorPlayerId: string | null; sourceChannel: string; messageType: string; content: string;
  createdAt: Date; deletedAt: Date | null; deletionState: GlobalChatDeletionState;
  replyToMessageId: string | null; author: { id: string; displayName: string; elementKey: string | null } | null;
  replyToMessage: { id: string; content: string; deletionState: GlobalChatDeletionState; authorPlayerId: string | null } | null;
  mentions: { mentionedPlayerId: string; mentionedPlayer: { displayName: string } }[];
  operation: { idempotencyKey: string | null } | null;
}, viewerId?: string) {
  const deleted = row.deletionState !== GlobalChatDeletionState.ACTIVE;
  return {
    id: row.id, author: row.author, authorLabel: row.messageType === GlobalChatMessageType.GAME_RESULT ? 'GachaImpact' : row.author?.displayName ?? null,
    sourceChannel: row.sourceChannel, messageType: row.messageType,
    content: deleted ? null : row.content, createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null, deletionState: row.deletionState,
    replyToMessageId: row.replyToMessageId,
    replyPreview: row.replyToMessage ? (row.replyToMessage.deletionState === GlobalChatDeletionState.ACTIVE ? row.replyToMessage.content : 'Message supprimé') : null,
    mentionedMe: !!viewerId && !deleted && row.mentions.some(mention => mention.mentionedPlayerId === viewerId),
    resolvedMentions: deleted ? [] : row.mentions.map(mention => ({ playerId: mention.mentionedPlayerId, displayName: mention.mentionedPlayer.displayName })),
    repliedToMe: !!viewerId && !deleted && row.replyToMessage?.authorPlayerId === viewerId && row.authorPlayerId !== viewerId,
    clientIntentKey: viewerId && row.authorPlayerId === viewerId ? row.operation?.idempotencyKey ?? null : null,
  };
}

export class GlobalChatService {
  constructor(
    private readonly database: PrismaClient,
    private readonly currentPlayer: GetCurrentPlayer,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly xp = new PrismaPlayerXpService(),
    private readonly activity = new PlayerActivityRecorder(),
    private readonly dailyChallenges = new PrismaDailyChallengeStore(database),
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

  private async lockedGeneration(tx: Prisma.TransactionClient) {
    await tx.globalChatState.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
    const rows = await tx.$queryRaw<{ generation: number }[]>`SELECT generation FROM global_chat_state WHERE id = 1 FOR UPDATE`;
    return rows[0]!.generation;
  }

  private async generation() {
    return (await this.database.globalChatState.findUnique({ where: { id: 1 }, select: { generation: true } }))?.generation ?? 0;
  }

  async clear(identity: AuthenticatedIdentity, content: string, idempotencyKey: string) {
    const player = await this.actor(identity);
    if (content.trim().toLocaleLowerCase('fr-FR') !== '!clear') throw invalid('Syntaxe : !clear.');
    if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) throw invalid('Clé de requête invalide.');
    return this.transaction(async tx => {
      await this.lockPlayer(tx, player.id);
      const role = await tx.playerRoleAssignment.findFirst({ where: { playerId: player.id, role: { in: ['MODERATOR', 'ADMIN'] }, revokedAt: null }, select: { id: true } });
      if (!role) throw new AppError('Cette commande est réservée à la modération.', 403, 'CHAT_FORBIDDEN');
      const generation = await this.lockedGeneration(tx);
      const existing = await tx.businessOperation.findFirst({ where: { sourceChannel: 'INTERNAL_CHAT', idempotencyKey } });
      if (existing) {
        const summary = existing.resultSummary as { generation?: number } | null;
        if (existing.playerId !== player.id || existing.operationType !== 'chat.clear' || existing.status !== 'COMPLETED' || summary?.generation === undefined) throw conflict();
        return { cleared: true as const, generation: summary.generation, replayed: true };
      }
      const next = generation + 1;
      const now = this.clock.now();
      await tx.globalChatState.update({ where: { id: 1 }, data: { generation: next, updatedAt: now } });
      await tx.businessOperation.create({ data: { playerId: player.id, operationType: 'chat.clear', sourceChannel: 'INTERNAL_CHAT', idempotencyKey, status: 'COMPLETED', startedAt: now, completedAt: now, resultSummary: { generation: next, previousGeneration: generation } } });
      return { cleared: true as const, generation: next, replayed: false };
    });
  }

  async send(identity: AuthenticatedIdentity, content: string, idempotencyKey: string, replyToMessageId?: string | null, mentions: readonly ChatMentionInput[] = []) {
    const player = await this.actor(identity);
    const normalized = normalize(content);
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 200) throw invalid('Clé de requête invalide.');
    const replyId = replyToMessageId ?? null;
    if (replyId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(replyId)) throw invalid('Réponse invalide.');
    if (mentions.length > 10 || mentions.some(mention => !/^[0-9a-f-]{36}$/i.test(mention.playerId) || typeof mention.displayName !== 'string' || mention.displayName.length > 100)) throw invalid('Mention invalide.');
    // Hints improve autocomplete only. The text and current server identities determine mentions.
    const fingerprint = createHash('sha256').update(JSON.stringify([normalized.value, replyId])).digest('hex');
    return this.transaction(async tx => {
      const actor = await this.lockPlayer(tx, player.id);
      const generation = await this.lockedGeneration(tx);
      const existing = await tx.businessOperation.findFirst({ where: { sourceChannel: 'INTERNAL_CHAT', idempotencyKey } });
      if (existing) {
        const summary = existing.resultSummary as ChatOperationSummary | null;
        if (existing.playerId !== player.id || existing.operationType !== 'chat.send' || summary?.fingerprint !== fingerprint || existing.status !== 'COMPLETED' || !summary.messageId) throw conflict();
        const message = await tx.globalChatMessage.findUniqueOrThrow({ where: { id: summary.messageId }, include: messageInclude });
        return { message: project(message, player.id), generation: message.generation, xpGranted: summary.xpGranted ?? 0, refreshScopes: summary.refreshScopes ?? [], dailyChallengeCompleted: summary.dailyChallengeCompleted ?? false, replayed: true };
      }
      const now = this.clock.now();
      if (replyId) {
        const parent = await tx.$queryRaw<{ deletion_state: string; generation: number }[]>`SELECT deletion_state::text, generation FROM global_chat_messages WHERE id = ${replyId}::uuid FOR SHARE`;
        if (parent[0]?.deletion_state !== 'ACTIVE' || parent[0].generation !== generation) throw unavailable();
      }
      let resolvedMentions: string[] = [];
      if (normalized.type === GlobalChatMessageType.PLAYER && normalized.value.includes('@')) {
        const [players, blocks] = await Promise.all([
          tx.player.findMany({ where: { status: 'ACTIVE', id: { not: player.id } }, select: { id: true, displayName: true } }),
          tx.playerBlock.findMany({ where: { OR: [{ blockerPlayerId: player.id }, { blockedPlayerId: player.id }] }, select: { blockerPlayerId: true, blockedPlayerId: true } }),
        ]);
        const excluded = new Set(blocks.map(block => block.blockerPlayerId === player.id ? block.blockedPlayerId : block.blockerPlayerId));
        const haystack = normalizePlayerSearch(normalized.value);
        const matches: { id: string; offset: number; length: number }[] = [];
        for (const target of players) {
          if (excluded.has(target.id)) continue;
          const needle = `@${normalizePlayerSearch(target.displayName)}`;
          let offset = haystack.indexOf(needle);
          while (offset >= 0) {
            const before = offset ? haystack[offset - 1] : null;
            const after = haystack[offset + needle.length] ?? null;
            const following = haystack[offset + needle.length + 1] ?? null;
            if ((!before || /\s/u.test(before)) && (!after || /\s/u.test(after) || /[.,!?;:]/u.test(after) && (!following || /\s/u.test(following)))) {
              matches.push({ id: target.id, offset, length: needle.length });
            }
            offset = haystack.indexOf(needle, offset + 1);
          }
        }
        matches.sort((a, b) => a.offset - b.offset || b.length - a.length || a.id.localeCompare(b.id));
        const usedOffsets = new Set<number>(), usedPlayers = new Set<string>();
        for (const match of matches) {
          if (usedOffsets.has(match.offset)) continue;
          usedOffsets.add(match.offset);
          if (!usedPlayers.has(match.id) && usedPlayers.size < 10) usedPlayers.add(match.id);
        }
        resolvedMentions = [...usedPlayers];
      }
      const recent = await tx.globalChatMessage.count({ where: { authorPlayerId: player.id, messageType: { in: ['PLAYER', 'COMMAND'] }, createdAt: { gt: new Date(now.getTime() - 10_000) } } });
      if (recent >= 10) throw new AppError('Vous envoyez des messages trop rapidement.', 429, 'CHAT_RATE_LIMIT');
      const operation = await tx.businessOperation.create({ data: { playerId: player.id, operationType: 'chat.send', sourceChannel: 'INTERNAL_CHAT', idempotencyKey, status: 'PENDING', startedAt: now, resultSummary: { fingerprint } } });
      const message = await tx.globalChatMessage.create({ data: { authorPlayerId: player.id, sourceChannel: 'INTERNAL_CHAT', messageType: normalized.type, content: normalized.value, operationId: operation.id, replyToMessageId: replyId, createdAt: now, generation }, include: messageInclude });
      if (resolvedMentions.length) await tx.globalChatMention.createMany({ data: resolvedMentions.map(mentionedPlayerId => ({ messageId: message.id, mentionedPlayerId })) });
      const progression = await tx.playerProgression.findUniqueOrThrow({ where: { playerId: player.id } });
      await tx.playerProgression.update({ where: { playerId: player.id }, data: { totalMessages: { increment: 1n } } });
      let xpGranted = 0;
      let dailyChallengeCompleted = false;
      const refreshScopes: string[] = [];
      if (normalized.type === GlobalChatMessageType.PLAYER && actor.element_key && isElementKey(actor.element_key)
        && (!progression.lastXpMessageAt || now.getTime() - progression.lastXpMessageAt.getTime() >= 2_000)) {
        xpGranted = normalized.length <= 100 ? 1 : normalized.length <= 200 ? 2 : 3;
        const xpPlan = await this.xp.grant(tx, { playerId: player.id, playerElementKey: actor.element_key, amount: BigInt(xpGranted), source: 'chat.message', now, operationId: operation.id, sourceChannel: 'INTERNAL_CHAT', random: this.random });
        await tx.playerProgression.update({ where: { playerId: player.id }, data: { countedMessages: { increment: 1n }, lastXpMessageAt: now } });
        const businessDate = getBusinessDate(now);
        const challengeBefore = await tx.playerDailyChallenge.findUnique({ where: { playerId_businessDate: { playerId: player.id, businessDate: new Date(`${businessDate}T00:00:00.000Z`) } }, select: { status: true } });
        await this.dailyChallenges.progress(tx, { playerId: player.id, playerElementKey: actor.element_key, businessDate, type: 'messages', amount: 1n, now, operationId: operation.id, sourceChannel: 'INTERNAL_CHAT' });
        const challengeAfter = await tx.playerDailyChallenge.findUnique({ where: { playerId_businessDate: { playerId: player.id, businessDate: new Date(`${businessDate}T00:00:00.000Z`) } }, select: { status: true } });
        dailyChallengeCompleted = challengeBefore?.status === 'ACTIVE' && challengeAfter?.status === 'COMPLETED';
        refreshScopes.push('progression', 'dailyChallenge');
        if (xpPlan.rewards.length || dailyChallengeCompleted) refreshScopes.push('resources');
        if (xpPlan.levelsReached.length || xpPlan.overflowRewardsGranted) {
          const levels = xpPlan.levelsReached.length ? `niveau${xpPlan.levelsReached.length > 1 ? 'x' : ''} ${xpPlan.levelsReached.join(', ')}` : `${xpPlan.overflowRewardsGranted} récompense(s) de niveau 100`;
          const rewards = xpPlan.rewards.map(reward => `${reward.amount} ${reward.resourceKey}`).join(', ');
          await tx.globalChatMessage.create({ data: { authorPlayerId: null, sourceChannel: 'SYSTEM', messageType: 'GAME_RESULT', content: `${player.displayName} atteint ${levels} ! ${rewards}.`, replyToMessageId: message.id, createdAt: new Date(message.createdAt.getTime() + 1), generation } });
        }
      }
      await this.activity.record(tx, player.id, now, 'INTERNAL_CHAT');
      await tx.businessOperation.update({ where: { id: operation.id }, data: { status: 'COMPLETED', completedAt: now, resultSummary: { fingerprint, messageId: message.id, xpGranted, refreshScopes, dailyChallengeCompleted } } });
      const projected = resolvedMentions.length
        ? await tx.globalChatMessage.findUniqueOrThrow({ where: { id: message.id }, include: messageInclude })
        : message;
      return { message: project(projected, player.id), generation, xpGranted, refreshScopes, dailyChallengeCompleted, replayed: false };
    });
  }

  /** Backend-only public result. The command message ID is the durable delivery key. */
  async findGameResult(commandMessageId: string) {
    const row = await this.database.globalChatMessage.findUnique({
      where: { sourceChannel_externalMessageId: { sourceChannel: 'SYSTEM', externalMessageId: `command:${commandMessageId}` } },
      include: messageInclude,
    });
    return row ? project(row) : null;
  }

  async findGameResults(commandMessageId: string) {
    const first = await this.findGameResult(commandMessageId);
    if (!first) return [];
    const extras = await this.database.globalChatMessage.findMany({
      where: { sourceChannel: 'SYSTEM', externalMessageId: { startsWith: `command:${commandMessageId}:` } }, include: messageInclude,
    });
    return [first, ...extras.sort((a, b) => Number(a.externalMessageId!.split(':').at(-1)) - Number(b.externalMessageId!.split(':').at(-1))).map(row => project(row))];
  }

  /** A completed domain operation must be replayed, even if formatting its first reply failed. */
  async hasConfirmedCommandMutation(commandMessageId: string) {
    const command = await this.database.globalChatMessage.findUnique({
      where: { id: commandMessageId }, select: { authorPlayerId: true, messageType: true, sourceChannel: true },
    });
    if (command?.messageType !== 'COMMAND' || command.sourceChannel !== 'INTERNAL_CHAT' || !command.authorPlayerId) return false;
    const operation = await this.database.businessOperation.findFirst({
      where: {
        playerId: command.authorPlayerId, sourceChannel: { in: ['INTERNAL_CHAT', 'UI'] }, status: 'COMPLETED',
        operationType: { not: 'chat.send' },
        OR: [{ idempotencyKey: commandMessageId }, { idempotencyKey: { endsWith: `:${commandMessageId}` } }],
      }, select: { id: true },
    });
    if (operation) return true;
    const contestEvent = await this.database.contestEvent.findFirst({ where: { actorPlayerId: command.authorPlayerId, idempotencyKey: commandMessageId }, select: { id: true } });
    return contestEvent !== null;
  }

  async publishGameResult(commandMessageId: string, content: string) {
    const parent = await this.database.globalChatMessage.findUnique({ where: { id: commandMessageId }, select: { messageType: true, sourceChannel: true, generation: true } });
    if (parent?.messageType !== 'COMMAND' || parent.sourceChannel !== 'INTERNAL_CHAT') throw unavailable();
    const value = content.trim();
    if (!value || /[\r\n\u2028\u2029]/u.test(value)) throw invalid('Résultat Chat invalide.');
    const parts = splitGameResult(value);
    const existing = await this.findGameResult(commandMessageId);
    if (existing) return { message: existing, messages: await this.findGameResults(commandMessageId), replayed: true };
    try {
      await this.database.$transaction(async tx => {
        for (let index = 0; index < parts.length; index += 1) {
          const externalMessageId = index === 0 ? `command:${commandMessageId}` : `command:${commandMessageId}:${index + 1}`;
          await tx.globalChatMessage.create({
            data: { authorPlayerId: null, sourceChannel: 'SYSTEM', messageType: 'GAME_RESULT', content: parts[index]!,
              externalMessageId, replyToMessageId: commandMessageId, generation: parent.generation },
          });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const published = await this.findGameResult(commandMessageId);
        if (published) return { message: published, messages: await this.findGameResults(commandMessageId), replayed: true };
      }
      throw error;
    }
    const messages = await this.findGameResults(commandMessageId);
    return { message: messages[0]!, messages, replayed: false };
  }

  /** Freeze a computed MAX amount before the domain mutation, including across workers. */
  async rememberCommandQuantity(commandMessageId: string, proposed: bigint): Promise<bigint> {
    return this.database.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ result_summary: ChatOperationSummary }[]>`
        SELECT o.result_summary FROM business_operations o
        JOIN global_chat_messages m ON m.operation_id = o.id
        WHERE m.id = ${commandMessageId}::uuid AND m.message_type = 'COMMAND'::global_chat_message_type
        FOR UPDATE OF o`;
      const summary = rows[0]?.result_summary;
      if (!summary || summary.messageId !== commandMessageId) throw unavailable();
      if (summary.resolvedQuantity !== undefined) return BigInt(summary.resolvedQuantity);
      const row = await tx.globalChatMessage.findUniqueOrThrow({ where: { id: commandMessageId }, select: { operationId: true } });
      await tx.businessOperation.update({ where: { id: row.operationId! }, data: { resultSummary: { ...summary, resolvedQuantity: proposed.toString() } } });
      return proposed;
    });
  }

  /** Freeze a resolved target or branch before a domain mutation, including across workers. */
  async rememberCommandText(commandMessageId: string, field: 'targetId' | 'action', proposed: string): Promise<string> {
    return this.database.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ result_summary: ChatOperationSummary }[]>`
        SELECT o.result_summary FROM business_operations o
        JOIN global_chat_messages m ON m.operation_id = o.id
        WHERE m.id = ${commandMessageId}::uuid AND m.message_type = 'COMMAND'::global_chat_message_type
        FOR UPDATE OF o`;
      const summary = rows[0]?.result_summary;
      if (!summary || summary.messageId !== commandMessageId) throw unavailable();
      if (summary[field] !== undefined) return summary[field]!;
      const row = await tx.globalChatMessage.findUniqueOrThrow({ where: { id: commandMessageId }, select: { operationId: true } });
      await tx.businessOperation.update({ where: { id: row.operationId! }, data: { resultSummary: { ...summary, [field]: proposed } } });
      return proposed;
    });
  }

  async list(identity: AuthenticatedIdentity, limit = 50, cursor?: ChatCursor) {
    const viewer = await this.actor(identity);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid('Taille de page invalide.');
    return this.database.$transaction(async tx => {
      const generation = (await tx.globalChatState.findUnique({ where: { id: 1 }, select: { generation: true } }))?.generation ?? 0;
      if (cursor) {
        const date = new Date(cursor.createdAt);
        if (Number.isNaN(date.getTime()) || !/^[0-9a-f-]{36}$/i.test(cursor.id)) throw invalid('Curseur invalide.');
        const anchor = await tx.globalChatMessage.findUnique({ where: { id: cursor.id }, select: { createdAt: true, generation: true } });
        if (!anchor || anchor.createdAt.toISOString() !== date.toISOString()) throw invalid('Curseur invalide.');
        if (anchor.generation !== generation) return { messages: [], nextCursor: null, generation };
      }
      const rows = await tx.globalChatMessage.findMany({
        where: { generation }, include: messageInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1,
        ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
      });
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return { messages: page.reverse().map(row => project(row, viewer.id)), nextCursor: rows.length > limit && last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null, generation };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async updates(identity: AuthenticatedIdentity, clientGeneration: number, cursor?: ChatCursor, knownIds: string[] = []) {
    const viewer = await this.actor(identity);
    if (!Number.isInteger(clientGeneration) || clientGeneration < 0 || knownIds.length > 350 || knownIds.some(id => !/^[0-9a-f-]{36}$/i.test(id))) throw invalid('Mise à jour Chat invalide.');
    const generation = await this.generation();
    if (generation !== clientGeneration) return { generation, reset: true, messages: [] };
    if (!cursor) return { generation, reset: false, messages: [] };
    const date = new Date(cursor.createdAt);
    if (Number.isNaN(date.getTime()) || !/^[0-9a-f-]{36}$/i.test(cursor.id)) throw invalid('Curseur invalide.');
    const anchor = await this.database.globalChatMessage.findUnique({ where: { id: cursor.id }, select: { createdAt: true, generation: true } });
    if (!anchor || anchor.generation !== generation || anchor.createdAt.toISOString() !== date.toISOString()) return { generation, reset: true, messages: [] };
    const rows = await this.database.globalChatMessage.findMany({ where: { generation, OR: [{ createdAt: { gt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { gt: cursor.id } }, { id: { in: knownIds }, deletionState: { not: 'ACTIVE' } }] }, include: messageInclude, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 100 });
    return { generation, reset: false, messages: rows.map(row => project(row, viewer.id)) };
  }

  async rememberCommandRefreshScopes(commandMessageId: string, scopes: readonly ChatRefreshScope[]) {
    await this.database.$transaction(async tx => {
      const message = await tx.globalChatMessage.findUnique({ where: { id: commandMessageId }, select: { operationId: true, messageType: true } });
      if (!message?.operationId || message.messageType !== 'COMMAND') throw unavailable();
      const operation = await tx.businessOperation.findUniqueOrThrow({ where: { id: message.operationId } });
      const summary = operation.resultSummary as ChatOperationSummary;
      await tx.businessOperation.update({ where: { id: operation.id }, data: { resultSummary: { ...summary, refreshScopes: [...new Set([...(summary.refreshScopes ?? []), ...scopes])] } } });
    });
  }

  async commandRefreshScopes(commandMessageId: string): Promise<ChatRefreshScope[]> {
    const command = await this.database.globalChatMessage.findUnique({ where: { id: commandMessageId }, select: { authorPlayerId: true, operationId: true } });
    if (!command?.authorPlayerId || !command.operationId) throw unavailable();
    const [sendOperation, domainOperations] = await Promise.all([
      this.database.businessOperation.findUniqueOrThrow({ where: { id: command.operationId }, select: { resultSummary: true } }),
      this.database.businessOperation.findMany({ where: { playerId: command.authorPlayerId, status: 'COMPLETED', operationType: { not: 'chat.send' },
        OR: [{ idempotencyKey: commandMessageId }, { idempotencyKey: { endsWith: `:${commandMessageId}` } }] }, select: { operationType: true } }),
    ]);
    const summary = sendOperation.resultSummary as ChatOperationSummary;
    return [...new Set([...(summary.refreshScopes ?? []) as ChatRefreshScope[], ...domainOperations.flatMap(operation => scopesForOperation(operation.operationType))])];
  }

  async searchMentions(identity: AuthenticatedIdentity, query: string) {
    const viewer = await this.actor(identity);
    const needle = normalizePlayerSearch(query);
    if (!needle || needle.length > 100) return { players: [] };
    const blocked = await this.database.playerBlock.findMany({ where: { OR: [{ blockerPlayerId: viewer.id }, { blockedPlayerId: viewer.id }] }, select: { blockerPlayerId: true, blockedPlayerId: true } });
    const excluded = new Set([viewer.id, ...blocked.map(row => row.blockerPlayerId === viewer.id ? row.blockedPlayerId : row.blockerPlayerId)]);
    const players = await this.database.player.findMany({ where: { status: 'ACTIVE', id: { notIn: [...excluded] } }, select: { id: true, displayName: true, elementKey: true } });
    return { players: players.filter(row => normalizePlayerSearch(row.displayName).includes(needle))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' })).slice(0, 8) };
  }

  async report(identity: AuthenticatedIdentity, messageId: string) {
    const reporter = await this.actor(identity);
    return this.transaction(async tx => {
      await this.lockPlayer(tx, reporter.id);
      const generation = await this.lockedGeneration(tx);
      const target = await tx.globalChatMessage.findUnique({ where: { id: messageId }, include: messageInclude });
      if (!target || target.generation !== generation || target.deletionState !== 'ACTIVE' || !target.authorPlayerId || target.authorPlayerId === reporter.id || !['PLAYER', 'COMMAND'].includes(target.messageType)) throw unavailable();
      const existing = await tx.globalChatReport.findUnique({ where: { reporterPlayerId_messageId: { reporterPlayerId: reporter.id, messageId } }, select: { id: true } });
      if (existing) return { reported: true, duplicate: true };
      const anchor = { createdAt: target.createdAt, id: target.id };
      const [before, after] = await Promise.all([
        tx.globalChatMessage.findMany({ where: { generation, OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 10, select: { id: true, authorPlayerId: true, messageType: true, content: true, createdAt: true, deletionState: true } }),
        tx.globalChatMessage.findMany({ where: { generation, OR: [{ createdAt: { gt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { gt: anchor.id } }] }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 10, select: { id: true, authorPlayerId: true, messageType: true, content: true, createdAt: true, deletionState: true } }),
      ]);
      const snapshot = (row: typeof before[number]) => ({ id: row.id, authorPlayerId: row.authorPlayerId, messageType: row.messageType, content: row.content, createdAt: row.createdAt.toISOString(), deletionState: row.deletionState });
      await tx.globalChatReport.create({ data: { reporterPlayerId: reporter.id, messageId, reportedPlayerId: target.authorPlayerId,
        messageSnapshot: snapshot(target), contextSnapshot: [...before.reverse(), target, ...after].map(snapshot) } });
      return { reported: true, duplicate: false };
    });
  }

  async unreadCount(identity: AuthenticatedIdentity) {
    const player = await this.actor(identity);
    // Compare database timestamps at full precision; JS Date would truncate microseconds.
    // Without a read state, every persisted message is unread until an explicit markRead.
    const rows = await this.database.$queryRaw<{ count: number; generation: number }[]>`SELECT count(*)::integer AS count, g.generation
      FROM global_chat_state g CROSS JOIN global_chat_messages m LEFT JOIN global_chat_read_states s ON s.player_id = ${player.id}::uuid
      WHERE g.id = 1 AND m.generation = g.generation AND (s.player_id IS NULL OR s.generation < g.generation OR (m.created_at, m.id) > (s.last_read_created_at, s.last_read_message_id))
      GROUP BY g.generation`;
    return { unreadCount: rows[0]?.count ?? 0, generation: rows[0]?.generation ?? await this.generation() };
  }

  async markRead(identity: AuthenticatedIdentity, messageId: string) {
    const player = await this.actor(identity);
    return this.transaction(async tx => {
      await this.lockPlayer(tx, player.id);
      const generation = await this.lockedGeneration(tx);
      const target = await tx.globalChatMessage.findUnique({ where: { id: messageId }, select: { id: true, generation: true } });
      if (!target || target.generation !== generation) throw unavailable();
      const now = this.clock.now();
      const updated = await tx.$queryRaw<{ last_read_message_id: string }[]>`INSERT INTO global_chat_read_states
        (player_id, last_read_message_id, last_read_created_at, generation, updated_at)
        SELECT ${player.id}::uuid, id, created_at, generation, ${now} FROM global_chat_messages WHERE id = ${target.id}::uuid
        ON CONFLICT (player_id) DO UPDATE SET
          last_read_message_id = EXCLUDED.last_read_message_id,
          last_read_created_at = EXCLUDED.last_read_created_at,
          generation = EXCLUDED.generation,
          updated_at = EXCLUDED.updated_at
        WHERE global_chat_read_states.generation < EXCLUDED.generation OR
          (global_chat_read_states.generation = EXCLUDED.generation AND (global_chat_read_states.last_read_created_at, global_chat_read_states.last_read_message_id)
          < (EXCLUDED.last_read_created_at, EXCLUDED.last_read_message_id))
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
      const generation = await this.lockedGeneration(tx);
      const row = await tx.globalChatMessage.findUnique({ where: { id: messageId } });
      if (!row || row.generation !== generation || row.authorPlayerId !== player.id || !['PLAYER', 'COMMAND'].includes(row.messageType)) throw unavailable();
      if (row.deletionState === 'AUTHOR') return { id: row.id, deletedAt: row.deletedAt?.toISOString() ?? null, changed: false };
      if (row.deletionState !== 'ACTIVE') throw unavailable();
      const now = this.clock.now();
      await tx.globalChatMessage.update({ where: { id: row.id }, data: { deletedAt: now, deletionState: 'AUTHOR' } });
      return { id: row.id, deletedAt: now.toISOString(), changed: true };
    });
  }
}
