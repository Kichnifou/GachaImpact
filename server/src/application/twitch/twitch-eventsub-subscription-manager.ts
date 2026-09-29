import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { AppError } from '../../api/errors.js';
import { TwitchEventSubApiError, type PilotEventSubType, type TwitchEventSubClient, type TwitchEventSubSubscription } from '../../infrastructure/twitch/twitch-eventsub-client.js';

export type PilotSubscriptionState = 'INACTIVE' | 'VERIFICATION_PENDING' | 'ACTIVE';
export type PilotChatState = PilotSubscriptionState;
type SubscriptionContext = { userId: string; callback: string };
export type PilotFavorSubscriptions = {
  status: 'enabled' | 'webhook_callback_verification_pending';
  subscriptions: readonly [TwitchEventSubSubscription, TwitchEventSubSubscription];
};
const favorTypes = ['channel.subscribe', 'channel.subscription.gift'] as const;
const conflict = (type: PilotEventSubType) => new AppError(type !== 'channel.chat.message'
  ? 'Réception des abonnements Twitch incompatible ; contrôle opérateur nécessaire.'
  : 'Réception du chat Twitch incompatible ; contrôle opérateur nécessaire.', 409, 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT');
const unavailable = () => new AppError('Réception du chat Twitch indisponible.', 503, 'TWITCH_RUNTIME_UNAVAILABLE');

/** Explicit pilot operations. Construction and health never call Twitch. */
export class TwitchEventSubSubscriptionManager {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly pending = new Map<string, Promise<TwitchEventSubSubscription>>();
  private readonly favorPending = new Map<string, Promise<PilotFavorSubscriptions>>();
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

  private async context(playerId: string, activation = false, expectedUserId?: string, expectedLogin?: string) {
    if (!this.config.twitch?.pilotPlayerIds.includes(playerId)) throw new AppError('Pilote Twitch non autorisé.', 403, 'TWITCH_PILOT_FORBIDDEN');
    if (activation ? !this.activationAvailable : !this.managementAvailable) throw unavailable();
    const linked = await this.db.twitchIdentity.findUnique({ where: { playerId } });
    if (!linked || !/^\d+$/.test(linked.twitchUserId))
      throw new AppError('Une identité Twitch liée est nécessaire.', 409, 'TWITCH_RUNTIME_IDENTITY_REQUIRED');
    if (expectedUserId && linked.twitchUserId !== expectedUserId
      || expectedLogin && linked.login.trim().normalize('NFKC').toLowerCase() !== expectedLogin)
      throw new AppError('Identité Twitch liée modifiée.', 409, 'TWITCH_ACCOUNT_MISMATCH');
    return { userId: linked.twitchUserId, callback: this.config.twitchEventSub!.callbackUrl! };
  }

  private exact(subscriptions: TwitchEventSubSubscription[], userId: string, callback: string, type: PilotEventSubType) {
    // Another chatting user on this broadcaster is a conflict, never a second pilot subscription.
    const related = subscriptions.filter(item => item.type === type && item.condition.broadcaster_user_id === userId);
    if (!related.length) return undefined;
    if (related.length !== 1) throw conflict(type);
    const item = related[0]!;
    if (item.version !== '1' || (type === 'channel.chat.message' && item.condition.user_id !== userId)
      || Object.keys(item.condition).length !== (type === 'channel.chat.message' ? 2 : 1) ||
      item.transport.method !== 'webhook' || item.transport.callback !== callback ||
      !['enabled', 'webhook_callback_verification_pending'].includes(item.status)) throw conflict(type);
    return item;
  }

  private list(type: PilotEventSubType, signal?: AbortSignal) {
    return type === 'channel.chat.message' ? this.client.listChatSubscriptions(signal)
      : type === 'channel.subscribe' ? this.client.listFavorSubscriptions(signal) : this.client.listGiftSubscriptions(signal);
  }

  private async inspect(playerId: string, type: PilotEventSubType, signal?: AbortSignal): Promise<PilotChatState> {
    return this.serial(playerId, async () => {
      const { userId, callback } = await this.context(playerId, true);
      const item = this.exact(await this.list(type, signal), userId, callback, type);
      return !item ? 'INACTIVE' : item.status === 'enabled' ? 'ACTIVE' : 'VERIFICATION_PENDING';
    });
  }
  async inspectPilotChatSubscription(playerId: string, signal?: AbortSignal) { return this.inspect(playerId, 'channel.chat.message', signal); }
  async inspectPilotFavorSubscription(playerId: string, signal?: AbortSignal): Promise<PilotSubscriptionState> {
    return this.serial(playerId, async () => {
      const { userId, callback } = await this.context(playerId, true);
      const items: (TwitchEventSubSubscription | undefined)[] = [];
      // Inspect both even when the first is absent: the second can conflict or fail.
      for (const type of favorTypes) items.push(this.exact(await this.list(type, signal), userId, callback, type));
      if (items.some(item => item?.status === 'webhook_callback_verification_pending')) return 'VERIFICATION_PENDING';
      return items.every(item => item?.status === 'enabled') ? 'ACTIVE' : 'INACTIVE';
    });
  }

  private async ensureExact({ userId, callback }: SubscriptionContext, type: PilotEventSubType): Promise<TwitchEventSubSubscription> {
    const existing = this.exact(await this.list(type), userId, callback, type);
    if (existing) return existing;
    try {
      const transport = { method: 'webhook' as const, callback, secret: this.config.twitchEventSub!.secret! };
      const created = type === 'channel.chat.message' ? await this.client.createChatSubscription({ type, version: '1',
        condition: { broadcaster_user_id: userId, user_id: userId }, transport })
        : type === 'channel.subscribe' ? await this.client.createFavorSubscription({ type, version: '1', condition: { broadcaster_user_id: userId }, transport })
        : await this.client.createGiftSubscription({ type, version: '1', condition: { broadcaster_user_id: userId }, transport });
      const matching = this.exact([created], userId, callback, type);
      if (!matching) throw conflict(type);
      return matching;
    } catch (error) {
      if (!(error instanceof TwitchEventSubApiError) || error.upstreamStatus !== 409) throw error;
      const recovered = this.exact(await this.list(type), userId, callback, type);
      if (!recovered) throw conflict(type);
      return recovered;
    }
  }

  private async ensure(playerId: string, type: PilotEventSubType, expectedUserId?: string, expectedLogin?: string): Promise<TwitchEventSubSubscription> {
    // Separate types/validated identities while retaining one lifecycle queue per Player.
    const key = JSON.stringify([playerId, type, expectedUserId, expectedLogin]);
    const running = this.pending.get(key);
    if (running) return running;
    const job = this.serial(playerId, async () => {
      return this.ensureExact(await this.context(playerId, true, expectedUserId, expectedLogin), type);
    });
    this.pending.set(key, job);
    try { return await job; }
    finally { this.pending.delete(key); }
  }
  async ensurePilotChatSubscription(playerId: string, expectedUserId?: string) { return this.ensure(playerId, 'channel.chat.message', expectedUserId); }
  async ensurePilotFavorSubscription(playerId: string, expectedUserId?: string, expectedLogin?: string) {
    const key = JSON.stringify([playerId, expectedUserId, expectedLogin]);
    const running = this.favorPending.get(key);
    if (running) return running;
    const job = this.serial(playerId, async (): Promise<PilotFavorSubscriptions> => {
      const context = await this.context(playerId, true, expectedUserId, expectedLogin);
      const beneficiary = await this.ensureExact(context, 'channel.subscribe');
      const gift = await this.ensureExact(context, 'channel.subscription.gift');
      return { subscriptions: [beneficiary, gift], status: beneficiary.status === 'enabled' && gift.status === 'enabled'
        ? 'enabled' : 'webhook_callback_verification_pending' };
    });
    this.favorPending.set(key, job);
    try { return await job; }
    finally { this.favorPending.delete(key); }
  }

  private async disable(playerId: string, type: PilotEventSubType, context?: SubscriptionContext): Promise<PilotChatState> {
    // Removal remains possible after the receiving flag is switched OFF.
    const { userId, callback } = context ?? await this.context(playerId);
    const existing = this.exact(await this.list(type), userId, callback, type);
    if (!existing) return 'INACTIVE';
    try { await this.client.deleteSubscription(existing.id); }
    catch (error) {
      if (!(error instanceof TwitchEventSubApiError) || error.upstreamStatus !== 404) throw error;
      if (this.exact(await this.list(type), userId, callback, type)) throw conflict(type);
    }
    return 'INACTIVE';
  }

  private async disablePilotSubscription(playerId: string, type: PilotEventSubType | 'FAVOR'): Promise<PilotChatState> {
    const key = JSON.stringify([playerId, type]);
    const running = this.disabling.get(key);
    if (running) return running;
    const job = this.serial(playerId, async () => {
      const context = await this.context(playerId);
      for (const requiredType of type === 'FAVOR' ? favorTypes : [type]) await this.disable(playerId, requiredType, context);
      return 'INACTIVE' as const;
    });
    this.disabling.set(key, job);
    try { return await job; }
    finally { this.disabling.delete(key); }
  }
  async disablePilotChatSubscription(playerId: string) { return this.disablePilotSubscription(playerId, 'channel.chat.message'); }
  async disablePilotFavorSubscription(playerId: string) { return this.disablePilotSubscription(playerId, 'FAVOR'); }

  async unlinkPilotIdentity(playerId: string, removeIdentity: () => Promise<void>) {
    return this.serial(playerId, async () => {
      const context = await this.context(playerId);
      await this.disable(playerId, 'channel.chat.message', context);
      for (const type of favorTypes) await this.disable(playerId, type, context);
      // Keep deletion in the same queue so an OAuth callback cannot create an orphan.
      await removeIdentity();
    });
  }
}
