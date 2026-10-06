import type { PrismaClient } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import { classifyGiveawayText } from '../../domain/giveaway/giveaway.js';
import type { GiveawayService } from '../giveaway/giveaway-service.js';
import type { TwitchGiveawayManager } from './twitch-giveaway-manager.js';
import { wishChatResult } from '../../domain/giveaway/wish-chat-result.js';

export type GiveawayChatEvent = {
  broadcasterUserId: string; chatterUserId: string; messageId: string; text: string;
  messageType: string; observedAt: Date; badges?: readonly { set_id: string }[];
};

/** Only exact Giveaway roots and normal activity; never dispatch global Twitch commands. */
export class TwitchGiveawayConsumer {
  constructor(private readonly db: PrismaClient, private readonly core: GiveawayService,
    private readonly bridge: TwitchGiveawayManager) {}

  async consume(event: GiveawayChatEvent) {
    const credential = await this.db.twitchGiveawayCredential.findUnique({ where: { twitchUserId: event.broadcasterUserId },
      select: { enabled: true } });
    if (!credential) return false;
    if (event.chatterUserId === event.broadcasterUserId
      && await this.core.isOutboundMessage({ twitchUserId: event.chatterUserId, twitchMessageId: event.messageId, text: event.text })) return true;
    if (!credential?.enabled || event.messageType !== 'text' || event.badges?.some(badge => badge.set_id === 'bot')) return false;
    const command = classifyGiveawayText(event.text);
    if (command === 'OTHER_COMMAND') return false;
    if (command === 'MESSAGE') {
      await this.core.countMessage({ twitchUserId: event.chatterUserId, twitchMessageId: event.messageId, observedAt: event.observedAt, text: event.text });
      return false;
    }
    const key = `twitch:${event.messageId}`;
    // Use the persisted reply on replay; names, counts and live stats may have changed.
    const saved = command === 'WISH' || command === 'STATS'
      ? await this.db.giveawayAnnouncement.findUnique({ where: { sourceEventId: key } }) : null;
    if (saved && (command === 'WISH' && saved.kind === 'WISH' || command === 'STATS' && saved.kind === 'STATS')) {
      await this.bridge.sendAnnouncement(saved.id);
      return false;
    }
    const sendReply = async (text: string, kind: 'WISH' | 'STATS' | 'COMMAND', sessionId?: string | null) => {
      const id = await this.bridge.queueReply(key, kind, text, sessionId);
      if (id) await this.bridge.sendAnnouncement(id);
    };
    if (command === 'HELP') {
      await sendReply('ℹ️ Commandes giveaway : !giveaway open | !giveaway close | !giveaway stats | Participation : !wish', 'COMMAND');
      return false;
    }
    if (command === 'STATS') { await sendReply(await this.core.publicStats(), 'STATS'); return false; }
    if (command === 'WISH') {
      const result = await this.core.wish(event.chatterUserId, key);
      const announcement = await this.db.giveawayAnnouncement.findUnique({ where: { sourceEventId: key } });
      if (announcement) { await this.bridge.sendAnnouncement(announcement.id); return false; }
      // Compatibility with an old participation receipt interrupted before its announcement was queued.
      const identity = result.playerId ? await this.db.player.findUnique({ where: { id: result.playerId }, select: { displayName: true } })
        : (await this.db.twitchIdentity.findUnique({ where: { twitchUserId: event.chatterUserId }, select: { player: { select: { displayName: true } } } }))?.player;
      const name = identity?.displayName ?? 'Voyageur';
      const count = result.sessionId ? await this.db.giveawayParticipant.count({ where: { sessionId: result.sessionId } }) : 0;
      const reply = wishChatResult(result.outcome, name, count);
      await sendReply(reply, 'WISH', result.sessionId);
      return false;
    }
    const identity = await this.db.twitchIdentity.findUnique({ where: { twitchUserId: event.chatterUserId }, select: { playerId: true } });
    if (!identity) { await sendReply('⚠️ Commande Giveaway réservée à la modération liée à GachaImpact.', 'COMMAND'); return false; }
    try {
      const result = command === 'OPEN' ? await this.core.open(identity.playerId, 'TWITCH', key)
        : await this.core.close(identity.playerId, 'TWITCH', undefined, key);
      if (result.sessionId) await this.bridge.sendSessionMilestones(result.sessionId);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      await sendReply(`⚠️ ${error.message}`, 'COMMAND');
    }
    return false;
  }
}
