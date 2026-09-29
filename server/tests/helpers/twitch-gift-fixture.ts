import { vi } from 'vitest';
import type { PrismaClient, TwitchGiftSupremeCredential } from '../../generated/prisma/client.js';
import type { AppConfig } from '../../src/config/environment.js';
import { TwitchEventSubSubscriptionManager } from '../../src/application/twitch/twitch-eventsub-subscription-manager.js';
import { TwitchGiftSupremeManager } from '../../src/application/twitch/twitch-gift-supreme-manager.js';
import { GIFT_SUPREME_REWARD, TWITCH_GIFT_SUPREME_SCOPES } from '../../src/application/twitch/twitch-gift-supreme-contract.js';
import { TwitchGiftCredentialCipher } from '../../src/infrastructure/twitch/twitch-gift-credential-cipher.js';
import type { TwitchEventSubClient, TwitchEventSubSubscription } from '../../src/infrastructure/twitch/twitch-eventsub-client.js';
import type { TwitchGiftReward } from '../../src/infrastructure/twitch/twitch-gift-helix-client.js';

export const giftPlayerId = '11111111-1111-4111-8111-111111111111';
export const giftKey = Buffer.alloc(32, 7).toString('base64');
export const giftConfig: AppConfig = { host: '127.0.0.1', port: 3001, frontendOrigin: 'https://game.example', supabase: {},
  twitch: { clientId: 'client', clientSecret: 'private-secret', redirectUri: 'https://api.example/api/v1/me/twitch/callback', pilotPlayerIds: [giftPlayerId], pilotLogin: 'kichnifou' },
  twitchEventSub: { enabled: true, callbackUrl: 'https://api.example/api/v1/twitch/eventsub', secret: 'event-secret' }, twitchGiftSupreme: { enabled: true, credentialKey: giftKey } };
export const giftReward = (id = 'reward-1'): TwitchGiftReward => ({ id, broadcaster_id: '12345', ...GIFT_SUPREME_REWARD, is_enabled: true });
export const linkedGiftIdentity = { playerId: giftPlayerId, twitchUserId: '12345', login: 'kichnifou', displayName: 'Kichnifou', linkedAt: new Date('2026-09-29T00:00:00Z') };
export function giftFixture(actualDb?: PrismaClient, playerId = giftPlayerId) {
  const linked = { ...linkedGiftIdentity, playerId };
  let row: TwitchGiftSupremeCredential | null = { playerId, twitchUserId: '12345', rewardId: null, scopes: [...TWITCH_GIFT_SUPREME_SCOPES], revision: 1,
    encryptedRefreshToken: new TwitchGiftCredentialCipher(giftKey).encrypt('private-refresh', playerId, '12345'), authorizedAt: new Date(), updatedAt: new Date() };
  const credential = {
    findUnique: vi.fn(async () => row),
    updateMany: vi.fn(async (args: { where: { revision?: number }; data: Omit<Partial<TwitchGiftSupremeCredential>, 'revision'> & { revision?: { increment: number } | number } }) => {
      if (!row || args.where.revision !== undefined && args.where.revision !== row.revision) return { count: 0 };
      const revision = typeof args.data.revision === 'object' ? row.revision + args.data.revision.increment : row.revision;
      row = { ...row, ...args.data, revision } as TwitchGiftSupremeCredential; return { count: 1 };
    }),
    upsert: vi.fn(async (args: { create: TwitchGiftSupremeCredential; update: Partial<TwitchGiftSupremeCredential> }) => {
      row = row ? { ...row, ...args.update, revision: row.revision + 1 } as TwitchGiftSupremeCredential : { ...args.create, revision: 1, rewardId: null, updatedAt: new Date() }; return row;
    }),
    deleteMany: vi.fn(async () => { row = null; return { count: 1 }; }),
  };
  const mocks = { twitchGiftSupremeCredential: credential, twitchIdentity: { findUnique: vi.fn(async () => linked), deleteMany: vi.fn(async () => ({ count: 1 })) } };
  const db = actualDb ?? mocks as unknown as PrismaClient;
  const state = { manageable: [] as TwitchGiftReward[], manual: [] as TwitchGiftReward[], subscriptions: [] as TwitchEventSubSubscription[], redemptionStatus: 'UNFULFILLED', message: '', failPatch: false, chatMode: 'success' };
  const network = vi.fn<typeof fetch>(async (input, options) => {
    const url = new URL(String(input)); const method = options?.method ?? 'GET'; const body = options?.body ? JSON.parse(String(options.body)) as Record<string, unknown> : {};
    if (url.pathname === '/oauth2/validate') return Response.json({ client_id: 'client', user_id: '12345', scopes: TWITCH_GIFT_SUPREME_SCOPES, expires_in: 3600 });
    // The refresh endpoint uses URLSearchParams, handled by the dedicated token network below.
    if (url.pathname.endsWith('/chat/messages')) {
      state.message = String(body['message']);
      if (state.chatMode === 'ambiguous') throw new Error('network failed after dispatch private-access');
      if (state.chatMode === 'failed') return Response.json({ error: 'private-access' }, { status: 400 });
      return Response.json({ data: [{ is_sent: true, message_id: 'chat-message-1' }] });
    }
    if (url.pathname.endsWith('/redemptions')) {
      if (method === 'PATCH') { if (state.failPatch) return Response.json({}, { status: 500 }); state.redemptionStatus = String(body['status']); }
      return Response.json({ data: [{ id: url.searchParams.get('id'), broadcaster_id: '12345', reward: { id: 'reward-1' }, status: state.redemptionStatus }] });
    }
    if (method === 'GET') return Response.json({ data: [...state.manageable, ...(url.searchParams.get('only_manageable_rewards') === 'false' ? state.manual : [])] });
    if (method === 'POST') { const reward = giftReward(); state.manageable.push(reward); return Response.json({ data: [reward] }); }
    const reward = state.manageable.find(item => item.id === url.searchParams.get('id'));
    if (!reward) return Response.json({}, { status: 404 });
    Object.assign(reward, body); return Response.json({ data: [reward] });
  });
  const request = vi.fn<typeof fetch>(async (input, options) => new URL(String(input)).pathname === '/oauth2/token'
    ? Response.json({ access_token: 'private-access', refresh_token: 'rotated-refresh', token_type: 'bearer', expires_in: 3600 }) : network(input, options));
  const list = (type: string) => vi.fn(async () => state.subscriptions.filter(item => item.type === type));
  const create = async (args: Omit<TwitchEventSubSubscription, 'id' | 'status'>) => {
    const sub = { ...args, id: `sub-${state.subscriptions.length}`, status: 'enabled' }; state.subscriptions.push(sub); return sub;
  };
  const client = { listChatSubscriptions: list('channel.chat.message'), listFavorSubscriptions: list('channel.subscribe'), listGiftSubscriptions: list('channel.subscription.gift'),
    listResubSubscriptions: list('channel.subscription.message'), listGiftSupremeSubscriptions: list('channel.channel_points_custom_reward_redemption.add'),
    createChatSubscription: vi.fn(create), createFavorSubscription: vi.fn(create), createGiftSubscription: vi.fn(create), createResubSubscription: vi.fn(create), createGiftSupremeSubscription: vi.fn(create),
    deleteSubscription: vi.fn(async (id: string) => { state.subscriptions = state.subscriptions.filter(item => item.id !== id); }) };
  const config = { ...giftConfig, twitch: { ...giftConfig.twitch!, pilotPlayerIds: [playerId] }, twitchGiftSupreme: { ...giftConfig.twitchGiftSupreme! }, twitchEventSub: { ...giftConfig.twitchEventSub! } };
  const subscriptions = new TwitchEventSubSubscriptionManager(db, config, client as unknown as TwitchEventSubClient);
  const manager = new TwitchGiftSupremeManager(db, config, subscriptions, request);
  return { db, mocks, credential, state, request, network, client, config, linked, subscriptions, manager, get row() { return row; }, set row(value: TwitchGiftSupremeCredential | null) { row = value; } };
}
