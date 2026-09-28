import { z } from 'zod';
import { AppError } from '../../api/errors.js';

const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().int().positive(), token_type: z.literal('bearer') });
const failure = () => new AppError('App Access Token Twitch indisponible.', 502, 'TWITCH_APP_TOKEN_FAILED');

/** Server-only, lazy client credentials. Neither tokens nor upstream errors are logged or persisted. */
export class TwitchAppAccessTokenProvider {
  private cached: { token: string; refreshAt: number } | undefined;
  private pending: Promise<string> | undefined;

  constructor(private readonly clientId: string, private readonly clientSecret: string,
    private readonly request: typeof fetch = fetch, private readonly now: () => number = Date.now) {}

  async getToken(): Promise<string> {
    if (this.cached && this.now() < this.cached.refreshAt) return this.cached.token;
    if (this.pending) return this.pending;
    this.pending = this.refresh();
    try { return await this.pending; }
    finally { this.pending = undefined; }
  }

  invalidate(rejectedToken: string) {
    // A late 401 for an old token must not evict a concurrent refresh's new token.
    if (this.cached?.token === rejectedToken) this.cached = undefined;
  }

  private async refresh(): Promise<string> {
    try {
      const startedAt = this.now();
      const response = await this.request('https://id.twitch.tv/oauth2/token', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, grant_type: 'client_credentials' }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status !== 200) throw failure();
      const parsed = tokenSchema.safeParse(await response.json());
      if (!parsed.success) throw failure();
      const ttl = parsed.data.expires_in * 1_000;
      const refreshAt = startedAt + ttl - Math.min(60_000, ttl / 10);
      if (!Number.isFinite(refreshAt) || refreshAt <= this.now()) throw failure();
      this.cached = { token: parsed.data.access_token, refreshAt };
      return this.cached.token;
    } catch { throw failure(); }
  }
}
