import { randomInt } from 'node:crypto';
import { Prisma, type PrismaClient, type SourceChannel } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import { isElementKey, particleResourceKey } from '../../domain/economy/resources.js';
import { giveawayRanked, oneLine, rankingText, resultText } from '../../domain/giveaway/giveaway.js';
import { PrismaEconomyService } from '../../infrastructure/database/prisma-economy-service.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { wishChatResult } from '../../domain/giveaway/wish-chat-result.js';

type Transaction = Prisma.TransactionClient;
type CommandAction = 'OPEN' | 'CLOSE' | 'WISH';
const unavailable = () => new AppError('Le bridge Giveaway Twitch n’est pas actif.', 409, 'GIVEAWAY_BRIDGE_INACTIVE');
const forbidden = () => new AppError('Action Giveaway réservée à la modération.', 403, 'GIVEAWAY_FORBIDDEN');
const noOpen = () => new AppError('Aucun Giveaway n’est actuellement ouvert.', 409, 'GIVEAWAY_NOT_OPEN');
const currentLock = async (tx: Transaction) => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(7861450867001::bigint)`; };

export interface GiveawayBridgeProof {
  assertActive(): Promise<void>;
  status(): Promise<{ available: boolean; authorized: boolean; enabled: boolean; active: boolean; pending: boolean; error?: string }>;
}

/** One authoritative core for Admin and the specialized Twitch command consumer. */
export class GiveawayService {
  private readonly economy = new PrismaEconomyService();
  constructor(private readonly db: PrismaClient, private readonly bridge: GiveawayBridgeProof,
    private readonly now: () => Date = () => new Date(), private readonly draw: (exclusiveMax: number) => number = randomInt) {}

  private async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000, maxWait: 30_000 }); }
      catch (error) { if (attempt < 5 && isPrismaConcurrencyCollision(error)) continue; throw error; }
    }
  }

  private async command(tx: Transaction, commandId: string | undefined, action: CommandAction) {
    if (!commandId) return null;
    const existing = await tx.giveawayCommandReceipt.findUnique({ where: { commandId } });
    if (existing && existing.action !== action) throw new AppError('Commande Giveaway incohérente.', 409, 'GIVEAWAY_COMMAND_CONFLICT');
    return existing;
  }

  private async authorize(tx: Transaction, actorPlayerId: string) {
    const actor = await tx.player.findUnique({ where: { id: actorPlayerId }, select: {
      id: true, status: true, rolesGranted: { where: { revokedAt: null }, select: { role: true } },
    } });
    if (!actor || actor.status !== 'ACTIVE' || !actor.rolesGranted.some(row => row.role === 'ADMIN' || row.role === 'MODERATOR')) throw forbidden();
  }

  async open(actorPlayerId: string, source: SourceChannel, commandId?: string) {
    await this.bridge.assertActive();
    return this.transaction(async tx => {
      await currentLock(tx);
      await this.authorize(tx, actorPlayerId);
      const previous = await this.command(tx, commandId, 'OPEN');
      if (previous) return { sessionId: previous.sessionId, duplicate: true };
      const credential = await tx.twitchGiveawayCredential.findFirst({ where: { enabled: true } });
      if (!credential) throw unavailable();
      if (await tx.giveawaySession.findFirst({ where: { status: 'OPEN' }, select: { id: true } }))
        throw new AppError('Un Giveaway est déjà ouvert.', 409, 'GIVEAWAY_ALREADY_OPEN');
      const now = this.now();
      const session = await tx.giveawaySession.create({ data: { status: 'OPEN', origin: 'NATIVE', openedByPlayerId: actorPlayerId, openedAt: now, rewardStatus: 'PENDING' } });
      await tx.giveawayAnnouncement.create({ data: { sessionId: session.id, kind: 'OPEN', text: '🎁 Giveaway ouvert ! Écris !wish pour tenter de gagner +1 600 Primogemmes.' } });
      if (commandId) await tx.giveawayCommandReceipt.create({ data: { commandId, action: 'OPEN', sessionId: session.id, outcome: 'OPENED' } });
      return { sessionId: session.id, duplicate: false, source };
    });
  }

  async wish(twitchUserId: string, commandId: string) {
    return this.transaction(async tx => {
      await currentLock(tx);
      const previous = await this.command(tx, commandId, 'WISH');
      if (previous) return { outcome: previous.outcome, sessionId: previous.sessionId, duplicate: true };
      const session = await tx.giveawaySession.findFirst({ where: { status: 'OPEN' }, select: { id: true, openedAt: true } });
      let outcome = 'NO_OPEN';
      let playerId: string | undefined;
      let name = 'Voyageur';
      if (session) {
        const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId }, select: {
          playerId: true, player: { select: { status: true, elementKey: true, displayName: true } },
        } });
        if (!identity) outcome = 'NO_IDENTITY';
        else if (identity.player.status !== 'ACTIVE') outcome = 'INACTIVE';
        else if (!identity.player.elementKey || !isElementKey(identity.player.elementKey)) outcome = 'NO_ELEMENT';
        else {
          playerId = identity.playerId;
          name = identity.player.displayName;
          const inserted = await tx.giveawayParticipant.createMany({ data: [{ sessionId: session.id, playerId }], skipDuplicates: true });
          outcome = inserted.count ? 'JOINED' : 'ALREADY_JOINED';
        }
      }
      await tx.giveawayCommandReceipt.create({ data: { commandId, action: 'WISH', sessionId: session?.id, outcome } });
      const count = session ? await tx.giveawayParticipant.count({ where: { sessionId: session.id } }) : 0;
      await tx.giveawayAnnouncement.create({ data: { sourceEventId: commandId, kind: 'WISH', sessionId: session?.id,
        text: wishChatResult(outcome, name, count) } });
      return { outcome, sessionId: session?.id ?? null, playerId, duplicate: false };
    });
  }

  async countMessage(input: { twitchUserId: string; twitchMessageId: string; observedAt: Date; text?: string }) {
    return this.transaction(async tx => {
      await currentLock(tx);
      const session = await tx.giveawaySession.findFirst({ where: { status: 'OPEN' }, select: { id: true, openedAt: true } });
      if (!session || !session.openedAt || input.observedAt < session.openedAt) return false;
      const outbound = await tx.giveawayAnnouncement.findUnique({ where: { twitchMessageId: input.twitchMessageId }, select: { id: true } });
      if (outbound) return false;
      const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: input.twitchUserId }, select: {
        playerId: true, linkedAt: true, player: { select: { status: true, elementKey: true } },
      } });
      if (!identity || identity.linkedAt > input.observedAt || identity.player.status !== 'ACTIVE'
        || !identity.player.elementKey || !isElementKey(identity.player.elementKey)) return false;
      const sender = await tx.twitchGiveawayCredential.findFirst({ where: { twitchUserId: input.twitchUserId, enabled: true }, select: { playerId: true } });
      if (sender && input.text === undefined && await tx.giveawayAnnouncement.findFirst({ where: { state: { in: ['RESERVED', 'AMBIGUOUS'] } }, select: { id: true } })) {
        await tx.giveawayDeferredMessage.createMany({ data: [{ twitchMessageId: input.twitchMessageId,
          sessionId: session.id, playerId: identity.playerId, observedAt: input.observedAt }], skipDuplicates: true });
        return false;
      }
      const inserted = await tx.giveawayCountedMessage.createMany({ data: [{ twitchMessageId: input.twitchMessageId,
        sessionId: session.id, playerId: identity.playerId, countedAt: input.observedAt }], skipDuplicates: true });
      if (!inserted.count) return false;
      await tx.giveawayChatStat.upsert({ where: { sessionId_playerId: { sessionId: session.id, playerId: identity.playerId } },
        create: { sessionId: session.id, playerId: identity.playerId, messageCount: 1n }, update: { messageCount: { increment: 1n } } });
      return true;
    });
  }

  /** A known Twitch ID or exact in-flight outbound text must not trigger Giveaway or Favor. */
  async isOutboundMessage(input: { twitchUserId: string; twitchMessageId: string; text: string }) {
    if (await this.db.giveawayAnnouncement.findUnique({ where: { twitchMessageId: input.twitchMessageId }, select: { id: true } })) return true;
    const sender = await this.db.twitchGiveawayCredential.findFirst({ where: { twitchUserId: input.twitchUserId }, select: { playerId: true } });
    if (!sender) return false;
    const candidate = await this.db.giveawayAnnouncement.findFirst({ where: { text: input.text,
      state: { in: ['RESERVED', 'AMBIGUOUS'] } }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    if (!candidate) return false;
    await this.db.giveawayAnnouncement.updateMany({ where: { id: candidate.id, state: { in: ['RESERVED', 'AMBIGUOUS'] }, twitchMessageId: null },
      data: { state: 'SENT', twitchMessageId: input.twitchMessageId, sentAt: this.now(), errorCode: null } });
    await this.settleDeferred();
    return true;
  }

  /** Reconciles broadcaster chat held while an outbound send lacked a known Twitch message ID. */
  async settleDeferred() {
    return this.transaction(async tx => {
      await currentLock(tx);
      if (await tx.giveawayAnnouncement.findFirst({ where: { state: { in: ['RESERVED', 'AMBIGUOUS'] } }, select: { id: true } })) return 0;
      const deferred = await tx.giveawayDeferredMessage.findMany({ orderBy: { observedAt: 'asc' } });
      let counted = 0;
      for (const row of deferred) {
        const outbound = await tx.giveawayAnnouncement.findUnique({ where: { twitchMessageId: row.twitchMessageId }, select: { id: true } });
        const session = await tx.giveawaySession.findUnique({ where: { id: row.sessionId }, select: { status: true } });
        if (!outbound && session?.status === 'OPEN') {
          const inserted = await tx.giveawayCountedMessage.createMany({ data: [{ twitchMessageId: row.twitchMessageId,
            sessionId: row.sessionId, playerId: row.playerId, countedAt: row.observedAt }], skipDuplicates: true });
          if (inserted.count) {
            await tx.giveawayChatStat.upsert({ where: { sessionId_playerId: { sessionId: row.sessionId, playerId: row.playerId } },
              create: { sessionId: row.sessionId, playerId: row.playerId, messageCount: 1n }, update: { messageCount: { increment: 1n } } });
            counted++;
          }
        }
        await tx.giveawayDeferredMessage.delete({ where: { twitchMessageId: row.twitchMessageId } });
      }
      return counted;
    });
  }

  async close(actorPlayerId: string, source: SourceChannel, requestedSessionId?: string, commandId?: string) {
    return this.transaction(async tx => {
      await currentLock(tx);
      await this.authorize(tx, actorPlayerId);
      const previous = await this.command(tx, commandId, 'CLOSE');
      if (previous) return { sessionId: previous.sessionId, duplicate: true };
      const open = await tx.giveawaySession.findFirst({ where: { status: 'OPEN' }, select: { id: true } });
      if (!open) {
        const closed = requestedSessionId ? await tx.giveawaySession.findUnique({ where: { id: requestedSessionId } }) : null;
        if (closed?.origin === 'NATIVE' && closed.status === 'CLOSED') return { sessionId: closed.id, duplicate: true };
        throw noOpen();
      }
      if (requestedSessionId && requestedSessionId !== open.id) throw new AppError('La session a changé.', 409, 'GIVEAWAY_SESSION_CHANGED');
      if (await tx.giveawayDeferredMessage.findFirst({ where: { sessionId: open.id }, select: { twitchMessageId: true } }))
        throw new AppError('Des messages Twitch attendent une résolution d’annonce.', 409, 'GIVEAWAY_MESSAGES_PENDING');
      const [participants, counts] = await Promise.all([
        tx.giveawayParticipant.findMany({ where: { sessionId: open.id }, select: { playerId: true, player: { select: { status: true, elementKey: true, displayName: true } } }, orderBy: { playerId: 'asc' } }),
        tx.giveawayChatStat.findMany({ where: { sessionId: open.id }, select: { playerId: true, messageCount: true,
          player: { select: { status: true, elementKey: true, displayName: true } } } }),
      ]);
      const eligible = participants.filter(row => row.player.status === 'ACTIVE' && row.player.elementKey && isElementKey(row.player.elementKey));
      const winner = eligible.length ? eligible[this.draw(eligible.length)]! : null;
      const ranked = giveawayRanked(counts.filter(row => row.messageCount > 0n && row.player.status === 'ACTIVE'
        && row.player.elementKey && isElementKey(row.player.elementKey)).map(row => ({ playerId: row.playerId,
        displayName: row.player.displayName, elementKey: row.player.elementKey!, messageCount: row.messageCount })));
      const now = this.now();
      const gains = new Map<string, { draw: boolean; chat: { rank: number; amount: bigint; elementKey: string } | null }>();
      const credit = async (playerId: string, elementKey: string, amount: bigint, resourceKey: 'primogems' | ReturnType<typeof particleResourceKey>, kind: 'DRAW' | 'CHAT', rank?: number, messageCount?: bigint) => {
        if (!isElementKey(elementKey)) throw new Error('Invalid Giveaway element.');
        const operation = await tx.businessOperation.create({ data: { playerId, operationType: `giveaway.${kind.toLowerCase()}`,
          sourceChannel: source, idempotencyKey: `${open.id}:${kind}:${playerId}`, status: 'PENDING', startedAt: now } });
        await this.economy.credit(tx, { playerId, playerElementKey: elementKey, resourceKey, amount,
          causeKey: kind === 'DRAW' ? 'giveaway.draw' : 'giveaway.chat', domainKey: 'giveaway', sourceChannel: source,
          operationId: operation.id, skipPermanentMissions: true });
        await tx.giveawayReward.create({ data: { sessionId: open.id, playerId, kind, amount, rank,
          messageCount, elementKey: kind === 'CHAT' ? elementKey : null, operationId: operation.id } });
        await tx.businessOperation.update({ where: { id: operation.id }, data: { status: 'COMPLETED', completedAt: now } });
      };
      // Stable lock order prevents deadlocks with other economic operations on several players.
      const rewards = [...ranked.map(row => ({ playerId: row.playerId, elementKey: row.elementKey, kind: 'CHAT' as const,
        amount: row.amount, rank: row.rank, messageCount: row.messageCount })),
        ...(winner ? [{ playerId: winner.playerId, elementKey: winner.player.elementKey!, kind: 'DRAW' as const,
          amount: 1600n, rank: undefined, messageCount: undefined }] : [])].sort((a, b) => a.playerId.localeCompare(b.playerId) || a.kind.localeCompare(b.kind));
      for (const row of rewards) {
        if (!isElementKey(row.elementKey)) throw new Error('Invalid Giveaway element.');
        await credit(row.playerId, row.elementKey, row.amount, row.kind === 'DRAW' ? 'primogems' : particleResourceKey(row.elementKey), row.kind, row.rank, row.messageCount);
        const gain = gains.get(row.playerId) ?? { draw: false, chat: null };
        if (row.kind === 'DRAW') gain.draw = true;
        else gain.chat = { rank: row.rank!, amount: row.amount, elementKey: row.elementKey };
        gains.set(row.playerId, gain);
      }
      for (const [playerId, gain] of gains) {
        const parts = [gain.draw ? '+1 600 Primogemmes' : null,
          gain.chat ? `+${gain.chat.amount.toLocaleString('fr-FR')} particules ${gain.chat.elementKey}` : null].filter(Boolean);
        const title = gain.draw ? '🎟️ Giveaway remporté' : gain.chat?.rank === 1 ? '🥇 1er du classement Giveaway' : '🎉 Récompense Giveaway';
        await tx.notification.create({ data: { playerId, domainKey: 'giveaway', typeKey: 'GIVEAWAY_REWARD',
          deduplicationKey: `giveaway:${open.id}:${playerId}`, payload: { title, message: parts.join(' et '), sessionId: open.id }, createdAt: now } });
      }
      await tx.giveawaySession.update({ where: { id: open.id }, data: { status: 'CLOSED', closedByPlayerId: actorPlayerId,
        closedAt: now, winnerPlayerId: winner?.playerId ?? null, rewardStatus: 'DISTRIBUTED' } });
      if (winner) {
        const operation = await tx.giveawayReward.findUniqueOrThrow({ where: { sessionId_playerId_kind: { sessionId: open.id, playerId: winner.playerId, kind: 'DRAW' } }, select: { operationId: true } });
        await tx.giveawayWin.create({ data: { sessionId: open.id, drawIndex: 0, playerId: winner.playerId,
          operationId: operation.operationId, drawnAt: now, origin: 'NATIVE' } });
      }
      await tx.giveawayAnnouncement.createMany({ data: [
        { sessionId: open.id, kind: 'RESULT', text: resultText(winner?.player.displayName ?? null) },
        { sessionId: open.id, kind: 'RANKING', text: rankingText(ranked) },
      ] });
      if (commandId) await tx.giveawayCommandReceipt.create({ data: { commandId, action: 'CLOSE', sessionId: open.id, outcome: 'CLOSED' } });
      return { sessionId: open.id, duplicate: false };
    });
  }

  async state() {
    const session = await this.db.giveawaySession.findFirst({ where: { origin: 'NATIVE' },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }], select: { id: true, status: true, openedAt: true, closedAt: true,
        openedBy: { select: { displayName: true } }, winner: { select: { displayName: true } },
        participants: { select: { playerId: true } }, chatStats: { select: { playerId: true, messageCount: true,
          player: { select: { displayName: true } } } }, announcements: { select: { id: true, kind: true, state: true, errorCode: true, attempts: true } } } });
    const ranked = session ? giveawayRanked(session.chatStats.map(row => ({ playerId: row.playerId,
      displayName: row.player.displayName, messageCount: row.messageCount }))) : [];
    return { session: session ? { id: session.id, status: session.status, openedAt: session.openedAt?.toISOString() ?? null,
      closedAt: session.closedAt?.toISOString() ?? null, openedBy: session.openedBy?.displayName ?? null,
      winner: session.winner?.displayName ?? null, participantCount: session.participants.length, chatterCount: session.chatStats.length,
      top: ranked.slice(0, 3).map(row => ({ playerId: row.playerId, displayName: row.displayName,
        messageCount: row.messageCount.toString(), rank: row.rank })), announcements: session.announcements } : null,
      bridge: await this.bridge.status() };
  }

  async publicStats() {
    const { session } = await this.state();
    if (!session) return '🎁 Aucun Giveaway terminé pour le moment.';
    return session.status === 'OPEN' ? oneLine(`🎁 Giveaway ouvert | 👥 ${session.participantCount} participant(s) | Écris !wish pour tenter +1 600 Primogemmes.`)
      : oneLine(`🎁 Giveaway fermé | 👥 ${session.participantCount} participant(s)${session.winner ? ` | 🏆 Gagnant : ${session.winner}` : ' | Aucun gagnant'}`);
  }
}
