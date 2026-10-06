import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { TwitchCommandPilot, twitchResponseSegments, type TwitchCommandExecutor } from '../src/application/twitch/twitch-command-pilot.js';
import { TwitchCommandSendError, type TwitchCommandChatClient } from '../src/infrastructure/twitch/twitch-command-chat-client.js';
import { findChatCommand } from '../src/application/chat/chat-command-registry.js';
import type { PilotChatTransport } from '../src/application/twitch/twitch-eventsub-subscription-manager.js';
import type { NativeAuthorityStore, NativeAuthorityState } from '../src/application/twitch/twitch-native-authority.js';
import { loadConfig } from '../src/config/environment.js';

const playerId = '11111111-1111-4111-8111-111111111111';
export const commandEnvelope = (text = '!pity', chatter = '123') => ({
  subscription: { id: 'subscription', type: 'channel.chat.message', version: '1', status: 'enabled',
    condition: { broadcaster_user_id: '123', user_id: '123' }, transport: { method: 'webhook', callback: 'https://api.example/api/v1/twitch/eventsub' } },
  event: { broadcaster_user_id: '123', chatter_user_id: chatter, chatter_user_login: 'untrusted', chatter_user_name: 'untrusted', message_id: 'chat-message', message: { text } },
});
async function fixture(enabled = true, arm = true, receiverId = '123') {
  const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled },
    twitch: { pilotPlayerIds: [playerId], pilotLogin: 'kichnifou' }, twitchEventSub: { enabled: true, callbackUrl: 'https://api.example/api/v1/twitch/eventsub' } };
  const receipt = { id: 'receipt', externalEventId: 'network-id', eventType: 'channel.chat.message', twitchUserId: '123', state: 'RECEIVED',
    externalReference: null as string | null, payloadMinimal: {} as Record<string, unknown>, processedAt: null, errorMessage: null };
  const identity = { playerId, twitchUserId: '123', login: 'kichnifou', player: { id: playerId, displayName: 'Fixture', elementKey: 'pyro', status: 'ACTIVE' } };
  const identityRead = vi.fn(async ({ where }: { where: { twitchUserId?: string; playerId?: string } }) => where.twitchUserId === '123' || where.playerId === playerId ? identity : null);
  const tx = { $queryRaw: vi.fn(async () => []), twitchIdentity: { findUnique: identityRead }, twitchEventReceipt: {
    findUnique: vi.fn(async () => structuredClone(receipt)),
    findFirst: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
    update: vi.fn(async ({ data }: { data: object }) => { Object.assign(receipt, structuredClone(data)); return receipt; }),
  } };
  let pending: Promise<unknown> = Promise.resolve();
  const db = { twitchEventReceipt: tx.twitchEventReceipt, twitchIdentity: { findUnique: identityRead }, $transaction: vi.fn((action: (transaction: typeof tx) => Promise<unknown>) => {
    const result = pending.then(() => action(tx)); pending = result.catch(() => undefined); return result;
  }) } as unknown as PrismaClient;
  const executor = { execute: vi.fn(async (..._args: Parameters<TwitchCommandExecutor['execute']>) => ['Réponse validée.']) };
  const outbound = { send: vi.fn(async (..._args: Parameters<TwitchCommandChatClient['send']>) => 'sent-id') };
  const parser = vi.fn(findChatCommand);
  const transport: PilotChatTransport = { subscriptionId: 'subscription', broadcasterId: '123', receiverId, callback: config.twitchEventSub.callbackUrl };
  const subscriptions = { activationAvailable: true, inspectPilotChatTransport: vi.fn(async (): Promise<PilotChatTransport | null> => transport) };
  let state: NativeAuthorityState = { desiredMode: 'OFF', revision: 0, operatorPlayerId: null };
  const canaries = new Set<string>();
  const authority: NativeAuthorityStore = {
    read: async () => ({ ...state }),
    covers: async id => enabled && state.desiredMode === 'CANARY' && canaries.has(id),
    configure: async (actor, mode, ids, acknowledgement, revision) => {
      if (actor !== playerId || !config.twitch.pilotPlayerIds.includes(actor)) throw Object.assign(new Error(), { statusCode: 403, code: 'TWITCH_COMMAND_PILOT_FORBIDDEN' });
      if (revision !== undefined && revision !== state.revision) throw Object.assign(new Error(), { statusCode: 409, code: 'TWITCH_NATIVE_AUTHORITY_CHANGED' });
      if (mode !== 'OFF' && acknowledgement !== 'STREAMERBOT_PATH_DISABLED') throw new Error('ACK_REQUIRED');
      canaries.clear(); ids.forEach(id => canaries.add(id));
      state = { desiredMode: mode, revision: state.revision + 1, operatorPlayerId: actor }; return { ...state };
    },
  };
  const players = { resolve: vi.fn(async () => null) };
  const pilot = new TwitchCommandPilot(db, config, executor, outbound, parser, subscriptions, undefined, authority, players as never);
  if (enabled && arm) await pilot.arm(playerId, 'STREAMERBOT_PATH_DISABLED');
  return { config, receipt, identity, identityRead, executor, outbound, parser, subscriptions, db, tx, pilot, authority, canaries, players };
}

describe('Kichnifou-operated command pilot with independent viewer actors', () => {
  it.each(['!pity', '!pull'])('executes %s for an allowlisted viewer distinct from the transport receiver', async text => {
    const f = await fixture(true, true, '200');
    const viewerId = '22222222-2222-4222-8222-222222222222';
    const viewer = { playerId: viewerId, twitchUserId: '300', login: 'viewer', player: { ...f.identity.player, id: viewerId } };
    f.config.twitch.pilotPlayerIds.push(viewerId); f.canaries.add('300'); f.receipt.twitchUserId = '300';
    f.identityRead.mockImplementation(async ({ where }) => where.twitchUserId === '300' ? viewer : f.identity);
    const body = commandEnvelope(text, '300'); body.subscription.condition.user_id = '200';
    await f.pilot.consumeAuthenticated(body, 'receipt');
    expect(f.executor.execute).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: viewerId }), expect.any(String), expect.any(Array), expect.any(String), expect.any(String), undefined);
    expect(f.outbound.send).toHaveBeenCalledWith({ broadcasterId: '123', senderId: '200', message: 'Réponse validée.', replyParentMessageId: 'chat-message' }, expect.any(Function));
    expect(f.receipt.state).toBe('PROCESSED');
    expect(f.receipt.payloadMinimal).toMatchObject({ commandPilot: { chatterId: '300', senderId: '200', playerId: viewerId } });
  });
  it('lets the operator retry a viewer response without using the viewer as sender or repeating business', async () => {
    const f = await fixture(true, true, '200');
    const viewerId = '22222222-2222-4222-8222-222222222222';
    const viewer = { playerId: viewerId, twitchUserId: '300', login: 'viewer', player: { ...f.identity.player, id: viewerId } };
    f.config.twitch.pilotPlayerIds.push(viewerId); f.canaries.add('300'); f.receipt.twitchUserId = '300';
    f.identityRead.mockImplementation(async ({ where }) => where.twitchUserId === '300' ? viewer : where.playerId === playerId || where.twitchUserId === '123' ? f.identity : null);
    const body = commandEnvelope('!pull', '300'); body.subscription.condition.user_id = '200';
    f.outbound.send.mockRejectedValueOnce(new TwitchCommandSendError('CERTAIN', 'HTTP_429'));
    await f.pilot.consumeAuthenticated(body, 'receipt');
    await expect(f.pilot.disarm(viewerId)).rejects.toMatchObject(expect.objectContaining({ code: 'TWITCH_COMMAND_PILOT_FORBIDDEN' }));
    expect((await f.pilot.status()).commandPilotArmed).toBe(true);
    await expect(f.pilot.retryResponses(viewerId, 'receipt')).rejects.toMatchObject({ statusCode: 403 });
    expect(await f.pilot.retryResponses(playerId, 'receipt')).toEqual({ state: 'PROCESSED' });
    expect(f.executor.execute).toHaveBeenCalledTimes(1);
    expect(f.outbound.send.mock.calls.map(([input]) => input.senderId)).toEqual(['200', '200']);
  });
  it.each(['unknown viewer', 'inactive viewer', 'unlisted viewer', 'wrong subscription', 'wrong channel', 'wrong receiver', 'wrong callback', 'external shared chat'])(
    'rejects %s independently of the operator/receiver identity', async gate => {
      const f = await fixture(true, true, '200'), viewerId = '22222222-2222-4222-8222-222222222222';
      const viewer = { playerId: viewerId, twitchUserId: '300', login: 'kichnifou', player: { ...f.identity.player, id: viewerId } };
      f.receipt.twitchUserId = '300';
      if (gate !== 'unlisted viewer') { f.config.twitch.pilotPlayerIds.push(viewerId); f.canaries.add('300'); }
      if (gate === 'inactive viewer') viewer.player.status = 'ARCHIVED';
      f.identityRead.mockImplementation(async ({ where }) => where.twitchUserId === '300' && gate !== 'unknown viewer' ? viewer : null);
      const body = commandEnvelope('!pull', '300'); body.subscription.condition.user_id = '200';
      if (gate === 'wrong subscription') body.subscription.id = 'unapproved';
      if (gate === 'wrong channel') body.event.broadcaster_user_id = body.subscription.condition.broadcaster_user_id = '400';
      if (gate === 'wrong receiver') body.subscription.condition.user_id = '300';
      if (gate === 'wrong callback') body.subscription.transport.callback += '/other';
      if (gate === 'external shared chat') Object.assign(body.event, { source_broadcaster_user_id: '400' });
      await f.pilot.consumeAuthenticated(body, 'receipt');
      expect(f.parser).not.toHaveBeenCalled(); expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
      expect(f.db.$transaction).not.toHaveBeenCalled();
  });
  it('does not substitute a new receiver for a response reserved in the original transport', async () => {
    const f = await fixture(true, true, '200');
    const body = commandEnvelope('!pull'); body.subscription.condition.user_id = '200';
    f.outbound.send.mockRejectedValueOnce(new TwitchCommandSendError('CERTAIN', 'HTTP_429'));
    await f.pilot.consumeAuthenticated(body, 'receipt');
    await f.pilot.disarm(playerId);
    f.subscriptions.inspectPilotChatTransport.mockResolvedValue({ subscriptionId: 'subscription', broadcasterId: '123', receiverId: '201', callback: f.config.twitchEventSub.callbackUrl });
    await f.pilot.arm(playerId, 'STREAMERBOT_PATH_DISABLED'); body.subscription.condition.user_id = '201';
    await expect(f.pilot.consumeAuthenticated(body, 'receipt')).rejects.toMatchObject({ code: 'TWITCH_COMMAND_RESPONSE_TRANSPORT_CHANGED' });
    await expect(f.pilot.retryResponses(playerId, 'receipt')).rejects.toMatchObject({ statusCode: 404 });
    expect(f.executor.execute).toHaveBeenCalledTimes(1); expect(f.outbound.send).toHaveBeenCalledTimes(1);
    expect(f.receipt.payloadMinimal).toMatchObject({ commandPilot: { senderId: '200' } });
  });
  it('uses real arm/disarm as the kill switch without changing deployment capability', async () => {
    const f = await fixture(true, false); Object.freeze(f.config.twitchCommandPilot);
    expect(await f.pilot.status()).toMatchObject({ commandPilotCapabilityEnabled: true, commandPilotArmed: false, commandPilotEnabled: false });
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    expect(f.parser).not.toHaveBeenCalled(); expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
    expect(await f.pilot.arm(playerId, 'STREAMERBOT_PATH_DISABLED')).toMatchObject({ commandPilotArmed: true, commandPilotEnabled: true });
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    expect(f.parser).toHaveBeenCalledTimes(1); expect(f.executor.execute).toHaveBeenCalledTimes(1); expect(f.outbound.send).toHaveBeenCalledTimes(1);
    f.subscriptions.activationAvailable = false; // Disarm requires no healthy EventSub manager.
    const inspections = f.subscriptions.inspectPilotChatTransport.mock.calls.length;
    expect(await f.pilot.disarm(playerId)).toMatchObject({ commandPilotArmed: false, commandPilotEnabled: false });
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'new-receipt');
    expect(f.parser).toHaveBeenCalledTimes(1); expect(f.executor.execute).toHaveBeenCalledTimes(1); expect(f.outbound.send).toHaveBeenCalledTimes(1);
    expect(f.subscriptions.inspectPilotChatTransport).toHaveBeenCalledTimes(inspections);
    expect(f.config.twitchCommandPilot.enabled).toBe(true);
  });
  it('reconstructs with the same desired authority and revalidates transport', async () => {
    const f = await fixture(); const writes = f.tx.twitchEventReceipt.update.mock.calls.length;
    const restarted = new TwitchCommandPilot(f.db, f.config, f.executor, f.outbound, f.parser, f.subscriptions, undefined, f.authority, f.players as never);
    expect((await f.pilot.status()).commandPilotArmed).toBe(true); expect((await restarted.status()).commandPilotArmed).toBe(true);
    await restarted.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    expect(f.parser).toHaveBeenCalledTimes(1); expect(f.executor.execute).toHaveBeenCalledTimes(1); expect(f.outbound.send).toHaveBeenCalledTimes(1);
    expect(f.tx.twitchEventReceipt.update.mock.calls.length).toBeGreaterThan(writes);
  });
  it('cannot arm when deployment capability is OFF', async () => {
    const f = await fixture(false);
    await expect(f.pilot.arm(playerId, 'STREAMERBOT_PATH_DISABLED')).rejects.toMatchObject({ code: 'TWITCH_COMMAND_PILOT_OFF' });
    expect((await f.pilot.status()).commandPilotArmed).toBe(false); expect(f.identityRead).not.toHaveBeenCalled();
    expect(f.subscriptions.inspectPilotChatTransport).not.toHaveBeenCalled();
  });
  it.each(['outside allowlist', 'unlinked', 'wrong login', 'inactive Player', 'manager unavailable', 'INACTIVE', 'VERIFICATION_PENDING', 'inspection error'])(
    'refuses arm for %s without any execution or subscription creation', async reason => {
      const f = await fixture(true, false);
      if (reason === 'outside allowlist') f.config.twitch.pilotPlayerIds = [];
      if (reason === 'unlinked') f.identityRead.mockResolvedValue(null);
      if (reason === 'wrong login') f.identity.login = 'other';
      if (reason === 'inactive Player') f.identity.player.status = 'ARCHIVED';
      if (reason === 'manager unavailable') f.subscriptions.activationAvailable = false;
      if (reason === 'INACTIVE' || reason === 'VERIFICATION_PENDING') f.subscriptions.inspectPilotChatTransport.mockResolvedValue(null);
      if (reason === 'inspection error') f.subscriptions.inspectPilotChatTransport.mockRejectedValue(new Error('private upstream error'));
      await expect(f.pilot.arm(playerId, 'STREAMERBOT_PATH_DISABLED')).rejects.toMatchObject({ statusCode: ['outside allowlist', 'unlinked', 'wrong login', 'inactive Player'].includes(reason) ? 403 : 409 });
      expect((await f.pilot.status()).commandPilotArmed).toBe(false);
      expect(f.parser).not.toHaveBeenCalled(); expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
      expect(f.db.$transaction).not.toHaveBeenCalled();
    });
  it('cancels an in-flight arm after disarm, even when inspection subsequently returns ACTIVE', async () => {
    const f = await fixture(true, false);
    let complete!: (state: PilotChatTransport) => void;
    f.subscriptions.inspectPilotChatTransport.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    const arming = f.pilot.arm(playerId, 'STREAMERBOT_PATH_DISABLED'); await vi.waitFor(() => expect(f.subscriptions.inspectPilotChatTransport).toHaveBeenCalled());
    await f.pilot.disarm(playerId); complete({ subscriptionId: 'subscription', broadcasterId: '123', receiverId: '123', callback: f.config.twitchEventSub.callbackUrl });
    await expect(arming).rejects.toMatchObject({ code: 'TWITCH_NATIVE_AUTHORITY_CHANGED' });
    expect((await f.pilot.status()).commandPilotArmed).toBe(false);
  });
  it('rechecks disarm after asynchronous identity lookup before parsing', async () => {
    const f = await fixture(); let complete!: (value: typeof f.identity) => void;
    f.identityRead.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    const delivery = f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
    await f.pilot.disarm(playerId); complete(f.identity); await delivery;
    expect(f.parser).not.toHaveBeenCalled(); expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
  });
  it('does not start business when disarmed after receipt reservation', async () => {
    const f = await fixture();
    f.tx.twitchEventReceipt.update.mockImplementationOnce(async ({ data }) => {
      Object.assign(f.receipt, structuredClone(data)); await f.pilot.disarm(playerId); return f.receipt;
    });
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    expect(f.parser).toHaveBeenCalledTimes(1); expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
  });
  it('stops multipart after A and resumes only B/C after re-arm without replaying business', async () => {
    const f = await fixture(); f.executor.execute.mockResolvedValue(['A', 'B', 'C']);
    f.outbound.send.mockImplementationOnce(async () => { await f.pilot.disarm(playerId); return 'sent-A'; });
    await f.pilot.consumeAuthenticated(commandEnvelope(), 'receipt');
    expect(f.outbound.send.mock.calls.map(([input]) => input.message)).toEqual(['A']);
    expect((f.receipt.payloadMinimal.commandPilot as { responses: { status: string }[] }).responses.map(row => row.status)).toEqual(['SENT', 'PENDING', 'PENDING']);
    expect(f.receipt.errorMessage).toBeNull();
    await expect(f.pilot.retryResponses(playerId, 'receipt')).rejects.toMatchObject({ code: 'TWITCH_COMMAND_PILOT_OFF' });
    await f.pilot.arm(playerId, 'STREAMERBOT_PATH_DISABLED'); await f.pilot.retryResponses(playerId, 'receipt');
    expect(f.outbound.send.mock.calls.map(([input]) => input.message)).toEqual(['A', 'B', 'C']);
    expect(f.executor.execute).toHaveBeenCalledTimes(1); expect(f.parser).toHaveBeenCalledTimes(1);
  });
  it('keeps a certainly stopped pre-HTTP reservation PENDING without marking the committed business as failed', async () => {
    const f = await fixture();
    f.outbound.send.mockImplementationOnce(async () => {
      await f.pilot.disarm(playerId); throw new TwitchCommandSendError('CERTAIN', 'PILOT_DISABLED');
    });
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    expect(f.receipt.state).toBe('RECEIVED'); expect(f.receipt.errorMessage).toBeNull();
    expect((f.receipt.payloadMinimal.commandPilot as { responses: { status: string }[] }).responses[0]?.status).toBe('PENDING');
    await f.pilot.arm(playerId, 'STREAMERBOT_PATH_DISABLED'); await f.pilot.retryResponses(playerId, 'receipt');
    expect(f.receipt.state).toBe('PROCESSED'); expect(f.executor.execute).toHaveBeenCalledTimes(1);
  });
  it('defaults OFF independently of EventSub and rejects invalid flag values', () => {
    expect(loadConfig({ TWITCH_EVENTSUB_WEBHOOK_ENABLED: 'true', TWITCH_EVENTSUB_SECRET: 'fixture-secret-long' }).twitchCommandPilot?.enabled).toBe(false);
    expect(() => loadConfig({ TWITCH_COMMAND_PILOT_ENABLED: 'yes' })).toThrow();
  });
  it.each(['OFF', 'other author', 'unlinked', 'outside allowlist', 'ordinary', 'bad subscription', 'wrong channel', 'wrong receiver', 'shared other channel', 'inactive Player'])(
    'eliminates %s before command parsing', async gate => {
      const f = await fixture(gate !== 'OFF'); const body = commandEnvelope(gate === 'ordinary' ? 'hello' : '!pull 1', gate === 'other author' ? '456' : '123');
      if (gate === 'unlinked') f.identityRead.mockResolvedValue(null);
      if (gate === 'outside allowlist') f.config.twitch.pilotPlayerIds = [];
      if (gate === 'bad subscription') body.subscription.status = 'verification_pending';
      if (gate === 'wrong channel') body.event.broadcaster_user_id = '456';
      if (gate === 'wrong receiver') body.subscription.condition.user_id = '456';
      if (gate === 'shared other channel') Object.assign(body.event, { source_broadcaster_user_id: '456' });
      if (gate === 'inactive Player') f.identity.player.status = 'SUSPENDED';
      await f.pilot.consumeAuthenticated(body, 'receipt');
      expect(f.parser).not.toHaveBeenCalled(); expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
      expect(f.receipt.externalReference).toBeNull();
    });
  it.each(['!pity', '!banniere', '!bannière', '!ban', '!team', '!sac', '!quotis', '!quoti', '!daily', '!exp', '!expedition', '!pull', '!pull 1', '!pull 2', '!pull 3', '!pull 9', '!pull 10'])(
    'allows canonical command %s only for the exact linked ID', async text => {
      const f = await fixture(); await f.pilot.consumeAuthenticated(commandEnvelope(text), 'receipt');
      expect(f.executor.execute).toHaveBeenCalledTimes(1);
      expect(f.executor.execute.mock.calls[0]?.[0]).not.toHaveProperty('subject');
      expect(f.outbound.send).toHaveBeenCalledWith({ broadcasterId: '123', senderId: '123', message: 'Réponse validée.', replyParentMessageId: 'chat-message' }, expect.any(Function));
      expect(f.receipt.state).toBe('PROCESSED'); expect(f.receipt.externalReference).toContain('twitch-command:123:chat-message');
    });
  it.each(['!conversion 1', '!trade', '!unknown', '!clear', '!wish', '!giveaway stats'])('keeps unknown/internal/specialized commands out of the generic bridge: %s', async text => {
    const f = await fixture(); await f.pilot.consumeAuthenticated(commandEnvelope(text), 'receipt');
    expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
  });
  it('uses the immutable User ID even after a linked login changes', async () => {
    const f = await fixture(); f.identity.login = 'renamed';
    await f.pilot.consumeAuthenticated(commandEnvelope('!pity'), 'receipt');
    expect(f.executor.execute).toHaveBeenCalledTimes(1);
  });
  it('serializes duplicates and emits neither a second business call nor a second completed response', async () => {
    const f = await fixture(); const body = commandEnvelope('!pull 1');
    await Promise.all([f.pilot.consumeAuthenticated(body, 'receipt'), f.pilot.consumeAuthenticated(body, 'receipt')]);
    await f.pilot.consumeAuthenticated(body, 'receipt');
    expect(f.executor.execute).toHaveBeenCalledTimes(1); expect(f.outbound.send).toHaveBeenCalledTimes(1);
  });
  it('retries only a certainly rejected response without replaying the confirmed business result', async () => {
    const f = await fixture(); f.outbound.send.mockRejectedValueOnce(new TwitchCommandSendError('CERTAIN', 'HTTP_429'));
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    expect(f.receipt.state).toBe('FAILED');
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    expect(f.executor.execute).toHaveBeenCalledTimes(1); expect(f.outbound.send).toHaveBeenCalledTimes(2); expect(f.receipt.state).toBe('PROCESSED');
  });
  it('never auto-retries an ambiguous outbound and respects the kill switch on response-only retries', async () => {
    const f = await fixture(); f.outbound.send.mockRejectedValueOnce(new TwitchCommandSendError('AMBIGUOUS', 'NETWORK'));
    await f.pilot.consumeAuthenticated(commandEnvelope(), 'receipt'); await f.pilot.consumeAuthenticated(commandEnvelope(), 'receipt');
    expect(f.outbound.send).toHaveBeenCalledTimes(1); expect(f.executor.execute).toHaveBeenCalledTimes(1);
    const rejected = await fixture(); rejected.outbound.send.mockRejectedValueOnce(new TwitchCommandSendError('CERTAIN', 'HTTP_403'));
    await rejected.pilot.consumeAuthenticated(commandEnvelope(), 'receipt'); rejected.pilot.disarm(playerId);
    await rejected.pilot.consumeAuthenticated(commandEnvelope(), 'receipt'); expect(rejected.outbound.send).toHaveBeenCalledTimes(1);
  });
  it('keeps every presentation segment and bounds Unicode without dropping a long response', () => {
    const result = twitchResponseSegments(['A', '💠'.repeat(1001), 'B']);
    expect(result.map(text => Array.from(text).length)).toEqual([1, 500, 500, 1, 1]);
    expect(result.join('')).toBe('A' + '💠'.repeat(1001) + 'B');
  });
  it('operator recovery reaches response only and rejects another Player, disabled gate and uncertain sends', async () => {
    const f = await fixture(); f.outbound.send.mockRejectedValueOnce(new TwitchCommandSendError('CERTAIN', 'HTTP_429'));
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    await expect(f.pilot.retryResponses('other-player', 'receipt')).rejects.toThrow();
    expect(await f.pilot.retryResponses(playerId, 'receipt')).toEqual({ state: 'PROCESSED' });
    expect(f.executor.execute).toHaveBeenCalledTimes(1); expect(f.parser).toHaveBeenCalledTimes(1);
    expect(f.outbound.send).toHaveBeenCalledTimes(2);
    await f.pilot.retryResponses(playerId, 'receipt'); expect(f.outbound.send).toHaveBeenCalledTimes(2);
    await f.pilot.disarm(playerId); await expect(f.pilot.retryResponses(playerId, 'receipt')).rejects.toThrow();
    const uncertain = await fixture(); uncertain.outbound.send.mockRejectedValueOnce(new TwitchCommandSendError('AMBIGUOUS', 'NETWORK'));
    await uncertain.pilot.consumeAuthenticated(commandEnvelope(), 'receipt');
    await expect(uncertain.pilot.retryResponses(playerId, 'receipt')).rejects.toMatchObject({ code: 'TWITCH_COMMAND_RESPONSE_AMBIGUOUS' });
    expect(uncertain.outbound.send).toHaveBeenCalledTimes(1);
  });
  it('resumes multipart responses after a certain rejection without resending a confirmed segment', async () => {
    const f = await fixture(); f.executor.execute.mockResolvedValue(['A', 'B', 'C']);
    f.outbound.send.mockResolvedValueOnce('sent-A').mockRejectedValueOnce(new TwitchCommandSendError('CERTAIN', 'HTTP_429'));
    await f.pilot.consumeAuthenticated(commandEnvelope(), 'receipt');
    await f.pilot.retryResponses(playerId, 'receipt');
    expect(f.outbound.send.mock.calls.map(([input]) => input.message)).toEqual(['A', 'B', 'B', 'C']);
    expect(f.executor.execute).toHaveBeenCalledTimes(1);
  });
  it('rejects foreign receipts and a crashed SENDING reservation without replay or resend', async () => {
    const f = await fixture(); f.outbound.send.mockRejectedValueOnce(new TwitchCommandSendError('CERTAIN', 'HTTP_429'));
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    f.receipt.twitchUserId = '456';
    await expect(f.pilot.retryResponses(playerId, 'receipt')).rejects.toMatchObject({ statusCode: 404 });
    f.receipt.twitchUserId = '123';
    const saved = f.receipt.payloadMinimal.commandPilot as { responses: { status: string }[] };
    saved.responses[0]!.status = 'SENDING';
    await expect(f.pilot.retryResponses(playerId, 'receipt')).rejects.toMatchObject({ code: 'TWITCH_COMMAND_RESPONSE_AMBIGUOUS' });
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    expect(f.executor.execute).toHaveBeenCalledTimes(1); expect(f.outbound.send).toHaveBeenCalledTimes(1);
  });
});

describe('multi-pull transport', () => {
  const results = ['[1/3] A', '[2/3] B', '[3/3] C'];
  it('parses and executes once, persists three responses and sends each in order', async () => {
    const f = await fixture(); f.executor.execute.mockResolvedValue(results);
    const body = commandEnvelope('!pull 3');
    await f.pilot.consumeAuthenticated(body, 'receipt');
    expect(f.parser).toHaveBeenCalledExactlyOnceWith('pull');
    expect(f.executor.execute).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: playerId }), 'pull', ['3'], expect.any(String), 'twitch-command:123:chat-message', undefined);
    expect(f.receipt.payloadMinimal).toMatchObject({ commandPilot: { responses: results.map(text => ({ text, status: 'SENT' })) } });
    expect(f.outbound.send.mock.calls.map(([input]) => input.message)).toEqual(results);
    await f.pilot.consumeAuthenticated(body, 'receipt');
    expect(f.executor.execute).toHaveBeenCalledTimes(1); expect(f.outbound.send).toHaveBeenCalledTimes(3);
  });
  it('resumes results B and C only after certain rejection, without parsing or executing again', async () => {
    const f = await fixture(); f.executor.execute.mockResolvedValue(results);
    f.outbound.send.mockResolvedValueOnce('sent-A').mockRejectedValueOnce(new TwitchCommandSendError('CERTAIN', 'HTTP_429'));
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 3'), 'receipt');
    expect(f.outbound.send.mock.calls.map(([input]) => input.message)).toEqual(results.slice(0, 2));
    expect(f.receipt.payloadMinimal).toMatchObject({ commandPilot: { responses: [{ status: 'SENT' }, { status: 'FAILED' }, { status: 'PENDING' }] } });
    await f.pilot.retryResponses(playerId, 'receipt');
    expect(f.outbound.send.mock.calls.map(([input]) => input.message)).toEqual([results[0], results[1], results[1], results[2]]);
    expect(f.parser).toHaveBeenCalledTimes(1); expect(f.executor.execute).toHaveBeenCalledTimes(1);
    expect(f.receipt.state).toBe('PROCESSED');
  });
});
