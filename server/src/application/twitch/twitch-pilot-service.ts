import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import type { TwitchEventSubSubscriptionManager } from './twitch-eventsub-subscription-manager.js';
import type { GiftSupremeStatus, TwitchGiftSupremeManager } from './twitch-gift-supreme-manager.js';
import type { TwitchGiftSupremeRuntime } from './twitch-gift-supreme-runtime.js';
import { TWITCH_GIFT_SUPREME_SCOPES } from './twitch-gift-supreme-contract.js';
import { TWITCH_GIVEAWAY_SCOPES } from './twitch-giveaway-contract.js';
import type { TwitchGiveawayManager } from './twitch-giveaway-manager.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const normalizeLogin = (value: string) => value.trim().normalize('NFKC').toLowerCase();
const twitchKeys = createRemoteJWKSet(new URL('https://id.twitch.tv/oauth2/keys'));
export const TWITCH_RUNTIME_SCOPES = ['openid', 'user:read:chat', 'user:bot', 'channel:bot'] as const;
export const TWITCH_FAVOR_SCOPES = ['openid', 'channel:read:subscriptions'] as const;
export type TwitchOAuthPurpose = 'LINK_IDENTITY' | 'AUTHORIZE_RUNTIME' | 'AUTHORIZE_FAVOR_SUBSCRIPTIONS' | 'AUTHORIZE_GIFT_SUPREME' | 'AUTHORIZE_GIVEAWAY';
export function twitchOAuthPurpose(state: string | undefined): TwitchOAuthPurpose {
  if (state && /^runtime_[A-Za-z0-9_-]{43}$/.test(state)) return 'AUTHORIZE_RUNTIME';
  if (state && /^favor_[A-Za-z0-9_-]{43}$/.test(state)) return 'AUTHORIZE_FAVOR_SUBSCRIPTIONS';
  if (state && /^gift_[A-Za-z0-9_-]{43}$/.test(state)) return 'AUTHORIZE_GIFT_SUPREME';
  if (state && /^giveaway_[A-Za-z0-9_-]{43}$/.test(state)) return 'AUTHORIZE_GIVEAWAY';
  if (state && /^[A-Za-z0-9_-]{43}$/.test(state)) return 'LINK_IDENTITY';
  throw new AppError('État OAuth invalide.', 400, 'TWITCH_STATE_INVALID');
}

export async function verifyTwitchIdToken(token: string, clientId: string, nonceHash: string, keys: JWTVerifyGetKey = twitchKeys) {
  const { payload } = await jwtVerify(token, keys, {
    issuer: 'https://id.twitch.tv/oauth2', audience: clientId, algorithms: ['RS256'],
    requiredClaims: ['exp', 'iat', 'sub', 'nonce'],
    maxTokenAge: '10m',
  });
  if (typeof payload.sub !== 'string' || !/^[0-9]+$/.test(payload.sub) ||
      typeof payload.nonce !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(payload.nonce))
    throw new AppError('Identité OIDC Twitch invalide.', 502, 'TWITCH_IDENTITY_INVALID');
  const supplied = Buffer.from(hash(payload.nonce), 'hex');
  const expected = Buffer.from(nonceHash, 'hex');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
    throw new AppError('Nonce OIDC Twitch invalide.', 502, 'TWITCH_NONCE_INVALID');
  return payload.sub;
}

export class TwitchPilotService {
  private readonly settings: NonNullable<AppConfig['twitch']>;
  private readonly eventSubConfigured: boolean;
  constructor(private readonly db: PrismaClient, private readonly getPlayer: GetCurrentPlayer, config: AppConfig,
    private readonly keys: JWTVerifyGetKey = twitchKeys, private readonly subscriptions?: TwitchEventSubSubscriptionManager,
    private readonly gift?: TwitchGiftSupremeManager, private readonly giftRuntime?: TwitchGiftSupremeRuntime,
    private readonly giveaway?: TwitchGiveawayManager) {
    this.settings = config.twitch ?? { pilotPlayerIds: [], pilotLogin: 'kichnifou' };
    this.eventSubConfigured = Boolean(config.twitchEventSub?.enabled || config.twitchEventSub?.callbackUrl || config.twitchEventSub?.secret);
  }

  private oauthReady() {
    return Boolean(this.settings.clientId && this.settings.clientSecret && this.settings.redirectUri);
  }

  private runtimeReady() { return this.oauthReady() && Boolean(this.subscriptions?.activationAvailable); }

  private async pilot(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    if (!this.settings.pilotPlayerIds.includes(player.id)) throw new AppError('Ce pilote est rÃ©servÃ© au compte autorisÃ©.', 403, 'TWITCH_PILOT_FORBIDDEN');
    return player;
  }

  async requirePilot(identity: AuthenticatedIdentity) { return this.pilot(identity); }

  async status(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    const eligible = this.settings.pilotPlayerIds.includes(player.id);
    const linked = eligible ? await this.db.twitchIdentity.findUnique({ where: { playerId: player.id } }) : null;
    const lastRun = linked ? await this.db.migrationRun.findFirst({ where: { playerId: player.id }, orderBy: { completedAt: 'desc' }, select: { completedAt: true, snapshotHash: true } }) : null;
    const available = eligible && Boolean(linked) && this.runtimeReady();
    // Both queued inspections share one deadline; a slow Chat read cannot add another three seconds for Faveur.
    const signal = available ? AbortSignal.timeout(3_000) : undefined;
    const inspect = async (read: () => Promise<'INACTIVE' | 'VERIFICATION_PENDING' | 'ACTIVE'>) => {
      if (!signal) return { available: false, active: false, pending: false };
      let cancel!: () => void;
      try {
        const state = await Promise.race([read(), new Promise<never>((_resolve, reject) => {
          cancel = () => reject(new Error('Twitch status timed out'));
          signal.addEventListener('abort', cancel, { once: true });
          if (signal.aborted) cancel();
        })]);
        return { available: true, active: state === 'ACTIVE', pending: state === 'VERIFICATION_PENDING' };
      } catch (error) {
        return { available: false, active: false, pending: false,
          error: error instanceof AppError && error.code === 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' ? 'CONFLICT' as const : 'UNAVAILABLE' as const };
      } finally { signal.removeEventListener('abort', cancel); }
    };
    const giftEmpty: GiftSupremeStatus = { giftSupremeAvailable: false, giftSupremeAuthorized: false, giftSupremeActive: false, giftSupremePending: false };
    const inspectGift = async (): Promise<GiftSupremeStatus> => {
      if (!eligible || !linked || !this.gift?.available || !signal) return giftEmpty;
      let cancel!: () => void;
      try {
        return await Promise.race([this.gift.status(player.id, signal), new Promise<never>((_resolve, reject) => {
          cancel = () => reject(new Error('Gift status deadline')); signal.addEventListener('abort', cancel, { once: true }); if (signal.aborted) cancel();
        })]);
      } catch { return { ...giftEmpty, giftSupremeAvailable: true, giftSupremeError: 'UNAVAILABLE' }; }
      finally { signal.removeEventListener('abort', cancel); }
    };
    const [chat, favor, gift] = await Promise.all([
      inspect(() => this.subscriptions!.inspectPilotChatSubscription(player.id, signal)),
      inspect(() => this.subscriptions!.inspectPilotFavorSubscription(player.id, signal)),
      inspectGift(),
    ]);
    return {
      pilotAvailable: eligible && this.oauthReady(),
      eligible,
      linked: linked ? { login: linked.login, displayName: linked.displayName, linkedAt: linked.linkedAt.toISOString() } : null,
      snapshotAvailable: eligible && Boolean(linked) && this.oauthReady(),
      runtimeAuthorizationAvailable: eligible && Boolean(linked) && this.oauthReady(),
      runtimeSubscriptionAvailable: chat.available, runtimeChatActive: chat.active, runtimeChatPending: chat.pending,
      ...(chat.error ? { runtimeChatError: chat.error } : {}),
      favorSubscriptionAvailable: favor.available, favorSubscriptionActive: favor.active, favorSubscriptionPending: favor.pending,
      ...(favor.error ? { favorSubscriptionError: favor.error } : {}),
      ...gift,
      lastImport: lastRun ? { at: lastRun.completedAt.toISOString(), snapshotHash: lastRun.snapshotHash } : null,
    };
  }

  async start(identity: AuthenticatedIdentity) {
    return this.startForPurpose(identity, 'LINK_IDENTITY');
  }

  async startRuntime(identity: AuthenticatedIdentity) {
    await this.pilot(identity);
    if (!this.runtimeReady()) throw new AppError('Réception du chat Twitch indisponible.', 503, 'TWITCH_RUNTIME_UNAVAILABLE');
    return this.startForPurpose(identity, 'AUTHORIZE_RUNTIME');
  }

  async startFavor(identity: AuthenticatedIdentity) {
    await this.pilot(identity);
    if (!this.runtimeReady()) throw new AppError('Réception des abonnements Twitch indisponible.', 503, 'TWITCH_RUNTIME_UNAVAILABLE');
    return this.startForPurpose(identity, 'AUTHORIZE_FAVOR_SUBSCRIPTIONS');
  }

  async startGiftSupreme(identity: AuthenticatedIdentity) {
    await this.pilot(identity);
    if (!this.gift?.available) throw new AppError('Gift Suprême Twitch indisponible.', 503, 'TWITCH_GIFT_UNAVAILABLE');
    return this.startForPurpose(identity, 'AUTHORIZE_GIFT_SUPREME');
  }
  private async giveawayAdmin(identity: AuthenticatedIdentity) {
    const player = await this.pilot(identity);
    const role = await this.db.playerRoleAssignment.findFirst({ where: { playerId: player.id, role: 'ADMIN', revokedAt: null }, select: { id: true } });
    if (!role) throw new AppError('Activation Giveaway réservée à l’administration.', 403, 'GIVEAWAY_ADMIN_REQUIRED');
    return player;
  }
  async startGiveaway(identity: AuthenticatedIdentity) {
    await this.giveawayAdmin(identity);
    if (!this.giveaway?.available) throw new AppError('Giveaway Twitch indisponible.', 503, 'TWITCH_GIVEAWAY_UNAVAILABLE');
    return this.startForPurpose(identity, 'AUTHORIZE_GIVEAWAY');
  }
  async enableGiveaway(identity: AuthenticatedIdentity) {
    const player = await this.giveawayAdmin(identity);
    if (!this.giveaway) throw new AppError('Giveaway Twitch indisponible.', 503, 'TWITCH_GIVEAWAY_UNAVAILABLE');
    return this.giveaway.enable(player.id);
  }
  async disableGiveaway(identity: AuthenticatedIdentity) {
    const player = await this.giveawayAdmin(identity);
    if (!this.giveaway) throw new AppError('Giveaway Twitch indisponible.', 503, 'TWITCH_GIVEAWAY_UNAVAILABLE');
    return this.giveaway.disable(player.id);
  }
  async ensureGiftSupreme(identity: AuthenticatedIdentity) {
    const player = await this.pilot(identity);
    if (!this.gift?.available) throw new AppError('Gift Suprême Twitch indisponible.', 503, 'TWITCH_GIFT_UNAVAILABLE');
    const activation = await this.gift.ensure(player.id);
    if (this.giftRuntime) await this.giftRuntime.recoverUnfulfilled(player.id);
    return activation;
  }
  async disableGiftSupreme(identity: AuthenticatedIdentity) {
    const player = await this.pilot(identity);
    if (!this.gift) throw new AppError('Gift Suprême Twitch indisponible.', 503, 'TWITCH_GIFT_UNAVAILABLE');
    return this.gift.disable(player.id);
  }

  private async startForPurpose(identity: AuthenticatedIdentity, purpose: TwitchOAuthPurpose) {
    const player = await this.pilot(identity);
    if (!this.oauthReady()) throw new AppError('La liaison Twitch nâ€™est pas configurÃ©e.', 503, 'TWITCH_UNAVAILABLE');
    if (purpose !== 'LINK_IDENTITY' && !await this.db.twitchIdentity.findUnique({ where: { playerId: player.id } }))
      throw new AppError('Une identité Twitch liée est nécessaire.', 409, 'TWITCH_RUNTIME_IDENTITY_REQUIRED');
    const state = (purpose === 'AUTHORIZE_RUNTIME' ? 'runtime_' : purpose === 'AUTHORIZE_FAVOR_SUBSCRIPTIONS' ? 'favor_' : purpose === 'AUTHORIZE_GIFT_SUPREME' ? 'gift_' : purpose === 'AUTHORIZE_GIVEAWAY' ? 'giveaway_' : '') + randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    await this.db.twitchLinkState.create({ data: { stateHash: hash(state), nonceHash: hash(nonce), playerId: player.id, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    const url = new URL('https://id.twitch.tv/oauth2/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.settings.clientId!);
    url.searchParams.set('redirect_uri', this.settings.redirectUri!);
    url.searchParams.set('scope', purpose === 'AUTHORIZE_RUNTIME' ? TWITCH_RUNTIME_SCOPES.join(' ')
      : purpose === 'AUTHORIZE_FAVOR_SUBSCRIPTIONS' ? TWITCH_FAVOR_SCOPES.join(' ') : purpose === 'AUTHORIZE_GIFT_SUPREME' ? TWITCH_GIFT_SUPREME_SCOPES.join(' ') : purpose === 'AUTHORIZE_GIVEAWAY' ? TWITCH_GIVEAWAY_SCOPES.join(' ') : 'openid');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    return { url: url.toString() };
  }

  async callback(input: { state?: string; code?: string; error?: string }, expectedPurpose?: TwitchOAuthPurpose) {
    if (!this.oauthReady()) throw new AppError('La liaison Twitch nâ€™est pas configurÃ©e.', 503, 'TWITCH_UNAVAILABLE');
    const purpose = twitchOAuthPurpose(input.state);
    if (expectedPurpose && purpose !== expectedPurpose) throw new AppError('État OAuth invalide.', 400, 'TWITCH_STATE_INVALID');
    if (purpose === 'AUTHORIZE_GIFT_SUPREME' && !this.gift?.available) throw new AppError('Gift Suprême Twitch indisponible.', 503, 'TWITCH_GIFT_UNAVAILABLE');
    if (purpose === 'AUTHORIZE_GIVEAWAY' && !this.giveaway?.available) throw new AppError('Giveaway Twitch indisponible.', 503, 'TWITCH_GIVEAWAY_UNAVAILABLE');
    const consumed = await this.db.$queryRaw<{ player_id: string; nonce_hash: string }[]>`
      DELETE FROM twitch_link_states WHERE state_hash = ${hash(input.state!)} AND expires_at > now() RETURNING player_id, nonce_hash`;
    if (consumed.length !== 1) throw new AppError('Ã‰tat OAuth expirÃ© ou dÃ©jÃ  utilisÃ©.', 400, 'TWITCH_STATE_INVALID');
    const playerId = consumed[0]!.player_id;
    if (purpose === 'AUTHORIZE_GIVEAWAY' && !await this.db.playerRoleAssignment.findFirst({ where: { playerId, role: 'ADMIN', revokedAt: null }, select: { id: true } }))
      throw new AppError('Activation Giveaway réservée à l’administration.', 403, 'GIVEAWAY_ADMIN_REQUIRED');
    if (!this.settings.pilotPlayerIds.includes(playerId)) throw new AppError('Pilote non autorisÃ©.', 403, 'TWITCH_PILOT_FORBIDDEN');
    if (input.error || !input.code || input.code.length > 512) throw new AppError('Autorisation Twitch annulÃ©e.', 400, 'TWITCH_AUTH_DENIED');
    const giftIdentity = purpose === 'AUTHORIZE_GIFT_SUPREME' ? await this.db.twitchIdentity.findUnique({ where: { playerId } }) : null;
    const giveawayIdentity = purpose === 'AUTHORIZE_GIVEAWAY' ? await this.db.twitchIdentity.findUnique({ where: { playerId } }) : null;
    if (purpose === 'AUTHORIZE_GIFT_SUPREME' && !giftIdentity) throw new AppError('Identité Twitch liée modifiée.', 409, 'TWITCH_ACCOUNT_MISMATCH');
    if (purpose === 'AUTHORIZE_GIVEAWAY' && !giveawayIdentity) throw new AppError('Identité Twitch liée modifiée.', 409, 'TWITCH_ACCOUNT_MISMATCH');
    const oauthJson = async (response: Response) => {
      try { return await response.json() as unknown; }
      catch { throw new AppError('Réponse OAuth Twitch invalide.', 502, 'TWITCH_OAUTH_FAILED'); }
    };
    const giftRequest = async (url: string, options: RequestInit) => {
      try { return await fetch(url, { ...options, signal: AbortSignal.timeout(10_000) }); }
      catch { throw new AppError('Autorisation Gift Suprême temporairement indisponible.', 503, 'TWITCH_GIFT_UNAVAILABLE'); }
    };
    const oauthFetch = purpose === 'AUTHORIZE_GIFT_SUPREME' || purpose === 'AUTHORIZE_GIVEAWAY' ? giftRequest : fetch;
    const tokenResponse = await oauthFetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.settings.clientId!, client_secret: this.settings.clientSecret!,
        code: input.code, grant_type: 'authorization_code', redirect_uri: this.settings.redirectUri! }),
    });
    if (!tokenResponse.ok) throw new AppError('Ã‰change OAuth Twitch refusÃ©.', 502, 'TWITCH_OAUTH_FAILED');
    const token = await oauthJson(tokenResponse) as { access_token?: unknown; id_token?: unknown; refresh_token?: unknown };
    if ((purpose === 'AUTHORIZE_GIFT_SUPREME' || purpose === 'AUTHORIZE_GIVEAWAY') && !z.object({ access_token: z.string().min(1).max(8192),
      refresh_token: z.string().min(1).max(8192), id_token: z.string().min(1).max(16384) }).safeParse(token).success)
      throw new AppError('Réponse OAuth Gift invalide.', 502, 'TWITCH_GIFT_CREDENTIAL_INVALID');
    if ((purpose === 'AUTHORIZE_GIFT_SUPREME' || purpose === 'AUTHORIZE_GIVEAWAY') && (typeof token.refresh_token !== 'string' || !token.refresh_token || token.refresh_token.length > 8192))
      throw new AppError('Credential Gift Suprême absent.', 502, 'TWITCH_GIFT_CREDENTIAL_INVALID');
    if (typeof token.id_token !== 'string') throw new AppError('ID token Twitch absent.', 502, 'TWITCH_IDENTITY_INVALID');
    let twitchUserId: string;
    try { twitchUserId = await verifyTwitchIdToken(token.id_token, this.settings.clientId!, consumed[0]!.nonce_hash, this.keys); }
    catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('ID token Twitch non vérifié.', 502, 'TWITCH_IDENTITY_INVALID');
    }
    if (typeof token.access_token !== 'string') throw new AppError('RÃ©ponse OAuth Twitch invalide.', 502, 'TWITCH_OAUTH_FAILED');
    const validationResponse = await oauthFetch('https://id.twitch.tv/oauth2/validate', { headers: { authorization: `OAuth ${token.access_token}` } });
    if (!validationResponse.ok) throw new AppError('Jeton Twitch invalide.', 502, 'TWITCH_OAUTH_FAILED');
    const validation = await oauthJson(validationResponse) as { client_id?: unknown; user_id?: unknown; login?: unknown; scopes?: unknown; expires_in?: unknown };
    if ((purpose === 'AUTHORIZE_GIFT_SUPREME' || purpose === 'AUTHORIZE_GIVEAWAY') && !z.object({ client_id: z.string().min(1), user_id: z.string().regex(/^\d+$/),
      login: z.string().min(1).max(128), scopes: z.array(z.string()), expires_in: z.number().int().positive() }).safeParse(validation).success)
      throw new AppError('Validation OAuth Gift invalide.', 502, 'TWITCH_IDENTITY_INVALID');
    if (validation.client_id !== this.settings.clientId || validation.user_id !== twitchUserId
      || typeof validation.login !== 'string' || !Array.isArray(validation.scopes) || !validation.scopes.includes('openid')) {
      throw new AppError('IdentitÃ© Twitch non vÃ©rifiÃ©e.', 502, 'TWITCH_IDENTITY_INVALID');
    }
    const login = normalizeLogin(validation.login);
    if (purpose === 'AUTHORIZE_RUNTIME' && !TWITCH_RUNTIME_SCOPES.every(scope => (validation.scopes as unknown[]).includes(scope)))
      throw new AppError('Permissions Twitch Chat incomplètes.', 403, 'TWITCH_RUNTIME_SCOPES_MISSING');
    if (purpose === 'AUTHORIZE_FAVOR_SUBSCRIPTIONS' && !TWITCH_FAVOR_SCOPES.every(scope => (validation.scopes as unknown[]).includes(scope)))
      throw new AppError('Permissions Twitch Faveur incomplètes.', 403, 'TWITCH_FAVOR_SCOPES_MISSING');
    if (purpose === 'AUTHORIZE_GIFT_SUPREME' && (!TWITCH_GIFT_SUPREME_SCOPES.every(scope => (validation.scopes as unknown[]).includes(scope))
      || !Number.isSafeInteger(validation.expires_in) || (validation.expires_in as number) <= 0))
      throw new AppError('Permissions ou expiration Gift Suprême invalides.', 403, 'TWITCH_GIFT_SCOPES_MISSING');
    if (purpose === 'AUTHORIZE_GIVEAWAY' && (!TWITCH_GIVEAWAY_SCOPES.every(scope => (validation.scopes as unknown[]).includes(scope))
      || !Number.isSafeInteger(validation.expires_in) || (validation.expires_in as number) <= 0))
      throw new AppError('Permissions Giveaway Twitch incomplètes.', 403, 'TWITCH_GIVEAWAY_SCOPES_MISSING');
    const existing = await this.db.twitchIdentity.findUnique({ where: { playerId } });
    if (purpose !== 'LINK_IDENTITY' && (!existing || existing.twitchUserId !== twitchUserId || normalizeLogin(existing.login) !== login))
      throw new AppError('Ce compte Twitch ne correspond pas à l’identité liée.', 409, 'TWITCH_ACCOUNT_MISMATCH');
    if (existing ? existing.twitchUserId !== twitchUserId : login !== normalizeLogin(this.settings.pilotLogin)) {
      throw new AppError('Ce compte Twitch ne correspond pas au pilote.', 409, 'TWITCH_ACCOUNT_MISMATCH');
    }
    const usersResponse = await oauthFetch('https://api.twitch.tv/helix/users', {
      headers: { authorization: `Bearer ${token.access_token}`, 'client-id': this.settings.clientId! },
    });
    if (!usersResponse.ok) throw new AppError('Profil Twitch indisponible.', 502, 'TWITCH_PROFILE_FAILED');
    const users = await oauthJson(usersResponse) as { data?: { id?: unknown; login?: unknown; display_name?: unknown }[] };
    if ((purpose === 'AUTHORIZE_GIFT_SUPREME' || purpose === 'AUTHORIZE_GIVEAWAY') && !z.object({ data: z.array(z.object({ id: z.string().regex(/^\d+$/),
      login: z.string().min(1).max(128), display_name: z.string().max(128) })).length(1) }).safeParse(users).success)
      throw new AppError('Profil OAuth Gift invalide.', 502, 'TWITCH_PROFILE_FAILED');
    const user = users.data?.[0];
    if (user?.id !== twitchUserId || typeof user.login !== 'string' || normalizeLogin(user.login) !== login) {
      throw new AppError('Profil Twitch incohÃ©rent.', 502, 'TWITCH_PROFILE_FAILED');
    }
    const owner = await this.db.twitchIdentity.findUnique({ where: { twitchUserId } });
    if (owner && owner.playerId !== playerId) throw new AppError('Ce compte Twitch est dÃ©jÃ  liÃ© Ã  un autre Player.', 409, 'TWITCH_IDENTITY_CONFLICT');
    if (purpose !== 'LINK_IDENTITY') {
      // Recheck after network calls; authorization must not recreate an unlinked identity.
      const current = await this.db.twitchIdentity.findUnique({ where: { playerId } });
      if (!current || current.twitchUserId !== twitchUserId || normalizeLogin(current.login) !== login
        || giftIdentity && +giftIdentity.linkedAt !== +current.linkedAt
        || giveawayIdentity && +giveawayIdentity.linkedAt !== +current.linkedAt)
        throw new AppError('Identité Twitch liée modifiée.', 409, 'TWITCH_ACCOUNT_MISMATCH');
      if (purpose === 'AUTHORIZE_GIFT_SUPREME') {
        const activation = await this.gift!.authorize({ playerId, twitchUserId, login, refreshToken: token.refresh_token as string,
          accessToken: token.access_token, scopes: validation.scopes as string[], expiresIn: validation.expires_in as number, linkedAt: giftIdentity!.linkedAt });
        return { giftSupremeActivated: activation.giftSupremeActive, giftSupremePending: activation.giftSupremePending };
      }
      if (purpose === 'AUTHORIZE_GIVEAWAY') {
        return this.giveaway!.authorize({ playerId, twitchUserId, login, refreshToken: token.refresh_token as string,
          accessToken: token.access_token, scopes: validation.scopes as string[], expiresIn: validation.expires_in as number,
          linkedAt: giveawayIdentity!.linkedAt });
      }
      if (!this.runtimeReady()) throw new AppError('Réception du chat Twitch indisponible.', 503, 'TWITCH_RUNTIME_UNAVAILABLE');
      // Only validated consent may create its own type. Tokens are never persisted.
      if (purpose === 'AUTHORIZE_FAVOR_SUBSCRIPTIONS') {
        const subscription = await this.subscriptions!.ensurePilotFavorSubscription(playerId, twitchUserId, login);
        return { favorRuntimeActivated: true, favorSubscriptionPending: subscription.status === 'webhook_callback_verification_pending' };
      }
      const subscription = await this.subscriptions!.ensurePilotChatSubscription(playerId, twitchUserId);
      return { runtimeActivated: true, runtimeChatPending: subscription.status === 'webhook_callback_verification_pending' };
    }
    try {
      await this.db.twitchIdentity.upsert({ where: { playerId }, create: {
        playerId, twitchUserId, login, displayName: typeof user.display_name === 'string' ? user.display_name : null,
      }, update: { login, displayName: typeof user.display_name === 'string' ? user.display_name : null } });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
        throw new AppError('Ce compte Twitch est dÃ©jÃ  liÃ© Ã  un autre Player.', 409, 'TWITCH_IDENTITY_CONFLICT');
      throw error;
    }
    return { linked: true };
  }

  async unlink(identity: AuthenticatedIdentity) {
    const player = await this.pilot(identity);
    const giveawayCredential = await this.db.twitchGiveawayCredential.findUnique({ where: { playerId: player.id } });
    if (giveawayCredential?.enabled || await this.db.giveawaySession.findFirst({ where: { origin: 'NATIVE', status: 'OPEN' }, select: { id: true } }))
      throw new AppError('Fermez le Giveaway et désactivez son bridge avant de dissocier Twitch.', 409, 'GIVEAWAY_UNLINK_BLOCKED');
    const linked = await this.db.twitchIdentity.findUnique({ where: { playerId: player.id } });
    const remove = async () => {
      if (giveawayCredential) await this.db.twitchGiveawayCredential.deleteMany({ where: { playerId: player.id, enabled: false } });
      await this.db.twitchIdentity.deleteMany({ where: { playerId: player.id } });
    };
    if (linked && this.gift) await this.gift.unlink(player.id, remove);
    else if (linked && this.subscriptions?.managementAvailable) {
      if (this.db.twitchGiftSupremeCredential && await this.db.twitchGiftSupremeCredential.findUnique({ where: { playerId: player.id } }))
        throw new AppError('Impossible de confirmer l’arrêt Gift Suprême.', 503, 'TWITCH_GIFT_UNAVAILABLE');
      await this.subscriptions.unlinkPilotIdentity(player.id, remove);
    }
    else {
      if (linked && this.eventSubConfigured) throw new AppError('Impossible de vérifier l’arrêt des réceptions Twitch. Réessayez plus tard.', 503, 'TWITCH_RUNTIME_UNAVAILABLE');
      if (this.db.twitchGiftSupremeCredential && await this.db.twitchGiftSupremeCredential.findUnique({ where: { playerId: player.id } }))
        throw new AppError('Impossible de confirmer l’arrêt Gift Suprême.', 503, 'TWITCH_GIFT_UNAVAILABLE');
      await remove();
    }
    return { linked: false };
  }

  async disableFavor(identity: AuthenticatedIdentity) {
    const player = await this.pilot(identity);
    if (!this.subscriptions?.managementAvailable) throw new AppError('Réception des abonnements Twitch indisponible.', 503, 'TWITCH_RUNTIME_UNAVAILABLE');
    await this.subscriptions.disablePilotFavorSubscription(player.id);
    return { favorSubscriptionActive: false, favorSubscriptionPending: false };
  }

  async disableRuntime(identity: AuthenticatedIdentity) {
    const player = await this.pilot(identity);
    if (!this.subscriptions?.managementAvailable) throw new AppError('Réception du chat Twitch indisponible.', 503, 'TWITCH_RUNTIME_UNAVAILABLE');
    await this.subscriptions.disablePilotChatSubscription(player.id);
    return { runtimeChatActive: false, runtimeChatPending: false };
  }
}
