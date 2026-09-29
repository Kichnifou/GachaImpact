import { z } from 'zod';
import { AppError } from '../../api/errors.js';
import { GIFT_SUPREME_REWARD } from '../../application/twitch/twitch-gift-supreme-contract.js';
import type { TwitchGiftAccessTokenProvider } from './twitch-gift-access-token-provider.js';

const id = z.string().min(1).max(128), twitchId = z.string().regex(/^\d+$/).max(128);
const rewardSchema = z.object({ id, broadcaster_id: twitchId, title: z.string(), cost: z.number().int().nonnegative(), prompt: z.string(),
  is_user_input_required: z.boolean(), should_redemptions_skip_request_queue: z.boolean(), is_enabled: z.boolean() });
const redemptionSchema = z.object({ id, broadcaster_id: twitchId, reward: z.object({ id }), status: z.enum(['UNFULFILLED', 'FULFILLED', 'CANCELED']) });
const messageSchema = z.object({ data: z.array(z.object({ message_id: z.string(), is_sent: z.boolean() })).length(1) });
export type TwitchGiftReward = z.infer<typeof rewardSchema>;
export type TwitchGiftRemoteStatus = 'FULFILLED' | 'CANCELED';
export const giftRewardMatches = (reward: TwitchGiftReward) => Object.entries(GIFT_SUPREME_REWARD).every(([key, value]) => reward[key as keyof TwitchGiftReward] === value);

/** No upstream body/headers/cause in errors. uncertain=true means a chat send may have happened. */
export class TwitchGiftHelixError extends AppError {
  constructor(readonly upstreamStatus: number, readonly uncertain = false) {
    super('API Gift Suprême Twitch temporairement indisponible.', 503, 'TWITCH_GIFT_UNAVAILABLE');
  }
}

export class TwitchGiftHelixClient {
  constructor(private readonly clientId: string, private readonly tokens: TwitchGiftAccessTokenProvider, private readonly request: typeof fetch = fetch) {}
  private async call(playerId: string, path: string, method: 'GET' | 'POST' | 'PATCH', query: Record<string, string>, body?: unknown,
    signal?: AbortSignal, announcement = false) {
    const url = new URL('https://api.twitch.tv/helix/' + path); for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.tokens.getToken(playerId, signal); signal?.throwIfAborted();
      let response: Response;
      try { response = await this.request(url, { method, headers: { 'client-id': this.clientId, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) }); }
      catch { throw new TwitchGiftHelixError(0, announcement); }
      if (response.status === 401) { this.tokens.invalidate(playerId, token); if (attempt === 0) continue; }
      if (response.status !== 200) throw new TwitchGiftHelixError(response.status, announcement && response.status >= 500);
      try { return await response.json() as unknown; } catch { throw new TwitchGiftHelixError(200, announcement); }
    }
    throw new TwitchGiftHelixError(401);
  }
  async rewards(playerId: string, broadcasterId: string, manageable: boolean, signal?: AbortSignal): Promise<TwitchGiftReward[]> {
    const parsed = z.object({ data: z.array(rewardSchema).max(50) }).safeParse(await this.call(playerId, 'channel_points/custom_rewards', 'GET',
      { broadcaster_id: broadcasterId, only_manageable_rewards: String(manageable) }, undefined, signal));
    if (!parsed.success || parsed.data.data.some(row => row.broadcaster_id !== broadcasterId)
      || new Set(parsed.data.data.map(row => row.id)).size !== parsed.data.data.length) throw new TwitchGiftHelixError(200);
    return parsed.data.data;
  }
  private oneReward(payload: unknown, broadcasterId: string, rewardId?: string) {
    const parsed = z.object({ data: z.array(rewardSchema).length(1) }).safeParse(payload), reward = parsed.success ? parsed.data.data[0]! : null;
    if (!reward || reward.broadcaster_id !== broadcasterId || rewardId && reward.id !== rewardId) throw new TwitchGiftHelixError(200);
    return reward;
  }
  async createReward(playerId: string, broadcasterId: string) {
    return this.oneReward(await this.call(playerId, 'channel_points/custom_rewards', 'POST', { broadcaster_id: broadcasterId },
      { ...GIFT_SUPREME_REWARD, is_enabled: true }), broadcasterId);
  }
  async updateReward(playerId: string, broadcasterId: string, rewardId: string, enabled: boolean) {
    return this.oneReward(await this.call(playerId, 'channel_points/custom_rewards', 'PATCH', { broadcaster_id: broadcasterId, id: rewardId },
      { ...GIFT_SUPREME_REWARD, is_enabled: enabled }), broadcasterId, rewardId);
  }
  async settle(playerId: string, broadcasterId: string, rewardId: string, redemptionId: string, status: TwitchGiftRemoteStatus) {
    let confirmed = false;
    try {
      const parsed = z.object({ data: z.array(redemptionSchema).length(1) }).safeParse(await this.call(playerId, 'channel_points/custom_rewards/redemptions', 'PATCH',
        { broadcaster_id: broadcasterId, reward_id: rewardId, id: redemptionId }, { status }));
      confirmed = parsed.success && this.sameRedemption(parsed.data.data[0]!, broadcasterId, rewardId, redemptionId, status);
    } catch (error) { if (!(error instanceof TwitchGiftHelixError)) throw error; }
    // PATCH may have committed despite a timeout, or the terminal status may already be present.
    if (!confirmed) {
      const parsed = z.object({ data: z.array(redemptionSchema).max(1) }).safeParse(await this.call(playerId, 'channel_points/custom_rewards/redemptions', 'GET',
        { broadcaster_id: broadcasterId, reward_id: rewardId, id: redemptionId }));
      confirmed = parsed.success && parsed.data.data.length === 1 && this.sameRedemption(parsed.data.data[0]!, broadcasterId, rewardId, redemptionId, status);
    }
    if (!confirmed) throw new TwitchGiftHelixError(409);
  }
  private sameRedemption(row: z.infer<typeof redemptionSchema>, broadcasterId: string, rewardId: string, redemptionId: string, status: TwitchGiftRemoteStatus) {
    return row.id === redemptionId && row.broadcaster_id === broadcasterId && row.reward.id === rewardId && row.status === status;
  }
  async announce(playerId: string, broadcasterId: string, message: string) {
    if (!message || Array.from(message).length > 500) throw new TwitchGiftHelixError(0);
    const parsed = messageSchema.safeParse(await this.call(playerId, 'chat/messages', 'POST', {}, { broadcaster_id: broadcasterId, sender_id: broadcasterId, message }, undefined, true));
    if (!parsed.success) throw new TwitchGiftHelixError(200, true);
    if (!parsed.data.data[0]!.is_sent) throw new TwitchGiftHelixError(200);
    if (!parsed.data.data[0]!.message_id) throw new TwitchGiftHelixError(200, true);
    return parsed.data.data[0]!.message_id;
  }
}
