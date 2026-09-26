import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const normalizeLogin = (value: string) => value.trim().normalize('NFKC').toLowerCase();
const twitchKeys = createRemoteJWKSet(new URL('https://id.twitch.tv/oauth2/keys'));

export async function verifyTwitchIdToken(token: string, clientId: string, nonceHash: string, keys: JWTVerifyGetKey = twitchKeys) {
  const { payload } = await jwtVerify(token, keys, {
    issuer: 'https://id.twitch.tv/oauth2', audience: clientId, algorithms: ['RS256'],
    requiredClaims: ['exp', 'iat', 'sub', 'nonce'],
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
  constructor(private readonly db: PrismaClient, private readonly getPlayer: GetCurrentPlayer, config: AppConfig,
    private readonly keys: JWTVerifyGetKey = twitchKeys) {
    this.settings = config.twitch ?? { pilotPlayerIds: [], pilotLogin: 'kichnifou' };
  }

  private oauthReady() {
    return Boolean(this.settings.clientId && this.settings.clientSecret && this.settings.redirectUri);
  }

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
    return {
      pilotAvailable: eligible && this.oauthReady(),
      eligible,
      linked: linked ? { login: linked.login, displayName: linked.displayName, linkedAt: linked.linkedAt.toISOString() } : null,
      snapshotAvailable: eligible && Boolean(linked) && this.oauthReady(),
      lastImport: lastRun ? { at: lastRun.completedAt.toISOString(), snapshotHash: lastRun.snapshotHash } : null,
    };
  }

  async start(identity: AuthenticatedIdentity) {
    const player = await this.pilot(identity);
    if (!this.oauthReady()) throw new AppError('La liaison Twitch nâ€™est pas configurÃ©e.', 503, 'TWITCH_UNAVAILABLE');
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    await this.db.twitchLinkState.create({ data: { stateHash: hash(state), nonceHash: hash(nonce), playerId: player.id, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    const url = new URL('https://id.twitch.tv/oauth2/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.settings.clientId!);
    url.searchParams.set('redirect_uri', this.settings.redirectUri!);
    url.searchParams.set('scope', 'openid');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    return { url: url.toString() };
  }

  async callback(input: { state?: string; code?: string; error?: string }) {
    if (!this.oauthReady()) throw new AppError('La liaison Twitch nâ€™est pas configurÃ©e.', 503, 'TWITCH_UNAVAILABLE');
    if (!input.state || !/^[A-Za-z0-9_-]{40,60}$/.test(input.state)) throw new AppError('Ã‰tat OAuth invalide.', 400, 'TWITCH_STATE_INVALID');
    const consumed = await this.db.$queryRaw<{ player_id: string; nonce_hash: string }[]>`
      DELETE FROM twitch_link_states WHERE state_hash = ${hash(input.state)} AND expires_at > now() RETURNING player_id, nonce_hash`;
    if (consumed.length !== 1) throw new AppError('Ã‰tat OAuth expirÃ© ou dÃ©jÃ  utilisÃ©.', 400, 'TWITCH_STATE_INVALID');
    const playerId = consumed[0]!.player_id;
    if (!this.settings.pilotPlayerIds.includes(playerId)) throw new AppError('Pilote non autorisÃ©.', 403, 'TWITCH_PILOT_FORBIDDEN');
    if (input.error || !input.code || input.code.length > 512) throw new AppError('Autorisation Twitch annulÃ©e.', 400, 'TWITCH_AUTH_DENIED');
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.settings.clientId!, client_secret: this.settings.clientSecret!,
        code: input.code, grant_type: 'authorization_code', redirect_uri: this.settings.redirectUri! }),
    });
    if (!tokenResponse.ok) throw new AppError('Ã‰change OAuth Twitch refusÃ©.', 502, 'TWITCH_OAUTH_FAILED');
    const token = await tokenResponse.json() as { access_token?: unknown; id_token?: unknown };
    if (typeof token.id_token !== 'string') throw new AppError('ID token Twitch absent.', 502, 'TWITCH_IDENTITY_INVALID');
    let twitchUserId: string;
    try { twitchUserId = await verifyTwitchIdToken(token.id_token, this.settings.clientId!, consumed[0]!.nonce_hash, this.keys); }
    catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('ID token Twitch non vérifié.', 502, 'TWITCH_IDENTITY_INVALID');
    }
    if (typeof token.access_token !== 'string') throw new AppError('RÃ©ponse OAuth Twitch invalide.', 502, 'TWITCH_OAUTH_FAILED');
    const validationResponse = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { authorization: `OAuth ${token.access_token}` } });
    if (!validationResponse.ok) throw new AppError('Jeton Twitch invalide.', 502, 'TWITCH_OAUTH_FAILED');
    const validation = await validationResponse.json() as { client_id?: unknown; user_id?: unknown; login?: unknown; scopes?: unknown };
    if (validation.client_id !== this.settings.clientId || validation.user_id !== twitchUserId
      || typeof validation.login !== 'string' || !Array.isArray(validation.scopes) || !validation.scopes.includes('openid')) {
      throw new AppError('IdentitÃ© Twitch non vÃ©rifiÃ©e.', 502, 'TWITCH_IDENTITY_INVALID');
    }
    const login = normalizeLogin(validation.login);
    const existing = await this.db.twitchIdentity.findUnique({ where: { playerId } });
    if (existing ? existing.twitchUserId !== twitchUserId : login !== normalizeLogin(this.settings.pilotLogin)) {
      throw new AppError('Ce compte Twitch ne correspond pas au pilote.', 409, 'TWITCH_ACCOUNT_MISMATCH');
    }
    const usersResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: { authorization: `Bearer ${token.access_token}`, 'client-id': this.settings.clientId! },
    });
    if (!usersResponse.ok) throw new AppError('Profil Twitch indisponible.', 502, 'TWITCH_PROFILE_FAILED');
    const users = await usersResponse.json() as { data?: { id?: unknown; login?: unknown; display_name?: unknown }[] };
    const user = users.data?.[0];
    if (user?.id !== twitchUserId || typeof user.login !== 'string' || normalizeLogin(user.login) !== login) {
      throw new AppError('Profil Twitch incohÃ©rent.', 502, 'TWITCH_PROFILE_FAILED');
    }
    const owner = await this.db.twitchIdentity.findUnique({ where: { twitchUserId } });
    if (owner && owner.playerId !== playerId) throw new AppError('Ce compte Twitch est dÃ©jÃ  liÃ© Ã  un autre Player.', 409, 'TWITCH_IDENTITY_CONFLICT');
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
    await this.db.twitchIdentity.deleteMany({ where: { playerId: player.id } });
    return { linked: false };
  }
}
