import { afterEach, expect, it, vi } from 'vitest';
import { withTwitchCommandTiming, twitchTimingPhase, twitchTimingMark, twitchTimingDimensions } from '../src/application/twitch/twitch-command-timing.js';
import { TwitchCommandChatClient } from '../src/infrastructure/twitch/twitch-command-chat-client.js';
afterEach(() => vi.restoreAllMocks());
it('retains cold and pending classification through later warm revalidations', async () => {
  const emit = vi.fn();
  await withTwitchCommandTiming(performance.now(), 'pull', 10, emit, async () => {
    twitchTimingDimensions({ transport: 'cold', token: 'pending' }); twitchTimingDimensions({ transport: 'warm', token: 'warm' });
  });
  expect(emit.mock.calls[0]![0].dimensions).toEqual({ transport: 'cold', token: 'pending' });
});
it('records monotonic phases and first response separately from durable confirmation, without content or credentials', async () => {
  let clock = 0; vi.spyOn(performance, 'now').mockImplementation(() => clock += 10);
  const emit = vi.fn(), tokens = { getToken: async () => 'SECRET_TOKEN', invalidate: () => undefined };
  const client = new TwitchCommandChatClient('SECRET_CLIENT', tokens, (async () => new Response(JSON.stringify({ data: [{ is_sent: true, message_id: 'PRIVATE_RESPONSE_ID' }] }))) as typeof fetch);
  await withTwitchCommandTiming(0, 'pull', 10, emit, async () => {
    await twitchTimingPhase('observation', async () => undefined);
    twitchTimingMark('firstSendAttempt');
    await client.send({ broadcasterId: '123', senderId: '456', message: 'PRIVATE_CONTENT' }, async () => true);
    twitchTimingMark('firstDurableSent'); twitchTimingMark('lastDurableSent');
  });
  expect(emit.mock.calls[0]![0]).toMatchObject({ handler: 'pull', pullCount: 10, processingOutcome: 'RETURNED', phases: { observation: { count: 1, failed: 0 }, token: { count: 1 }, finalAuthority: { count: 1 }, helix: { count: 1 } } });
  const json = JSON.stringify(emit.mock.calls); expect(json).not.toMatch(/SECRET|PRIVATE|123|456/u);
  const markers = emit.mock.calls[0]![0].markers;
  expect(markers.firstHttpConfirmed).toBeGreaterThan(markers.firstHttpAttempt); expect(markers.firstDurableSent).toBeGreaterThan(markers.firstHttpConfirmed);
});
it('reports partial failure without a false response marker or raw error, and never fails business on logging', async () => {
  const emit = vi.fn();
  await expect(withTwitchCommandTiming(performance.now(), 'pity', undefined, emit, () => twitchTimingPhase('authority', async () => { throw Error('PRIVATE_ERROR'); }))).rejects.toThrow('PRIVATE_ERROR');
  expect(emit.mock.calls[0]![0]).toMatchObject({ processingOutcome: 'THREW', phases: { authority: { count: 1, failed: 1 } }, markers: {} });
  expect(JSON.stringify(emit.mock.calls)).not.toContain('PRIVATE_ERROR');
  expect(await withTwitchCommandTiming(performance.now(), 'pity', undefined, () => { throw Error('logger'); }, async () => 42)).toBe(42);
});
