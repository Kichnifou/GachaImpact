import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { AppError } from '../../api/errors.js';
import { TwitchLifecycleCoordinator } from './twitch-lifecycle-coordinator.js';
import { TwitchEventSubApiError, type PilotEventSubType, type TwitchEventSubClient, type TwitchEventSubSubscription } from '../../infrastructure/twitch/twitch-eventsub-client.js';

export type PilotSubscriptionState = 'INACTIVE' | 'VERIFICATION_PENDING' | 'ACTIVE';
export type PilotChatState = PilotSubscriptionState;
type SubscriptionContext = { userId: string; callback: string; rewardId?: string };
export type PilotFavorSubscriptions = {
  status: 'enabled' | 'webhook_callback_verification_pending';
  subscriptions: readonly [TwitchEventSubSubscription, TwitchEventSubSubscription, TwitchEventSubSubscription];
};
const favorTypes = ['channel.subscribe', 'channel.subscription.gift', 'channel.subscription.message'] as const;
const liveStatuses = new Set(['enabled', 'webhook_callback_verification_pending']);
const terminalStatuses = new Set(['webhook_callback_verification_failed', 'notification_failures_exceeded', 'authorization_revoked',
  'moderator_removed', 'user_removed', 'version_removed', 'beta_maintenance']);
const conflict = (type: PilotEventSubType) => new AppError(type !== 'channel.chat.message'
  ? 'Réception des abonnements Twitch incompatible ; contrôle opérateur nécessaire.'
  : 'Réception du chat Twitch incompatible ; contrôle opérateur nécessaire.', 409, 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT');
const unavailable = () => new AppError('Réception du chat Twitch indisponible.', 503, 'TWITCH_RUNTIME_UNAVAILABLE');

/** Explicit pilot operations. Construction and health never call Twitch. */
export class TwitchEventSubSubscriptionManager {
  readonly lifecycle = new TwitchLifecycleCoordinator();
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
    return this.lifecycle.run(playerId, action);
  }

  private async context(playerId: string, activation = false, expectedUserId?: string, expectedLogin?: string): Promise<SubscriptionContext> {
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

  private live(subscriptions: TwitchEventSubSubscription[], userId: string, type: PilotEventSubType) {
    const related = subscriptions.filter(item => item.type === type && item.condition.broadcaster_user_id === userId);
    if (related.some(item => !liveStatuses.has(item.status) && !terminalStatuses.has(item.status))) throw conflict(type);
    return related.filter(item => liveStatuses.has(item.status));
  }

  private exact(subscriptions: TwitchEventSubSubscription[], userId: string, callback: string, type: PilotEventSubType, rewardId?: string) {
    // Terminal webhook entries do not represent a live subscription; unknown states remain conflicts.
    const live = this.live(subscriptions, userId, type);
    if (!live.length) return undefined;
    if (live.length !== 1) throw conflict(type);
    const item = live[0]!;
    if (item.version !== '1' || (type === 'channel.chat.message' && item.condition.user_id !== userId)
      || (type === 'channel.channel_points_custom_reward_redemption.add' && (!rewardId || item.condition.reward_id !== rewardId))
      || Object.keys(item.condition).length !== (type === 'channel.chat.message' || type === 'channel.channel_points_custom_reward_redemption.add' ? 2 : 1) ||
      item.transport.method !== 'webhook' || item.transport.callback !== callback) throw conflict(type);
    return item;
  }

  private list(type: PilotEventSubType, signal?: AbortSignal) {
    if (type === 'channel.channel_points_custom_reward_redemption.add') return this.client.listGiftSupremeSubscriptions(signal);
    return type === 'channel.chat.message' ? this.client.listChatSubscriptions(signal)
      : type === 'channel.subscribe' ? this.client.listFavorSubscriptions(signal)
        : type === 'channel.subscription.gift' ? this.client.listGiftSubscriptions(signal) : this.client.listResubSubscriptions(signal);
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
      // Inspect the entire group even when earlier members are absent.
      for (const type of favorTypes) items.push(this.exact(await this.list(type, signal), userId, callback, type));
      if (items.some(item => item?.status === 'webhook_callback_verification_pending')) return 'VERIFICATION_PENDING';
      return items.every(item => item?.status === 'enabled') ? 'ACTIVE' : 'INACTIVE';
    });
  }

  private async ensureExact({ userId, callback, rewardId }: SubscriptionContext, type: PilotEventSubType): Promise<TwitchEventSubSubscription> {
    const existing = this.exact(await this.list(type), userId, callback, type, rewardId);
    if (existing) return existing;
    try {
      const transport = { method: 'webhook' as const, callback, secret: this.config.twitchEventSub!.secret! };
      const created = type === 'channel.channel_points_custom_reward_redemption.add' ? await this.client.createGiftSupremeSubscription({ type, version: '1',
        condition: { broadcaster_user_id: userId, reward_id: rewardId! }, transport })
        : type === 'channel.chat.message' ? await this.client.createChatSubscription({ type, version: '1',
        condition: { broadcaster_user_id: userId, user_id: userId }, transport })
        : type === 'channel.subscribe' ? await this.client.createFavorSubscription({ type, version: '1', condition: { broadcaster_user_id: userId }, transport })
        : type === 'channel.subscription.gift' ? await this.client.createGiftSubscription({ type, version: '1', condition: { broadcaster_user_id: userId }, transport })
          : await this.client.createResubSubscription({ type, version: '1', condition: { broadcaster_user_id: userId }, transport });
      const matching = this.exact([created], userId, callback, type, rewardId);
      if (!matching) throw conflict(type);
      return matching;
    } catch (error) {
      if (!(error instanceof TwitchEventSubApiError) || error.upstreamStatus !== 409) throw error;
      const recovered = this.exact(await this.list(type), userId, callback, type, rewardId);
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
      const resub = await this.ensureExact(context, 'channel.subscription.message');
      return { subscriptions: [beneficiary, gift, resub], status: [beneficiary, gift, resub].every(item => item.status === 'enabled')
        ? 'enabled' : 'webhook_callback_verification_pending' };
    });
    this.favorPending.set(key, job);
    try { return await job; }
    finally { this.favorPending.delete(key); }
  }

  private async disable(playerId: string, type: PilotEventSubType, context?: SubscriptionContext): Promise<PilotChatState> {
    // Removal remains possible after the receiving flag is switched OFF.
    const { userId, callback, rewardId } = context ?? await this.context(playerId);
    const existing = this.exact(await this.list(type), userId, callback, type, rewardId);
    if (!existing) return 'INACTIVE';
    try { await this.client.deleteSubscription(existing.id); }
    catch (error) {
      if (!(error instanceof TwitchEventSubApiError) || error.upstreamStatus !== 404) throw error;
      if (this.exact(await this.list(type), userId, callback, type, rewardId)) throw conflict(type);
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
  async disablePilotChatSubscription(playerId: string, hooks?: { beforeStop: () => Promise<void>; afterStop: () => Promise<void> }) {
    if (!hooks) return this.disablePilotSubscription(playerId, 'channel.chat.message');
    // Keep the Giveaway guard, remote removal and credential update in the same Player lifecycle queue.
    return this.serial(playerId, async () => {
      await hooks.beforeStop();
      const context = await this.context(playerId);
      await this.disable(playerId, 'channel.chat.message', context);
      if (this.exact(await this.list('channel.chat.message'), context.userId, context.callback, 'channel.chat.message'))
        throw conflict('channel.chat.message');
      await hooks.afterStop();
      return 'INACTIVE' as const;
    });
  }
  async disablePilotFavorSubscription(playerId: string) { return this.disablePilotSubscription(playerId, 'FAVOR'); }

  // Gift calls these ONLY while holding lifecycle.run; adding another queue here would deadlock.
  async inspectGiftSupremeUnlocked(playerId: string, rewardId: string, signal?: AbortSignal) {
    const { userId, callback } = await this.context(playerId, true);
    const item = this.exact(await this.list('channel.channel_points_custom_reward_redemption.add', signal), userId, callback, 'channel.channel_points_custom_reward_redemption.add', rewardId);
    return !item ? 'INACTIVE' as const : item.status === 'enabled' ? 'ACTIVE' as const : 'VERIFICATION_PENDING' as const;
  }
  async ensureGiftSupremeUnlocked(playerId: string, rewardId: string, expectedUserId: string, expectedLogin: string) {
    return this.ensureExact({ ...await this.context(playerId, true, expectedUserId, expectedLogin), rewardId }, 'channel.channel_points_custom_reward_redemption.add');
  }
  async disableGiftSupremeUnlocked(playerId: string, rewardId: string) {
    return this.disable(playerId, 'channel.channel_points_custom_reward_redemption.add', { ...await this.context(playerId), rewardId });
  }
  async assertGiftSupremeAbsentUnlocked(playerId: string) {
    const { userId } = await this.context(playerId);
    if (this.live(await this.list('channel.channel_points_custom_reward_redemption.add'), userId,
      'channel.channel_points_custom_reward_redemption.add').length)
      throw conflict('channel.channel_points_custom_reward_redemption.add');
  }

  async unlinkPilotIdentity(playerId: string, removeIdentity: () => Promise<void>) {
    return this.serial(playerId, () => this.unlinkPilotIdentityUnlocked(playerId, removeIdentity));
  }
  /** Gift phase B already holds the shared Player queue. Never acquire it again here. */
  async unlinkPilotIdentityUnlocked(playerId: string, removeIdentity: () => Promise<void>) {
    const context = await this.context(playerId);
    await this.disable(playerId, 'channel.chat.message', context);
    for (const type of favorTypes) await this.disable(playerId, type, context);
    await removeIdentity();
  }
}
