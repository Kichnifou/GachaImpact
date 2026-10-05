import { randomUUID, createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { harness } from '../tests/helpers/chat-command-harness.js';
import type { ChatCommandServices } from '../src/application/chat/player-command-resolver.js';
import { twitchPlayerCommandExecutor } from '../src/application/twitch/twitch-player-command-executor.js';
import { parseChatCommand } from '../src/application/chat/chat-command-registry.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { verifiedPlayerActor } from '../src/application/player/player-execution-actor.js';
import { GetCurrentPlayerBox, SetBoxCharacterFavorite, SetBoxSortPreference } from '../src/application/box/box-services.js';
import { PrismaBoxStore } from '../src/infrastructure/database/prisma-box-store.js';
import { GetCurrentPlayerBank, TransferPlayerBank } from '../src/application/banking/banking-services.js';
import { PrismaBankingStore } from '../src/infrastructure/database/prisma-banking-store.js';
import { SocialService } from '../src/application/social/social-service.js';
import { TradeService } from '../src/application/trades/trade-service.js';
import { EventService } from '../src/application/event/event-service.js';
import { ClaimDailyReward } from '../src/application/daily-reward/claim-daily-reward.js';
import { PrismaDailyRewardStore } from '../src/infrastructure/database/prisma-daily-reward-store.js';
import { TwitchMessageActivity } from '../src/application/twitch/twitch-message-activity.js';
import { PermanentMissionService } from '../src/application/missions/permanent-mission-service.js';
import { progressPlayerMessage } from '../src/application/chat/message-progression.js';
import { PrismaPlayerXpService } from '../src/infrastructure/database/prisma-player-xp-service.js';
import { PrismaDailyChallengeStore } from '../src/infrastructure/database/prisma-daily-challenge-store.js';
import { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';
import { PrismaTeamStore } from '../src/infrastructure/database/prisma-team-store.js';
import { GetCurrentPlayerTeams, RenamePlayerTeam } from '../src/application/team/team-services.js';
import { TwitchCommandPilot } from '../src/application/twitch/twitch-command-pilot.js';
import { TwitchEventObserver } from '../src/application/twitch/twitch-event-observer.js';
import { TwitchReceiptRetention } from '../src/application/twitch/twitch-receipt-retention.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
let now = new Date('2026-09-30T21:59:58Z');
const clock = { now: () => new Date(now) }, random = { nextInt: () => 0 };
const getPlayer = new GetCurrentPlayer({ findByIdentity: async () => { throw new Error('No web identity'); }, provision: async () => { throw new Error('No provisioning'); } });
const events = new EventService(getPlayer, db, clock, random);
const daily = new ClaimDailyReward(getPlayer, new PrismaDailyRewardStore(db), clock);
const box = new PrismaBoxStore(db), bank = new PrismaBankingStore(db);
const teams = new PrismaTeamStore(db);
beforeAll(() => fixture.setup({ seedPublicCatalog: true }), 60_000);
afterAll(() => fixture.cleanup(), 60_000);

async function createPlayer(name = `Native ${randomUUID().slice(0, 8)}`, elementKey = 'hydro') {
  const player = await db.player.create({ data: { displayName: name, elementKey, progression: { create: {} },
    economyStats: { create: {} }, wheelStats: { create: {} }, dailyRewardState: { create: {} } } });
  await db.twitchIdentity.create({ data: { playerId: player.id, twitchUserId: String(BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 14))), login: 'untrusted' } });
  await db.$transaction(tx => new PermanentMissionService().initializePlayer(tx, player.id, now, true));
  const resources = await db.resourceDefinition.findMany({ where: { isActive: true } });
  await db.playerResourceBalance.createMany({ data: resources.map(row => ({ playerId: player.id, resourceKey: row.key, amount: row.key === 'moras' ? 500n : row.key.startsWith('particles_') ? 100n : 0n })) });
  return player;
}
function executor() {
  const services = { ...harness().services, tradePlayer: getPlayer, socialService: new SocialService(getPlayer, db, clock), tradeService: new TradeService(db, clock),
    getCurrentPlayerTeams: new GetCurrentPlayerTeams(getPlayer, teams), renamePlayerTeam: new RenamePlayerTeam(getPlayer, teams),
    getCurrentPlayerBox: new GetCurrentPlayerBox(getPlayer, box), setBoxCharacterFavorite: new SetBoxCharacterFavorite(getPlayer, box), setBoxSortPreference: new SetBoxSortPreference(getPlayer, box),
    getCurrentPlayerBank: new GetCurrentPlayerBank(getPlayer, bank, clock), depositPlayerBankChat: new TransferPlayerBank('deposit', getPlayer, bank, clock, 'CHAT'), eventService: events } as unknown as ChatCommandServices;
  return twitchPlayerCommandExecutor(db, services, clock);
}
async function prepare(player: Awaited<ReturnType<typeof createPlayer>>, text: string) {
  const { definition, args } = parseChatCommand(text), core = executor(), key = `twitch-command:123:${randomUUID()}`;
  const intent = await core.prepare!(player, definition!.handler!, args, definition!.syntax, key);
  return { intent, key, run: () => core.execute(player, definition!.handler!, args, definition!.syntax, key, intent) };
}

describe('R1047 frozen intent on private PostgreSQL', () => {
  it('recovers a Team mutation with source TWITCH and its original snapshot', async () => {
    const player = await createPlayer(); const first = await prepare(player, '!team rename "Première"');
    const result = await first.run(); const later = await prepare(player, '!team rename "Suivante"'); await later.run();
    expect(await first.run()).toEqual(result);
    expect((await db.team.findFirstOrThrow({ where: { playerId: player.id, isActive: true } })).name).toBe('Suivante');
    const operations = await db.businessOperation.findMany({ where: { playerId: player.id, idempotencyKey: { contains: first.key } } });
    expect(operations).toHaveLength(1); expect(operations[0]!.sourceChannel).toBe('TWITCH');
  });
  it('replays a setting without overwriting a later independent choice', async () => {
    const player = await createPlayer();
    const character = await db.character.findFirstOrThrow({ where: { isActive: true, rarity: 4 } });
    await db.playerCharacter.create({ data: { playerId: player.id, characterId: character.id, constellation: 0, copies: 1, firstObtainedAt: now } });
    const first = await prepare(player, `!box favoris ${character.name.replaceAll(' ', '_')}`);
    expect(await db.businessOperation.count({ where: { playerId: player.id, operationType: 'box.favorite' } })).toBe(0);
    const result = await first.run();
    const later = await prepare(player, `!box favoris ${character.name.replaceAll(' ', '_')}`); await later.run();
    expect(await first.run()).toEqual(result);
    expect((await db.playerCharacter.findUniqueOrThrow({ where: { playerId_characterId: { playerId: player.id, characterId: character.id } } })).favorite).toBe(false);
    const operations = await db.businessOperation.findMany({ where: { playerId: player.id, operationType: 'box.favorite' } });
    expect(operations).toHaveLength(2); expect(operations.every(row => row.sourceChannel === 'TWITCH')).toBe(true);
  });
  it('preserves bank MAX and the Paris day across a changed wallet and day', async () => {
    now = new Date('2026-09-30T21:59:58Z'); const player = await createPlayer();
    const command = await prepare(player, '!banque deposer max');
    await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: 'moras' } }, data: { amount: 900n } });
    now = new Date('2026-10-02T12:00:00Z'); const result = await command.run();
    expect(await command.run()).toEqual(result);
    const transaction = await db.bankTransaction.findFirstOrThrow({ where: { playerId: player.id, transactionType: 'DEPOSIT' } });
    expect(transaction.amount).toBe(500n); expect(transaction.createdAt.toISOString()).toBe(command.intent.now);
    expect((await db.businessOperation.findUniqueOrThrow({ where: { id: transaction.operationId } })).sourceChannel).toBe('TWITCH');
    expect(await db.bankTransaction.count({ where: { playerId: player.id, transactionType: 'DEPOSIT' } })).toBe(1);
    expect((await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: 'moras' } } })).amount).toBe(400n);
  });
  it('does not resolve a renamed trade partner or MAX again after preparation', async () => {
    const player = await createPlayer(), target = await createPlayer('FrozenPartner', 'pyro');
    const command = await prepare(player, '!echanger FrozenPartner max');
    await db.player.update({ where: { id: target.id }, data: { displayName: 'RenamedPartner' } });
    await createPlayer('FrozenPartner', 'cryo');
    const result = await command.run(); expect(await command.run()).toEqual(result);
    const request = await db.tradeRequest.findFirstOrThrow({ where: { senderPlayerId: player.id } });
    expect(request.recipientPlayerId).toBe(target.id); expect(request.currentAmount).toBe(100n);
    expect(await db.tradeRequest.count({ where: { senderPlayerId: player.id } })).toBe(1);
    expect((await db.businessOperation.findUniqueOrThrow({ where: { id: request.operationId! } })).sourceChannel).toBe('TWITCH');
  });
  it('joins the prepared Event edition after month change and recovers its original result', async () => {
    now = new Date('2026-09-30T12:00:00Z'); const player = await createPlayer();
    const command = await prepare(player, '!event go'), editionId = command.intent.targets!.eventEditionId!;
    now = new Date('2026-10-01T12:00:00Z'); const result = await command.run();
    const edition = await db.eventEdition.findUniqueOrThrow({ where: { id: editionId } });
    await db.playerEventCurrencyBalance.update({ where: { playerId_eventDefinitionId: { playerId: player.id, eventDefinitionId: edition.eventDefinitionId } }, data: { amount: 99n } });
    expect(await command.run()).toEqual(result);
    const participants = await db.eventParticipant.findMany({ where: { playerId: player.id } });
    expect(participants).toHaveLength(1); expect(participants[0]!.eventEditionId).toBe(editionId);
    expect((await db.businessOperation.findFirstOrThrow({ where: { playerId: player.id, operationType: 'event.join' } })).sourceChannel).toBe('TWITCH');
  });
});

describe('R1047 ordinary messages on private PostgreSQL', () => {
  it('persists the ordinary-message plan before effects and uses the same message ID across transport receipts', async () => {
    now = new Date('2026-09-28T12:00:00Z'); const player = await createPlayer();
    const identity = await db.twitchIdentity.update({ where: { playerId: player.id }, data: { login: 'kichnifou' } });
    const userId = identity.twitchUserId, text = 'Message ordinaire';
    const body = { subscription: { id: 'private', type: 'channel.chat.message', version: '1', status: 'enabled',
      condition: { broadcaster_user_id: userId, user_id: userId }, transport: { method: 'webhook', callback: 'https://api.example/api/v1/twitch/eventsub' } },
      event: { chatter_user_id: userId, broadcaster_user_id: userId, message_id: randomUUID(), message: { text } } };
    const outbound = { send: vi.fn(async () => randomUUID()) };
    const core = executor(), activity = new TwitchMessageActivity(db, clock, random, daily, events);
    const consume = vi.spyOn(activity, 'consume');
    const pilot = new TwitchCommandPilot(db, { host: 'localhost', port: 3001, supabase: {}, twitch: { pilotPlayerIds: [player.id], pilotLogin: 'kichnifou' }, twitchCommandPilot: { enabled: true } },
      core, outbound, undefined, { activationAvailable: true, inspectPilotChatTransport: async () => ({ subscriptionId: 'private', broadcasterId: userId, receiverId: userId, callback: 'https://api.example/api/v1/twitch/eventsub' }) }, activity);
    await pilot.arm(player.id);
    const observer = new TwitchEventObserver(db, new TwitchReceiptRetention(db, () => 0));
    const observe = () => observer.observeTwitchEvent({ externalEventId: randomUUID(), eventType: 'channel.chat.message', twitchUserId: userId,
      contentHash: createHash('sha256').update(text).digest('hex') });
    const first = (await observe()).receipt;
    consume.mockImplementationOnce(async (...args) => {
      const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: first.id } });
      expect(receipt.externalReference).toMatch(/^message-native:/u);
      expect(receipt.payloadMinimal).toMatchObject({ messageActivity: { now: now.toISOString(), normal: true, plan: { daily: true } } });
      expect(await db.businessOperation.count({ where: { playerId: player.id, operationType: 'twitch.message' } })).toBe(0);
      return TwitchMessageActivity.prototype.consume.call(activity, ...args);
    });
    await pilot.consumeAuthenticated(body, first.id); const sends = outbound.send.mock.calls.length;
    expect(sends).toBeGreaterThan(0);
    now = new Date('2026-09-29T12:00:00Z');
    await pilot.consumeAuthenticated(body, first.id); await pilot.consumeAuthenticated(body, (await observe()).receipt.id);
    expect(outbound.send).toHaveBeenCalledTimes(sends);
    expect((await db.playerProgression.findUniqueOrThrow({ where: { playerId: player.id } })).totalMessages).toBe(1n);
    body.event.message_id = randomUUID(); await pilot.consumeAuthenticated(body, (await observe()).receipt.id);
    expect((await db.playerProgression.findUniqueOrThrow({ where: { playerId: player.id } })).totalMessages).toBe(2n);
    expect(await db.globalChatMessage.count()).toBe(0);
  }, 60_000);
  it('shares the 2s XP cooldown, counts commands without XP, and replays without another daily reward', async () => {
    now = new Date('2026-09-28T12:00:00Z'); const player = await createPlayer();
    const activity = new TwitchMessageActivity(db, clock, random, daily), id = randomUUID();
    const output = await activity.consume(player, id, '123', 101, true);
    expect(output.join(' ')).toContain('récompense quotidienne');
    now = new Date('2026-09-28T12:00:01Z');
    // The shared standalone progression owner sees exactly the same cooldown timestamp.
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM players WHERE id = ${player.id}::uuid FOR UPDATE`;
      const operation = await tx.businessOperation.create({ data: { playerId: player.id, operationType: 'chat.message', sourceChannel: 'INTERNAL_CHAT', status: 'COMPLETED' } });
      const economy = new PrismaEconomyService(() => now), missions = new PermanentMissionService(economy);
      const result = await progressPlayerMessage(tx, { playerId: player.id, elementKey: player.elementKey, length: 10, normal: true, now, operationId: operation.id, source: 'INTERNAL_CHAT' },
        { xp: new PrismaPlayerXpService(economy, missions), missions, dailyChallenges: new PrismaDailyChallengeStore(db, economy), random });
      expect(result.xpGranted).toBe(0);
    });
    await activity.consume(player, randomUUID(), '123', 5, false);
    now = new Date('2026-09-28T12:00:02Z'); await activity.consume(player, randomUUID(), '123', 201, true);
    const before = await db.playerProgression.findUniqueOrThrow({ where: { playerId: player.id } });
    expect(before).toMatchObject({ xp: 5n, totalMessages: 4n, countedMessages: 2n });
    now = new Date('2026-09-29T12:00:00Z'); expect(await activity.consume(player, id, '123', 101, true)).toEqual(output);
    expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: player.id } })).toEqual(before);
    expect(await db.businessOperation.count({ where: { playerId: player.id, operationType: 'daily-reward.claim' } })).toBe(1);
    expect(await db.globalChatMessage.count()).toBe(0); expect(await db.webIdentity.count()).toBe(0);
  });
  it('delivers an old Event social message despite viewedAt, claims one bonus and preserves both outputs', async () => {
    now = new Date('2026-09-30T12:00:00Z'); const player = await createPlayer(), sender = await createPlayer();
    const joined = await events.join(verifiedPlayerActor(player), randomUUID(), 'TWITCH');
    const message = await db.eventSocialMessage.create({ data: { senderPlayerId: sender.id, recipientPlayerId: player.id, eventEditionId: joined.edition.id,
      businessDate: new Date('2026-09-29'), content: 'Message toujours à livrer', createdAt: new Date('2026-09-29T12:00:00Z'), viewedAt: now } });
    const activity = new TwitchMessageActivity(db, clock, random, daily, events), intent = await activity.prepare(player, true, now), id = randomUUID();
    const output = await activity.consume(player, id, '123', 10, true, now, intent);
    expect(output.join(' ')).toContain('Message toujours à livrer'); expect(output.join(' ')).toContain('+1'); expect(output.join(' ')).toContain('se termine aujourd’hui');
    const operations = await db.businessOperation.count({ where: { playerId: player.id } });
    now = new Date('2026-10-01T12:00:00Z'); expect(await activity.consume(player, id, '123', 10, true, now, intent)).toEqual(output);
    expect(await db.businessOperation.count({ where: { playerId: player.id } })).toBe(operations);
    expect((await db.businessOperation.findFirstOrThrow({ where: { idempotencyKey: `event-message-delivery:${message.id}` } })).sourceChannel).toBe('TWITCH');
    expect(await db.eventSocialMessage.findUnique({ where: { id: message.id } })).not.toBeNull();
    expect(await db.globalChatMessage.count()).toBe(0);
  });
});
