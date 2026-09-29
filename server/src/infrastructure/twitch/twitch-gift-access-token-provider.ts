import { z } from 'zod';
import type { PrismaClient, TwitchGiftSupremeCredential } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import { TWITCH_GIFT_SUPREME_SCOPES } from '../../application/twitch/twitch-gift-supreme-contract.js';
import { TwitchGiftCredentialCipher } from './twitch-gift-credential-cipher.js';

const refreshed = z.object({ access_token: z.string().min(1).max(8192), refresh_token: z.string().min(1).max(8192).optional(),
  expires_in: z.number().int().positive(), token_type: z.literal('bearer') });
const validation = z.object({ client_id: z.string(), user_id: z.string().regex(/^\d+$/), scopes: z.array(z.string()), expires_in: z.number().int().positive() });
const invalid = () => new AppError('Autorisation Gift Suprême invalide. Autorisez à nouveau Twitch.', 503, 'TWITCH_GIFT_CREDENTIAL_INVALID');
const unavailable = () => new AppError('Autorisation Gift Suprême temporairement indisponible.', 503, 'TWITCH_GIFT_UNAVAILABLE');

/** User access tokens live only in memory. No PostgreSQL transaction spans a network call. */
export class TwitchGiftAccessTokenProvider {
  private readonly cache = new Map<string, { token: string; revision: number; refreshAt: number; validateAt: number }>();
  private readonly pending = new Map<string, Promise<string>>();
  constructor(private readonly db: Pick<PrismaClient, 'twitchGiftSupremeCredential'>, private readonly cipher: TwitchGiftCredentialCipher,
    private readonly clientId: string, private readonly clientSecret: string, private readonly request: typeof fetch = fetch,
    private readonly now: () => number = Date.now) {}

  prime(row: TwitchGiftSupremeCredential, token: string, expiresIn: number) {
    const ttl = expiresIn * 1000;
    this.cache.set(row.playerId, { token, revision: row.revision, refreshAt: this.now() + ttl - Math.min(60_000, ttl / 10), validateAt: this.now() + 300_000 });
  }
  invalidate(playerId: string, rejectedToken?: string) {
    if (!rejectedToken || this.cache.get(playerId)?.token === rejectedToken) this.cache.delete(playerId);
  }
  async getToken(playerId: string, signal?: AbortSignal): Promise<string> {
    if (this.pending.has(playerId)) return this.pending.get(playerId)!;
    const job = this.obtain(playerId, signal); this.pending.set(playerId, job);
    try { return await job; } finally { if (this.pending.get(playerId) === job) this.pending.delete(playerId); }
  }
  private async row(playerId: string) {
    const row = await this.db.twitchGiftSupremeCredential.findUnique({ where: { playerId } });
    const scopes = z.array(z.string()).safeParse(row?.scopes);
    if (!row || !scopes.success || !TWITCH_GIFT_SUPREME_SCOPES.every(scope => scopes.data.includes(scope))) throw invalid();
    return row;
  }
  private async fetch(url: string, options: RequestInit, signal?: AbortSignal) {
    try { return await this.request(url, { ...options, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) }); }
    catch { throw unavailable(); }
  }
  private async obtain(playerId: string, signal?: AbortSignal): Promise<string> {
    try {
      let row = await this.row(playerId);
      const cached = this.cache.get(playerId);
      if (cached && cached.revision === row.revision && this.now() < cached.refreshAt) {
        if (this.now() < cached.validateAt) return cached.token;
        const checked = await this.fetch('https://id.twitch.tv/oauth2/validate', { headers: { authorization: `OAuth ${cached.token}` } }, signal);
        if (checked.ok) {
          const parsed = validation.safeParse(await checked.json());
          if (!parsed.success || parsed.data.client_id !== this.clientId || parsed.data.user_id !== row.twitchUserId
            || !TWITCH_GIFT_SUPREME_SCOPES.every(scope => parsed.data.scopes.includes(scope))) throw invalid();
          const current = await this.row(playerId);
          if (current.revision === cached.revision) {
            const ttl = parsed.data.expires_in * 1000;
            cached.refreshAt = Math.min(cached.refreshAt, this.now() + ttl - Math.min(60_000, ttl / 10));
            cached.validateAt = this.now() + 300_000; return cached.token;
          }
          row = current;
        } else if (checked.status !== 401) throw unavailable();
        this.cache.delete(playerId);
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        signal?.throwIfAborted();
        let refreshToken: string;
        try { refreshToken = this.cipher.decrypt(row.encryptedRefreshToken, playerId, row.twitchUserId); } catch { throw invalid(); }
        const startedAt = this.now();
        const response = await this.fetch('https://id.twitch.tv/oauth2/token', { method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken }) }, signal);
        if (!response.ok) {
          const latest = await this.row(playerId);
          if (attempt === 0 && latest.revision !== row.revision && latest.twitchUserId === row.twitchUserId) { row = latest; continue; }
          throw response.status === 400 || response.status === 401 ? invalid() : unavailable();
        }
        const token = refreshed.safeParse(await response.json()); if (!token.success) throw unavailable();
        // Save rotation before /validate so a transient validation outage cannot lose the new refresh token.
        const encryptedRefreshToken = this.cipher.encrypt(token.data.refresh_token ?? refreshToken, playerId, row.twitchUserId);
        const saved = await this.db.twitchGiftSupremeCredential.updateMany({ where: { playerId, twitchUserId: row.twitchUserId, revision: row.revision },
          data: { encryptedRefreshToken, revision: { increment: 1 } } });
        if (!saved.count) {
          const latest = await this.row(playerId);
          if (attempt === 0 && latest.revision !== row.revision && latest.twitchUserId === row.twitchUserId) { row = latest; continue; }
          throw invalid();
        }
        const checked = await this.fetch('https://id.twitch.tv/oauth2/validate', { headers: { authorization: `OAuth ${token.data.access_token}` } }, signal);
        if (!checked.ok) throw checked.status === 401 ? invalid() : unavailable();
        const parsed = validation.safeParse(await checked.json());
        if (!parsed.success || parsed.data.client_id !== this.clientId || parsed.data.user_id !== row.twitchUserId
          || !TWITCH_GIFT_SUPREME_SCOPES.every(scope => parsed.data.scopes.includes(scope))) throw invalid();
        const ttl = Math.min(token.data.expires_in, parsed.data.expires_in) * 1000;
        const refreshAt = startedAt + ttl - Math.min(60_000, ttl / 10);
        const current = await this.row(playerId);
        if (current.twitchUserId !== row.twitchUserId || refreshAt <= this.now()) throw invalid();
        if (current.revision !== row.revision + 1) {
          if (attempt === 0) { row = current; continue; }
          throw invalid();
        }
        this.cache.set(playerId, { token: token.data.access_token, revision: current.revision, refreshAt, validateAt: this.now() + 300_000 });
        return token.data.access_token;
      }
      throw invalid();
    } catch (error) { if (error instanceof AppError) throw error; throw unavailable(); }
  }
}
