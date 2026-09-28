import { z } from 'zod';
import { AppError } from '../../api/errors.js';
import type { TwitchAppAccessTokenProvider } from './twitch-app-access-token-provider.js';

const subscriptionSchema = z.object({
  id: z.string().min(1), type: z.string().min(1), version: z.string().min(1), status: z.string().min(1),
  condition: z.record(z.string(), z.string()),
  transport: z.object({ method: z.enum(['webhook', 'websocket', 'conduit']), callback: z.url().optional() }),
});
const pageSchema = z.object({ data: z.array(subscriptionSchema), pagination: z.object({ cursor: z.string().min(1).optional() }) });
const createdSchema = z.object({ data: z.array(subscriptionSchema).length(1) });
export type TwitchEventSubSubscription = z.infer<typeof subscriptionSchema>;
export type PilotChatSubscriptionRequest = Readonly<{
  type: 'channel.chat.message'; version: '1';
  condition: { broadcaster_user_id: string; user_id: string };
  transport: { method: 'webhook'; callback: string; secret: string };
}>;
export class TwitchEventSubApiError extends AppError {
  constructor(public readonly upstreamStatus: number) { super('API EventSub Twitch indisponible.', 502, 'TWITCH_EVENTSUB_API_FAILED'); }
}
const invalid = () => new AppError('Réponse EventSub Twitch invalide.', 502, 'TWITCH_EVENTSUB_RESPONSE_INVALID');

export class TwitchEventSubClient {
  constructor(private readonly clientId: string, private readonly tokens: TwitchAppAccessTokenProvider,
    private readonly request: typeof fetch = fetch) {}

  private async call(method: 'GET' | 'POST', cursor?: string, body?: PilotChatSubscriptionRequest) {
    const url = new URL('https://api.twitch.tv/helix/eventsub/subscriptions');
    if (method === 'GET') url.searchParams.set('type', 'channel.chat.message');
    if (cursor) url.searchParams.set('after', cursor);
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.tokens.getToken();
      let response: Response;
      try {
        response = await this.request(url, {
          method, headers: { authorization: `Bearer ${token}`, 'client-id': this.clientId, 'content-type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10_000),
        });
      } catch { throw new TwitchEventSubApiError(0); }
      if (response.status === 401) {
        this.tokens.invalidate(token);
        if (attempt === 0) continue;
      }
      if (response.status !== (method === 'POST' ? 202 : 200)) throw new TwitchEventSubApiError(response.status);
      try { return await response.json() as unknown; }
      catch { throw invalid(); }
    }
    throw new TwitchEventSubApiError(401);
  }

  async listChatSubscriptions(): Promise<TwitchEventSubSubscription[]> {
    const subscriptions: TwitchEventSubSubscription[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      const parsed = pageSchema.safeParse(await this.call('GET', cursor));
      if (!parsed.success) throw invalid();
      subscriptions.push(...parsed.data.data);
      cursor = parsed.data.pagination.cursor;
      if (cursor && (seen.has(cursor) || seen.size >= 100)) throw invalid();
      if (cursor) seen.add(cursor);
    } while (cursor);
    return subscriptions;
  }

  async createChatSubscription(body: PilotChatSubscriptionRequest): Promise<TwitchEventSubSubscription> {
    const parsed = createdSchema.safeParse(await this.call('POST', undefined, body));
    if (!parsed.success) throw invalid();
    return parsed.data.data[0]!;
  }
}
