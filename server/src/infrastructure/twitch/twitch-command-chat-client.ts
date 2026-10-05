import { z } from 'zod';
import type { TwitchAppAccessTokenProvider } from './twitch-app-access-token-provider.js';

const id = z.string().regex(/^\d+$/).max(128);
const inputSchema = z.object({ broadcasterId: id, senderId: id,
  message: z.string().refine(text => text.trim().length > 0 && !/[\r\n\u2028\u2029]/u.test(text) && Array.from(text).length <= 500),
  replyParentMessageId: z.string().min(1).max(256).optional(),
}).strict();
export type TwitchCommandChatInput = z.infer<typeof inputSchema>;
const responseSchema = z.object({ data: z.array(z.object({ is_sent: z.boolean(), message_id: z.string().optional(),
  drop_reason: z.object({ code: z.string().optional(), message: z.string().optional() }).nullish(),
})).length(1) });

export class TwitchCommandSendError extends Error {
  constructor(readonly certainty: 'CERTAIN' | 'AMBIGUOUS', readonly reason: string) {
    super(`Twitch command response failed: ${reason}`);
  }
}

/** Lazy app-token sender. No user credentials, automatic network retries or upstream error bodies. */
export class TwitchCommandChatClient {
  constructor(private readonly clientId: string, private readonly tokens: Pick<TwitchAppAccessTokenProvider, 'getToken' | 'invalidate'>,
    private readonly request: typeof fetch = fetch) {}

  async send(input: TwitchCommandChatInput, canSend: () => boolean = () => true): Promise<string> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new TwitchCommandSendError('CERTAIN', 'INVALID_INPUT');
    for (let attempt = 0; attempt < 2; attempt++) {
      let token: string;
      try { token = await this.tokens.getToken(); }
      catch { throw new TwitchCommandSendError('CERTAIN', 'APP_TOKEN_UNAVAILABLE'); }
      // A disarm during lazy token acquisition must also stop the actual HTTP request.
      if (!canSend()) throw new TwitchCommandSendError('CERTAIN', 'PILOT_DISABLED');
      let response: Response;
      try {
        response = await this.request('https://api.twitch.tv/helix/chat/messages', { method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'client-id': this.clientId, 'content-type': 'application/json' },
          body: JSON.stringify({ broadcaster_id: input.broadcasterId, sender_id: input.senderId, message: input.message,
            ...(input.replyParentMessageId ? { reply_parent_message_id: input.replyParentMessageId } : {}), for_source_only: true }),
          signal: AbortSignal.timeout(10_000) });
      } catch { throw new TwitchCommandSendError('AMBIGUOUS', 'NETWORK'); }
      if (response.status === 401 && attempt === 0) { this.tokens.invalidate(token); continue; }
      if (response.status >= 500) throw new TwitchCommandSendError('AMBIGUOUS', 'UPSTREAM');
      if (!response.ok) throw new TwitchCommandSendError('CERTAIN', `HTTP_${response.status}`);
      let raw: unknown;
      try { raw = await response.json(); }
      catch { throw new TwitchCommandSendError('AMBIGUOUS', 'INVALID_RESPONSE'); }
      const result = responseSchema.safeParse(raw);
      if (!result.success) throw new TwitchCommandSendError('AMBIGUOUS', 'INVALID_RESPONSE');
      const message = result.data.data[0]!;
      if (!message.is_sent) throw new TwitchCommandSendError('CERTAIN', 'NOT_SENT');
      if (!message.message_id?.trim()) throw new TwitchCommandSendError('AMBIGUOUS', 'MISSING_MESSAGE_ID');
      return message.message_id;
    }
    throw new TwitchCommandSendError('CERTAIN', 'HTTP_401');
  }
}
