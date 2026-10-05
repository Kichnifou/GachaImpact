import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { TwitchCommandPilot, twitchResponseSegments, type TwitchCommandExecutor } from '../src/application/twitch/twitch-command-pilot.js';
import { TwitchCommandSendError, type TwitchCommandChatClient } from '../src/infrastructure/twitch/twitch-command-chat-client.js';
import { findChatCommand } from '../src/application/chat/chat-command-registry.js';
import { loadConfig } from '../src/config/environment.js';

const playerId = '11111111-1111-4111-8111-111111111111';
export const commandEnvelope = (text = '!pity', chatter = '123') => ({
  subscription: { id: 'subscription', type: 'channel.chat.message', version: '1', status: 'enabled',
    condition: { broadcaster_user_id: '123', user_id: '123' }, transport: { method: 'webhook', callback: 'https://api.example/api/v1/twitch/eventsub' } },
  event: { broadcaster_user_id: '123', chatter_user_id: chatter, chatter_user_login: 'untrusted', chatter_user_name: 'untrusted', message_id: 'chat-message', message: { text } },
});
async function fixture(enabled = true, arm = true) {
  const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled },
    twitch: { pilotPlayerIds: [playerId], pilotLogin: 'kichnifou' }, twitchEventSub: { enabled: true, callbackUrl: 'https://api.example/api/v1/twitch/eventsub' } };
  const receipt = { id: 'receipt', externalEventId: 'network-id', eventType: 'channel.chat.message', twitchUserId: '123', state: 'RECEIVED',
    externalReference: null as string | null, payloadMinimal: {} as Record<string, unknown>, processedAt: null, errorMessage: null };
  const identity = { playerId, twitchUserId: '123', login: 'kichnifou', player: { id: playerId, displayName: 'Fixture', elementKey: 'pyro', status: 'ACTIVE' } };
  const identityRead = vi.fn(async ({ where }: { where: { twitchUserId?: string; playerId?: string } }) => where.twitchUserId === '123' || where.playerId === playerId ? identity : null);
  const tx = { $queryRaw: vi.fn(async () => []), twitchEventReceipt: {
    findUnique: vi.fn(async () => structuredClone(receipt)),
    update: vi.fn(async ({ data }: { data: object }) => { Object.assign(receipt, structuredClone(data)); return receipt; }),
  } };
  let pending: Promise<unknown> = Promise.resolve();
  const db = { twitchIdentity: { findUnique: identityRead }, $transaction: vi.fn((action: (transaction: typeof tx) => Promise<unknown>) => {
    const result = pending.then(() => action(tx)); pending = result.catch(() => undefined); return result;
  }) } as unknown as PrismaClient;
  const executor = { execute: vi.fn(async (..._args: Parameters<TwitchCommandExecutor['execute']>) => ['Réponse validée.']) };
  const outbound = { send: vi.fn(async (..._args: Parameters<TwitchCommandChatClient['send']>) => 'sent-id') };
  const parser = vi.fn(findChatCommand);
  const subscriptions = { activationAvailable: true, inspectPilotChatSubscription: vi.fn(async (): Promise<'ACTIVE' | 'INACTIVE' | 'VERIFICATION_PENDING'> => 'ACTIVE') };
  const pilot = new TwitchCommandPilot(db, config, executor, outbound, parser, subscriptions);
  if (enabled && arm) await pilot.arm(playerId);
  return { config, receipt, identity, identityRead, executor, outbound, parser, subscriptions, db, tx, pilot };
}

describe('Kichnifou-only command pilot', () => {
  it('uses real arm/disarm as the kill switch without changing deployment capability', async () => {
    const f = await fixture(true, false); Object.freeze(f.config.twitchCommandPilot);
    expect(f.pilot.status()).toEqual({ commandPilotCapabilityEnabled: true, commandPilotArmed: false, commandPilotEnabled: false });
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    expect(f.parser).not.toHaveBeenCalled(); expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
    expect(await f.pilot.arm(playerId)).toMatchObject({ commandPilotArmed: true, commandPilotEnabled: true });
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    expect(f.parser).toHaveBeenCalledTimes(1); expect(f.executor.execute).toHaveBeenCalledTimes(1); expect(f.outbound.send).toHaveBeenCalledTimes(1);
    f.subscriptions.activationAvailable = false; // Disarm requires no healthy EventSub manager.
    const inspections = f.subscriptions.inspectPilotChatSubscription.mock.calls.length;
    expect(f.pilot.disarm(playerId)).toMatchObject({ commandPilotArmed: false, commandPilotEnabled: false });
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'new-receipt');
    expect(f.parser).toHaveBeenCalledTimes(1); expect(f.executor.execute).toHaveBeenCalledTimes(1); expect(f.outbound.send).toHaveBeenCalledTimes(1);
    expect(f.subscriptions.inspectPilotChatSubscription).toHaveBeenCalledTimes(inspections);
    expect(f.config.twitchCommandPilot.enabled).toBe(true);
  });
  it('restarts disarmed with the same capability, without persisting the arm state', async () => {
    const f = await fixture(); const writes = f.tx.twitchEventReceipt.update.mock.calls.length;
    const restarted = new TwitchCommandPilot(f.db, f.config, f.executor, f.outbound, f.parser, f.subscriptions);
    expect(f.pilot.status().commandPilotArmed).toBe(true); expect(restarted.status().commandPilotArmed).toBe(false);
    await restarted.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    expect(f.parser).not.toHaveBeenCalled(); expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
    expect(f.tx.twitchEventReceipt.update.mock.calls).toHaveLength(writes);
  });
  it('cannot arm when deployment capability is OFF', async () => {
    const f = await fixture(false);
    await expect(f.pilot.arm(playerId)).rejects.toMatchObject({ code: 'TWITCH_COMMAND_PILOT_OFF' });
    expect(f.pilot.status().commandPilotArmed).toBe(false); expect(f.identityRead).not.toHaveBeenCalled();
    expect(f.subscriptions.inspectPilotChatSubscription).not.toHaveBeenCalled();
  });
  it.each(['outside allowlist', 'unlinked', 'wrong login', 'inactive Player', 'manager unavailable', 'INACTIVE', 'VERIFICATION_PENDING', 'inspection error'])(
    'refuses arm for %s without any execution or subscription creation', async reason => {
      const f = await fixture(true, false);
      if (reason === 'outside allowlist') f.config.twitch.pilotPlayerIds = [];
      if (reason === 'unlinked') f.identityRead.mockResolvedValue(null);
      if (reason === 'wrong login') f.identity.login = 'other';
      if (reason === 'inactive Player') f.identity.player.status = 'ARCHIVED';
      if (reason === 'manager unavailable') f.subscriptions.activationAvailable = false;
      if (reason === 'INACTIVE' || reason === 'VERIFICATION_PENDING') f.subscriptions.inspectPilotChatSubscription.mockResolvedValue(reason);
      if (reason === 'inspection error') f.subscriptions.inspectPilotChatSubscription.mockRejectedValue(new Error('private upstream error'));
      await expect(f.pilot.arm(playerId)).rejects.toMatchObject({ statusCode: ['outside allowlist', 'unlinked', 'wrong login', 'inactive Player'].includes(reason) ? 403 : 409 });
      expect(f.pilot.status().commandPilotArmed).toBe(false);
      expect(f.parser).not.toHaveBeenCalled(); expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
      expect(f.db.$transaction).not.toHaveBeenCalled();
    });
  it('cancels an in-flight arm after disarm, even when inspection subsequently returns ACTIVE', async () => {
    const f = await fixture(true, false);
    let complete!: (state: 'ACTIVE') => void;
    f.subscriptions.inspectPilotChatSubscription.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    const arming = f.pilot.arm(playerId); await vi.waitFor(() => expect(f.subscriptions.inspectPilotChatSubscription).toHaveBeenCalled());
    f.pilot.disarm(playerId); complete('ACTIVE');
    await expect(arming).rejects.toMatchObject({ code: 'TWITCH_COMMAND_PILOT_OFF' });
    expect(f.pilot.status().commandPilotArmed).toBe(false);
  });
  it('rechecks disarm after asynchronous identity lookup before parsing', async () => {
    const f = await fixture(); let complete!: (value: typeof f.identity) => void;
    f.identityRead.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    const delivery = f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    f.pilot.disarm(playerId); complete(f.identity); await delivery;
    expect(f.parser).not.toHaveBeenCalled(); expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
  });
  it('does not start business when disarmed after receipt reservation', async () => {
    const f = await fixture();
    f.tx.twitchEventReceipt.update.mockImplementationOnce(async ({ data }) => {
      Object.assign(f.receipt, structuredClone(data)); f.pilot.disarm(playerId); return f.receipt;
    });
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    expect(f.parser).toHaveBeenCalledTimes(1); expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
  });
  it('stops multipart after A and resumes only B/C after re-arm without replaying business', async () => {
    const f = await fixture(); f.executor.execute.mockResolvedValue(['A', 'B', 'C']);
    f.outbound.send.mockImplementationOnce(async () => { f.pilot.disarm(playerId); return 'sent-A'; });
    await f.pilot.consumeAuthenticated(commandEnvelope(), 'receipt');
    expect(f.outbound.send.mock.calls.map(([input]) => input.message)).toEqual(['A']);
    expect((f.receipt.payloadMinimal.commandPilot as { responses: { status: string }[] }).responses.map(row => row.status)).toEqual(['SENT', 'PENDING', 'PENDING']);
    expect(f.receipt.errorMessage).toBeNull();
    await expect(f.pilot.retryResponses(playerId, 'receipt')).rejects.toMatchObject({ code: 'TWITCH_COMMAND_PILOT_OFF' });
    await f.pilot.arm(playerId); await f.pilot.retryResponses(playerId, 'receipt');
    expect(f.outbound.send.mock.calls.map(([input]) => input.message)).toEqual(['A', 'B', 'C']);
    expect(f.executor.execute).toHaveBeenCalledTimes(1); expect(f.parser).toHaveBeenCalledTimes(1);
  });
  it('keeps a certainly stopped pre-HTTP reservation PENDING without marking the committed business as failed', async () => {
    const f = await fixture();
    f.outbound.send.mockImplementationOnce(async () => {
      f.pilot.disarm(playerId); throw new TwitchCommandSendError('CERTAIN', 'PILOT_DISABLED');
    });
    await f.pilot.consumeAuthenticated(commandEnvelope('!pull 1'), 'receipt');
    expect(f.receipt.state).toBe('RECEIVED'); expect(f.receipt.errorMessage).toBeNull();
    expect((f.receipt.payloadMinimal.commandPilot as { responses: { status: string }[] }).responses[0]?.status).toBe('PENDING');
    await f.pilot.arm(playerId); await f.pilot.retryResponses(playerId, 'receipt');
    expect(f.receipt.state).toBe('PROCESSED'); expect(f.executor.execute).toHaveBeenCalledTimes(1);
  });
  it('defaults OFF independently of EventSub and rejects invalid flag values', () => {
    expect(loadConfig({ TWITCH_EVENTSUB_WEBHOOK_ENABLED: 'true', TWITCH_EVENTSUB_SECRET: 'fixture-secret-long' }).twitchCommandPilot?.enabled).toBe(false);
    expect(() => loadConfig({ TWITCH_COMMAND_PILOT_ENABLED: 'yes' })).toThrow();
  });
  it.each(['OFF', 'other author', 'unlinked', 'outside allowlist', 'wrong linked login', 'ordinary', 'bad subscription', 'wrong channel', 'wrong receiver', 'shared other channel', 'inactive Player'])(
    'eliminates %s before command parsing', async gate => {
      const f = await fixture(gate !== 'OFF'); const body = commandEnvelope(gate === 'ordinary' ? 'hello' : '!pull 1', gate === 'other author' ? '456' : '123');
      if (gate === 'unlinked') f.identityRead.mockResolvedValue(null);
      if (gate === 'outside allowlist') f.config.twitch.pilotPlayerIds = [];
      if (gate === 'wrong linked login') f.identity.login = 'different';
      if (gate === 'bad subscription') body.subscription.status = 'verification_pending';
      if (gate === 'wrong channel') body.event.broadcaster_user_id = '456';
      if (gate === 'wrong receiver') body.subscription.condition.user_id = '456';
      if (gate === 'shared other channel') Object.assign(body.event, { source_broadcaster_user_id: '456' });
      if (gate === 'inactive Player') f.identity.player.status = 'SUSPENDED';
      await f.pilot.consumeAuthenticated(body, 'receipt');
      expect(f.parser).not.toHaveBeenCalled(); expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
      expect(f.receipt.externalReference).toBeNull();
    });
  it.each(['!pity', '!banniere', '!bannière', '!ban', '!team', '!sac', '!quotis', '!quoti', '!daily', '!exp', '!expedition', '!pull', '!pull 1'])(
    'allows canonical command %s only for the exact linked ID', async text => {
      const f = await fixture(); await f.pilot.consumeAuthenticated(commandEnvelope(text), 'receipt');
      expect(f.executor.execute).toHaveBeenCalledTimes(1);
      expect(f.executor.execute.mock.calls[0]?.[0]).not.toHaveProperty('subject');
      expect(f.outbound.send).toHaveBeenCalledWith({ broadcasterId: '123', senderId: '123', message: 'Réponse validée.', replyParentMessageId: 'chat-message' }, expect.any(Function));
      expect(f.receipt.state).toBe('PROCESSED'); expect(f.receipt.externalReference).toContain('twitch-command:network-id');
    });
  it.each(['!pull 2', '!pull 10', '!pull 01', '!pull 1 extra', '!select A', '!banque', '!shop', '!conversion 1', '!ami', '!trade', '!combat', '!combat boss go', '!event join', '!concours', '!code X', '!daily claim', '!roue', '!exp A', '!exp retour', '!team 1 apply', '!sac extra', '!unknown'])(
    'silently ignores command outside the exact recipe: %s', async text => {
      const f = await fixture(); await f.pilot.consumeAuthenticated(commandEnvelope(text), 'receipt');
      expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
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
    f.pilot.disarm(playerId); await expect(f.pilot.retryResponses(playerId, 'receipt')).rejects.toThrow();
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
