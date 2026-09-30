import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { AppError } from '../../api/errors.js';
import type { GiveawayBridgeProof, GiveawayService } from '../giveaway/giveaway-service.js';
import { oneLine } from '../../domain/giveaway/giveaway.js';
import { TWITCH_GIVEAWAY_SCOPES } from './twitch-giveaway-contract.js';
import { TwitchGiveawayCredentialCipher } from '../../infrastructure/twitch/twitch-giveaway-credential-cipher.js';
import { TwitchGiveawayAccessTokenProvider } from '../../infrastructure/twitch/twitch-giveaway-access-token-provider.js';
import { TwitchGiveawayChatClient, TwitchGiveawaySendError } from '../../infrastructure/twitch/twitch-giveaway-chat-client.js';
import type { TwitchEventSubSubscriptionManager } from './twitch-eventsub-subscription-manager.js';

const unavailable = () => new AppError('Bridge Giveaway Twitch indisponible.', 503, 'TWITCH_GIVEAWAY_UNAVAILABLE');
export type GiveawayAuthorization = { playerId: string; twitchUserId: string; login: string; refreshToken: string;
  accessToken: string; scopes: string[]; expiresIn: number; linkedAt: Date };

/** Credential, remote subscription proof and scoped outbound for Giveaway only. */
export class TwitchGiveawayManager implements GiveawayBridgeProof {
  readonly cipher?: TwitchGiveawayCredentialCipher;
  readonly tokens?: TwitchGiveawayAccessTokenProvider;
  readonly chat?: TwitchGiveawayChatClient;
  private core?: GiveawayService;
  constructor(private readonly db: PrismaClient, private readonly config: AppConfig,
    private readonly subscriptions?: TwitchEventSubSubscriptionManager, request: typeof fetch = fetch) {
    if (config.twitchGiftSupreme?.credentialKey) this.cipher = new TwitchGiveawayCredentialCipher(config.twitchGiftSupreme.credentialKey);
    if (this.cipher && config.twitch?.clientId && config.twitch.clientSecret) {
      this.tokens = new TwitchGiveawayAccessTokenProvider(db, this.cipher, config.twitch.clientId, config.twitch.clientSecret, request);
      this.chat = new TwitchGiveawayChatClient(config.twitch.clientId, this.tokens, request);
    }
  }
  attachCore(core: GiveawayService) { this.core = core; }
  get available() { return Boolean(this.chat && this.config.twitch?.redirectUri && this.subscriptions?.activationAvailable); }

  async status() {
    const empty = { available: this.available, authorized: false, active: false, pending: false };
    if (!this.available) return empty;
    try {
      const rows = await this.db.twitchGiveawayCredential.findMany({ take: 2 });
      if (rows.length > 1) return { ...empty, error: 'CREDENTIAL_CONFLICT' };
      const row = rows[0];
      if (!row) return empty;
      if (!row.enabled) return { ...empty, authorized: true };
      const linked = await this.db.twitchIdentity.findUnique({ where: { playerId: row.playerId } });
      if (!linked || linked.twitchUserId !== row.twitchUserId) return { ...empty, authorized: true, error: 'IDENTITY_CHANGED' };
      await this.tokens!.getToken(row.playerId, AbortSignal.timeout(3_000));
      const subscription = await this.subscriptions!.inspectPilotChatSubscription(row.playerId, AbortSignal.timeout(3_000));
      return { ...empty, authorized: true, active: subscription === 'ACTIVE', pending: subscription === 'VERIFICATION_PENDING' };
    } catch { return { ...empty, error: 'REMOTE_UNAVAILABLE' }; }
  }
  async assertActive() {
    const state = await this.status();
    if (!state.active) throw new AppError('Le bridge Giveaway Twitch doit être actif pour ouvrir une session.', 409, 'GIVEAWAY_BRIDGE_INACTIVE');
  }

  async authorize(input: GiveawayAuthorization) {
    if (!this.available) throw unavailable();
    if (!TWITCH_GIVEAWAY_SCOPES.every(scope => input.scopes.includes(scope)))
      throw new AppError('Permissions Giveaway Twitch incomplètes.', 403, 'TWITCH_GIVEAWAY_SCOPES_MISSING');
    const linked = await this.db.twitchIdentity.findUnique({ where: { playerId: input.playerId } });
    if (!linked || linked.twitchUserId !== input.twitchUserId || linked.login.trim().toLowerCase() !== input.login.trim().toLowerCase()
      || +linked.linkedAt !== +input.linkedAt) throw new AppError('Identité Twitch liée modifiée.', 409, 'TWITCH_ACCOUNT_MISMATCH');
    const encryptedRefreshToken = this.cipher!.encrypt(input.refreshToken, input.playerId, input.twitchUserId);
    const row = await this.db.twitchGiveawayCredential.upsert({ where: { playerId: input.playerId },
      create: { playerId: input.playerId, twitchUserId: input.twitchUserId, encryptedRefreshToken, scopes: input.scopes, enabled: true },
      update: { twitchUserId: input.twitchUserId, encryptedRefreshToken, scopes: input.scopes, enabled: true,
        authorizedAt: new Date(), revision: { increment: 1 } } });
    this.tokens!.prime(row, input.accessToken, input.expiresIn);
    await this.subscriptions!.ensurePilotChatSubscription(input.playerId, input.twitchUserId);
    return this.status();
  }
  async enable(playerId: string) {
    if (!this.available) throw unavailable();
    const row = await this.db.twitchGiveawayCredential.findUnique({ where: { playerId } });
    if (!row) throw new AppError('Autorisez Giveaway avec Twitch.', 409, 'TWITCH_GIVEAWAY_AUTH_REQUIRED');
    await this.tokens!.getToken(playerId);
    await this.subscriptions!.ensurePilotChatSubscription(playerId, row.twitchUserId);
    await this.db.twitchGiveawayCredential.update({ where: { playerId }, data: { enabled: true } });
    return this.status();
  }
  async disable(playerId: string) {
    if (await this.db.giveawaySession.findFirst({ where: { status: 'OPEN', origin: 'NATIVE' }, select: { id: true } }))
      throw new AppError('Fermez le Giveaway avant de désactiver le bridge.', 409, 'GIVEAWAY_SESSION_OPEN');
    await this.db.twitchGiveawayCredential.updateMany({ where: { playerId }, data: { enabled: false } });
    return this.status();
  }

  async queueReply(sourceEventId: string, kind: 'WISH' | 'STATS' | 'COMMAND', text: string, sessionId?: string | null) {
    const safeText = oneLine(text);
    if (!safeText) return null;
    await this.db.giveawayAnnouncement.createMany({ data: [{ sourceEventId, kind, text: safeText, sessionId: sessionId ?? null }], skipDuplicates: true });
    const row = await this.db.giveawayAnnouncement.findUniqueOrThrow({ where: { sourceEventId } });
    if (row.text !== safeText || row.kind !== kind) throw new AppError('Réponse Giveaway incohérente.', 409, 'GIVEAWAY_REPLY_CONFLICT');
    return row.id;
  }

  /** Reservation is durable before the network call. RESERVED after a crash is ambiguous, never auto-resent. */
  async sendAnnouncement(id: string, retry = false) {
    const row = await this.db.giveawayAnnouncement.findUnique({ where: { id } });
    if (!row) throw new AppError('Annonce Giveaway introuvable.', 404, 'GIVEAWAY_ANNOUNCEMENT_NOT_FOUND');
    if (row.state === 'SENT') { await this.core?.settleDeferred(); return { state: row.state }; }
    if (row.state === 'AMBIGUOUS' || row.state === 'RESERVED') return { state: row.state };
    if (retry && row.state !== 'FAILED' || !retry && row.state !== 'PENDING') return { state: row.state };
    const credential = await this.db.twitchGiveawayCredential.findFirst({ where: { enabled: true } });
    if (!credential || !this.chat || !this.available || !(await this.status()).active) {
      await this.db.giveawayAnnouncement.updateMany({ where: { id, state: row.state }, data: { state: 'FAILED', errorCode: 'BRIDGE_INACTIVE' } });
      return { state: 'FAILED' as const, error: 'BRIDGE_INACTIVE' };
    }
    const reserved = await this.db.giveawayAnnouncement.updateMany({ where: { id, state: row.state },
      data: { state: 'RESERVED', attempts: { increment: 1 }, reservedAt: new Date(), errorCode: null } });
    if (!reserved.count) return { state: 'RESERVED' as const };
    let state: 'SENT' | 'FAILED' | 'AMBIGUOUS';
    let messageId: string | undefined;
    let errorCode: string | undefined;
    try { messageId = await this.chat.send(credential.playerId, credential.twitchUserId, row.text); state = 'SENT'; }
    catch (error) {
      state = error instanceof TwitchGiveawaySendError && error.certainty === 'CERTAIN' || error instanceof AppError ? 'FAILED' : 'AMBIGUOUS';
      errorCode = error instanceof TwitchGiveawaySendError ? error.reason : error instanceof AppError ? error.code : 'UNKNOWN';
    }
    await this.db.giveawayAnnouncement.updateMany({ where: { id, state: 'RESERVED' }, data: {
      state, twitchMessageId: messageId ?? null, errorCode: errorCode ?? null, sentAt: state === 'SENT' ? new Date() : null,
    } });
    if (state !== 'AMBIGUOUS') await this.core?.settleDeferred();
    return { state, ...(errorCode ? { error: errorCode } : {}), ...(messageId ? { messageId } : {}) };
  }

  async sendSessionMilestones(sessionId: string) {
    const rows = await this.db.giveawayAnnouncement.findMany({ where: { sessionId, kind: { in: ['OPEN', 'RESULT', 'RANKING'] } } });
    const order = { OPEN: 0, RESULT: 1, RANKING: 2 } as const;
    for (const row of rows.sort((a, b) => order[a.kind as keyof typeof order] - order[b.kind as keyof typeof order]))
      await this.sendAnnouncement(row.id);
  }
}
