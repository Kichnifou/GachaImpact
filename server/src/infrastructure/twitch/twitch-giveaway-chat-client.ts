import { z } from 'zod';
import { oneLine } from '../../domain/giveaway/giveaway.js';
import type { TwitchGiveawayAccessTokenProvider } from './twitch-giveaway-access-token-provider.js';

const responseSchema = z.object({ data: z.array(z.object({ message_id: z.string().min(1).optional(), is_sent: z.boolean(),
  drop_reason: z.object({ code: z.string().optional() }).optional() })).length(1) });

export class TwitchGiveawaySendError extends Error {
  constructor(readonly certainty: 'CERTAIN' | 'AMBIGUOUS', readonly reason: string) {
    super(`Giveaway chat send ${certainty.toLowerCase()}: ${reason}`);
  }
}

export class TwitchGiveawayChatClient {
  constructor(private readonly clientId: string, private readonly tokens: TwitchGiveawayAccessTokenProvider,
    private readonly request: typeof fetch = fetch) {}

  async send(playerId: string, broadcasterId: string, text: string): Promise<string> {
    // Keep the transport ceiling for old frozen replies; new owners freeze 450.
    if (!text || oneLine(text) !== text || Array.from(text).length > 500) throw new TwitchGiveawaySendError('CERTAIN', 'INVALID_TEXT');
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.tokens.getToken(playerId);
      let response: Response;
      try {
        response = await this.request('https://api.twitch.tv/helix/chat/messages', { method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'client-id': this.clientId, 'content-type': 'application/json' },
          body: JSON.stringify({ broadcaster_id: broadcasterId, sender_id: broadcasterId, message: text }),
          signal: AbortSignal.timeout(10_000) });
      } catch { throw new TwitchGiveawaySendError('AMBIGUOUS', 'NETWORK'); }
      if (response.status === 401 && attempt === 0) { this.tokens.invalidate(playerId, token); continue; }
      if (response.status === 401) throw new TwitchGiveawaySendError('CERTAIN', 'UNAUTHORIZED');
      if (response.status >= 500) throw new TwitchGiveawaySendError('AMBIGUOUS', 'UPSTREAM');
      if (!response.ok) throw new TwitchGiveawaySendError('CERTAIN', `HTTP_${response.status}`);
      let body: unknown;
      try { body = await response.json(); }
      catch { throw new TwitchGiveawaySendError('AMBIGUOUS', 'INVALID_RESPONSE'); }
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) throw new TwitchGiveawaySendError('AMBIGUOUS', 'INVALID_RESPONSE');
      const message = parsed.data.data[0]!;
      if (!message.is_sent) throw new TwitchGiveawaySendError('CERTAIN', message.drop_reason?.code ?? 'NOT_SENT');
      if (!message.message_id) throw new TwitchGiveawaySendError('AMBIGUOUS', 'MISSING_MESSAGE_ID');
      return message.message_id;
    }
    throw new TwitchGiveawaySendError('CERTAIN', 'UNAUTHORIZED');
  }
}
