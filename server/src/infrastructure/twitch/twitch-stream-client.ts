import { z } from 'zod';
import type { TwitchAppAccessTokenProvider } from './twitch-app-access-token-provider.js';
const stream = z.object({ id: z.string().regex(/^\d+$/), user_id: z.string().regex(/^\d+$/), user_login: z.string(), type: z.literal('live'), started_at: z.iso.datetime() });
export type ConfirmedTwitchStream = { id: string; startedAt: Date };
/** App-token GET, one official channel. Errors are never interpreted as offline. */
export class TwitchStreamClient {
  constructor(private readonly clientId: string, private readonly tokens: TwitchAppAccessTokenProvider, private readonly request: typeof fetch = fetch) {}
  async current(broadcasterId: string): Promise<ConfirmedTwitchStream | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.tokens.getToken();
      const response = await this.request('https://api.twitch.tv/helix/streams?user_id=' + encodeURIComponent(broadcasterId), {
        headers: { authorization: 'Bearer ' + token, 'client-id': this.clientId }, signal: AbortSignal.timeout(10_000) });
      if (response.status === 401 && attempt === 0) { this.tokens.invalidate(token); continue; }
      if (response.status !== 200) throw Error('TWITCH_STREAM_UNAVAILABLE');
      const parsed = z.object({ data: z.array(stream).max(1) }).safeParse(await response.json());
      if (!parsed.success) throw Error('TWITCH_STREAM_INVALID');
      const live = parsed.data.data[0];
      if (!live) return null;
      if (live.user_id !== broadcasterId || live.user_login.toLowerCase() !== 'kichnifou') throw Error('TWITCH_STREAM_IDENTITY');
      return { id: live.id, startedAt: new Date(live.started_at) };
    }
    throw Error('TWITCH_STREAM_UNAVAILABLE');
  }
}
