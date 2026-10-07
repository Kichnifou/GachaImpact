import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetCurrentGacha, PerformGachaPull } from '../src/application/gacha/gacha-services.js';
import { PermanentMissionService } from '../src/application/missions/permanent-mission-service.js';
import { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';
import type { ExecutingPityRecoveryRequest } from '../src/application/twitch/executing-pity-recovery-contract.js';
import { PrismaGachaStore } from '../src/infrastructure/database/prisma-gacha-store.js';
import { SocialService } from '../src/application/social/social-service.js';
import { ContestService } from '../src/application/contest/contest-service.js';
import { verifiedPlayerActor } from '../src/application/player/player-execution-actor.js';
import { TwitchCommandPilot, type TwitchCommandExecutor } from '../src/application/twitch/twitch-command-pilot.js';
import { TwitchMessageActivity } from '../src/application/twitch/twitch-message-activity.js';
import { twitchPlayerCommandExecutor } from '../src/application/twitch/twitch-player-command-executor.js';
import { harness } from '../tests/helpers/chat-command-harness.js';
import type { ChatCommandServices } from '../src/application/chat/player-command-resolver.js';

const isolated = isolatedBatchDatabase(), db = isolated.database;
const config = { host: 'localhost', port: 3001, supabase: {}, twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' },
  twitchCommandPilot: { enabled: true }, twitchEventSub: { enabled: true, callbackUrl: 'https://private.example/api/v1/twitch/eventsub' } };
const subscriptions = { activationAvailable: true, inspectPilotChatTransport: async () => ({ subscriptionId: 'private-subscription', broadcasterId: '123', receiverId: '123', callback: config.twitchEventSub.callbackUrl }) };
const outbound = { send: vi.fn(async () => randomUUID()) };
let player: Awaited<ReturnType<typeof db.player.findUniqueOrThrow>>;
let core: TwitchCommandExecutor, gacha: GetCurrentGacha, contest: ContestService;
let businessAt: string;
const pilot = (executor = core) => new TwitchCommandPilot(db, config, executor, outbound, undefined, subscriptions);
beforeAll(async () => {
  await isolated.setup({ seedPublicCatalog: true });
  player = await db.player.create({ data: { displayName: 'Private recovery actor', elementKey: 'hydro', gachaState: { create: {} },
    economyStats: { create: {} }, dailyRewardState: { create: {} }, wheelStats: { create: {} }, progression: { create: {} } } });
  await db.twitchIdentity.create({ data: { playerId: player.id, twitchUserId: '123', login: 'kichnifou' } });
  await db.playerRoleAssignment.create({ data: { playerId: player.id, role: 'ADMIN', source: 'private-test' } });
  config.twitch.pilotPlayerIds = [player.id];
  const store = new PrismaGachaStore(db), banner = await store.getCurrent(player.id);
  if (!banner) throw new Error('PRIVATE_BANNER_REQUIRED');
  businessAt = new Date((banner.banner.startsAt.getTime() + banner.banner.endsAt.getTime()) / 2).toISOString();
  const clock = { now: () => new Date(businessAt) };
  await db.$transaction(tx => new PermanentMissionService(new PrismaEconomyService()).initializePlayer(tx, player.id, clock.now(), true));
  await db.playerResourceBalance.createMany({ data: (await db.resourceDefinition.findMany({ where: { isActive: true } })).map(r => ({ playerId: player.id, resourceKey: r.key, amount: r.key === 'primogems' ? 10000n : 0n })) });
  await db.playerGachaState.update({ where: { playerId: player.id }, data: { selectedBannerCharacterId: banner.banner.featuredFiveStars[0]!.id } });
  const getPlayer = new GetCurrentPlayer({ findByIdentity: async () => { throw new Error('No web resolution'); }, provision: async () => { throw new Error('No provisioning'); } });
  gacha = new GetCurrentGacha(getPlayer, store);
  contest = new ContestService(getPlayer, db, clock, { nextInt: () => 0 });
  core = twitchPlayerCommandExecutor(db, { ...harness().services, getCurrentGacha: gacha, socialService: new SocialService(getPlayer, db, clock),
    performGachaPullChat: new PerformGachaPull(getPlayer, store, clock, { nextInt: upper => upper - 1 }, 'TWITCH') } as unknown as ChatCommandServices, clock);
  await pilot().arm(player.id, 'STREAMERBOT_PATH_DISABLED');
}, 60_000);
afterAll(() => isolated.cleanup(), 60_000);

function envelope(messageId: string, text = '!pity') {
  return { subscription: { id: 'private-subscription', type: 'channel.chat.message', version: '1', status: 'enabled',
    condition: { broadcaster_user_id: '123', user_id: '123' }, transport: { method: 'webhook', callback: config.twitchEventSub.callbackUrl } },
    event: { broadcaster_user_id: '123', chatter_user_id: '123', message_id: messageId, message: { text } } };
}
async function reserved(handler = 'pity', args: string[] = []) {
  const messageId = randomUUID(), commandKey = `twitch-command:123:${messageId}`;
  const saved = { version: 1, playerId: player.id, actorName: player.displayName, senderId: '123', chatterId: '123', broadcasterId: '123',
    replyParentMessageId: messageId, commandKey, handler, args, businessAt, stage: 'EXECUTING', responses: [] };
  const receipt = await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(), eventType: 'channel.chat.message', twitchUserId: '123',
    state: 'RECEIVED', externalReference: `command-pilot:${commandKey}`, payloadMinimal: { commandPilot: saved } } });
  return { receipt, saved, messageId };
}
async function gameplay() {
  return { operations: await db.businessOperation.findMany(), movements: await db.resourceMovement.findMany(),
    pulls: await db.pullOperation.findMany(), gacha: await db.playerGachaState.findUniqueOrThrow({ where: { playerId: player.id } }),
    resources: await db.playerResourceBalance.findMany({ orderBy: { resourceKey: 'asc' } }), characters: await db.playerCharacter.findMany(),
    progression: await db.playerProgression.findMany(), bank: await db.playerBankAccount.findMany(), daily: await db.playerDailyRewardState.findMany() };
}
async function requestFor(row: Awaited<ReturnType<typeof reserved>>): Promise<ExecutingPityRecoveryRequest> {
  return { operatorPlayerId: player.id, receiptId: row.receipt.id, expectedPlayerId: player.id, twitchUserId: '123',
    expectedRevision: (await db.twitchNativeAuthority.findUniqueOrThrow({ where: { id: 'twitch-commands' } })).revision,
    commandKey: row.saved.commandKey, businessAt, acknowledgement: 'STREAMERBOT_PATH_DISABLED' };
}
async function setSaved(row: Awaited<ReturnType<typeof reserved>>, patch: Prisma.JsonObject) {
  await db.twitchEventReceipt.update({ where: { id: row.receipt.id }, data: { payloadMinimal: { commandPilot: { ...row.saved, ...patch } } } });
}
async function refused(row: Awaited<ReturnType<typeof reserved>>, request?: ExecutingPityRecoveryRequest) {
  const before = await gameplay(), receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: row.receipt.id } });
  const sends = outbound.send.mock.calls.length, audits = await db.twitchNativeAudit.count();
  const executor = { ...core, prepare: vi.fn(core.prepare!) };
  await expect(pilot(executor).recoverExecutingPity(request ?? await requestFor(row), true)).rejects.toBeDefined();
  expect(executor.prepare).not.toHaveBeenCalled(); expect(await gameplay()).toEqual(before);
  expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: row.receipt.id } })).toEqual(receipt);
  expect(outbound.send).toHaveBeenCalledTimes(sends); expect(await db.twitchNativeAudit.count()).toBe(audits);
}
describe('EXECUTING without intent in a private pool of three', () => {
  it('resumes the same authenticated delivery after interruption and preserves its key/time', async () => {
    const messageId = randomUUID();
    const receipt = await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(), eventType: 'channel.chat.message', twitchUserId: '123', state: 'RECEIVED', payloadMinimal: {} } });
    const interrupted = pilot({ ...core, prepare: async () => { throw new Error('PRIVATE_INTERRUPTION_AFTER_RESERVATION'); } });
    await expect(interrupted.consumeAuthenticated(envelope(messageId), receipt.id)).rejects.toThrow('PRIVATE_INTERRUPTION_AFTER_RESERVATION');
    const before = await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receipt.id } });
    const saved = (before.payloadMinimal as Prisma.JsonObject).commandPilot as Prisma.JsonObject;
    expect(before.state).toBe('RECEIVED'); expect(saved).toMatchObject({ stage: 'EXECUTING', responses: [], args: [], handler: 'pity' });
    expect(saved.intent).toBeUndefined(); const state = await gameplay(), sends = outbound.send.mock.calls.length;
    await pilot().consumeAuthenticated(envelope(messageId), receipt.id);
    const after = await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receipt.id } });
    expect(after.state).toBe('PROCESSED');
    expect((after.payloadMinimal as Prisma.JsonObject).commandPilot).toMatchObject({ commandKey: saved.commandKey, businessAt: saved.businessAt,
      intent: { now: saved.businessAt }, stage: 'RESPONSES', responses: [{ status: 'SENT' }] });
    expect(await gameplay()).toEqual(state); expect(outbound.send).toHaveBeenCalledTimes(sends + 1);
  }, 30_000);

  it('completes three existing deliveries plus real bootstrap reads without holding pool connections around root executor reads', async () => {
    const rows = await Promise.all([reserved(), reserved(), reserved()]);
    const before = await gameplay(), sends = outbound.send.mock.calls.length;
    let locks = 0, release!: () => void, reached!: () => void;
    const rendezvous = new Promise<void>(resolve => { release = resolve; });
    const reachedLocks = new Promise<void>(resolve => { reached = resolve; });
    const transaction = db.$transaction.bind(db);
    // A short test timeout bounds the deficient runtime's 60s transaction wait.
    // Only this schema's three real receipt row locks are coordinated, never public.
    const hook = vi.spyOn(db, '$transaction').mockImplementation((async (action: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) => transaction(async tx => {
      const proxied = new Proxy(tx, { get(target, property) {
        if (property !== '$queryRaw') return Reflect.get(target, property);
        return async (strings: TemplateStringsArray, ...values: unknown[]) => {
          const result = await tx.$queryRaw(strings, ...values);
          if (strings.join('').includes('FROM twitch_event_receipts') && strings.join('').includes('FOR UPDATE')) {
            const number = ++locks;
            if (number >= 4 && number <= 6) { if (number === 6) { reached(); release(); } await rendezvous; }
          }
          return result;
        };
      } });
      return action(proxied);
    }, { ...options, timeout: 3_000 })) as typeof db.$transaction);
    const restarted = pilot();
    let results: PromiseSettledResult<void>[] = [], bootstrap: PromiseSettledResult<unknown>[] = [];
    try {
      const deliveries = Promise.allSettled(rows.map(row => restarted.consumeAuthenticated(envelope(row.messageId), row.receipt.id)));
      await reachedLocks;
      bootstrap = await Promise.allSettled([gacha.execute(verifiedPlayerActor(player)), contest.getCurrent(verifiedPlayerActor(player))]);
      results = await deliveries;
    } finally { release(); hook.mockRestore(); }
    expect(results.map(r => r.status), JSON.stringify(results.map(r => r.status === 'rejected' ? r.reason.code : 'OK'))).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(bootstrap.map(r => r.status)).toEqual(['fulfilled', 'fulfilled']);
    for (const row of rows) {
      const after = await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: row.receipt.id } });
      expect(after.state).toBe('PROCESSED');
      expect((after.payloadMinimal as Prisma.JsonObject).commandPilot).toMatchObject({ commandKey: row.saved.commandKey, businessAt, stage: 'RESPONSES', responses: [{ status: 'SENT' }] });
    }
    expect(await gameplay()).toEqual(before); expect(outbound.send).toHaveBeenCalledTimes(sends + 3);
  }, 30_000);

  it('dry run is read only; the local path prepares and sends the existing pity exactly once', async () => {
    const row = await reserved(), request = await requestFor(row), restarted = pilot();
    const activity = new TwitchMessageActivity(db, { now: () => new Date(businessAt) }, { nextInt: () => 0 });
    const messages = (await db.playerProgression.findUniqueOrThrow({ where: { playerId: player.id } })).totalMessages;
    const plan = await activity.prepare(player, false, new Date(businessAt));
    expect(await activity.consume(player, row.messageId, '123', 5, false, new Date(businessAt), plan)).toEqual([]);
    row.receipt = await db.twitchEventReceipt.update({ where: { id: row.receipt.id }, data: { payloadMinimal: { commandPilot: row.saved,
      messageActivity: { key: `twitch-message:123:${row.messageId}`, now: businessAt, messageId: row.messageId, normal: false, length: 5, plan } } } });
    expect((await db.playerProgression.findUniqueOrThrow({ where: { playerId: player.id } })).totalMessages).toBe(messages + 1n);
    const before = await gameplay(), sends = outbound.send.mock.calls.length, audits = await db.twitchNativeAudit.count();
    await expect(restarted.retryResponses(player.id, row.receipt.id)).rejects.toMatchObject({ code: 'TWITCH_COMMAND_RESPONSE_AMBIGUOUS' });
    expect(await restarted.recoverExecutingPity(request)).toEqual({ state: 'DRY_RUN', responses: [] });
    expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: row.receipt.id } })).toEqual(row.receipt);
    expect(await db.twitchNativeAudit.count()).toBe(audits); expect(outbound.send).toHaveBeenCalledTimes(sends);
    expect(await restarted.recoverExecutingPity(request, true)).toEqual({ state: 'PROCESSED', responses: ['SENT'] });
    const after = await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: row.receipt.id } });
    expect(after.id).toBe(row.receipt.id); expect(after.externalEventId).toBe(row.receipt.externalEventId); expect(after.receivedAt).toEqual(row.receipt.receivedAt);
    expect((after.payloadMinimal as Prisma.JsonObject).commandPilot).toMatchObject({ commandKey: row.saved.commandKey, businessAt,
      intent: { now: businessAt }, stage: 'RESPONSES', responses: [{ status: 'SENT' }] });
    expect((after.payloadMinimal as Prisma.JsonObject).executingPityRecovery).toMatchObject({ version: 1, operatorPlayerId: player.id });
    expect(await gameplay()).toEqual(before); expect(await db.twitchNativeAudit.count()).toBe(audits + 1);
    expect(outbound.send).toHaveBeenCalledTimes(sends + 1);
    await refused(row, request);
  });

  it.each(['pull', 'banque', 'quotis', 'wheel', 'code', 'event'])('refuses interrupted mutation %s before intent, without an engaged operation', async handler => {
    await refused(await reserved(handler, ['1']));
  });

  it('refuses a mutating receipt after a real Pull commit, with no second spend, pull or reward', async () => {
    const row = await reserved('pull', ['1']), before = await gameplay();
    const intent = await core.prepare!(player, 'pull', ['1'], '!pull', row.saved.commandKey, businessAt);
    await core.execute(player, 'pull', ['1'], '!pull', row.saved.commandKey, intent);
    expect((await gameplay()).pulls).toHaveLength(before.pulls.length + 1);
    await refused(row); await refused(row);
  }, 30_000);

  it.each(['PENDING', 'COMPLETED', 'FAILED'] as const)('refuses any exact/suffix command operation in state %s', async status => {
    const row = await reserved();
    const operation = await db.businessOperation.create({ data: { playerId: player.id, sourceChannel: 'INTERNAL_CHAT', operationType: 'private.engaged',
      idempotencyKey: `private-owner:${row.saved.commandKey}`, status, completedAt: status === 'PENDING' ? null : new Date(businessAt) } });
    try { await refused(row); } finally { await db.businessOperation.delete({ where: { id: operation.id } }); }
  });

  it('refuses a different pending operation for the Player', async () => {
    const row = await reserved(), operation = await db.businessOperation.create({ data: { playerId: player.id, sourceChannel: 'UI', operationType: 'private.pending', idempotencyKey: randomUUID() } });
    try { await refused(row); } finally { await db.businessOperation.delete({ where: { id: operation.id } }); }
  });

  it.each(['intent', 'RESPONSES', 'SENDING', 'AMBIGUOUS', 'args', 'chatter', 'key', 'time', 'sender', 'player', 'processed'] as const)('refuses changed receipt guard %s', async kind => {
    const row = await reserved();
    if (kind === 'intent') await setSaved(row, { intent: JSON.parse(JSON.stringify(await core.prepare!(player, 'pity', [], '!pity', row.saved.commandKey, businessAt))) });
    if (kind === 'RESPONSES') await setSaved(row, { stage: 'RESPONSES', responses: [] });
    if (kind === 'SENDING' || kind === 'AMBIGUOUS') await setSaved(row, { responses: [{ text: 'Private', status: kind }] });
    if (kind === 'args') await setSaved(row, { args: ['1'] });
    if (kind === 'chatter') await setSaved(row, { chatterId: '456' });
    if (kind === 'key') await setSaved(row, { commandKey: 'twitch-command:123:changed' });
    if (kind === 'time') await setSaved(row, { businessAt: '2098-01-01T00:00:00.000Z' });
    if (kind === 'sender') await setSaved(row, { senderId: '456' });
    if (kind === 'player') await setSaved(row, { playerId: randomUUID() });
    if (kind === 'processed') await db.twitchEventReceipt.update({ where: { id: row.receipt.id }, data: { state: 'PROCESSED', processedAt: new Date() } });
    await refused(row);
    await db.twitchEventReceipt.delete({ where: { id: row.receipt.id } });
  });

  it.each(['SENDING', 'AMBIGUOUS'])('refuses uncertain outbound %s on another receipt', async status => {
    const other = await reserved(), row = await reserved();
    await setSaved(other, { stage: 'RESPONSES', responses: [{ text: 'Private', status }] });
    try { await refused(row); } finally { await db.twitchEventReceipt.delete({ where: { id: other.receipt.id } }); }
  });

  it.each(['OFF', 'GLOBAL', 'revision', 'target', 'allowlist', 'operator', 'expectedPlayer', 'identity'] as const)('refuses identity/authority guard %s', async kind => {
    const row = await reserved(), request = await requestFor(row);
    const control = await db.twitchNativeAuthority.findUniqueOrThrow({ where: { id: 'twitch-commands' } });
    const target = await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: '123' } });
    if (kind === 'OFF' || kind === 'GLOBAL') await db.twitchNativeAuthority.update({ where: { id: control.id }, data: { desiredMode: kind } });
    if (kind === 'revision') request.expectedRevision++;
    if (kind === 'target') await db.twitchNativeTarget.update({ where: { twitchUserId: '123' }, data: { canary: false } });
    if (kind === 'allowlist') config.twitch.pilotPlayerIds = [];
    if (kind === 'operator') request.operatorPlayerId = randomUUID();
    if (kind === 'expectedPlayer') request.expectedPlayerId = randomUUID();
    if (kind === 'identity') request.twitchUserId = '456';
    try { await refused(row, request); }
    finally {
      config.twitch.pilotPlayerIds = [player.id];
      await db.twitchNativeAuthority.update({ where: { id: control.id }, data: { desiredMode: control.desiredMode } });
      await db.twitchNativeTarget.update({ where: { twitchUserId: '123' }, data: { canary: target.canary } });
    }
  });

  it('fails closed if a future pity resolver proposes a mutation or another owner read', async () => {
    for (const patch of [{ mutation: { path: 'performGachaPullChat.execute', args: [] } }, { reads: { 'eventService.getCurrent': [] } }]) {
      const row = await reserved(), request = await requestFor(row), before = await gameplay();
      const executor = { ...core, prepare: async (...args: Parameters<NonNullable<TwitchCommandExecutor['prepare']>>) => ({ ...await core.prepare!(...args), ...patch }) };
      await expect(pilot(executor).recoverExecutingPity(request, true)).rejects.toMatchObject({ code: 'TWITCH_EXECUTING_PITY_RECOVERY_BLOCKED' });
      expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: row.receipt.id } })).toEqual(row.receipt); expect(await gameplay()).toEqual(before);
    }
  });

  it('allows only one of two concurrent local recovery attempts, across separate pilot instances', async () => {
    const row = await reserved(), request = await requestFor(row), before = await gameplay(), sends = outbound.send.mock.calls.length;
    const audits = await db.twitchNativeAudit.count();
    const attempts = await Promise.allSettled([pilot().recoverExecutingPity(request, true), pilot().recoverExecutingPity(request, true)]);
    expect(attempts.filter(a => a.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter(a => a.status === 'rejected')).toHaveLength(1);
    expect(await gameplay()).toEqual(before); expect(await db.twitchNativeAudit.count()).toBe(audits + 1);
    expect(outbound.send).toHaveBeenCalledTimes(sends + 1);
  });

  it('preserves owner idempotence when two pilot instances replay one frozen Pull concurrently', async () => {
    const row = await reserved('pull', ['1']), before = await gameplay(), sends = outbound.send.mock.calls.length;
    const intent = await core.prepare!(player, 'pull', ['1'], '!pull', row.saved.commandKey, businessAt);
    await setSaved(row, { intent: JSON.parse(JSON.stringify(intent)) });
    const attempts = await Promise.allSettled([pilot().consumeAuthenticated(envelope(row.messageId, '!pull 1'), row.receipt.id),
      pilot().consumeAuthenticated(envelope(row.messageId, '!pull 1'), row.receipt.id)]);
    expect(attempts.map(a => a.status)).toEqual(['fulfilled', 'fulfilled']);
    const after = await gameplay();
    expect(after.pulls).toHaveLength(before.pulls.length + 1);
    expect(after.operations).toHaveLength(before.operations.length + 1);
    expect(after.resources.find(r => r.resourceKey === 'primogems')!.amount).toBe(before.resources.find(r => r.resourceKey === 'primogems')!.amount - 160n);
    expect(outbound.send).toHaveBeenCalledTimes(sends + 1);
    expect((await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: row.receipt.id } })).state).toBe('PROCESSED');
  }, 30_000);
});
