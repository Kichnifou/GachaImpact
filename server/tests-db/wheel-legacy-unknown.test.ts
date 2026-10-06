import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { verifiedPlayerActor } from '../src/application/player/player-execution-actor.js';
import { GetTodayWheelState } from '../src/application/wheel/get-today-wheel-state.js';
import { SpinDailyWheel } from '../src/application/wheel/spin-daily-wheel.js';
import { PrismaWheelStore } from '../src/infrastructure/database/prisma-wheel-store.js';
import { PlayerCommandResolver, type ChatCommandServices } from '../src/application/chat/player-command-resolver.js';
import { harness } from '../tests/helpers/chat-command-harness.js';
import { twitchPlayerCommandExecutor } from '../src/application/twitch/twitch-player-command-executor.js';
import { TwitchCommandPilot } from '../src/application/twitch/twitch-command-pilot.js';
import { businessDateToDatabaseDate } from '../src/domain/time/business-date.js';
import type { CurrentPlayer } from '../src/domain/player/current-player.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const at = new Date('2026-10-06T12:00:00Z'), clock = { now: () => at };
const store = new PrismaWheelStore(db);
const getPlayer = new GetCurrentPlayer({ findByIdentity: async () => { throw new Error('No web identity'); }, provision: async () => { throw new Error('No provisioning'); } });
const today = new GetTodayWheelState(getPlayer, store, clock);
let sequence = 0;
beforeAll(() => fixture.setup({ seedPublicCatalog: true }), 60_000);
afterAll(() => fixture.cleanup(), 60_000);

async function player(unknown = true) {
  const twitchUserId = String(910030000001 + sequence++);
  const value = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private Wheel', twitchIdentity: {
    twitchUserId, login: 'private_wheel', displayName: 'Private Wheel', firstSeenAt: at } }, at));
  const active = await db.player.update({ where: { id: value.id }, data: { elementKey: 'geo' } });
  if (unknown) await db.playerWheelDailyState.create({ data: { playerId: value.id, businessDate: businessDateToDatabaseDate('2026-10-06'),
    resultKnown: false, resultType: null, resourceKey: null, amount: null, spunAt: null,
    legacyProvenance: { snapshotHash: 'd3ee8d88582300ca6006fb85afe0801bea7c866bcce7b05ff444edd39590baf0' } } });
  return { current: active as CurrentPlayer, twitchUserId, actor: verifiedPlayerActor(active as CurrentPlayer) };
}
async function state(playerId: string) {
  return { wheel: await db.playerWheelDailyState.findMany({ where: { playerId }, orderBy: { businessDate: 'asc' } }),
    stats: await db.playerWheelStats.findUnique({ where: { playerId } }), resources: await db.playerResourceBalance.findMany({ where: { playerId }, orderBy: { resourceKey: 'asc' } }),
    operations: await db.businessOperation.findMany({ where: { playerId } }), movements: await db.resourceMovement.findMany({ where: { playerId } }),
    gacha: await db.playerGachaState.findUnique({ where: { playerId } }), daily: await db.playerDailyRewardState.findUnique({ where: { playerId } }) };
}
function services() {
  const h = harness(), draws = vi.fn(() => 99);
  const spin = new SpinDailyWheel(getPlayer, store, clock, { nextInt: draws }, 'TWITCH');
  const call = vi.spyOn(spin, 'execute');
  return { h, draws, call, spin, services: { ...h.services, getTodayWheelState: today, spinDailyWheelChat: spin } as unknown as ChatCommandServices };
}

describe('consumed legacy Wheel with unknown historical result in private PostgreSQL', () => {
  it('reads a consumed unknown result without mutation', async () => {
    const p = await player(), before = await state(p.current.id);
    expect(await today.execute(p.actor)).toEqual({ spun: true, businessDate: '2026-10-06', result: null });
    expect(await state(p.current.id)).toEqual(before);
  });
  it.each(['quotis', 'quoti', 'daily'])('returns Roue completed for !%s and shares the canonical summary', async alias => {
    const p = await player(), before = await state(p.current.id), s = services();
    const resolver = new PlayerCommandResolver(s.h.chat, s.services);
    const result = await resolver.resolve(p.actor, '!'+alias, randomUUID());
    const canonical = await resolver.resolve(p.actor, '!quotis', randomUUID());
    expect(result).toEqual(canonical); expect(Array.isArray(result) ? result.join(' ') : result).toContain('Roue ✅');
    expect(s.call).not.toHaveBeenCalled(); expect(s.draws).not.toHaveBeenCalled(); expect(await state(p.current.id)).toEqual(before);
  });
  it('answers !roue explicitly without spin, RNG, operation, movement or replacement', async () => {
    const p = await player(), before = await state(p.current.id), s = services();
    expect(await new PlayerCommandResolver(s.h.chat, s.services).resolve(p.actor, '!roue', randomUUID()))
      .toBe('⚠️ Roue déjà utilisée aujourd’hui · résultat historique indisponible. Prochaine Roue demain.');
    expect(s.call).not.toHaveBeenCalled(); expect(s.draws).not.toHaveBeenCalled(); expect(await state(p.current.id)).toEqual(before);
  });
  it('fails closed on direct SpinDailyWheel with a controlled business error and no reward', async () => {
    const p = await player(), before = await state(p.current.id), s = services();
    await expect(s.spin.execute(p.actor, randomUUID())).rejects.toMatchObject({ name: 'BusinessError', code: 'WHEEL_LEGACY_RESULT_UNKNOWN' });
    expect(s.draws).not.toHaveBeenCalled(); expect(await state(p.current.id)).toEqual(before);
  });
  it('also refuses a direct store call without rolling', async () => {
    const p = await player(), before = await state(p.current.id), roll = vi.fn();
    await expect(store.spin({ playerId: p.current.id, businessDate: '2026-10-06', spunAt: at, sourceChannel: 'UI', roll }))
      .rejects.toMatchObject({ code: 'WHEEL_LEGACY_RESULT_UNKNOWN' });
    expect(roll).not.toHaveBeenCalled(); expect(await state(p.current.id)).toEqual(before);
  });
  it('preserves an ordinary native spin and its known reminder', async () => {
    const p = await player(false), s = services();
    expect(await today.execute(p.actor)).toEqual({ spun: false, businessDate: '2026-10-06', result: null });
    const result = await s.spin.execute(p.actor, 'native-first'); expect(result.alreadySpun).toBe(false);
    const before = await state(p.current.id);
    expect(await today.execute(p.actor)).toMatchObject({ spun: true, result: { resultType: result.resultType, amount: result.amount } });
    const reminder = await new PlayerCommandResolver(s.h.chat, s.services).resolve(p.actor, '!roue', randomUUID());
    expect(reminder).toContain('Roue déjà utilisée aujourd’hui · résultat :'); expect(s.draws).toHaveBeenCalledTimes(1);
    expect(await state(p.current.id)).toEqual(before);
  });
  it('allows a real spin on the following business day without changing the old unknown row', async () => {
    const p = await player(), before = await state(p.current.id), draws = vi.fn(() => 99);
    const tomorrow = new SpinDailyWheel(getPlayer, store, { now: () => new Date('2026-10-07T12:00:00Z') }, { nextInt: draws });
    expect((await tomorrow.execute(p.actor)).alreadySpun).toBe(false); expect(draws).toHaveBeenCalledTimes(1);
    const after = await state(p.current.id); expect(after.wheel).toHaveLength(2); expect(after.wheel[0]).toEqual(before.wheel[0]);
  });
  it('traverses real Twitch PREPARE, EXECUTE and RESPONSES without an EXECUTING residue', async () => {
    const p = await player(), s = services(), before = await state(p.current.id);
    const operator = await player(false);
    await db.twitchIdentity.update({ where: { playerId: operator.current.id }, data: { login: 'kichnifou' } });
    await db.playerRoleAssignment.create({ data: { playerId: operator.current.id, role: 'ADMIN', source: 'private-wheel' } });
    const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: true, globalEnabled: false },
      twitch: { pilotPlayerIds: [operator.current.id], pilotLogin: 'kichnifou' } };
    const core = twitchPlayerCommandExecutor(db, s.services, clock), prepare = vi.fn(core.prepare!), execute = vi.fn(core.execute);
    const outbound = { send: vi.fn(async () => 'private-response') };
    const subscriptions = { activationAvailable: true, inspectPilotChatTransport: vi.fn(async () => ({ broadcasterId: operator.twitchUserId,
      receiverId: operator.twitchUserId, callback: 'https://private.example/api/v1/twitch/eventsub', subscriptionId: 'private-subscription' })) };
    const pilot = new TwitchCommandPilot(db, config, { prepare, execute, capturedAt: core.capturedAt }, outbound, undefined, subscriptions);
    await pilot.arm(operator.current.id, 'STREAMERBOT_PATH_DISABLED', [p.twitchUserId]);
    const receipt = await db.twitchEventReceipt.create({ data: { eventType: 'channel.chat.message', externalEventId: randomUUID(), twitchUserId: p.twitchUserId,
      payloadMinimal: { contentHash: 'private-wheel-chat' } } });
    await pilot.consumeAuthenticated({ subscription: { id: 'private-subscription', type: 'channel.chat.message', version: '1', status: 'enabled',
      condition: { broadcaster_user_id: operator.twitchUserId, user_id: operator.twitchUserId }, transport: { method: 'webhook', callback: 'https://private.example/api/v1/twitch/eventsub' } },
      event: { broadcaster_user_id: operator.twitchUserId, chatter_user_id: p.twitchUserId,
      chatter_user_login: 'private_wheel', chatter_user_name: 'Private Wheel', message_id: randomUUID(), message: { text: '!quotis' } } }, receipt.id);
    expect(prepare).toHaveBeenCalledTimes(1); expect(execute).toHaveBeenCalledTimes(1);
    expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ state: 'PROCESSED',
      payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'SENT' }] } } });
    expect(outbound.send).toHaveBeenCalled(); expect(s.call).not.toHaveBeenCalled(); expect(s.draws).not.toHaveBeenCalled();
    expect(await state(p.current.id)).toEqual(before);
  }, 60_000);
});
