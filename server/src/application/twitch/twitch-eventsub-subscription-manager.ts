import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { AppError } from '../../api/errors.js';
import { TwitchEventSubApiError, type TwitchEventSubClient, type TwitchEventSubSubscription } from '../../infrastructure/twitch/twitch-eventsub-client.js';

const conflict = () => new AppError('Souscription Twitch Chat incompatible ; contrôle opérateur nécessaire.', 409, 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT');

/** Explicit operator primitive only. No startup, route, OAuth callback, status or scheduler calls it in Phase 2B-1. */
export class TwitchEventSubSubscriptionManager {
  private readonly pending = new Map<string, Promise<TwitchEventSubSubscription>>();
  constructor(private readonly db: Pick<PrismaClient, 'twitchIdentity'>, private readonly config: AppConfig,
    private readonly client: TwitchEventSubClient) {}

  async ensurePilotChatSubscription(playerId: string): Promise<TwitchEventSubSubscription> {
    const running = this.pending.get(playerId);
    if (running) return running;
    const job = this.ensure(playerId);
    this.pending.set(playerId, job);
    try { return await job; }
    finally { this.pending.delete(playerId); }
  }

  private async ensure(playerId: string): Promise<TwitchEventSubSubscription> {
    if (!this.config.twitch?.pilotPlayerIds.includes(playerId)) throw new AppError('Pilote Twitch non autorisé.', 403, 'TWITCH_PILOT_FORBIDDEN');
    const settings = this.config.twitchEventSub;
    if (!settings?.enabled || !settings.callbackUrl || !settings.secret)
      throw new AppError('Souscription Twitch Chat non configurée.', 503, 'TWITCH_RUNTIME_UNAVAILABLE');
    const linked = await this.db.twitchIdentity.findUnique({ where: { playerId } });
    if (!linked || !/^\d+$/.test(linked.twitchUserId))
      throw new AppError('Une identité Twitch liée est nécessaire.', 409, 'TWITCH_RUNTIME_IDENTITY_REQUIRED');
    const userId = linked.twitchUserId;
    const exact = (subscriptions: TwitchEventSubSubscription[]) => {
      const related = subscriptions.filter(item => item.type === 'channel.chat.message' && item.condition.broadcaster_user_id === userId && item.condition.user_id === userId);
      if (!related.length) return undefined;
      if (related.length !== 1) throw conflict();
      const item = related[0]!;
      if (item.version !== '1' || Object.keys(item.condition).length !== 2 || item.transport.method !== 'webhook' ||
        item.transport.callback !== settings.callbackUrl || !['enabled', 'webhook_callback_verification_pending'].includes(item.status)) throw conflict();
      return item;
    };
    const existing = exact(await this.client.listChatSubscriptions());
    if (existing) return existing;
    try {
      const created = await this.client.createChatSubscription({ type: 'channel.chat.message', version: '1',
        condition: { broadcaster_user_id: userId, user_id: userId },
        transport: { method: 'webhook', callback: settings.callbackUrl, secret: settings.secret } });
      const matching = exact([created]);
      if (!matching) throw conflict();
      return matching;
    } catch (error) {
      if (!(error instanceof TwitchEventSubApiError) || error.upstreamStatus !== 409) throw error;
      const recovered = exact(await this.client.listChatSubscriptions());
      if (!recovered) throw conflict();
      return recovered;
    }
  }
}
