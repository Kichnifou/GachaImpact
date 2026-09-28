import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { AppError } from '../../api/errors.js';
import { TwitchEventSubApiError, type TwitchEventSubClient, type TwitchEventSubSubscription } from '../../infrastructure/twitch/twitch-eventsub-client.js';

export type PilotChatState = 'INACTIVE' | 'VERIFICATION_PENDING' | 'ACTIVE';
const conflict = () => new AppError('Réception du chat Twitch incompatible ; contrôle opérateur nécessaire.', 409, 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT');
const unavailable = () => new AppError('Réception du chat Twitch indisponible.', 503, 'TWITCH_RUNTIME_UNAVAILABLE');

/** Explicit pilot operations. Construction and health never call Twitch. */
export class TwitchEventSubSubscriptionManager {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly pending = new Map<string, Promise<TwitchEventSubSubscription>>();
  private readonly disabling = new Map<string, Promise<PilotChatState>>();
  constructor(private readonly db: Pick<PrismaClient, 'twitchIdentity'>, private readonly config: AppConfig,
    private readonly client: TwitchEventSubClient) {}

  get managementAvailable() {
    return Boolean(this.config.twitch?.clientId && this.config.twitch.clientSecret && this.config.twitchEventSub?.callbackUrl);
  }
  get activationAvailable() {
    return this.managementAvailable && Boolean(this.config.twitchEventSub?.enabled && this.config.twitchEventSub.secret);
  }

  private async serial<T>(playerId: string, action: () => Promise<T>): Promise<T> {
    const job = (this.queues.get(playerId) ?? Promise.resolve()).then(action);
    const settled = job.then(() => undefined, () => undefined);
    this.queues.set(playerId, settled);
    try { return await job; }
    finally { if (this.queues.get(playerId) === settled) this.queues.delete(playerId); }
  }

  private async context(playerId: string, activation = false, expectedUserId?: string) {
    if (!this.config.twitch?.pilotPlayerIds.includes(playerId)) throw new AppError('Pilote Twitch non autorisé.', 403, 'TWITCH_PILOT_FORBIDDEN');
    if (activation ? !this.activationAvailable : !this.managementAvailable) throw unavailable();
    const linked = await this.db.twitchIdentity.findUnique({ where: { playerId } });
    if (!linked || !/^\d+$/.test(linked.twitchUserId))
      throw new AppError('Une identité Twitch liée est nécessaire.', 409, 'TWITCH_RUNTIME_IDENTITY_REQUIRED');
    if (expectedUserId && linked.twitchUserId !== expectedUserId)
      throw new AppError('Identité Twitch liée modifiée.', 409, 'TWITCH_ACCOUNT_MISMATCH');
    return { userId: linked.twitchUserId, callback: this.config.twitchEventSub!.callbackUrl! };
  }

  private exact(subscriptions: TwitchEventSubSubscription[], userId: string, callback: string) {
    // Another chatting user on this broadcaster is a conflict, never a second pilot subscription.
    const related = subscriptions.filter(item => item.type === 'channel.chat.message' && item.condition.broadcaster_user_id === userId);
    if (!related.length) return undefined;
    if (related.length !== 1) throw conflict();
    const item = related[0]!;
    if (item.version !== '1' || item.condition.user_id !== userId || Object.keys(item.condition).length !== 2 ||
      item.transport.method !== 'webhook' || item.transport.callback !== callback ||
      !['enabled', 'webhook_callback_verification_pending'].includes(item.status)) throw conflict();
    return item;
  }

  async inspectPilotChatSubscription(playerId: string, signal?: AbortSignal): Promise<PilotChatState> {
    return this.serial(playerId, async () => {
      const { userId, callback } = await this.context(playerId, true);
      const item = this.exact(await this.client.listChatSubscriptions(signal), userId, callback);
      return !item ? 'INACTIVE' : item.status === 'enabled' ? 'ACTIVE' : 'VERIFICATION_PENDING';
    });
  }

  async ensurePilotChatSubscription(playerId: string, expectedUserId?: string): Promise<TwitchEventSubSubscription> {
    const running = this.pending.get(playerId);
    if (running) return running;
    const job = this.serial(playerId, async () => {
      const { userId, callback } = await this.context(playerId, true, expectedUserId);
      const existing = this.exact(await this.client.listChatSubscriptions(), userId, callback);
      if (existing) return existing;
      try {
        const created = await this.client.createChatSubscription({ type: 'channel.chat.message', version: '1',
          condition: { broadcaster_user_id: userId, user_id: userId },
          transport: { method: 'webhook', callback, secret: this.config.twitchEventSub!.secret! } });
        const matching = this.exact([created], userId, callback);
        if (!matching) throw conflict();
        return matching;
      } catch (error) {
        if (!(error instanceof TwitchEventSubApiError) || error.upstreamStatus !== 409) throw error;
        const recovered = this.exact(await this.client.listChatSubscriptions(), userId, callback);
        if (!recovered) throw conflict();
        return recovered;
      }
    });
    this.pending.set(playerId, job);
    try { return await job; }
    finally { this.pending.delete(playerId); }
  }

  private async disable(playerId: string): Promise<PilotChatState> {
    // Removal remains possible after the receiving flag is switched OFF.
    const { userId, callback } = await this.context(playerId);
    const existing = this.exact(await this.client.listChatSubscriptions(), userId, callback);
    if (!existing) return 'INACTIVE';
    try { await this.client.deleteChatSubscription(existing.id); }
    catch (error) {
      if (!(error instanceof TwitchEventSubApiError) || error.upstreamStatus !== 404) throw error;
      if (this.exact(await this.client.listChatSubscriptions(), userId, callback)) throw conflict();
    }
    return 'INACTIVE';
  }

  async disablePilotChatSubscription(playerId: string): Promise<PilotChatState> {
    const running = this.disabling.get(playerId);
    if (running) return running;
    const job = this.serial(playerId, () => this.disable(playerId));
    this.disabling.set(playerId, job);
    try { return await job; }
    finally { this.disabling.delete(playerId); }
  }

  async unlinkPilotChatIdentity(playerId: string, removeIdentity: () => Promise<void>) {
    return this.serial(playerId, async () => {
      await this.disable(playerId);
      // Keep deletion in the same queue so an OAuth callback cannot create an orphan.
      await removeIdentity();
    });
  }
}
