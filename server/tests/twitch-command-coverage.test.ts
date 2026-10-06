import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { chatCommandRegistry, findChatCommand, parseChatCommand } from '../src/application/chat/chat-command-registry.js';
import { genericTwitchCommands, specializedTwitchCommands, twitchCommandOwner } from '../src/application/twitch/twitch-command-coverage.js';
import { twitchPlayerCommandExecutor } from '../src/application/twitch/twitch-player-command-executor.js';
import { commandMutations, thawCommandValue } from '../src/application/twitch/twitch-command-intent.js';
import type { ChatCommandServices } from '../src/application/chat/player-command-resolver.js';
import { harness } from './helpers/chat-command-harness.js';
import { commandNow, commandSource } from '../src/application/player/player-command-execution.js';

const player = { id: 'self', displayName: 'Moi', elementKey: 'pyro', status: 'ACTIVE' as const };
function fixture() {
  const h = harness();
  const db = { businessOperation: { count: vi.fn(async () => 0) }, resourceMovement: { findMany: vi.fn(async () => []) },
    playerPermanentMissionProgress: { findMany: vi.fn(async () => []) }, team: { findFirst: vi.fn(async () => null) }, playerExpedition: { findUnique: vi.fn(async () => null) } };
  const executor = twitchPlayerCommandExecutor(db as unknown as PrismaClient, h.services as unknown as ChatCommandServices);
  return { ...h, db, executor, async run(text: string) {
    const { definition, args } = parseChatCommand(text);
    const saved = await executor.prepare!(player, definition!.handler!, args, definition!.syntax, 'receipt-key');
    return { saved, output: await executor.execute(player, definition!.handler!, args, definition!.syntax, 'receipt-key', saved) };
  } };
}

describe('R1047 registry ownership', () => {
  it.each([false, true])('keeps Twitch Contest invocations opaque without preparing state reads, active=%s', async active => {
    const f = fixture();
    if (active) f.services.contestService.getCurrent.mockResolvedValue({ active: { status: 'LOBBY', participants: [{}, {}] },
      theme: { label: 'Force' }, dailyUsed: true } as never);
    for (const text of ['!concours', '!concours xxx', '!concours rejoindre A']) {
      const { saved, output } = await f.run(text);
      expect(output).toEqual(['🏆 Concours : prochainement disponible.']);
      expect(saved.mutation).toBeUndefined();
      expect(saved.reads).not.toHaveProperty('contestService.getCurrent');
    }
    expect(f.services.contestService.getCurrent).not.toHaveBeenCalled();
  });
  it('classifies every Player Twitch entry exactly once, with no stale or overlapping claim', () => {
    const eligible = chatCommandRegistry.filter(entry => entry.permission === 'PLAYER' && entry.twitch);
    const claims = [...genericTwitchCommands, ...specializedTwitchCommands];
    expect(new Set(claims).size).toBe(claims.length);
    expect([...claims].sort()).toEqual(eligible.map(entry => entry.name).sort());
    for (const entry of eligible) {
      expect(claims.filter(name => name === entry.name)).toHaveLength(1);
      expect(twitchCommandOwner(entry.name)).toBe(entry.internalChat === 'TWITCH_ONLY' ? 'SPECIALIZED_NATIVE' : 'GENERIC_NATIVE');
      for (const alias of [entry.name, ...entry.aliases]) expect(findChatCommand(alias)).toBe(entry);
    }
    expect(twitchCommandOwner('clear')).toBeUndefined();
    expect(twitchCommandOwner('future-command')).toBeUndefined();
  });
});

describe('R1047 shared resolver and frozen effects', () => {
  it.each(['!combat auto', '!event go', '!expedition A', '!shop mission', '!shop switch'])('executes an old frozen %s intent without requiring a new actor read', async text => {
    const f = fixture();
    const challenge = { execute: vi.fn(async () => ({ view: { challenge: { displayName: 'Mission', description: 'Faire 50 Pulls', progress: 0n, target: 50n, rewardPrimogems: 811n }, nextSwitchCost: 30000n }, resources: { moras: 12345n }, spentMoras: 10000n })) };
    Object.assign(f.services, { purchaseDailyChallenge: challenge, switchDailyChallenge: challenge });
    const { definition, args } = parseChatCommand(text);
    const saved = await f.executor.prepare!(player, definition!.handler!, args, definition!.syntax, 'old-key');
    // Pre-corrective intents had no actor read nor presentation name for these effects.
    delete saved.reads['socialService.actor'];
    if (definition!.handler === 'event') {
      const context = JSON.parse(saved.memory.eventContext!); delete context.player;
      saved.memory.eventContext = JSON.stringify(context);
    } else delete saved.memory.eventContext;
    const mutation = structuredClone(saved.mutation);
    f.services.socialService.actor.mockRejectedValue(new Error('new actor read must not be required'));
    const output = await f.executor.execute(player, definition!.handler!, args, definition!.syntax, 'old-key', saved);
    expect(output.length).toBeGreaterThan(0); expect(saved.mutation).toEqual(mutation);
    expect(f.services.socialService.actor).not.toHaveBeenCalled();
  });
  it.each([
    '!help', '!element pyro', '!convertir 1', '!echanger Autre 3', '!banniere', '!select A', '!vote Candidat', '!pity',
    '!pull', '!box', '!obtention A', '!stella A', '!legende', '!concours', '!top xp', '!code CODE', '!event go',
    '!team', '!passifs', '!banque deposer 25', '!sac', '!coffre', '!shop primos 1', '!mission', '!faveur', '!roue',
    '!quotis', '!expedition', '!combat go', '!ami demandes', '!infos Autre', '!liste pyro',
  ])('executes the canonical family through the shared resolver: %s', async text => {
    const f = fixture();
    const { saved, output } = await f.run(text);
    expect(output.length).toBeGreaterThan(0);
    const segments = typeof output === 'string' ? [output] : output;
    expect(segments.every(part => Array.from(part).length <= 500 && !/[\r\n]/u.test(part))).toBe(true);
    if (saved.mutation) expect(commandMutations).toContain(saved.mutation.path);
    expect(segments.join(' ')).not.toContain('Cette commande n’est pas encore disponible');
    expect(f.chat.send).not.toHaveBeenCalled();
    expect(f.chat.publishGameResult).not.toHaveBeenCalled();
  });
  it.each(['!pull 0', '!pull 01', '!pull 11', '!team 1 wrong', '!banque deposer -1', '!shop primos 0', '!combat invalid', '!expedition missing', '!event invalid', '!convertir -1'])('invalid arguments never prepare a mutation: %s', async text => {
    const f = fixture(); const { saved, output } = await f.run(text);
    expect(saved.mutation).toBeUndefined(); expect(output.length).toBeGreaterThan(0);
  });
  it('persists the target resolution and quantity before touching a domain, even after rename and balance change', async () => {
    const f = fixture(); const { definition, args } = parseChatCommand('!echanger Autre max');
    const saved = await f.executor.prepare!(player, 'echanger', args, definition!.syntax, 'trade-key');
    expect(f.services.tradeService.create).not.toHaveBeenCalled();
    expect(thawCommandValue(saved.mutation!.args)).toEqual(['self', 'other', 5n, 'trade-key', 'TWITCH']);
    f.services.tradeService.eligibility.mockResolvedValue({ player: { id: 'different', displayName: 'Autre' }, eligible: true, maximum: '999', reason: null });
    await f.executor.execute(player, 'echanger', args, definition!.syntax, 'trade-key', saved);
    expect(f.services.tradeService.create).toHaveBeenCalledWith('self', 'other', 5n, 'trade-key', 'TWITCH');
    expect(f.services.tradeService.eligibility).toHaveBeenCalledTimes(1);
  });
  it('freezes bank MAX and the command day rather than resolving them on retry', async () => {
    const f = fixture(); const args = ['deposer', 'max'];
    const saved = await f.executor.prepare!(player, 'banque', args, '!banque', 'bank-key');
    expect(thawCommandValue(saved.mutation!.args)).toMatchObject([{}, 50n, 'bank-key']);
    saved.now = '2026-01-31T22:59:59Z';
    f.services.getCurrentPlayerBank.execute.mockResolvedValue({ bankMoras: 0n, walletMoras: 999n, estimatedInterest: 0n });
    f.services.depositPlayerBankChat.execute.mockImplementation(async () => {
      expect(commandNow({ now: () => new Date('2026-02-02') }).toISOString()).toBe(saved.now.replace('Z', '.000Z'));
      expect(commandSource('UI')).toBe('TWITCH');
      return { bankMoras: 150n, walletMoras: 0n, resolvedAmount: 50n };
    });
    await f.executor.execute(player, 'banque', args, '!banque', 'bank-key', saved);
    expect(f.services.depositPlayerBankChat.execute).toHaveBeenCalledWith(expect.any(Object), 50n, 'bank-key');
  });
  it('does not reclassify an Event theme or edition when the current view changes', async () => {
    const f = fixture();
    const saved = await f.executor.prepare!(player, 'event', ['feu'], '!event', 'event-key');
    const current = await f.services.eventService.getCurrent();
    f.services.eventService.getCurrent.mockResolvedValue({ ...current, gameA: { ...current.gameA, theme: { key: 'different', label: 'Other' } } });
    await f.executor.execute(player, 'event', ['feu'], '!event', 'event-key', saved);
    expect(f.services.eventService.attemptGameA).toHaveBeenCalledWith(expect.any(Object), 'event-key', 'TWITCH');
    expect(f.services.eventService.getCurrent).toHaveBeenCalledTimes(2); // one explicit test inspection, one original preparation
  });
});
