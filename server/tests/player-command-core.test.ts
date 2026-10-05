import { describe, expect, it, vi } from 'vitest';
import { SourceChannel } from '../generated/prisma/client.js';
import { harness, commandId } from './helpers/chat-command-harness.js';
import { parsePullCount, resolvePlayerCommand, type PlayerCommandServices, type PlayerCommandHandler } from '../src/application/chat/player-command-core.js';
import { verifiedPlayerActor } from '../src/application/player/player-execution-actor.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PerformGachaPull } from '../src/application/gacha/gacha-services.js';
import type { GachaStore } from '../src/application/gacha/gacha-store.js';

const player = { id: 'player', displayName: 'Fixture', elementKey: 'hydro', status: 'ACTIVE' as const };
describe('shared player command core', () => {
  it.each(['pity', 'banniere', 'team', 'sac', 'quotis', 'expedition', 'pull'] as const)(
    'keeps authoritative %s presentation equal on both transports without publishing Twitch into GlobalChat', async handler => {
      const f = harness(); const command = handler === 'pull' ? '!pull 1' : `!${handler}`;
      const standalone = await f.send(command);
      const result = await resolvePlayerCommand(verifiedPlayerActor(player), handler as PlayerCommandHandler, handler === 'pull' ? ['1'] : [], command, commandId,
        f.services as unknown as PlayerCommandServices);
      expect((typeof result === 'string' ? [result] : result)[0]).toBe(standalone);
      const published = f.chat.publishGameResult.mock.calls.length;
      await resolvePlayerCommand(verifiedPlayerActor(player), handler, handler === 'pull' ? ['1'] : [], command, commandId, f.services as unknown as PlayerCommandServices);
      expect(f.chat.publishGameResult.mock.calls).toHaveLength(published);
      expect(f.chat.send).toHaveBeenCalledTimes(1);
      if (handler === 'pity') expect(result).toContain('Capture : 1/3');
      if (handler === 'pull') expect(JSON.stringify(result)).not.toMatch(/💧 \+0\.6%/u);
    });
  it('executes Pull as TWITCH from an opaque server Player; serialized/forged contexts cannot bypass HTTP identity', async () => {
    const identityStore = { findByIdentity: vi.fn(), provision: vi.fn() };
    const resolver = new GetCurrentPlayer(identityStore);
    const internal = verifiedPlayerActor(player);
    expect(await resolver.execute(internal)).toEqual(player);
    await expect(resolver.execute(JSON.parse(JSON.stringify(internal)))).rejects.toThrow('Invalid internal');
    expect(identityStore.findByIdentity).not.toHaveBeenCalled(); expect(identityStore.provision).not.toHaveBeenCalled();
    const pull = vi.fn(async () => ({ results: [] }));
    const service = new PerformGachaPull(resolver, { pull } as unknown as GachaStore, { now: () => new Date() }, { nextInt: () => 0 }, SourceChannel.TWITCH);
    await service.execute(internal, 1, 'network-key');
    expect(pull).toHaveBeenCalledWith(expect.objectContaining({ playerId: player.id, sourceChannel: SourceChannel.TWITCH, count: 1, idempotencyKey: 'network-key' }));
  });
});

describe('canonical pull quantity shared by transports', () => {
  it.each([{ args: [], count: 1 }, ...Array.from({ length: 10 }, (_, index) => ({ args: [String(index + 1)], count: index + 1 }))])('accepts canonical args $args', ({ args, count }) => {
    expect(parsePullCount(args)).toBe(count);
  });
  it.each(['0', '11', '-1', '01', '1.5', 'abc'])('rejects %s without reaching the engine', async arg => {
    const f = harness();
    expect(parsePullCount([arg])).toBeNull();
    expect(await resolvePlayerCommand(verifiedPlayerActor(player), 'pull', [arg], '!pull [1..10]', commandId, f.services as unknown as PlayerCommandServices)).toContain('Syntaxe');
    expect(f.services.performGachaPullChat.execute).not.toHaveBeenCalled();
  });
  it('rejects extra args', () => expect(parsePullCount(['2', 'extra'])).toBeNull());
});
