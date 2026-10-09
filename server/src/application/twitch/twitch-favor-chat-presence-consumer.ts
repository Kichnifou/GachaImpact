import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { BusinessError } from '../errors.js';
import { FavorService } from '../favor/favor-service.js';
import { AppError } from '../../api/errors.js';

/** The signed transport classifies text in memory; only its existing hash is observed. */
export function isFavorEligibleTwitchChatMessage(text: string): boolean {
  return text.trim().length > 0 && !text.trimStart().startsWith('!');
}

/** Chat receipts remain volatile observations; durable daily payment belongs only to FavorService. */
export class TwitchFavorChatPresenceConsumer {
  private readonly favor: FavorService;
  constructor(private readonly database: PrismaClient, clock: Clock) {
    this.favor = new FavorService(database, clock);
  }

  async consume(receiptId: string) {
    const receipt = await this.database.twitchEventReceipt.findUnique({ where: { id: receiptId },
      select: { eventType: true, twitchUserId: true, receivedAt: true, state: true, processedAt: true, externalReference: true } });
    if (!receipt || receipt.eventType !== 'channel.chat.message' || !receipt.twitchUserId
      || receipt.state !== 'RECEIVED' || receipt.processedAt || receipt.externalReference) return { status: 'IGNORED' as const };
    const identity = await this.database.twitchIdentity.findUnique({ where: { twitchUserId: receipt.twitchUserId },
      select: { linkedAt: true, playerId: true, player: { select: { status: true } } } });
    if (!identity || identity.linkedAt > receipt.receivedAt || identity.player.status !== 'ACTIVE') return { status: 'IGNORED' as const };
    try { return await this.favor.claimToday(identity.playerId, 'TWITCH'); }
    catch (error) {
      // An archived or not-yet-activated Player cannot earn through passive chat.
      if (error instanceof BusinessError && ['PLAYER_NOT_FOUND', 'PLAYER_ARCHIVED'].includes(error.code)
        || error instanceof AppError && error.code === 'PLAYER_RECOVERY_NOT_ACTIVATED') return { status: 'IGNORED' as const };
      throw error;
    }
  }
}
