import type { PrismaClient, TwitchGiftSupremeCredential } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { AppError } from '../../api/errors.js';
import { TwitchGiftCredentialCipher } from '../../infrastructure/twitch/twitch-gift-credential-cipher.js';
import { TwitchGiftAccessTokenProvider } from '../../infrastructure/twitch/twitch-gift-access-token-provider.js';
import { TwitchGiftHelixClient, giftRewardMatches, type TwitchGiftReward } from '../../infrastructure/twitch/twitch-gift-helix-client.js';
import type { TwitchEventSubSubscriptionManager } from './twitch-eventsub-subscription-manager.js';
import { TWITCH_GIFT_SUPREME_SCOPES, type GiftSupremeStatusError } from './twitch-gift-supreme-contract.js';
import { GIFT_SUPREME_EVENT_TYPE } from '../gift-supreme/gift-supreme-service.js';

const normalize = (value: string) => value.trim().normalize('NFKC').toLowerCase();
const manualTitle = (value: string) => normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('gift supreme');
const unavailable = () => new AppError('Gift Suprême Twitch indisponible. Réessayez plus tard.', 503, 'TWITCH_GIFT_UNAVAILABLE');
const conflict = () => new AppError('Récompense Gift Suprême incompatible ; contrôle opérateur nécessaire.', 409, 'TWITCH_GIFT_CONFLICT');
const manualConflict = () => new AppError('Désactivez ou supprimez l’ancienne récompense Gift Suprême manuelle dans Twitch, puis réessayez.', 409, 'TWITCH_GIFT_MANUAL_REWARD_CONFLICT');
const pendingRedemptions = () => new AppError('Des Gifts Suprêmes sont encore en cours de traitement. Réessayez dans quelques instants.', 503, 'TWITCH_GIFT_PENDING_REDEMPTIONS');
const shutdownInProgress = () => new AppError('La désactivation Gift Suprême est en cours. Réessayez dans quelques instants.', 409, 'TWITCH_GIFT_SHUTDOWN_IN_PROGRESS');
export type GiftSupremeStatus = { giftSupremeAvailable: boolean; giftSupremeAuthorized: boolean; giftSupremeActive: boolean;
  giftSupremePending: boolean; giftSupremeDisabling?: boolean; giftSupremeError?: GiftSupremeStatusError };
export type GiftSupremeAuthorization = { playerId: string; twitchUserId: string; login: string; refreshToken: string;
  accessToken: string; scopes: string[]; expiresIn: number; linkedAt: Date };

/** Explicit lifecycle only. Gift shares the manager's existing queue; unlocked methods never acquire it again. */
export class TwitchGiftSupremeManager {
  readonly cipher: TwitchGiftCredentialCipher | undefined;
  readonly tokens: TwitchGiftAccessTokenProvider | undefined;
  readonly helix: TwitchGiftHelixClient | undefined;
  // An activation already running may finish before phase A. Queued activations cannot reopen the reward during shutdown.
  private readonly shuttingDown = new Set<string>();
  constructor(private readonly db: PrismaClient, private readonly config: AppConfig, readonly subscriptions: TwitchEventSubSubscriptionManager,
    request: typeof fetch = fetch, private readonly now: () => Date = () => new Date()) {
    this.cipher = config.twitchGiftSupreme?.credentialKey ? new TwitchGiftCredentialCipher(config.twitchGiftSupreme.credentialKey) : undefined;
    if (this.cipher && config.twitch?.clientId && config.twitch.clientSecret) {
      this.tokens = new TwitchGiftAccessTokenProvider(db, this.cipher, config.twitch.clientId, config.twitch.clientSecret, request, () => +this.now());
      this.helix = new TwitchGiftHelixClient(config.twitch.clientId, this.tokens, request);
    }
  }
  get available() {
    return Boolean(this.config.twitchGiftSupreme?.enabled && this.helix && this.config.twitch?.redirectUri && this.subscriptions.activationAvailable);
  }
  private async context(playerId: string, expectedUserId?: string, expectedLogin?: string) {
    if (!this.config.twitch?.pilotPlayerIds.includes(playerId)) throw new AppError('Pilote Twitch non autorisé.', 403, 'TWITCH_PILOT_FORBIDDEN');
    const linked = await this.db.twitchIdentity.findUnique({ where: { playerId } });
    if (!linked || expectedUserId && linked.twitchUserId !== expectedUserId || expectedLogin && normalize(linked.login) !== normalize(expectedLogin))
      throw new AppError('Identité Twitch liée modifiée.', 409, 'TWITCH_ACCOUNT_MISMATCH');
    return linked;
  }
  async authorize(input: GiftSupremeAuthorization) {
    if (!this.available) throw unavailable();
    if (this.shuttingDown.has(input.playerId)) throw shutdownInProgress();
    return this.subscriptions.lifecycle.run(input.playerId, async () => {
      if (this.shuttingDown.has(input.playerId)) throw shutdownInProgress();
      const linked = await this.context(input.playerId, input.twitchUserId, input.login);
      if (+linked.linkedAt !== +input.linkedAt) throw new AppError('Identité Twitch liée modifiée.', 409, 'TWITCH_ACCOUNT_MISMATCH');
      if (!TWITCH_GIFT_SUPREME_SCOPES.every(scope => input.scopes.includes(scope))) throw new AppError('Permissions Gift Suprême incomplètes.', 403, 'TWITCH_GIFT_SCOPES_MISSING');
      const encryptedRefreshToken = this.cipher!.encrypt(input.refreshToken, input.playerId, input.twitchUserId);
      const row = await this.db.twitchGiftSupremeCredential.upsert({ where: { playerId: input.playerId },
        create: { playerId: input.playerId, twitchUserId: input.twitchUserId, encryptedRefreshToken, scopes: input.scopes, authorizedAt: this.now() },
        update: { twitchUserId: input.twitchUserId, encryptedRefreshToken, scopes: input.scopes, authorizedAt: this.now(), revision: { increment: 1 } } });
      this.tokens!.prime(row, input.accessToken, input.expiresIn);
      return this.ensureUnlocked(input.playerId);
    });
  }
  async ensure(playerId: string) {
    if (!this.available) throw unavailable();
    if (this.shuttingDown.has(playerId)) throw shutdownInProgress();
    return this.subscriptions.lifecycle.run(playerId, () => {
      if (this.shuttingDown.has(playerId)) throw shutdownInProgress();
      return this.ensureUnlocked(playerId);
    });
  }
  private async rewards(row: TwitchGiftSupremeCredential, signal?: AbortSignal) {
    const manageable = await this.helix!.rewards(row.playerId, row.twitchUserId, true, signal);
    const visible = await this.helix!.rewards(row.playerId, row.twitchUserId, false, signal);
    if (visible.some(reward => reward.is_enabled && manualTitle(reward.title) && !manageable.some(owned => owned.id === reward.id))) throw manualConflict();
    return manageable;
  }
  private recoverReward(row: TwitchGiftSupremeCredential, rewards: TwitchGiftReward[]) {
    if (row.rewardId) return rewards.find(reward => reward.id === row.rewardId);
    const exact = rewards.filter(giftRewardMatches);
    if (exact.length > 1) throw conflict();
    return exact[0];
  }
  private async ensureUnlocked(playerId: string) {
    const linked = await this.context(playerId);
    const row = await this.db.twitchGiftSupremeCredential.findUnique({ where: { playerId } });
    if (!row || row.twitchUserId !== linked.twitchUserId) throw new AppError('Autorisation Gift Suprême nécessaire.', 409, 'TWITCH_GIFT_CREDENTIAL_INVALID');
    await this.tokens!.getToken(playerId);
    const rewards = await this.rewards(row);
    let reward = this.recoverReward(row, rewards);
    // A lost/deleted stored reward is not permission to create a duplicate without inspection.
    if (!reward && row.rewardId) {
      const exact = rewards.filter(giftRewardMatches); if (exact.length > 1) throw conflict(); reward = exact[0];
    }
    if (!reward) reward = await this.helix!.createReward(playerId, row.twitchUserId);
    if (!giftRewardMatches(reward) || !reward.is_enabled) reward = await this.helix!.updateReward(playerId, row.twitchUserId, reward.id, true);
    if (!giftRewardMatches(reward) || !reward.is_enabled) throw conflict();
    await this.context(playerId, row.twitchUserId, linked.login);
    const saved = await this.db.twitchGiftSupremeCredential.updateMany({ where: { playerId, twitchUserId: row.twitchUserId }, data: { rewardId: reward.id } });
    if (!saved.count) throw unavailable();
    const subscription = await this.subscriptions.ensureGiftSupremeUnlocked(playerId, reward.id, row.twitchUserId, normalize(linked.login));
    return { giftSupremeActive: subscription.status === 'enabled', giftSupremePending: subscription.status === 'webhook_callback_verification_pending' };
  }
  async status(playerId: string, signal?: AbortSignal): Promise<GiftSupremeStatus> {
    const state: GiftSupremeStatus = { giftSupremeAvailable: this.available, giftSupremeAuthorized: false, giftSupremeActive: false, giftSupremePending: false };
    if (!this.available) return state;
    try {
      return await this.subscriptions.lifecycle.run(playerId, async () => {
        signal?.throwIfAborted(); const linked = await this.context(playerId);
        const row = await this.db.twitchGiftSupremeCredential.findUnique({ where: { playerId } });
        if (!row) return state;
        state.giftSupremeAuthorized = true;
        if (row.twitchUserId !== linked.twitchUserId) throw new AppError('Autorisation Gift invalide.', 503, 'TWITCH_GIFT_CREDENTIAL_INVALID');
        await this.tokens!.getToken(playerId, signal);
        const manageable = await this.rewards(row, signal), reward = row.rewardId && manageable.find(item => item.id === row.rewardId);
        if (!reward) return state;
        if (!giftRewardMatches(reward)) throw conflict();
        if (!reward.is_enabled) state.giftSupremeDisabling = true;
        const subscription = await this.subscriptions.inspectGiftSupremeUnlocked(playerId, reward.id, signal);
        state.giftSupremeActive = reward.is_enabled && subscription === 'ACTIVE';
        state.giftSupremePending = reward.is_enabled && subscription === 'VERIFICATION_PENDING';
        return state;
      });
    } catch (error) {
      const code = error instanceof AppError ? error.code : '';
      return { ...state, giftSupremeActive: false, giftSupremePending: false,
        giftSupremeError: code === 'TWITCH_GIFT_MANUAL_REWARD_CONFLICT' ? 'MANUAL_REWARD_CONFLICT' : code === 'TWITCH_GIFT_CREDENTIAL_INVALID' ? 'CREDENTIAL_INVALID'
          : ['TWITCH_GIFT_CONFLICT', 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT'].includes(code) ? 'CONFLICT' : 'UNAVAILABLE' };
    }
  }
  async disable(playerId: string) { return this.shutdown(playerId); }
  async unlink(playerId: string, removeIdentity: () => Promise<void>) {
    return this.shutdown(playerId, () => this.subscriptions.unlinkPilotIdentityUnlocked(playerId, removeIdentity));
  }
  private async shutdown(playerId: string, afterCleanup?: () => Promise<void>) {
    if (this.shuttingDown.has(playerId)) throw shutdownInProgress();
    this.shuttingDown.add(playerId);
    try {
      const row = await this.subscriptions.lifecycle.run(playerId, () => this.quiesceUnlocked(playerId));
      // Reenter, rather than nesting, so deliveries/retries already queued during quiesce drain first.
      return await this.subscriptions.lifecycle.run(playerId, async () => {
        if (row) await this.finalCleanupUnlocked(row);
        else if (afterCleanup) {
          const linked = await this.context(playerId);
          await this.assertLocalSettled(linked.twitchUserId, null);
          await this.subscriptions.assertGiftSupremeAbsentUnlocked(playerId);
        }
        if (afterCleanup) await afterCleanup();
        return { giftSupremeActive: false, giftSupremePending: false };
      });
    } finally { this.shuttingDown.delete(playerId); }
  }
  private async quiesceUnlocked(playerId: string): Promise<TwitchGiftSupremeCredential | null> {
    if (!this.config.twitch?.pilotPlayerIds.includes(playerId)) throw new AppError('Pilote Twitch non autorisé.', 403, 'TWITCH_PILOT_FORBIDDEN');
    const row = await this.db.twitchGiftSupremeCredential.findUnique({ where: { playerId } });
    if (!row) return null;
    const linked = await this.context(playerId);
    if (!this.helix || !this.tokens || !this.subscriptions.managementAvailable) throw unavailable();
    if (row.twitchUserId !== linked.twitchUserId) throw conflict();
    await this.tokens.getToken(playerId);
    const manageable = await this.helix.rewards(playerId, row.twitchUserId, true);
    const reward = this.recoverReward(row, manageable);
    if (!reward) {
      if (row.rewardId) throw conflict();
      if (manageable.some(item => manualTitle(item.title))) throw conflict();
      await this.subscriptions.assertGiftSupremeAbsentUnlocked(playerId);
      return row; // Authorization failed before reward creation; no reward/subscription to stop.
    }
    if (!giftRewardMatches(reward)) throw conflict();
    const disabled = await this.helix.updateReward(playerId, row.twitchUserId, reward.id, false);
    if (disabled.is_enabled || !giftRewardMatches(disabled)) throw conflict();
    if (!row.rewardId) {
      const saved = await this.db.twitchGiftSupremeCredential.updateMany({ where: { playerId, twitchUserId: row.twitchUserId }, data: { rewardId: reward.id } });
      if (!saved.count) throw unavailable();
    }
    return { ...row, rewardId: reward.id };
  }
  private async assertRewardDisabled(row: TwitchGiftSupremeCredential) {
    const manageable = await this.helix!.rewards(row.playerId, row.twitchUserId, true);
    if (!row.rewardId) {
      if (manageable.some(item => manualTitle(item.title))) throw conflict();
      return;
    }
    const reward = manageable.find(item => item.id === row.rewardId);
    if (!reward || reward.is_enabled || !giftRewardMatches(reward)) throw conflict();
  }
  private async assertLocalSettled(broadcasterId: string, rewardId: string | null) {
    // Core proofs have no broadcaster field. Signed delivery receipts scope historical reward proofs to this broadcaster.
    const pending = await this.db.$queryRaw<{ id: string }[]>`
      SELECT core.id FROM twitch_event_receipts core
      WHERE core.event_type = ${GIFT_SUPREME_EVENT_TYPE}
        AND core.payload_minimal->>'localOutcome' IN ('SUCCESS', 'INVALID')
        AND (core.payload_minimal->'proof'->>'rewardId' = ${rewardId}
          OR EXISTS (SELECT 1 FROM twitch_event_receipts delivery
            WHERE delivery.event_type = ${GIFT_SUPREME_EVENT_TYPE}
              AND delivery.payload_minimal->>'broadcasterId' = ${broadcasterId}
              AND core.external_event_id = 'gift-supreme:' || (delivery.payload_minimal->>'redemptionId')))
        AND (core.payload_minimal->'remote'->>'settlementState') IS DISTINCT FROM
          CASE core.payload_minimal->>'localOutcome' WHEN 'SUCCESS' THEN 'FULFILLED' ELSE 'CANCELED' END
      LIMIT 1`;
    if (pending.length) throw pendingRedemptions();
  }
  private async finalCleanupUnlocked(expected: TwitchGiftSupremeCredential) {
    const row = await this.db.twitchGiftSupremeCredential.findUnique({ where: { playerId: expected.playerId } });
    if (!row || row.twitchUserId !== expected.twitchUserId || row.rewardId !== expected.rewardId) throw conflict();
    await this.context(row.playerId, row.twitchUserId);
    await this.assertRewardDisabled(row);
    if (row.rewardId && await this.helix!.hasUnfulfilledRedemptions(row.playerId, row.twitchUserId, row.rewardId)) throw pendingRedemptions();
    await this.assertLocalSettled(row.twitchUserId, row.rewardId);
    if (row.rewardId) await this.subscriptions.disableGiftSupremeUnlocked(row.playerId, row.rewardId);
    await this.subscriptions.assertGiftSupremeAbsentUnlocked(row.playerId);
    await this.assertRewardDisabled(row);
    const deleted = await this.db.twitchGiftSupremeCredential.deleteMany({ where: { playerId: row.playerId, twitchUserId: row.twitchUserId, rewardId: row.rewardId } });
    if (deleted.count !== 1) throw conflict();
    this.tokens!.invalidate(row.playerId);
  }
  async withRuntime<T>(broadcasterId: string, rewardId: string, action: (row: TwitchGiftSupremeCredential, helix: TwitchGiftHelixClient) => Promise<T>) {
    if (!this.available) return { action: 'IGNORE' as const };
    const found = await this.db.twitchGiftSupremeCredential.findUnique({ where: { twitchUserId: broadcasterId } });
    if (!found || found.rewardId !== rewardId || !this.config.twitch!.pilotPlayerIds.includes(found.playerId)) return { action: 'IGNORE' as const };
    return this.subscriptions.lifecycle.run(found.playerId, async () => {
      const linked = await this.db.twitchIdentity.findUnique({ where: { playerId: found.playerId } });
      if (!linked || linked.twitchUserId !== broadcasterId) return { action: 'IGNORE' as const };
      const row = await this.db.twitchGiftSupremeCredential.findUnique({ where: { playerId: linked.playerId } });
      if (!row || row.rewardId !== rewardId || row.twitchUserId !== broadcasterId) return { action: 'IGNORE' as const };
      // The signed delivery plus stored credential/reward identity is sufficient. Remote state can change after redemption.
      return action(row, this.helix!);
    });
  }
  async withRecovery<T>(playerId: string, action: (row: TwitchGiftSupremeCredential, helix: TwitchGiftHelixClient) => Promise<T>) {
    if (!this.available) throw unavailable();
    return this.subscriptions.lifecycle.run(playerId, async () => {
      const linked = await this.context(playerId);
      const row = await this.db.twitchGiftSupremeCredential.findUnique({ where: { playerId } });
      if (!row?.rewardId || row.twitchUserId !== linked.twitchUserId) throw unavailable();
      return action(row, this.helix!);
    });
  }
}
